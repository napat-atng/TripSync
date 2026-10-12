# TripSync

TripSync is a mobile-first trip planner for a small group of friends. The MVP scope and acceptance checks are in [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) and [`docs/features/`](docs/features/README.md).

## Local development

1. Install Node.js 22 or newer and run `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key. Never commit `.env.local`.
3. Run `npm run dev` and open `http://localhost:3000`.

Run `npm run build`, `npm run lint`, and `npm test` before submitting code. On PowerShell, use `npm.cmd` if `npm.ps1` is blocked.

## Auth and database setup

Enable Google in Supabase Auth. Set the Google OAuth redirect URI to `https://deondfdbovycllaxfuag.supabase.co/auth/v1/callback`. Add `http://localhost:3000/auth/callback` and `https://tripsync-napat6.vercel.app/auth/callback` to Supabase's redirect allow list. Configure the same public Supabase variables in Vercel for Production.

Database changes live in `supabase/migrations/`; policy tests live in `supabase/tests/`. The current production project has the initial schema migrations applied. The tests can run with `supabase test db` when a local Supabase stack and Docker are available.

The app is under active development; a successful deploy does not yet mean the full invite, vote, confirm, and RSVP flow is implemented.
