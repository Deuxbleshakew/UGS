# Milestone 4B: friendly invitations (Claude, local only)

Status: implemented locally. **Not deployed, not pushed, no production data touched.** Migration `0012_friendlies.sql` is new and must not be applied to production without Max's approval. Chat is **not** in this milestone.

## Scope (brief, section 12)

- **Invite** another eligible player with a proposed time and an optional message.
- **Respond:** the player whose turn it is can accept, decline or counter-propose. Either side can cancel (a pending invitation, or an accepted one that has not started).
- **Upcoming / needs your answer / history** views, with a per-invitation history of events.
- **Expired** status: a pending invitation whose time passes becomes expired (applied lazily and logged as "System").
- **No self-invitations**, and **no duplicate pending request** between the same two people (either direction). Both are enforced by the server and by the database.
- **Not fixtures.** Nothing here touches fixtures, Elo, standings, qualification, awards, club assignments, results or proof. A test confirms the fixtures table is unchanged.
- **Private.** Only the two participants can see or act on an invitation or its history. Every read and write is filtered by the caller's account. There is no owner or admin access to anyone's friendlies.

## Eligibility

A person can send or receive friendlies if they are the owner, or a participant (a `manager`/`participant` membership) with a finished profile (username, display name, followed team, platform, timezone and gaming IDs). **Viewers cannot take part**, as the brief says. The invite list shows display names only, never usernames or emails.

## Rules chosen (please confirm)

1. **Turn-taking.** An invitation always waits on exactly one person. A counter flips the turn; you cannot accept your own proposal.
2. **Time zones.** As in scheduling: the proposer types local time, the server converts it with their saved profile timezone, UTC is stored, and each person sees their own zone plus UTC. Clock-change gaps and repeats are rejected.
3. **Clashes.** A time is refused if either person already has an accepted friendly or a competitive fixture (matched by the human, not the club) at an overlapping time. The overlap length is the tournament's booking length where one is set; friendly-vs-friendly uses the largest booking length among the two people's tournaments. With no booking length set, only identical start times clash. Checked on invite, counter and accept. The error message is generic so it does not reveal the other person's schedule.
4. **Limit.** At most **10 pending outgoing invitations** per person (`MAX_PENDING_OUT` in `lib/friendlies-server.ts`). This is an abuse limit I chose, not a league rule.
5. **Cancelling an accepted friendly** by either side is allowed until it starts.
6. **Stale protection.** Every invitation has a `version`; every action must send it.

## Files

New:
- `drizzle/0012_friendlies.sql`: `friendly_invitations` (CHECKs for self-invites, proposer/turn consistency, pending-needs-turn; partial unique index for one pending per pair; triggers refusing past times) and an append-only `friendly_events`.
- `lib/friendlies-server.ts`: eligibility, clash check, expiry, actions, `getFriendlies`.
- `app/friendlies.tsx`: the Friendlies page.
- `docs/CLAUDE-FRIENDLIES-HANDOFF.md`: this file.

Modified:
- `lib/server.ts`: `GET/POST /api/friendlies` (after the onboarding gate and the existing same-origin check).
- `lib/scheduling-server.ts`: `overlaps` is now exported (no behaviour change).
- `app/tournament-app.tsx`: renders the page for the Friendlies view.
- `app/ugs-navigation.ts`, `app/ugs-sections.tsx`: Friendlies is no longer marked "Planned".
- `app/ugs-dark.css`: one rule appended.
- `db/schema.ts`, `README.md`: mirror and one paragraph.

Not touched: migrations 0000–0011, auth, tournament routes, matchweeks, scheduling behaviour, Discord, deployment.

## API

- `GET /api/friendlies`: the caller's invitations and events, the people they can invite, and their eligibility.
- `POST /api/friendlies` with `action`:
  - `invite {inviteeId, local, message?}`
  - `accept {id, version}`
  - `decline {id, version, message?}`
  - `counter {id, version, local, message?}`
  - `cancel {id, version, message?}`

## Checks performed

- `tsc --noEmit` passed. `next build --webpack` passed (route list unchanged; the page is part of the existing app shell). The one file skipped by the build check is `components/connector-error.tsx`, because my check copy lacks `components/ui`.
- Isolated temporary-database run, **54 checks, all passed**: eligibility (participant, viewer, incomplete profile, owner needing a timezone); directory contents; invite, counter, accept, decline, cancel; turn enforcement; duplicate pending in both directions; self-invite; outsider cannot see, act on or list another pair's invitation or history; stale versions; past times and clock-change gaps; clash with an accepted friendly and with both people's competitive fixtures, with and without a booking length, including the exact boundary; unrelated players unaffected; lazy expiry and expiry-on-accept; cancel before and after start; the 10-pending limit; database guards (self-invite, duplicate pending, past insert, pending-without-turn, third-party proposer, append-only history); fixtures untouched; integrity and foreign-key checks.
- The earlier scheduling suite (61 checks) still passes against the same code.

## Not checked

No browser or functional testing, no lint, no real-time behaviour (the page loads on open and after each action; there is no live refresh or unread indicator yet).

## Not built (brief says later or not at all)

Chat and unread indicators (next milestone), notifications (including Discord reminders), blocking or reporting a player, and any owner moderation view. You said friendly chats stay private, so no owner access is planned.

## Manual acceptance scenarios (for Max)

1. As player A open Matchroom → Friendlies → Invite a player. Pick B and a future time. B sees it under "Needs your answer" in B's own timezone, with the UTC time.
2. B counters; A sees it; A accepts. Both see it under Upcoming. History shows invited, counter-proposed, accepted.
3. A second invitation between the same two people while one is pending is refused, from either side.
4. A viewer account sees "Viewers cannot take part yet" and no invite form.
5. A player with an unfinished profile is told to finish it first.
6. Book a time that overlaps one of your own matches (or the opponent's): refused. Set a booking length in Scheduling rules and check the overlap window.
7. Cancel a pending invitation and an accepted one. Let a pending one pass its time: it shows as Expired.
8. Create 10 pending invitations: the 11th is refused.
9. Confirm another player cannot see your invitations, and that standings, fixtures and Elo are unchanged after friendlies.
