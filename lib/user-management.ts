import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {database} from '@/scripts/local-store.mjs';
import {AccountAccessError} from './account-access';
import {configSchema} from './domain';
import {deletePlayerRecord,PlayerDeletionBlocked} from './player-deletion';

// Owner-only user management. Disable and remove-member preserve match history;
// permanent account deletion is a separate, explicitly confirmed purge.
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
const deleteSchema=z.object({accountId:z.string().min(1),name:z.string().min(1),confirm:z.literal(true)});

function requireOwner(d:DatabaseSync,actor:Actor){
  if(!d.prepare('SELECT 1 FROM accounts WHERE id=? AND owner=1').get(actor.userId))fail('Only the owner can manage users.',403);
  if(d.prepare('SELECT 1 FROM account_status WHERE account_id=?').get(actor.userId))fail('Only the owner can manage users.',403);
}
function record(d:DatabaseSync,actor:Actor,target:string|null,username:string|null,action:string){
  d.prepare('INSERT INTO account_access_audit(id,actor_id,target_account_id,username,action,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),actor.userId,target,username??'',action,nowIso());
}
export function isDisabled(accountId:string){return !!db().prepare('SELECT 1 FROM account_status WHERE account_id=?').get(accountId);}


/** Close a person's open friendlies and withdraw their waiting kickoff proposals. Used when someone can no longer act (disabled, or no longer taking part). */
export function closeOpenActivity(d:DatabaseSync,accountId:string,actor:Actor,friendlyReason:string,proposalReason:string){
  const at=nowIso();
  const open=d.prepare("SELECT id,proposed_at FROM friendly_invitations WHERE (inviter_id=? OR invitee_id=?) AND (status='pending' OR (status='accepted' AND proposed_at>?))").all(accountId,accountId,at) as {id:string;proposed_at:string}[];
  for(const f of open){
    d.prepare("UPDATE friendly_invitations SET status='cancelled',turn_id=NULL,version=version+1,updated_at=? WHERE id=?").run(at,f.id);
    d.prepare('INSERT INTO friendly_events(id,invitation_id,actor_id,actor_name,at,action,reason,proposed_at) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),f.id,actor.userId,actor.displayName,at,'cancelled',friendlyReason,f.proposed_at);
  }
  const props=d.prepare("SELECT id,tournament_id,fixture_id,proposed_at FROM schedule_proposals WHERE proposer_account_id=? AND status IN ('awaiting_opponent','awaiting_owner')").all(accountId) as {id:string;tournament_id:string;fixture_id:string;proposed_at:string}[];
  for(const p of props){
    d.prepare("UPDATE schedule_proposals SET status='withdrawn',version=version+1,decided_by=?,decided_reason=?,decided_at=? WHERE id=?").run(actor.userId,proposalReason,at,p.id);
    d.prepare('INSERT INTO schedule_events(id,tournament_id,fixture_id,proposal_id,actor_id,actor_name,at,action,reason,proposed_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),p.tournament_id,p.fixture_id,p.id,actor.userId,actor.displayName,at,'withdrawn',proposalReason,p.proposed_at);
  }
  return {friendliesClosed:open.length,proposalsWithdrawn:props.length};
}

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
    const {friendliesClosed:fc,proposalsWithdrawn:pw}=closeOpenActivity(d,a.id,actor,'The organizer disabled an account involved in this friendly.','The organizer disabled the proposer’s account.');
    record(d,actor,a.id,a.username,'disable-account');
    return {ok:true,sessionsEnded:sessions,friendliesClosed:fc,proposalsWithdrawn:pw,discordUnlinked:!!link};
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

/** Permanently erase a non-owner account and all of its linked player and match records. */
export function deleteAccount(actor:Actor,input:unknown){
  const data=deleteSchema.parse(input);
  try{return tx(d=>{
    requireOwner(d,actor);
    if(data.accountId===actor.userId)fail('You cannot delete your own admin account.',409);
    const account=d.prepare('SELECT id,name,owner FROM accounts WHERE id=?').get(data.accountId) as {id:string;name:string;owner:number}|undefined;
    if(!account)fail('Account not found. Refresh the list.',404);
    if(account.owner)fail('The owner account cannot be deleted.',409);
    if(account.name!==data.name)fail('Account details changed. Refresh and confirm again.',409);
    if(d.prepare('SELECT 1 FROM tournaments WHERE owner_id=?').get(account.id))fail('Delete this account’s tournaments first.',409);

    const players=d.prepare(`SELECT DISTINCT p.id FROM community_players p WHERE p.id IN (
      SELECT player_id FROM account_usernames WHERE account_id=? AND player_id IS NOT NULL
      UNION SELECT player_id FROM members WHERE user_id=? AND player_id IS NOT NULL)`)
      .all(account.id,account.id) as {id:string}[];
    for(const player of players){
      if(d.prepare('SELECT 1 FROM account_usernames WHERE player_id=? AND account_id<>?').get(player.id,account.id)
        ||d.prepare('SELECT 1 FROM members WHERE player_id=? AND user_id IS NOT NULL AND user_id<>?').get(player.id,account.id))
        fail('This player profile is also linked to another login. Separate the accounts before deleting.',409);
    }

    // The invitation, its result and its append-only events belong to both players.
    // An account erasure removes these games, which also removes them from Elo.
    const invitations=d.prepare('SELECT id FROM friendly_invitations WHERE inviter_id=? OR invitee_id=?').all(account.id,account.id) as {id:string}[];
    for(const invitation of invitations)d.prepare('INSERT INTO account_deletion_context(invitation_id) VALUES(?)').run(invitation.id);
    const otherEventInvitations=d.prepare('SELECT DISTINCT invitation_id FROM friendly_events WHERE actor_id=?').all(account.id) as {invitation_id:string}[];
    for(const invitation of otherEventInvitations)d.prepare('INSERT OR IGNORE INTO account_deletion_context(invitation_id) VALUES(?)').run(invitation.invitation_id);
    try{
      for(const invitation of invitations){
        d.prepare('DELETE FROM friendly_events WHERE invitation_id=?').run(invitation.id);
        d.prepare('DELETE FROM friendly_organizer_proposals WHERE invitation_id=?').run(invitation.id);
        d.prepare('DELETE FROM friendly_invitations WHERE id=?').run(invitation.id);
      }
      d.prepare('DELETE FROM friendly_events WHERE actor_id=?').run(account.id);
    }finally{d.prepare('DELETE FROM account_deletion_context').run();}
    d.prepare('UPDATE friendly_organizer_proposals SET created_by=? WHERE created_by=?').run(actor.userId,account.id);

    const proposalTournaments=d.prepare('SELECT DISTINCT tournament_id FROM schedule_events WHERE actor_id=? UNION SELECT DISTINCT tournament_id FROM schedule_proposals WHERE proposer_account_id=?')
      .all(account.id,account.id) as {tournament_id:string}[];
    for(const row of proposalTournaments)d.prepare('INSERT OR IGNORE INTO tournament_deletion_context(tournament_id) VALUES(?)').run(row.tournament_id);
    try{
      d.prepare('DELETE FROM schedule_events WHERE actor_id=? OR proposal_id IN (SELECT id FROM schedule_proposals WHERE proposer_account_id=?)').run(account.id,account.id);
      d.prepare('DELETE FROM schedule_proposals WHERE proposer_account_id=?').run(account.id);
    }finally{for(const row of proposalTournaments)d.prepare('DELETE FROM tournament_deletion_context WHERE tournament_id=?').run(row.tournament_id);}
    d.prepare('UPDATE schedule_proposals SET decided_by=NULL WHERE decided_by=?').run(account.id);

    // Remove the person from memberships before deleting the profile. This keeps
    // every other member and their matches intact.
    d.prepare('DELETE FROM members WHERE user_id=? OR username IN (SELECT username FROM account_usernames WHERE account_id=?)').run(account.id,account.id);
    for(const player of players)deletePlayerRecord(d,actor.userId,player.id,true);

    d.prepare('DELETE FROM account_access_audit WHERE actor_id=? OR target_account_id=?').run(account.id,account.id);
    d.prepare('DELETE FROM discord_link_audit WHERE account_id=?').run(account.id);
    d.prepare('DELETE FROM account_status WHERE account_id=?').run(account.id);
    d.prepare('UPDATE account_status SET disabled_by=? WHERE disabled_by=?').run(actor.userId,account.id);
    d.prepare('DELETE FROM account_participation WHERE account_id=?').run(account.id);
    d.prepare('UPDATE account_participation SET decided_by=NULL WHERE decided_by=?').run(account.id);
    d.prepare('DELETE FROM password_reset_tokens WHERE account_id=?').run(account.id);
    d.prepare('DELETE FROM sessions WHERE account_id=?').run(account.id);
    d.prepare('DELETE FROM discord_oauth_states WHERE account_id=?').run(account.id);
    d.prepare('DELETE FROM discord_links WHERE account_id=?').run(account.id);
    d.prepare('DELETE FROM account_avatars WHERE account_id=?').run(account.id);
    d.prepare('DELETE FROM account_profiles WHERE account_id=?').run(account.id);
    d.prepare('DELETE FROM squads WHERE owner_id=?').run(account.id);
    d.prepare('UPDATE team_playoffs SET created_by=? WHERE created_by=?').run(actor.userId,account.id);
    d.prepare('UPDATE team_playoffs SET cancelled_by=? WHERE cancelled_by=?').run(actor.userId,account.id);
    d.prepare('UPDATE squad_access SET updated_by=? WHERE updated_by=?').run(actor.userId,account.id);
    d.prepare('UPDATE club_stars SET updated_by=? WHERE updated_by=?').run(actor.userId,account.id);
    d.prepare('UPDATE tiquicia_players SET created_by=? WHERE created_by=?').run(actor.userId,account.id);
    d.prepare('UPDATE join_links SET created_by=? WHERE created_by=?').run(actor.userId,account.id);
    d.prepare('DELETE FROM audit WHERE actor_id=?').run(account.id);
    d.prepare('DELETE FROM proofs WHERE uploader=?').run(account.id);
    d.prepare('UPDATE fixtures SET submitted_by=NULL WHERE submitted_by=?').run(account.id);
    d.prepare('DELETE FROM invitations WHERE username IN (SELECT username FROM account_usernames WHERE account_id=?)').run(account.id);
    d.prepare('DELETE FROM account_usernames WHERE account_id=?').run(account.id);
    d.prepare('DELETE FROM accounts WHERE id=?').run(account.id);
    const violations=d.prepare('PRAGMA foreign_key_check').all();
    if(violations.length)fail('Account deletion would leave broken references; no changes were saved.',409);
    record(d,actor,null,null,'delete-account');
    return {ok:true,playersDeleted:players.length,friendliesDeleted:invitations.length};
  });}catch(error){if(error instanceof PlayerDeletionBlocked)fail(error.message,409);throw error;}
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
