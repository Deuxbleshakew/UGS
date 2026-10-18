import {randomBytes, randomUUID} from 'node:crypto';
import type {DatabaseSync, SQLInputValue} from 'node:sqlite';
import {z} from 'zod';
import {database} from '@/scripts/local-store.mjs';
import {AccountAccessError} from './account-access';

type Actor = {userId: string; displayName: string};
const db = () => database() as DatabaseSync;
const one = <T>(sql: string, ...args: SQLInputValue[]) => db().prepare(sql).get(...args) as T | undefined;
function fail(message: string, status = 400): never {throw new AccountAccessError(message, status);}
type Link = {id: string; tournament_id: string; token: string; enabled: number; expires_at: number | null; max_uses: number | null; uses: number; created_at: string};
export type JoinLinkState = {exists: boolean; token: string | null; enabled: boolean; expiresAt: number | null; maxUses: number | null; uses: number; expired: boolean; full: boolean};

function requireOwnedTournament(tid: string, actor: Actor) {
  if (!one('SELECT id FROM accounts WHERE id=? AND owner=1', actor.userId)) fail('Only the owner can manage the join link.', 403);
  if (!one('SELECT id FROM tournaments WHERE id=? AND owner_id=?', tid, actor.userId)) fail('Tournament not found.', 404);
}
function view(link: Link | undefined): JoinLinkState {
  if (!link) return {exists: false, token: null, enabled: false, expiresAt: null, maxUses: null, uses: 0, expired: false, full: false};
  return {exists: true, token: link.token, enabled: link.enabled === 1, expiresAt: link.expires_at, maxUses: link.max_uses, uses: link.uses,
    expired: link.expires_at !== null && link.expires_at <= Date.now(), full: link.max_uses !== null && link.uses >= link.max_uses};
}
export function getJoinLink(tid: string, actor: Actor): JoinLinkState {
  requireOwnedTournament(tid, actor);
  return view(one<Link>('SELECT * FROM join_links WHERE tournament_id=?', tid));
}
const saveSchema = z.object({
  action: z.enum(['create', 'enable', 'disable']),
  expiresDays: z.number().int().min(1).max(365).nullable().optional(),
  maxUses: z.number().int().min(1).max(500).nullable().optional(),
});
/** create = a brand-new link (the old one stops working at once); enable / disable = switch the current link. */
export function saveJoinLink(tid: string, actor: Actor, input: unknown): JoinLinkState {
  requireOwnedTournament(tid, actor);
  const data = saveSchema.parse(input), current = one<Link>('SELECT * FROM join_links WHERE tournament_id=?', tid);
  if (data.action === 'create') {
    const token = randomBytes(32).toString('hex'), expires = data.expiresDays ? Date.now() + data.expiresDays * 86400000 : null;
    if (current) db().prepare('UPDATE join_links SET token=?,enabled=1,expires_at=?,max_uses=?,uses=0,created_by=?,created_at=? WHERE id=?')
      .run(token, expires, data.maxUses ?? null, actor.userId, new Date().toISOString(), current.id);
    else db().prepare('INSERT INTO join_links(id,tournament_id,token,enabled,expires_at,max_uses,uses,created_by,created_at) VALUES(?,?,?,?,?,?,0,?,?)')
      .run(randomUUID(), tid, token, 1, expires, data.maxUses ?? null, actor.userId, new Date().toISOString());
  } else {
    if (!current) fail('Create a join link first.', 409);
    db().prepare('UPDATE join_links SET enabled=? WHERE id=?').run(data.action === 'enable' ? 1 : 0, current.id);
  }
  db().prepare('INSERT INTO account_access_audit(id,actor_id,target_account_id,username,action,created_at) VALUES(?,?,?,?,?,?)')
    .run(randomUUID(), actor.userId, null, '-', 'join-link-' + data.action, new Date().toISOString());
  return view(one<Link>('SELECT * FROM join_links WHERE tournament_id=?', tid));
}

/** Public sign-up through the shared link: creates the account, its player entry and tournament membership in one step. */
export function joinWithLink(input: {token: string; name: string; username: string; passwordHash: string}): string {
  const connection = db(); connection.exec('BEGIN IMMEDIATE');
  try {
    const link = one<Link>('SELECT * FROM join_links WHERE token=?', input.token);
    if (!link || !link.enabled) fail('This join link is not active. Ask your organizer for a new one.', 400);
    if (link.expires_at !== null && link.expires_at <= Date.now()) fail('This join link has expired. Ask your organizer for a new one.', 400);
    if (link.max_uses !== null && link.uses >= link.max_uses) fail('This join link has reached its limit. Ask your organizer for a new one.', 400);
    const tournament = one<{id: string; owner_id: string; locked_at: string | null}>('SELECT id,owner_id,locked_at FROM tournaments WHERE id=?', link.tournament_id);
    if (!tournament) fail('This tournament no longer exists.', 404);
    if (tournament.locked_at) fail('This tournament is closed to new players.', 409);
    if (one('SELECT username FROM account_usernames WHERE username=?', input.username)) fail('That username is taken. Choose another.', 409);
    if (one('SELECT id FROM community_players WHERE owner_id=? AND name=? COLLATE NOCASE', tournament.owner_id, input.name)) fail('A player with that name already exists. Add something to tell you apart, like a last initial.', 409);
    const accountId = randomUUID(), playerId = randomUUID(), now = new Date().toISOString();
    db().prepare('INSERT INTO accounts(id,email,name,password_hash,owner,created_at) VALUES(?,?,?,?,0,?)').run(accountId, '', input.name, input.passwordHash, now);
    db().prepare('INSERT INTO community_players(id,owner_id,name,created_at) VALUES(?,?,?,?)').run(playerId, tournament.owner_id, input.name, now);
    db().prepare('INSERT INTO account_usernames(username,account_id,player_id,created_at) VALUES(?,?,?,?)').run(input.username, accountId, playerId, now);
    db().prepare("INSERT INTO members(id,tournament_id,user_id,email,name,role,manager_id,player_id,username) VALUES(?,?,?,?,?,'manager',NULL,?,?)")
      .run(randomUUID(), tournament.id, accountId, '', input.name, playerId, input.username);
    db().prepare("INSERT INTO account_participation(account_id,wants,status,answered_at) VALUES(?,1,'active',?)").run(accountId, now);
    db().prepare('UPDATE join_links SET uses=uses+1 WHERE id=?').run(link.id);
    db().prepare('INSERT INTO account_access_audit(id,actor_id,target_account_id,username,action,created_at) VALUES(?,?,?,?,?,?)')
      .run(randomUUID(), tournament.owner_id, accountId, input.username, 'joined-by-link', now);
    connection.exec('COMMIT');
    return accountId;
  } catch (error) {
    if (connection.isTransaction) connection.exec('ROLLBACK');
    if (error instanceof Error && /UNIQUE constraint/.test(error.message)) fail('That username or name is already taken. Choose another.', 409);
    throw error;
  }
}
