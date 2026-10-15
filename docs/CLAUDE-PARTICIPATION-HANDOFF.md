# Milestone 4E — participation question (for Codex review)

Not deployed. Adds migration `0015_participation.sql` (one table, `account_participation`, plus a trigger that refuses an owner row). Production now needs 0010–0015 in order. Back up first.

## Behaviour
- No row = never asked; behaves exactly as before. Asked only when: not owner, has a username, never answered, and onboarding is still incomplete. Finished accounts are not interrupted.
- Yes → `wants=1,active` → normal player profile form.
- No → `wants=0` → viewer: only the username is required, no profile form. Saved membership roles are NOT edited; `membership()`, the tournament list, friendlies eligibility and profile requirements all cap the role at viewer while the choice says so (`isViewerByChoice`).
- No → Yes (My Profile) = `pending`: still a viewer until the owner approves in Users & access ("Approve" / "Keep as viewer"). Granting player access through the existing invite form counts as approval (`approveByGrant`).
- Yes → No is immediate and closes the person's open friendlies and withdraws their waiting kickoff proposals (shared helper `closeOpenActivity`, also now used by disable-account).
- The owner is never asked and cannot answer (also enforced by a DB trigger). Disabled accounts cannot answer.
- Audited in `account_access_audit`: participation-yes/no/request/request-cancelled/approved/rejected/approved-by-grant.

## Files
`lib/participation.ts` (new), `lib/user-management.ts` (helper extracted), `lib/profile-server.ts`, `lib/profile.ts`, `lib/server.ts` (`POST /api/participation` before the onboarding gate; `POST /api/accounts/participation` for owner decisions), `lib/friendlies-server.ts`, `lib/account-access.ts`, `app/participation-choice.tsx` (new), `app/my-profile.tsx`, `app/tournament-app.tsx`, `app/user-access.tsx`, `app/ugs-dark.css`, `db/schema.ts`.

## Checks (cloud)
32 database checks for this milestone and the 43 earlier user-management checks all pass. Real built app with curl: gate, bad answer 400, No → viewer role everywhere, friendlies closed to viewers, request → owner sees pending → non-owner cannot decide 403 → approve → profile form required, cross-origin 403, owner 409. Screenshots of the question and the viewer home were checked. Not done: lint, upgrade rehearsal on a copy of production, other browsers.

## Open points for Max
- Wording: the question says "UCL tournament".
- A viewer sees the existing read-only pages plus a note; the "more for followers" content is not built.
