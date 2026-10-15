import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {database} from '@/scripts/local-store.mjs';
import {AccountAccessError} from './account-access';
import {configSchema} from './domain';

// Owner-only user management. Nothing here deletes results, Elo, fixtures or audit history.
// - Disabling an account blocks sign-in and removes the things that tie a live person to the site
//   (sessions, Discord link, profile picture, open friendlies). It is reversible.
// - Removing a member takes one person out of one tournament (their access to it). Fixtures and results stay.
type Actor={userId:string;displayName:string};
function fail(m:string,s=400):never{throw new AccountAccessError(m,s);}
const db=()=>database() as DatabaseSync,nowIso=()=>new Date().toISOString();
function tx<T>(fn:(d:DatabaseSync)=>T):T{const d=db();d.exec('BEGIN IMMEDIATE');try{const r=fn(d);d.exec('COMMIT');return r;}catch(e){if(d.isTransaction)d.exec('ROLLBACK');throw e;}}
const reason=z.string().trim().min(3,'Give a reason (at least 3 characters).').max(300);
const disableSchema=z.object({accountId:z.string().min(1),reason,confirm:z.literal(true,{errorMap:()=>({message:'Confirm the action first.'})})});
const enableSchema=z.object({accountId:z.string().min(1)});
const removeSchema=z.object({memberId:z.string().min(1),reason,confirm:z.literal(true,{errorMap:()=>({message:'Confirm the action first.'})})});

function requireOwner(d:DatabaseSync,actor:Actor){
  if(!d.prepare('SELECT 1 FROM accounts WHERE id=? AND owner=1').get(actor.userId))fail('Only the owner can manage users.',403);
  if(d.prepare('SELECT 1 FROM account_status WHERE account_id=?').get(actor.userId))fail('Only the owner can manage users.',403);
}
function record(d:DatabaseSync,actor:Actor,target:string|null,username:string|null,action:string){
  d.prepare('INSERT INTO account_access_audit(id,actor_id,target_account_id,username,action,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),actor.userId,target,username??'',action,nowIso());
}
export function isDisabled(accountId:string){return !!db().prepare('SELECT 1 FROM account_status WHERE account_id=?').get(accountId);}

export function disableAccount(actor:Actor,input:unknown){
  const data=disableSchema.parse(input);
  return tx(d=>{
    requireOwner(d,actor);
    if(data.accountId===actor.userId)fail('You cannot disable your own account.',409);
    const a=d.prepare('SELECT a.id,a.owner,a.name,u.username FROM accounts a LEFT JOIN account_usernames u ON u.account_id=a.id WHERE a.id=?').get(data.accountId) as {id:string;owner:number;name:string;username:string|null}|undefined;
    if(!a)fail('Account not found.',404);
    if(a.owner===1)fail('The owner account cannot be disabled.',409);
    if(d.prepare('SELECT 1 FROM account_status WHERE account_id=?').get(a.id))fail('This account is already disabled.',409);
    const at=nowIso();
    d.prepare('INSERT INTO account_status(account_id,disabled_at,reason,disabled_by) VALUES(?,?,?,?)').run(a.id,at,data.reason,actor.userId);
    const sessions=Number(d.prepare('DELETE FROM sessions WHERE account_id=?').run(a.id).changes);
    d.prepare('DELETE FROM discord_oauth_states WHERE account_id=?').run(a.id);
    const link=d.prepare('SELECT discord_user_id FROM discord_links WHERE account_id=?').get(a.id) as {discord_user_id:string}|undefined;
    if(link){
      d.prepare('DELETE FROM discord_links WHERE account_id=?').run(a.id);
      d.prepare("INSERT INTO discord_link_audit(id,account_id,discord_user_id,action,created_at) VALUES(?,?,?,'unlinked',?)").run(randomUUID(),a.id,link.discord_user_id,at);
    }
    d.prepare('DELETE FROM account_avatars WHERE account_id=?').run(a.id);
    // Close every open friendly, pending or accepted-but-future, so nobody waits on or turns up for someone who cannot answer.
    const open=d.prepare("SELECT id,proposed_at FROM friendly_invitations WHERE (inviter_id=? OR invitee_id=?) AND (status='pending' OR (status='accepted' AND proposed_at>?))").all(a.id,a.id,at) as {id:string;proposed_at:string}[];
    for(const f of open){
      d.prepare("UPDATE friendly_invitations SET status='cancelled',turn_id=NULL,version=version+1,updated_at=? WHERE id=?").run(at,f.id);
      d.prepare('INSERT INTO friendly_events(id,invitation_id,actor_id,actor_name,at,action,reason,proposed_at) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),f.id,actor.userId,actor.displayName,at,'cancelled','The organizer disabled an account involved in this friendly.',f.proposed_at);
    }
    // Withdraw scheduling proposals they made that are still waiting, so the opponent is not left hanging.
    const props=d.prepare("SELECT id,tournament_id,fixture_id,proposed_at FROM schedule_proposals WHERE proposer_account_id=? AND status IN ('awaiting_opponent','awaiting_owner')").all(a.id) as {id:string;tournament_id:string;fixture_id:string;proposed_at:string}[];
    for(const p of props){
      d.prepare("UPDATE schedule_proposals SET status='withdrawn',version=version+1,decided_by=?,decided_reason=?,decided_at=? WHERE id=?").run(actor.userId,'The organizer disabled the proposer’s account.',at,p.id);
      d.prepare('INSERT INTO schedule_events(id,tournament_id,fixture_id,proposal_id,actor_id,actor_name,at,action,reason,proposed_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),p.tournament_id,p.fixture_id,p.id,actor.userId,actor.displayName,at,'withdrawn','The organizer disabled the proposer’s account.',p.proposed_at);
    }
    record(d,actor,a.id,a.username,'disable-account');
    return {ok:true,sessionsEnded:sessions,friendliesClosed:open.length,proposalsWithdrawn:props.length,discordUnlinked:!!link};
  });
}
export function enableAccount(actor:Actor,input:unknown){
  const data=enableSchema.parse(input);
  return tx(d=>{
    requireOwner(d,actor);
    const a=d.prepare('SELECT a.id,u.username FROM accounts a LEFT JOIN account_usernames u ON u.account_id=a.id WHERE a.id=?').get(data.accountId) as {id:string;username:string|null}|undefined;
    if(!a)fail('Account not found.',404);
    if(!d.prepare('DELETE FROM account_status WHERE account_id=?').run(a.id).changes)fail('This account is not disabled.',409);
    record(d,actor,a.id,a.username,'enable-account');
    return {ok:true};
  });
}

/** Take one person out of one tournament. Fixtures, results and Elo are untouched; the old membership is snapshotted in the audit log. */
export function removeMember(tid:string,actor:Actor,input:unknown){
  const data=removeSchema.parse(input);
  return tx(d=>{
    requireOwner(d,actor);
    const t=d.prepare('SELECT id,owner_id,config FROM tournaments WHERE id=?').get(tid) as {id:string;owner_id:string;config:string}|undefined;
    if(!t||t.owner_id!==actor.userId)fail('Tournament not found.',404);
    const m=d.prepare('SELECT * FROM members WHERE id=? AND tournament_id=?').get(data.memberId,tid) as {id:string;user_id:string|null;name:string;role:string;manager_id:string|null;player_id:string|null;username:string|null;email:string}|undefined;
    if(!m)fail('That member is not in this tournament.',404);
    if(m.user_id===actor.userId||m.role==='admin'||m.user_id===t.owner_id)fail('The organizer cannot be removed from their own tournament.',409);
    const at=nowIso();
    // Count the matches that will be left without a signed-in participant, so the owner is told plainly.
    const c=configSchema.parse(JSON.parse(t.config));
    const open=(d.prepare("SELECT kind,home,away FROM fixtures WHERE tournament_id=? AND status<>'finalized'").all(tid) as {kind:string;home:string;away:string}[])
      .filter(f=>f.kind==='player'?!!m.player_id&&[f.home,f.away].includes(m.player_id):c.clubs.some(cl=>[f.home,f.away].includes(cl.id)&&!!m.manager_id&&cl.manager===m.manager_id)).length;
    if(m.user_id){
      const props=d.prepare("SELECT id,fixture_id,proposed_at FROM schedule_proposals WHERE tournament_id=? AND proposer_account_id=? AND status IN ('awaiting_opponent','awaiting_owner')").all(tid,m.user_id) as {id:string;fixture_id:string;proposed_at:string}[];
      for(const p of props){
        d.prepare("UPDATE schedule_proposals SET status='withdrawn',version=version+1,decided_by=?,decided_reason=?,decided_at=? WHERE id=?").run(actor.userId,'The organizer removed the proposer from this tournament.',at,p.id);
        d.prepare('INSERT INTO schedule_events(id,tournament_id,fixture_id,proposal_id,actor_id,actor_name,at,action,reason,proposed_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),tid,p.fixture_id,p.id,actor.userId,actor.displayName,at,'withdrawn','The organizer removed the proposer from this tournament.',p.proposed_at);
      }
    }
    if(m.username)d.prepare('DELETE FROM invitations WHERE username=? AND tournament_id=?').run(m.username,tid);
    else if(m.email)d.prepare('DELETE FROM invitations WHERE email=? AND tournament_id=? AND username IS NULL').run(m.email,tid);
    d.prepare('DELETE FROM members WHERE id=?').run(m.id);
    d.prepare('INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after") VALUES(?,?,?,?,?,?,?,?,?)')
      .run(randomUUID(),tid,actor.userId,actor.displayName,at,'remove-member',data.reason,JSON.stringify({id:m.id,name:m.name,role:m.role,username:m.username,managerId:m.manager_id,playerId:m.player_id,userId:m.user_id}),'null');
    record(d,actor,m.user_id,m.username,'remove-from-tournament');
    return {ok:true,name:m.name,openMatches:open};
  });
}
