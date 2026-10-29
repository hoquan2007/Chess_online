# Rookline — development and verification execution plan

Date: 2026-10-30. Status: QA-00 **local checks passed** (checkpoint 22: 40 browser pass / 1 gated staging skip, 52 unit, native Webpack 17 pages). Hosted structural SQL **passed** on the dedicated Supabase project, but AUTH-01 onward **not accepted** pending actual authenticated staging runs and further implementation. Source of truth: `PROJECT_VISION.md`, `agent-state/BACKLOG.md`, `SECURITY_MODEL.md`, `ARCHITECTURE.md`, `FINAL_AUDIT.md`.

## Delivery rules

- Work exclusively on development branches; no automatic merge to main or production deployment.
- Each vertical slice: baseline → failing reproduction/acceptance test → minimum change → unit/integration/browser checks → security/UX review → evidence in `TEST_RESULTS.md` and `AUTONOMOUS_PROGRESS.md` → reviewable commit.
- Require `npm run check` plus applicable `npm run test:e2e -- --workers=1`; no false PASS for mocked services. Record command, result, environment, timestamp, issues and links to evidence.
- Database validation uses the dedicated Rookline staging Supabase project (`tyvczicinpjixmxgjhjn`), where all eight migrations are applied. Never run migrations on an unrelated project; keep server secrets server-only. Execute guarded `e2e/staging-online.spec.ts` with real test accounts, then `STAGING_CLOCK_CONCURRENCY_TEST.md` to verify lock-wait time, 26-day expiration and privileged grants under real PostgreSQL concurrency.
- `supabase/tests/structural-acceptance.sql` is a rerunnable read-only baseline for hosted RLS enablement, grants, indexes and FIDE helper execution (checkpoint 22 PASS). Run it only on the dedicated project, through an authenticated SQL console. It cannot replace actual Auth users, RLS policy tests, transactional row-lock contention or Realtime delivery.
- Blocked external checks are `BLOCKED_EXTERNAL`, not complete. The product remains `IN_PROGRESS` until all 20 acceptance gates in `FINAL_AUDIT.md` have evidence.

## Ordered slices and gates

| Order | ID / priority | Deliverable | Required acceptance evidence | Dependency |
| --- | --- | --- | --- | --- |
| 0 | QA-00 / P0 | Stabilize current uncommitted auth/audio/brand changes; investigate `.next` EPERM build failure without discarding unrelated edits | clean lint/types/unit, complete Webpack build, focused browser tests for register/login errors, sound on/off and real browser playback, navigation/logo responsive check | local checkout |
| 1 | AUTH-01 / P0 | Register, confirm email, sign in/out, persistent session, return-to-game deep links, profile metadata | two distinct **real** Auth accounts; incorrect password, expired link, duplicate signup, refresh/logout; no anonymous access to protected operations | isolated staging Supabase, allowed redirect URLs |
| 2 | DATA-02 / P0 | Apply and review all existing SQL migrations in staging; inspect ownership, RLS, grants, indexes and function permissions | migration repeatability, anonymous/other-user read/write denial, own-game permissions, service key never exposed, audit SQL | AUTH-01 |
| 3 | GAME-03 / P0 | Create/invite/join private unrated match with authoritative legal play, turn order, results, clocks and resume | two independent browsers/identities play whole match, persist/reload; illegal/out-of-turn/replay/duplicate move denied; concurrent writes, checkmate, resignation, draw claims, timeout tested on real DB | DATA-02 |
| 4 | SYNC-04 / P0 | Robust realtime notifications, reconnect, stale snapshot handling and observable failures | disconnected/reconnected clients converge; no duplicate/lost turn; server state wins after refresh and browser sleep; mobile/desktop contexts | GAME-03 |
| 5 | PLAY-05 / P0 | Rated matchmaking, opponent pairing and atomic rating settlement; no rated enablement beforehand | concurrent pairing without double seats; one settlement per final game; retry/idempotency, abort and rematch handling; SQL ledger invariants | GAME-03 + SYNC-04 |
| 6 | USER-06 / P1 | Player profiles, server game archive, leaderboard and privacy controls | cross-user auth, sorting/rating calculations, PGN replay/export, retention after logout/login | AUTH-01 + PLAY-05 |
| 7 | LEARN-07 / P1 | Analysis, puzzles, opening lessons, computer strength and accessibility polish | verified puzzle solutions, import/export fidelity, legal moves, keyboard/screen reader flows, sustained timing/Worker race regression | local test infra |
| 8 | SOCIAL-08 / P2 | Friends, chat, spectator access, notifications, moderation and tournament basics | ACL tests, abusive input/rate limits, private spectator denial, reporting/admin workflow | secure hosted gameplay |
| 9 | RELEASE-09 / P0 | CI, vulnerability checks, performance/accessibility, deployment preview and final audit | CI results, current dependency audit, Lighthouse/a11y, browser matrix, two-client hosted smoke, staging rollback plan; owner approval for production | preceding launch scope |

## Test matrix

| Layer | Test focus | Gate |
| --- | --- | --- |
| Unit / Vitest | chess.js move rules, promotions, repetition, mating potential, time calculations, parsing, idempotency helpers | all focused + full regression pass |
| UI / Playwright | registration states, audio toggle/persistence, keyboard chess, real Worker, PGN archive, responsive/mobile, dark/light | Chromium and mobile viewport pass; keyboard/a11y review |
| Integration / live Supabase | Auth confirmation and cookies, migration/RLS/RPC permissions, persisted game, trusted timestamps, 2 account sessions | real DB evidence; mocks explicitly segregated |
| Adversarial / concurrency | forged actor, IDOR, invalid/late move, 2 simultaneous moves, duplicate requests, connection loss, timeout vs resign, rating double settlement | all unauthorized writes rejected; exactly one authoritative commit |
| Operational | clean install, Webpack build, CI, preview smoke, CSP/secret scan, dependency audit, monitoring/rollback | recorded PASS in target environment |

## Next two delivery sprints (capacity-based; estimates are planning assumptions)

**Sprint A — S0 hosted Auth/security:** Local QA-00 readiness has passed at checkpoint 23 (lint/typecheck/52 unit/40 browser, Webpack 17 pages). (A1) securely configure dedicated staging runtime and Auth redirect URLs; (A2) verify remote migration history and structural privileges; (A3) execute three-real-account signup/session/forbidden-access staging E2E; (A4) record request-level evidence, cleanup and findings. Exit: actual authenticated RLS/session evidence, with no privileged key exposure. If access remains absent, mark `BLOCKED_EXTERNAL` and continue isolated local keyboard/long-game QA.

**Sprint B — S1/S2 authoritative unrated multiplayer:** (B1) independently verify live create/join/move/finish/PGN across two browser contexts; (B2) verify true Realtime delivery and lost-event reconnect; (B3) run two-connection row-lock, late-clock, 26-day expiry and adversarial game authorization/duplicate-request cases; (B4) fix observed defects, rerun complete checks and log proof. Exit: independently verified unrated hosted game with correct server clocks and atomic state. Matchmaking/rated mode remains gated until later implementation and exact-once settlement tests. See `CONTINUATION_PLAN_2026-10-30.md` for subsequent phases.

## Per-slice completion record

Track: task ID, branch/commit, changed files, acceptance scenario, actual commands/results, screenshots/logs when useful, limitations, reviewer findings, rollback method, and updated `BACKLOG.md`/`NEXT_ACTION.md`. Never overwrite earlier evidence with an unverified newer claim.

## Known baseline and blockers (at planning time)

- Verified checkpoint 22: 52/52 Vitest, 40/40 local/mocked Playwright with 1 gated staging skip and 17-page native Webpack build PASS; restricted `.next` writes caused `EPERM` in the default composite check. Hosted structural SQL passed independently. The native full Chromium run has finished with exit 0.
- No configured Next.js staging runtime credentials. Eight SQL migrations have been installed remotely, but hosted Auth, user-specific RLS, concurrent RPC, Realtime and real two-user UI gates remain unverified; `e2e/staging-online.spec.ts` has intentionally never run with the opt-in enabled.
- Vercel frontend was built, but public verification is blocked by deployment authentication. Production action needs explicit owner approval.
