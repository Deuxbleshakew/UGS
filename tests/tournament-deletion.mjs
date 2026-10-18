import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {deleteTournament,TournamentDeletionError} from '../lib/tournament-deletion.ts';
import {deletePlayerRecord} from '../lib/player-deletion.ts';

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
for(const file of fs.readdirSync('drizzle').filter(name=>/^\d+_.*\.sql$/.test(name)).sort())
  db.exec(fs.readFileSync(`drizzle/${file}`,'utf8'));
globalThis[Symbol.for('matchroom.sqlite')]=db;

db.exec("INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES('owner','','Owner','test',1,'now')");
for(const [tid,name] of [['old','Old Cup'],['current','Current Cup']])
  db.prepare('INSERT INTO tournaments(id,name,owner_id,config,created_at) VALUES(?,?,\'owner\',\'{}\',\'now\')').run(tid,name);
db.exec("INSERT INTO community_players(id,owner_id,name,created_at) VALUES('retired','owner','Retired','now')");
db.exec("INSERT INTO player_links(tournament_id,manager_id,player_id) VALUES('old','retired','retired')");
db.exec("INSERT INTO fixtures(id,tournament_id,home,away,stage,matchday,home_player_id) VALUES('old-match','old','a','b','league',1,'retired'),('current-match','current','c','d','league',1,NULL)");
db.exec("INSERT INTO matchweek_control(tournament_id,current_week,updated_at) VALUES('old',1,'now')");
db.exec("INSERT INTO schedule_events(id,tournament_id,fixture_id,actor_name,at,action) VALUES('event','old','old-match','Owner','now','scheduled')");
db.exec("INSERT INTO proofs(id,tournament_id,fixture_id,uploader,uploaded_at,category,name,mime,size,key) VALUES('proof','old','old-match','owner','now','result','proof.png','image/png',1,'00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-000000000003')");
db.exec("INSERT INTO playoffs(id,tournament_id,name,target,elo_mode,draw_seed,entrants,created_at) VALUES('qualifier','old','Qualifier',1,'match','seed','[]','now')");
db.exec("INSERT INTO playoff_ties(id,playoff_id,round,position,player_a) VALUES('tie','qualifier',1,1,'retired')");
db.exec("INSERT INTO team_playoffs(id,tournament_id,name,direct_count,seed,status,created_by,created_at) VALUES('team-draw','old','Team draw',1,'seed','ready','owner','now')");
db.exec("INSERT INTO team_playoff_entries(playoff_id,rank,team,votes,strength) VALUES('team-draw',1,'A',1,1)");

assert.equal(db.prepare("SELECT 1 FROM schedule_events WHERE id='event'").get()!=null,true);
assert.equal(db.prepare("SELECT 1 FROM tournaments WHERE id='old'").get()!=null,true);
await assert.rejects(deleteTournament('intruder','old','Old Cup'),TournamentDeletionError);
await assert.rejects(deleteTournament('owner','old','Wrong name'),TournamentDeletionError);
assert.equal(db.prepare("SELECT 1 FROM fixtures WHERE id='old-match'").get()!=null,true);
const result=await deleteTournament('owner','old','Old Cup');
assert.deepEqual(result,{ok:true,remainingId:'current'});
for(const [table,column,value] of [['tournaments','id','old'],['fixtures','tournament_id','old'],['schedule_events','tournament_id','old'],['proofs','tournament_id','old'],['playoffs','tournament_id','old'],['team_playoffs','tournament_id','old']])
  assert.equal(db.prepare(`SELECT 1 FROM ${table} WHERE ${column}=?`).get(value),undefined,`${table} should be removed`);
assert.equal(db.prepare("SELECT 1 FROM fixtures WHERE id='current-match'").get()!=null,true);
assert.equal(db.prepare("SELECT 1 FROM community_players WHERE id='retired'").get()!=null,true);
assert.equal(db.prepare("SELECT fixture_count,player_playoff_count,team_playoff_count FROM tournament_deletion_audit WHERE tournament_id='old'").get().fixture_count,1);
assert.equal(deletePlayerRecord(db,'owner','retired').player.name,'Retired');
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
db.exec("INSERT INTO schedule_events(id,tournament_id,fixture_id,actor_name,at,action) VALUES('current-event','current','current-match','Owner','now','scheduled')");
assert.throws(()=>db.exec("DELETE FROM schedule_events WHERE id='current-event'"),/Scheduling history is append-only/);
console.log('PASS: owner-only named confirmation; tournament history removed; other season retained; player can then be deleted.');
