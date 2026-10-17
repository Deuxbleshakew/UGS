import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

function fixture(scored=false) {
  const db=new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  for(const file of fs.readdirSync('drizzle').filter(name=>/^\d+_.*\.sql$/.test(name)&&name<'0026').sort())
    db.exec(fs.readFileSync(`drizzle/${file}`,'utf8'));
  db.exec("INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES('owner','','Owner','test',1,'now')");
  db.prepare("INSERT INTO tournaments(id,name,owner_id,config,created_at) VALUES('current','Current','owner',?,'now')")
    .run(JSON.stringify({tournamentId:'ucl-fantasy-2026',managers:[],clubs:[]}));
  db.exec("INSERT INTO team_playoffs(id,tournament_id,name,direct_count,seed,status,created_by,created_at) VALUES('draw','current','Draw',5,'seed','ready','owner','now')");
  const entries=[[8,'PSV Eindhoven'],[9,'Viktoria Plzeň'],[10,'AC Milan'],[13,'Real Sociedad'],[20,'Monaco'],[23,'Marseille'],[24,'Young Boys'],[25,'FC Porto']];
  for(const [rank,team] of entries)
    db.prepare("INSERT INTO team_playoff_entries VALUES('draw',?,?,1,1)").run(rank,team);
  const ties=[[3,8,25],[4,9,24],[5,10,23],[8,13,20],[9,14,19]];
  // An unrelated tie can refer to other valid ranks and must stay untouched.
  db.exec("INSERT INTO team_playoff_entries VALUES('draw',14,'Other A',1,1),('draw',19,'Other B',1,1)");
  for(const [position,high,low] of ties)
    db.prepare("INSERT INTO team_playoff_ties(id,playoff_id,position,high_rank,low_rank) VALUES(?,'draw',?,?,?)")
      .run(`tie-${position}`,position,high,low);
  if(scored)db.exec("UPDATE team_playoff_ties SET l1_low=1 WHERE id='tie-4'");
  return db;
}
const migration=fs.readFileSync('drizzle/0026_playoff_pairings.sql','utf8');
const db=fixture();
db.exec(migration);
assert.equal(db.prepare("SELECT outcome FROM playoff_pairing_reviews WHERE playoff_id='draw'").get().outcome,'applied');
assert.deepEqual(db.prepare("SELECT position,high_rank AS high,low_rank AS low FROM team_playoff_ties WHERE playoff_id='draw' ORDER BY position").all().map(x=>({...x})),[
  {position:3,high:20,low:25},{position:4,high:23,low:24},
  {position:5,high:9,low:10},{position:8,high:8,low:13},
  {position:9,high:14,low:19},
]);
assert.equal(db.prepare("SELECT version FROM team_playoffs WHERE id='draw'").get().version,2);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);

const played=fixture(true);
played.exec(migration);
assert.equal(played.prepare("SELECT outcome FROM playoff_pairing_reviews WHERE playoff_id='draw'").get().outcome,'requires-review');
assert.deepEqual(played.prepare("SELECT position,high_rank AS high,low_rank AS low FROM team_playoff_ties WHERE playoff_id='draw' ORDER BY position").all().map(x=>({...x})),[
  {position:3,high:8,low:25},{position:4,high:9,low:24},
  {position:5,high:10,low:23},{position:8,high:13,low:20},
  {position:9,high:14,low:19},
]);
assert.equal(played.prepare("SELECT l1_low FROM team_playoff_ties WHERE id='tie-4'").get().l1_low,1);
assert.equal(played.prepare("SELECT version FROM team_playoffs WHERE id='draw'").get().version,1);
console.log('PASS: four pairings change only on unplayed draws; scores and other ties stay intact.');
