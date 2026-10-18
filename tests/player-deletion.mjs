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
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
console.log('PASS: unused players and photo removed; assigned players and match history protected.');
