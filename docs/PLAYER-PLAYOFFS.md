# Player Elo and two-leg playoffs

## Organizer workflow

1. Open a tournament, then **Player Elo**. Existing configured managers join the community directory automatically. Add everyone else by display name; no club assignment is required.
2. Use **Tournament setup → Player access** to authorize their email and copy the private activation link. No email is sent by the app.
3. Open **Playoffs → Create playoff**. Select 2–128 entrants and a qualifying target. The default is 12 main-event places: the top 5 Elo seeds qualify directly, and everyone else enters the playoff for the other 7 places. Automatic places are configurable; use 0 and a target of 1 for an outright champion.
4. Elo updates after every finalized match by default, as requested. A per-tie option remains available for other competitions. This choice is saved with the playoff.
5. Review seeds, byes and home/away pairings. Equal Elo is resolved by a reproducible draw; redraw it before creation if needed. Click **Create these fixtures** to commit that preview.
6. Report matches using the existing screenshot, opponent-confirmation and organizer-finalization workflow. Finalize leg 1 before reporting leg 2.
7. When all ties in the current round are finalized, choose **Create next round**, **Confirm qualifiers** or **Confirm champion**. Duplicate advancement requests are rejected.
8. Export qualifiers, then create a main-event tournament and import its Unity roster/draw. Existing club assignments and Unity draw rules are not overwritten.

There is no twelve-player directory cap. The practical bracket limit in this version is 128 entrants per playoff. One playoff can be active per tournament; completed events remain visible.

## Seeding and qualification

- Higher Elo receives the higher seed. Tied Elo uses a recorded seeded draw, never name order.
- Seeds and Elo are frozen when fixtures are created. A concurrent rating change makes creation fail with a refresh message, so the server does not silently change the preview.
- The top 5 seeds qualify directly by default. They are saved separately, never enter playoff fixtures, and receive no Elo bonus.
- The highest remaining playoff seeds receive any necessary bracket byes. Other surviving seeds pair highest versus lowest at each round.
- The next field size is the smaller power of two, unless the selected qualification target is larger. This accommodates non-power-of-two qualification targets.
- Example: 19 entrants qualifying 12 players gives the top 5 seeds direct places; the other 14 play seven ties (14 matches) for the remaining 7 places.
- Uneven playoff fields may require additional bracket byes, shown separately in the preview. For example, 18 total entrants leaves 13 playoff entrants competing for 7 places, requiring one bracket bye plus six two-leg ties.
- The lower seed hosts leg 1; the higher seed hosts leg 2. Every played tie has exactly one home and one away match per player.
- Add both leg scores to determine the winner. No away-goals rule. If the aggregate is tied, include extra-time goals in leg 2 and record deciding penalty scores separately. Shootout kicks are not aggregate goals.
- A bye awards advancement only, never a win or Elo points.

## Elo

The ranking is for the human community players, separate from in-game footballer statistics and the league table.

Everyone starts at **1000**, with **K = 32**. Expected result for player A is `1 / (1 + 10^((ratingB-ratingA)/400))`. Change is `32 × (actual-expected)`, using 1 for a win, 0.5 for a draw and 0 for a loss. The opponent receives the opposite change. No goal-margin multiplier or home advantage is applied.

Only organizer-finalized results are eligible. Club matches contribute to the two clubs' human managers; same-person matchups are excluded. Per-leg playoff Elo uses the individual match score, excluding shootouts. Per-tie Elo counts the completed aggregate winner once, including a penalty-decided winner. Different playoff choices are shown alongside each event.

Ratings are rebuilt from immutable finalized fixture records, so refreshes and duplicate submissions cannot award Elo twice. Calculation order is finalization time, with fixture creation order as a deterministic tie-break; the reported played-on date does not reorder earlier ratings. Six decimal places are retained for calculation; the interface displays one.

Unplayed players display starting Elo and are labelled unrated. Players are provisional until they have five rated results. Equal ratings share a ranking position. **Export Elo** includes every registered player, including those without results.

Player identity is retained through a stable community ID and tournament-manager links. For existing imported manager lists, account/email links take precedence; matching manager IDs and names are reused across the organizer's tournaments. Historical finalized matches are backfilled from their existing fixed assignments. Differently named or differently identified people are not merged solely by display name.

## Implementation and limits

- `lib/competition.ts`: Elo, seeded pairing, aggregates and leg validation.
- `lib/competition-server.ts`: community identity, existing-history backfill, bracket creation and advancement in SQLite transactions.
- `app/competition-views.tsx`, `app/competition.css`: rankings, entrants, seed preview and rounds.
- `lib/server.ts`, `app/ui.tsx`, `app/match-report.tsx`, `app/setup.tsx`: existing reporting and permission integration.
- `drizzle/0004_player_playoffs.sql`: additive player and playoff migration; existing records retained. The fixture uniqueness rule becomes specific to club matches; two-leg identity is protected separately.

Finalized reports remain immutable. There is no player merging, arbitrary imported starting rating, playoff cancellation or automatic qualifier-to-Unity roster replacement in this version. New playoffs do not count toward club or in-game-footballer awards. Dates are scheduled per fixture by the organizer.

Functional testing is left to Max as requested. TypeScript compilation and the production build are tracked in the delivery notes.
