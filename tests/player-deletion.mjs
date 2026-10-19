import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {deletePlayerRecord,PlayerDeletionBlocked} from '../lib/player-deletion.ts';

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
for(const file of fs.readdirSync('drizzle').filter(name=>/^\d+_.*\.sql$/.test(name)).sort())
  db.exec(fs.readFileSync(`drizzle/${file}`,'utf8'));
db.exec("INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES('owner','','Owner','test',1,'now')");
const config={tournamentId:'ucl-fantasy-2026',pots:[{id:'p',name:'P'}],managers:[
  {id:'max',name:'Max'},{id:'manager-5',name:'Manager 5'},{id:'assigned',name:'Assigned'}],
  clubs:[{id:'a',name:'A',pot:'p',manager:'assigned'},{id:'b',name:'B',pot:'p'}]};
db.prepare("INSERT INTO tournaments(id,name,owner_id,config,created_at) VALUES('current','Current','owner',?,'now')").run(JSON.stringify(config));
for(const [id,name] of [['placeholder','Manager 5'],['custom','Unused'],['assigned-player','Assigned'],['played','Played']])
  db.prepare("INSERT INTO community_players(id,owner_id,name,created_at) VALUES(?,'owner',?,'now')").run(id,name);
db.exec("INSERT INTO player_links VALUES('current','manager-5','placeholder'),('current','assigned','assigned-player')");
db.exec("INSERT INTO player_photos(player_id,mime,data,width,height,updated_at) VALUES('placeholder','image/jpeg',x'00',1,1,'now')");
db.exec("INSERT INTO fixtures(id,tournament_id,home,away,stage,matchday,home_player_id) VALUES('fixture','current','a','b','league',1,'played')");

db.exec('BEGIN');
const removed=deletePlayerRecord(db,'owner','placeholder');
db.exec('COMMIT');
assert.equal(removed.player.name,'Manager 5');
assert.equal(db.prepare("SELECT 1 FROM community_players WHERE id='placeholder'").get(),undefined);
assert.equal(db.prepare("SELECT 1 FROM player_photos WHERE player_id='placeholder'").get(),undefined);
assert.equal(db.prepare("SELECT 1 FROM player_links WHERE player_id='placeholder'").get(),undefined);
assert.equal(JSON.parse(db.prepare("SELECT config FROM tournaments WHERE id='current'").get().config).managers.some(m=>m.id==='manager-5'),false);
assert.equal(db.prepare("SELECT revision FROM tournaments WHERE id='current'").get().revision,1);

assert.equal(deletePlayerRecord(db,'owner','custom').player.name,'Unused');
assert.throws(()=>deletePlayerRecord(db,'owner','assigned-player'),PlayerDeletionBlocked);
assert.throws(()=>deletePlayerRecord(db,'owner','played'),PlayerDeletionBlocked);
assert.equal(db.prepare("SELECT 1 FROM community_players WHERE id='assigned-player'").get()!=null,true);
assert.equal(db.prepare("SELECT 1 FROM fixtures WHERE home_player_id='played'").get()!=null,true);

// A linked player with fixtures and playoff history requires the explicit owner override.
db.exec("INSERT INTO community_players(id,owner_id,name,created_at) VALUES('linked','owner','Linked','now')");
db.exec("INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES('linked-account','','Linked','test',0,'now')");
db.exec("INSERT INTO account_usernames(username,account_id,player_id,created_at) VALUES('linked_user','linked-account','linked','now')");
db.exec("INSERT INTO members(id,tournament_id,user_id,email,name,role,manager_id,player_id,username) VALUES('linked-member','current','linked-account','','Linked','manager',NULL,'linked','linked_user')");
db.exec("INSERT INTO fixtures(id,tournament_id,home,away,stage,matchday,kind,home_player_id) VALUES('linked-fixture','current','linked','played','playoff',1,'player','linked')");
db.exec("INSERT INTO playoffs(id,tournament_id,name,target,elo_mode,draw_seed,entrants,qualified,automatic_qualifiers,created_at) VALUES('linked-playoff','current','Qualifiers',1,'match','seed','[\"linked\",\"played\"]','[\"linked\"]','[\"linked\"]','now')");
db.exec("INSERT INTO playoff_ties(id,playoff_id,round,position,player_a,player_b) VALUES('linked-tie','linked-playoff',1,1,'linked','played')");
db.exec('BEGIN');
assert.equal(deletePlayerRecord(db,'owner','linked',true).player.name,'Linked');
db.exec('COMMIT');
assert.equal(db.prepare("SELECT 1 FROM community_players WHERE id='linked'").get(),undefined);
assert.equal(db.prepare("SELECT 1 FROM fixtures WHERE id='linked-fixture'").get(),undefined);
assert.equal(db.prepare("SELECT player_id FROM account_usernames WHERE username='linked_user'").get().player_id,null);
assert.equal(db.prepare("SELECT player_id FROM members WHERE id='linked-member'").get().player_id,null);
assert.equal(db.prepare("SELECT username FROM members WHERE id='linked-member'").get().username,'linked_user');
assert.deepEqual(JSON.parse(db.prepare("SELECT qualified FROM playoffs WHERE id='linked-playoff'").get().qualified),[]);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
console.log('PASS: unused players removed, ordinary deletion protects history, and owner override clears linked records.');
