# Milestone 1 — UGS branding and navigation

14 October 2026. Approved by Max after the read-only baseline proposal.
Implemented first in the local workspace. Max separately authorized publication
and deployment on 14 October 2026. The implementation review below records the
checks before deployment; deployment status is reported separately by Render.

## Exact scope

- UGS Home with the approved angular initials, community background and links to
  Matchroom and RB Tiquicia. No generated members, statistics or events.
- Matchroom landing page; existing competition screens grouped under Club
  Champions. Players/Elo stays beside the competition inside Matchroom.
- RB Tiquicia landing page with Max's original crest and honest empty roster and
  fixture sections. No club record, roster or Elo relationship is created.
- Owner-only Admin navigation collects the existing review and setup screens.
  Direct links to these views also check the current owner/membership state in
  the UI. Existing server-side authorization remains authoritative and unchanged.
- Rules & Guide, Friendlies, History and My Profile have explicitly labeled
  Planned pages. These are explanatory destinations, not working feature flows.
- Login and activation use the selected UGS identity. Email and password inputs,
  invitation processing and auth requests retain their existing behavior.
- Desktop/mobile navigation, a skip link, visible keyboard focus, Escape to
  close the mobile menu, and hash URLs for navigation/refresh/back/forward.
- The existing tournament selector remains accessible from competition pages,
  the Matchroom landing page and Admin. No-tournament accounts see an empty state
  rather than presenting the starter roster as their active competition.

## Changed files

Modified:

- `app/tournament-app.tsx`: UGS shell, grouped navigation, hash navigation,
  owner-view guard, tournament context, existing dialogs/report wiring.
- `app/sign-in.tsx`: UGS presentation on login/activation; form logic retained.
- `app/layout.tsx`: UGS metadata, existing selected PNG favicon and stylesheet.
- `README.md`: current local scope and owner navigation instructions.
- `docs/brand/UGS-FOUNDATION.md`: confirmed hierarchy, asset provenance and tokens.

Added:

- `app/ugs-navigation.ts`: allowlisted views, labels, hierarchy and hash mapping.
- `app/ugs-brand.tsx`: shared lockup using the approved PNG.
- `app/ugs-sections.tsx`: Home, Matchroom, RB Tiquicia, Admin and Planned pages.
- `app/ugs.css`: responsive UGS presentation; semantic result/status colors kept.
- `public/brand/ugs-initials.png`: unchanged copy of the approved source artwork.
- `public/brand/rb-tiquicia.png`: unchanged copy of Max's supplied crest image.
- `docs/MILESTONE-1-UGS-SHELL.md`: this handoff.

## Data, API and migration impact

No new or modified schema, migrations, endpoints, authentication rules, game
rules, ranking calculations or server code. No migration is required.
Existing Next.js routes (`/`, `/login`, `/activate`, `/api/...`) remain in place.
Sections use allowlisted hash fragments within the authenticated root route:

- `/#home`
- `/#matchroom`
- `/#matchroom/club-champions`
- `/#matchroom/club-champions/qualification`
- `/#matchroom/players`
- `/#rb-tiquicia`
- `/#admin/setup`

Unknown fragments fall back to UGS Home. These are client view URLs, not new API
routes or authorization grants. Refresh uses the existing state endpoint and its
default selected tournament, just as before; selection is not stored in the hash.

Existing account IDs, passwords, memberships, player identities, Elo, seeded
playoffs, records, original proof and audit history are preserved. The existing
private access requirement, API membership checks and proof permissions remain.
Persisted tournament names and starter configuration are not renamed by the UGS
navigation. Qualification and Unity main-event import remain separate workflows.

## How Max can run and review locally

Use the existing Node 24 local setup in `DEPLOY-RENDER.md`. From the application
directory run `npm run dev`, then open `http://localhost:5173/` in your browser.
Existing private local environment configuration is required; do not paste
credentials or activation links into chat. Local accounts/data are independent
of production and may not contain the same tournaments. No local server was
started as part of this milestone. No deployment is authorized by these steps.

## Manual acceptance scenarios — for Max, not executed

1. Login/activation: open both screens on phone and desktop. Confirm the existing
   UGS initials and blue/red presentation. Use the existing email/password login;
   privately open a valid activation link and check the existing password flow.
2. Navigation: visit Home → Matchroom → Club Champions → Qualification, Fixtures,
   Players, RB Tiquicia and back. Try refresh and browser Back/Forward. Confirm
   the selected view matches the hash and the current tournament name is shown.
3. Mobile/keyboard: at 360px and 390px widths, open/close the menu, use Escape,
   Tab and the skip link. Confirm no content is obscured or horizontally clipped.
4. Owner: verify Admin → Review queue and Tournament setup, the tournament
   switcher, existing user-access panel, imports and exports remain reachable.
   Use disposable local records for any action that changes data.
5. Participant: verify Admin is absent. Opening `/#admin`, `/#admin/review` and
   `/#admin/setup` should show owner access required, with no owner controls.
   Existing reports/private proof should retain their existing restrictions.
6. Unrelated user: check a fixture/evidence request belonging to another
   tournament using your existing manual process. The server must still deny
   access; navigation is not permission to access a record.
7. Empty account: check an authorized account with no tournaments. Home and
   RB Tiquicia should load; competition pages should explain missing access
   rather than showing the starter roster as live data. Only the owner gets
   create-tournament controls.
8. Planned features: My Profile, Friendlies, History and Rules & Guide should
   explicitly say Planned and offer no simulated save, signup or publication.
9. Existing records: choose your known tournaments. Confirm fixture IDs, recorded
   results, qualification seeds, Elo and private evidence remain as before.
10. Failure state: if the state request fails, verify the error and retry path;
    no fake populated dashboard should appear in place of unavailable data.

Viewer-role enforcement, timezone scheduling changes, lineups, shared evidence,
result replay/correction, matchweek locks and Discord delivery are not part of
this milestone. Their new acceptance scenarios belong with later implementation.
Existing concurrency/version checks are retained, not newly certified here.

## Verification performed and not performed

Performed: source/documentation/schema/authorization inspection; visual inspection
of the supplied image files; pixel sampling for brand colors; manual source
review of navigation, owner guards, API wiring and empty/planned states.

Not performed: functional/browser tests, rendering screenshots of the application,
automated tests, TypeScript compilation, linting, production build, local server
startup or live deployment verification. Max's brief reserves functional testing
for him and asks before other checks when authorization is unclear. This is not
a claim that the runtime or visual acceptance scenarios passed.

## Remaining decisions and limitations

- Username rules and migration, profile requirements and viewer access are next;
  login still requires email. My Profile does not yet edit account details.
- The site remains private. A public organization landing page needs a separate
  access decision.
- Existing three-pot format, extra qualification byes, new/provisional-player
  eligibility and season/calendar policies still need their respective decisions.
- Hash navigation preserves the current single-dashboard architecture. Dedicated
  nested Next.js routes can be considered in a later approved milestone.
- Only existing supplied PNGs are used. The logo favicon is not a bespoke tiny
  icon; a vector master/small-size adaptation remains future brand work.
- Max separately authorized deploying this milestone to the existing Render
  service. That authorization does not extend to implementing later milestones.
