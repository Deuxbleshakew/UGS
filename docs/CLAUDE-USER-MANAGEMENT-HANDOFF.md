# Milestone 4D — user management and change password (for Codex review)

Not deployed. Adds migration `0014_user_management.sql` (one table, `account_status`, plus a trigger that refuses to disable an owner account). Production now needs 0010–0014 in order. Back up the database first.

## What changed
- `lib/user-management.ts` (new): `disableAccount`, `enableAccount`, `removeMember`, `isDisabled`. All run in `BEGIN IMMEDIATE` transactions and are owner-only.
- `lib/auth.ts`: `getCurrentUser` ignores disabled accounts; `issueSession` refuses them; login returns 403 "disabled" only after the password verifies (no account enumeration); new `changePassword` (current password required, 12–200 chars, must differ, rate limited per account, ends all other sessions, audited as `change-password`; the password itself is never logged).
- `lib/server.ts`: `POST /api/account/password` (before the profile gate so an unfinished profile can still change a password), `POST /api/accounts/disable|enable`, `POST /api/tournament/:tid/members/remove`.
- `lib/account-access.ts`: directory rows carry `disabled` / `disabledReason`.
- `lib/friendlies-server.ts`: disabled accounts are not eligible (so they leave the friendly directory).
- UI: `app/change-password.tsx` (in My Profile), Disable/Re-enable and Remove buttons with a reason + confirm step in `app/user-access.tsx`.

## Behaviour decisions
- Disable is reversible and keeps everything historical. It does remove: sessions, Discord link (audited as `unlinked`), profile picture, open friendlies (pending or future accepted, with an event), and scheduling proposals the person made that were still waiting (with an event). Re-enable restores sign-in with the same password; the picture and Discord link must be set up again.
- Remove-from-tournament deletes the `members` row only. Fixtures, results, Elo, the community player and the account stay. A full snapshot is written to the tournament `audit` table. Pending activation invitations for that person and tournament are deleted. The response says how many unfinished matches are left without a signed-in participant. The organizer can still schedule/report them. Re-adding uses the existing "grant access" form.
- The organizer cannot be removed; the owner cannot disable themself or any owner account (also enforced by a DB trigger).

## Checks run (cloud, throwaway databases)
- 43 database checks: permissions, validation, reason/confirm required, owner protection (app and trigger), every side effect of disable, history kept, removal snapshot, double actions rejected.
- Real built app with curl: wrong current password 403, too short 400, same password 400, success ends only the other session, old password rejected and new accepted, cross-origin 403, unauthenticated 401, rate limit 429 after repeated failures, disabled user's session 401 and login 403, re-enable works.
- `tsc` and `next build` pass. Not done: browser click-through, lint, upgrade rehearsal on a copy of the production database.

## Left for later (not built)
- Owner-initiated password reset link for someone who forgot their password.
- Permanently deleting an account (disable is the safe path; deletion would also need to remove the avatar row, Discord link and friendly history references).
- Disabling does not withdraw a proposal made by the *opponent* that is waiting on the disabled person; it expires at its deadline or the owner can withdraw it.
