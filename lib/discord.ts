import { cookies } from 'next/headers';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { database } from '@/scripts/local-store.mjs';
import { digest } from '@/scripts/account-crypto.mjs';
import { getCurrentUser, issueSession, sameOrigin } from './auth';

// Optional Discord connection (official OAuth2 authorization code grant, scope `identify`).
// - A Discord identity is linked only by an already signed-in UGS account, from My Profile.
// - Discord sign-in only opens the UGS account that identity is already linked to.
// - Nothing here creates accounts, grants roles or memberships, or matches by name/email.
// - Discord access tokens are used once to read the user ID, then revoked; none are stored.
const AUTHORIZE = 'https://discord.com/oauth2/authorize';
const TOKEN = 'https://discord.com/api/oauth2/token';
const REVOKE = 'https://discord.com/api/oauth2/token/revoke';
const ME = 'https://discord.com/api/v10/users/@me';
const browserCookie = 'ugs_discord_oauth', stateLife = 10 * 60 * 1000, maxPending = 500;

type Config = { clientId: string; clientSecret: string; origin: string; redirectUri: string };
type StateRow = { purpose: 'link' | 'login'; account_id: string | null; browser_hash: string; expires_at: number };

/** The origin this deployment is served from (APP_ORIGIN), if it is a usable OAuth origin. */
function appOrigin(): string | null {
  const raw = process.env.APP_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    return url.protocol === 'https:' || local ? url.origin : null;
  } catch { return null; }
}
/** Discord is enabled only when the owner has configured server-side credentials. */
export function discordConfig(): Config | null {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim(), clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim(), origin = appOrigin();
  if (!clientId || !clientSecret || !origin || !/^\d{15,22}$/.test(clientId)) return null;
  return { clientId, clientSecret, origin, redirectUri: origin + '/api/discord/callback' };
}
/** Optional "Join UGS Discord" invite, accepted only as an https discord.gg / discord.com/invite link. */
function inviteUrl(): string | null {
  const raw = process.env.UGS_DISCORD_INVITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const ok = url.protocol === 'https:' && !url.search && !url.hash &&
      ((url.hostname === 'discord.gg' && /^\/[A-Za-z0-9-]{2,64}$/.test(url.pathname)) ||
       (['discord.com', 'www.discord.com'].includes(url.hostname) && /^\/invite\/[A-Za-z0-9-]{2,64}$/.test(url.pathname)));
    return ok ? url.origin + url.pathname : null;
  } catch { return null; }
}

function reply(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
/** Back to the app with a fixed result code (never reflected text). */
function go(path: string, code: string) {
  const origin = appOrigin() ?? '';
  const [base, hash = ''] = path.split('#');
  return new Response(null, { status: 303, headers: {
    Location: `${origin}${base}?discord=${encodeURIComponent(code)}${hash ? '#' + hash : ''}`,
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
  } });
}
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cookieOptions = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/discord', maxAge });

export async function discordStatus() {
  const user = await getCurrentUser(), config = discordConfig();
  if (!user) return { configured: !!config };
  const link = database().prepare('SELECT discord_name,linked_at FROM discord_links WHERE account_id=?').get(user.userId) as { discord_name: string; linked_at: string } | undefined;
  return {
    configured: !!config,
    linked: link ? { name: link.discord_name, linkedAt: link.linked_at } : null,
    inviteUrl: inviteUrl(),
    // Shown to the owner so the Discord application can be registered with the exact callback.
    redirectUri: user.isOwner ? (appOrigin() ? appOrigin() + '/api/discord/callback' : null) : undefined,
  };
}

async function start(purpose: 'link' | 'login', accountId: string | null) {
  const config = discordConfig();
  if (!config) return reply({ error: 'Discord connection is not set up yet. Use your username and password.' }, 503);
  const db = database(), now = Date.now();
  const state = randomBytes(32).toString('base64url'), nonce = randomBytes(32).toString('base64url');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM discord_oauth_states WHERE expires_at<=?').run(now);
    const pending = (db.prepare('SELECT count(*) AS n FROM discord_oauth_states').get() as { n: number }).n;
    if (pending >= maxPending) { db.exec('ROLLBACK'); return reply({ error: 'Too many Discord requests right now. Please wait a few minutes.' }, 429); }
    db.prepare('INSERT INTO discord_oauth_states(state_hash,purpose,account_id,browser_hash,expires_at) VALUES(?,?,?,?,?)')
      .run(digest(state), purpose, accountId, digest(nonce), now + stateLife);
    db.exec('COMMIT');
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  // Binds the state to this browser: a callback opened in any other browser is rejected (login/link CSRF).
  (await cookies()).set(browserCookie, nonce, cookieOptions(stateLife / 1000));
  const url = new URL(AUTHORIZE);
  url.search = new URLSearchParams({
    response_type: 'code', client_id: config.clientId, scope: 'identify', redirect_uri: config.redirectUri, state,
    ...(purpose === 'link' ? { prompt: 'consent' } : {}),
  }).toString();
  return reply({ url: url.toString() });
}

async function identify(config: Config, code: string): Promise<{ id: string; name: string }> {
  const basic = 'Basic ' + Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString('base64');
  const tokenResponse = await fetch(TOKEN, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', Authorization: basic },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: config.redirectUri }),
  });
  if (!tokenResponse.ok) throw new Error('Discord token exchange returned ' + tokenResponse.status);
  const token = z.object({ access_token: z.string().min(1).max(512), token_type: z.string() }).parse(await tokenResponse.json());
  if (token.token_type.toLowerCase() !== 'bearer') throw new Error('Unexpected Discord token type');
  try {
    const me = await fetch(ME, { redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Authorization: 'Bearer ' + token.access_token, Accept: 'application/json' } });
    if (!me.ok) throw new Error('Discord user lookup returned ' + me.status);
    const user = z.object({ id: z.string().regex(/^\d{15,22}$/), username: z.string().min(1).max(64), global_name: z.string().max(64).nullish() }).parse(await me.json());
    return { id: user.id, name: (user.global_name?.trim() || user.username).slice(0, 64) };
  } finally {
    // Best effort: the token was only needed for this one lookup.
    void fetch(REVOKE, { method: 'POST', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic },
      body: new URLSearchParams({ token: token.access_token, token_type_hint: 'access_token' }) }).catch(() => undefined);
  }
}

async function callback(request: Request) {
  const config = discordConfig();
  if (!config) return go('/login', 'unavailable');
  const params = new URL(request.url).searchParams;
  const state = params.get('state') ?? '', code = params.get('code') ?? '';
  const jar = await cookies(), nonce = jar.get(browserCookie)?.value ?? '';
  jar.set(browserCookie, '', cookieOptions(0));
  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) return go('/login', 'expired');
  const db = database();
  // One-time use: the state row is consumed atomically, even when the rest fails.
  const row = db.prepare('DELETE FROM discord_oauth_states WHERE state_hash=? RETURNING purpose,account_id,browser_hash,expires_at').get(digest(state)) as StateRow | undefined;
  if (!row) return go('/login', 'expired');
  const home = row.purpose === 'link' ? '/#profile' : '/login';
  if (row.expires_at <= Date.now() || !nonce || !sameHash(digest(nonce), row.browser_hash)) return go(home, 'expired');
  if (params.get('error')) return go(home, 'cancelled');
  if (!/^[A-Za-z0-9]{10,128}$/.test(code)) return go(home, 'failed');

  // Linking: the browser must still be signed in as the account that started the link.
  const user = row.purpose === 'link' ? await getCurrentUser() : null;
  if (row.purpose === 'link' && (!user || user.userId !== row.account_id)) return go('/login', 'session_changed');

  let identity: { id: string; name: string };
  try { identity = await identify(config, code); }
  catch (error) { console.error('Discord OAuth failed', error instanceof Error ? error.message : 'Unknown error'); return go(home, 'failed'); }
  const at = new Date().toISOString();

  if (row.purpose === 'link') {
    db.exec('BEGIN IMMEDIATE');
    try {
      // Re-check inside the write lock so concurrent links cannot both succeed.
      if (!db.prepare('SELECT id FROM accounts WHERE id=?').get(row.account_id)) { db.exec('ROLLBACK'); return go('/login', 'session_changed'); }
      const holder = db.prepare('SELECT account_id FROM discord_links WHERE discord_user_id=?').get(identity.id) as { account_id: string } | undefined;
      if (holder && holder.account_id !== row.account_id) { db.exec('ROLLBACK'); return go(home, 'in_use'); }
      const mine = db.prepare('SELECT discord_user_id FROM discord_links WHERE account_id=?').get(row.account_id) as { discord_user_id: string } | undefined;
      if (mine && mine.discord_user_id !== identity.id) { db.exec('ROLLBACK'); return go(home, 'already_linked'); }
      if (mine) db.prepare('UPDATE discord_links SET discord_name=? WHERE account_id=?').run(identity.name, row.account_id);
      else {
        db.prepare('INSERT INTO discord_links(account_id,discord_user_id,discord_name,linked_at) VALUES(?,?,?,?)').run(row.account_id, identity.id, identity.name, at);
        db.prepare('INSERT INTO discord_link_audit(id,account_id,discord_user_id,action,created_at) VALUES(?,?,?,?,?)').run(randomUUID(), row.account_id, identity.id, 'linked', at);
      }
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      if (error instanceof Error && /UNIQUE constraint/.test(error.message)) return go(home, 'in_use');
      throw error;
    }
    return go(home, 'linked');
  }

  // Sign-in: only an identity that an authorized account linked earlier. Never create or match accounts.
  const link = db.prepare('SELECT l.account_id FROM discord_links l JOIN accounts a ON a.id=l.account_id WHERE l.discord_user_id=?').get(identity.id) as { account_id: string } | undefined;
  if (!link) return go('/login', 'not_linked');
  db.prepare('UPDATE discord_links SET discord_name=? WHERE account_id=?').run(identity.name, link.account_id);
  db.prepare('INSERT INTO discord_link_audit(id,account_id,discord_user_id,action,created_at) VALUES(?,?,?,?,?)').run(randomUUID(), link.account_id, identity.id, 'signed_in', at);
  // The normal session; profile completion and every permission check still apply after this.
  await issueSession(link.account_id);
  return go('/', 'signed_in');
}

async function unlink() {
  const user = await getCurrentUser();
  if (!user) return reply({ error: 'Sign in first.' }, 401);
  const db = database();
  const removed = db.prepare('DELETE FROM discord_links WHERE account_id=? RETURNING discord_user_id').get(user.userId) as { discord_user_id: string } | undefined;
  if (removed) db.prepare('INSERT INTO discord_link_audit(id,account_id,discord_user_id,action,created_at) VALUES(?,?,?,?,?)').run(randomUUID(), user.userId, removed.discord_user_id, 'unlinked', new Date().toISOString());
  return reply({ ok: true, linked: null });
}

export async function discordRoute(request: Request, action: string): Promise<Response> {
  if (request.method === 'GET') {
    if (action === 'callback') return callback(request);
    if (action === 'status') return reply(await discordStatus());
    return reply({ error: 'Not found.' }, 404);
  }
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  // State-changing requests must come from this site's own pages as JSON.
  if (!sameOrigin(request) || !request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'Reload the page and try again.' }, 403);
  if (action === 'login') return start('login', null);
  if (action === 'link') {
    const user = await getCurrentUser();
    if (!user) return reply({ error: 'Sign in before connecting Discord.' }, 401);
    return start('link', user.userId);
  }
  if (action === 'unlink') return unlink();
  return reply({ error: 'Not found.' }, 404);
}
