import nextEnv from '@next/env';
import { randomUUID } from 'node:crypto';
import { database } from './local-store.mjs';
import { hashPassword } from './account-crypto.mjs';

nextEnv.loadEnvConfig(process.cwd(),process.env.NODE_ENV!=='production');
// Render supplies the real public URL once it has assigned the service name.
// A custom-domain APP_ORIGIN can override this without guessing a URL at create time.
if(!process.env.APP_ORIGIN&&process.env.RENDER_EXTERNAL_URL)process.env.APP_ORIGIN=process.env.RENDER_EXTERNAL_URL;
if(process.env.NODE_ENV==='production'){
  const origin=new URL(process.env.APP_ORIGIN||'invalid');
  if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('APP_ORIGIN must be the HTTPS origin of your Render service.');
}
const db=database();
if(!db.prepare('SELECT id FROM accounts WHERE owner=1 LIMIT 1').get()){
  const email=(process.env.MATCHROOM_OWNER_EMAIL||'').trim().toLowerCase();
  const password=process.env.MATCHROOM_OWNER_PASSWORD||'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>200)
    throw new Error('First start requires MATCHROOM_OWNER_EMAIL and MATCHROOM_OWNER_PASSWORD (12–200 characters). No default password is created.');
  const hash=await hashPassword(password);
  db.exec('BEGIN IMMEDIATE');
  try{
    if(!db.prepare('SELECT id FROM accounts WHERE owner=1 LIMIT 1').get())
      db.prepare('INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES(?,?,?,?,1,?)').run(randomUUID(),email,process.env.MATCHROOM_OWNER_NAME||'Max',hash,new Date().toISOString());
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
console.log('Matchroom database and organizer account are ready.');
