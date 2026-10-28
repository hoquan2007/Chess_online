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
