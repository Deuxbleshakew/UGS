import {database} from '@/scripts/local-store.mjs';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {AccountAccessError} from './account-access';
import {configSchema} from './domain';
import {managerPlayer} from './competition-server';
import {missingProfile,profileSchema,type ProfileData} from './profile';
import {getSettings,overlaps,sideOf} from './scheduling-server';
import {avatarVersion} from './avatar-server';
import {isViewerByChoice} from './participation';
import {zonedLocalToUtc,zoneMessages} from './timezone';

// Friendly invitations. A friendly is not a fixture: it never touches Elo, standings, awards, proof or results.
// Only the two participants can see or act on an invitation. Eligible = a participant (or the owner) with a finished profile.
type Actor={userId:string;displayName:string};
type Inv={id:string;inviter_id:string;invitee_id:string;pair_key:string;status:string;proposed_at:string;proposed_local:string;proposer_timezone:string;proposed_by:string;turn_id:string|null;message:string|null;created_at:string;updated_at:string;version:number};
/** Safety limit on outgoing pending invitations per person (abuse protection, not a league rule). */
export const MAX_PENDING_OUT=10;
function fail(m:string,s=400):never{throw new AccountAccessError(m,s);}
const nowIso=()=>new Date().toISOString(),uid=()=>crypto.randomUUID(),db=()=>database() as DatabaseSync;
function tx<T>(fn:(d:DatabaseSync)=>T):T{const d=db();d.exec('BEGIN IMMEDIATE');try{const r=fn(d);d.exec('COMMIT');return r;}catch(e){if(d.isTransaction)d.exec('ROLLBACK');throw e;}}
const pairKey=(a:string,b:string)=>[a,b].sort().join('|');

type Eligibility={ok:boolean;name:string;timezone:string;reason?:string};
function profileOf(accountId:string){
  const d=db(),a=d.prepare('SELECT a.id,a.name,a.owner,u.username FROM accounts a LEFT JOIN account_usernames u ON u.account_id=a.id WHERE a.id=?').get(accountId) as {id:string;name:string;owner:number;username:string|null}|undefined;
  if(!a)return null;
  const row=d.prepare('SELECT data FROM account_profiles WHERE account_id=?').get(accountId) as {data:string}|undefined;
  const parsed=row?profileSchema.safeParse(JSON.parse(row.data)):null;
  const data:ProfileData=parsed?.success?parsed.data:{displayName:a.name,teams:[],primary:null,platforms:[],timezone:'',psnId:'',eaId:''};
  return {a,data};
}
export function eligibility(accountId:string):Eligibility{
  const p=profileOf(accountId);if(!p)return {ok:false,name:'',timezone:'',reason:'Account not found.'};
  const name=p.data.displayName||p.a.name,timezone=p.data.timezone;
  if(db().prepare('SELECT 1 FROM account_status WHERE account_id=?').get(accountId))return {ok:false,name,timezone,reason:'This account is disabled.'};
  const participant=!!db().prepare("SELECT 1 FROM members WHERE user_id=? AND role IN ('manager','participant') LIMIT 1").get(accountId);
  if(p.a.owner!==1&&isViewerByChoice(accountId))return {ok:false,name,timezone,reason:'You chose to follow as a viewer. You can change that in My Profile; the organizer approves it.'};
  if(!participant&&p.a.owner!==1)return {ok:false,name,timezone,reason:'Friendlies are open to participants. Viewers cannot take part yet.'};
  if(p.a.owner!==1&&missingProfile(p.data,p.a.username,true).length)return {ok:false,name,timezone,reason:'Finish your profile first.'};
  return {ok:true,name,timezone};
}
/** Overlap check for one person: their accepted friendlies and their competitive fixtures (matched by the human, not the club). */
function busy(d:DatabaseSync,accountId:string,at:number,ignore:string|null,friendlyMinutes:number|null){
  for(const f of d.prepare("SELECT id,proposed_at FROM friendly_invitations WHERE status='accepted' AND (inviter_id=? OR invitee_id=?) AND id<>?").all(accountId,accountId,ignore??'') as {id:string;proposed_at:string}[])
    if(overlaps(at,new Date(f.proposed_at).getTime(),friendlyMinutes))return true;
  const ms=d.prepare("SELECT m.tournament_id,m.manager_id,m.player_id,t.config FROM members m JOIN tournaments t ON t.id=m.tournament_id WHERE m.user_id=? AND (m.manager_id IS NOT NULL OR m.player_id IS NOT NULL)").all(accountId) as {tournament_id:string;manager_id:string|null;player_id:string|null;config:string}[];
  for(const m of ms){
    const c=configSchema.parse(JSON.parse(m.config)),minutes=getSettings(m.tournament_id).booking_minutes;
    const player=m.player_id??managerPlayer(m.tournament_id,m.manager_id??undefined);
    const who={role:'manager',manager_id:m.manager_id,player_id:player};
    for(const f of d.prepare('SELECT id,kind,home,away,scheduled FROM fixtures WHERE tournament_id=? AND scheduled IS NOT NULL').all(m.tournament_id) as {id:string;kind:string;home:string;away:string;scheduled:string}[])
      if(sideOf(who,f,c)&&overlaps(at,new Date(f.scheduled).getTime(),minutes))return true;
  }
  return false;
}
function friendlyMinutes(d:DatabaseSync,a:string,b:string){
  const r=d.prepare("SELECT MAX(s.booking_minutes) AS m FROM schedule_settings s JOIN members x ON x.tournament_id=s.tournament_id WHERE x.user_id IN (?,?)").get(a,b) as {m:number|null};
  return r.m??null;
}
function checkTime(d:DatabaseSync,a:string,b:string,proposedAt:string,ignore:string|null){
  const at=new Date(proposedAt).getTime();
  if(!(at>Date.now()))fail('That time is in the past. Choose a future time.');
  const m=friendlyMinutes(d,a,b);
  if(busy(d,a,at,ignore,m)||busy(d,b,at,ignore,m))fail('You or the other player already have a match or friendly at an overlapping time. Choose a different time.',409);
}
function event(d:DatabaseSync,id:string,actor:{id:string|null;name:string},action:string,reason:string|null,proposedAt:string|null){
  d.prepare('INSERT INTO friendly_events(id,invitation_id,actor_id,actor_name,at,action,reason,proposed_at) VALUES(?,?,?,?,?,?,?,?)').run(uid(),id,actor.id,actor.name,nowIso(),action,reason,proposedAt);
}
/** A pending invitation whose time has passed can never be accepted; mark it expired (own transaction). */
export function expireStale(){
  const stale=db().prepare("SELECT id,proposed_at FROM friendly_invitations WHERE status='pending' AND proposed_at<=?").all(nowIso()) as {id:string;proposed_at:string}[];
  if(!stale.length)return;
  tx(d=>{for(const i of stale){
    const r=d.prepare("UPDATE friendly_invitations SET status='expired',turn_id=NULL,version=version+1,updated_at=? WHERE id=? AND status='pending'").run(nowIso(),i.id);
    if(r.changes===1)event(d,i.id,{id:null,name:'System'},'expired','The proposed time passed before it was accepted.',i.proposed_at);
  }});
}
function toUtc(local:string,tz:string){
  if(!tz)fail('Set your timezone in My Profile before arranging a friendly.',409);
  const r=zonedLocalToUtc(local,tz);if(!r.ok)fail(zoneMessages[r.reason]);return (r as {utc:string}).utc;
}
const local=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,'Enter a valid date and time.');
const note=z.string().trim().max(500).optional();
const actionSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('invite'),inviteeId:z.string().min(1).max(100),local,message:note}),
  z.object({action:z.literal('accept'),id:z.string(),version:z.number().int()}),
  z.object({action:z.literal('decline'),id:z.string(),version:z.number().int(),message:note}),
  z.object({action:z.literal('counter'),id:z.string(),version:z.number().int(),local,message:note}),
  z.object({action:z.literal('cancel'),id:z.string(),version:z.number().int(),message:note}),
]);
type Late={fail:string;status:number};
export function friendlyAction(actor:Actor,input:unknown){
  const data=actionSchema.parse(input);expireStale();
  const out=tx((d):{ok:true;id?:string}|Late=>{
    const me=eligibility(actor.userId);
    if(!me.ok)fail(me.reason??'You cannot arrange friendlies yet.',403);
    const who={id:actor.userId,name:me.name||actor.displayName};
    if(data.action==='invite'){
      if(data.inviteeId===actor.userId)fail('You cannot invite yourself.');
      const them=eligibility(data.inviteeId);
      if(!them.ok)fail('That player is not available for friendlies.',404);
      const at=toUtc(data.local,me.timezone);
      if(d.prepare("SELECT 1 FROM friendly_invitations WHERE pair_key=? AND status='pending'").get(pairKey(actor.userId,data.inviteeId)))fail('There is already a pending friendly request between you two. Answer or cancel it first.',409);
      if((d.prepare("SELECT COUNT(*) AS n FROM friendly_invitations WHERE inviter_id=? AND status='pending'").get(actor.userId) as {n:number}).n>=MAX_PENDING_OUT)fail(`You already have ${MAX_PENDING_OUT} pending invitations. Wait for answers or cancel some.`,429);
      checkTime(d,actor.userId,data.inviteeId,at,null);
      const id=uid(),t=nowIso();
      d.prepare("INSERT INTO friendly_invitations(id,inviter_id,invitee_id,pair_key,status,proposed_at,proposed_local,proposer_timezone,proposed_by,turn_id,message,created_at,updated_at) VALUES(?,?,?,?,'pending',?,?,?,?,?,?,?,?)").run(id,actor.userId,data.inviteeId,pairKey(actor.userId,data.inviteeId),at,data.local,me.timezone,actor.userId,data.inviteeId,data.message||null,t,t);
      event(d,id,who,'invited',data.message||null,at);return {ok:true,id};
    }
    const inv=d.prepare('SELECT * FROM friendly_invitations WHERE id=?').get(data.id) as Inv|undefined;
    if(!inv||(inv.inviter_id!==actor.userId&&inv.invitee_id!==actor.userId))return fail('Invitation not found.',404);
    if(inv.version!==data.version)fail('This invitation has already changed. Refresh to see the latest.',409);
    const other=inv.inviter_id===actor.userId?inv.invitee_id:inv.inviter_id;
    const close=(status:string,action:string,why:string|null)=>{
      d.prepare('UPDATE friendly_invitations SET status=?,turn_id=NULL,version=version+1,updated_at=? WHERE id=?').run(status,nowIso(),inv.id);
      event(d,inv.id,who,action,why,inv.proposed_at);
    };
    if(data.action==='cancel'){
      if(inv.status==='pending'){close('cancelled','cancelled',data.message||null);return {ok:true};}
      if(inv.status!=='accepted')fail('This invitation is already closed.',409);
      if(new Date(inv.proposed_at).getTime()<=Date.now())fail('That friendly has already started, so it cannot be cancelled.',409);
      close('cancelled','cancelled',data.message||null);return {ok:true};
    }
    if(inv.status!=='pending')fail('This invitation is already closed.',409);
    if(inv.turn_id!==actor.userId)fail('Waiting for the other player to answer.',403);
    if(data.action==='decline'){close('declined','declined',data.message||null);return {ok:true};}
    if(data.action==='accept'){
      if(new Date(inv.proposed_at).getTime()<=Date.now()){
        d.prepare("UPDATE friendly_invitations SET status='expired',turn_id=NULL,version=version+1,updated_at=? WHERE id=?").run(nowIso(),inv.id);
        event(d,inv.id,{id:null,name:'System'},'expired','The proposed time passed before it was accepted.',inv.proposed_at);
        return {fail:'That time has passed, so the invitation expired.',status:409};
      }
      checkTime(d,actor.userId,other,inv.proposed_at,inv.id);
      d.prepare("UPDATE friendly_invitations SET status='accepted',turn_id=NULL,version=version+1,updated_at=? WHERE id=?").run(nowIso(),inv.id);
      event(d,inv.id,who,'accepted',null,inv.proposed_at);return {ok:true};
    }
    // counter
    const at=toUtc(data.local,me.timezone);
    if(at===inv.proposed_at)fail('Counter with a different time.');
    checkTime(d,actor.userId,other,at,inv.id);
    d.prepare("UPDATE friendly_invitations SET proposed_at=?,proposed_local=?,proposer_timezone=?,proposed_by=?,turn_id=?,message=?,version=version+1,updated_at=? WHERE id=?").run(at,data.local,me.timezone,actor.userId,other,data.message||null,nowIso(),inv.id);
    event(d,inv.id,who,'countered',data.message||null,at);return {ok:true};
  });
  if('fail' in out)fail(out.fail,out.status);
  return out;
}
/** Everything the Friendlies page needs: the caller's own invitations, their history, and the people they can invite. */
export function getFriendlies(actor:Actor){
  expireStale();const d=db(),me=eligibility(actor.userId);
  const rows=d.prepare('SELECT * FROM friendly_invitations WHERE inviter_id=? OR invitee_id=? ORDER BY created_at DESC').all(actor.userId,actor.userId) as Inv[];
  const name=(id:string)=>eligibility(id).name||'Player';
  const invitations=rows.map(i=>{const other=i.inviter_id===actor.userId?i.invitee_id:i.inviter_id;return {id:i.id,status:i.status,proposedAt:i.proposed_at,proposedLocal:i.proposed_local,proposerTimezone:i.proposer_timezone,message:i.message,version:i.version,createdAt:i.created_at,updatedAt:i.updated_at,direction:i.inviter_id===actor.userId?'sent':'received',myTurn:i.turn_id===actor.userId,proposedByMe:i.proposed_by===actor.userId,otherName:name(other),otherId:other,otherAvatar:avatarVersion(other)};});
  const ids=rows.map(r=>r.id),marks=ids.map(()=>'?').join(',');
  const events=ids.length?d.prepare(`SELECT id,invitation_id AS invitationId,actor_name AS actorName,at,action,reason,proposed_at AS proposedAt FROM friendly_events WHERE invitation_id IN (${marks}) ORDER BY at,rowid`).all(...ids):[];
  const directory=me.ok?(d.prepare('SELECT id FROM accounts WHERE id<>?').all(actor.userId) as {id:string}[]).map(a=>({id:a.id,e:eligibility(a.id)})).filter(x=>x.e.ok&&x.e.name).map(x=>({id:x.id,name:x.e.name})).sort((a,b)=>a.name.localeCompare(b.name)):[];
  return {now:nowIso(),me:{eligible:me.ok,reason:me.reason??null,timezone:me.timezone,maxPending:MAX_PENDING_OUT},invitations,events,directory};
}
