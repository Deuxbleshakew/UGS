# Milestone 4C: profile pictures (Claude, local only)

Status: implemented locally. **Not deployed, not pushed, no production data touched.** Migration `0013_profile_avatars.sql` is new and adds one table; do not apply it to production without Max's approval.

## What it does

- **My Profile → Profile picture.** Choose a JPEG, PNG or WebP. The browser centre-crops it to a square, resizes to 256x256 and re-encodes as JPEG (this also drops camera metadata), shows a preview, then uploads on Save. Remove deletes it. Without a picture, initials are shown.
- **Where it shows:** My Profile, and next to the other player on friendly invitations. Other places can use the same `Avatar` component later.
- **Who can see it:** any signed-in member. Pictures are not public: the image endpoint needs a session.
- **Optional.** Nothing requires a picture, and onboarding does not depend on it.

## Server rules (the browser is not trusted)

| Rule | Behaviour |
|---|---|
| File type | The real file signature and header are read. Only plain JPEG, PNG and still WebP are accepted. SVG, GIF, animated WebP, truncated and renamed files are refused. |
| Size | Upload at most 1 MB; stored at most 512 KB (also a database CHECK). |
| Pixels | 16 to 1024 pixels per side, read from the header (also a database CHECK). |
| Ownership | An account can only write or delete its own picture (the account comes from the session, never from the request). |
| Rapid changes | A new upload within 10 seconds of the last one is refused (429). |
| Same-origin | Upload and delete use the existing same-origin check; a cross-origin upload was refused (403) in testing. |
| Serving | `Content-Type` from the stored type, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`, `Cross-Origin-Resource-Policy: same-origin`, `Cache-Control: private, no-cache` with an ETag (a changed picture shows at once, unchanged ones return 304). |

## API

- `GET /api/avatar`: your picture's info (`hasAvatar`, `version`, size).
- `POST /api/avatar` (multipart `file`): save your picture.
- `DELETE /api/avatar`: remove your picture.
- `GET /api/avatar/<accountId>`: the image, signed-in members only (404 if none).
- `GET /api/friendlies` now also returns `otherId` and `otherAvatar` on each invitation.

## Files

New: `drizzle/0013_profile_avatars.sql`, `lib/avatar-server.ts`, `app/avatar-picker.tsx`, `docs/CLAUDE-AVATAR-HANDOFF.md`.
Modified: `lib/server.ts` (avatar routes before the onboarding gate), `lib/friendlies-server.ts`, `app/friendlies.tsx`, `app/my-profile.tsx`, `app/tournament-app.tsx` (passes `userId`), `app/ugs-dark.css`, `db/schema.ts`, `README.md`.
Not touched: migrations 0000-0012, auth, permissions, tournament routes, deployment.

## Checks performed

- `tsc --noEmit` and `next build --webpack` passed.
- 30 checks on a throwaway database with real JPEG (baseline and progressive), PNG (with alpha), lossy and lossless WebP files generated with PIL: sizes read correctly; SVG, GIF, animated WebP, fake PNG, empty and truncated files refused; oversize pixels and bytes refused; save, replace (version bump), cooldown, remove; database CHECKs and foreign key.
- A real run of the built app (temporary data folder, test sessions): no session gets 401; SVG refused; cross-origin upload refused (403); JPEG saved; another member fetched identical bytes with the headers above; the conditional request returned 304; missing picture returned 404; cooldown returned 429; another account's delete did not touch the picture; own delete worked.

## Not checked

The browser crop/preview UI was type-checked but not clicked through. No lint.

## Decisions for Max

1. **Visibility:** all signed-in members can see everyone's picture. Say if it should be limited (for example, to people sharing a tournament).
2. **Account removal:** when user removal is built, it must delete this row (it has a foreign key to accounts, so removing an account is blocked until it does).
3. **Moderation:** there is no report or owner-review tool for pictures yet, so the owner can't remove another person's picture today.
