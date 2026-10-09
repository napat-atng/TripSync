# Repository Guidelines

## Project Structure & Module Organization
TripSync is an Expo/React Native application using TypeScript, Expo Router, Supabase, Zustand, and NativeWind.
- `app/` contains file-based routes, including `(auth)`, `(tabs)`, and trip screens under `trips/[id]/`.
- `components/` holds shared UI; `components/ui/` contains primitives such as buttons and inputs.
- `lib/` contains Supabase access and domain helpers; `hooks/` contains reusable React hooks.
- `store/` contains Zustand stores; `types/` defines domain and database types.
- `assets/` holds icons and splash images. `supabase/migrations/` holds SQL migrations; `supabase/functions/` holds Deno Edge Functions.

## Build, Test, and Development Commands
- `npm ci`: install dependencies from `package-lock.json`.
- `npm start`: start the Expo development server.
- `npm run android` / `npm run ios`: start Expo for the corresponding device or simulator; iOS simulators require macOS.
- `npm run web`: run the web development target.
- `npm run typecheck`: run TypeScript checking without emitting files.

No build or automated test script is currently configured in `package.json`.

## Coding Style & Naming Conventions
Use strict TypeScript, two-space indentation, double quotes, and semicolons, matching surrounding code. Use PascalCase for component files (`InviteSheet.tsx`), camelCase for functions, and `use` prefixes for hooks and stores (`useAuth`, `useTaskStore`). Follow Expo Router route naming, including `[id]` and `_layout.tsx`.

Reuse `AppText` for Sarabun typography and NativeWind classes with tokens from `tailwind.config.js`. Keep data access in `lib/` and shared state in `store/`. No ESLint or Prettier configuration is present.

## Testing Guidelines
No test framework, test suite, or coverage threshold is configured. Run `npm run typecheck` and manually exercise affected flows on the relevant Expo targets. For trip changes, verify authentication, membership permissions, persistence, and error handling. Include reproduction steps and validation results in the pull request. Establish a test runner and naming convention when introducing automated tests.

## Commit & Pull Request Guidelines
Recent commits use short, informal subjects such as `fix ui` and `update notification`; no enforced convention is evident. Write concise imperative subjects identifying the affected feature. Keep changes focused. Pull requests should explain the change, link relevant issues, list validation performed, and include screenshots for UI changes. Call out schema or configuration changes.

## Security & Configuration
Copy `.env.example` to `.env` and configure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Public Expo variables are client-visible; keep service-role keys and provider secrets in server-side configuration. Never commit secrets. Add schema changes as timestamped SQL migrations and review row-level security policies.
