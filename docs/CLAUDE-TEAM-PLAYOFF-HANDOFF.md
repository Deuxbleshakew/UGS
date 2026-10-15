# Team vote playoff (milestone 4F, migration 0016)

Simulated pre-qualification for the club list. Separate from the player (Elo) playoffs, which only apply when there are more than 12 players.

## What it does
- The organizer creates a playoff from the final vote order (27 teams prefilled from the community sheet in `lib/team-vote-data.ts`; default 5 direct places, so 22 teams = 11 ties, 16 qualify).
- Ties pair best against worst of the playoff teams. Two legs: the lower seed hosts leg 1, the higher seed hosts leg 2. Level aggregate goes to penalties (5 kicks each, then sudden death). No away-goals rule.
- "Run simulation" works once (seeded, deterministic, seed shown afterwards). Results are locked by a database trigger. To redo it: cancel with a reason (3+ characters), then create a new one.
- Everyone in the tournament can read it; only the owner can create, simulate or cancel. All actions are audited.

## Files
`drizzle/0016_team_playoffs.sql`, `lib/team-playoffs.ts`, `lib/team-sim.ts`, `lib/team-vote-data.ts`, `app/team-playoffs.tsx`, routes in `lib/server.ts` (`/api/tournament/:tid/team-playoffs[/simulate|/cancel]`), view `teamplayoffs` in `app/ugs-navigation.ts`.

## Not done
The 16 qualifiers are not yet wired into the tournament's club list (`data/draw-config.json` is unchanged). Needs the organizer's decision on how many teams the tournament has and whether they replace or add to the 36 clubs.

## Deploy
Production needs migrations 0010 to 0016. Back up the database first.
