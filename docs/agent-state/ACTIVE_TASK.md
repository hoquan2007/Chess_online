# Active task

**CH-02/03/07:** FIDE draw and timeout rule handling; local clock-accurate Undo; prepare secure hosted chess games between two authenticated users.

Local lint/typecheck, 37/37 unit tests, 15/15 Playwright and Webpack build passed at checkpoint 3. Private create/join/move/resign/claim routes, server replay, locked-row RPC drafts and room UI exist but are **not** verified against live Supabase. Next: stage SQL migrations, RLS and concurrent two-user end-to-end game with clocks/draw claims. Until staging exists, continue independent local clock and accessibility review.

Current status: IN_PROGRESS. No live Supabase environment configured; all 20 acceptance gates remain open.
