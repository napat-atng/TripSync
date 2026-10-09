# Step 2 verification — 2026-10-09

## Implemented foundation

- Active stack: React/TypeScript, Vite, Mantine, Anuphan, React Router and TanStack Query.
- Responsive sidebar/bottom navigation, login/callback, home, create-room, room and profile routes.
- Google PKCE with retained safe return paths, StrictMode-safe code exchange,
  persisted sessions, token refresh, and query cache clearing on account changes/logout.
- PWA manifest and PNG/SVG icons, app-shell-only precaching, offline write guards,
  explicit update controls and unsaved-form guards.
- Additive `tripsync` schema for profiles, rooms, memberships and atomic room creation.
  Types were generated from this local schema; legacy public tables remain untouched.

## Evidence

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; manifest and worker emitted |
| `npm test` | 13 unit cases passed |
| `supabase test db` | 17 pgTAP cases passed |
| Local Data API verification | Room creation/read, profile update, cross-account RLS and forged-membership rejection passed |
| Browser viewports | Login, home with long names, room form and profile at 320/390/768/1440px: no horizontal overflow |
| Browser persistence | Create room → room route → refresh; profile edit → refresh passed |
| Offline | Status shown; submission disabled; production PWA shell reloads offline |
| Unsaved forms | Navigation cancelled retains draft; successful save does not block navigation |
| PWA cache inspection | 21 cached shell assets; no private API or OAuth callback responses cached |
| PWA update | A real new worker was installed: update disabled while editing, enabled after save, new worker activated and saved room preserved |
| Local Google provider | Enabled; authorize responds 302 to Google with the expected local Supabase callback |
| Real Google login/callback | User confirmed successful login; local database contains one Google identity, a signed-in Auth account, and its initialized web profile |

Browser/API tests use clearly identified synthetic users only in local Supabase.
They validate application plumbing and permissions and do **not** prove Google login.
Screenshots and ephemeral fixture/session files are ignored, not committed.

## Outstanding acceptance

- Real login/callback is verified. Refresh, token expiry, logout/re-login and
  invitation return paths remain part of the full workflow acceptance before production.
- Real Android Chrome and iPhone Safari/install/push checks belong to later preview acceptance.
- Invites, approval, chat, availability, surveys and polls are step 3; AI, itinerary,
  tasks, money and notifications are step 4. No production deployment/cutover is complete.
- Build currently warns about a main chunk above 500 kB; feature routes are split,
  and further splitting can be evaluated before release.

Step 2 foundation acceptance is complete. The remaining checks above are required
for the later preview/production gates; the overall migration is not complete.
