# Rookline codebase audit — 2026-10-30

**Decision:** `IN_PROGRESS`; no production readiness approval. Review scope: current checkout on `codex/chess-platform-foundation` (baseline `22de4f8`), product/architecture/security documentation, app and API routes, chess rules, hosted SQL migrations, testing configuration, CI and release evidence. This is a code and local-runtime review; it is **not** a complete production penetration test or real multiplayer acceptance run. All 20 product gates in `FINAL_AUDIT.md` remain **OPEN**.

## Observed implementation

| Area | Implemented today | Validation boundary |
| --- | --- | --- |
| Stack / shell | Next.js 16.4.3 App Router, React 19, strict TypeScript, Tailwind v4; original responsive Rookline shell, themes, accessible promotion dialog, settings and navigation | Local Chromium and build pass; full accessibility and browser/device matrix pending |
| Local chess | `chess.js` legal moves, SAN/PGN/FEN, game results, undo, clocks, archived local replay/export | Unit and real-browser coverage pass; edge-case/long-running quality review remains |
| Computer/learning | Web Worker bot with four levels, analysis board, three original puzzles and opening lessons | Local unit/browser coverage; no full engine evaluation or expanded curriculum |
| Account / hosted game | Supabase SSR Auth routes and authenticated private unrated room create/join/read/move/resign/claim APIs | Source reviewed, but no successful three-account **real hosted Auth** browser run |
| Database / transport | Eight migrations deployed to dedicated Supabase `chessonline` (`tyvczicinpjixmxgjhjn`), RLS and service-only RPC grants, row-lock/clock migrations, game Realtime notifications plus snapshot refresh | Hosted **structural** SQL passed; cross-user RLS, row-lock races and Realtime delivery untested with live identities |
| Competitive/community | Leaderboard/profile presentation, local archive | Rated matchmaking/settlement, durable player history, friends, chat, spectators, tournaments and moderation remain planned/partial |
| Release | GitHub Actions quality workflow and successful Vercel frontend build exist | Remote CI status not verified; Vercel authentication prevents public smoke test; deployment is not validated as usable multiplayer |

## Latest reproducible local evidence

| Check | Result | What it proves |
| --- | --- | --- |
| `npm run check` with native build filesystem access | **PASS**, exit 0: ESLint, strict TypeScript, **52/52** Vitest across eight files, Next Webpack **17/17** generated pages | Current checkout passes local code, unit and production build gates |
| `npm run test:e2e` native Chromium | **PASS**, exit 0: **40 passed, one staging test intentionally skipped** | Real local browser play and UI plus mocked online responses work in covered scenarios |
| Hosted `supabase/tests/structural-acceptance.sql` (checkpoint 22) | **PASS** on dedicated project | Seven RLS tables, grants, Realtime publication, indexes and selected timeout helper inputs satisfy specified structural checks |
| Earlier restricted-sandbox `npm run check` | `EPERM` writing `.next` in build stage | Filesystem permission artifact, superseded by native-access complete PASS; does **not** show a code build failure |

The opt-in `e2e/staging-online.spec.ts` is still skipped because the Next.js runtime has no dedicated staging `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, or server-only `SUPABASE_SECRET_KEY`/legacy `SUPABASE_SERVICE_ROLE_KEY`. A passing mocked API response does **not** verify a real session, row lock, clock, rating or Realtime subscription. No current evidence confirms hosted Auth/RLS transactions or independent browser clients. Avoid placing keys in docs, logs or client bundles.

## Findings ordered by risk

| Severity | Finding and evidence | Follow-up / exit criterion |
| --- | --- | --- |
| **P0 blocker** | Real hosted Auth/create/join/move/resign/claim, third-user denial, two-client persistence and reconnect have **not run**. Staging schema checks cannot substitute for these. | Provision authorized staging runtime, run guarded three-identity E2E; verify test data cleanup and record real requests/results. |
| **P0 blocker** | Trusted database clock logic, duplicate/reordered requests, lock waits, expiration after 26 days and timeout-versus-resignation have migrations/source coverage but no concurrent PostgreSQL acceptance. | Execute `STAGING_CLOCK_CONCURRENCY_TEST.md` against **disposable** staging games with two SQL connections; assert single canonical state and server time. |
| **P0 feature gap** | Rated pairing and exactly-once rating settlement are not finished; UI cannot claim a functioning rated service. | Design and test atomic queue/seat assignment and idempotent ledger transaction, then rated E2E before launch. |
| **P0 security boundary to verify** | Next.js validates chess moves and privileged RPC receives resulting FEN/PGN/result; database trusts the verified application boundary. Privileged service credentials therefore have high impact. No bypass is established by the audit alone. | Test authenticated actor derivation, private API authorization, direct-table/RPC grants, client bundle secret absence and source-to-RPC invariant parity. |
| **P1 quality gap** | Browser, Worker and local rules regressions pass, but broader long-session clocks, accessibility, keyboard/screen-reader, mobile and cross-browser testing are incomplete. | Targeted real-device/assistive QA and long-game stress tests with results recorded. |
| **P1 product gap** | Hosted profile/history, licensed engine analysis, richer puzzles and opening content are partial. | Complete after hosted identity/game correctness, with permissions and replay integrity checks. |
| **P2 roadmap gap** | Chat, friends, spectator authorization, notifications, tournament/moderation workflows are not yet functional. | Defer until hosted roles, privacy and rate-limit policies are proven. |
| **P0 release blocker** | Remote CI unverified, dependency audit failed DNS (`ENOTFOUND registry.npmjs.org`), protected Vercel deployment not publicly smoke-tested. | Verify CI/registry availability, preview access by an approved mechanism, secret scanning, a11y, load/performance and rollback rehearsal. |

## Database and deployment precautions

- The eight migrations are already installed on the **dedicated** Rookline project; local SQL filenames and remote MCP migration versions differ. Reconcile `SUPABASE_MIGRATION_HISTORY.md` **before** any CLI `db push`. Do not apply changes to unrelated projects.
- Do not infer a PASS from prewritten staging test assertions. Run actual authorized identities, protect service-role credentials and keep cleanup limited to disposable test fixtures.
- Earlier Vercel frontend build was READY, but deployment protection returned a login page to unauthenticated smoke probes; no public access-control change is authorized as part of this review.
- No code functionality, migration, production deployment or `main` merge was changed by this audit. See `CONTINUATION_PLAN_2026-10-30.md` for the actionable next slices, `TEST_RESULTS.md` for historical evidence and `FINAL_AUDIT.md` for acceptance gates.
