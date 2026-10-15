# Deploy handoff (for Codex / GPT)

Max asked for this to be deployed to Render. Claude has no GitHub or Render access, so this is a checklist for whoever does have it. Read `DEPLOY-RENDER.md` first for service settings. Automatic deploys are OFF; deploy manually.

## What is going out
Everything since the last deployed commit `61a58258…`: Discord links, match scheduling, friendlies, profile pictures, user management, participation, team vote playoff (manual EA FC score entry), squad builder with EA FC tactic codes, early-open switch for squads, league table "Last 5", Rules & Guide, History, knockout bracket tab, matchweek grouping in fixtures, automatic player-qualification advancing, Elo only for real players (qualification needs more than 13), player-playoff removal, club stars weighting Elo, Matchroom renamed to UCL in the interface.

## Migrations
Production needs **0010–0019** (all in `drizzle/`). The runner is checksummed; do not edit an applied file. 0019 is `club_stars`. They run on startup.

## Order of operations
1. **Back up the production SQLite first** (the persistent disk at `/var/data/matchroom`): copy `matchroom.sqlite` plus any `-wal`/`-shm`, or `VACUUM INTO` a dated file on the disk. Confirm the copy opens.
2. Review the diff, then commit and push the application changes to `Deuxbleshakew/UGS`.
3. In Render, run **Manual Deploy** of the new commit. Build is `npm ci --include=dev && npm run build`; start is `npm start`. Watch the logs for the migration lines 0010–0019 and for any checksum error.
4. Check `/api/health` returns `{"status":"ok"}`.

## Smoke test after deploy
Sign in as the organizer, then: league table shows the Last 5 column; Clubs & managers shows no managers until the draw; Rules & Guide, History and the knockout bracket open; Fixtures are grouped by matchweek; Squad builder opens (locked until the draw unless opened early); Team playoffs lets the organizer create a playoff and enter a tie score; Clubs tab lets the organizer set stars; Players (Elo) lists only real players.

## Rollback
Redeploy the previous commit and restore the backup file over `matchroom.sqlite` (stop the service first). Migrations only add tables/columns, so the old code ignores them, but restore the backup if data was written that you want gone.

## Known gaps (do not claim these are verified)
- Everything was type-checked, built, and tested with scripted database tests and local screenshots. None of it ran on the live site.
- EA FC tactic codes: the encoder matches the recorded FUTBIN examples; whether EA FC itself accepts the generated codes has not been tested in-game (`jQ?h5nzptf@j` is the first one to try).
- Team playoff results cannot be edited once saved (cancel and recreate).
- Cancelled player-playoff fixtures stay in the database with status `cancelled` and are hidden everywhere.
