# Local Supabase preparation

## Source snapshot

The annotated Git tag `expo-before-web-migration` preserves the committed Expo
application at `d8335f8113e0cc487c30535fae77a2ae7029e3aa`. Inspect it with
`git show expo-before-web-migration` or create a separate checkout with:

```powershell
git worktree add ../TripSync-expo-snapshot expo-before-web-migration
```

This is a source snapshot, not a backup of the hosted database or Storage.
Production backups and coordinated cutover belong to step 6 of `PLAN.md`.

## Requirements and commands

Use Node.js 20 or later, npm, and a running Docker Desktop Linux engine.
The CLI is pinned to version 2.120.0 for reproducible local setup. On Windows,
use `npx.cmd` if PowerShell blocks the `npx.ps1` launcher.

Run from the repository root:

```powershell
npx.cmd --yes supabase@2.120.0 start
npx.cmd --yes supabase@2.120.0 status
npx.cmd --yes supabase@2.120.0 db reset --local
npx.cmd --yes supabase@2.120.0 stop
```

`start` downloads container images on first use and applies repository migrations.
`status` prints local endpoints and development keys. Keep its output out of Git.
`db reset --local` recreates only the local database and reapplies migrations;
it removes local test data. `stop` stops containers while retaining local data.
Do not use `--no-backup` when local data needs to be preserved.

The project ID is `tripsync-web-local`. Local API, database, and Studio use
ports 54321, 54322, and 54323 respectively. Open Studio at
<http://127.0.0.1:54323>. The future Vite frontend uses port 5173;
both localhost callback origins are configured in `supabase/config.toml`.

Analytics and its Vector log collector are disabled locally because the
collector cannot reach this host's Docker log endpoint. Auth, PostgreSQL,
Realtime, Storage, and Edge Functions remain enabled. This setting does not
change analytics or logging in the hosted project.

## Isolation and next steps

This configuration does not link to a hosted Supabase project. Do not run
`supabase link`, `db push`, or any remote reset during local preparation.
Never copy production service-role keys into frontend environment files.
The existing `.env` belongs to the Expo application and is not changed here.

Step 1 checks that the existing migration history can be replayed locally.
Step 2 introduces and tests the new schema, RLS, generated types, and Google
PKCE login. Google OAuth requires separate provider credentials and callback
configuration; it is not proven by a successful local stack startup.

Reference: [Supabase local development](https://supabase.com/docs/guides/local-development).

## Step 1 verification (2026-10-09)

- Docker Desktop Linux engine version: 29.8.0; Supabase CLI: 2.120.0.
- Local startup and `db reset --local` succeeded.
- All 13 existing migrations were applied; all 13 public tables have RLS enabled.
  This confirms configuration, not the correctness of individual policies.
- Auth `/auth/v1/health`, REST `/rest/v1/`, and Storage `/storage/v1/status`
  returned HTTP 200 using the local publishable key.
- Analytics/Vector containers are absent; the other local services are running.
- CLI logs and generated `.temp` state are ignored by Git.
- No hosted database, Storage, or Auth configuration was changed.
