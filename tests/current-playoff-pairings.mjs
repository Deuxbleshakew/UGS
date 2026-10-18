import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {pairRequestedClubQualifiers} from '../lib/team-sim.ts';

const teams=Array.from({length:27},(_,i)=>`Other ${i+1}`);
for(const [rank,name] of [[8,'PSV Eindhoven'],[9,'Viktoria Plzeň'],[10,'AC Milan'],[13,'Real Sociedad'],[20,'Monaco'],[23,'Marseille'],[24,'Young Boys'],[25,'FC Porto']])teams[rank-1]=name;
const pairs=pairRequestedClubQualifiers(6,teams);
assert.deepEqual(pairs.filter(p=>[3,4,5,8].includes(p.position)),[
  {position:3,high:20,low:25},{position:4,high:23,low:24},
  {position:5,high:9,low:10},{position:8,high:8,low:13},
]);
assert.equal(pairRequestedClubQualifiers(6,teams.map(t=>t==='FC Porto'?'Other Porto':t))[2].high,8);

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
for(const file of fs.readdirSync('drizzle').filter(name=>/^\d+_.*\.sql$/.test(name)&&name<'0028').sort())
  db.exec(fs.readFileSync(`drizzle/${file}`,'utf8'));
db.exec("INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES('owner','','Owner','test',1,'now')");
const old=[[3,8,25],[4,9,24],[5,10,23],[8,13,20]];
const desired=[[3,20,25],[4,23,24],[5,9,10],[8,8,13]];
for(const [id,ties,scored,format] of [
  ['new-draw',old,false,'ucl-fantasy-2026'],
  ['already-fixed',desired,false,'ucl-fantasy-2026'],
  ['played',old,true,'ucl-fantasy-2026'],
  ['other-season',old,false,'another-format'],
]){
  db.prepare("INSERT INTO tournaments(id,name,owner_id,config,created_at) VALUES(?,?,'owner',?,'now')")
    .run(id,id,JSON.stringify({tournamentId:format}));
  db.prepare("INSERT INTO team_playoffs(id,tournament_id,name,direct_count,seed,status,created_by,created_at) VALUES(?,?,?,5,'seed','ready','owner','now')")
    .run(id,id,id);
  for(const [rank,team] of [[8,'PSV Eindhoven'],[9,'Viktoria Plzeň'],[10,'AC Milan'],[13,'Real Sociedad'],[20,'Monaco'],[23,'Marseille'],[24,'Young Boys'],[25,'FC Porto']])
    db.prepare('INSERT INTO team_playoff_entries VALUES(?,?,?,?,?)').run(id,rank,team,1,1);
  for(const [position,high,low] of ties)
    db.prepare('INSERT INTO team_playoff_ties(id,playoff_id,position,high_rank,low_rank,l1_low) VALUES(?,?,?,?,?,?)')
      .run(`${id}-${position}`,id,position,high,low,scored&&position===4?1:null);
}
db.exec(fs.readFileSync('drizzle/0028_current_playoff_pairings.sql','utf8'));
for(const [id,outcome,expected] of [
  ['new-draw','applied',desired],['already-fixed','already-correct',desired],
  ['played','requires-review',old],
]){
  assert.equal(db.prepare('SELECT outcome FROM playoff_pairing_retry_reviews WHERE playoff_id=?').get(id).outcome,outcome);
  assert.deepEqual(db.prepare('SELECT position,high_rank,low_rank FROM team_playoff_ties WHERE playoff_id=? ORDER BY position').all(id).map(x=>[x.position,x.high_rank,x.low_rank]),expected);
}
assert.equal(db.prepare("SELECT version FROM team_playoffs WHERE id='new-draw'").get().version,2);
assert.equal(db.prepare("SELECT version FROM team_playoffs WHERE id='already-fixed'").get().version,1);
assert.equal(db.prepare("SELECT outcome FROM playoff_pairing_retry_reviews WHERE playoff_id='other-season'").get(),undefined);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
console.log('PASS: requested pairings apply to a new unplayed draw; correct, played and unrelated draws stay intact.');
