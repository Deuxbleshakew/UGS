import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
for(const file of fs.readdirSync('drizzle').filter(name=>/^\d+_.*\.sql$/.test(name)&&name<'0025').sort())
  db.exec(fs.readFileSync(`drizzle/${file}`,'utf8'));
db.exec("INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES('owner','','Owner','test',1,'now')");
const managers=[{id:'max',name:'Max'},...Array.from({length:8},(_,i)=>({id:`manager-${i+5}`,name:`Manager ${i+5}`}))];
const config={tournamentId:'ucl-fantasy-2026',managers,clubs:[{id:'club',name:'Club',pot:'pending',manager:'manager-6'}],pots:[{id:'pending',name:'Pending'}]};
db.prepare("INSERT INTO tournaments(id,name,owner_id,config,created_at) VALUES('current','Current','owner',?,'now')").run(JSON.stringify(config));
db.prepare("INSERT INTO tournaments(id,name,owner_id,config,created_at) VALUES('other','Other','owner',?,'now')")
  .run(JSON.stringify({...config,tournamentId:'other'}));
for(let n=5;n<=12;n++){
  db.prepare('INSERT INTO community_players(id,owner_id,name,created_at) VALUES(?,?,?,?)').run(`player-${n}`,'owner',`Manager ${n}`,'now');
  db.prepare('INSERT INTO player_links(tournament_id,manager_id,player_id) VALUES(?,?,?)').run('current',`manager-${n}`,`player-${n}`);
}
// A linked member must protect manager 7; a historical result must protect
// player 8 even though its numbered manager slot may be removed.
db.prepare("INSERT INTO members(id,tournament_id,email,name,role,manager_id,player_id) VALUES('member','current','real@example.com','Real','participant','manager-7','player-7')").run();
db.prepare("INSERT INTO fixtures(id,tournament_id,home,away,stage,matchday,home_player_id) VALUES('fixture','current','club','other','league',1,'player-8')").run();
db.exec(fs.readFileSync('drizzle/0025_remove_placeholder_managers.sql','utf8'));
const kept=JSON.parse(db.prepare("SELECT config FROM tournaments WHERE id='current'").get().config).managers.map(m=>m.id);
assert.deepEqual(kept,['max','manager-6','manager-7']);
assert.equal(JSON.parse(db.prepare("SELECT config FROM tournaments WHERE id='other'").get().config).managers.length,9);
assert.equal(db.prepare("SELECT count(*) AS n FROM community_players WHERE name LIKE 'Manager %'").get().n,3);
assert.equal(db.prepare("SELECT id FROM community_players WHERE id='player-8'").get().id,'player-8');
assert.equal(db.prepare("SELECT outcome FROM placeholder_manager_cleanup WHERE tournament_id='current' AND manager_id='manager-6'").get().outcome,'requires-review');
assert.equal(db.prepare("SELECT outcome FROM placeholder_manager_cleanup WHERE tournament_id='current' AND manager_id='manager-7'").get().outcome,'requires-review');
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
console.log('PASS: unused numbered managers removed; assigned managers and historical players preserved.');
