# Milestone 3A — Sequential matchweeks

Implemented locally. Not deployed; the user explicitly requested continued local
work without deployment. No production dates or data were changed.

## Scope

The Fixtures and Overview pages show each league matchweek, finalized/total count,
outstanding count, current week and future locks. Only the owner can activate
controls or explicitly open the next week. Advancement requires every current
fixture to be finalized and a nonempty, immediately following week to exist.
Pending, disputed, correction and unplayed fixtures block advancement. There are
no automatic results, forfeits or advancement.

Controls default to disabled for all existing and new tournaments. Before enabling,
the owner must review the actual calendar using the existing fixture scheduling
controls. Unity imports still default to matchday 1. Activation requires at least
two consecutive nonempty weeks starting at 1, no repeated club in a week, and no
reports/proof already in future weeks. Existing incompatible history is preserved
and activation is rejected rather than reset or reassigned.

Once enabled, the league week assignments are frozen. Adding/deleting league
fixtures or changing their week/stage/kind is blocked. Kickoff timestamps may still
be changed through existing owner scheduling; future bookings are tentative until
the week opens. Calendar corrections/disable controls need a later audited flow;
there is deliberately no silent reset. Qualification rounds and non-league stages
are unaffected by these league locks.

## Files and API

- `drizzle/0009_matchweek_control.sql`: new empty control table and database triggers.
- `db/schema.ts`: control table declaration (custom triggers remain in migration).
- `lib/matchweeks.ts`: response types.
- `lib/matchweeks-server.ts`: summaries, server lock check, atomic activation and advancement.
- `lib/server.ts`: state summary, owner endpoint, result/proof restrictions.
- `app/matchweek-panel.tsx`: progress and owner controls.
- `app/tournament-app.tsx`, `app/ui.tsx`: panel integration, locked-workspace feedback and types.

`POST /api/tournament/:id/matchweeks` accepts `action: enable | advance`, expected
`version`, and `assignmentsReviewed: true` for activation. It checks current owner
authorization, unlocked awards and the latest state inside one SQLite transaction,
records before/after in the tournament audit, and increments the tournament revision.

Migration 0009 rewrites no existing fixtures, results or calendars. Database triggers
also reject future-week proof/result writes, including requests that were in flight
when controls were enabled. Existing profile completion and participant permission
checks remain in force. Applied migrations 0000–0007 remain unchanged; pending
local migrations 0008 and 0009 must accompany their respective code when deployed.

## Checks and manual review

TypeScript compilation passed. Isolated in-memory SQLite checks passed for fresh
and upgrade migration, preserved fixture rows, database integrity/foreign keys,
future proof/result and calendar constraints, and unaffected current/qualification
writes. No functional/browser tests or live data changes were performed.

Manual acceptance: verify default-disabled state after importing Unity; distribute
fixtures across real weeks; reject duplicate clubs/gaps/future history; activate;
view future fixtures without submitting proof/results; verify direct API requests
also fail; ensure pending/disputed/correction results block advancement; finalize
all current fixtures; owner opens next week; reject stale repeated advancement;
ensure empty/final week cannot advance and qualification remains independent.

## Remaining scheduling work

Owner windows/deadlines, participant proposals, accept/decline/counter-proposals,
rescheduling, availability, overlap detection, timezone-aware kickoff entry and
audited deadline exceptions remain a separate next portion. Existing direct owner
scheduling is retained; it does not yet implement those workflows. No season start,
end, holiday break or booking duration has been selected automatically.
