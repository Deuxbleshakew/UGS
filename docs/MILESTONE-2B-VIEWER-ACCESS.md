# Milestone 2B — Viewer access, local portion

Status: implemented locally, not deployed. Profile onboarding is now included;
the owner confirmed EA ID for PC and Xbox. No production changes were made.

## Scope

Owner-only viewer invitation form in Users & access. A new viewer receives a private
72-hour activation link using the existing username registry. An existing account
can receive viewer access to another tournament using its assigned username and
existing password. No player record is created for viewer access. An existing
participant membership is never silently downgraded. Roles are per tournament.

Viewers can read authorized tournament fixtures, official results, rankings,
standings and awards. They cannot report matches, upload/read/delete private proof,
schedule fixtures or administer tournaments. In-progress reports remain hidden.
Unknown saved roles fail closed as viewers. Only the actual owner is admin.

This does not implement role conversion, participation requests, friendlies or
public profile directories. Profile onboarding and server completion gates are
included as described below.

## Files / API

- `lib/access-policy.ts`: centralized effective-role policy.
- `lib/server.ts`: effective membership roles, fixture authorization and viewer route.
- `lib/account-access.ts`: atomic viewer reservation/membership, existing invitation
  protections, global owner-action audit; no rated-player creation.
- `app/viewer-access.tsx`: owner invitation form and private link display.
- `app/user-access.tsx`: viewer form integration and role labels.
- `app/tournament-app.tsx`, `app/match-report.tsx`: read-only viewer presentation.

New endpoint: `POST /api/tournament/:id/viewers` with `name` and `username`.
It requires owner administration of the tournament. Existing schema stores viewer
membership roles and nullable player IDs, so no migration is needed.

Existing account IDs, player records, passwords, invitations, results and Elo are
not rewritten. Granting a pending username reissues its activation link, as in 2A.

## Verification

TypeScript compilation passed. Source review confirmed all fixture/proof endpoints
share server participant checks and viewer creation is behind owner authorization.
No functional or browser tests were run. End-to-end behavior is not verified.

Manual acceptance: create a viewer without a player record; activate; inspect its
authorized tournament; check finalized results; verify direct proof/report/admin
requests are denied; confirm another tournament is inaccessible until separately
authorized; reuse an existing participant username as a viewer in another event;
ensure existing participant assignments and Elo remain unchanged; verify expired
and replaced activation links cannot activate.

## Profile onboarding

The brief specifies display name, assigned username, one or more followed teams,
an optional primary favorite selected from those teams, and distinct football versus
community Clubs team choices. Participants also need platforms, a valid timezone
and self-reported identifiers: PlayStation Online ID for PlayStation; EA ID for PC
or Xbox. Viewers may optionally save gaming details. These IDs are not verified
against external accounts and are not exposed in the tournament state for others.

All non-owner accounts with missing required fields receive only onboarding and
logout access. The state response contains their own profile and no tournament
data until complete. Every tournament/proof endpoint checks completion before
proceeding. The owner bypasses the gate and keeps administration available.
Existing accounts retain sessions/history while filling missing fields; accounts
without usernames must have one assigned by the owner to complete onboarding.

Profiles allow saving incomplete details. Completion is computed on each request
using the current username and participant memberships, so stale client state cannot
bypass the gate. Saves use an expected version to reject concurrent overwrites.
Updating display name affects the account only, preserving historical player names.

Additional changed files:
- `lib/profile.ts`: shared profile validation and completion rules.
- `lib/profile-server.ts`: private account profile reads and versioned saves.
- `drizzle/0008_account_profiles.sql`, `db/schema.ts`: additive profile table.
- `app/my-profile.tsx`: onboarding and editable My Profile, searchable team choices,
  custom team entry, primary favorite and gaming/timezone fields.
- `app/ui.tsx`, `app/ugs-navigation.ts`, `app/ugs.css`: state types, navigation and layout.
- `lib/server.ts`, `app/tournament-app.tsx`: API completion gate and onboarding screen.

New `GET /api/profile` and `POST /api/profile` operate only on the authenticated
account. POST accepts `{data, version}`. No client-provided account ID is accepted.
Migration 0008 creates an empty profile table and rewrites no existing records.
No existing favorite-team storage was found to migrate. Team following does not
change tournament entries, club assignments, results, player identities or Elo.

Final checks: TypeScript passed. Fresh and upgrade temporary databases passed the
actual migration runner, integrity/foreign-key checks, identity/password/session
preservation checks and repeated startup. No functional/browser tests were run.

Additional manual acceptance: activate a viewer and a participant; verify missing
fields block direct tournament/proof requests; complete required fields; check PC,
Xbox and combined-platform ID requirements; save/reload followed teams; reject
duplicate teams and a primary favorite outside the selection; verify an invalid
timezone and a stale save are rejected; verify legacy accounts and the owner keep
their IDs/passwords and the owner can always open administration.
