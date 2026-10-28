# Test evidence ledger

Date: 2026-10-29. Workspace: `D:\Chess_online`; branch `codex/chess-platform-foundation`.

| Check | Observed result | Evidence boundary |
| --- | --- | --- |
| `npm run lint` | PASS, exit 0, 0 warnings, checkpoint 5 | Local source and tests |
| `npm run typecheck` | PASS, exit 0, checkpoint 5 | TypeScript strict check |
| `npm run test` | PASS, 42/42 tests in 7 suites, checkpoint 5 | Includes monotonic clock settlement under throttling, FIDE claims/timeout, coordinate notation, stale-snapshot guard, serialization, input/origin validation, puzzle/study; **not** hosted DB integration |
| `npm run test:e2e` | PASS, 21/21 Playwright tests (40.6 s), checkpoint 5 | Real local browser/Next interactions, including synthetic 181-second clock jump and rejection of late move, Chrome channel on local machine; **not** hosted multiplayer |
| `npm run build -- --webpack` | PASS, exit 0, Next 16.4.3, checkpoint 5 | Compile, types, 17/17 static generation, build trace; Webpack is the verified builder |
| `.github/workflows/quality.yml` | Written; **NOT RUN** on GitHub | Node 24, lint/typecheck/Vitest/Webpack build/Playwright Chromium configured |
| `npm audit --omit=dev --json` | UNVERIFIED: `getaddrinfo ENOTFOUND registry.npmjs.org` | No conclusion about current dependency vulnerabilities |
| Supabase migration, RLS, RPC and Auth | BLOCKED_EXTERNAL | No configured staging project or real account credentials |
| Two distinct authenticated browsers / hosted E2E | NOT RUN | No claim of synced, persistent, real multiplayer |
| Vercel preview/prod | NOT RUN | No deployment authorized or verified |

Browser E2E covered local legal moves, clock-accurate undo and reload, a throttled-tab late move refusal, Fool's Mate, threefold draw claim; browser Worker computer move and safe first-ply Undo; keyboard coordinate input in local and analysis, including invalid move rejection and underpromotion choice; original puzzle; PGN import/download with saved file contents; opening/lesson navigation; theme/sound settings; mobile no-overflow; fail-closed unconfigured online routes including draw claims, origin guard; corrupted localStorage recovery; and security headers. Two browser tests **mocked** API response races to verify stale active game and invitation responses do not rewind the interface. These mocked responses do not prove real hosted multiplayer.

The new `20261029030000_draw_claims.sql` migration and the baseline timeout adjudication SQL have **not** run in PostgreSQL. Browser tests of `/api/games/[id]/claim` currently establish only cross-origin and unconfigured-service rejection, not an authenticated successful claim. A local PostgreSQL/Supabase CLI and Docker were unavailable when checked. Claims about SQL privilege grants, row locks, realtime and two-player operation remain unverified.

At checkpoint 5, a default-sandbox Playwright startup stalled and was interrupted; the same focused test passed under escalated local execution, followed by the full 21-test regression. The default-sandbox Webpack build failed with `EPERM mkdir .next/types/app/api`; the escalated native build then passed. Earlier Turbopack and sandboxed Webpack failures were environment-specific observations; avoid claiming default Turbopack or CI success.

All 20 full product acceptance gates remain open. Rerun relevant checks after further code changes and record their outcomes here.
