import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {database} from '@/scripts/local-store.mjs';
import {AccountAccessError} from './account-access';
import {closeOpenActivity} from './user-management';

// "Do you want to take part in the tournament?" asked at first sign-in.
//  No row            -> never asked; the account behaves exactly as before.
//  wants=0           -> a viewer: read-only, no profile form, no friendlies, no match actions.
//  wants=1 'active'  -> takes part (the owner still decides what a person can play in).
//  wants=1 'pending' -> asked to switch from viewer to taking part; stays a viewer until the owner approves.
// Nothing here changes a saved membership: the role is simply capped at viewer while the choice says so.
export type Participation='unanswered'|'yes'|'no'|'pending';
type Actor={userId:string;displayName:string};
type Row={wants:number;status:'active'|'pending'};
function fail(m:string,s=400):never{throw new AccountAccessError(m,s);}
const db=()=>database() as DatabaseSync,nowIso=()=>new Date().toISOString();
function tx<T>(fn:(d:DatabaseSync)=>T):T{const d=db();d.exec('BEGIN IMMEDIATE');try{const r=fn(d);d.exec('COMMIT');return r;}catch(e){if(d.isTransaction)d.exec('ROLLBACK');throw e;}}
function row(accountId:string){return db().prepare('SELECT wants,status FROM account_participation WHERE account_id=?').get(accountId) as Row|undefined;}
export function participationOf(accountId:string):Participation{
  const r=row(accountId);if(!r)return 'unanswered';
  return r.wants===0?'no':r.status==='pending'?'pending':'yes';
}
/** True when the person's own choice makes them a viewer (said no, or is waiting for approval to switch). */
export function isViewerByChoice(accountId:string){const p=participationOf(accountId);return p==='no'||p==='pending';}
function record(d:DatabaseSync,actor:string,target:string,action:string){
  const u=d.prepare('SELECT username FROM account_usernames WHERE account_id=?').get(target) as {username:string}|undefined;
  d.prepare('INSERT INTO account_access_audit(id,actor_id,target_account_id,username,action,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),actor,target,u?.username??'',action,nowIso());
}
const answerSchema=z.object({answer:z.enum(['yes','no'])});
export function answerParticipation(user:Actor,input:unknown){
  const {answer}=answerSchema.parse(input);
  return tx(d=>{
    const a=d.prepare('SELECT owner FROM accounts WHERE id=?').get(user.userId) as {owner:number}|undefined;
    if(!a)fail('Account not found.',404);
    if(a.owner===1)fail('The owner always takes part.',409);
    if(d.prepare('SELECT 1 FROM account_status WHERE account_id=?').get(user.userId))fail('This account is disabled.',403);
    const at=nowIso(),cur=d.prepare('SELECT wants,status FROM account_participation WHERE account_id=?').get(user.userId) as Row|undefined;
    if(!cur){
      d.prepare('INSERT INTO account_participation(account_id,wants,status,answered_at) VALUES(?,?,?,?)').run(user.userId,answer==='yes'?1:0,'active',at);
      if(answer==='no')closeOpenActivity(d,user.userId,user,'This person is no longer taking part in the tournament.','The proposer is no longer taking part in the tournament.');
      record(d,user.userId,user.userId,answer==='yes'?'participation-yes':'participation-no');
      return {participation:(answer==='yes'?'yes':'no') as Participation};
    }
    if(answer==='no'){
      if(cur.wants===0)return {participation:'no' as Participation};
      d.prepare("UPDATE account_participation SET wants=0,status='active',answered_at=?,decided_by=NULL,decided_at=NULL WHERE account_id=?").run(at,user.userId);
      // Someone who stops taking part should not leave other people waiting on them.
      closeOpenActivity(d,user.userId,user,'This person is no longer taking part in the tournament.','The proposer is no longer taking part in the tournament.');
      record(d,user.userId,user.userId,cur.status==='pending'?'participation-request-cancelled':'participation-no');
      return {participation:'no' as Participation};
    }
    if(cur.wants===1)return {participation:(cur.status==='pending'?'pending':'yes') as Participation};
    d.prepare("UPDATE account_participation SET wants=1,status='pending',answered_at=?,decided_by=NULL,decided_at=NULL WHERE account_id=?").run(at,user.userId);
    record(d,user.userId,user.userId,'participation-request');
    return {participation:'pending' as Participation};
  });
}
const decideSchema=z.object({accountId:z.string().min(1),decision:z.enum(['approve','reject'])});
export function decideParticipation(actor:Actor,input:unknown){
  const data=decideSchema.parse(input);
  return tx(d=>{
    if(!d.prepare('SELECT 1 FROM accounts WHERE id=? AND owner=1').get(actor.userId)||d.prepare('SELECT 1 FROM account_status WHERE account_id=?').get(actor.userId))fail('Only the owner can decide this.',403);
    const cur=d.prepare('SELECT wants,status FROM account_participation WHERE account_id=?').get(data.accountId) as Row|undefined;
    if(!cur||cur.status!=='pending')fail('There is no waiting request for this account.',409);
    const at=nowIso();
    if(data.decision==='approve')d.prepare("UPDATE account_participation SET status='active',decided_by=?,decided_at=? WHERE account_id=?").run(actor.userId,at,data.accountId);
    else d.prepare("UPDATE account_participation SET wants=0,status='active',decided_by=?,decided_at=? WHERE account_id=?").run(actor.userId,at,data.accountId);
    record(d,actor.userId,data.accountId,data.decision==='approve'?'participation-approved':'participation-rejected');
    return {ok:true};
  });
}
/** Called inside the owner's "grant player access" transaction: giving someone a player slot is the owner's explicit approval. */
export function approveByGrant(d:DatabaseSync,ownerId:string,accountId:string){
  const cur=d.prepare('SELECT wants,status FROM account_participation WHERE account_id=?').get(accountId) as Row|undefined;
  if(!cur||(cur.wants===1&&cur.status==='active'))return;
  d.prepare("UPDATE account_participation SET wants=1,status='active',decided_by=?,decided_at=? WHERE account_id=?").run(ownerId,nowIso(),accountId);
  record(d,ownerId,accountId,'participation-approved-by-grant');
}
