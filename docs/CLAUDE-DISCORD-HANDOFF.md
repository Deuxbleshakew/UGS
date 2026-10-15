# Milestone 4A: optional Discord connection (Claude, local only)

Status: implemented locally. **Not deployed, not pushed, no environment variables changed.**
No Discord application credentials exist yet, so the feature stays switched off. It
shows "not set up" until the owner adds credentials on the server.

## Scope

- **Connect.** A signed-in user can connect their Discord identity from My Profile with
  "Connect Discord". This uses the official OAuth2 authorization-code grant with the
  `identify` scope only.
- **Sign in.** "Sign in with Discord" on the login page opens only the UGS account that
  identity is already linked to. Unknown Discord users get a fixed message:
  "not connected to a UGS account". No account, membership, role or session is created
  for them.
- **Disconnect.** Users can disconnect from My Profile. Username/password login is never
  removed or changed.
- **Join UGS Discord.** Signed-in members see this link only if `UGS_DISCORD_INVITE_URL`
  is configured. It accepts only an https `discord.gg` or `discord.com/invite` address.
  Joining the server stays separate from UGS authorization.

## Security properties

| Area | Behaviour |
|---|---|
| Identity key | The stable Discord user ID (a numeric snowflake), never the name or email. The Discord display name is stored only for display. |
| One identity per account | `discord_links.account_id` is the primary key and `discord_user_id` is unique, so one Discord identity can never back two UGS accounts. Both are re-checked inside `BEGIN IMMEDIATE`, and UNIQUE violations map to "already in use". This covers concurrent links. |
| No privilege from Discord | Discord sign-in calls the existing `issueSession`. The owner check, tournament roles, viewer/participant restrictions and the profile-completion gate all apply exactly as after a password login. |
| OAuth state | 32 random bytes. Only the SHA-256 is stored. It expires after 10 minutes and is consumed once (`DELETE … RETURNING` before any other step). A replayed or expired callback is rejected. |
| Login/link CSRF | Each state is bound to a hash of an httpOnly `ugs_discord_oauth` cookie (SameSite=Lax, Secure in production, path `/api/discord`). A callback opened in another browser is rejected. Link states are also bound to the account that started them, and the callback requires the same account to still be signed in. Start requests are POST + JSON + same-origin (the existing `sameOrigin` check). |
| Secrets | `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are read server-side only. The secret is sent only to Discord's token endpoint (HTTP Basic). |
| Discord tokens | Never stored or logged. The access token is used once for `GET /api/v10/users/@me`, then revoked on a best-effort basis. |
| Error messages | The callback redirects with a fixed code (`?discord=linked`, `not_linked`, …), never reflected text. The client maps codes to messages and strips the code from the URL. |
| Abuse limit | Expired states are purged on each start. Starts are refused once 500 states are pending. |
| Audit | `discord_link_audit` records `linked`, `unlinked` and `signed_in` with the account ID, Discord user ID and time. |

## Files changed

New:
- `drizzle/0010_discord_links.sql`: `discord_links`, `discord_oauth_states`, `discord_link_audit`.
- `lib/discord.ts`: config, OAuth start, callback, status, unlink.
- `app/api/discord/[action]/route.ts`: `GET status`, `GET callback`, `POST link`, `POST login`, `POST unlink`.
- `app/discord-connection.tsx`: the My Profile section and the shared result messages.
- `docs/CLAUDE-DISCORD-HANDOFF.md`: this file.

Modified:
- `lib/auth.ts`: `issueSession` is now exported. No behaviour change.
- `app/my-profile.tsx`: renders `<DiscordConnection/>` under the profile form.
- `app/sign-in.tsx`: "Sign in with Discord" button, shown only when configured, plus result messages. The activation page is unchanged.
- `db/schema.ts`: Drizzle mirror of the 0010 tables (documentation; the runtime uses the SQL migration runner).
- `.env.example`: documents the three new variables, with no values.
- `README.md`: one line pointing here.

Not touched: migrations 0000–0009, `render.yaml`, Render settings, deployment, production data.

## API

- `GET /api/discord/status`:
  - Signed out: `{configured}`.
  - Signed in: also `linked: {name, linkedAt} | null` and `inviteUrl`.
  - Owner only: also `redirectUri`, to help with setup.
- `POST /api/discord/link`: signed in only. Returns `{url}` for Discord's consent screen.
- `POST /api/discord/login`: returns `{url}`. Answers 503 when not configured.
- `GET /api/discord/callback`: Discord redirects here, then the user is sent back with a 303:
  - `/?discord=…#profile` for link results;
  - `/login?discord=…` for sign-in failures;
  - `/?discord=signed_in` for a successful sign-in.
- `POST /api/discord/unlink`: signed in only.

## Owner setup (when Max decides to enable it)

1. In the Discord Developer Portal, create an application (or use an existing UGS one).
2. Go to OAuth2 → Redirects and add exactly
   `https://matchroom-aq2w.onrender.com/api/discord/callback`. This must equal
   `APP_ORIGIN + /api/discord/callback`. My Profile shows the exact value to the owner.
3. In Render → Environment, add `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` (as a
   secret). Optionally add `UGS_DISCORD_INVITE_URL`. Never commit them or paste them in chat.
4. Deploy a build that contains migration 0010 (this needs Max's explicit approval). The
   migration only adds tables.

For local development, use `APP_ORIGIN=http://localhost:5173` and register
`http://localhost:5173/api/discord/callback` as an additional redirect.

## Checks performed

- TypeScript: `tsc --noEmit` over `app/**`, `lib/auth.ts`, `lib/discord.ts`, `lib/server.ts`,
  `lib/profile-server.ts` and `db/schema.ts`, run in an isolated copy with `npm ci --ignore-scripts`.
  It passed after one typing fix in `sign-in.tsx`. `components/ui` was not part of this
  run (it was not copied).
- Isolated temporary-database migration checks (never the app database):
  - fresh 0000→0010 and upgrade 0009→0010 both passed;
  - integrity check passed, with no foreign-key violations;
  - the existing owner row was preserved and the checksum ledger reopened cleanly;
  - constraints rejected a duplicate Discord ID, a second link per account, non-numeric or
    short IDs, unknown accounts, mismatched state purpose/account and invalid audit actions;
  - one-time state consumption was confirmed.

## Not checked

No browser or functional tests and no real Discord OAuth round trip (no credentials exist,
and Max does the functional testing). No production build and no lint run.

## Manual acceptance scenarios (for Max)

1. With no credentials set, My Profile says "not set up" and the owner sees the redirect URI.
   The login page shows no Discord button. `POST /api/discord/login` returns 503.
2. Signed in as a participant, Connect Discord → approve. The page returns to My Profile
   "Connected as …". Sign out, then Sign in with Discord opens the same account.
3. A participant with an incomplete profile signs in with Discord. They still land on onboarding.
4. Cancel on Discord's screen. You see "cancelled" and nothing changes.
5. Use a Discord account that isn't connected to sign in. You see "not connected", and no account is created.
6. Connect the same Discord account from a second UGS account. You see "already connected to a different UGS account".
7. Account already linked to Discord A, then try to connect Discord B. You see "disconnect first".
8. Disconnect. Discord sign-in now says "not connected". Password login still works.
9. Start a connect, sign out (or switch account) in another tab, then approve. You see `session_changed` and nothing is linked.
10. Reuse a callback URL (back button or copied link). You see "expired".
11. Open the Discord URL in a different browser. You see "expired".
12. The owner signs in with Discord. Still owner; Discord grants nothing extra. A participant gains no admin access.
13. Profile shows the Join UGS Discord link only when the env var is a valid invite.

## Unresolved, needs owner input

- Should linking or unlinking require re-entering the password? Not implemented; Max to decide.
- Future account revocation must also delete that account's `discord_links` rows and
  sessions. There is no revocation screen yet.
- Discord reminders, server-role sync and the watchroom are out of scope. The link stores
  no roles or guild data.
