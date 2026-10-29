# Rookline — development and verification execution plan

Date: 2026-10-29. Status: QA-00 **local checks passed** (checkpoint 17: 40 browser, 49 unit, native Webpack build); AUTH-01 onward **not accepted** pending dedicated staging and further implementation. Source of truth: `PROJECT_VISION.md`, `agent-state/BACKLOG.md`, `SECURITY_MODEL.md`, `ARCHITECTURE.md`, `FINAL_AUDIT.md`.

## Delivery rules

- Work exclusively on development branches; no automatic merge to main or production deployment.
- Each vertical slice: baseline → failing reproduction/acceptance test → minimum change → unit/integration/browser checks → security/UX review → evidence in `TEST_RESULTS.md` and `AUTONOMOUS_PROGRESS.md` → reviewable commit.
- Require `npm run check` plus applicable `npm run test:e2e -- --workers=1`; no false PASS for mocked services. Record command, result, environment, timestamp, issues and links to evidence.
- Database validation needs an isolated Rookline staging Supabase project with real test accounts. Never run migrations on an unrelated project; keep service-role secrets server-only.
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

## Initial two-sprint queue (capacity-based; estimates are planning assumptions)

**Sprint A — local readiness:** (A1) baseline all working-tree changes and investigate Windows `.next` EPERM; (A2) exercise existing auth/sound browser tests and add meaningful missing coverage; (A3) verify logo across desktop, mobile and light/dark; (A4) update evidence ledger. Exit: local build + test suite genuinely green, no regression introduced.

**Sprint B — staging multiplayer:** (B1) configure dedicated staging Auth and correct callback URL; (B2) run migrations in ordered transaction-safe process and test RLS/grants; (B3) complete two-account room/move/invite flow; (B4) test concurrency, server clocks, offline/reconnect; (B5) log artifacts and block promotion on any failed security test. Exit: independently verifiable two-person unrated game with server persistence. If staging is absent, prioritize independent local QA and mark B1–B5 `BLOCKED_EXTERNAL`.

## Per-slice completion record

Track: task ID, branch/commit, changed files, acceptance scenario, actual commands/results, screenshots/logs when useful, limitations, reviewer findings, rollback method, and updated `BACKLOG.md`/`NEXT_ACTION.md`. Never overwrite earlier evidence with an unverified newer claim.

## Known baseline and blockers (at planning time)

- Historical checkpoint: 49/49 Vitest and 34/34 Playwright. More recent edited auth/audio/logo tree has lint/types/49 unit PASS, but latest full build failed with `EPERM` at `.next/server/app/analysis.segments/analysis`. Re-run browser suite and full build after repairing this environment failure.
- No configured staging Supabase credentials; all hosted Auth/SQL/multiplayer gates remain unverified. Five SQL migrations are still unrun.
- Vercel frontend was built, but public verification is blocked by deployment authentication. Production action needs explicit owner approval.
