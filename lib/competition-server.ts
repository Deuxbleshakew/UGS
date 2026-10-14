import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { database } from '@/scripts/local-store.mjs';
import { z } from 'zod';
import type { Config, Fixture } from './domain';
import { eloRankings, planRound, resolveTie, seedPlayers, type CommunityPlayer, type EloResult, type Playoff, type PlayoffTie, type SeededPlayer } from './competition';

export class CompetitionError extends Error { constructor(message:string,public status=400){super(message);} }
function fail(message:string,status=400):never{throw new CompetitionError(message,status);}
const db=()=>database() as DatabaseSync;
const now=()=>new Date().toISOString(),id=()=>crypto.randomUUID();
const rows=<T>(sql:string,...args:SQLInputValue[])=>db().prepare(sql).all(...args) as T[];
const one=<T>(sql:string,...args:SQLInputValue[])=>db().prepare(sql).get(...args) as T|undefined;
function atomic<T>(work:()=>T):T {const connection=db();connection.exec('BEGIN IMMEDIATE');try{const value=work();connection.exec('COMMIT');return value;}catch(error){connection.exec('ROLLBACK');throw error;}}
type Actor={userId:string;displayName:string};
type Tournament={id:string;owner_id:string;config:string;locked_at:string|null};
function audit(tid:string,user:Actor,action:string,before:unknown,after:unknown){
  db().prepare('INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after") VALUES(?,?,?,?,?,?,?,?,?)').run(id(),tid,user.userId,user.displayName,now(),action,'Organizer updated player competition.',JSON.stringify(before),JSON.stringify(after));
}
function tournament(tid:string){const t=one<Tournament>('SELECT * FROM tournaments WHERE id=?',tid);if(!t)fail('Tournament not found.',404);return t;}
function unlocked(tid:string){const t=tournament(tid);if(t.locked_at)fail('Unlock tournament awards before changing the competition.');return t;}
function parseFixture(row:Record<string,unknown>):Fixture{return {...row,report:row.report?JSON.parse(String(row.report)):null} as Fixture;}
function fixtures(tid:string){return rows<Record<string,unknown>>('SELECT rowid AS rating_order,* FROM fixtures WHERE tournament_id=? ORDER BY rowid',tid).map(parseFixture);}

// Existing manager IDs plus names retain their identity between imported seasons.
// Account/email links take precedence. Newly added players have their own stable IDs.
export function ensurePlayers(ownerId:string){atomic(()=>{
  const tournaments=rows<Tournament>('SELECT * FROM tournaments WHERE owner_id=? ORDER BY created_at,id',ownerId);
  for(const t of tournaments){
    const config=JSON.parse(t.config) as Config;
    for(const manager of config.managers){
      let link=one<{player_id:string}>('SELECT player_id FROM player_links WHERE tournament_id=? AND manager_id=?',t.id,manager.id);
      if(!link){
        const member=one<{email:string;user_id:string|null;player_id:string|null}>('SELECT email,user_id,player_id FROM members WHERE tournament_id=? AND manager_id=?',t.id,manager.id);
        let player=member?.player_id?one<{id:string}>('SELECT id FROM community_players WHERE id=? AND owner_id=?',member.player_id,ownerId):undefined;
        if(!player&&member)player=one<{id:string}>('SELECT p.id FROM community_players p JOIN members m ON m.player_id=p.id WHERE p.owner_id=? AND (m.email=? OR (? IS NOT NULL AND m.user_id=?)) LIMIT 1',ownerId,member.email,member.user_id,member.user_id);
        if(!player)player=one<{id:string}>('SELECT p.id FROM community_players p JOIN player_links l ON l.player_id=p.id WHERE p.owner_id=? AND l.manager_id=? AND p.name=? COLLATE NOCASE LIMIT 1',ownerId,manager.id,manager.name.trim());
        if(!player){player={id:id()};db().prepare('INSERT INTO community_players(id,owner_id,name,created_at) VALUES(?,?,?,?)').run(player.id,ownerId,manager.name.trim(),now());}
        db().prepare('INSERT INTO player_links(tournament_id,manager_id,player_id) VALUES(?,?,?)').run(t.id,manager.id,player.id);link={player_id:player.id};
      }
      db().prepare('UPDATE members SET player_id=? WHERE tournament_id=? AND manager_id=? AND player_id IS NULL').run(link.player_id,t.id,manager.id);
    }
    // Backfill finalized history once, using assignments which were locked by fixtures.
    const links=new Map(rows<{manager_id:string;player_id:string}>('SELECT manager_id,player_id FROM player_links WHERE tournament_id=?',t.id).map(l=>[l.manager_id,l.player_id]));
    for(const club of config.clubs){const playerId=club.manager?links.get(club.manager):undefined;if(!playerId)continue;
      db().prepare("UPDATE fixtures SET home_player_id=? WHERE tournament_id=? AND kind='club' AND home=? AND home_player_id IS NULL AND status='finalized'").run(playerId,t.id,club.id);
      db().prepare("UPDATE fixtures SET away_player_id=? WHERE tournament_id=? AND kind='club' AND away=? AND away_player_id IS NULL AND status='finalized'").run(playerId,t.id,club.id);
    }
  }
});}

export function listPlayers(ownerId:string):CommunityPlayer[]{return rows<CommunityPlayer>('SELECT id,name,created_at FROM community_players WHERE owner_id=? ORDER BY name,id',ownerId);}
export function managerPlayer(tid:string,managerId?:string){return managerId?one<{player_id:string}>('SELECT player_id FROM player_links WHERE tournament_id=? AND manager_id=?',tid,managerId)?.player_id??null:null;}
export function listPlayoffs(tid:string):Playoff[]{
  return rows<Record<string,unknown>>('SELECT * FROM playoffs WHERE tournament_id=? ORDER BY created_at DESC,id',tid).map(p=>({...p,entrants:JSON.parse(String(p.entrants)),automatic_qualifiers:JSON.parse(String(p.automatic_qualifiers)),qualified:JSON.parse(String(p.qualified)),ties:rows<PlayoffTie>('SELECT * FROM playoff_ties WHERE playoff_id=? ORDER BY round,position',String(p.id))} as Playoff));
}

export function communityRankings(ownerId:string){
  const all=rows<Record<string,unknown>>('SELECT f.rowid AS rating_order,f.*,p.elo_mode,pt.player_a,pt.player_b FROM fixtures f JOIN tournaments t ON t.id=f.tournament_id LEFT JOIN playoff_ties pt ON pt.id=f.tie_id LEFT JOIN playoffs p ON p.id=pt.playoff_id WHERE t.owner_id=? ORDER BY f.rowid',ownerId);
  const fs=all.map(row=>({...parseFixture(row),rating_order:Number(row.rating_order),elo_mode:row.elo_mode as string|undefined}));
  const events:EloResult[]=[],done=new Set<string>();
  for(const f of fs){
    if(f.status!=='finalized'||!f.report||!f.home_player_id||!f.away_player_id||!f.finalized_at)continue;
    if(f.tie_id&&f.elo_mode==='tie'){
      if(done.has(f.tie_id))continue;done.add(f.tie_id);
      const raw=all.find(r=>r.id===f.id)!;
      const outcome=resolveTie({id:f.tie_id,player_a:String(raw.player_a),player_b:String(raw.player_b)} as PlayoffTie,fs);
      if(!outcome.complete||!outcome.winner)continue;
      const legs=fs.filter(leg=>leg.tie_id===f.tie_id);
      events.push({id:f.tie_id,home:String(raw.player_a),away:String(raw.player_b),score:outcome.winner===raw.player_a?1:0,at:legs.map(l=>l.finalized_at!).sort().at(-1)!,order:Math.max(...legs.map(l=>l.rating_order))});
    }else{
      const r=f.report;events.push({id:f.id,home:f.home_player_id,away:f.away_player_id,score:r.homeScore>r.awayScore?1:r.homeScore<r.awayScore?0:0.5,at:f.finalized_at,order:f.rating_order});
    }
  }
  return eloRankings(listPlayers(ownerId),events);
}

export function addPlayer(tid:string,user:Actor,input:unknown){
  const data=z.object({name:z.string().trim().min(1).max(80)}).parse(input);
  return atomic(()=>{
    const t=unlocked(tid);
    if(one('SELECT id FROM community_players WHERE owner_id=? AND name=? COLLATE NOCASE',t.owner_id,data.name))fail('A player with that name already exists. Use their existing entry, or a distinct display name.',409);
    const p={id:id(),name:data.name,created_at:now()};
    db().prepare('INSERT INTO community_players(id,owner_id,name,created_at) VALUES(?,?,?,?)').run(p.id,t.owner_id,p.name,p.created_at);
    audit(tid,user,'add-player',null,p);return p;
  });
}

export function authorizePlayer(tid:string,user:Actor,input:unknown){
  const data=z.object({playerId:z.string().min(1),email:z.string().trim().email().max(254).transform(s=>s.toLowerCase())}).parse(input);
  return atomic(()=>{
    const t=tournament(tid),player=one<CommunityPlayer>('SELECT id,name,created_at FROM community_players WHERE id=? AND owner_id=?',data.playerId,t.owner_id);
    if(!player)fail('Choose a player from your community.');
    const sameEmail=one<{player_id:string|null;manager_id:string|null}>('SELECT player_id,manager_id FROM members WHERE tournament_id=? AND email=?',tid,data.email);
    const existing=one<{email:string}>('SELECT email FROM members WHERE tournament_id=? AND player_id=?',tid,player.id);
    if(sameEmail&&sameEmail.player_id!==player.id)fail('That email already represents another player in this tournament.');
    if(existing&&existing.email!==data.email)fail('This player is already linked to a different email.');
    const elsewhere=one<{player_id:string}>('SELECT m.player_id FROM members m JOIN tournaments t ON t.id=m.tournament_id WHERE t.owner_id=? AND m.email=? AND m.player_id IS NOT NULL LIMIT 1',t.owner_id,data.email);
    if(elsewhere&&elsewhere.player_id!==player.id)fail('That email is already linked to a different community player. Use their existing player entry.');
    const linked=one<{manager_id:string}>('SELECT manager_id FROM player_links WHERE tournament_id=? AND player_id=?',tid,player.id);
    if(!existing)db().prepare("INSERT INTO members(id,tournament_id,email,name,role,manager_id,player_id) VALUES(?,?,?,?,'manager',?,?)").run(id(),tid,data.email,player.name,linked?.manager_id??null,player.id);
    audit(tid,user,'authorize-player',null,{playerId:player.id,existingMembership:!!existing});
    return {email:data.email,name:player.name};
  });
}

function insertRound(playoffId:string,tid:string,round:number,entrants:SeededPlayer[],target:number){
  const plan=planRound(entrants,target),pairs=[...plan.byes.map(p=>({a:p.id,b:null as string|null})),...plan.pairs.map(p=>({a:p.higher.id,b:p.lower.id as string|null}))];
  const insert=db().prepare("INSERT INTO fixtures(id,tournament_id,home,away,stage,matchday,kind,home_player_id,away_player_id,tie_id,leg,playoff_round) VALUES(?,?,?,?,'playoff',?,'player',?,?,?,?,?)");
  pairs.forEach((pair,position)=>{
    const tieId=id();db().prepare('INSERT INTO playoff_ties(id,playoff_id,round,position,player_a,player_b) VALUES(?,?,?,?,?,?)').run(tieId,playoffId,round,position,pair.a,pair.b);
    if(!pair.b)return;
    // The higher seed hosts leg 2; the players exchange home/away for the return leg.
    insert.run(id(),tid,pair.b,pair.a,round*2-1,pair.b,pair.a,tieId,1,round);
    insert.run(id(),tid,pair.a,pair.b,round*2,pair.a,pair.b,tieId,2,round);
  });
}

export function createPlayoff(tid:string,user:Actor,input:unknown){
  const data=z.object({name:z.string().trim().min(1).max(100),playerIds:z.array(z.string()).min(2).max(128),target:z.number().int().min(1).max(127),directCount:z.number().int().min(0).max(126),eloMode:z.enum(['match','tie']),drawSeed:z.string().min(1).max(100),ratings:z.record(z.number().finite())}).parse(input);
  if(new Set(data.playerIds).size!==data.playerIds.length)fail('Choose each player once.');
  if(data.target>=data.playerIds.length)fail('Qualifying places must be fewer than the entrants.');
  if(data.directCount>=data.target)fail('Reserve at least one qualifying place for the playoffs.');
  return atomic(()=>{
    const t=unlocked(tid);
    if(one("SELECT id FROM playoffs WHERE tournament_id=? AND status='active'",tid))fail('Complete the current playoff before creating another in this tournament.',409);
    const rankings=communityRankings(t.owner_id),chosen=data.playerIds.map(playerId=>rankings.find(p=>p.id===playerId));
    if(chosen.some(p=>!p))fail('An entrant is not in your player directory.');
    const confirmed=chosen as NonNullable<typeof chosen[number]>[];
    if(confirmed.some(p=>data.ratings[p.id]!==p.rating))fail('Elo changed since the preview. Refresh the player list and review the new seeding.',409);
    const entrants=seedPlayers(confirmed,data.drawSeed),pid=id();
    const automatic=entrants.slice(0,data.directCount).map(p=>p.id);
    db().prepare('INSERT INTO playoffs(id,tournament_id,name,target,elo_mode,draw_seed,entrants,automatic_qualifiers,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(pid,tid,data.name,data.target,data.eloMode,data.drawSeed,JSON.stringify(entrants),JSON.stringify(automatic),now());
    insertRound(pid,tid,1,entrants.slice(data.directCount),data.target-data.directCount);
    db().prepare('UPDATE tournaments SET revision=revision+1 WHERE id=?').run(tid);
    audit(tid,user,'create-playoff',null,{id:pid,name:data.name,target:data.target,automaticQualifiers:automatic,eloMode:data.eloMode,drawSeed:data.drawSeed,entrants});
    return {id:pid};
  });
}

export function advancePlayoff(tid:string,pid:string,user:Actor,input:unknown){
  const data=z.object({version:z.number().int().min(0)}).parse(input);
  return atomic(()=>{
    unlocked(tid);const playoff=listPlayoffs(tid).find(p=>p.id===pid);
    if(!playoff)fail('Playoff not found.',404);
    if(playoff.status!=='active'||playoff.version!==data.version)fail('The playoff changed. Refresh before advancing.',409);
    const fs=fixtures(tid),outcomes=playoff.ties.filter(t=>t.round===playoff.round).map(t=>resolveTie(t,fs));
    if(!outcomes.length||outcomes.some(o=>!o.complete||!o.winner))fail('Finalize both legs of every tie before advancing.');
    const winners=outcomes.map(o=>o.winner!),remaining=playoff.entrants.filter(p=>winners.includes(p.id));
    const playoffTarget=playoff.target-playoff.automatic_qualifiers.length;
    if(remaining.length===playoffTarget){
      db().prepare("UPDATE playoffs SET status='complete',qualified=?,version=version+1 WHERE id=?").run(JSON.stringify([...playoff.automatic_qualifiers,...remaining.map(p=>p.id)]),pid);
    }else{
      insertRound(pid,tid,playoff.round+1,remaining,playoffTarget);
      db().prepare('UPDATE playoffs SET round=round+1,version=version+1 WHERE id=?').run(pid);
    }
    db().prepare('UPDATE tournaments SET revision=revision+1 WHERE id=?').run(tid);
    audit(tid,user,'advance-playoff',{id:pid,round:playoff.round},{winners,complete:remaining.length===playoffTarget});
    return {ok:true};
  });
}
