# Autonomous progress ledger

## 2026-10-31, checkpoint 121 — navigated FEN sharing and friend login destination

- Analysis displays the FEN of the currently selected move and lets users copy it with clipboard failure guidance. A Chromium regression imports a three-ply PGN, rewinds to the first move, reads/copies the exact FEN, then verifies Reset restores starting FEN.
- The friend lobby sends logged-out players to login/registration with `/play/friend` as the return target; the online lobby retains `/play/online`. A separate real Chromium test verified both destinations with an isolated dummy public Supabase configuration; no privileged credential was used.
- **Verification PASS:** `npm run check` (9/9 local pinned migration fingerprints, ESLint, strict TypeScript, 195/195 Vitest in 28 suites, production build with 17 static pages); full production Chromium **97 local/mock PASS, 2 conditional SKIP** (one public-auth opt-in, one genuine hosted Supabase). The dedicated public-auth opt-in regression passed separately. No real hosted multiplayer test ran.
- **IN_PROGRESS, 20/20 gates OPEN, rated OFF.** S0 Preview server-only staging secret and genuine three-identity HTTPS Auth/RLS; S1 real two-person private Realtime; S2 DB concurrency and server clock; S3 rated settlement; S4 engine/learning/profile completion; S5 community/tournaments; S6 independent release audit. Development-branch GitHub CI and protected Preview need exact-SHA post-push checks. No main merge or production deploy.

## 2026-10-31, checkpoint 118 — Analysis reply and two-ply exploration

- CH-12's Worker now retains the opponent's strongest searched SAN reply for each of three ranked legal moves; checkmating moves have no reply. Determinism, reply legality and unchanged input board have unit coverage.
- Analysis presents reply SAN and a keyboard-accessible Explore action. Both moves are revalidated by chess.js at the displayed ply before replacing the continuation; users can navigate the new two-ply line, and previous suggestions are invalidated.
- Evidence: pinned local migration hashes **9/9 PASS**, ESLint/strict TypeScript PASS, **195/195 Vitest PASS**, separately authorized Next production `npm run build` **PASS (17 pages)** after restricted Windows `EPERM`; focused real Worker Chromium **2/2 PASS** and full production Chromium **96 local/mock PASS / 1 real hosted Supabase SKIP** (exit 0). Local migration verification is not a remote DB audit.
- Prior SHA `957d596` passed exact-SHA Linux Actions run `41205863679`; the new SHA needs fresh CI and Preview proof. No current-SHA protected Preview confirmed. Preview has only public Supabase URL and publishable key, without a confirmed server-only staging credential. Nine remote migration history IDs were reconciled at checkpoint 111; rated migration ten remains unapplied.
- **IN_PROGRESS, all 20 gates OPEN, rated OFF.** S0 genuine three-identity HTTPS Auth/RLS/Origin/Host blocked by protected Preview secret and live acceptance setup; S1 two-client private Realtime, S2 independent PG locks/clocks, S3 rated settlement, S4 complete engine/hosted learning/profiles, S5 community/tournaments, S6 independent audit outstanding. No main merge/production deployment.

## 2026-10-31, checkpoint 116 — three ranked Analysis candidates

- Enhanced the original two-ply Analysis worker to return up to three legal root moves ranked by the existing heuristic, with stable tie ordering and individual White-relative centipawn estimates. Existing best-move output stays compatible; finished games produce no candidates.
- Analysis presents SAN and evaluation for each candidate with a keyboard-accessible Try action. Choosing a candidate makes a legal move and clears stale suggestions after the position changes. Text explicitly identifies this as a shallow heuristic rather than a strong engine.
- Evidence: pinned migration hashes **9/9**, ESLint, strict TypeScript and **194/194 Vitest PASS**. `npm run check` failed only during restricted Windows standalone file copying (`EPERM`); separately approved production `npm run build` **PASS**, generating 17 static pages. Focused real-worker Chromium **1/1 PASS**; entire local/mock production Chromium **95/95 PASS**, one opt-in genuine hosted Supabase test **SKIP**.
- CH-12 analysis remains partial. Preview-only server Supabase secret and genuine HTTPS Auth/RLS/Realtime remain unverified; independent PostgreSQL clocks/concurrency, rated settlement, full engine/learning, community and 20 release gates remain open. Rated OFF; development branch only pending verified release readiness.

## 2026-10-31, checkpoint 114 — Analysis move numbering from arbitrary FEN

- Corrected Analysis history for imported/setup positions starting with Black to move or with a non-1 fullmove number. The move ledger now groups SAN by the FEN's actual turn and fullmove counter, keeps White/Black columns aligned, and navigates to the exact underlying ply. Standard starting positions retain their normal labels.
- Added a focused unit case for standard, Black-at-move-8, White-at-move-42 and empty histories; real production Chromium imports `8... Kd7 9. Ke2 Ke6 10. Ke3`, checks correct `8...`/`9.`/`10.` labels and navigates by click.
- Evidence: SQL migration snapshot/source parity **9/9**, lint PASS, strict TypeScript PASS, **194/194 Vitest**, separately authorized Next Webpack production build **17/17 static pages**, **95/95 local/mock production Chromium PASS** with **one real hosted Supabase E2E SKIP**. The composite build first encountered Windows sandbox `EPERM` while copying `.next/standalone`; separately approved full build succeeded, exit 0.
- Git-linked project audit: `chessonline` does not appear among Vercel's linked Git projects; the existing Preview remains for an older commit. Current SHA needs Linux CI after push and a safely scoped exact-SHA Preview. The dedicated staging server-only Supabase secret is still unverified in Preview; genuine HTTPS three-user Auth/RLS/Realtime, database clock/race tests, rated settlement, engine/learning and community remain open. **20/20 release gates OPEN, rated OFF; no production or main release.**

## 2026-10-31, checkpoint 111 — backed-up Supabase migration reconciliation

- GitHub Actions run `41199930822` succeeded on pushed SHA `e0186b8`; latest listed Vercel Preview remained older SHA `26812565`. Explicit Preview-only CLI attempt failed fetching npm metadata/auth before deployment.
- Direct Supabase SQL confirmed all nine remote migration SQL MD5s match local sources. Saved the nine original remote version IDs, names and hashes in `docs/agent-state/STAGING_MIGRATION_HISTORY_SNAPSHOT_2026-10-31.json`, verifying 9/9 source hashes and unique IDs.
- A single guarded UPDATE changed only the nine migration-history `version` values; the database independently returned **9/9 local versions, 0 old versions and 9 intact statement arrays**. No app tables or rated SQL migration changed. Snapshot enables reversal.
- Post-reconciliation validation: `npm run verify:migrations` **9/9 PASS**; completed production Chromium suite **94 local/mock PASS, one actual hosted Supabase E2E SKIP** (process exit 0). Earlier in this checkpoint: 193 Vitest, lint, strict TS, and separately authorized 17-page Next production build PASS; composite restricted Windows build hit `EPERM`.
- Remaining S0: confidential Preview-only Supabase server key and genuine three-user HTTPS Auth/RLS/Origin/Host. S1-S6 and all 20 release gates remain OPEN; rated OFF.

## 2026-10-31, checkpoint 110 — live Realtime acceptance instrumentation

- Extended the opt-in **real Supabase** staging browser test: three separately authenticated publishable-key clients subscribe to the same private game; after two concurrent legal move requests yield exactly one accepted ply, both participants must receive that committed ply through actual Postgres change sockets, while the unrelated third identity must receive no event. Channel subscriptions, timeout/error detection and cleanup are explicit.
- This is **test coverage awaiting hosted execution**, not a passing Realtime acceptance result. Staging still lacks a confidential Preview server-only Supabase credential and approved, backed-up migration-version reconciliation; do not enable the opt-in test against a mock or count the SKIP as a pass.
- Verified SQL snapshot hashes **9/9**, lint, strict TypeScript and **193/193 Vitest** in the composite check. The sandboxed Next build failed with Windows `EPERM` at `.next/server/app/play.segments/play`; independently authorized `npm run build` exited **0**, producing all 17 static pages. Authorized production Chromium: **94 PASS / 1 actual hosted staging SKIP** (exit 0). An initial restricted browser-server launch hung without listening and was stopped.
- Checkpoint 109 development SHA `7e9bfd9cdf46a6cfbcd0e0649ebe9ac95ce5d0d7` was pushed and independently passed Linux Actions `41197431747`; the previous protected Preview `dpl_32fNgF6dVJGE6qQEc9ZdfbzRW1kV` READY applies to an earlier SHA. This checkpoint's new SHA needs independent CI/Preview verification after publish.
- **S0 BLOCKED_EXTERNAL; S1-S6 pending; all 20 release gates OPEN; rated OFF.** Neither merge to `main` nor production deployment is permitted at this readiness level.

## 2026-10-31, checkpoint 109 — SAN keyboard moves

- Added position-aware, read-only SAN conversion for local/computer, Analysis and online room keyboard entry, retaining coordinate/UCI notation; accepts legal moves such as `Nf3`, `O-O`, `0-0-0` and promotions with SAN check suffix. Illegal/out-of-turn SAN remains rejected by chess.js.
- Unit test first reproduced missing conversion (RED), then passed. Restricted `npm run check` passed SQL fingerprint verification (9/9), lint, strict TS and **193/193 Vitest (28 files)** but hit Windows sandbox `EPERM` creating `.next/types`; independently authorized `npm run build` exited 0 and generated 17 static pages. Focused production Chromium 1/1 PASS; full production Chromium **94 local/mock PASS / 1 genuinely hosted staging SKIP** (exit 0).
- Previous checkpoint 108 was pushed at `26812565ce67fc113eeefaaa8cfe3ca281f39a61`; exact-SHA Linux Actions `41196169589` SUCCESS and protected Vercel Preview `dpl_32fNgF6dVJGE6qQEc9ZdfbzRW1kV` READY at that SHA. Authenticated Preview `vc curl` failed during unrelated npm dist-tag metadata retrieval, so HTTP status for that deployment is **unverified**.
- S0 **BLOCKED_EXTERNAL**: server-only Preview Supabase credential, backed-up reconciliation of nine remote migration version IDs and genuine three-user HTTPS Auth/RLS/Origin/Host. S1–S6 and **20 final gates OPEN**; rated mode OFF; no `main` merge or production release.

## 2026-10-31, checkpoint 108 — keyboard-accessible game settings

- Reproduced a real Chromium failure: computer strength was visually active, but the selected button had no `aria-pressed` state. Added `aria-pressed` to the mutually exclusive time control, strength and playing-side buttons; a focused keyboard Enter test now passes for all three groups.
- **Full authorized `npm run check` PASS**: 9/9 pinned remote SQL source hashes, ESLint, strict TypeScript, 192/192 Vitest (28 files), complete Next 17-page production build. **Production Chromium 93/93 local/mock PASS, 1 genuine hosted staging SKIP**. This is local UI accessibility evidence, not full screen-reader or hosted multiplayer signoff.
- Prior checkpoint 107 was published as `f1119cac5cd030fdafade9ac8a42d38cc051c0b2`; its exact-SHA Linux Actions run `41195205056` succeeded and protected Preview `dpl_5MUgUeUcQDgnPUf8SYyrMqYueUvb` is READY. Authenticated `vc curl` verified six HTML routes `200`, anonymous preferences `401`, `/api/games` `503` from missing Preview server-only Supabase credential; raw unauthenticated requests receive Vercel `302` protection.
- S0 still **BLOCKED_EXTERNAL**: provide isolated Preview server secret, reconcile nine divergent migration history IDs after backup and verify genuine three-user HTTPS Auth/RLS/Host/Origin. S1–S6 and **20 acceptance gates remain OPEN**; rated OFF, production withheld.

## 2026-10-31, checkpoint 107 — persistent computer strength

- Found that computer difficulty selection reverted to medium after reload, even though the PGN and clocks survived. GameWorkspace now saves `level` only for computer mode, restores easy/medium/hard/advanced, defaults to medium for absent/unknown legacy values without destroying the saved match, and retains selected difficulty on New game.
- Real production Chromium regressions: strength persists across midgame reload and reset; legacy and invalid strength snapshots retain saved PGN. **2/2 focused PASS; 92/92 full local/mock Chromium PASS / 1 actual hosted Supabase SKIP.**
- **9/9 pinned SQL source hashes, lint, strict TS, 192/192 Vitest in 28 suites PASS.** Composite `npm run check` hit Windows sandbox `EPERM` during `.next/types` mkdir; separately authorized `npm run build` PASS with 17/17 static pages. Prior `aaf2057` CI `41193754781` SUCCESS, Preview `dpl_6sZz7LJMZhT1cu1q1MQgSkiPmX3g` READY. New-SHA publication and independent CI/Preview verification pending. Genuine three-user Supabase staging/rated verification remains blocked; all 20 acceptance gates OPEN.

## 2026-10-31, checkpoint 106 — branched Analysis PGN metadata

- Real Chromium RED test reproduced lost Event/White/Black tags when continuing a different line after importing a completed PGN. The export reconstructs changed lines with validated PGN headers, `Result "*"`, custom start FEN and no stale tags after Reset. Added dedicated unit coverage and Chrome end-to-end export/download/reparse verification.
- Approved native `npm run check` PASS: 9/9 pinned migration SQL source hashes, ESLint, strict TypeScript, 192 Vitest in 28 suites and Next Webpack optimized build (17/17 generated pages). Full production standalone Chrome E2E **90 local/mock PASS / 1 real Supabase hosted SKIP**. Corrected an E2E Reset assertion because chess.js parses an empty PGN with default `Event "?"`.
- Previous development SHA `1f8180e` verified Linux quality run `41175549147` SUCCESS; its protected Vercel Preview `dpl_22EY7qUTQGSuBvBxvHX9aEUVerKh` READY with six public HTTP 200 routes; anonymous preferences 401 and games 503. New slice remote attestation pending until published.
- Full release **IN_PROGRESS, 20/20 OPEN, rated OFF**: missing Preview server-only Supabase secret, backed-up reconciliation of nine remote migration-version IDs, real HTTPS Auth/RLS/Origin/Host users, two-client Realtime, independent PG clock/race, ratings, engine/learning, community and independent acceptance. No production deploy or `main` merge.

## 2026-10-31, checkpoint 105 — portable Analysis PGN file import

- Added 32-KiB UTF-8 bounded `.pgn` upload alongside paste, parsing via chess.js with headers, BOM and custom starting FEN; validation preserves the current board on invalid/oversized files. Same-file retries work; late file reads cannot overwrite newer manual PGN, FEN, navigation, moves or resets. Fixed singular `1 ply` status.
- Unit tests validate syntax, headers/setup and byte limits. Real Chromium tests cover file round-trip, preserved headers, invalid/oversize inputs, retry and the controlled slow-read race.
- Native `npm run check` **PASS**: 9/9 pinned local SQL source hashes, ESLint, TypeScript, 191 unit cases / 28 files, 17/17 production static pages. Full pre-final-text-fix standalone Chromium **89 local/mock PASS / one genuine hosted SKIP**; two impacted scenarios rerun after final change **2/2 PASS**. Initial restricted build hit Windows `EPERM`; approved native check passed.
- CH-12 remains PARTIAL; release needs real S0 three-identity HTTPS hosted Auth/RLS and migration reconciliation, followed by S1-S6. All 20 gates OPEN, rated OFF. Development SHA publish/CI and protected Preview follow.

## 2026-10-31, checkpoint 104 — portable opening and lesson mastery

- Added typed, validated, capped study backup format (`rookline-study`, v1) and per-page export/import buttons. Both opening and lesson completions move between devices; import unions only known line/side IDs with the latest in-memory and storage state, keeping progress earned during async file reads. Unwritable localStorage leaves imported mastery available in memory with a warning.
- Full verification: **189 unit PASS / 27 files, 9 SQL source hashes PASS, ESLint/TypeScript PASS, elevated Next production build 17 pages PASS, 87 actual Chromium local/mock PASS / 1 hosted staging SKIP**. Unprivileged standalone packaging hit Windows `EPERM` after successfully generating the pages.
- Previous puzzle backup commit `1031ff0` confirmed GitHub Actions `41173151936` SUCCESS and protected nonproduction Preview `dpl_GEMrX6mNL9PMsMcjxArosk72aqVM` READY. HTTP smoke attempt failed at Vercel CLI npm metadata retrieval; it did not reach the website. Current study slice requires commit/push and new CI/Preview verification.
- Release remains S0 BLOCKED_EXTERNAL: dedicated Preview server-only Supabase secret, backed-up migration-version reconciliation and genuine hosted HTTPS three-identity acceptance. All 20 release gates OPEN, rated OFF.

## 2026-10-31, checkpoint 102 — portable puzzle-progress backup

- CH-13 now exports a versioned JSON file containing known puzzle completions and bounded adaptive practice counts; import rejects malformed, oversized, unrelated and future versions, merges existing progress using maximum per-counter values and preserves in-memory updates during asynchronous file reading. Uses original local-only catalog; no hosted account synchronization is claimed.
- Local validation: nine pinned migration source hashes PASS (remote not re-queried), lint/typecheck PASS, **185 Vitest in 26 files PASS**, independently approved 17-page Next production Webpack build PASS, **86 local/mock Chromium PASS / 1 actual hosted Supabase test SKIP**. Composite `npm run check` completed all prebuild checks and generated 17 pages but failed `EPERM` copying standalone files in Windows sandbox; standalone elevated build exited 0.
- GitHub exact-SHA Linux CI and protected Preview for this slice are pending. **S0 blocked by missing secure Preview server secret and unreconciled nine remote migration version IDs**; S1–S6 and **20 gates OPEN**, rated OFF. No production deployment or main merge.

## 2026-10-31, checkpoint 101 — verified Linux CI and protected Preview

- CH-12 code, regression and evidence pushed to development SHA `4f843739e06f2ccb56268772e7b61599d94b3d6b`, confirmed identical `git ls-remote` and clean checkout. Exact-SHA Linux GitHub Actions **41171634271 completed/success** (2026-10-31 05:15:06 UTC). Locally previously verified 181 Vitest, 9 local SQL fingerprints, lint/types, 17-page production build and 85 local/mock Chromium PASS / 1 genuine hosted SKIP.
- Clean-checkout manual Vercel CLI deployment `dpl_6tu8eCbYNtjKE6JNPpiM3BcQnEfH` (`https://chessonline-g0p2zudps-hnquan.vercel.app`) independently inspected as **target preview / READY**; Vercel remote Next.js Webpack build completed 17/17 static pages. Protected HTTPS `vercel curl` returned `/`, `/analysis`, `/play/local`, `/login`, `/play/online` all **200**; anonymous `/api/preferences` **401**, `/api/games` **503**. The CLI deployment metadata does not independently attest Git SHA.
- Vercel environment metadata (without decrypting values) shows exactly `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Preview; the required server-only Supabase key is absent. S0 actual three-user Auth/RLS/Origin/Host and backed-up migration-version reconciliation remain blocked; S1–S6 and **all 20 acceptance gates OPEN**, rated OFF; production/main withheld.

## 2026-10-31, checkpoint 100 — analysis Worker timeout/recovery

- CH-12: Added a 30-second watchdog to original two-ply analysis Worker. An unresponsive Worker terminates with a recoverable error and enabled retry; successful/error replies clear timers. Replacing a search, changing position or unmounting cancels a pending watchdog and invalidates late messages. Browser regression drives a silent controlled Worker through timeout, retry, delayed replies and navigation; **1 focused Chromium PASS**.
- On a production standalone build, **85/85 local/mock Chromium PASS**, one genuinely hosted Supabase scenario SKIPPED (86 discovered). Migration snapshot hashes **9/9**, ESLint, strict TypeScript, **181/181 Vitest**, and separately authorized production Webpack build **17/17 pages PASS**. The unprivileged composite build was interrupted at `EPERM mkdir .next/types/app/games`; the standalone elevated build exited 0. `git diff --check` reports no whitespace errors.
- S0 isolated hosted Auth/RLS/Origin/Host still BLOCKED_EXTERNAL: Preview lacks a server-only Supabase credential; 9 migrated SQL bodies match but remote migration versions need backup/reconciliation. S1–S6 and **all 20 release gates OPEN**, rated mode OFF, production withheld.

## 2026-10-31, checkpoint 96 — exact-SHA Linux CI and isolated Vercel Preview

- Confirmed clean development checkout `b17e315a57640a29717b077fc8fcc4221433d468` tracking `origin/codex/chess-platform-foundation`. GitHub Actions quality run `41168960921` on that exact SHA completed **SUCCESS** (2026-10-31 04:35:38 UTC). Prior checkpoint 95 local proof remains **181 Vitest**, 9 local migration hashes, lint/types, 17-page production build, **84 local/mock Chromium PASS / 1 real hosted SKIP**; no new local test suite was rerun in this deployment-only slice.
- Deployed nonproduction protected Preview `dpl_HCp9Rn2osiGHTbv3QHwKw8NeEivC` (`https://chessonline-2fqv1iisd-hnquan.vercel.app`) from that clean local checkout. Remote Next.js 16.4.3/Webpack build passed TypeScript and **17/17 static pages**; `vercel inspect` returned **target preview, READY**. CLI `vercel curl` returned Rookline HTML from `/` and HTTP **200** for `/play/local`, `/login`, `/analysis`, `/play/online`. `/api/preferences` unauthenticated returned **401**; `/api/games` returned **503**, body `Chess service is not configured.` Manual CLI metadata did not independently prove git source SHA.
- Next acceptance blocker **S0**: dedicate a Preview-only server Supabase secret without logging it; execute three genuine HTTPS Auth identities/RLS/Origin/Host, safely reconcile remote nine migration version IDs after backup. S1 Realtime, S2 independent PostgreSQL transactions/clocks, S3 rated pairing/settlement, S4 engine/learning, S5 community/tournaments and S6 independent all-20-gate audit are unproven. **IN_PROGRESS, 20 OPEN, rated OFF.** No production deploy or `main` merge.

## 2026-10-31, checkpoint 95 — preserve verified online rooms across disconnects

- Transport-only GET failures now retain the last accepted private board/PGN in a read-only disconnected state, freeze displayed clock estimates and prohibit moves, draw claims, resignations, challenge cancellation and repeat invitations. An offline event aborts in-flight room reads to prevent an obsolete response from re-enabling play. The invite acceptance button is disabled until an authoritative online refresh. Explicit denied/malformed HTTP responses still invalidate protected room state.
- Production-build Chromium regressions verify interrupted game sync, clock freeze, online recovery, and offline invite acceptance. Full suite **84 local/mock PASS / 1 genuine hosted Supabase SKIP** (85 discovered; exit 0). Pinned local migration fingerprints **9/9**, ESLint, strict TypeScript, **181/181 Vitest** and separate authorized Webpack production build **17/17 static pages** PASS. The first restricted build hit Windows `.next` EPERM, but elevated build passed. The sandboxed E2E server did not open its localhost port, and its run was interrupted; elevated standalone E2E passed.
- **IN_PROGRESS, all 20 acceptance gates OPEN, rated OFF**. Genuine HTTPS three-identity Supabase Auth/RLS/Origin, two-browser Realtime, independent Postgres lock/clock races, rated settlement, learning/engine, community and independent release audit remain outstanding. Dedicated Preview server-only Supabase secret and backed-up reconciliation of nine divergent migration version IDs remain S0 external blockers. This checkpoint's remote SHA/CI and Preview need independent evidence after publication; no production deploy or `main` merge.

## 2026-10-31, checkpoint 92 — new development SHA verified remotely

- The verified fresh-invitation slice was committed and pushed on `codex/chess-platform-foundation` as `0d3d6e34124d78027c1ac6a7ba7c648f2ebab3ed`; worktree clean after push. GitHub Linux Actions run `41165982373` at that **exact SHA finished SUCCESS**. Its `quality` job passed migration source verification, security audit, lint, strict TypeScript, Vitest, Next Webpack production build and Chromium Playwright.
- From the clean checkout at this SHA, deployed Vercel nonproduction Preview `dpl_8NWurTbNrqoZsdyFABAkNM8m5xMW` (**READY**, `target=preview`). Protected authenticated HTTPS smoke returned `/` **200**, `/play/local` **200**, `/login` **200**, `/api/games` **503** (server-only Supabase credential still absent) and `/api/preferences` **401** (anonymous). Local CLI upload does not independently prove the Git SHA in deployment metadata; the source was clean at deployment.
- Hosted three-identity Auth/RLS and real Realtime acceptance still **BLOCKED_EXTERNAL**. Do not provision the missing high-privilege secret in browser-facing settings. S0–S6 and all 20 acceptance gates remain OPEN; rated mode OFF, `main` and production untouched.

## 2026-10-31, checkpoint 91 — repeat private invitation after an unrated match

- Finished or cancelled unrated rooms now offer an explicit fresh private challenge with the same allowlisted time control. Only a room participant may use the action; the other player must accept the newly created invitation. The UI tracks pending mutations, disables duplicate submission, recovers from service errors, rejects non-UUID response IDs and abandons stale requests after room changes.
- Two new production-build Chromium scenarios **PASS** (finished Black viewer starting a new 3+2 invitation; cancelled 10+0 invitation retrying after 503 and rejecting a malicious returned ID). Full native standalone Chromium suite **82 local/mock PASS / 1 genuine hosted Supabase SKIP**, exit 0. Migration source parity **9/9**, ESLint, strict TypeScript, **181 Vitest**, and separately permission-approved Webpack **17/17 pages** PASS. The ordinary sandboxed Chromium server did not start and was interrupted; the approved retry passed.
- Existing development HEAD before this slice: `9d5934c`. New slice's commit, GitHub CI and Preview evidence must be verified independently. **All 20 release gates OPEN, rated OFF.** S0 still needs secure server-only Preview Supabase credentials, three real identities over HTTPS and backed-up remote migration version reconciliation. S1 genuine two-browser Realtime, S2 database locks/clocks, S3 rated settlement, S4 learning/engine, S5 community and S6 independent full release audit remain pending. Do not merge `main` or deploy production.

## 2026-10-31, checkpoint 88 — silent computer Worker timeout regression

- Added RED/GREEN real Chromium coverage for a Worker that never replies: fast-forward 31 seconds, observe the recoverable error, reset, reject the expired worker's stale move and accept the new worker's legal move. `GameWorkspace` now limits outstanding computer requests to 30 seconds and cleans up its timer after any reply/error/reset. **1 focused PASS, 80 full local/mock Chromium PASS / 1 genuine hosted SKIP**.
- **181 Vitest / 25 files**, ESLint, strict TypeScript and **nine pinned local SQL hashes** passed; the composite build hit Windows `.next` `EPERM`, but a separately authorized Next Webpack build passed **17 pages**. The prior development SHA `d014ba2` passed GitHub Linux Actions run `41162482779`, and its matching protected nonproduction Vercel Preview is READY (`dpl_CBwr35UWtmyHTy4uwhMYtjbzWGSi`); the new changes have not yet been published.
- **Critical path:** S0 Preview-only Supabase server secret, three genuine HTTPS Auth/RLS/Origin/Host users and backed-up reconciliation of nine migration version IDs; S1 true two-browser Realtime/reconnect; S2 separate PostgreSQL clock/row-lock races; S3 rated atomic settlement/matching; S4 licensed engine and learning; S5 community/tournaments; S6 independent 20-gate release audit. **All 20 gates OPEN, rated OFF**. Commit and push the verified development slice, verify Linux CI and protected Preview at the new SHA; retain `main` and production until release gates pass.

## 2026-10-31, checkpoint 87 — computer Worker recovery verified locally

- Real Chromium regression was RED before repair when `new Worker()` threw a synchronous `SecurityError`. The computer board now catches constructor and initial-message exceptions and displays a recoverable engine error; starting a new game retries cleanly without stale replies. Added a second `postMessage()` rejection scenario. Focused production Chromium **2/2 PASS**; entire standalone suite **79 local/mock PASS, 1 real hosted Supabase SKIP**.
- `npm run check` **PASS** (9 pinned SQL hashes, ESLint, strict TS, **181 Vitest**, 17-page Webpack build). Fixed an effect cleanup lint warning and rechecked ESLint/types/build with no warnings. Default localhost port 3100 was occupied, so authorized tests used port 3193.
- **Next critical path:** S0 isolated Preview server-only Supabase credential, actual three-user HTTPS Auth/RLS/Host/Origin and backed-up migration history reconciliation; S1 independent two-browser Realtime; S2 two-connection PostgreSQL transaction/clock races; S3 rated matching/exactly-once settlement; S4 licensed analysis/learning; S5 community/tournaments; S6 independent acceptance of all 20 gates. **20 OPEN, rated OFF, IN_PROGRESS.** Push the development branch and verify exact-SHA CI and protected nonproduction Preview; production and `main` await full approval and evidence.

## 2026-10-31, checkpoint 84 — Linux CI green and protected Preview ready

- Committed and pushed the standalone E2E CI repair as `0e942c9825b945dfbfc9b1ef4a6ee088eb650285` on `codex/chess-platform-foundation`, leaving `main` unchanged. GitHub Actions run `41160142549` at that exact SHA finished **SUCCESS**: the Linux Playwright job reports **77 passed / 1 hosted skipped**; all preceding workflow quality steps succeeded.
- Deployed a **non-production** protected Vercel Preview from that local commit: `dpl_3qgENd5k9Vxtvw1eaMW1tRHDcPBB` is **READY** (17 static pages built). Authenticated HTTPS smoke: `/`, `/play/local`, `/login` **200**; anonymous `/api/games` **503** (Supabase server secret absent), `/api/preferences` **401**. Vercel CLI inspect confirms `target=preview` but exposes no `gitSource` metadata, so the platform does not independently attest the source SHA.
- Read-only Supabase project inspection confirmed `chessonline` healthy with nine applied migrations, RLS enabled on seven public tables, and one informational deny-all RLS advisory for `game_rate_limits`. Only the two `NEXT_PUBLIC_SUPABASE_*` variables exist in Preview; no server-only key. Migration SQL hashes match nine local pinned sources but remote migration **version IDs differ**.
- **S0 remains BLOCKED_EXTERNAL:** provision an isolated server-only secret in Preview, verify three real HTTPS identities/Auth/RLS/Host/Origin, back up and reconcile migration history before any `db push`. Then execute S1–S6 and independent 20-gate acceptance. **20 OPEN, rated OFF, no production deployment or `main` merge.**

## 2026-10-31, checkpoint 83 — test the built standalone product in CI

- The pushed `471eae2` Linux Actions run `41158246211` **FAILED**: 76 browser cases passed, one real hosted case skipped, and the initial Analysis Web Worker test timed out. Playwright trace records its on-demand `next dev` worker-chunk request still pending with no response after the 20-second assertion window. The same commit's protected Preview `dpl_DYrNBjNUMN3y7w7q78z4MRVuqGSN` is READY; authenticated smoke returns `/`, `/play/local`, `/login` HTTP 200, anonymous `/api/games` 503 and `/api/preferences` 401.
- Next.js 16.4.3 documentation requires running the standalone `server.js` with public/static assets copied in. Playwright now runs this **already-built production artifact in CI** (also opt-in locally with `ROOKLINE_E2E_PRODUCTION=1`), leaving local dev-server tests available. This avoids worker recompilation during acceptance testing and exercises the exact production bundle.
- Verified against the existing unchanged 17-page production build: focused Analysis Worker Chromium **3/3 PASS**, full standalone browser **77/77 local/mock PASS / 1 actual hosted Supabase SKIP**. ESLint, strict TypeScript, **181/181 Vitest**, and nine pinned migration hashes PASS; diff checked. New commit's Linux run and deployment SHA verification still pending.
- Real three-user HTTPS Supabase Auth/RLS, private Realtime, independent Postgres clock/race tests, rated settlement, remaining learning/community features and independent 20-gate acceptance are still outstanding. Preview lacks a server-only Supabase secret; remote migration version IDs require backup and reconciliation. **20 gates OPEN, rated OFF, IN_PROGRESS; no production or main merge.**

## 2026-10-31, checkpoint 82 — reject impossible invitation cancellation snapshots

- Prior published `a5fae1b9c156bb8d303045414ce4d26460125087` passed Linux GitHub Actions run `41149734462`; protected non-production Vercel Preview `dpl_9BKDPUxLFYBHUPMyTRgsC8LmUfGj` was READY at the same SHA. These checks precede the new cancellation fix.
- A later HTTP snapshot could previously mark an active/played game `cancelled`, or rewrite clocks and player seats while claiming a waiting invitation was cancelled. Added a RED/GREEN regression and restricted cancellation to an unchanged unjoined `waiting` invitation; previously accepted identical terminal states stay valid.
- Focused **26/26 Vitest PASS**; nine pinned migration fingerprints, ESLint, strict TypeScript and full **181/181 Vitest PASS**. Combined `npm run check` reached build but failed Windows sandbox `EPERM` creating `.next/types/app/api/games`; separate approved `npm run build` succeeded, **17/17 static pages**. Full approved Chromium on port 3227 exited 0: **77 local/mock PASS / 1 real hosted staging SKIP**.
- Current local runtime presence-only probe finds no Supabase URL, public key or server secret. Previous Preview inventory had only the two public variables. Genuine HTTPS three-person Auth/RLS/Origin, private Realtime, independent PostgreSQL lock/clock races, rated settlement, remaining learning/social features and independent acceptance remain unverified. Reconcile nine remote migration version IDs from a backup before any schema push. **All 20 gates OPEN, rated OFF, IN_PROGRESS**; publish only the development branch and protected Preview.

## 2026-10-31, checkpoint 81 — immutable game metadata across online transitions

- GitHub Actions run `41148295733` for prior published commit `67759355e39350cfe69bddfba80b4dcf9b1bf8c7` finished **SUCCESS**; protected non-production Vercel deployment `dpl_6Q2KGSJYRxhAmp9v5fy4QFAWSaaF` is **READY** and reports the exact same source SHA. Vercel project still has SSO enabled and only two Preview public Supabase settings; no server-only credential. Local HTTP smoke could not resolve the Vercel hostname in the restricted DNS environment, so READY is not treated as an HTTP smoke pass.
- Found a further snapshot transition integrity gap: replayable online move/phase responses could rewrite White identity, rated classification, original time control or creation time; an active room could lose its Black participant, and a terminal response could name an unrelated winner. Added a failing regression, then rejected these changes while allowing a waiting room to acquire its Black seat, legal moves and terminal transitions. Existing malformed-ledger recovery is retained.
- Focused regression **RED before fix**, then **25/25 Vitest PASS**. Nine pinned migration SQL hashes, ESLint, strict TypeScript and full **180/180 Vitest PASS**; the restricted composite `npm run check` hit Windows `.next` `EPERM` at build, followed by separate approved Webpack **17/17 page build PASS**. Full approved Chromium: **77 local/mock PASS, 1 real hosted Supabase SKIP** (exit 0) using port 3227; initial port 3100 was already occupied, and sandboxed port 3117 did not open before cancellation.
- Real HTTPS multiuser Auth/RLS/Origin, private Realtime, independent Postgres locks/clocks, rated settlement and the full product acceptance gates are unverified. Nine remote migration version IDs still need backup and reconciliation before schema push. **20 OPEN, rated OFF, IN_PROGRESS; no `main` merge or production deploy.**

## 2026-10-31, checkpoint 80 — verify future game ledger before accepting a new ply

- Previously, an HTTP reply with a larger ply or later lifecycle phase bypassed PGN/FEN/turn replay checks and could replace a valid online room with forged, inflated or divergent history. `isOlderGameSnapshot` now replays the incoming ledger and checks its SAN prefix against the accepted history; verified later records can still repair a previously malformed snapshot. Same-ply and terminal immutability checks remain intact.
- Added unit coverage for inflated ply, invalid PGN/FEN/turn, valid but divergent moves, legal continuation and completion; added a real Chromium mock-HTTP regression. Updated the existing sound regression to assert an invalid higher-ply response is silently rejected without changing history or playing audio. Full **elevated `npm run check` exit 0**: 9/9 pinned offline migration hashes, ESLint, strict TypeScript, **179/179 Vitest** in 25 files, Webpack **17/17 prerendered pages**. Full elevated Chromium **77 local/mock PASS / 1 guarded real hosted Supabase SKIP**, exit 0. Initial restricted build hit Windows `.next` `EPERM`; elevated rerun passed.
- The HTTPS three-identity Supabase/Auth/RLS/Origin test was skipped, not passed. Remote migration version IDs still differ despite matching nine SQL source hashes; backup and reviewed reconciliation precede `db push`. S0 staging server-only credential, S1 real Realtime/reconnect, S2 independent PostgreSQL clock/lock races, S3 rated settlement, S4 engine/learning, S5 community and S6 independent full audit remain. **All 20 acceptance gates OPEN; rated OFF; IN_PROGRESS; no `main` merge or production deployment.**

## 2026-10-31, checkpoint 77 — consistent same-ply snapshots with replay recovery

- Active/waiting game room rejects equal-phase/equal-ply contradictory clocks, FEN, PGN, clock anchors, participants and rated flags; an invalid ledger can recover when a later server record replays correctly. Previously committed terminal game snapshots remain immutable.
- Focused **23 Vitest** and **2 real Chromium** regression cases PASS. Elevated `npm run check` exit 0: nine pinned migration SQL hashes, ESLint, strict TypeScript, **178 Vitest** across 25 files, optimized Webpack **17/17 pages**. Full Playwright exit 0: **76 local/mock PASS and 1 genuine hosted Supabase SKIP** (77 discovered). `git diff --check` no whitespace issues.
- Prior pushed `c1fe228` had Linux CI run `41143891998` SUCCESS and protected Preview `dpl_EGrBPMPV5t9pujnhnEvEQUmXEgiU` READY; current checkpoint needs independent new-SHA remote verification.
- S0 still awaits isolated server-only Supabase credential and genuine three-user HTTPS Auth/RLS/Origin, and nine content-matched remote migration version IDs require backup/reconciliation before CLI push. Then S1 Realtime/reconnect, S2 independent DB clock/row-lock races, S3 rated settlement, S4 study/engine, S5 community, S6 independent audit. **20 release gates OPEN; rated OFF; IN_PROGRESS; production/main withheld.**

## 2026-10-31, checkpoint 76 — immutable terminal game records

- Reproduced a same-status, same-ply terminal snapshot regression: a late HTTP response could replace a finished game's winner, result, clocks or PGN/FEN while retaining `completed` status. A mismatched game ID was also accepted. Tightened `isOlderGameSnapshot` to preserve all committed terminal fields by key and reject foreign IDs, while permitting identical records regardless of object key order.
- RED focused Vitest before repair (1 failed), then **22/22 focused and 177/177 total unit tests PASS**. Strengthened the Chromium regression to await completed HTTP responses and animation frames before checking final resignation, frozen clock and disabled controls. Focused Chromium **1 PASS**, full local/mock Chromium **75 PASS / 1 real Supabase SKIP**. Complete elevated **`npm run check` exit 0**: 9/9 offline migration hashes, lint, strict TypeScript, unit tests and 17/17 Webpack pages.
- Remaining release-critical S0 requires secure Preview-only server credentials and actual three-user HTTPS Auth/RLS/Origin checks. Remote migration version IDs still differ from nine content-matched SQL files; no CLI push until backed-up reconciliation. S1 real Realtime, S2 independent PG concurrency/clocks, S3 rated ledger, S4 learning/engine, S5 community and S6 independent 20-gate audit remain. **All 20 OPEN; rated OFF, IN_PROGRESS.**

## 2026-10-31, checkpoint 75 — terminal online state cannot be resurrected

- Confirmed the previously pushed `bd7b4cf` finished Linux Actions run `41139635719` with all quality steps GREEN, including browser checks. Its protected Vercel Preview `dpl_59SVisnhrskhKTgW2CFgXaPJBpDj` was READY; Preview has two public Supabase settings and no server-only key.
- Reproduced a browser state regression in `isOlderGameSnapshot`: a contradictory later HTTP response with a higher ply could turn a completed/cancelled game back into active play. Added RED/GREEN unit checks and browser coverage; a terminal snapshot now rejects changes in terminal kind or ply, and phase regression is considered before ply advancement.
- Local verification: pinned migration SQL hashes 9/9, ESLint and strict TypeScript PASS; **176 Vitest PASS**. Composite `npm run check` exited 1 only on a Windows sandbox `EPERM` creating `.next/server/app/analysis`; a separately authorized production build exited 0 with **17/17 static pages**. Targeted Chromium 1/1 PASS; full Chromium **74 local/mock PASS, 1 real Supabase hosted SKIP**. These checks do not prove live Auth/RLS, Realtime, independent PG clocks/races or rated settlement.
- The next critical path is isolated Preview server-only Supabase credentials plus genuine three-user HTTPS Auth/RLS/Origin checks; before DB CLI sync, back up and reconcile nine migration history version IDs. Then S1 live Realtime, S2 two independent PG connections, S3 durable rated settlement, S4 learning/engine, S5 community, S6 complete independent acceptance. **All 20 gates OPEN; rated OFF.** Production and `main` remain withheld.

## 2026-10-31, checkpoint 74 — puzzle hydration and CI browser race

- Inspected GitHub Actions runs `41137690679` and `41138490018`: both passed pre-browser checks but failed the same adaptive puzzle reload assertion at `e2e/rookline.spec.ts:350` (72 browser PASS / 1 FAIL / 1 real hosted SKIP). Run `41138300540` passed, confirming intermittent behavior.
- Corrected the reload initialization race: puzzle controls remain disabled until client progress hydration completes; theme/adaptive selection reads the latest device snapshot when used. The UI no longer accepts a pre-hydration topic change with empty default completion data.
- Local proof: complete `npm run check` exited 0 (migration fingerprints 9/9, lint, strict TypeScript, Vitest 175/175, Webpack 17-page production build). Focused adaptive puzzle Playwright 3/3 PASS, full Chromium 73 local/mock PASS / 1 real hosted SKIP. The skipped hosted scenario still requires secure real Supabase Auth staging. Production and `main` remain untouched; all 20 acceptance gates OPEN and rated OFF. Remote post-fix CI and Preview require separate confirmation.

## 2026-10-31, checkpoint 73 — CI migration parity gate

- After publishing source/remote parity evidence as commit `7e2fe5a`, audited `.github/workflows/quality.yml`: CI explicitly ran lint, types, tests and build rather than `npm run check`, so the new parity script was not included. Added `npm run verify:migrations` immediately after `npm ci` on the existing `codex/**` push/PR workflow. Existing 9/9 SQL hashes use LF in the Git index; the Node check remains offline. No web/API code, DB schema or deployed environment changed. Remote CI status must be checked separately.

## 2026-10-31, checkpoint 72 — staging migration source parity

- Completed/pushed checkpoint 71 evidence commit `b8e98b5` on development branch. Queried the dedicated staging migration history read-only: all nine installed entries have a single stored SQL statement and hashes matching their local SQL sources after the final LF is excluded. Added local `verify:migrations` safeguard to the standard check pipeline. Remote version IDs still differ; `db push` requires reviewed history reconciliation/backup.
- Full `npm run check` PASS with approved filesystem permission: 9/9 checksum, ESLint, strict TypeScript, 175/175 Vitest and 17/17 Webpack pages. An initial restricted packaging attempt failed on `.next/standalone` `EPERM` after successful compilation; no code change was needed to pass the privileged re-run. No browser rerun because UI/API source is unchanged.
- No Auth credentials appeared in the local runtime. S0 live HTTPS three-user Auth/RLS remains BLOCKED_EXTERNAL, rated OFF and all 20 release gates OPEN. No schema mutation, `main` merge or production deploy.

## 2026-10-31, checkpoint 71 — Preview of published puzzle slice

- Commit `7387dfa` was pushed to the development branch and independently verified on origin. Created READY protected Vercel Preview `dpl_GWwGiiDrqaBx27CqFkBXzPs2B9mf` with remote TypeScript and 17-page build PASS; four page routes HTTP 200. Anonymous game API remains 503, account preferences 401.
- Dependency audit found zero vulnerabilities, dedicated Supabase project is `ACTIVE_HEALTHY`, but Preview has only public Supabase URL/key and no server secret. S0 genuine hosted Auth/RLS remains BLOCKED_EXTERNAL; S1–S6 still need evidence. No production deploy/main merge; **20 OPEN, rated OFF**.
- No app code changed in this checkpoint. Refer to `TEST_RESULTS.md` for exact commands and rollback deployment.

## 2026-10-31, checkpoint 66 — clock time after device sleep

- Local/computer game clock previously relied on `performance.now()` even though that monotonic source can stop during system suspend. `GameWorkspace` now records both monotonic and wall-time tick samples and settles the positive greater elapsed duration. In a real Chromium regression `Date.now` advances by 181 seconds while `performance.now` does not; a `3+2` Black move after wake is rejected, clock reads `00:00`, and game reports Timeout.
- Verification after source changes: focused native Chromium **1/1 PASS**; full native Playwright **71 local/mock PASS / 1 genuine Supabase hosted SKIP (72 discovered), exit 0**; fresh ESLint, strict TypeScript, **171/171 Vitest PASS**, and native Webpack production build **17 prerendered pages, exit 0**. Restricted Playwright server startup could not bind loopback (`EACCES`); approved native run succeeded. `git diff --check` passed (only line-ending conversion notices).
- Review: wall-time can be affected by manual clock changes, appropriate here only for unrated on-device games. Server-authoritative online clocks were not modified. Rollback: revert `GameWorkspace` wall-time sample and new regression if it causes compatibility issues. S0 real HTTPS Auth/RLS/three-identity integration remains BLOCKED_EXTERNAL; other S1–S6 gates remain pending. **20 OPEN, rated OFF, IN_PROGRESS; production remains gated.**

## 2026-10-31, checkpoint 64 — owned time-control validation

- Discovered and reproduced prototype-inherited names bypassing both the hosted game-create control allowlist and saved local-session control validation. Added four RED/GREEN POST regression cases, a valid `3+2` POST assertion, and a real Chromium corrupt-storage regression. Both entry points now require own properties; server validates before privileged insert or rate limit.
- Fresh lint and strict TypeScript PASS, **170 Vitest PASS**, **70 local/mock Chromium PASS / 1 real hosted SKIP**, and a separate permission-approved production Webpack build PASS, **17/17 pages**. Composite `npm run check` had only a restricted Windows `.next/standalone` copy `EPERM`; separate native build passed. See `TEST_RESULTS.md` for exact commands and risk.
- S0 real HTTPS Auth/RLS still BLOCKED_EXTERNAL until secure runtime credentials exist; S1–S6 remain planned. **20 gates OPEN, rated OFF, IN_PROGRESS**; no production release.

## 2026-10-31, checkpoint 63 — fail-closed private game-room client

- Online GameRoom now discards all private board/history/controls immediately after access revocation, failed polling, service errors or Supabase identity changes. Aborted requests and account epochs prevent an older authorized response from repainting another account's game. New browser regressions exercise revocation with delayed success and offline/auth recovery.
- Complete native Chromium run after latest regression: **69 local/mock PASS, 1 true hosted Supabase SKIP**. Fresh ESLint and strict TypeScript PASS, **165 Vitest PASS** across 24 files, and native standalone Webpack **17/17 pages PASS** (exit 0); commands logged in `docs/TEST_RESULTS.md`.
- Staging remains externally blocked by absent Supabase runtime settings, and real three-user HTTPS Auth/RLS, independent Realtime, PostgreSQL clocks/locks, rated settlement and final 20-gate acceptance are still outstanding. Continue S0–S6. **20 OPEN, rated OFF, IN_PROGRESS; no production deployment or main merge**.

## 2026-10-31, checkpoint 62 — published lobby fix and refreshed hosted readiness

- Development commit `c88473e` (`fix(online): isolate lobby across account switches`) successfully pushed to `origin/codex/chess-platform-foundation`; `main` untouched. Fresh local ESLint, strict TypeScript and 165/165 Vitest PASS; checkpoint 61's 67/67 local/mock Chromium PASS and separate native 17-page build were already recorded and were not rerun in this checkpoint.
- Connected Supabase staging `tyvczicinpjixmxgjhjn` is ACTIVE_HEALTHY with the same nine installed migration names/remote versions. Read-only PostgreSQL queries confirm RLS on all seven public tables and deny direct `anon`/`authenticated` writes on games, moves and rating tables; authenticated preferences have write privilege subject to RLS. Supabase security advisor: one INFO for deliberately policy-free `game_rate_limits`; performance advisor: two unused-index INFO findings. These structural checks do not prove actual user authorization.
- Vercel still lists **zero environment variables**. The latest READY preview remains at earlier SHA `890c782`; a deployment of `c88473e` was not created. A direct API attempt rejected `target=preview` (allowed targets were production/staging/custom); the default-target alternative was refused by automatic approval review because it could deploy to the wrong environment. No production deployment or permission workaround. S0 authentic HTTPS three-user test remains BLOCKED_EXTERNAL. **20 gates OPEN; rated OFF; IN_PROGRESS**.

## 2026-10-31, checkpoint 61 — account-scoped online lobby refresh

- Added verified-identity lobby session coordination; an old account's game list cannot publish after identity switches, sign-out, out-of-order API responses, or component teardown. Pending create-challenge requests are aborted on account changes. Four new Vitest cases cover isolation, request ordering, failed verification and disposal.
- Local evidence: lint/types PASS; **165 Vitest (24 files) PASS**; native **67 local/mock Chromium PASS / 1 genuine hosted SKIP**; separate native **17-page build PASS**. The composite `npm run check` encountered a Windows `EPERM` at standalone trace copy after lint/typecheck/tests passed; the native build completed successfully.
- Vercel project environment listing independently confirms zero configured variables; hosted Auth/RLS and end-to-end online play cannot be considered verified. Advance S0 dedicated secure HTTPS staging and migration reconciliation, then S1 two browsers, S2 row locks/clocks, S3 rated/matchmaking, S4 engine/study, S5 community, S6 final independent audit. **20 gates OPEN, rated OFF, IN_PROGRESS**.

## 2026-10-31, checkpoint 60 — preview deployment smoke and blockers

- GitHub development branch push succeeded through tested commit `890c782`; `main` untouched. Vercel preview deployment `dpl_8rNpXSfR544VQ8c8M5b2nuF9KimW` of that SHA is READY at `https://chessonline-b5itq6vfa-hnquan.vercel.app`. Authenticated route smoke: five pages HTTP 200 with Rookline homepage markup; build generated 17 pages.
- Real blockers confirmed: Vercel project has zero environment variables, `/api/games` and `/api/preferences` return 503, and anonymous preview access redirects 302 to Vercel SSO. Hosted Supabase Auth/RLS/Realtime, PostgreSQL concurrency and rated settlement remain untested; preview is protected and production release withheld.
- Next: secure staging Supabase runtime and true three-user E2E S0, reconcile installed migrations, advance S1–S6. **20 acceptance gates OPEN, rated OFF, IN_PROGRESS**.

## 2026-10-31, checkpoint 59 — blocked-storage theme reliability

- CH-01/11: Shared theme preference access allows Settings, topbar and navigation to work even if browser storage denies reads/writes. Only valid dark/light values are accepted; fallback is browser-tab memory.
- Observed ESLint, strict TypeScript, **161/161 Vitest (23 files)**, focused Chromium **1/1 PASS**, full native Chromium **67 local/mock PASS / 1 genuine hosted staging SKIP**, native Webpack **17/17 pages PASS (exit 0)**. Restricted composite build hit Windows `.next` `EPERM`; native build passed. High+ npm dependency audit **0 vulnerabilities**.
- Next S0 real HTTPS Supabase three-identity Auth/RLS/Origin; reconcile nine installed remote migration IDs before any schema push. Continue S1 Realtime, S2 DB locks/clocks, S3 rated/matching, S4 learning, S5 social, S6 independent audit. **20 gates OPEN, rated OFF, IN_PROGRESS**. No production deploy or `main` merge.

## 2026-10-30, checkpoint 58 — collision-safe local game archive IDs

- Reproduced data loss: two rapid games with `Date.now()` returning the same millisecond were assigned the same `local-` ID and the second replaced the first in device history. The new real-browser regression failed on the original code (one archive entry rather than two), then passed after switching initial, fallback and New game IDs to `crypto.randomUUID()`. Both distinct legal PGNs survived browser reload; existing timestamp IDs remain readable.
- Browser test runner now accepts validated `ROOKLINE_E2E_PORT` so local Rookline can run while another application occupies 3100. Same-origin API test headers derive the current Playwright base URL. **158/158 Vitest (22 files)**, ESLint and strict TypeScript PASS; native Chromium **66 local/mock PASS / 1 guarded real hosted SKIP (67 discovered)**; separate native Next.js Webpack **17/17 generated pages PASS**. Default restricted `npm run build` stopped at Windows `.next/types/app/api` `EPERM`; native-permission build succeeded. Do not describe the restricted build as PASS.
- S0 actual three-user HTTPS Auth/JWT/RLS remains **BLOCKED_EXTERNAL** per latest credential-presence evidence; S1 real Realtime, S2 independent PostgreSQL row locks and clocks, S3 rated/matching, S4 hosted learning, S5 community and S6 all-gate audit remain. **20 acceptance gates OPEN, rated OFF, IN_PROGRESS.** No database push, production deployment or main merge.

## 2026-10-30, checkpoint 57 — concurrent study tabs and browser storage failure

- CH-14: Shared opening and lesson mastery helpers sanitize known side-specific IDs and merge stored/current in-memory completions before each save. Active tabs react to storage updates so catalogue badges change without refresh; `QuotaExceededError` preserves completed practice in memory. Two new real-browser regressions verify both Italian/French completions and lesson mastery when storage refuses writes.
- Evidence: **157/157 Vitest in 21 files**, ESLint and strict TypeScript PASS; focused Chromium **2 PASS**, full **65 local/mock Chromium PASS / 1 true hosted SKIP**, separate native **17-page Webpack production build PASS**. The restricted composite `npm run check` failed only at `.next/types/app/api` with Windows `EPERM`; successful isolated native build confirms packaging validity, while composite itself is not claimed PASS. Generated Next typing imports restored.
- S0 HTTPS hosted three-identity Auth/RLS remains BLOCKED_EXTERNAL (four staging runtime settings absent at last value-free probe), then S1 live Realtime → S2 independent PostgreSQL clocks → S3 rated/matching → S4 engine/hosted study → S5 community → S6 independent audit. CH-14 LOCALLY_TESTED, wider/hosted curriculum pending; **20 gates OPEN, rated OFF, IN_PROGRESS**. No database push, production deploy or main merge.

## 2026-10-30, checkpoint 56 — two-tab puzzle progress integrity

- CH-13: Two open puzzle tabs now refresh completed IDs and adaptive practice counters from shared device storage. Before saving a solution or score, the active tab reads the latest stored state, avoiding ordinary stale-tab overwrites. Restored completion IDs are deduplicated and limited to known puzzles. If the browser refuses storage writes, practice counters continue in memory.
- Verified post-change: focused Chromium **2 PASS** (two real same-context tabs, quota-rejected writes); full Chromium **63 local/mock PASS / 1 guarded genuine staging SKIP**; native `npm run check` **PASS** (ESLint, strict TypeScript, **154 Vitest**, Webpack production build with **17 pages**). The earlier default-sandbox build hit Windows `.next` `EPERM`; the complete authorized native rerun passed. No remote staging operations were performed.
- S0 real three-user HTTPS staging Auth/RLS remains blocked by absent runtime credentials; continue S0→S6. CH-13 remains PARTIAL pending larger curriculum and hosted learning; **all 20 acceptance gates OPEN, rated OFF, IN_PROGRESS**. No main merge or production deploy.

## 2026-10-30, checkpoint 55 — user-scoped settings persistence and session-switch safety

- Integrated validated private/no-store account preferences into authenticated Settings, topbar theme and move sounds. `PATCH /api/preferences` checks verified JWT identity, same-origin, strict body and owner-only table RLS; `X-Rookline-Account` must match the authenticated user (409 on mismatch). Client aborts stale writes on account change, serializes rapid changes, discards old-account loads and retries after a failed read; status is accessible to users.
- Post-hardening checks: targeted **25/25 Vitest PASS**; lint, strict TypeScript and **153/153 full Vitest PASS**; separate authorized native production build **PASS, 17 pages**; focused Chromium **2 PASS**, full Chromium **61 local/mock PASS / 1 guarded hosted SKIP**. Initial overlapping composite build failed `.next` `EPERM`, corrected with isolated native build. Hosted Auth/RLS and three-user preference reload checks are authored but unexecuted.
- Four required Supabase runtime values absent by presence-only probe. S0 real HTTPS Auth/RLS and migration ID reconciliation still precede S1 Realtime, S2 dual-connection clocks, S3 rated ledger/matching, S4 engine/hosted learning, S5 community and S6 independent audit. **20 gates OPEN, rated OFF; no production deployment, schema push or main merge.**

## 2026-10-30, checkpoint 52 — authenticated profile editor and security regression

- Implemented own-profile `username`/`display_name` editing through CSRF-guarded `PATCH /api/profile`, user-scoped Supabase UPDATE and an accessible owner-only form. Input validation rejects extra/privileged fields, bidi controls, invalid names and oversized JSON; collisions and absent service produce explicit responses. The existing SQL `profiles_update` policy and column grants are relied upon. Authenticated three-user browser/RLS assertions have been added to the opt-in staging suite but have **not run**.
- Verified locally: **128 Vitest / 17 files**, ESLint, strict TypeScript PASS; focused Chromium **2 PASS**; full Chromium **60 local/mock PASS / 1 guarded hosted SKIP**; elevated native Next Webpack build **17/17 pages PASS**. Restricted build produced `.next` Windows `EPERM`, recovered through authorized native run.
- Four Supabase staging runtime variables remain absent by value-free probe. Next S0 genuine HTTPS/three-user Auth/RLS including profile changes → S1 two-browser Realtime → S2 parallel Postgres clocks/locks → S3 reconcile migration mapping, install reviewed rated SQL and prove exactly-once settlement/matching → S4 full engine/hosted learning → S5 social/tournaments → S6 independent 20-gate audit. **IN_PROGRESS, 20 OPEN**, rated OFF; no `main` merge or production deploy.

## 2026-10-30, checkpoint 50 — authenticated online archive pagination

- Added a participant-restricted online archive with stable 50-game pages, a PostgreSQL microsecond-preserving cursor and a UUID tie-breaker. The server validates cursor input before a privileged query, enforces membership in both seat branches, returns private/no-store results and handles database failures without exposing internal details. `/games` now loads older records on demand, deduplicates entries and provides clear session/error feedback; the online lobby links to the complete archive.
- Local verification: ESLint, strict TypeScript and **104/104 Vitest in 15 files PASS**. Six authenticated GET route cases and three cursor/filter cases pass. After correcting the timeout race assertion, focused real Chromium **1/1 PASS**, full native Chromium **59 local/mock PASS / 1 genuine hosted SKIP**, and native Webpack production build **17/17 pages PASS**. All commands exited 0.
- Hosted three-identity archive authorization remains **UNTESTED**; the opt-in staging scenario now checks white/black inclusion and outsider exclusion, but has not run against real Auth. Four Supabase runtime settings were absent in the last verified probe. Priority S0→S6 unchanged; **20 acceptance gates OPEN / IN_PROGRESS**, rated OFF, no production deploy or `main` merge.

## 2026-10-30, checkpoint 48 — external HTTPS staging E2E readiness

- Prepared strict public-origin Playwright targeting with hosted-only spec selection and no local dev server. The guarded three-disposable-user spec now exercises genuine browser-originated game create/cancel and rejects forged or downgraded Origins. The new hosted checks remain **unexecuted** until staging is available.
- ESLint/TypeScript **PASS**, **95/95 Vitest (13 files)**, native Chromium **59 local/mock PASS / 1 hosted SKIP**, native Webpack **17/17 pages PASS** after sandbox-only `EPERM`. Local/default discovery 60 tests and external staging discovery 1. Four Supabase runtime settings absent by fresh presence-only probe.
- Priority S0: real dedicated HTTPS staging `tyvczicinpjixmxgjhjn`, reconcile nine remote migration IDs, real Auth/RLS/Host/Origin → S1 two-browser Realtime → S2 independent PG clocks/locks → S3 durable rated SQL/matching → S4 hosted profiles/education → S5 community → S6 independent acceptance. **IN_PROGRESS / 20 OPEN**, rated OFF, no production deployment/main merge.

## 2026-10-30, checkpoint 46 — completed online PGN analysis flow

- Added protected completed-room → Analysis link, reconstructed canonical online game PGN at the final ply, preserved the authoritative result through export, and supported navigation and branches. Untrusted or unfinished/corrupt payloads, wrong game IDs and inaccessible sessions fail clearly; pending requests cannot overwrite user edits. Strengthened final-game identity/result/turn validation before import.
- **92/92 Vitest**, ESLint/TypeScript PASS, **3/3 focused real Chromium PASS**, **final native production Webpack 17/17 pages PASS**; complete browser suite from the preceding implementation state **59 local/mock PASS / 1 opted-in hosted staging SKIP**. Restricted composite check encountered `EPERM` during Next packaging; the separate native build succeeded after final validation hardening.
- CH-12 gains locally verified online-game review; full-engine/hosted analysis remains partial. Next S0 real Supabase Auth/RLS/public HTTPS proxy → S1 two-browser Realtime → S2 independent DB concurrency → S3 atomic rated settlement/matching → S4 hosted profiles/education → S5 community → S6 20-gate independent audit. **IN_PROGRESS / 20 OPEN**; rated OFF and no main merge/production deployment.

## 2026-10-30, checkpoint 45 — reject stale online game and clock samples together

- Concurrent HTTP polling could accept stale server clock hints even when an older game ply was discarded. Added accepted-game/clock ref reconciliation and browser-monotonic clock sample handling. Chromium verifies an older ply or timestamp cannot undo synchronized `e4`/turn progression or jump the visible clock backwards.
- Native `npm run check` **PASS**, **90/90 Vitest in 12 suites**, lint/types and **17/17 optimized production pages**; full Chromium **57 local/mock PASS / 1 guarded real staging SKIP**. Fresh value-free configuration probe confirms all four Supabase staging runtime settings absent. Evidence covers local UI behavior only.
- Continue **S0** genuine staging three-user Auth/RLS plus HTTPS proxy Origin checks → **S1** two-browser private Realtime → **S2** independent DB row-lock/clock contention → **S3** rated migration/matching → **S4–S6** hosted profiles, education, community and independent final audit. **20 gates OPEN / IN_PROGRESS**; rated OFF, no deploy or `main` merge.

## 2026-10-30, checkpoint 44 — server-sampled monotonic game room clock

- Implemented a post-query `serverNow` display hint and browser monotonic interpolation. A new Chromium test demonstrates that a one-hour skew and later `Date.now()` jump no longer change online clock rendering; server decisions remain DB-owned. Added unit/route regressions; fixed React render purity error discovered during verification.
- Native `npm run check` **PASS**: lint/types, **89 Vitest**, **17/17 production pages**; full native Chromium **56 local/mock PASS / 1 real staging SKIP**, exit 0. Focused Chromium **PASS**. Supabase URL and three key settings remain absent in a safe presence check. Browser mock testing does not prove hosted clock correctness.
- Continue **S0** genuine staging three-user Auth/RLS and public HTTPS proxy checks → **S1** two-client game/Realtime → **S2** concurrent database time/row locks → **S3** migration/rating/matching → **S4–S6** hosted learning, community and independent audit. **20 gates OPEN / IN_PROGRESS**; rated creation OFF, no `main` merge or production deploy.

## 2026-10-30, checkpoint 43 — fail-closed game mutation origin checks

- Tightened shared six-route POST CSRF guard against missing/sibling/malformed Origin evidence. Added Host, scheme and cross-site metadata regression tests and matching Origin to nonbrowser staging API requests; documented trusted reverse-proxy assumptions.
- Native lint/strict TypeScript/**88 Vitest PASS**; composite `npm run check` build **FAILED** only at restricted Windows `.next` `EPERM`, while native elevated production build **PASS 17 pages**. Full native Chromium **55 local/mock PASS / 1 live staging SKIP**; generated `next-env.d.ts` restored. Fresh safe configuration probe: four Supabase runtime values absent.
- Project **IN_PROGRESS, all 20 gates OPEN**. S0 Auth/RLS, S1 multi-browser Realtime, S2 DB clock contention, S3 rated transactions, S4–S6 remain. Rated API OFF; no deployment, staging write or `main` merge.

## 2026-10-30, checkpoint 42 — expanded original opening and lesson curriculum

- Expanded CH-14 from five to **ten** legal, original opening lines (French Defense, Caro-Kann, Scandinavian Defense, London System and English Opening added) and from three to **five** original lessons (king safety through castling and central pawn breaks added). Existing IDs and per-color device-local mastery remain compatible. A new test exercises all 15 lines as White and Black using legal scripted moves.
- Native `npm run check` **PASS, exit 0**: ESLint, strict TypeScript, **80/80 Vitest in 12 suites**, optimized Next.js Webpack build **17/17 generated pages**. Focused new French/castling practice Chromium **1 PASS**; complete native `npm run test:e2e -- --workers=1` **55 local/mock Chromium PASS / 1 guarded live staging SKIP, exit 0**. The first restricted Playwright web server could not be reached due to socket permissions; native rerun passed.
- Checked `.env.local` plus process environment by presence-only probe: staging URL, publishable key, Supabase secret and legacy service-role key **all absent**. The nine remote staging migrations remain the latest previously confirmed set; the tenth rated-settlement SQL remains rollback-tested only. Hosted S0/S1/S2, ratings and community still unverified. CH-14 `LOCALLY_TESTED` with broader curriculum/hosted mastery pending; rated API OFF, **20 gates OPEN / IN_PROGRESS**. No main merge or production deployment.

## 2026-10-30, checkpoint 41 — doubled original tactical curriculum

- Expanded CH-13 from ten to **20 original chess.js-validated positions**, with new Black-to-move mates, forks, captures and promotion exercises. Every entry now declares `goal: "mate" | "move"`; alternate legal checkmates are accepted on actual board state, independent of display text. The puzzle board turns Black-side-up for Black-to-move positions, with previously saved IDs and adaptive practice history preserved.
- Verification: ESLint and strict TypeScript PASS; **79/79 Vitest in 12 suites PASS**. Native composite `npm run check` reached its build stage but hit Windows `EPERM` while creating `.next/server/app/api/games`; a separate build with native elevated execution **PASS, 17/17 generated pages**. Full Chromium regression **54 local/mock PASS / 1 real staging SKIP**, including new Black perspective, mate and promotion, alternate mate, progress persistence and adaptive ordering. `git diff --check` PASS.
- CH-13 stays `PARTIAL` pending broad curated curriculum and hosted account syncing. Nine dedicated staging migrations remain the last confirmed installed set; tenth rated settlement remains rollback-tested only. Real Supabase Auth/JWT, two-client Realtime, independent Postgres locks/clocks and rated settlement remain unverified. Rated creation OFF; **20 acceptance gates OPEN, IN_PROGRESS**. Continue S0→S6; no main merge or production deploy.

## 2026-10-30, checkpoint 40 — adaptive tactics review and complete local QA

- Added a device-local practice history keyed by ten known original puzzle IDs. Wrong or illegal attempts, hints and successful solutions are bounded and sanitized on restore; the optional adaptive selector revisits weak tactics, rewards unseen puzzles, and rotates away from immediate repeats. A synchronous ref prevents rapid successive hint/error events from dropping increments.
- Verified `npm run check` **PASS** (ESLint, strict TypeScript, **78/78 Vitest across 12 suites**, optimized Webpack build **17/17 pages**); full native Chromium **53 local/mock PASS, 1 guarded live staging SKIP**, exit 0, including multiple rapid hints and restored history after reload. `next-env.d.ts` was returned to its committed generated-reference form after Next dev rewrote it.
- CH-13 remains `PARTIAL`: only ten original puzzles and local adaptation, no broad hosted curriculum or user-account sync. Four staging runtime keys absent at the last presence-only probe; genuine Auth/JWT/RLS, two-client play/Realtime, two-connection clock/rating contention remain unverified. Rated creation OFF, **20 acceptance gates OPEN, IN_PROGRESS**. Continue S0→S6, with reviewable local slices while external checks are blocked; no production deploy or main merge.

## 2026-10-30, checkpoint 37 — staging SQL and role-simulated RLS verified

- Executed the new tenth rated completion migration and its negative/positive exactly-once fixture inside a transaction on the dedicated live staging Postgres; **PASS followed by ROLLBACK**, leaving only the original nine remote migrations. Added result/winner consistency guard and invalid-result tests. Independently executed a new three-identity `authenticated`-role RLS fixture with transaction-local JWT claims: **PASS followed by ROLLBACK**. Neither check proves real Auth/Realtime, cross-session locking or durable rated migration deployment.
- Local lint/types/**76 Vitest** PASS. Restricted composite build hit Windows `EPERM`; separate native-permission Next build **PASS (17 generated pages)**. Existing checkpoint-36 Chromium **52 local/mock PASS / 1 live SKIP** remains the latest browser result. Rated API creation remains disabled; next S0 real Auth/RLS → S1 two-client online → S2 independent DB races → S3 install/reconcile rated migration and test settlement → S4–S6. **20 gates OPEN; IN_PROGRESS**.

## 2026-10-30, checkpoint 36 — rated database groundwork and replay controls

- Added deterministic Elo-style TypeScript rating module with 6 unit cases. Prepared a staging-only, **unapplied and unexecuted** transactional PostgreSQL completion trigger and rollback acceptance SQL; hardened completed-rated direct INSERT, result ownership, finality and `games_played` overflow. Fixed staging test instructions that previously tried to reopen a completed game, and specified a real two-session rating-lock test.
- Verified native lint, strict typecheck, **76/76 Vitest / 12 suites**, **17/17 build pages**, and full Chromium **52 local/mock PASS / 1 real Supabase staging SKIP**. The project still forces `rated: false` in game creation; real settlement requires SQL/staging execution and authenticated concurrency verification.
- Four Supabase process environment variables are absent by value-free probe, so real S0–S2 and S3 integration gates remain unverified. Ten local migrations now exist; only the prior nine are reported present remotely with divergent version IDs. **20 full gates OPEN**, `IN_PROGRESS`. Next: reconcile migration history and run isolated SQL fixture plus true Auth/RLS, clock and two-client flows before enabling rated gameplay. No production deploy/main merge.

## 2026-10-30, checkpoint 35 — online snapshot race locally verified

- Reproduced stale `GET /api/games/[id]` after expiry RPC waited on a concurrent resignation or legal move: two RED tests, now GREEN after unconditional authoritative reload; third test denies outsider before privileged RPC. Canonical participant is rechecked after the new read. Unit route module alias added to Vitest.
- ESLint and strict TS PASS, **70/70 Vitest / 11 suites** PASS, native Webpack **17/17 static pages** PASS after restricted composite build `EPERM`, native browser **52 local/mock PASS / one real staging SKIP**. `git diff --check` required before commit. The external DB race is **not** proven by mocks.
- Four Supabase runtime credentials remain absent by value-free probe. Real S0 Auth/RLS → S1 two-user games → S2 independent DB races remain blocked externally; S3–S6 pending. **All 20 gates OPEN**, `IN_PROGRESS`. Do not deploy production or merge main.

## 2026-10-30, checkpoint 34 — bot recapture regression verified

- Reproduced `Qxf5` losing the queen to `...Rxf5`; a bounded two-extra-ply tactical continuation now avoids it in the bot and Analysis Worker. Real Worker Chromium and nonmutating unit regression PASS. Broader tactical strength and performance remain unverified.
- Lint/types/**67 Vitest** PASS, Webpack **17 built pages**; restricted composite packaging `EPERM` superseded by native-permission build PASS. Full real Chromium **52 local/mock PASS / 1 staging SKIP**, focused Chromium 2 PASS; diff check PASS. No hosted Auth users tested.
- S0–S2 hosted checks need secure staging credentials, S3–S6 incomplete. **20 acceptance gates OPEN**, `IN_PROGRESS`. Follow S0→S6; no deployment or main merge.

## 2026-10-30, checkpoint 33 — computer position evaluation verified

- The medium/hard/advanced computer and two-ply Analysis Worker now consider original piece position and central development alongside material; tactical search prioritizes faster mates. A reproducing Vitest previously failed because the medium bot chose `a3` from the start. New unit and real Chromium Worker tests cover sensible first moves, opponent reply, legality and board immutability.
- **Native `npm run check` PASS** (66 unit / 10 suites, 17 build pages). **Native full Playwright Chromium 51 local/mock PASS / 1 hosted staging SKIP**, focused real Worker 1 PASS. Credential presence probe: four variables absent; no real hosted Auth/RLS/clock verification. CH-04 `LOCALLY_TESTED`, CH-12 `PARTIAL`, **all 20 acceptance gates OPEN**, `IN_PROGRESS`.
- Continue S0 real three-identity hosted Auth/RLS, S1 two-client games and reconnect, S2 independent database clock/race tests, S3 rated settlement, S4–S6 remaining product and security gates. No production deploy or `main` merge.

## 2026-10-30, checkpoint 32 — precise local clock with reduced full-PGN saves

- Clock precision remains in `clockRef` at every 250 ms timer tick; visible updates and full-session localStorage writes now occur when the shown second changes or a flag falls. Persisted snapshots preserve subsecond timing. New browser case verifies 2–5 writes across 2.8 s, fractional clock, persisted e4 and reload continuation.
- **Native `npm run check` PASS:** lint/types, **64 unit in 10 suites**, **17/17 build pages**. Native focused browser **1 PASS**, full Chromium **50 local/mock PASS / 1 guarded staging SKIP**; `git diff --check` PASS. Previous restricted browser process had stalled and was interrupted; final native runs passed.
- Presence-only probe again confirms all four required Supabase runtime vars absent. CH-03 locally tested, broader endurance still pending. S0–S2 `BLOCKED_EXTERNAL`, S3–S6 unfinished, all **20 completion gates OPEN**. Next secure S0 three-account hosted Auth/RLS/Realtime + independent two-connection clock protocol, followed by rated and other backlog milestones. No production deploy or `main` merge.

## 2026-10-30, checkpoint 31 — candidate move search with a dedicated Worker

- Implemented original depth-two material search on the Analysis page. Candidate SAN, approximate white-relative score and terminal outcome are displayed; the UI warns that this is a limited heuristic. Reconstructed SAN history preserves repetition adjudication, and changing positions invalidates stale Worker answers.
- **Native `npm run check` PASS:** lint/types, **64 Vitest in 10 suites**, **17/17 build pages**. Full real Chromium run **49 local/mock PASS / 1 guarded live staging SKIP**; focused Worker test 1/1 PASS and `git diff --check` PASS. Generated Next.js dev typing imports were restored to the tracked build baseline.
- CH-12 remains `PARTIAL`, S0–S2 hosted verification remains `BLOCKED_EXTERNAL`, and S3–S6 remain outstanding; 20 acceptance gates OPEN, `IN_PROGRESS`. Next S0 real three-identity Auth/RLS/Realtime plus two-connection clocks once secure runtime credentials exist. No production deployment or `main` merge.

## 2026-10-30, checkpoint 30 — guided opening and lesson practice

- Implemented White/Black opening and lesson training: chess.js move validation, scripted replies, hints/retry/review, drag/click/keyboard input, board orientation and locally saved per-color mastery. Fixed progress loss when moving between opening and lesson catalogues; additional Chromium browser test checks both saved keys across page navigation.
- Native `npm run check` PASS (lint/types, **61 Vitest, 17/17 build pages**). Native full Chromium **48 local/mock PASS, 1 guarded real staging SKIP**, exit 0. `git diff --check` PASS. All four staging runtime variables absent in a value-free probe.
- CH-14 `LOCALLY_TESTED`, broad curriculum pending. S0 hosted Auth/RLS, S1 actual two-client Realtime and S2 authoritative clocks remain `BLOCKED_EXTERNAL`; S3–S6 unfinished; all **20** gates OPEN, `IN_PROGRESS`. Continue S0→S6 when secure staging credentials exist and local QA in the meantime. No production deploy or main merge.

## 2026-10-30, checkpoint 29 — descriptive analysis position insight

- Added pure chess.js snapshot calculation and visible analysis summary covering side to move, outcome, material points, legal-move count and draw claims. Unit checks cover immutability, captures, mate/stalemate and repetition; Chromium verifies analysis import/replay/mate.
- Native `npm run check` PASS (lint, strict TS, **59 Vitest / 9 files**, Webpack **17/17** pages), focused Chromium **1 PASS**, complete Chromium **45 local/mock PASS / 1 real staging SKIP**. All four staging credential variables were confirmed absent without printing values.
- CH-12 `PARTIAL`, **20 gates OPEN**, `IN_PROGRESS`. Next external priority S0 Auth/RLS using dedicated staging; meanwhile continue locally verifiable learning/security work. No production deployment or `main` merge.

## 2026-10-30, checkpoint 28 — topic-driven puzzle practice verified

- Implemented theme/level metadata and topic-scoped tactic navigation for the ten original puzzles. Accessible topic filtering, completed counts, unsolved-first next-step selection and local progress reload are verified through actual browser practice; puzzle content and move authority still use `chess.js`.
- Native `npm run check` **PASS**: lint, strict types, **57/57 Vitest** and **17/17** Next.js build pages. Focused Chromium **4 PASS** and complete suite **44 PASS / 1 guarded hosted staging SKIP**. The first focused run exposed only an inexact Playwright selector, corrected before both successful final test runs.
- Supabase runtime presence-only check: four required public/server key variables **absent**. S0–S2 remain `BLOCKED_EXTERNAL` for real identity/RLS/clock/reconnect acceptance. Next: enable isolated staging and verify S0→S1→S2; continue independently testable local slices while credentials are unavailable, then complete S3 rated, S4 learning, S5 community and S6 final audit. CH-13 `PARTIAL`, **20 gates OPEN**, project `IN_PROGRESS`.

## 2026-10-30, checkpoint 27 — puzzle curriculum and keyboard practice

- Expanded the original chess puzzle collection from 3 to 10 validated positions; evaluator now accepts all genuine mate-in-one alternatives, differentiates illegal versus wrong legal attempts and validates chosen promotion. Added coordinate keyboard practice and resilient device-local completion persistence, with focused unit and browser regressions.
- Full native `npm run check` **PASS** (lint, strict types, **55/55 Vitest**, Webpack **17/17** pages). Native Chromium full suite **43 PASS / 1 real-staging SKIP**; focused browser 3/3 PASS. The real three-identity Auth/RLS/Realtime, join/cancel race and two-session clock checks remain unexecuted; mocked browser cases cannot close these gates.
- Next: arrange secure dedicated staging environment and execute S0→S1→S2 live evidence, then S3 rated guarantees, S4 learning/analysis, S5 community and S6 independent audit. CH-13 `PARTIAL`, all **20 product gates OPEN**, `IN_PROGRESS`. No production deployment or main merge.

## 2026-10-30, checkpoint 26 — clean dependency audit and cancellation regression

- Removed unused `shadcn@4.1.0` CLI runtime dependency and its unused Tailwind CSS import; removed 251 transitive packages. Patched three npm transitive dependencies without a breaking `--force` update. Full **online production + development npm audit 0 vulnerabilities**, where the pre-fix production audit contained a critical and five high findings. Added CI `npm audit --audit-level=high` after installation; actual GitHub CI still awaits a remote run.
- Native `npm run check` PASS: lint, strict TypeScript, **52 Vitest**, Webpack **17/17 pages**; `npm run test:e2e -- --workers=1` PASS with **41 real Chromium local/mock tests and 1 guarded staging SKIP**. Verified cancellation UI continues to pass; no hosted identity or join/cancel race has run.
- Environment variables for hosted Supabase remain absent (presence-only check; no key output). S0/S1/S2 live validation remains `BLOCKED_EXTERNAL`, pending secure runtime setup and explicit live evidence. Nine migrations remain installed on dedicated staging with differing local/remote history IDs. **20 product gates OPEN**, project `IN_PROGRESS`; no production deployment or merge.

## 2026-10-30, checkpoint 24 — waiting-challenge cancellation and staging schema

- Reviewed and tested creator-only cancellation of an unjoined private invite: `POST /api/games/[id]/cancel` enforces origin, authenticated identity and DB rate limits, then calls the service-only, row-locked `rookline_cancel_challenge`. The game room offers cancellation to the creator only while waiting; cancelled state survives reload and appears in the lobby. The guarded three-account staging spec now contains noncreator denial, direct RPC denial, idempotency and a cancellation-versus-join race, but **those hosted browser cases have not executed**.
- Applied **only** `20261029090000_cancel_waiting_challenge.sql` to the dedicated `chessonline` staging database. Supabase recorded remote version **`20261030003110`**; `list_migrations` confirmed **9/9** installed. Read-only hosted structural acceptance SQL **PASS**, plus direct checks: row lock present, rate-limit `cancel` recognized, `anon`/`authenticated` cannot invoke cancellation, `service_role` can. The structural test does **not** prove an authenticated join/cancel race.
- Local verification: ESLint PASS, strict TypeScript PASS, **52/52 Vitest PASS**, native-permission Webpack build **17/17 pages PASS** (the restricted composite run encountered `.next` `EPERM`). Native Chromium `npm run test:e2e -- --workers=1` **41 PASS / 1 guarded staging SKIP**, exit 0 (1.5 min). No credential-backed two-user flow ran.
- S0 real Auth/RLS and S1–S2 multiplayer/clock concurrency remain `BLOCKED_EXTERNAL` until dedicated Next.js runtime credentials are securely configured. Matchmaking, rated settlement, profiles, community and release audit remain pending. All **20 full-product gates OPEN**; project `IN_PROGRESS`. No production deployment or `main` merge.

## 2026-10-30, checkpoint 23 — codebase audit and prioritized continuation plan

- Completed a read-only implementation/security/verification review across the current Next.js application and API boundaries, Supabase migration history and RPC design, local chess/learning flows, release workflow and 20 acceptance gates. Published `CODEBASE_AUDIT_2026-10-30.md` and `CONTINUATION_PLAN_2026-10-30.md`; no application code, migration or hosted resource changed.
- Fresh native-permission **`npm run check` PASS** (exit 0): ESLint, strict TypeScript, **52/52 Vitest (8 files)** and Next.js 16.4.3 Webpack **17/17** page generation. Fresh native Chromium **40 PASS, 1 staging SKIP** (exit 0; 1.9 minutes). Earlier restricted `.next` EPERM does not reproduce with native build access.
- Hosted structural SQL success from checkpoint 22 remains the latest database evidence. Missing Next.js Supabase staging runtime credentials still block **real** Auth, user-specific RLS, two-client authoritative games, concurrency, Realtime and rated correctness. The opted-in staging E2E was **not** run. All 20 final acceptance gates remain OPEN; project `IN_PROGRESS`.
- Next delivery slice: S0 hosted Auth/security evidence, then S1 private unrated play/reconnect, S2 server clock and race regression; continue independently testable accessibility/long-game QA if external staging remains blocked. No `main` merge, production deploy or credential disclosure.

## 2026-10-30, checkpoint 22 — verify hosted schema and finish local browser regression

- Added the reusable, non-mutating `supabase/tests/structural-acceptance.sql` and ran it successfully on the isolated hosted `chessonline` project. It asserts seven RLS tables, API grants, service-only privileged functions, Realtime table publication, three FK indexes and actually invokes the timeout-winner helper for four distinct mating-material positions. Hosted user/game/move counts remained zero. This is **structural and helper execution evidence only**.
- Expanded the opt-in three-account staging Playwright scenario with opponent move convergence without reloading and server result recovery after a disconnected client's return. The runtime credentials are still unavailable: **the hosted E2E has not been executed**, so these checks remain planned, not observed passes.
- Native Chromium suite finished **40 PASS / 1 intentionally SKIPPED** (exit 0; 1.5 minutes). Default-sandbox `npm run check` failed only in the `.next` Webpack output stage due to Windows `EPERM`. A separate native-permission Webpack build passed **17/17 pages** (exit 0); final native-permission **`npm run check` PASS** (exit 0: lint, strict TS, 52/52 Vitest, 17/17 pages). Preserved the autogenerated `next-env.d.ts` change separately from owned changes.
- Project remains **IN_PROGRESS** with all 20 full acceptance gates **OPEN**. Next task: securely provision the dedicated staging credentials; run real three-account E2E and two-connection lock/clock protocol. No production deployment, main merge or unauthorized DB mutation.

## 2026-10-30, checkpoint 21 — prepare independent staging multiplayer acceptance test

- Created guarded `e2e/staging-online.spec.ts` for three actual Auth users, independent sign-in contexts, private join, adversarial access and write denial, illegal/replayed/out-of-turn moves, server-authoritative checkmate after reload and racing requests. Disposable users and games have explicit cleanup; staging project hostname is pinned.
- Full native `npm run check` **PASS**: lint, strict TypeScript, 52/52 Vitest, Next.js 16.4.3 Webpack build 17/17 generated pages. Full local Chromium **40 PASS, 1 opt-in staging test SKIPPED**. A restricted filesystem build initially failed `EPERM` writing `.next`; a native-permission rerun passed.
- This is **test-harness readiness only**: no runtime Supabase credentials are configured, so it has not exercised the deployed DB. Real Auth/RLS/concurrency/realtime/rated match acceptance is open. Project **IN_PROGRESS**, all 20 gates **OPEN**. No production deployment or main merge.

Next: provision dedicated staging runtime credentials securely, set `$env:ROOKLINE_STAGING_E2E='1'` in PowerShell and run `npx playwright test e2e/staging-online.spec.ts --workers=1`; unset the flag afterward. Inspect and fix any actual live failures, then complete the separate two-connection late-clock/26-day/rated settlement protocol in `docs/STAGING_CLOCK_CONCURRENCY_TEST.md`. Preserve Supabase remote migration history when preparing subsequent migrations.

## 2026-10-30, checkpoint 20 — recover corrupt local history and rerun local QA

- Completed an independent local-history correctness slice: tolerate malformed existing archive JSON when saving a newly finished game. The extended Chromium case exercises Fool's Mate, checks the stored result, then navigates to `/games`. Corrected its `addInitScript` fixture to seed damage only once per browser session. Focused run **1/1 PASS**, full Chromium **40/40 PASS**.
- Native `npm run check` **PASS** with lint, strict TypeScript, **52/52 Vitest**, and Webpack static generation **17/17 pages**. Initial restricted browser startup did not reach the test runner; native execution completed. Unrelated staged-database changes were preserved.
- Staging SQL migration/grant evidence remains checkpoint 19; real two-account Auth/RLS/RPC/realtime/rating verification is still outstanding. Project **IN_PROGRESS**, all 20 acceptance gates **OPEN**.

Next: configure the dedicated Rookline staging runtime securely, then run two real authenticated players through registration/login, create/join, legal and invalid moves, reconnect, forced concurrency and clock timing per `docs/STAGING_CLOCK_CONCURRENCY_TEST.md`; verify rating settlement and ACL before enabling rated matches. Keep hosting/public access and external CI audits open.

## 2026-10-30, checkpoint 19 — Supabase migration installation and grant hardening

- Identified and used the owner-supplied, connected `chessonline` Supabase project. Applied the six existing migrations in order and two new hardening migrations. The latter restrict profile updates, remove client EXECUTE on the profile trigger and existing `rls_auto_enable()` event trigger, and add three covering foreign-key indexes. All eight migrations appear in remote history; local filename timestamps differ from MCP-generated versions. Recorded precise mapping in `docs/SUPABASE_MIGRATION_HISTORY.md`.
- Verified remote RLS on seven tables, service-only authoritative mutations, permitted presentation-field profile updates, service-only privileged RPCs, event-trigger EXECUTE denial for untrusted roles and 3/3 new indexes. Supabase security advisor reports no WARN, only the intended rate-limit RLS INFO; performance advisor reports unused-index INFO. No independent authenticated RLS or transaction/concurrency tests have run.
- Previous in-turn `npm run check` reached 52/52 unit tests after lint/typecheck but failed a Webpack `.next` mkdir with filesystem `EPERM`. Previous successful native build and local/mocked 40/40 browser tests remain checkpoint-18 evidence. Current test suite needs a rerun with write access; real two-account hosted play and rating settlement remain unproven.
- Final current-checkout rerun: lint, strict TS, **52/52** Vitest PASS; the composite check encountered an overlapping Next build, and a separate default sandbox build failed with `EPERM`. Native-permission build **PASS (17/17 pages)** and native Playwright **40/40 PASS (1.3m)**. The browser suite tests local paths and mocked online responses.
- Backend remains **IN_PROGRESS**; all **20** acceptance gates **OPEN**. No main merge or production deployment. Unrelated uncommitted application edits were preserved; credentials were excluded from files and reports.

Next: configure isolated staging runtime secrets, create two disposable authenticated test users, run authenticated RLS and browser scenarios, the two-session lock/late-clock protocol and exact-once rated result tests. Reconcile Supabase CLI migration history before `db push`; rotate previously disclosed privileged credentials before production.

Historical checkpoint entries below retain their original observations and may describe previously missing migrations.

## 2026-10-29, checkpoint 18 — trusted database clock after row lock

- Reviewed the authority rules in `ARCHITECTURE.md` and `SECURITY_MODEL.md`; found pre-lock timestamp use in the move/draw-claim RPCs and elapsed-integer overflow in game expiration.
- Added ordered migration `20261029060000_locked_move_and_claim_clocks.sql` to sample trusted time after row locks, handle >24-day expiration, and freeze timely claimed-draw clocks. Added 3 Vitest source guards and a real two-connection staging test recipe. Source hardening is complete; live SQL verification is pending.
- Native `npm run check` PASS (ESLint, TS, 52/52 Vitest, Webpack 17/17 pages); native Chromium **40/40 PASS**. The restricted build had `.next` EPERM, but the native build succeeded. Browser app behavior is unchanged.
- Dedicated Supabase Rookline staging is still unavailable. Six migrations unapplied, no real hosted game, Auth/RLS/realtime/concurrent RPC/rating evidence. Project **IN_PROGRESS** and 20 acceptance gates **OPEN**.

Next: verify migrations 1–6 on dedicated Rookline staging, then run lock-wait, late claim, 26-day timeout, grants, RLS and two-real-account browser scenarios from `STAGING_CLOCK_CONCURRENCY_TEST.md`. Continue independent local correctness QA meanwhile; never touch the unrelated QuanShop project or deploy/merge without approval.

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

## 2026-10-29, checkpoint 13 — isolate stale computer Worker errors after reset

- Detected that an old computer Worker failure could set an error on the newly reset game, stopping its fresh Worker. `onmessage` already checked request identity; `onerror` now applies the same guard.
- Added a browser race scenario with a controlled Worker that delivers an obsolete error after reset. It failed before the fix and passed after; the full suite also retains a separate real Worker chess-move test.
- Verification: escalated focused Playwright **1/1** PASS after observed pre-fix failure, full **32/32** (~1.0 min) PASS, lint/typecheck PASS, Vitest **49/49** PASS, Webpack build **17/17** static pages PASS. A default-sandbox browser startup stalled and was interrupted before running tests.
- Five SQL migrations remain unrun, Rookline staging/auth keys absent, real hosted clients/RLS/RPC/realtime/rated settlement and CI/preview unverified. All 20 full acceptance gates OPEN, status **IN_PROGRESS**.

Next: continue local engine/timing correctness and accessibility review; use dedicated Rookline staging for actual two-account multiplayer verification when available.

## 2026-10-29, checkpoint 14 — computer turn ownership for resignation and draw claims

- Reproduced two human/computer rule violations in Playwright before implementation: resigning while the computer thought incorrectly reported the computer resigned, and a human could claim a threefold draw on the computer's turn.
- Computer-game resignation now always identifies the human's chosen side, including while the Worker is thinking; local over-the-board resignation continues to use the current side. Draw claims are rejected and disabled during the computer's turn.
- Both focused tests failed before the fix and passed **2/2** afterward. Full isolated Playwright **34/34** (~1.0 min), lint/typecheck PASS, Vitest **49/49**, Next.js 16.4.3 Webpack build PASS (17/17 static pages).
- Hosted Rookline Auth/RLS/RPC/2-client matches and CI/preview remain unverified, five SQL migrations unrun. All 20 complete product acceptance gates remain OPEN; status **IN_PROGRESS**.

Next: continue local engine/clock/game-rule QA and arrange isolated Rookline Supabase staging for real multiplayer acceptance evidence.

## 2026-10-29, checkpoint 15 — Vercel release build verification

- Changed the production build command to `next build --webpack` in `package.json`, following the bundled Next.js 16.4.3 documentation. The default local Turbopack build failed while spawning its CSS PostCSS worker; the Webpack build completed successfully.
- Verified `npm run check`: lint PASS, strict TypeScript PASS, Vitest **49/49** PASS, Webpack production build PASS with **17/17** generated static pages. Full Playwright suite passed **34/34** (1.1 min) under native execution.
- The user explicitly approved GitHub push and a public Vercel deployment. Supabase credentials and live database validation remain absent; hosted Auth, RLS/RPC, two-user multiplayer and ratings are unverified. All 20 product acceptance gates remain OPEN; product status **IN_PROGRESS**.

Next: push the tested development branch, deploy the Vercel frontend under the requested `chessonline.vercel.app` hostname if available, and record the actual deployment URL and outcome.

- Pushed commit `69a426c` to `origin/codex/chess-platform-foundation` (no merge to `main`). Created Vercel project `hnquan/chessonline`, set the Next.js framework, and deployed production build `dpl_CJn1D3pbYsBEvAa1LFuCi3xGjhCU` (READY, 17/17 generated pages).
- `chessonline.vercel.app` could not be assigned because Vercel reports the alias **already in use**. Created `chessonline-hnquan.vercel.app` instead; Vercel also assigned `chessonline-delta.vercel.app`.
- Browserless HTTP checks returned Vercel's **Login – Vercel** page rather than the Rookline application. Project SSO deployment protection is set to `all_except_custom_domains`. Automatic approval review rejected disabling SSO for the entire project as a broad persistent access-control change; the protection settings remain unchanged. Public smoke test is BLOCKED pending separately authorized access-control adjustment or an appropriate user-owned domain.

Next: resolve public access authorization, verify unauthenticated Rookline routes, and continue independent Supabase staging acceptance tests. Full product status remains IN_PROGRESS.
## 2026-10-29 — account access, board audio and Rookline brand refresh (working slice)

- Auth registration now checks display name and matching passwords, handles confirmation links and returns to the intended page; online lobby already supports private challenge links and authenticated sign-out. Added visible account entry points and session-aware sign-out in the global navigation.
- Local, computer and hosted room move sound implementation is present in the working tree, with persisted on/off preference and an online room toggle; browser interaction is required before playback. Introduced an original vector rook/R monogram in the site sidebar.
- Verification: ESLint clean, strict TypeScript clean, Vitest 49/49 passed. Production Webpack code compilation and TypeScript succeeded, but final prerender blocked by filesystem EPERM creating `.next/server/app/analysis.segments/analysis`; full build and new browser tests are not yet validated.
- `.env.local` lacks Supabase URL and publishable key: real account registration, the five database migrations, two-account hosted multiplayer and Supabase authorization remain BLOCKED_EXTERNAL. Do not mark authenticated multiplayer complete until verified against a real staging project. No production deployment or main merge in this slice.

## 2026-10-29 — checkpoint 16: QA-00 local auth/audio/logo regression

- Reviewed the uncommitted account-entry, registration, local/online move sound and original rook/R logo changes. Reproduced an online sound bug with a failing test: an increased ply from an inconsistent PGN/FEN played audio before chess.js verification. Moved audio triggering to the verified, applied snapshot. Remount game-room state when the route game ID changes.
- Added the same vector brand mark as `src/app/icon.svg` and responsive topbar branding, with a real Chromium test of SVG response, desktop/mobile display and mobile horizontal overflow.
- **`npm run check` PASS** (ESLint, strict TypeScript, Vitest **49/49**, Next Webpack build **17/17 pages**); focused browser audio/brand **3/3 PASS**; complete native Playwright **39/39 PASS** (~1.8 min). Earlier transient `.next` EPERM did not recur in native build.
- Supabase account lists only the unrelated **QuanShop** project; Rookline staging keys absent. Hosted account registration, RLS/RPC, real two-player matches and five migrations remain **BLOCKED_EXTERNAL**. No production deployment, main merge or unrelated-project database writes. All **20 full-product gates OPEN**; status **IN_PROGRESS**.

## 2026-10-29, checkpoint 17 — computer reply recovery and stable local clock testing

- Invalid computer Worker replies were accepted as terminal callbacks without any error or visible recovery action, leaving the player waiting indefinitely. Added explicit failure feedback for absent/illegal Worker moves while preserving request-ID isolation and clock-expiry/game-over precedence; `New game` recovers normally.
- Added a controlled-Worker Chromium regression covering wrong-turn reply, no recorded invalid move, reset, and a valid move in the new game. Confirmed the test failed before the fix and passed afterward.
- Fixed a timing race in the browser clock regression by adjusting the saved clock timestamp before page initialization on reload. Focused regression passed; production clock implementation is unchanged.
- Verification of current checkout: lint PASS, strict typecheck PASS, Vitest **49/49** PASS, full Chromium regression **40/40 PASS** (2.4 minutes). Two restricted-filesystem Webpack builds failed with `EPERM` creating `.next` subdirectories; the same native elevated build completed with **17/17** generated pages.
- Live Supabase staging, the five unrun migrations, credentialed two-user matches and hosted security/rating verification remain unavailable. All 20 gates OPEN, status IN_PROGRESS.
