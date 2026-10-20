import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root=process.cwd(),dir=fs.mkdtempSync(path.join(root,'.test-friendly-organizer-'));
const bundle=path.join(dir,'friendlies.mjs');
process.env.MATCHROOM_DATA_DIR=dir;
try{
  await build({entryPoints:['lib/friendlies-server.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:bundle});
  const {database}=await import('../scripts/local-store.mjs');
  const {friendlyAction,getFriendlies}=await import(pathToFileURL(bundle).href);
  const db=database();
  const profile=name=>JSON.stringify({displayName:name,teams:[{kind:'football',name:'Arsenal'}],primary:null,platforms:['PC'],timezone:'UTC',psnId:'',eaId:name+'_ea'});
  for(const [id,owner] of [['owner',1],['a',0],['b',0],['c',0]]){
    db.prepare('INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES(?,?,?,?,?,?)').run(id,'',id,'hash',owner,'now');
    db.prepare('INSERT INTO account_usernames(username,account_id,created_at) VALUES(?,?,?)').run(id+'_user',id,'now');
    db.prepare('INSERT INTO account_profiles(account_id,data,updated_at) VALUES(?,?,?)').run(id,profile(id),'now');
  }
  db.prepare('INSERT INTO tournaments(id,name,owner_id,config,created_at) VALUES(?,?,?,?,?)').run('t','Test','owner','{}','now');
  for(const id of ['a','b','c'])db.prepare("INSERT INTO members(id,tournament_id,user_id,email,name,role,username) VALUES(?,'t',?,'',?,'manager',?)")
    .run('m-'+id,id,id,id+'_user');
  const actor=id=>({userId:id,displayName:id});
  const local=new Date(Date.now()+3*86400000).toISOString().slice(0,16);
  assert.throws(()=>friendlyAction(actor('a'),{action:'organize',firstId:'a',secondId:'b',local}),/Only the organizer/);
  const {id}=friendlyAction(actor('owner'),{action:'organize',firstId:'a',secondId:'b',local,message:'Club friendly'});
  assert.ok(id);
  assert.equal(getFriendlies(actor('c')).invitations.length,0);
  assert.equal(getFriendlies(actor('owner')).invitations[0].organizerView,true);
  assert.equal(getFriendlies(actor('a')).invitations[0].myTurn,true);
  assert.equal(getFriendlies(actor('b')).invitations[0].myTurn,false);
  friendlyAction(actor('a'),{action:'accept',id,version:1});
  assert.equal(getFriendlies(actor('a')).invitations[0].status,'pending');
  assert.equal(getFriendlies(actor('b')).invitations[0].myTurn,true);
  assert.equal(getFriendlies(actor('owner')).invitations[0].firstResponse,true);
  friendlyAction(actor('b'),{action:'accept',id,version:2});
  assert.equal(getFriendlies(actor('owner')).invitations[0].status,'accepted');
  const secondLocal=new Date(Date.now()+5*86400000).toISOString().slice(0,16);
  const counterLocal=new Date(Date.now()+6*86400000).toISOString().slice(0,16);
  const counterId=friendlyAction(actor('owner'),{action:'organize',firstId:'a',secondId:'b',local:secondLocal}).id;
  friendlyAction(actor('a'),{action:'counter',id:counterId,version:1,local:counterLocal});
  assert.equal(getFriendlies(actor('b')).invitations.find(i=>i.id===counterId).myTurn,true);
  friendlyAction(actor('b'),{action:'accept',id:counterId,version:2});
  assert.equal(getFriendlies(actor('owner')).invitations.find(i=>i.id===counterId).status,'accepted');
  const cancelLocal=new Date(Date.now()+8*86400000).toISOString().slice(0,16);
  const cancelId=friendlyAction(actor('owner'),{action:'organize',firstId:'a',secondId:'c',local:cancelLocal}).id;
  friendlyAction(actor('owner'),{action:'cancel',id:cancelId,version:1});
  assert.equal(getFriendlies(actor('c')).invitations.find(i=>i.id===cancelId).status,'cancelled');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  db.close();
  console.log('PASS: organizer proposals require both players, support counter-proposals and cancellation, and stay private.');
}finally{
  if(!dir.startsWith(root+path.sep))throw new Error('Test directory escaped the H: project.');
  fs.rmSync(dir,{recursive:true,force:true});
}
