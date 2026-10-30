# Autonomous progress ledger

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
