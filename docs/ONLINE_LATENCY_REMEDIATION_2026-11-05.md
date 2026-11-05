# Rookline online move latency: diagnosis, plan, implementation and verification

Date: 2026-11-05. Development branch: `codex/chess-platform-foundation`.

## Observed path before this change

1. The browser sent `POST /api/games/:id/move`, waited for the database's locked `rookline_commit_move` RPC, then **always sent a second `GET /api/games/:id`** before painting the new board.
2. Every active-game GET authenticated, fetched the game, called a clock-expiry RPC that locks the row, and fetched the game again. This costs several server/database trips and may queue behind a move. It is intentional for authoritative timeouts and cannot safely be bypassed without replacing its correctness guarantees.
3. Automatic 3-second polls, Realtime hints, focus/online notifications and manual Sync could overlap. The client checked request order and canonical chess ledger versions, but did not cap automatic concurrent requests.

These are code-path findings, **not measured production latency**. A protected Preview comparison with two real Auth identities has since measured end-to-end latency; production and two separate physical client machines remain unmeasured.

## Execution plan

| Priority | Action | Acceptance evidence |
| --- | --- | --- |
| P0 | Include the fresh Postgres canonical game, viewer seat and server-time display hint in accepted, duplicate and timeout move responses. Never compute authoritative result or clocks in the client. | Route tests cover accepted, duplicate, timeout, post-commit read failure and access revocation. |
| P0 | Apply the response snapshot immediately after POST; fence older outstanding GETs; fall back to GET for missing or invalid snapshots. | Chromium tests show move history advances while old GET is blocked; older denial cannot erase newer verified state. |
| P1 | Coalesce **automatic** polling/Realtime/focus refreshes into one in-flight read. Preserve independent explicit Sync requests for out-of-order and authorization recovery coverage. | Existing stale-response, disconnect, revoked-access and reordered requests tests continue to pass. |
| P1 | Use a 5-second backup poll when Realtime reports subscribed, 3 seconds if unavailable, and resume on visibility/reconnection. Keep server-owned clocks and active-game expiration. | Browser regression suite and code review. |
| P2 | Measure at least 30 moves across two real signed-in users with timestamps for button-to-POST response, button-to-board commit, and sender-to-opponent update; record p50/p95, region, loss and Realtime health. | Protected HTTPS Preview measurement report with reproducible runs. |
| P2 | If remote p95 remains high: inspect Vercel function region vs Supabase database region, cold starts, rate limit and RPC queue times, and Postgres connection pressure. Optimize only from evidence. | New before/after measurements plus two-session PostgreSQL lock/clock race tests. |

## Design and safety invariants

- `chess.js` on the server and the Postgres row-locked move RPC remain the final move authority. Browsers provide only requested coordinates, promotion, expected ply and idempotency key.
- A returned board is read from Postgres **after** the RPC finishes. Error/empty post-commit reads return the old lightweight acknowledgement and prompt an authenticated GET, without constructing FEN, PGN, result or time locally.
- A changed participant after the RPC is forbidden. Existing `isOlderGameSnapshot`, `replayGame`, epoch, AbortController and stale request precedence protect the UI from outdated or contradictory replies.
- A disconnected or revoked session must remain fail-closed. Polling is a resilience path; Realtime remains an untrusted wake-up hint.
- No SQL migration, altered rated logic, `main` merge or production rollout is included.

## Verification and protected-Preview evidence

**Verified on 2026-11-05 in the development worktree:** `npm run check` completed successfully with historical migration-file hash parity 9/9 (local comparison only; remote database not queried), ESLint PASS, strict TypeScript PASS, **513/513 Vitest PASS across 78 files**, and a Next.js 16.4.3 Webpack production build with **23/23 static pages generated**. The move-route suite covers accepted, duplicate and timeout RPC outcomes, failed post-commit reads and participant revocation. **17/17 focused Chromium scenarios PASS**, covering immediate POST snapshot rendering, one automatic in-flight read, stale/reordered reads, clocks, access changes, reconnect, and game-room feedback. The focused Chromium runs use mocked API/network timing rather than a deployed two-user session.

**Final production-build regression (2026-11-05):** `ROOKLINE_E2E_PRODUCTION=1 npx playwright test e2e/rookline.spec.ts` exited 0 with **111/111 Chromium tests PASS, 0 FAIL**. The two latency-specific regressions passed within that run: an accepted POST snapshot renders before a delayed GET completes, and simultaneous automatic refresh triggers result in one in-flight read. Two tests that had failed during a prior development-server run were adjusted for valid configured/unconfigured anonymous API outcomes and a time-control selection hydration race; focused production rerun passed **2/2**, then the complete production-file rerun passed **111/111**. These browser scenarios still mock multiplayer HTTP timing and cannot establish real remote latency improvement.

**Full repository Chromium regression:** `ROOKLINE_E2E_PRODUCTION=1 npx playwright test --workers=1 --reporter=dot` exited 0 with **124 PASS / 3 conditional SKIP / 0 FAIL (127 collected)**, covering the rest of the repository's E2E specs. The conditional skips do not constitute hosted multiplayer acceptance.

**P2 hosted baseline measured on 2026-11-05:** A real, protected nonproduction Preview (`dpl_B9oECfvArxLL4PbHxyxDeTVtvgkV`, deployed source `c48970b`) passed `e2e/staging-latency.spec.ts` **1/1** with **32/32 real legal moves**, two distinct Supabase Auth accounts, two separate Chromium contexts, and both Realtime subscribers receiving **32/32 events**. The old Preview's **move POST p50/p95 was 2,604/4,403 ms; sender-board 4,018/6,531 ms; opponent-board 4,536/6,415 ms** (all measured from click). That deployment returned **0/32 canonical move snapshots**, confirming it predates the uncommitted local P0/P1 response optimization. Functions ran in **`iad1` (Virginia)** while Supabase staging lives in **`ap-southeast-1` (Singapore)**. Read-only Postgres cumulative `rookline_commit_move` statistics after this run showed **46 calls, mean SQL 1.915 ms, max 16.132 ms**; `public.games` is in the Realtime publication; point-in-time **16 DB sessions and 0 lock waits**. See [P2 detailed report](P2_PREVIEW_LATENCY_2026-11-05.md) and [sanitized 32-move evidence](evidence/staging-latency-preview-2026-11-05.json). The two browser sessions shared one host, so this is an authenticated two-client baseline rather than geographically separate human-operated clients.

**P2 protected-Preview before/after comparison COMPLETED (2026-11-05):** Isolated `codex/p2-realtime-preview` checkout SHA `5e41c0548138e5b07cc66b5c0f5febd2a6a3bb2b` was deployed to **READY, nonproduction, protected** Preview `https://chessonline-kotyvnzx0-hnquan.vercel.app` (`dpl_5bft2J4BoSP2yLUgFPp1UrPgiJ1s`) with Vercel Functions in **`sin1` (Singapore)**, near staging Postgres **`ap-southeast-1`**. This candidate corrects the original game-room Realtime authorization/binding and applies canonical POST snapshots immediately. The same two-account, two-Chromium-context, 32-legal-move benchmark passed **1/1**, with **32/32 server snapshots, 32/32 browser-room Postgres changes per player and 32/32 events per independent Realtime subscriber**. Both browser WebSockets joined with auth and one change binding; no disconnects were seen. Both accounts/game cleaned up.

| Click-to-event p50 / p95 | Old `iad1` Preview | New `sin1` Preview | Observed reduction |
| --- | ---: | ---: | ---: |
| Move POST | 2,604 / 4,403 ms | **450 / 646 ms** | **2,154 / 3,757 ms** |
| Sender board | 4,018 / 6,531 ms | **457 / 652 ms** | **3,561 / 5,879 ms** |
| Opponent board | 4,536 / 6,415 ms | **998 / 1,120 ms** | **3,538 / 5,295 ms** |

After the new test, `rookline_commit_move` showed **154 cumulative Postgres statement calls** with **mean execution 1.580 ms**, **max 16.132 ms** and **0 observed lock waiters** in a snapshot of 25 sessions; these are **not** per-move SQL p50/p95 or a measure of full API/network latency. See [complete measured report](P2_PREVIEW_LATENCY_2026-11-05.md) and [sanitized optimized per-move evidence](evidence/staging-latency-verified-sin1-2026-11-05.json). The two browser sessions ran on **one Windows host** and the tested versions changed **both code and server region**. The differences are observed, not isolated causal improvements. Same-region opponent p95 **1,120 ms** misses the proposed <800 ms target. Next: distinct physical clients across regions, multiple repeat runs, warm/cold Function and Realtime/GET spans, and independent 2-session direct PostgreSQL row-lock/clock races. **Rated OFF, 20 gates OPEN, no `main` merge or production rollout.**
