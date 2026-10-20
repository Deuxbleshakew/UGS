import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root=process.cwd(),dir=fs.mkdtempSync(path.join(root,'.test-account-deletion-'));
process.env.MATCHROOM_DATA_DIR=dir;
let db;
try{
  const bundle=path.join(dir,'user-management.mjs');
  await build({entryPoints:['lib/user-management.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:bundle});
  const {database}=await import('../scripts/local-store.mjs');
  const {deleteAccount,accountActivity}=await import(pathToFileURL(bundle).href);
  db=database();
  const insertAccount=(id,owner=0)=>db.prepare('INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES(?,?,?,?,?,?)').run(id,'',id,'hash',owner,'now');
  insertAccount('owner',1);insertAccount('player');insertAccount('opponent');
  const config={tournamentId:'t',name:'Test',pots:[{id:'p',name:'P'}],managers:[{id:'ma',name:'player'},{id:'mb',name:'opponent'}],clubs:[{id:'ca',name:'A',pot:'p',manager:'ma'},{id:'cb',name:'B',pot:'p',manager:'mb'}]};
  db.prepare('INSERT INTO tournaments(id,name,owner_id,config,created_at) VALUES(?,?,?,?,?)').run('t','Test','owner',JSON.stringify(config),'now');
  for(const id of ['player','opponent']){
    db.prepare('INSERT INTO community_players(id,owner_id,name,created_at) VALUES(?,?,?,?)').run('p-'+id,'owner',id,'now');
    db.prepare('INSERT INTO account_usernames(username,account_id,player_id,created_at) VALUES(?,?,?,?)').run(id,id,'p-'+id,'now');
    db.prepare("INSERT INTO members(id,tournament_id,user_id,email,name,role,manager_id,player_id,username) VALUES(?,'t',?,'',?,'manager',?,?,?)")
      .run('m-'+id,id,id,id==='player'?'ma':'mb','p-'+id,id);
    db.prepare('INSERT INTO player_links(tournament_id,manager_id,player_id) VALUES(?,?,?)').run('t',id==='player'?'ma':'mb','p-'+id);
  }
  db.prepare("INSERT INTO fixtures(id,tournament_id,home,away,stage,matchday,kind,home_player_id,away_player_id,status,report,finalized_at) VALUES('fixture','t','ca','cb','league',1,'club','p-player','p-opponent','finalized','{}','now')").run();
  db.prepare("INSERT INTO friendly_invitations(id,inviter_id,invitee_id,pair_key,status,proposed_at,proposed_local,proposer_timezone,proposed_by,created_at,updated_at) VALUES('friendly','player','opponent','opponent:player','accepted','2026-10-20T00:00:00.000Z','2026-10-20T00:00','UTC','player','now','now')").run();
  db.prepare("INSERT INTO friendly_events(id,invitation_id,actor_id,actor_name,at,action) VALUES('event','friendly','player','player','now','logged')").run();
  db.prepare("INSERT INTO friendly_invitations(id,inviter_id,invitee_id,pair_key,status,proposed_at,proposed_local,proposer_timezone,proposed_by,created_at,updated_at) VALUES('other-friendly','owner','opponent','opponent:owner','accepted','2026-10-20T00:00:00.000Z','2026-10-20T00:00','UTC','owner','now','now')").run();
  db.prepare("INSERT INTO friendly_events(id,invitation_id,actor_id,actor_name,at,action) VALUES('other-event','other-friendly','player','player','now','note')").run();
  db.prepare("INSERT INTO schedule_proposals(id,tournament_id,fixture_id,kind,proposed_at,proposed_local,proposer_timezone,proposer_account_id,proposer_name,proposer_side,responder_side,status,created_at) VALUES('proposal','t','fixture','initial','2099-10-20T00:00:00.000Z','2099-10-20T00:00','UTC','player','player','home','away','withdrawn','now')").run();
  db.prepare("INSERT INTO schedule_events(id,tournament_id,fixture_id,proposal_id,actor_id,actor_name,at,action) VALUES('schedule-event','t','fixture','proposal','player','player','now','withdrawn')").run();
  db.prepare("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES('session','player',9999999999999)").run();
  assert.throws(()=>deleteAccount({userId:'player',displayName:'player'},{accountId:'opponent',name:'opponent',confirm:true}));
  assert.throws(()=>deleteAccount({userId:'owner',displayName:'owner'},{accountId:'owner',name:'owner',confirm:true}));
  assert.throws(()=>deleteAccount({userId:'owner',displayName:'owner'},{accountId:'player',name:'wrong',confirm:true}));
  assert.equal(db.prepare("SELECT 1 FROM accounts WHERE id='player'").get()!=null,true);
  const result=deleteAccount({userId:'owner',displayName:'owner'},{accountId:'player',name:'player',confirm:true});
  assert.deepEqual({playersDeleted:result.playersDeleted,friendliesDeleted:result.friendliesDeleted},{playersDeleted:1,friendliesDeleted:1});
  for(const [table,column,value] of [['accounts','id','player'],['community_players','id','p-player'],['members','user_id','player'],['fixtures','id','fixture'],['friendly_invitations','id','friendly'],['sessions','account_id','player']])
    assert.equal(db.prepare(`SELECT 1 FROM ${table} WHERE ${column}=?`).get(value),undefined,table);
  assert.equal(db.prepare("SELECT 1 FROM accounts WHERE id='opponent'").get()!=null,true);
  assert.equal(db.prepare("SELECT 1 FROM friendly_invitations WHERE id='other-friendly'").get()!=null,true);
  assert.equal(db.prepare("SELECT 1 FROM friendly_events WHERE id='other-event'").get(),undefined);
  assert.equal(db.prepare("SELECT 1 FROM community_players WHERE id='p-opponent'").get()!=null,true);
  assert.throws(()=>accountActivity({userId:'opponent',displayName:'opponent'}));
  assert.equal(accountActivity({userId:'owner',displayName:'owner'}).some(event=>event.action==='delete-account'),true);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  console.log('PASS: owner permanently deletes linked account, player, games and credentials without orphaned references.');
}finally{db?.close();fs.rmSync(dir,{recursive:true,force:true});}
