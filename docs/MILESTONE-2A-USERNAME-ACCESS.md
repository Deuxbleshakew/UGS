# Milestone 2A — Username access

Status: locally implemented; TypeScript and isolated migration checks passed on 2026-10-14.
Not deployed. No production data, credentials or Render settings were changed.
Functional and browser tests were not run, as requested in the implementation brief.

## Behavior

- Only the existing owner can assign usernames, create users or issue activation links.
- Usernames contain 3–24 ASCII letters, numbers or underscores. They are trimmed,
  stored lowercase, case-insensitive and fixed after assignment.
- Existing accounts retain their ID, password and sessions. Email login remains
  available only until the owner assigns a username; subsequent login uses that username.
- New users require a reserved username and private activation link. Email is optional.
- Activation links expire after 72 hours and are stored as hashes. Reissuing a link
  invalidates the previous one. Activation consumes the invitation.
- The owner shares the username and activation link manually. No email is sent.
- Existing valid email invitations remain usable until migrated. Assigning a username
  to a pending invitation replaces the old link and returns a new one.
- Account/player conflicts are rejected rather than merging or replacing history.
- Profile onboarding and viewer roles remain outside this milestone.

## Owner workflow

Open **Admin → Tournament setup → Users & access**. Assign existing accounts their
usernames in the account list. Existing users keep their current password; tell them
their assigned username before their next login.

For new access, create a player or select an existing player, enter the username and
optionally an email. Copy the generated private link and share it with that player.
If an existing player has an old account/invitation without a username, assign it in
the account list first. For an already activated username, granting access uses its
existing account instead of creating another password or invitation.

## Data and API

Only new migration `drizzle/0007_username_access.sql` is added. Earlier migrations
are unchanged. The existing startup migration runner applies it when authorized.

The migration adds `account_usernames` as the central registry for pending and active
usernames, nullable username references on memberships and invitations, and
`account_access_audit` for owner actions. Account and membership email uniqueness
now excludes empty strings, which represent absent email. Email matching explicitly
excludes absent values; optional email never chooses or merges a player identity.

Existing account/player IDs, password hashes, sessions, fixtures, results and Elo
records are retained. No existing account is automatically assigned a username.
Initial owner bootstrap still uses the existing email-based configuration.

- `POST /api/accounts/username`: owner assigns a username using an existing
  `accountId` or pending `memberId`, never both.
- Existing create-user/player-access endpoints now require `username`; `email`
  is optional. Older email-only forms must reload the updated client.
- Login accepts `identifier` (username, or email for unmigrated accounts). The old
  `email` request field remains accepted for transition compatibility.
- Owner state responses include the account directory; player responses do not.

## Changed files

- `lib/account-access.ts`: reservations, assignment, account directory, invitations,
  identity conflict checks and owner audit.
- `lib/auth.ts`: username login and activation, legacy transition.
- `lib/server.ts`: routes and owner-only directory exposure.
- `lib/competition-server.ts`: access helpers moved; blank-email linking guarded.
- `db/schema.ts`, `drizzle/0007_username_access.sql`: additive schema changes.
- `app/sign-in.tsx`, `app/user-access.tsx`, `app/ui.tsx`, `app/ugs.css`: login,
  owner controls and related types/styles.
- `README.md`, this document: usage and handoff.

## Validation and release gate

Source inspection completed. With the owner's approval to check at the end:

- `tsc --noEmit --incremental false` passed.
- The actual migration runner passed on a fresh temporary SQLite database and a
  temporary database seeded through migration 0006 with synthetic records.
- The upgrade preserved existing account/password, session, tournament, player,
  membership, invitation, player-link and finalized-fixture records.
- Foreign-key and integrity checks passed. Duplicate/invalid usernames and invalid
  account references were rejected; multiple accounts and members without email
  were accepted. These constraint writes were rolled back.
- A second startup preserved the migration ledger without reapplying migrations.

No production or local application database was opened by these checks. No functional,
authentication-flow or browser tests were run; these checks do not establish visual
or end-to-end correctness. Do not deploy until the owner separately authorizes deployment.

Suggested manual review after validation approval: owner and player permissions;
existing-account username assignment; retained password/session; legacy email login
before and after assignment; activation with and without email; expiry/reissue;
duplicate usernames with different casing; stable player/Elo links; conflicting
player identities; and repeated startup with the migration already recorded.

Before an authorized production release, preserve a database backup using the
existing deployment procedure. Rolling back application code alone does not undo
the new schema or username-only accounts. Do not remove the registry or substitute
fabricated email addresses to force compatibility with old code.
