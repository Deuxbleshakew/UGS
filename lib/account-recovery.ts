import {randomBytes,randomUUID,createHash} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';

export class AccountRecoveryError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
const fail=(message:string,status=400):never=>{throw new AccountRecoveryError(message,status);};
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const validUsername=(value:string)=>/^[a-z0-9_]{3,24}$/.test(value);

function atomic<T>(db:DatabaseSync,work:()=>T):T{
  db.exec('BEGIN IMMEDIATE');
  try{const result=work();db.exec('COMMIT');return result;}
  catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
}
function requireOwner(db:DatabaseSync,actorId:string){
  if(!db.prepare('SELECT 1 FROM accounts WHERE id=? AND owner=1').get(actorId))fail('Only the site owner can manage account recovery.',403);
}

/** Rename an existing login, retaining its account ID, sessions and player history. */
export function renameAccountUsername(db:DatabaseSync,actorId:string,accountId:string,value:string){
  const username=value.trim().toLowerCase();
  if(!validUsername(username))fail('Use 3–24 letters, numbers or underscores.');
  return atomic(db,()=>{
    requireOwner(db,actorId);
    const current=db.prepare('SELECT username FROM account_usernames WHERE account_id=?').get(accountId) as {username:string}|undefined;
    if(!current)return fail('This account has no username. Assign one first.',404);
    if(current.username===username)return {username};
    if(db.prepare('SELECT 1 FROM account_usernames WHERE username=?').get(username))fail('That username is already taken.',409);
    // members and invitations have foreign keys to the username. Defer their
    // validation until all references have been renamed in this transaction.
    db.exec('PRAGMA defer_foreign_keys=ON');
    db.prepare('UPDATE account_usernames SET username=? WHERE account_id=?').run(username,accountId);
    db.prepare('UPDATE members SET username=? WHERE username=?').run(username,current.username);
    db.prepare('UPDATE invitations SET username=? WHERE username=?').run(username,current.username);
    db.prepare('INSERT INTO account_access_audit(id,actor_id,target_account_id,username,action,created_at) VALUES(?,?,?,?,?,?)')
      .run(randomUUID(),actorId,accountId,username,`rename-username:${current.username}`,new Date().toISOString());
    return {username};
  });
}

/** The raw token is returned once to the owner; only its digest is stored. */
export function issuePasswordReset(db:DatabaseSync,actorId:string,accountId:string){
  return atomic(db,()=>{
    requireOwner(db,actorId);
    const account=db.prepare('SELECT a.owner,u.username FROM accounts a LEFT JOIN account_usernames u ON u.account_id=a.id WHERE a.id=?').get(accountId) as {owner:number;username:string|null}|undefined;
    if(!account)return fail('Account not found.',404);
    if(!account.username)fail('Assign this account a username first.',409);
    if(db.prepare('SELECT 1 FROM account_status WHERE account_id=?').get(accountId))fail('Re-enable this account before resetting its password.',409);
    const token=randomBytes(32).toString('hex'),expiresAt=Date.now()+60*60*1000;
    db.prepare('DELETE FROM password_reset_tokens WHERE account_id=? OR expires_at<=?').run(accountId,Date.now());
    db.prepare('INSERT INTO password_reset_tokens(token_hash,account_id,expires_at,created_at) VALUES(?,?,?,?)')
      .run(digest(token),accountId,expiresAt,new Date().toISOString());
    db.prepare('INSERT INTO account_access_audit(id,actor_id,target_account_id,username,action,created_at) VALUES(?,?,?,?,?,?)')
      .run(randomUUID(),actorId,accountId,account.username,'issue-password-reset',new Date().toISOString());
    return {token,username:account.username,expiresAt};
  });
}

/** Consume once, replace the hash, and end every existing session. */
export function completePasswordReset(db:DatabaseSync,token:string,passwordHash:string){
  if(!/^[a-f0-9]{64}$/.test(token))fail('This reset link is invalid or expired.',400);
  return atomic(db,()=>{
    const tokenHash=digest(token);
    const row=db.prepare(`SELECT r.account_id,u.username FROM password_reset_tokens r
      LEFT JOIN account_usernames u ON u.account_id=r.account_id
      WHERE r.token_hash=? AND r.expires_at>? AND NOT EXISTS(SELECT 1 FROM account_status s WHERE s.account_id=r.account_id)`)
      .get(tokenHash,Date.now()) as {account_id:string;username:string|null}|undefined;
    if(!row)return fail('This reset link is invalid or expired. Ask the organizer for a new one.',400);
    db.prepare('UPDATE accounts SET password_hash=? WHERE id=?').run(passwordHash,row.account_id);
    db.prepare('DELETE FROM sessions WHERE account_id=?').run(row.account_id);
    db.prepare('DELETE FROM password_reset_tokens WHERE account_id=?').run(row.account_id);
    db.prepare('INSERT INTO account_access_audit(id,actor_id,target_account_id,username,action,created_at) VALUES(?,?,?,?,?,?)')
      .run(randomUUID(),row.account_id,row.account_id,row.username??'','complete-password-reset',new Date().toISOString());
    return {ok:true};
  });
}
