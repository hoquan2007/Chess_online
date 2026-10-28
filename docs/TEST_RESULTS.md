# Test evidence ledger

Date: 2026-10-29. Workspace: `D:\Chess_online`; branch `codex/chess-platform-foundation`.

| Check | Observed result | Evidence boundary |
| --- | --- | --- |
| `npm run lint` | PASS, exit 0, checkpoint 7 | Local source and tests |
| `npm run typecheck` | PASS, exit 0, checkpoint 7 | TypeScript strict check |
| `npm run test` | PASS, 47/47 tests in 7 suites, checkpoint 7 | Includes replayable local and online PGN, nonstandard FEN, clocks, FIDE claims/timeout and input checks; **not** hosted DB integration |
| `npm run test:e2e -- --workers=1` | PASS, 23/23 Playwright tests (43.1 s), checkpoint 7 | Local resignation downloaded PGN and saved local archive PGN both include winner; online PGN browser uses a **mocked** snapshot; **not** hosted multiplayer |
| `npm run build -- --webpack` | PASS, exit 0, Next 16.4.3, checkpoint 7 | Compile, types, 17/17 static generation, build trace; Webpack is the verified builder |
| `.github/workflows/quality.yml` | Written; **NOT RUN** on GitHub | Node 24, lint/typecheck/Vitest/Webpack build/Playwright Chromium configured |
| `npm audit --omit=dev --json` | UNVERIFIED: `getaddrinfo ENOTFOUND registry.npmjs.org` | No conclusion about current dependency vulnerabilities |
| Supabase migration, RLS, RPC and Auth | BLOCKED_EXTERNAL | No configured staging project or real account credentials |
| Two distinct authenticated browsers / hosted E2E | NOT RUN | No claim of synced, persistent, real multiplayer |
| Vercel preview/prod | NOT RUN | No deployment authorized or verified |

Browser E2E covered local legal moves, clock-accurate undo and reload, a throttled-tab late move refusal, Fool's Mate, threefold draw claim; browser Worker computer move and safe first-ply Undo; keyboard coordinate input in local and analysis, including invalid move rejection and underpromotion choice; original puzzle; PGN import/download with saved file contents; opening/lesson navigation; theme/sound settings; mobile no-overflow; fail-closed unconfigured online routes including draw claims, origin guard; corrupted localStorage recovery; and security headers. Two browser tests **mocked** API response races to verify stale active game and invitation responses do not rewind the interface. An additional test **mocked** a completed online game, downloaded the PGN, reparsed it with chess.js and checked Black's win. These mocked responses do not prove real hosted multiplayer.

The `20261029030000_draw_claims.sql` and `20261029040000_resignation_clock_authority.sql` migrations, and the baseline timeout adjudication SQL, have **not** run in PostgreSQL. The resignation migration locks the game row, reads trusted time after locking, and gives an expired clock precedence over resignation; these are reviewed source semantics only, not executable DB evidence. Browser tests of `/api/games/[id]/claim` currently establish only cross-origin and unconfigured-service rejection, not an authenticated successful claim. A local PostgreSQL/Supabase CLI and Docker were unavailable when checked. Claims about SQL privilege grants, row locks, realtime and two-player operation remain unverified.

At checkpoint 6, a default-sandbox full Playwright startup produced no further output after web-server warnings and was interrupted; the full 22-test regression passed under native escalated local execution. The escalated Webpack production build also passed. Earlier Turbopack and sandboxed Webpack failures were environment-specific observations; avoid claiming default Turbopack or CI success.

Checkpoint 7: local PGN downloads now include correctly adjudicated result headers for resignation, claim, timeout, checkmate and unfinished games; archived local sessions store the same replayable PGN. New tests cover exporting a custom starting FEN and preserving game state. Full 23-test browser regression and build passed again after archive changes. These tests do not certify hosted persistence.

All 20 full product acceptance gates remain open. Rerun relevant checks after further code changes and record their outcomes here.
