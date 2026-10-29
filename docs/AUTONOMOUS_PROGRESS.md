# Autonomous progress ledger

## 2026-10-29, checkpoint 1

- Inspected existing branch, package and application structure; read the full `/goal` reference.
- Audited required routes: `/`, `/play` and local/computer, `/analysis`, `/puzzles` exist; online/friend UI are not hosted games; remaining required routes are pending.
- Corrected original puzzle SAN in `mate-002`: `Qh7#` was illegal; correct mate is `Qc8#` for the given FEN.
- React lint showed render-time mutable ref use in analysis; refactored analysis to immutable reactive state. Ref usage in local game is still intentionally isolated but due for architectural review.
- Supplied product, architecture, security, feature, database and release planning documents.
- Verified `npm run typecheck` PASS and `npm run test` PASS (9 tests, 2 suites); `npm run lint` reached zero errors with one warning at this checkpoint. Build via Turbopack failed spawning CSS process; Webpack compiled but failed to create `.next` output due EPERM. Build still **UNVERIFIED**.

Next focus: eliminate remaining lint warning, investigate .next permissions without losing user files, implement and verify a secure multiplayer vertical slice and live Supabase configuration.

## 2026-10-29, checkpoint 2 — verified local foundation

- Implemented browser-tested local play, four-level original computer Worker, original puzzles, PGN/FEN study, opening explorer, lessons, settings and functioning site navigation.
- Added Supabase Auth pages/callback, protected hosted game API and room UI, locked-row database RPC migration, persistent move idempotency, server clocks and game rate limiter. These are **implemented but unverified against any hosted Supabase database**.
- Hardened persisted local game state against corrupt or unavailable browser storage; added response security headers and a Node 24 GitHub Actions quality workflow.
- Ran lint (0 warnings), typecheck, 33/33 Vitest, 12/12 Playwright and Webpack production build (all PASS). See `docs/TEST_RESULTS.md` for scope and limitations.
- Current dependency security status cannot be determined: npm audit registry resolution failed. CI workflow has not run remotely.
- Still missing functional matchmaking, rated settlement, FIDE claim behavior, hosted E2E, community functionality, some required routes and engine analysis.

Next focus: review server game time/result security, expand testable chess correctness, maintain accurate docs, and prepare hosted DB validation. No acceptance gate fully closed yet.

## 2026-10-29, checkpoint 3 — draw and undo regressions

- Verified chess rules for FIDE threefold/50-move claims, fivefold/75-move automatic draws, checkmate precedence and timeout with insufficient mating material. Added corresponding local browser claim coverage.
- Implemented authenticated online draw-claim API, per-account claim rate limiting, locked-row `rookline_claim_draw` SQL migration and game-room controls. Browser tests prove that unconfigured service and cross-origin claims fail closed; **successful authenticated draw claims have not been DB-tested**.
- Added SQL timeout adjudication helper to avoid a forced win on flag fall when the opponent cannot mate; its FIDE behavior and function grants still require live Postgres validation.
- Fixed local/computer Undo to restore stored clock state for each reversed ply; included persisted clock history, schema validation and browser reload regression.
- Observed local lint and typecheck PASS; Vitest **37/37** PASS; Playwright **15/15** PASS; Next.js **Webpack build** PASS. See `docs/TEST_RESULTS.md` for evidence limits.
- No staging credentials, PostgreSQL CLI or Docker available. All 20 full product acceptance gates remain OPEN. No hosted Auth/RLS/concurrency/realtime/rating or production deployment verified.

Next focus: apply migrations to a dedicated staging Supabase project once configured, run role/authorization/concurrency and two-account E2E, then address rating/matchmaking. Meanwhile continue independently testable clock, accessibility and analysis work.

## 2026-10-29, checkpoint 4 — keyboard controls and HTTP ordering

- Added reusable coordinate move parsing (`e2e4`, `E2-E4`, `a7a8n`) to local, computer and online play; invalid input is rejected, while promotions without an explicit piece use the selection dialog.
- Corrected local clock tick state publication so a pending React updater cannot overwrite clocks restored by Undo; guarded Black's opening computer move against an invalid Undo.
- Added client-side game-snapshot progression guard and monotonically ordered HTTP load response handling. Delayed earlier-ply and joinable-403 responses no longer replace a newer displayed room. Both browser race tests use **mocked API data**.
- Extended analysis with accessible coordinate entry, promotion choice (including underpromotion) and verification of a downloadable PGN's contents.
- Final local evidence: lint PASS, strict typecheck PASS, 39/39 Vitest PASS, 20/20 browser PASS (39.3s) including the PGN file content assertion; subsequently added board-click promotion assertion also passed in focused browser run (1/1); final Webpack production build PASS with 17/17 static pages. All documented E2E cases were exercised, with the latest board-click assertion additionally verified in isolation.
- Hosted Supabase migrations/auth/RLS/Realtime/rating, Vercel CI and deployment remain **unverified**; all 20 full product acceptance gates remain OPEN.

Next focus: commit this verified slice. Afterward prioritize a staging Supabase environment for two-account integration and continue unblocked analysis/security work.

## 2026-10-29, checkpoint 5 — throttled browser clock correctness

- Committed checkpoint 4 as `f65984f` on `codex/chess-platform-foundation`.
- Fixed local/computer clock charging at the moment a move is submitted, including promotion confirmation, so a background-tab timer delay cannot allow a post-flag move or increment. Also settle time before draw claims or resignation. Uses monotonic `performance.now()` and a shared pure `advanceLocalClock` function.
- Added deterministic unit tests for long delays, fractional seconds, clamping and invalid elapsed times. Browser test simulates a suspended timer with a 181-second monotonic clock jump and proves Black's late move is rejected, the clock hits zero and no move is recorded.
- Verified lint PASS, typecheck PASS, Vitest **42/42** PASS (7 suites), full browser **21/21** PASS (40.6s), Webpack production build PASS (17/17 static pages). Initial default-sandbox browser run stalled and was interrupted; first default-sandbox build failed to write `.next/types/app/api` (`EPERM`); both checks succeeded with native escalated execution. These are local checks, not CI/hosted proof.
- No Supabase staging credentials, live database Auth/RLS/realtime/concurrency, or Vercel preview evidence. All 20 full acceptance gates remain OPEN.

Next focus: validate the database migrations in a dedicated staging environment once configured. Until then continue standalone accessibility, local game correctness, and security verification.

## 2026-10-29, checkpoint 6 — online PGN and resignation flag authority

- Added `exportOnlinePgn` for game-room download. The file is reconstructed from a validated canonical PGN/FEN/ply snapshot and labels finished wins, draws and ongoing games using the recorded result/winner. Added a downloadable button and unit/browser coverage. Browser online room is **mocked** for this test.
- Added versioned migration `20261029040000_resignation_clock_authority.sql`: under row lock, check trusted server elapsed time before resolving resignation; when the active clock is already expired, settle timeout or timeout-material draw instead, freezing clocks. Existing migrations were not modified. This source was reviewed but has **never executed against PostgreSQL**.
- Verified lint PASS, typecheck PASS, Vitest **44/44** PASS (7 suites), full Playwright **22/22** PASS (42.4s), Webpack production build PASS (17/17 static pages). The default-sandbox Playwright server startup stalled and was interrupted; the escalated full run passed. The new PGN E2E explicitly stubs the online GET response.
- No Supabase staging project, database migration execution, two-user Auth/RLS/realtime/concurrent transaction test, CI run or Vercel preview evidence. All 20 acceptance gates remain OPEN. Status: **IN_PROGRESS**.

Next focus: acquire staging verification prerequisites; meanwhile audit and improve independent server clock, input and accessibility correctness, testing each change and keeping the SQL verification boundary explicit.

## 2026-10-29, checkpoint 7 — local PGN results and archived replay

- Fixed local/computer PGN export to use chess.js headers, preserve nonstandard initial FEN and attach the actual completed result. The in-progress game object remains unchanged.
- Ensured finished local sessions' browser storage archive contains a replayable PGN with the same Result header; added browser verification after Black resigns and unit coverage for a custom promotion position.
- Verified lint PASS, typecheck PASS, Vitest **47/47** PASS (7 suites), Playwright **23/23** PASS (43.1 s), Webpack production build PASS (17/17 static pages). Browser checks were run under native escalated execution after earlier default-sandbox startup issues.
- Four SQL migrations remain unrun on PostgreSQL, and hosted Supabase Auth, RLS, RPC, Realtime, two-player sessions, rating, GitHub CI and Vercel preview are unverified. All 20 acceptance gates remain OPEN; status **IN_PROGRESS**.

Next focus: expose locally saved completed games in the archive UI and allow their replay, while continuing to seek dedicated Rookline staging access for hosted security verification.

## 2026-10-29, checkpoint 8 — saved local games browser archive and analysis replay

- Added a local completed-games section to `/games` for signed-out and authenticated states, with device-local game date/outcome, PGN download, and replay link; invalid and oversized localStorage entries are guarded.
- `/analysis?localGame=<id>` restores a stored PGN and opens at the final ply with first/previous/next navigation. Unmodified PGN export retains the saved result and setup headers; branching the line starts an ordinary new analysis variation.
- Browser tests checked local Black resignation → archive → download → replay → re-export with preserved `1-0`, plus malformed archive JSON and invalid replay PGN error handling.
- Lint, strict TypeScript and 47/47 Vitest passed; full Playwright **24/24** passed (47.3 s), including new archive corruption coverage. Next.js 16.4.3 Webpack build passed with 17/17 generated static pages.
- Dedicated Supabase staging URL, publishable key and server-only credential remain absent. Four SQL migrations, RLS/GRANTS and two real authenticated browsers remain unverified; no real-hosted multiplayer gate has closed. Status: **IN_PROGRESS**; all 20 acceptance gates OPEN.

Next focus: continue locally verifiable accessibility and replay correctness while preparing the dedicated Rookline staging integration checklist. Do not touch the unrelated Supabase project.

## 2026-10-29, checkpoint 9 — FIDE mating potential and resignation draw

- Corrected local timeout decisions for multiple same-square-color bishops and FIDE resignation draws when the opponent has no possible mating sequence; recorded resignation draws as a standard `1/2-1/2` PGN outcome, including locally archived games.
- Added versioned `20261029050000_mating_potential_adjudication.sql` to bring the PostgreSQL timeout helper and resignation RPC into source-level parity while preserving the earlier locked-row server-clock precedence. Source reviewed; **no PostgreSQL execution or privilege test**.
- Added two Vitest cases and a full browser local-FEN resignation/drawn-PGN replay scenario. Diagnosed a flaky existing computer Undo browser test: its first row-count assertion raced the asynchronous bot reply. Wait now asserts two rows after the reply; Undo still leaves the original opening move and resets the human clock.
- Final verification: lint PASS, typecheck PASS, **49/49** Vitest (7 suites) PASS, **25/25** Playwright PASS (50.8 s), Next.js 16.4.3 Webpack build PASS (17/17 static pages). The first full browser run was 24/25 due to the timing assertion; focused rerun 1/1 and final full rerun 25/25 passed.
- Five SQL migrations await application; no dedicated Rookline staging credentials, two-user Auth, RLS, RPC, realtime, concurrent move, rated settlement or Vercel preview verification. All 20 gates remain OPEN; project **IN_PROGRESS**.

Next: keep tightening independent local correctness and accessibility. When dedicated Rookline staging is provisioned, apply and test all five migrations, authorized RPC grants, and two real authenticated clients without modifying unrelated projects.

## 2026-10-29, checkpoint 10 — clock catch-up after reloading a live local game

- Found that reloading an ongoing local/computer game restored the chess position and remaining seconds but left its clock permanently paused, effectively granting unbounded time. Added `running` and `savedAt` to saved sessions and now charge the turn player's wall-time gap on reload; expired games render timeout immediately and the bot Worker cannot play afterward.
- Preserved older local snapshots that lack these metadata fields: they load with paused clocks. Live turn charging continues using monotonic `performance.now()`, while across reloads the unranked game uses `Date.now()` to recover elapsed wall time.
- Added two Playwright scenarios: active clock is charged for a simulated 42-second page gap and a subsequent expired turn is blocked; reloaded computer-to-move expired game never adds a move.
- Lint PASS, typecheck PASS, Vitest **49/49** PASS, focused browser **2/2** PASS and full browser **27/27** PASS (54.2 s), Webpack build PASS (17/17 static pages). A default-sandbox Playwright server startup stalled and was interrupted; native escalated runs completed and passed.
- Five SQL migrations still unrun on PostgreSQL; no staging Rookline Auth/RLS/RPC/realtime, CI or Vercel deployment verification. All 20 acceptance gates remain OPEN; status **IN_PROGRESS**.

Next: investigate local accessibility and sustained chess timing/engine correctness independently. Once dedicated staging access exists, execute the five migrations and two-real-account verification before claiming hosted multiplayer or rated results.

## 2026-10-29, checkpoint 11 — accessible keyboard promotion in all game modes

- Consolidated local/computer, analysis and online game-room promotion into a shared accessible dialog with labeled piece choices, initial focus, trapped Tab/Shift+Tab, Escape cancellation and focus restoration. When the game ends on promotion and disables keyboard moves, focus falls back to PGN; online room has a Sync fallback.
- Three Playwright cases verify analysis selection/cancel/reopen, local cancellation and knight underpromotion, and endgame fallback focus. Full **30/30** Playwright passed on an isolated rerun (58.0 s), **49/49** Vitest passed, lint/typecheck passed. Next 16.4.3 Webpack production build passed with 17/17 static pages on final code. Dev server emitted a non-failing Fast Refresh reload warning.
- No dedicated Rookline Supabase staging, live Auth/SQL/RLS/RPC/realtime/concurrency, rated settlement, GitHub CI or Vercel preview evidence. Five migrations remain unrun; all 20 product acceptance gates remain OPEN. Status **IN_PROGRESS**.

Next: continue local keyboard accessibility and long-game correctness QA; validate hosted game-room promotion and all five migrations using dedicated staging accounts once provisioned.

## 2026-10-29, checkpoint 12 — retract stale archived result after local Undo

- Reproduced a data consistency defect: a completed local resignation appeared in `/games` even after Undo reopened the game. Added browser coverage that failed on the old behavior (archive count stayed 1) and then passed after the fix.
- When Undo reopens a completed local/computer game, remove only that game ID from the browser-only completed archive. New game resets still preserve legitimate completed records. The archive removal fails safely if localStorage is unavailable or malformed.
- Verification: focused Playwright **1/1**, complete **31/31** (~1.0 min), lint/typecheck, **49/49** Vitest, Webpack build **17/17** static pages all PASS. No real hosted or CI validation; five SQL migrations unrun, all 20 gates OPEN, status **IN_PROGRESS**.

Next: audit another local game/engine edge case while awaiting an isolated Rookline staging database for live two-user tests.
