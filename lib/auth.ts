import { cookies } from 'next/headers';
import { randomBytes,randomUUID } from 'node:crypto';
import { database } from '@/scripts/local-store.mjs';
import { digest,hashPassword,verifyPassword } from '@/scripts/account-crypto.mjs';
import { z } from 'zod';
import {usernameSchema} from './account-access';

export type CurrentUser={userId:string;displayName:string;email:string;username:string|null;isOwner:boolean};
type Account={id:string;email:string;name:string;password_hash:string;owner:number;username:string|null};
const cookieName='matchroom_session',life=7*24*60*60;
export async function getCurrentUser():Promise<CurrentUser|null>{
  const token=(await cookies()).get(cookieName)?.value;
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const row=database().prepare('SELECT a.*,u.username FROM accounts a JOIN sessions s ON s.account_id=a.id LEFT JOIN account_usernames u ON u.account_id=a.id WHERE s.token_hash=? AND s.expires_at>?').get(digest(token),Date.now()) as Account|undefined;
  return row?{userId:row.id,displayName:row.name,email:row.email,username:row.username,isOwner:row.owner===1}:null;
}
export function sameOrigin(request:Request){
  const origin=request.headers.get('origin');
  const expected=new URL(process.env.APP_ORIGIN||request.url).origin;
  return origin===expected;
}
function reply(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export async function issueSession(accountId:string){
  const jar=await cookies(),old=jar.get(cookieName)?.value,db=database();
  const token=randomBytes(32).toString('hex');
  if(old)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(old));
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
  db.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)').run(digest(token),accountId,Date.now()+life*1000);
  jar.set(cookieName,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:life});
}
function allowAttempt(identifier:string){
  const db=database(),now=Date.now();
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare('DELETE FROM auth_limits WHERE expires_at<=?').run(now);
    const increment=db.prepare('INSERT INTO auth_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count');
    const global=increment.get('global',now+5*60*1000) as {count:number};
    const personal=increment.get(digest(identifier),now+15*60*1000) as {count:number};
    db.exec('COMMIT');return global.count<=120&&personal.count<=12;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
async function input(request:Request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('Use JSON.');
  const reader=request.body?.getReader();let length=0;const chunks:Uint8Array[]=[];
  if(!reader)throw new Error('Missing request.');
  for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>4096){await reader.cancel();throw new Error('Request too large.');}chunks.push(part.value);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function authentication(request:Request,action:string){
  if(!sameOrigin(request))return reply({error:'Reload the page and try again.'},403);
  if(action==='logout'){
    const jar=await cookies(),token=jar.get(cookieName)?.value;
    if(token)database().prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
    jar.set(cookieName,'',{path:'/',httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:0});
    return reply({ok:true});
  }
  let data;try{data=await input(request);}catch{return reply({error:'Invalid sign-in request.'},400);}
  if(action==='login'){
    const parsed=z.object({identifier:z.string().trim().min(1).max(254).optional(),email:z.string().trim().min(1).max(254).optional(),password:z.string().min(1).max(200)}).safeParse(data);
    if(!parsed.success||!(parsed.data.identifier||parsed.data.email))return reply({error:'Enter your username and password.'},400);
    const identifier=(parsed.data.identifier||parsed.data.email!).toLowerCase();
    if(!allowAttempt(identifier))return reply({error:'Too many attempts. Please wait 15 minutes.'},429);
    const legacy=identifier.includes('@'),db=database();
    const account=(legacy
      ? db.prepare('SELECT a.*,u.username FROM accounts a LEFT JOIN account_usernames u ON u.account_id=a.id WHERE a.email=? AND a.email<>\'\' AND u.username IS NULL').get(identifier)
      : usernameSchema.safeParse(identifier).success
        ? db.prepare('SELECT a.*,u.username FROM accounts a JOIN account_usernames u ON u.account_id=a.id WHERE u.username=?').get(identifier)
        : undefined) as Account|undefined;
    if(!await verifyPassword(parsed.data.password,account?.password_hash)||!account)return reply({error:'Username or password is incorrect. Email works only until a username is assigned.'},401);
    // An assignment during password verification must not revive legacy email login.
    if(legacy&&db.prepare('SELECT username FROM account_usernames WHERE account_id=?').get(account.id))return reply({error:'Use the username assigned by your organizer with your existing password.'},401);
    await issueSession(account.id);return reply({ok:true});
  }
  if(action==='activate'){
    const parsed=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(12).max(200)}).safeParse(data);
    if(!parsed.success)return reply({error:'Use a valid invitation and a password of 12–200 characters.'},400);
    const hash=digest(parsed.data.token);
    if(!allowAttempt('activation:'+hash))return reply({error:'Too many attempts. Please wait 15 minutes.'},429);
    const db=database();
    if(!db.prepare('SELECT token_hash FROM invitations WHERE token_hash=? AND expires_at>?').get(hash,Date.now()))return reply({error:'This invitation has expired or has already been used. Ask the organizer for another.'},400);
    const password=await hashPassword(parsed.data.password),accountId=randomUUID();
    db.exec('BEGIN IMMEDIATE');
    try{
      const invitation=db.prepare('SELECT * FROM invitations WHERE token_hash=? AND expires_at>?').get(hash,Date.now()) as {email:string;name:string;tournament_id:string;username:string|null}|undefined;
      if(!invitation){db.exec('ROLLBACK');return reply({error:'This invitation has expired or has been replaced. Ask the organizer for another.'},409);}
      if(invitation.email&&db.prepare('SELECT id FROM accounts WHERE email=?').get(invitation.email)){
        db.exec('ROLLBACK');return reply({error:'This account already exists. Sign in, or ask your organizer for help.'},409);
      }
      if(invitation.username){
        const reservation=db.prepare('SELECT account_id FROM account_usernames WHERE username=?').get(invitation.username) as {account_id:string|null}|undefined;
        const member=db.prepare('SELECT id FROM members WHERE tournament_id=? AND username=? AND user_id IS NULL').get(invitation.tournament_id,invitation.username);
        if(!reservation||reservation.account_id||!member){db.exec('ROLLBACK');return reply({error:'This invitation is no longer valid. Ask your organizer for help.'},409);}
        db.prepare('INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES(?,?,?,?,0,?)').run(accountId,invitation.email,invitation.name,password,new Date().toISOString());
        db.prepare('UPDATE account_usernames SET account_id=? WHERE username=? AND account_id IS NULL').run(accountId,invitation.username);
        db.prepare('UPDATE members SET user_id=? WHERE username=? AND user_id IS NULL').run(accountId,invitation.username);
        db.prepare('DELETE FROM invitations WHERE username=?').run(invitation.username);
      }else{
        // Keep still-valid legacy links usable until their owner assigns a username.
        const member=invitation.email&&db.prepare('SELECT id FROM members WHERE tournament_id=? AND email=? AND user_id IS NULL AND username IS NULL').get(invitation.tournament_id,invitation.email);
        if(!member||db.prepare('SELECT id FROM members WHERE email=? AND username IS NOT NULL').get(invitation.email)){
          db.exec('ROLLBACK');return reply({error:'This invitation was replaced. Ask your organizer for the current activation link.'},409);
        }
        db.prepare('INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES(?,?,?,?,0,?)').run(accountId,invitation.email,invitation.name,password,new Date().toISOString());
        db.prepare('UPDATE members SET user_id=? WHERE email=? AND user_id IS NULL AND username IS NULL').run(accountId,invitation.email);
        db.prepare('DELETE FROM invitations WHERE email=? AND username IS NULL').run(invitation.email);
      }
      db.exec('COMMIT');
    }catch(error){
      if(db.isTransaction)db.exec('ROLLBACK');
      if(error instanceof Error&&/UNIQUE constraint/.test(error.message))return reply({error:'This account was already activated or linked. Ask your organizer for help.'},409);
      throw error;
    }
    await issueSession(accountId);return reply({ok:true});
  }
  return reply({error:'Unknown sign-in action.'},404);
}
