# Active task

**CH-04/19:** A computer Worker error from a superseded request can no longer cancel the next game after Reset. Previously fixed local archived-result Undo and shared accessible promotion remain covered. Continue local engine/timing correctness and secure hosted chess games between two authenticated users.

Local lint/typecheck, **49/49** unit tests and **32/32** complete Playwright suite passed at checkpoint 13 (~1.0 min). Webpack build passed (17/17 static pages). Stale Worker race uses a simulated error; a separate real Worker test passes. Three online browser cases use mocked API state; hosted room promotion has no real-game test. Five SQL migrations, private create/join/move/resign/claim routes, server replay, locked-row RPC drafts and room UI exist but are **not** verified against live Supabase. Next: locally verifiable engine/long-game QA, then stage SQL migrations, RLS and concurrent two-user end-to-end game with clocks/draw claims once a dedicated staging project exists.

Current status: IN_PROGRESS. No live Supabase environment configured; all 20 acceptance gates remain open.
