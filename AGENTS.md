# Repository Guidelines

## Project Structure & Module Organization

The Next.js app starts in `src/app/`. Treat `docs/README.md`, `docs/STRUCTURE.md`, `docs/BUILD_PLAN.md`, and `docs/features/` as the current MVP specification. `TRIPSYNC_APP_STRUCTURE.md` is the original draft; follow `docs/` when they differ.

When implementing the app, use the planned Next.js layout: `src/app/` for routes, `src/components/` for shared UI, `src/features/{access,groups,trips,voting,notifications}/` for domain behavior, and `src/lib/` for shared clients and validation. Put SQL schema changes in `supabase/migrations/` and database policy tests in `supabase/tests/`. There is no asset directory yet; add one only when assets are needed.

## Build, Test, and Development Commands

Run `npm install` to restore dependencies, `npm run dev` for the local server, `npm run build` for a production build, `npm run lint` for static checks, and `npm test` for automated tests. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`. Use `git status --short` to inspect local changes. Run `supabase test db` for database policies when local Docker is available; database tests are in `supabase/tests/`.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation and explicit types at public boundaries. Keep business rules in `src/features/`, not in page components. Name React components `PascalCase`, functions and variables `camelCase`, route and feature folders `kebab-case`, and SQL tables/columns `snake_case`. Name feature specifications `NN-kebab-case.md`, matching `docs/features/`. ESLint uses `eslint.config.mjs`; run it before submitting changes.

## Testing Guidelines

Node's built-in test runner executes `*.test.ts`; no coverage threshold is configured. Add focused tests for vote totals, deadlines, state transitions, and plan-version RSVP behavior. Test RLS allow/deny cases for members, organizers, and outsiders. Include an end-to-end path covering invite → vote → confirm → RSVP with two accounts.

## Commit & Pull Request Guidelines

The history has only an initial commit and `docs: add TripSync MVP structure and build plan`; use short, imperative, type-prefixed subjects such as `feat: add trip voting`. PRs should state the behavior changed, link the relevant feature spec or issue, list checks run, and include screenshots for UI changes. Call out schema migrations and permission changes.

## Security & Configuration

Keep OAuth credentials and Supabase keys in environment variables; never commit secrets. Check authentication, group membership, trip role, and voting deadline on the server for every mutation. Keep the service-role key out of browser code, and apply database changes through migrations.
