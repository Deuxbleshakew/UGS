# Deploy Matchroom to Render

This version runs Next.js as a standard Node web service. It no longer requires
Sites hosting, Cloudflare Workers, D1, R2 or ChatGPT authentication. The React
interface, draw imports, verification rules and SQLite schema are preserved.

## Deployment source

The source is maintained in [Deuxbleshakew/UGS](https://github.com/Deuxbleshakew/UGS).
The Blueprint creates one web service with a 1 GB persistent disk. Enter the
organizer email in Render when applying it; the organizer password is generated
there. Neither credential belongs in the source repository.

## Live deployment

- App: https://matchroom-aq2w.onrender.com
- Service: https://dashboard.render.com/web/srv-db6r0a8n74is738m88ag
- Organizer credentials: https://dashboard.render.com/web/srv-db6r0a8n74is738m88ag/env
- Blueprint: https://dashboard.render.com/blueprint/exs-db6r03uk1f9s73b7e3cg
- Deployed application commit: `61a5825890f679f192d096cc814c8c8b025a8a14`.

Render completed the production build and TypeScript compilation. Deployment is
live; `/api/health` returned HTTP 200 with `{"status":"ok"}`. The sign-in page
loads. No functional tests were run. The service has the approved 1 GB disk at
`/var/data` and the 0.5c-512mb compute plan. Automatic app deploys are off; deploy
manually from Render after pushing application changes.

## App service settings

Create a new **Node Web Service** for Matchroom using the approved 0.5c-512mb plan and 1 GB disk.

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Node version | 24.18.1 (`.node-version`) |
| Root directory | Directory containing this app's `package.json`; blank when this folder is the repository root |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |
| Persistent disk mount | `/var/data` |
| Instances | One (SQLite and the disk are local to this service) |

The Render service must have access to the repository containing these files.
Use the repository root as the service root.

Set these variables in Render's environment settings:

- `NODE_ENV=production`
- `APP_ORIGIN=https://<actual-custom-domain>` only if using a custom domain; otherwise the app uses Render's injected RENDER_EXTERNAL_URL.
- `MATCHROOM_DATA_DIR=/var/data/matchroom`
- `MATCHROOM_OWNER_EMAIL=<your sign-in email>`
- `MATCHROOM_OWNER_NAME=Max`
- `MATCHROOM_OWNER_PASSWORD=<a private password of 12–200 characters>`

The Blueprint generates a random organizer password in Render. Retrieve it from the new service's environment settings for first login; never commit it or paste it in chat. For a manual service setup, enter a private password directly in Render instead.
The owner account is created once on first startup. Subsequent starts do not
overwrite its password. There is no public registration or default password.

**Persistent storage must be configured before accepting results.** Render's
normal filesystem is ephemeral. This implementation stores both the SQLite
database and original screenshots under `MATCHROOM_DATA_DIR`, on the persistent
disk. If the current service has no disk, attaching one can require a paid plan;
the confirmed plan and 1 GB disk are already approved for this new service. If you already have Postgres
and prefer to use it, adapt the storage adapter before deployment rather than
setting a DATABASE_URL that this version does not use.

Startup applies only new, checksummed SQL migrations from `drizzle/`, then starts
Next on `0.0.0.0:$PORT`. No migration runs during the build, because Render disks
are available only at runtime. Applied migration files must not be edited.

## Manager access

1. Sign in with your organizer credentials and create/import the tournament.
2. In Tournament setup, authorize a manager's email.
3. Copy the displayed private activation link and share it directly with that
   manager. No message is sent automatically.
4. The manager chooses a password. The link expires after 72 hours and can be
   used once. Reauthorizing the same manager/email replaces an unused link.
5. Existing accounts sign in with their existing password.

Session tokens and invitation tokens are stored only as hashes. Passwords use
scrypt with a random salt. Production session cookies are secure, HTTP-only and
SameSite=Lax. Write requests check APP_ORIGIN, account creation requires an
invitation, and tournament/proof authorization remains server-side. Screenshot
files are outside public assets and are served only to authorized participants.

## Local development

Copy `.env.example` to `.env.local`, fill in your private organizer email and
password, then run:

```powershell
npm ci --include=dev
npm run dev
```

Open `http://localhost:5173`. Local data goes into ignored `.data/`. On this Codex
Windows sandbox, native canonical-path operations may still block the Next build
or server; the code is intended to run normally on Render's Linux environment.

For an ordinary local production run, set NODE_ENV, an HTTPS APP_ORIGIN and an
absolute MATCHROOM_DATA_DIR as above, then `npm run build` and `npm start`.

## Operations and limits

- Keep the disk attached across deploys. Deleting it deletes records/uploads.
- Back up SQLite using SQLite's online-backup facilities and preserve the proof
  directory alongside it. Do not copy only the active `.sqlite` file while WAL
  writes are in progress.
- This deployment is for one server instance. Postgres/object storage is a later
  adaptation if horizontal scaling is needed.
- The Sites/D1 development database was not migrated. The registered Site was
  never published. Do not interpret the starting club list as match history.
- Account recovery/password reset and membership revocation screens are not yet
  implemented. Existing-account credentials must be managed deliberately through
  a later recovery/admin workflow; changing the bootstrap password env variable
  does not reset a saved password.

References: [Render Next.js deployment](https://render.com/docs/deploy-nextjs-app),
[persistent disks](https://render.com/docs/disks),
[Node versions](https://render.com/docs/node-version).
