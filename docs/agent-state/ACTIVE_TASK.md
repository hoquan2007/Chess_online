# Active task

**CH-02/07/08/12:** Verified online game-room PGN download against a mocked completed snapshot and corrected expiration-before-resignation ordering in a versioned SQL migration. Continue source-level server clock hardening while preparing secure hosted chess games between two authenticated users.

Local lint/typecheck, **44/44** unit tests and **22/22** Playwright passed during checkpoint 6 (42.4 s); Webpack build passed (17/17 static pages). Three online browser cases use mocked API state. Four SQL migrations, private create/join/move/resign/claim routes, server replay, locked-row RPC drafts and room UI exist but are **not** verified against live Supabase. Next: commit the verified PGN/clock slice, then stage SQL migrations, RLS and concurrent two-user end-to-end game with clocks/draw claims. Until staging exists, continue independent analysis/security/accessibility work.

Current status: IN_PROGRESS. No live Supabase environment configured; all 20 acceptance gates remain open.
