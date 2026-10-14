import {randomBytes, randomUUID} from 'node:crypto';
import type {DatabaseSync, SQLInputValue} from 'node:sqlite';
import {z} from 'zod';
import {database} from '@/scripts/local-store.mjs';
import {digest} from '@/scripts/account-crypto.mjs';

export const usernameSchema = z.string().trim().min(3).max(24)
  .regex(/^[a-zA-Z0-9_]+$/, 'Use letters, numbers and underscores only.').transform(value => value.toLowerCase());
const optionalEmail = z.string().trim().max(254).refine(value => !value || z.string().email().safeParse(value).success, 'Enter a valid email or leave it blank.').transform(value => value.toLowerCase()).optional();
type Actor = {userId: string; displayName: string};
type Reservation = {username: string; account_id: string | null; player_id: string | null};
type Member = {id: string; user_id: string | null; player_id: string | null; email: string; username: string | null; name: string};
export class AccountAccessError extends Error {constructor(message: string, public status = 400) {super(message);}}
function fail(message: string, status = 400): never {throw new AccountAccessError(message, status);}
const db = () => database() as DatabaseSync;
const one = <T>(sql: string, ...args: SQLInputValue[]) => db().prepare(sql).get(...args) as T | undefined;
const rows = <T>(sql: string, ...args: SQLInputValue[]) => db().prepare(sql).all(...args) as T[];
function atomic<T>(work: () => T): T {
  const connection = db(); connection.exec('BEGIN IMMEDIATE');
  try {const result = work(); connection.exec('COMMIT'); return result;}
  catch (error) {
    if (connection.isTransaction) connection.exec('ROLLBACK');
    if (error instanceof Error && /UNIQUE constraint/.test(error.message)) fail('That username, email or player is already linked. Refresh and use the existing account.', 409);
    throw error;
  }
}
function requireOwner(actor: Actor) {
  if (!one('SELECT id FROM accounts WHERE id=? AND owner=1', actor.userId)) fail('Only the owner can manage accounts.', 403);
}
function record(actor: Actor, username: string, action: string, accountId: string | null = null) {
  // Never record activation tokens, passwords or password hashes in an audit entry.
  db().prepare('INSERT INTO account_access_audit(id,actor_id,target_account_id,username,action,created_at) VALUES(?,?,?,?,?,?)')
    .run(randomUUID(), actor.userId, accountId, username, action, new Date().toISOString());
}
function invite(reservation: Reservation, tid: string, name: string, email: string, actor: Actor) {
  if (reservation.account_id) return {existingAccount: true, token: null, username: reservation.username};
  const token = randomBytes(32).toString('hex');
  db().prepare('DELETE FROM invitations WHERE username=?').run(reservation.username);
  db().prepare('INSERT INTO invitations(token_hash,email,name,tournament_id,expires_at,username) VALUES(?,?,?,?,?,?)')
    .run(digest(token), email, name, tid, Date.now() + 72 * 60 * 60 * 1000, reservation.username);
  record(actor, reservation.username, 'issue-activation');
  return {existingAccount: false, token, username: reservation.username};
}
function singlePlayer(members: Member[]): string | null {
  const ids = [...new Set(members.map(member => member.player_id).filter((value): value is string => !!value))];
  if (ids.length > 1) fail('This account has conflicting player identities. Resolve the existing assignments before assigning a username; no history was merged.', 409);
  return ids[0] ?? null;
}

export type AccountAccessRow = {key: string; accountId: string | null; memberId: string | null; playerId: string | null; name: string; email: string; username: string | null; owner: boolean; status: 'active' | 'pending'};
export function accountDirectory(actor: Actor): AccountAccessRow[] {
  requireOwner(actor);
  const active = rows<{id: string; name: string; email: string; owner: number; username: string | null; player_id: string | null}>(
    'SELECT a.id,a.name,a.email,a.owner,u.username,u.player_id FROM accounts a LEFT JOIN account_usernames u ON u.account_id=a.id ORDER BY a.owner DESC,a.name,a.id');
  const pending = rows<Member>('SELECT m.* FROM members m JOIN tournaments t ON t.id=m.tournament_id WHERE t.owner_id=? AND m.user_id IS NULL AND NOT EXISTS(SELECT 1 FROM accounts a WHERE m.email<>\'\' AND a.email=m.email) ORDER BY m.name,m.id', actor.userId);
  const result: AccountAccessRow[] = active.map(a => ({key: 'account:' + a.id, accountId: a.id, memberId: null, playerId: a.player_id, name: a.name, email: a.email, username: a.username, owner: a.owner === 1, status: 'active'}));
  const seen = new Set<string>();
  for (const m of pending) {
    const key = m.username ? 'username:' + m.username : 'email:' + m.email;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({key, accountId: null, memberId: m.id, playerId: m.player_id, name: m.name, email: m.email, username: m.username, owner: false, status: 'pending'});
  }
  return result;
}

export function assignUsername(actor: Actor, input: unknown) {
  const data = z.object({username: usernameSchema, accountId: z.string().min(1).optional(), memberId: z.string().min(1).optional()})
    .refine(value => !!value.accountId !== !!value.memberId, 'Choose one existing account or pending invitation.').parse(input);
  return atomic(() => {
    requireOwner(actor);
    if (data.accountId) {
      const account = one<{id: string; email: string}>('SELECT id,email FROM accounts WHERE id=?', data.accountId);
      if (!account) fail('Account not found.', 404);
      const current = one<Reservation>('SELECT * FROM account_usernames WHERE account_id=?', account.id);
      if (current) {
        if (current.username !== data.username) fail('Assigned usernames are fixed in this milestone.', 409);
        return {existingAccount: true, token: null, username: current.username};
      }
      const members = rows<Member>('SELECT * FROM members WHERE user_id=? OR (user_id IS NULL AND username IS NULL AND email<>\'\' AND email=?)', account.id, account.email);
      const playerId = singlePlayer(members);
      db().prepare('INSERT INTO account_usernames(username,account_id,player_id,created_at) VALUES(?,?,?,?)').run(data.username, account.id, playerId, new Date().toISOString());
      for (const member of members) db().prepare('UPDATE members SET user_id=?,username=? WHERE id=?').run(account.id, data.username, member.id);
      if (account.email) db().prepare('DELETE FROM invitations WHERE email=? AND username IS NULL').run(account.email);
      record(actor, data.username, 'assign-existing-account', account.id);
      return {existingAccount: true, token: null, username: data.username};
    }
    const target = one<Member & {tournament_id: string}>('SELECT m.* FROM members m JOIN tournaments t ON t.id=m.tournament_id WHERE m.id=? AND t.owner_id=?', data.memberId!, actor.userId);
    if (!target || target.user_id) fail('Choose an existing pending invitation.', 409);
    if (target.username) fail('This pending account already has a username. Refresh its activation link through the player access form.', 409);
    if (!target.email || one('SELECT id FROM accounts WHERE email=?', target.email)) fail('Assign the existing account a username instead.', 409);
    const members = rows<Member>('SELECT m.* FROM members m JOIN tournaments t ON t.id=m.tournament_id WHERE t.owner_id=? AND m.email=? AND m.user_id IS NULL AND m.username IS NULL', actor.userId, target.email);
    const playerId = singlePlayer(members);
    db().prepare('INSERT INTO account_usernames(username,player_id,created_at) VALUES(?,?,?)').run(data.username, playerId, new Date().toISOString());
    for (const member of members) db().prepare('UPDATE members SET username=? WHERE id=?').run(data.username, member.id);
    db().prepare('DELETE FROM invitations WHERE email=? AND username IS NULL').run(target.email);
    record(actor, data.username, 'assign-pending-account');
    return invite({username: data.username, account_id: null, player_id: playerId}, target.tournament_id, target.name, target.email, actor);
  });
}

function grant(tid: string, actor: Actor, data: {playerId: string; username: string; email?: string}) {
  requireOwner(actor);
  const player = one<{id: string; name: string}>('SELECT p.id,p.name FROM community_players p JOIN tournaments t ON t.owner_id=p.owner_id WHERE t.id=? AND t.owner_id=? AND p.id=?', tid, actor.userId, data.playerId);
  if (!player) fail('Choose a player from your tournament community.', 404);
  const existing = one<Member>('SELECT * FROM members WHERE tournament_id=? AND player_id=?', tid, player.id);
  let reservation = one<Reservation>('SELECT * FROM account_usernames WHERE username=?', data.username);
  if (reservation && reservation.player_id && reservation.player_id !== player.id) fail('That username belongs to another player. Choose their existing player entry.', 409);
  if (existing && existing.username !== data.username) fail('Assign a username to this existing account in the account list first. Existing player links are not replaced.', 409);
  if (reservation?.account_id) {
    const linked = rows<Member>('SELECT * FROM members WHERE user_id=?', reservation.account_id);
    if (linked.some(m => m.player_id && m.player_id !== player.id)) fail('That account is already linked to a different player.', 409);
    if (one('SELECT id FROM members WHERE tournament_id=? AND user_id=? AND (player_id IS NULL OR player_id<>?)', tid, reservation.account_id, player.id)) fail('This account already has a tournament assignment. Existing assignments are not replaced.', 409);
  }
  // Optional contact email never identifies or merges a username/account.
  const accountEmail = reservation?.account_id ? one<{email: string}>('SELECT email FROM accounts WHERE id=?', reservation.account_id)?.email : undefined;
  const pendingEmail = reservation ? one<{email: string}>('SELECT email FROM members WHERE username=? LIMIT 1', reservation.username)?.email : undefined;
  const establishedEmail = accountEmail ?? pendingEmail;
  if (establishedEmail !== undefined && data.email && data.email !== establishedEmail) fail('Use the account’s existing email, or leave the field blank. This form does not change contact details.', 409);
  const email = establishedEmail ?? data.email ?? '';
  if (email) {
    const emailAccount = one<{id: string}>('SELECT id FROM accounts WHERE email=?', email);
    if (emailAccount && emailAccount.id !== reservation?.account_id) fail('This email already belongs to an account. Assign that account a username and use its existing player.', 409);
    if (one('SELECT id FROM members WHERE email=? AND (username IS NULL OR username<>?) AND (user_id IS NULL OR user_id<>?)', email, data.username, reservation?.account_id ?? '')) fail('This email has an existing player invitation. Assign its username in the account list first.', 409);
  }
  if (!reservation) {
    db().prepare('INSERT INTO account_usernames(username,player_id,created_at) VALUES(?,?,?)').run(data.username, player.id, new Date().toISOString());
    reservation = {username: data.username, account_id: null, player_id: player.id};
  } else if (!reservation.player_id) {
    db().prepare('UPDATE account_usernames SET player_id=? WHERE username=?').run(player.id, reservation.username);
    reservation.player_id = player.id;
  }
  const linked = one<{manager_id: string}>('SELECT manager_id FROM player_links WHERE tournament_id=? AND player_id=?', tid, player.id);
  if (!existing) db().prepare("INSERT INTO members(id,tournament_id,user_id,email,name,role,manager_id,player_id,username) VALUES(?,?,?,?,?,'manager',?,?,?)")
    .run(randomUUID(), tid, reservation.account_id, email, player.name, linked?.manager_id ?? null, player.id, data.username);
  record(actor, data.username, existing ? 'refresh-player-access' : 'authorize-player', reservation.account_id);
  db().prepare('INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after") VALUES(?,?,?,?,?,?,?,?,?)')
    .run(randomUUID(), tid, actor.userId, actor.displayName, new Date().toISOString(), 'authorize-player', 'Owner authorized username-based player access.', 'null', JSON.stringify({playerId: player.id, username: data.username, existingMembership: !!existing}));
  return invite(reservation, tid, player.name, email, actor);
}

export function authorizePlayer(tid: string, actor: Actor, input: unknown) {
  const data = z.object({playerId: z.string().min(1), username: usernameSchema, email: optionalEmail}).parse(input);
  return atomic(() => grant(tid, actor, data));
}

export function createPlayerUser(tid: string, actor: Actor, input: unknown) {
  const data = z.object({name: z.string().trim().min(1).max(80), username: usernameSchema, email: optionalEmail}).parse(input);
  return atomic(() => {
    requireOwner(actor);
    const tournament = one<{locked_at: string | null}>('SELECT locked_at FROM tournaments WHERE id=? AND owner_id=?', tid, actor.userId);
    if (!tournament) fail('Tournament not found.', 404);
    if (tournament.locked_at) fail('Unlock tournament awards before adding a player.');
    if (one('SELECT username FROM account_usernames WHERE username=?', data.username)) fail('That username is already reserved. Choose its existing player instead.', 409);
    if (one('SELECT id FROM community_players WHERE owner_id=? AND name=? COLLATE NOCASE', actor.userId, data.name)) fail('This player already exists. Choose their existing player profile.', 409);
    const playerId = randomUUID();
    db().prepare('INSERT INTO community_players(id,owner_id,name,created_at) VALUES(?,?,?,?)').run(playerId, actor.userId, data.name, new Date().toISOString());
    return grant(tid, actor, {...data, playerId});
  });
}
