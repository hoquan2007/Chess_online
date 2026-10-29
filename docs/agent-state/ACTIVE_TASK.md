# Active task

**CH-02/04/19:** Computer resignation now records the human's chosen side while the bot thinks, and Claim draw is unavailable on the bot's turn. Previous stale Worker errors after Reset, local archived-result Undo and shared accessible promotion remain covered. Continue local correctness QA and secure hosted chess games between authenticated users.

Local lint/typecheck, **49/49** unit tests and **34/34** complete Playwright suite passed at checkpoint 14 (~1.0 min). Webpack build passed (17/17 static pages). Computer turn-ownership tests use a simulated waiting Worker; a separate real Worker test passes. Three online browser cases use mocked API state; hosted room promotion has no real-game test. Five SQL migrations, private create/join/move/resign/claim routes, server replay, locked-row RPC drafts and room UI exist but are **not** verified against live Supabase. Next: locally verifiable engine/long-game QA, then stage SQL migrations, RLS and concurrent two-user end-to-end game with clocks/draw claims once a dedicated staging project exists.

Current status: IN_PROGRESS. No live Supabase environment configured; all 20 acceptance gates remain open.
