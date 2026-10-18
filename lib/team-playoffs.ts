import {randomBytes,randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {database} from '@/scripts/local-store.mjs';
import {AccountAccessError} from './account-access';
import {pairRanks,pairRequestedClubQualifiers,simulateTie} from './team-sim';

// Community team vote -> best-v-worst home-and-away playoff, simulated. Owner-only changes; everyone in the tournament can read it.
type Actor={userId:string;displayName:string};
function fail(m:string,s=400):never{throw new AccountAccessError(m,s);}
const db=()=>database() as DatabaseSync,nowIso=()=>new Date().toISOString();
function tx<T>(fn:(d:DatabaseSync)=>T):T{const d=db();d.exec('BEGIN IMMEDIATE');try{const r=fn(d);d.exec('COMMIT');return r;}catch(e){if(d.isTransaction)d.exec('ROLLBACK');throw e;}}
const reason=z.string().trim().min(3,'Give a reason (at least 3 characters).').max(300);
const createSchema=z.object({
  name:z.string().trim().min(1).max(100),
  directCount:z.number().int().min(0).max(62),
  entries:z.array(z.object({team:z.string().trim().min(1).max(80),votes:z.number().int().min(0).max(1000),strength:z.number().positive().max(1000).optional()})).min(2).max(64),
});
const runSchema=z.object({id:z.string().min(1),version:z.number().int().min(1)});
const cancelSchema=runSchema.extend({reason});
function owner(d:DatabaseSync,tid:string,actor:Actor){
  const t=d.prepare('SELECT id,owner_id FROM tournaments WHERE id=?').get(tid) as {id:string;owner_id:string}|undefined;
  if(!t||t.owner_id!==actor.userId)fail('Only the organizer can do that.',403);
}
function audit(d:DatabaseSync,tid:string,actor:Actor,action:string,why:string,after:unknown){
  d.prepare('INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after") VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),tid,actor.userId,actor.displayName,nowIso(),action,why,'null',JSON.stringify(after));
}
export function createTeamPlayoff(tid:string,actor:Actor,input:unknown){
  const data=createSchema.parse(input);
  const seen=new Set<string>();
  for(const e of data.entries){const k=e.team.toLowerCase();if(seen.has(k))fail(`${e.team} appears twice. List each team once.`);seen.add(k);}
  const playoffTeams=data.entries.length-data.directCount;
  if(playoffTeams<2||playoffTeams%2!==0)fail(`After ${data.directCount} direct places, ${playoffTeams} teams would be left. The playoff needs an even number, at least 2.`);
  return tx(d=>{
    owner(d,tid,actor);
    if(d.prepare("SELECT 1 FROM team_playoffs WHERE tournament_id=? AND status IN ('ready','simulated')").get(tid))fail('A team playoff already exists. Cancel it (with a reason) before creating another.',409);
    const id=randomUUID(),at=nowIso(),seed=randomBytes(12).toString('hex');
    d.prepare("INSERT INTO team_playoffs(id,tournament_id,name,direct_count,seed,status,created_by,created_at) VALUES(?,?,?,?,?,'ready',?,?)").run(id,tid,data.name,data.directCount,seed,actor.userId,at);
    data.entries.forEach((e,i)=>d.prepare('INSERT INTO team_playoff_entries(playoff_id,rank,team,votes,strength) VALUES(?,?,?,?,?)').run(id,i+1,e.team,e.votes,e.strength??Math.max(e.votes,1)));
    const tournament=d.prepare("SELECT json_extract(config,'$.tournamentId') AS format FROM tournaments WHERE id=?").get(tid) as {format:string|null};
    const pairs=tournament.format==='ucl-fantasy-2026'
      ?pairRequestedClubQualifiers(data.directCount+1,data.entries.map(e=>e.team))
      :pairRanks(data.directCount+1,data.entries.length);
    for(const p of pairs)d.prepare('INSERT INTO team_playoff_ties(id,playoff_id,position,high_rank,low_rank) VALUES(?,?,?,?,?)').run(randomUUID(),id,p.position,p.high,p.low);
    audit(d,tid,actor,'create-team-playoff','Organizer created the team playoff from the final vote order.',{id,teams:data.entries.map(e=>e.team),directCount:data.directCount});
    return {id};
  });
}
export function simulateTeamPlayoff(tid:string,actor:Actor,input:unknown){
  const data=runSchema.parse(input);
  return tx(d=>{
    owner(d,tid,actor);
    const p=d.prepare('SELECT * FROM team_playoffs WHERE id=? AND tournament_id=?').get(data.id,tid) as {id:string;status:string;version:number;seed:string}|undefined;
    if(!p)fail('Team playoff not found.',404);
    if(p.version!==data.version)fail('This playoff changed. Refresh and try again.',409);
    if(p.status!=='ready')fail(p.status==='simulated'?'This playoff has already been simulated. Cancel it to run a new one.':'This playoff was cancelled.',409);
    const str=new Map((d.prepare('SELECT rank,strength FROM team_playoff_entries WHERE playoff_id=?').all(p.id) as {rank:number;strength:number}[]).map(r=>[r.rank,r.strength]));
    const ties=d.prepare('SELECT id,position,high_rank,low_rank FROM team_playoff_ties WHERE playoff_id=? ORDER BY position').all(p.id) as {id:string;position:number;high_rank:number;low_rank:number}[];
    const results=[];
    for(const t of ties){
      const r=simulateTie(p.seed,t.position,str.get(t.low_rank)!,str.get(t.high_rank)!);
      d.prepare('UPDATE team_playoff_ties SET l1_low=?,l1_high=?,l2_low=?,l2_high=?,pens_low=?,pens_high=?,winner_rank=? WHERE id=?').run(r.l1Low,r.l1High,r.l2Low,r.l2High,r.pensLow,r.pensHigh,r.winner==='low'?t.low_rank:t.high_rank,t.id);
      results.push({position:t.position,winner:r.winner==='low'?t.low_rank:t.high_rank});
    }
    d.prepare("UPDATE team_playoffs SET status='simulated',simulated_at=?,version=version+1 WHERE id=?").run(nowIso(),p.id);
    audit(d,tid,actor,'simulate-team-playoff','Organizer ran the team playoff simulation.',{id:p.id,seed:p.seed,results});
    return {ok:true};
  });
}
// The ties are played in EA FC. The organizer enters the two-leg scores; the app checks them and works out the winner.
const goals=z.number().int().min(0).max(30);
const resultSchema=runSchema.extend({position:z.number().int().min(1),leg1:z.object({lowGoals:goals,highGoals:goals}),leg2:z.object({lowGoals:goals,highGoals:goals}),pens:z.object({low:z.number().int().min(0).max(30),high:z.number().int().min(0).max(30)}).optional()});
export function recordTeamTie(tid:string,actor:Actor,input:unknown){
  const data=resultSchema.parse(input);
  return tx(d=>{
    owner(d,tid,actor);
    const p=d.prepare('SELECT id,status,version FROM team_playoffs WHERE id=? AND tournament_id=?').get(data.id,tid) as {id:string;status:string;version:number}|undefined;
    if(!p)fail('Team playoff not found.',404);
    if(p.version!==data.version)fail('This playoff changed. Refresh and try again.',409);
    if(p.status!=='ready')fail(p.status==='cancelled'?'This playoff was cancelled.':'All ties are already recorded.',409);
    const t=d.prepare('SELECT id,high_rank,low_rank,winner_rank FROM team_playoff_ties WHERE playoff_id=? AND position=?').get(p.id,data.position) as {id:string;high_rank:number;low_rank:number;winner_rank:number|null}|undefined;
    if(!t)fail('Tie not found.',404);
    if(t.winner_rank)fail('This tie already has a result. A recorded result cannot be edited; cancel the playoff and recreate it if a score was wrong.',409);
    const low=data.leg1.lowGoals+data.leg2.lowGoals,high=data.leg1.highGoals+data.leg2.highGoals;
    let winner:number;
    if(low!==high){if(data.pens)fail('Penalties are only for ties that are level on aggregate.');winner=low>high?t.low_rank:t.high_rank;}
    else{
      if(!data.pens)fail(`Level on aggregate (${low}–${high}). Enter the penalty shootout score.`);
      if(data.pens.low===data.pens.high)fail('A shootout cannot end level.');
      winner=data.pens.low>data.pens.high?t.low_rank:t.high_rank;
    }
    d.prepare('UPDATE team_playoff_ties SET l1_low=?,l1_high=?,l2_low=?,l2_high=?,pens_low=?,pens_high=?,winner_rank=? WHERE id=?').run(data.leg1.lowGoals,data.leg1.highGoals,data.leg2.lowGoals,data.leg2.highGoals,data.pens?.low??null,data.pens?.high??null,winner,t.id);
    const left=(d.prepare('SELECT COUNT(*) AS n FROM team_playoff_ties WHERE playoff_id=? AND winner_rank IS NULL').get(p.id) as {n:number}).n;
    if(left===0)d.prepare("UPDATE team_playoffs SET status='simulated',simulated_at=?,version=version+1 WHERE id=?").run(nowIso(),p.id);
    else d.prepare('UPDATE team_playoffs SET version=version+1 WHERE id=?').run(p.id);
    audit(d,tid,actor,'record-team-tie','Organizer entered the EA FC result for a team playoff tie.',{id:p.id,position:data.position,leg1:data.leg1,leg2:data.leg2,pens:data.pens??null,winnerRank:winner});
    return {ok:true,complete:left===0};
  });
}
export function cancelTeamPlayoff(tid:string,actor:Actor,input:unknown){
  const data=cancelSchema.parse(input);
  return tx(d=>{
    owner(d,tid,actor);
    const p=d.prepare('SELECT status,version FROM team_playoffs WHERE id=? AND tournament_id=?').get(data.id,tid) as {status:string;version:number}|undefined;
    if(!p)fail('Team playoff not found.',404);
    if(p.version!==data.version)fail('This playoff changed. Refresh and try again.',409);
    if(p.status==='cancelled')fail('This playoff is already cancelled.',409);
    d.prepare("UPDATE team_playoffs SET status='cancelled',cancelled_at=?,cancelled_by=?,cancel_reason=?,version=version+1 WHERE id=?").run(nowIso(),actor.userId,data.reason,data.id);
    audit(d,tid,actor,'cancel-team-playoff',data.reason,{id:data.id,was:p.status});
    return {ok:true};
  });
}
export function getTeamPlayoff(tid:string){
  const d=db();
  const p=d.prepare("SELECT * FROM team_playoffs WHERE tournament_id=? AND status IN ('ready','simulated')").get(tid) as {id:string;name:string;direct_count:number;seed:string;status:string;version:number;created_at:string;simulated_at:string|null}|undefined;
  const cancelled=(d.prepare("SELECT id,name,cancelled_at,cancel_reason FROM team_playoffs WHERE tournament_id=? AND status='cancelled' ORDER BY cancelled_at DESC LIMIT 10").all(tid) as {id:string;name:string;cancelled_at:string;cancel_reason:string}[]);
  if(!p)return {playoff:null,cancelled};
  const entries=(d.prepare('SELECT rank,team,votes,strength FROM team_playoff_entries WHERE playoff_id=? ORDER BY rank').all(p.id) as {rank:number;team:string;votes:number;strength:number}[]).map(e=>({...e,direct:e.rank<=p.direct_count}));
  const byRank=new Map(entries.map(e=>[e.rank,e]));
  const ties=(d.prepare('SELECT * FROM team_playoff_ties WHERE playoff_id=? ORDER BY position').all(p.id) as {position:number;high_rank:number;low_rank:number;l1_low:number|null;l1_high:number|null;l2_low:number|null;l2_high:number|null;pens_low:number|null;pens_high:number|null;winner_rank:number|null}[]).map(t=>({
    position:t.position,high:byRank.get(t.high_rank)!,low:byRank.get(t.low_rank)!,
    leg1:t.l1_low==null?null:{home:byRank.get(t.low_rank)!.team,homeGoals:t.l1_low,away:byRank.get(t.high_rank)!.team,awayGoals:t.l1_high!},
    leg2:t.l2_low==null?null:{home:byRank.get(t.high_rank)!.team,homeGoals:t.l2_high!,away:byRank.get(t.low_rank)!.team,awayGoals:t.l2_low},
    aggregate:t.l1_low==null?null:{high:t.l1_high!+t.l2_high!,low:t.l1_low+t.l2_low!},
    penalties:t.pens_low==null?null:{high:t.pens_high!,low:t.pens_low},
    winner:t.winner_rank?byRank.get(t.winner_rank)!.team:null,
  }));
  const qualified=p.status==='simulated'?[...entries.filter(e=>e.direct).map(e=>e.team),...ties.map(t=>t.winner!)]:[];
  return {playoff:{id:p.id,name:p.name,status:p.status,version:p.version,directCount:p.direct_count,seed:p.status==='simulated'?p.seed:null,simulatedAt:p.simulated_at,entries,ties,qualified},cancelled};
}
