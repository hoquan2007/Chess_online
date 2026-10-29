# Active task

**CH-03/04:** Active local/computer game clocks now charge elapsed wall time across a browser reload, immediately adjudicate flag fall and suppress an expired computer reply. Legacy saves without clock-running metadata remain paused for compatibility. Continue local accessibility and secure hosted chess games between two authenticated users.

Local lint/typecheck, **49/49** unit tests and **27/27** complete Playwright suite passed at checkpoint 10 (54.2 s). Webpack build passed (17/17 static pages). Three online browser cases use mocked API state. Five SQL migrations, private create/join/move/resign/claim routes, server replay, locked-row RPC drafts and room UI exist but are **not** verified against live Supabase. Next: locally verifiable accessibility/analysis QA, then stage SQL migrations, RLS and concurrent two-user end-to-end game with clocks/draw claims once a dedicated staging project exists.

Current status: IN_PROGRESS. No live Supabase environment configured; all 20 acceptance gates remain open.
