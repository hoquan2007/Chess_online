# Active task

**CH-03/11/19:** Local Undo now withdraws obsolete completed-game archive entries after reopening a finished game; promotion dialog remains keyboard accessible across modes. Continue independent correctness QA and secure hosted chess games between two authenticated users.

Local lint/typecheck, **49/49** unit tests and **31/31** complete Playwright suite passed at checkpoint 12 (~1.0 min). Webpack build passed (17/17 static pages). Three online browser cases use mocked API state; hosted room promotion has no real-game test. Five SQL migrations, private create/join/move/resign/claim routes, server replay, locked-row RPC drafts and room UI exist but are **not** verified against live Supabase. Next: locally verifiable engine/long-game QA, then stage SQL migrations, RLS and concurrent two-user end-to-end game with clocks/draw claims once a dedicated staging project exists.

Current status: IN_PROGRESS. No live Supabase environment configured; all 20 acceptance gates remain open.
