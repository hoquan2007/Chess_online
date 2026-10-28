# Active task

**CH-02/03/12:** Verified result-bearing PGN exports for local games and saved sessions, including custom FEN and resignation. Continue offline history/replay UX and secure hosted chess games between two authenticated users.

Local lint/typecheck, **47/47** unit tests and **23/23** Playwright passed during checkpoint 7 (43.1 s); Webpack build passed (17/17 static pages). Three online browser cases use mocked API state. Four SQL migrations, private create/join/move/resign/claim routes, server replay, locked-row RPC drafts and room UI exist but are **not** verified against live Supabase. Next: add accessible local archive UI and replay, then stage SQL migrations, RLS and concurrent two-user end-to-end game with clocks/draw claims once a dedicated staging project exists.

Current status: IN_PROGRESS. No live Supabase environment configured; all 20 acceptance gates remain open.
