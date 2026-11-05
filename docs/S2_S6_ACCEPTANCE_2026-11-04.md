# Rookline S2–S6 acceptance and release evidence — 2026-11-04

**Decision: NO-GO.** This is checkpoint **145** on development branch `codex/chess-platform-foundation`; starting HEAD `c7bc639` with additional **uncommitted** implementation and test work. **20/20 product release gates remain OPEN**, rated games OFF; do not merge `main` or deploy production. The local checks below validate the current working tree, not an attested Git commit or deployed Preview.

## Reproducible evidence from the current working tree

| Check | Result | Boundary |
| --- | --- | --- |
| `npm run verify:migrations` | **PASS, 9/9** SQL source fingerprints | Compared against the 2026-10-31 recorded snapshot; **no remote SQL queried today** |
| `npm run lint`, `npm run typecheck` | **PASS** after CH-15 client retry and fresh-response fixes | Local static analysis only |
| `npm run test` | **273/273 PASS** in 42 Vitest files | Includes private-message HTTP/validation/retry unit tests; hosted database/RLS untested |
| `npm run build` | **PASS, 21/21** generated pages, Next 16.4.3 Webpack; authorized native rerun | Restricted composite `npm run check` failed Windows `.next/types/app/api` mkdir with `EPERM` after unit PASS; independent approved build exit 0 |
| `ROOKLINE_E2E_PRODUCTION=1 npx playwright test --workers=1 --reporter=dot` | **108 PASS, 4 guarded SKIP, 0 FAIL** (112 discovered, latest built app, real local Chromium, exit 0) | Initial localhost-restricted launch could not bind; approved localhost access ran full suite successfully, before and after newest CH-15 client change. Hosted-only tests remain skipped |

The latest S4 reliability change is in `src/lib/chess/learning-cloud.ts`: cloud synchronization requires proof that the local owner marker was successfully written **and read back** before persisting completions or uploading a merged set. When owner storage cannot be claimed, the authenticated account's server progress remains visible **in memory only**; the old account's device records must not be uploaded. `src/lib/chess/learning-cloud.test.ts` exercises the unsafe transition and `e2e/rookline.spec.ts` now tests it in real Chromium with `Storage.prototype.setItem` rejecting ownership changes.

The new CH-15 local slice adds `supabase/migrations/20261104010000_private_messages.sql`, `src/lib/social/messages.ts` and `src/app/api/private-messages/route.ts` with accepted-friend, participant-only, two-way-block-protected RLS, server-derived sender, server-side rolling rate cap and sender/nonce idempotency. `src/components/PrivateChat.tsx` and `FriendCenter.tsx` expose private conversations; the client now **reuses the same nonce** after ambiguous delivery failures, resets it when text changes, and ignores superseded message refreshes. Unit tests cover request shape, access boundaries and retry key behavior. **This migration is not installed in hosted staging; no real three-user chat/RLS proof is claimed.**

## Prioritized S2–S6 exit criteria

| Milestone | Current status | Required independent proof before completion |
| --- | --- | --- |
| **S2 / P0** two direct PostgreSQL sessions | **BLOCKED_EXTERNAL** | Two independently established concurrent PostgreSQL connections to authorized isolated staging with disposable unrated games; preserve row-lock wait and post-wait `clock_timestamp()` evidence, late move/claim vs timeout, move/resign/expiry collision, idempotent retries, ~26-day clock integer overflow, direct RPC grant denials, final state/ledger and cleanup. Follow `docs/STAGING_CLOCK_CONCURRENCY_TEST.md`. |
| **S3 / P0** rated exactly-once settlement | **BLOCKED_BY_S2_AND_MIGRATION** | Verify remote SQL bodies, back up isolated staging, review/apply `20261030120000_atomic_rated_settlement.sql` there, run competing settlement transactions and distinct-game/player races, prove one result/ledger update, no duplicate Elo, rollback and leaderboard integrity. Authenticated rated matchmaking/rematch remain unfinished. **Keep rated OFF.** |
| **S4 / P1** complete engine and hosted learning | **LOCAL_IMPLEMENTED; HOSTED_UNVERIFIED** | Stockfish **19 Lite** packaged with license and tested in a real local browser Worker; local learning cloud routes/UI and account isolation tested. Staging migration `20261103010000_learning_progress.sql` is **unapplied**. Still require authorized three-identity hosted RLS/write/read, cross-device merge, blocked storage, browser performance/cancellation and broader curriculum. |
| **S5 / P1–P2** friends, notifications, tournaments, moderation | **LOCAL_IMPLEMENTED_PARTIAL; HOSTED_UNVERIFIED** | Friends/blocks, notifications, tournament creation/registration, private text chat, reports and moderator queue have routes, original UI and local tests. Staging migrations `20261103020000_social_foundation.sql`, `20261103030000_tournaments_moderation.sql`, `20261104010000_private_messages.sql` are **unapplied**. Run three-identity/role-isolation, spam/race, RLS and cleanup acceptance after isolated staging approval. Spectator authorization, actual tournament game pairing/results/standings, hosted private chat and wider abuse controls remain. |
| **S6 / P0** product acceptance | **20 OPEN, NO-GO** | Close every CH-01–CH-20 gate only on independently reproducible evidence. Include current exact-SHA CI/Preview, S2/S3 DB safety, real RLS/security, cross-browser/a11y, performance/load, licenses/assets, backup/restore, moderation and operational rollback. Owner approval required for production or merge to `main`. |

S0/S1 previously passed with three authentic identities on a protected **nonproduction** HTTPS Preview, SHA `c48970bbd9486949c7b595dba9c0bcd67f8e5cd0`, deployment `dpl_B9oECfvArxLL4PbHxyxDeTVtvgkV`, as recorded at checkpoint 142. That is **earlier-SHA evidence**, not a new pass for this tree. The last read-only staging version inventory (2026-11-03) confirmed the nine baseline migration **IDs** on dedicated project `tyvczicinpjixmxgjhjn`; the tenth rated and **four** new S4/S5 migrations were not installed. This document makes no new remote credential, SQL-hash, migration or hosted-test assertion.

## CH-01–CH-20 evidence reconciliation

The table tracks the **full acceptance gate**, not whether code exists. A locally tested feature is still OPEN until its required product-wide evidence is complete.

| Gate | Local or previous-SHA evidence | Outstanding release proof | Gate |
| --- | --- | --- | --- |
| CH-01 shell, accessibility | Responsive navigation, theme and mobile Chromium cases | Independent a11y, visual and cross-browser review | OPEN |
| CH-02 chess laws and notation | `chess.js`, SAN/FEN/PGN, claims and edge-case unit/browser regressions | Hosted SQL adjudication and exhaustive laws review | OPEN |
| CH-03 local play and clocks | Local game, save/reload, archive, recovery and Chromium timing cases | Long running and multiple-device/time-shift QA | OPEN |
| CH-04 computer play | Original Worker bot, four levels, legal-move tests | Strength, stability, browser/device and load QA | OPEN |
| CH-05 identity and sessions | Real HTTPS Auth/JWT 3-user checkpoint 142 Preview PASS | Current-SHA staging rerun and deployment hardening | OPEN |
| CH-06 persisted hosted game | Hosted participant/read/write isolation at checkpoint 142 | Current-SHA staging + migration parity/operational audit | OPEN |
| CH-07 moves and database clock | Earlier live game/move API and current local regressions | **S2** two independent PG sessions, lock and authoritative clock | OPEN |
| CH-08 Realtime and reconnect | Two authorized sockets and outsider denial checkpoint 142 | Current-SHA rerun, disconnect/soak/device coverage | OPEN |
| CH-09 matchmaking/challenges | Private challenge/join/cancel; real checkpoint 142 races | General matchmaking, rematch and abuse/race coverage | OPEN |
| CH-10 rated results | Elo unit math, draft rated migration | **S3** installed transaction and once-only concurrent ledger, rated UX | OPEN |
| CH-11 profiles/history/leaderboard | Account-scoped API and earlier hosted owner checks, archive UI | Rated leaderboard, full hosted pagination/profile coverage | OPEN |
| CH-12 analysis | PGN/FEN imports, original analysis, Stockfish 19 Lite actual browser Worker PASS | Independent performance/license review and complete analysis acceptance | OPEN |
| CH-13 puzzles | 23 authored puzzles, SAN/underpromotion/two-move solutions, local mastery | Hosted learning migration, cross-user sync, larger curriculum | OPEN |
| CH-14 openings and study | Ten openings, five lessons, browser mastery and fail-closed learning sync | Real cross-device learning/RLS and larger curriculum | OPEN |
| CH-15 friends and chat | Friends/search/request/block and private text chat locally implemented, API and nonce-retry unit tests | **Four unapplied S4/S5 staging SQL migrations**, three-identity hosted private-message read/write/blocked-history/RLS acceptance | OPEN |
| CH-16 notifications and spectators | Notifications locally implemented and mocked route UX tested | Realtime notifications, **spectator feature not complete** | OPEN |
| CH-17 tournaments and standings | Creation/list/registration/leave/cancel and local tests | Actual pairing, games, standings, hosted race/privacy tests | OPEN |
| CH-18 security and abuse | CSRF/Origin and unauthenticated route rejections, earlier hosted RLS | Full S2/S3 threat tests, flood/abuse limits, independent penetration tests | OPEN |
| CH-19 CI/regression/a11y | 273 unit, 108 Chromium PASS / 4 conditional SKIP, 21-page build on working tree | Exact current SHA Linux CI, a11y/performance/device matrix | OPEN |
| CH-20 release signoff | Evidence ledger and this 20-gate audit | All 19 preceding acceptance criteria, independent signoff | OPEN |

## Next executable work

1. On an **isolated, owner-authorized staging database**, establish **two truly independent** PostgreSQL sessions and safe, disposable unrated game fixtures, capture S2 SQL logs, timings, expected/actual rows and verified cleanup. Until this is possible, keep S2 blocked rather than use mocks as evidence.
2. Review **four** S4/S5 migrations and tenth rated migration for privileges, rollback, locks and RLS; install **only after** an isolated staging backup, scope verification and authorization. Execute prepared `e2e/staging-learning-community.spec.ts` with three disposable identities, private-chat replay/block tests and moderator-role cleanup only under those conditions.
3. Complete hosted CH-15 acceptance, then CH-16 spectator authorization and CH-17 pairing/gameplay/standings as small tested slices, followed by production-level rate limits, performance and a11y tests.
4. Publish/review an appropriately scoped development commit when the existing uncommitted changes have been reviewed, and independently attest **that exact SHA** in Linux CI and protected nonproduction Preview. No `main` merge or production deployment.
