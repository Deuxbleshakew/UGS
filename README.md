# Matchroom — Tournament HQ

Responsive tournament management for phones and PCs. Deployment now targets
**a new Matchroom web service in your Render account**.

**Live app: [matchroom-aq2w.onrender.com](https://matchroom-aq2w.onrender.com)**

**Start here: [DEPLOY-RENDER.md](DEPLOY-RENDER.md)** for the exact settings, storage,
organizer login and local run instructions. Source repository:
[Deuxbleshakew/UGS](https://github.com/Deuxbleshakew/UGS).

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
5. Open Tournament setup → Users & access. Create a user with a display name and email, or choose an existing player. Share their private activation link so they can set their own password.
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
