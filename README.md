# UGS — Union Gaming Society

Union Gaming's community website for phones and PCs. Matchroom contains Club
Champions and the player Elo directory; RB Tiquicia has a separate Pro Clubs page.
Milestone 1 supplies the UGS navigation and branding described below.
Continue using the existing Next.js application and existing Render service.

**Live app: [matchroom-aq2w.onrender.com](https://matchroom-aq2w.onrender.com)**

**Start here: [DEPLOY-RENDER.md](DEPLOY-RENDER.md)** for the exact settings, storage,
organizer login and local run instructions. Source repository:
[Deuxbleshakew/UGS](https://github.com/Deuxbleshakew/UGS).

See [Milestone 1](docs/MILESTONE-1-UGS-SHELL.md) for the branding/navigation scope,
changed files and manual review checklist. My Profile was marked Planned in
Milestone 1. The local Milestone 2B now implements
private profile setup and viewer access; Friendlies, History and Rules & Guide
remain planned. See [Milestone 2B](docs/MILESTONE-2B-VIEWER-ACCESS.md).

Local [Milestone 3A](docs/MILESTONE-3A-MATCHWEEKS.md) adds explicitly enabled
sequential matchweeks, finalized-result progress and owner advancement. It is not
deployed. Participant scheduling proposals and season date windows remain next.

Local Milestone 4A adds an optional Discord connection (link from My Profile, sign in only
to an already-linked account). It is off until Discord credentials are configured and is not
deployed. See [Discord handoff](docs/CLAUDE-DISCORD-HANDOFF.md).

Local Milestone 3B adds match scheduling and rescheduling: kickoff proposals, opponent accept/decline/counter, timezone-aware times, manager-clash prevention, and owner approval for kickoffs beyond the deadline. See `docs/CLAUDE-SCHEDULING-HANDOFF.md`.

Milestone 2A (deployed on 2026-10-14) adds owner-assigned usernames
and private activation with optional email. See
[username access](docs/MILESTONE-2A-USERNAME-ACCESS.md) for migration details and
the pre-release validation details. The live deployment uses commit
`76e4fa8382e5795b415dd148805f80ee54f81bdc`. Milestone 2B is not deployed.

## Included in this first version

- Dashboard, fixtures/results, league table, club/manager statistics and six awards.
- Completed Unity draw imports with manager/pot rules and seed/config-hash history.
- Fixture scheduling, score submission, optional Match Facts and player events.
- Multiple private screenshot originals, previews and protected evidence gallery.
- Opponent confirmation/disputes, organizer review and recorded override reasons.
- Finalized-only standings and awards, award snapshots, review history and CSVs.
- One owner/admin account, owner-only user creation and expiring player activation links.
- Community player directory and lifetime Elo rankings across the organizer's tournaments.
- Elo-seeded player playoffs for 2–128 entrants, with two legs, byes and any qualifying target.
- Aggregate winners, penalties after a tied return leg, round advancement and qualifier CSVs.

See [PLAYER-PLAYOFFS.md](docs/PLAYER-PLAYOFFS.md) for player setup, seeding and Elo rules.

## First use

1. Configure the service using DEPLOY-RENDER.md, then sign in.
2. Create a tournament; import your configuration and completed manager draw.
3. Import the completed league draw, or schedule matches manually.
4. Open each imported fixture to assign a matchday and optional date. Unity
   pairings contain no calendar and initially use matchday 1.
5. Open Admin → Tournament setup → Users & access. In the local 2A version, assign existing accounts their usernames, or create/select a player and reserve a username (email is optional). Share the username and private activation link so the player can set their own password. Existing accounts retain email login until a username is assigned. These changes are not yet deployed.
6. Participants submit score proof, opponents confirm/dispute, and the organizer
   finalizes. Only finalized records count toward official statistics.

The starting configuration was copied from your Unity project's StreamingAssets.
It contains 36 clubs, 12 managers and **3 pots** and has no invented results. Unity
files, including Claude's engine, have not been modified.

## Main files

- `app/tournament-app.tsx`, `views.tsx`, `setup.tsx`: dashboard and navigation.
- `app/match-report.tsx`, `workspace-dialog.tsx`, `ui.tsx`: reporting, evidence and scheduling.
- `app/user-access.tsx`: owner-only account creation, activation links and player access.
- `app/sign-in.tsx`, `lib/auth.ts`: login, invitation activation and sessions.
- `lib/server.ts`, `lib/domain.ts`: authorization, reviews, imports and calculations.
- `lib/storage.ts`, `scripts/local-store.mjs`: SQLite transactions and private files.
- `scripts/render-server.mjs`, `scripts/prepare-render.mjs`: migrations, account bootstrap and startup.
- `db/schema.ts`, `drizzle/`: database schema and versioned migrations.
- `data/draw-config.json`: starting club configuration.
- `.env.example`, `.node-version`, `render.yaml`: Render settings (no secrets).

Only the owner account can administer its tournaments, regardless of a saved membership role. A database constraint allows only one owner account. Other accounts are players; there is no public registration or promotion endpoint.

The deployment source uses the standard Next.js dev/build/start workflow.

## Current limits

No OCR, club-based multi-round knockout brackets, custom award formulas or live Unity sync.
The new two-leg playoffs are for human players and have their own standings;
qualifiers are exported for main-event setup rather than automatically replacing Unity managers.
Finalized reports cannot yet be reopened. Player names/events are manual; keep
spelling consistent. Club badges are monograms. League ties use points, goal
difference and goals scored, then alphabetical display order without determining
qualification. Awards display their calculation/tie rules. Account recovery and
membership revocation screens remain to be built.

The production build and TypeScript compilation passed on Render. The deployed
health endpoint returned HTTP 200 with `status: ok`, and the sign-in page loads.
No functional tests were run, per your instruction.
