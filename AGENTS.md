# Repository Guidelines

## Project Structure & Module Organization
TripSync is a responsive React/TypeScript PWA built with Vite, Mantine, React Router, TanStack Query, and Supabase.
- `src/app/` contains routing, providers, the responsive shell, theme, and PWA controls.
- `src/features/` groups screens, hooks, services, and validation by feature.
- `src/shared/` contains reusable feedback UI, navigation utilities, the Supabase client, and generated database types.
- `public/` contains install icons and Cloudflare Pages configuration.
- `supabase/migrations/`, `supabase/tests/`, and `supabase/functions/` contain database changes, pgTAP tests, and Edge Functions.
- `legacy/expo/` archives the unsupported Expo app. Add new features to `src/`.

## Build, Test, and Development Commands
Use `npm ci` to install locked dependencies. On Windows, use `npm.cmd` if PowerShell blocks npm.
- `npm run dev`: start Vite on port 5173.
- `npm run typecheck`: check strict TypeScript.
- `npm test`: run Vitest unit tests.
- `npm run build`: typecheck and produce `dist/`, including the service worker.
- `npm run preview`: serve the production build locally.
- `npm run db:start` / `db:stop`: manage local Supabase.
- `npm run db:reset`: reset only the local database.
- `npm run db:test`: run RPC/RLS integration tests.
- `npm run db:types`: regenerate types from the local `tripsync` schema.

## Coding Style & Naming Conventions
Use two-space indentation, double quotes, semicolons, and strict TypeScript. Name components in PascalCase and hooks with a `use` prefix. Use Mantine, Anuphan, and existing theme tokens. Screens call feature services rather than querying Supabase directly. Keep server data in TanStack Query; validate inputs with Zod. Never cast Supabase to `any`. No ESLint or Prettier configuration is currently present.

## Testing Guidelines
Name unit tests `*.test.ts`; place pgTAP tests in `supabase/tests/`. No coverage threshold is configured. Verify changed behavior, cross-room permissions, error handling, and persistence. Check responsive layouts at 320, 390, 768, and 1440px. Browser simulation does not replace real Android/iPhone testing.

## Commit & Pull Request Guidelines
History uses short subjects such as `fix ui`. Prefer focused imperative subjects. Describe behavior, linked issues, validation, and schema changes; include screenshots for UI changes. Commit and push after each completed implementation step in `PLAN.md`.

## Security & Configuration
Keep secrets in ignored environment files. Only Supabase URL and publishable key use `VITE_` prefixes. Use local Supabase during development; cloud migrations belong to the planned cutover. Review RLS and regenerate types after schema changes. Never cache private API responses in the service worker.
