import {database} from '@/scripts/local-store.mjs';
import {z} from 'zod';
import {profileSchema,missingProfile,type ProfileData,type ProfileState} from './profile';
import type {CurrentUser} from './auth';
import {AccountAccessError} from './account-access';

export function getProfile(user:CurrentUser):ProfileState{
  const db=database();
  const row=db.prepare('SELECT data,version FROM account_profiles WHERE account_id=?').get(user.userId) as {data:string;version:number}|undefined;
  const data:ProfileData=row?profileSchema.parse(JSON.parse(row.data)):{displayName:user.displayName,teams:[],primary:null,platforms:[],timezone:'',psnId:'',eaId:''};
  const participant=!!db.prepare("SELECT id FROM members WHERE user_id=? AND role IN ('manager','participant') LIMIT 1").get(user.userId);
  const missing=missingProfile(data,user.username,participant);
  return {data,version:row?.version??0,participant,missing,complete:missing.length===0};
}
export function saveProfile(user:CurrentUser,input:unknown){
  const {data,version}=z.object({data:profileSchema,version:z.number().int().min(0)}).parse(input);
  const db=database();db.exec('BEGIN IMMEDIATE');
  try{
    const current=db.prepare('SELECT version FROM account_profiles WHERE account_id=?').get(user.userId) as {version:number}|undefined;
    if((current?.version??0)!==version)throw new AccountAccessError('Your profile changed in another tab. Reload it before saving.',409);
    db.prepare('INSERT INTO account_profiles(account_id,data,version,updated_at) VALUES(?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at').run(user.userId,JSON.stringify(data),version+1,new Date().toISOString());
    db.prepare('UPDATE accounts SET name=? WHERE id=?').run(data.displayName,user.userId);
    db.exec('COMMIT');
  }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
  return getProfile({...user,displayName:data.displayName});
}
