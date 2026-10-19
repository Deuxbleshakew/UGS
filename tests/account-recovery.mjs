import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {renameAccountUsername,issuePasswordReset,completePasswordReset,AccountRecoveryError} from '../lib/account-recovery.ts';

const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
for(const file of fs.readdirSync('drizzle').filter(name=>/^\d+_.*\.sql$/.test(name)).sort())db.exec(fs.readFileSync(`drizzle/${file}`,'utf8'));
db.exec("INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES('owner','','Owner','hash',1,'now'),('player','','Player','old-hash',0,'now')");
db.exec("INSERT INTO tournaments(id,name,owner_id,config,created_at) VALUES('t','Tournament','owner','{}','now')");
db.exec("INSERT INTO account_usernames(username,account_id,created_at) VALUES('old_name','player','now')");
db.exec("INSERT INTO members(id,tournament_id,user_id,email,name,role,username) VALUES('m','t','player','','Player','manager','old_name')");
db.exec("INSERT INTO invitations(token_hash,email,name,tournament_id,expires_at,username) VALUES('invite','','Player','t',9999999999999,'old_name')");
db.exec("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES('session','player',9999999999999)");

assert.throws(()=>renameAccountUsername(db,'player','player','new_name'),AccountRecoveryError);
assert.equal(renameAccountUsername(db,'owner','player','new_name').username,'new_name');
assert.equal(db.prepare("SELECT username FROM members WHERE id='m'").get().username,'new_name');
assert.equal(db.prepare("SELECT username FROM invitations WHERE token_hash='invite'").get().username,'new_name');
assert.equal(db.prepare("SELECT account_id FROM account_usernames WHERE username='new_name'").get().account_id,'player');
assert.equal(db.prepare("SELECT 1 FROM account_usernames WHERE username='old_name'").get(),undefined);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);

assert.throws(()=>issuePasswordReset(db,'player','player'),AccountRecoveryError);
const first=issuePasswordReset(db,'owner','player');
assert.equal(first.username,'new_name');
assert.equal(db.prepare('SELECT token_hash FROM password_reset_tokens').get().token_hash===first.token,false);
const second=issuePasswordReset(db,'owner','player');
assert.throws(()=>completePasswordReset(db,first.token,'new-hash'),AccountRecoveryError);
assert.equal(completePasswordReset(db,second.token,'new-hash').ok,true);
assert.equal(db.prepare("SELECT password_hash FROM accounts WHERE id='player'").get().password_hash,'new-hash');
assert.equal(db.prepare("SELECT 1 FROM sessions WHERE account_id='player'").get(),undefined);
assert.throws(()=>completePasswordReset(db,second.token,'another-hash'),AccountRecoveryError);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
console.log('PASS: owner renames linked usernames and one-time reset invalidates earlier links and sessions.');
