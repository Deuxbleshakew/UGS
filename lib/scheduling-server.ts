import {database} from '@/scripts/local-store.mjs';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {AccountAccessError} from './account-access';
import {configSchema,type Config} from './domain';
import {managerPlayer} from './competition-server';
import {zonedLocalToUtc,zoneMessages} from './timezone';

// Match scheduling. fixtures.scheduled is the single accepted kickoff (UTC ISO). A proposal never changes it
// until the assigned opponent accepts (and, beyond the owner deadline, the owner approves with a reason).
type Side='home'|'away';
type Actor={userId:string;displayName:string};
type Mem={role:string;manager_id:string|null;player_id:string|null};
type Fx={id:string;tournament_id:string;kind:string;stage:string;home:string;away:string;matchday:number;scheduled:string|null;status:string;version:number};
type Prop={id:string;tournament_id:string;fixture_id:string;kind:string;proposed_at:string;proposed_local:string;proposer_timezone:string;base_kickoff:string|null;proposer_account_id:string;proposer_name:string;proposer_side:Side;responder_side:Side;parent_id:string|null;message:string|null;status:string;beyond_deadline:number;decided_by:string|null;decided_reason:string|null;created_at:string;decided_at:string|null;version:number};
type Settings={booking_minutes:number|null;season_start:string|null;season_end:string|null;version:number};
const ACTIVE=['awaiting_opponent','awaiting_owner'],ACTIVE_SQL="('awaiting_opponent','awaiting_owner')";
function fail(m:string,s=400):never{throw new AccountAccessError(m,s);}
const nowIso=()=>new Date().toISOString(),uid=()=>crypto.randomUUID(),db=()=>database() as DatabaseSync;
function tx<T>(fn:(d:DatabaseSync)=>T):T{const d=db();d.exec('BEGIN IMMEDIATE');try{const r=fn(d);d.exec('COMMIT');return r;}catch(e){if(d.isTransaction)d.exec('ROLLBACK');throw e;}}
const iso=(s:string)=>new Date(s).toISOString();

export function getSettings(tid:string):Settings{
  return (db().prepare('SELECT booking_minutes,season_start,season_end,version FROM schedule_settings WHERE tournament_id=?').get(tid) as Settings|undefined)??{booking_minutes:null,season_start:null,season_end:null,version:0};
}
/** Window for a fixture: a per-fixture override first, otherwise its league matchweek. */
export function windowFor(d:DatabaseSync,f:Fx){
  const over=d.prepare('SELECT opens_at,deadline_at FROM schedule_windows WHERE fixture_id=?').get(f.id) as {opens_at:string|null;deadline_at:string|null}|undefined;
  if(over)return over;
  if(f.kind==='club'&&f.stage==='league')return (d.prepare('SELECT opens_at,deadline_at FROM schedule_windows WHERE tournament_id=? AND matchday=? AND fixture_id IS NULL').get(f.tournament_id,f.matchday) as {opens_at:string|null;deadline_at:string|null}|undefined)??{opens_at:null,deadline_at:null};
  return {opens_at:null,deadline_at:null};
}
/** Which side of the fixture is this member? Viewers and unrelated managers are null. */
export function sideOf(m:Mem,f:Pick<Fx,'kind'|'home'|'away'>,c:Config):Side|null{
  if(m.role!=='admin'&&m.role!=='manager')return null;
  const sides:Side[]=['home','away'],mine=f.kind==='player'?m.player_id:m.manager_id;if(!mine)return null;
  const who=(s:Side)=>f.kind==='player'?f[s]:c.clubs.find(x=>x.id===f[s])?.manager;
  const hits=sides.filter(s=>who(s)===mine);return hits.length===1?hits[0]:null;
}
/** The human identities in a fixture. A manager is merged with the player they are linked to, so clubs never decide a clash. */
function humans(f:Pick<Fx,'tournament_id'|'kind'|'home'|'away'>,c:Config){
  const keys=new Set<string>();
  for(const s of ['home','away'] as const){
    if(f.kind==='player'){keys.add('p:'+f[s]);continue;}
    const manager=c.clubs.find(x=>x.id===f[s])?.manager;if(!manager)continue;
    const player=managerPlayer(f.tournament_id,manager);keys.add(player?'p:'+player:'m:'+manager);
  }
  return keys;
}
/** Overlap: with a configured duration, two bookings overlap when each starts before the other ends. Without one, only identical start times are detected. */
export const overlaps=(a:number,b:number,minutes:number|null)=>minutes?a<b+minutes*6e4&&b<a+minutes*6e4:a===b;

function validateTime(d:DatabaseSync,f:Fx,c:Config,proposedAt:string,now=Date.now()){
  const at=new Date(proposedAt).getTime();
  if(!(at>now))fail('That kickoff is in the past. Choose a future time.');
  const s=getSettings(f.tournament_id);
  if(s.season_start&&proposedAt<s.season_start)fail('That kickoff is before the season starts.');
  if(s.season_end&&proposedAt>s.season_end)fail('That kickoff is after the season ends.');
  const mine=humans(f,c);
  const others=d.prepare("SELECT id,tournament_id,kind,home,away,scheduled FROM fixtures WHERE tournament_id=? AND id<>? AND scheduled IS NOT NULL").all(f.tournament_id,f.id) as Pick<Fx,'id'|'tournament_id'|'kind'|'home'|'away'|'scheduled'>[];
  for(const o of others){
    if(!overlaps(at,new Date(o.scheduled!).getTime(),s.booking_minutes))continue;
    if([...humans(o,c)].some(k=>mine.has(k)))fail('A manager in this match already has another match at an overlapping time. Choose a different time.',409);
  }
  const w=windowFor(d,f);return {beyond:!!w.deadline_at&&proposedAt>w.deadline_at};
}
function event(d:DatabaseSync,f:Pick<Fx,'id'|'tournament_id'>,p:Pick<Prop,'id'|'proposed_at'>|null,actor:{id:string|null;name:string},action:string,reason:string|null,before:string|null,after:string|null){
  d.prepare('INSERT INTO schedule_events(id,tournament_id,fixture_id,proposal_id,actor_id,actor_name,at,action,reason,kickoff_before,kickoff_after,proposed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(uid(),f.tournament_id,f.id,p?.id??null,actor.id,actor.name,nowIso(),action,reason,before,after,p?.proposed_at??null);
  d.prepare('INSERT INTO audit(id,tournament_id,fixture_id,actor_id,actor_name,at,action,reason,"before","after") VALUES(?,?,?,?,?,?,?,?,?,?)').run(uid(),f.tournament_id,f.id,actor.id??'system',actor.name,nowIso(),'schedule-'+action,reason??'',JSON.stringify({kickoff:before}),JSON.stringify({kickoff:after,proposedAt:p?.proposed_at??null}));
}
/** Active proposals whose time has passed can never be accepted; mark them expired (own transaction so a later failure cannot undo it). */
export function expireStale(tid:string){
  const stale=db().prepare(`SELECT p.*,f.scheduled FROM schedule_proposals p JOIN fixtures f ON f.id=p.fixture_id WHERE p.tournament_id=? AND p.status IN ${ACTIVE_SQL} AND p.proposed_at<=?`).all(tid,nowIso()) as (Prop&{scheduled:string|null})[];
  if(!stale.length)return;
  tx(d=>{for(const p of stale){
    const r=d.prepare(`UPDATE schedule_proposals SET status='expired',version=version+1,decided_at=? WHERE id=? AND status IN ${ACTIVE_SQL}`).run(nowIso(),p.id);
    if(r.changes===1)event(d,{id:p.fixture_id,tournament_id:tid},p,{id:null,name:'System'},'expired','The proposed time passed before the proposal was completed.',p.scheduled,p.scheduled);
  }});
}
function timezoneOf(actor:Actor){
  const row=db().prepare('SELECT data FROM account_profiles WHERE account_id=?').get(actor.userId) as {data:string}|undefined;
  const tz=row?String((JSON.parse(row.data) as {timezone?:string}).timezone??''):'';
  if(!tz)fail('Set your timezone in My Profile before proposing a kickoff.',409);return tz;
}
function toUtc(local:string,tz:string){const r=zonedLocalToUtc(local,tz);if(!r.ok)fail(zoneMessages[r.reason]);return (r as {utc:string}).utc;}

const local=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,'Enter a valid date and time.');
const note=z.string().trim().max(500).optional();
const reason=z.string().trim().min(3,'Give a reason (at least a few words).').max(1000);
const actionSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('propose'),fixtureVersion:z.number().int(),baseKickoff:z.string().nullable(),local,message:note}),
  z.object({action:z.literal('accept'),proposalId:z.string(),version:z.number().int()}),
  z.object({action:z.literal('decline'),proposalId:z.string(),version:z.number().int(),message:note}),
  z.object({action:z.literal('counter'),proposalId:z.string(),version:z.number().int(),local,message:note}),
  z.object({action:z.literal('withdraw'),proposalId:z.string(),version:z.number().int(),reason:z.string().trim().max(1000).optional()}),
  z.object({action:z.literal('approve'),proposalId:z.string(),version:z.number().int(),reason}),
  z.object({action:z.literal('reject'),proposalId:z.string(),version:z.number().int(),reason}),
]);

type Late={fail:string;status:number};
export function scheduleAction(t:{id:string;config:string;locked_at:string|null},m:Mem,actor:Actor,fixtureId:string,input:unknown){
  const data=actionSchema.parse(input),c=configSchema.parse(JSON.parse(t.config));
  expireStale(t.id);
  const out=tx((d):{ok:true}|Late=>{
    const f=d.prepare('SELECT id,tournament_id,kind,stage,home,away,matchday,scheduled,status,version FROM fixtures WHERE id=? AND tournament_id=?').get(fixtureId,t.id) as Fx|undefined;
    if(!f)return fail('Fixture not found.',404);
    if(d.prepare('SELECT 1 FROM tournaments WHERE id=? AND locked_at IS NOT NULL').get(t.id))fail('Awards are locked, so kickoffs cannot change.',409);
    if(f.status!=='scheduled')fail('Only a match awaiting its first report can be scheduled or rescheduled.',409);
    const me=sideOf(m,f,c),admin=m.role==='admin',who={id:actor.userId,name:actor.displayName};
    const load=(id:string)=>{const p=d.prepare('SELECT * FROM schedule_proposals WHERE id=? AND fixture_id=?').get(id,f.id) as Prop|undefined;if(!p)fail('Proposal not found.',404);return p as Prop;};
    const current=(p:Prop,statuses:string[])=>{
      if(p.version!==(data as {version:number}).version||!statuses.includes(p.status))fail('This proposal has already changed. Refresh to see the latest.',409);
    };
    const lateStale=(p:Prop):Late|null=>{
      if((f.scheduled??null)!==(p.base_kickoff??null)){
        d.prepare(`UPDATE schedule_proposals SET status='superseded',version=version+1,decided_at=? WHERE id=?`).run(nowIso(),p.id);
        event(d,f,p,{id:null,name:'System'},'superseded','The accepted kickoff changed after this was proposed.',f.scheduled,f.scheduled);
        return {fail:'The match kickoff changed after this was proposed, so the proposal was closed. Propose again.',status:409};
      }
      if(new Date(p.proposed_at).getTime()<=Date.now()){
        d.prepare(`UPDATE schedule_proposals SET status='expired',version=version+1,decided_at=? WHERE id=?`).run(nowIso(),p.id);
        event(d,f,p,{id:null,name:'System'},'expired','The proposed time passed before the proposal was completed.',f.scheduled,f.scheduled);
        return {fail:'That proposed time has passed, so the proposal expired.',status:409};
      }
      return null;
    };
    const accept=(p:Prop,decider:string|null,why:string|null,action:string)=>{
      const op=uid(),r=d.prepare("UPDATE fixtures SET scheduled=?,version=version+1,mutation=? WHERE id=? AND version=? AND status='scheduled'").run(p.proposed_at,op,f.id,f.version);
      if(r.changes!==1)fail('The match changed. Refresh before continuing.',409);
      d.prepare("UPDATE schedule_proposals SET status='accepted',version=version+1,decided_by=?,decided_reason=?,decided_at=? WHERE id=?").run(decider,why,nowIso(),p.id);
      d.prepare('UPDATE tournaments SET revision=revision+1 WHERE id=?').run(t.id);
      event(d,f,p,who,action,why,f.scheduled,p.proposed_at);
    };
    const insert=(kind:string,proposedAt:string,localTime:string,tz:string,side:Side,message:string|undefined,parent:string|null,beyond:boolean)=>{
      const p={id:uid(),proposed_at:proposedAt};
      d.prepare("INSERT INTO schedule_proposals(id,tournament_id,fixture_id,kind,proposed_at,proposed_local,proposer_timezone,base_kickoff,proposer_account_id,proposer_name,proposer_side,responder_side,parent_id,message,status,beyond_deadline,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'awaiting_opponent',?,?)")
        .run(p.id,t.id,f.id,kind,proposedAt,localTime,tz,f.scheduled,actor.userId,actor.displayName,side,side==='home'?'away':'home',parent,message||null,beyond?1:0,nowIso());
      event(d,f,p,who,kind==='counter'?'countered':'proposed',message||null,f.scheduled,proposedAt);
    };
    if(data.action==='propose'||data.action==='counter'){
      if(!me)fail('Only the two assigned participants can propose a kickoff.',403);
      const tz=timezoneOf(actor),at=toUtc(data.local,tz);
      if(data.action==='propose'){
        if(d.prepare(`SELECT 1 FROM schedule_proposals WHERE fixture_id=? AND status IN ${ACTIVE_SQL}`).get(f.id))fail('This match already has an active proposal. Respond to it or withdraw it first.',409);
        if(data.fixtureVersion!==f.version||(data.baseKickoff??null)!==(f.scheduled??null))fail('The match changed. Refresh before proposing.',409);
        if(at===f.scheduled)fail('That is already the accepted kickoff.');
        const v=validateTime(d,f,c,at);insert(f.scheduled?'reschedule':'initial',at,data.local,tz,me,data.message,null,v.beyond);return {ok:true};
      }
      const p=load(data.proposalId);current(p,['awaiting_opponent']);
      if(p.responder_side!==me)fail('Only the assigned opponent can counter-propose.',403);
      const late=lateStale(p);if(late)return late;
      if(at===f.scheduled||at===p.proposed_at)fail('Counter with a different time.');
      const v=validateTime(d,f,c,at);
      d.prepare("UPDATE schedule_proposals SET status='countered',version=version+1,decided_by=?,decided_at=? WHERE id=?").run(actor.userId,nowIso(),p.id);
      insert('counter',at,data.local,tz,me,data.message,p.id,v.beyond);return {ok:true};
    }
    const p=load(data.proposalId);
    if(data.action==='accept'||data.action==='decline'){
      current(p,['awaiting_opponent']);
      if(!me||p.responder_side!==me)fail('Only the assigned opponent can respond to this proposal.',403);
      if(data.action==='decline'){
        d.prepare("UPDATE schedule_proposals SET status='declined',version=version+1,decided_by=?,decided_reason=?,decided_at=? WHERE id=?").run(actor.userId,data.message||null,nowIso(),p.id);
        event(d,f,p,who,'declined',data.message||null,f.scheduled,f.scheduled);return {ok:true};
      }
      const late=lateStale(p);if(late)return late;
      const v=validateTime(d,f,c,p.proposed_at);
      if(v.beyond){
        d.prepare("UPDATE schedule_proposals SET status='awaiting_owner',beyond_deadline=1,version=version+1,decided_by=?,decided_at=? WHERE id=?").run(actor.userId,nowIso(),p.id);
        event(d,f,p,who,'opponent-agreed','Agreed. The time is beyond the deadline, so the owner must approve it.',f.scheduled,f.scheduled);
      }else{
        d.prepare('UPDATE schedule_proposals SET beyond_deadline=0 WHERE id=?').run(p.id);
        accept(p,actor.userId,null,'accepted');
      }
      return {ok:true};
    }
    if(data.action==='withdraw'){
      current(p,ACTIVE);
      const own=!!me&&me===p.proposer_side;
      if(!own&&!admin)fail('Only the proposer or the owner can withdraw this proposal.',403);
      if(!own&&!(data.reason&&data.reason.length>=3))fail('Give a reason for withdrawing someone else’s proposal.');
      d.prepare("UPDATE schedule_proposals SET status='withdrawn',version=version+1,decided_by=?,decided_reason=?,decided_at=? WHERE id=?").run(actor.userId,data.reason||null,nowIso(),p.id);
      event(d,f,p,who,'withdrawn',data.reason||null,f.scheduled,f.scheduled);return {ok:true};
    }
    // approve / reject: owner only, and only after the opponent has agreed.
    if(!admin)fail('Only the owner can decide beyond-deadline kickoffs.',403);
    if(!d.prepare("SELECT 1 FROM tournaments t JOIN accounts a ON a.id=t.owner_id WHERE t.id=? AND t.owner_id=? AND a.owner=1").get(t.id,actor.userId))fail('Only the owner can decide beyond-deadline kickoffs.',403);
    current(p,['awaiting_owner']);
    if(data.action==='reject'){
      d.prepare("UPDATE schedule_proposals SET status='rejected',version=version+1,decided_by=?,decided_reason=?,decided_at=? WHERE id=?").run(actor.userId,data.reason,nowIso(),p.id);
      event(d,f,p,who,'owner-rejected',data.reason,f.scheduled,f.scheduled);return {ok:true};
    }
    const late=lateStale(p);if(late)return late;
    validateTime(d,f,c,p.proposed_at);
    accept(p,actor.userId,data.reason,'owner-approved');return {ok:true};
  });
  if('fail' in out)fail(out.fail,out.status);
  return {ok:true};
}

const iso24=z.string().datetime().transform(iso);
export function scheduleAdmin(tid:string,actor:Actor,kind:string,input:unknown){
  const owner=()=>{if(!db().prepare('SELECT t.id FROM tournaments t JOIN accounts a ON a.id=t.owner_id WHERE t.id=? AND t.owner_id=? AND a.owner=1 AND t.locked_at IS NULL').get(tid,actor.userId))fail('Only the owner can change scheduling rules, and awards must be unlocked.',403);};
  const audit=(d:DatabaseSync,action:string,why:string,before:unknown,after:unknown)=>{d.prepare('INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after") VALUES(?,?,?,?,?,?,?,?,?)').run(uid(),tid,actor.userId,actor.displayName,nowIso(),action,why,JSON.stringify(before),JSON.stringify(after));d.prepare('UPDATE tournaments SET revision=revision+1 WHERE id=?').run(tid);};
  if(kind==='settings'){
    const s=z.object({version:z.number().int().min(0),bookingMinutes:z.number().int().min(1).max(1440).nullable(),seasonStart:iso24.nullable(),seasonEnd:iso24.nullable()}).parse(input);
    if(s.seasonStart&&s.seasonEnd&&s.seasonEnd<=s.seasonStart)fail('The season must end after it starts.');
    return tx(d=>{owner();
      const before=getSettings(tid);if(before.version!==s.version)fail('Scheduling settings changed. Refresh before saving.',409);
      if(before.version===0)d.prepare('INSERT INTO schedule_settings VALUES(?,?,?,?,1,?)').run(tid,s.bookingMinutes,s.seasonStart,s.seasonEnd,nowIso());
      else d.prepare('UPDATE schedule_settings SET booking_minutes=?,season_start=?,season_end=?,version=version+1,updated_at=? WHERE tournament_id=?').run(s.bookingMinutes,s.seasonStart,s.seasonEnd,nowIso(),tid);
      const after=getSettings(tid);audit(d,'schedule-settings','Owner updated scheduling settings.',before,after);return after;});
  }
  if(kind==='window'){
    const w=z.object({scope:z.enum(['week','fixture']),matchday:z.number().int().min(1).max(100).optional(),fixtureId:z.string().optional(),version:z.number().int().min(0),opensAt:iso24.nullable(),deadlineAt:iso24.nullable(),reason:z.string().trim().max(1000).optional()}).parse(input);
    if(w.opensAt&&w.deadlineAt&&w.deadlineAt<=w.opensAt)fail('The deadline must be after the window opens.');
    return tx(d=>{owner();
      let where:string,arg:string|number;
      if(w.scope==='week'){if(!w.matchday)fail('Choose a matchweek.');where='tournament_id=? AND matchday=? AND fixture_id IS NULL';arg=w.matchday!;}
      else{if(!w.fixtureId||!d.prepare('SELECT 1 FROM fixtures WHERE id=? AND tournament_id=?').get(w.fixtureId,tid))fail('Fixture not found.',404);where='fixture_id=?';arg=w.fixtureId!;}
      const sel=(sql:string)=>w.scope==='week'?d.prepare(sql).get(tid,arg):d.prepare(sql).get(arg);
      const before=sel(`SELECT * FROM schedule_windows WHERE ${where}`) as {id:string;version:number;opens_at:string|null;deadline_at:string|null}|undefined;
      if((before?.version??0)!==w.version)fail('This window changed. Refresh before saving.',409);
      if((before||w.scope==='fixture')&&!(w.reason&&w.reason.length>=3))fail('Changing a window or setting a fixture override needs a reason.');
      if(before)d.prepare('UPDATE schedule_windows SET opens_at=?,deadline_at=?,version=version+1,updated_at=? WHERE id=?').run(w.opensAt,w.deadlineAt,nowIso(),before.id);
      else d.prepare('INSERT INTO schedule_windows(id,tournament_id,matchday,fixture_id,opens_at,deadline_at,version,updated_at) VALUES(?,?,?,?,?,?,1,?)').run(uid(),tid,w.scope==='week'?w.matchday!:null,w.scope==='fixture'?w.fixtureId!:null,w.opensAt,w.deadlineAt,nowIso());
      audit(d,'schedule-window',w.reason||'Owner set the match window.',{scope:w.scope,matchday:w.matchday,fixtureId:w.fixtureId,opensAt:before?.opens_at??null,deadlineAt:before?.deadline_at??null},{opensAt:w.opensAt,deadlineAt:w.deadlineAt});
      return {ok:true};});
  }
  return fail('Endpoint not found.',404);
}

/** Everything the scheduling panel needs. Viewers see no proposals; managers see only their own fixtures; the owner sees all. */
export function getSchedule(t:{id:string;config:string},m:Mem){
  expireStale(t.id);const c=configSchema.parse(JSON.parse(t.config)),d=db();
  const fx=d.prepare('SELECT id,tournament_id,kind,stage,home,away,matchday,scheduled,status,version FROM fixtures WHERE tournament_id=?').all(t.id) as Fx[];
  const mine=new Set(fx.filter(f=>m.role==='admin'||sideOf(m,f,c)).map(f=>f.id));
  const proposals=(d.prepare('SELECT * FROM schedule_proposals WHERE tournament_id=? ORDER BY created_at').all(t.id) as Prop[]).filter(p=>mine.has(p.fixture_id));
  const events=(d.prepare('SELECT * FROM schedule_events WHERE tournament_id=? ORDER BY at,rowid').all(t.id) as {fixture_id:string}[]).filter(e=>mine.has(e.fixture_id));
  const windows=d.prepare('SELECT id,matchday,fixture_id,opens_at,deadline_at,version FROM schedule_windows WHERE tournament_id=?').all(t.id);
  const sides=Object.fromEntries(fx.map(f=>[f.id,sideOf(m,f,c)]));
  return {now:nowIso(),settings:getSettings(t.id),windows,proposals,events,sides};
}
