# Milestone: match scheduling and rescheduling (Claude, local only)

Status: implemented locally. **Not deployed, not pushed, no production data touched, no environment variables changed.**
Migration `0011_match_scheduling.sql` is new and must not be applied to the production database without Max's approval.

## Scope (from the brief, section 11, and the handoff)

- **Owner window/deadline is separate from the kickoff.** `fixtures.scheduled` remains the single *accepted* kickoff (UTC ISO). Proposals never change it.
- **Kickoff proposals.** Only the two assigned participants (the managers of the home and away club, or the two players in a player fixture) can propose. The owner is not a side unless they are one of the managers.
- **One active proposal per fixture.** Enforced in the server and by a partial unique index.
- **Opponent response.** Only the assigned opponent can accept, decline or counter-propose. A counter closes the original (`countered`) and opens a new proposal for the original proposer. Chat is not involved.
- **Old kickoff persists** until a replacement is accepted. Decline, withdraw, reject, expiry and supersede all leave it unchanged.
- **Beyond the deadline.** The opponent agrees first; the proposal then waits (`awaiting_owner`). Only the owner can approve or reject, and a reason (3+ characters) is required. A database trigger refuses to mark a beyond-deadline proposal accepted without an owner and a reason.
- **Past times rejected** by the server and by a database trigger.
- **Clash prevention by human, not club.** A club's manager is merged with the player linked to that manager (`player_links`), so one person cannot be booked in two overlapping matches. Checked on propose, counter, accept and approve.
- **Timezones.** Stored as UTC. A proposer types wall-clock time; the server converts it using the proposer's saved profile timezone (not a client-supplied value). Each proposal keeps the entered local time and zone for the history. Everyone sees times in their own profile zone (browser zone if none) with the UTC value beside it. Clock-change gaps and repeats ("does not exist" / "happens twice") are rejected rather than guessed.
- **History.** Append-only `schedule_events` (a trigger blocks update/delete), plus an `audit` row for each event so the existing admin audit export includes it.
- **Stale-request protection.** Every proposal has a `version`; actions must send it. Propose must send the fixture version and the kickoff the proposer saw. Accepting after the kickoff changed closes the proposal as `superseded`. Everything runs in `BEGIN IMMEDIATE`.
- **Expiry.** An active proposal whose time has passed becomes `expired` (applied lazily on any scheduling read/write, logged as "System").
- **No automatic forfeits or administrative results.** Nothing in this milestone touches results.
- **Configurable, undecided values.** Booking duration and season start/end are owner settings with no default (see below).

## Not invented (open decisions for Max)

1. **Booking duration.** Unset by default. While unset, only *identical start times* are detected as clashes (the UI says so). Once the owner sets minutes, two bookings overlap if each starts before the other ends; back-to-back is allowed.
2. **Season dates.** Unset by default (no limit). When set, proposals outside them are refused.
3. **Window opening time.** Stored and shown, but only the *deadline* has a rule attached (as the brief states). Proposals before `opens_at` are not blocked. Decide whether they should be.
4. **Owner who is also a participant.** The owner (Max) can be a side of a fixture and also the approver of beyond-deadline times for it. Currently allowed; say if the approval of his own match should need something else.
5. **Cross-tournament clashes** are not checked (same tournament only).
6. **Future (locked) matchweeks.** Bookings are allowed, per the brief ("tentative until opened"), but the UI does not yet label them tentative.
7. **Direct owner scheduling** (the existing "Organizer · Schedule this fixture" control) is unchanged and still bypasses proposals and clash checks. It now closes any active proposal as `superseded`. Say if it should also require a reason or run the clash check.

## Files

New:
- `drizzle/0011_match_scheduling.sql`: `schedule_settings`, `schedule_windows`, `schedule_proposals`, `schedule_events`, indexes, triggers.
- `lib/timezone.ts`: pure zone conversion/formatting helpers shared by server and browser.
- `lib/scheduling-server.ts`: all rules, transitions, clash check, settings and window changes, `getSchedule`.
- `app/match-scheduling.tsx`: the Kickoff panel in the match dialog (propose, accept, decline, counter, withdraw, owner approve/reject, history).
- `app/schedule-settings.tsx`: owner "Scheduling rules" panel (booking length, season dates, per-matchweek window/deadline), shown in Admin → Tournament setup.
- `docs/CLAUDE-SCHEDULING-HANDOFF.md`: this file.

Modified:
- `lib/server.ts`: import; `GET tournament/:tid/schedule`; `POST tournament/:tid/fixture/:fid/scheduling`; `POST tournament/:tid/schedule/{settings|window}` (owner, behind the existing admin gate); the existing owner `…/schedule` route also closes active proposals and logs it.
- `app/match-report.tsx`: renders the Kickoff panel for participants; takes a `timezone` prop.
- `app/tournament-app.tsx`: passes the profile timezone; renders the settings panel for the owner on the setup view.
- `app/ugs-dark.css`: a few appended rules (dark theme otherwise untouched).
- `db/schema.ts`: Drizzle mirror of the new tables (documentation only).
- `README.md`: one paragraph.

Not touched: migrations 0000–0010, matchweek logic, results/proof/review workflow, auth, Discord, `render.yaml`, deployment, data.

## API

- `GET /api/tournament/:tid/schedule`: settings, windows, and the proposals/events the caller may see (owner: all; manager: own fixtures; viewer: none), plus the caller's side per fixture.
- `POST /api/tournament/:tid/fixture/:fid/scheduling` with `action`:
  - `propose {fixtureVersion, baseKickoff, local, message?}`
  - `accept {proposalId, version}`
  - `decline {proposalId, version, message?}`
  - `counter {proposalId, version, local, message?}`
  - `withdraw {proposalId, version, reason?}` (reason required if the owner withdraws someone else's)
  - `approve` / `reject {proposalId, version, reason}` (owner only)
- `POST /api/tournament/:tid/schedule/settings {version, bookingMinutes|null, seasonStart|null, seasonEnd|null}` (owner)
- `POST /api/tournament/:tid/schedule/window {scope: week|fixture, matchday|fixtureId, version, opensAt|null, deadlineAt|null, reason}` (owner; a reason is required to change an existing window or set a per-fixture override)

All times in requests/responses are UTC ISO strings except `local` (`YYYY-MM-DDTHH:mm`, in the actor's profile timezone).

## Preconditions enforced

Fixture must still be `scheduled` (awaiting its first report); awards must be unlocked; a participant needs a saved timezone; onboarding gate and same-origin checks of the existing router apply unchanged.

## Checks performed

- `tsc --noEmit` (same isolated config as the Discord milestone, now including the new files): passed.
- Isolated temporary-database run (never the app database), 61 checks, all passed: fresh 0000→0011 migration, ledger reopen, integrity and foreign-key checks; propose / counter / accept / decline / withdraw; wrong side, owner-not-a-side, unrelated manager and viewer refused; second active proposal refused; stale version, stale base kickoff and re-accept refused; past times; London/Costa Rica conversion, spring-forward gap; clash with and without a booking length (including the exact boundary) and an unrelated fixture; deadline flow (opponent agreement → owner approval with reason, manager refused, missing reason refused, owner reject); owner direct change superseding an active proposal; lazy expiry; season bounds; visibility per role; awards lock; non-scheduled fixture; database guards (append-only history, duplicate active proposal, past insert, same-side responder, beyond-deadline accept without reason, window ordering, duplicate week window).

## Not checked

No browser or functional testing of the new panels, no production build, no lint, no load/concurrency test across processes (the logic relies on SQLite `BEGIN IMMEDIATE`). Max does the functional testing.

## Manual acceptance scenarios (for Max)

1. As manager A, open a fixture → Kickoff → Propose. Pick a future time. The opponent B sees the proposal in their own timezone and the UTC time.
2. B counters with another time. A sees it; the original is in history as "Counter-proposed". A accepts; both see the new kickoff and `fixtures` shows it.
3. A proposes a reschedule; the old kickoff remains visible until B accepts. B declines; it is unchanged.
4. A past time, or the same time as the accepted one, is refused.
5. Two proposals on one fixture are refused. A stale tab (accept something already answered) shows "already changed".
6. A manager who is in two fixtures cannot book both at overlapping times (identical times until a booking length is set).
7. Owner → Admin → Tournament setup → Scheduling rules: set booking length, season dates, and a week-1 deadline. Changing the deadline later asks for a reason.
8. A proposes a time after the deadline; B agrees; the owner sees Approve/Reject and must give a reason. Until then the old kickoff stays.
9. The owner uses the old direct "Schedule this fixture" control while a proposal is open: the proposal is closed and shown as such.
10. A participant with no timezone cannot propose and is told to set one. A time inside a clock-change gap is refused.
11. A viewer sees accepted kickoffs only and no proposals.
12. Wait past a proposed time with no answer: it shows as expired.
