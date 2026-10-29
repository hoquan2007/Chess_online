# Known blockers

- Hosted Supabase `chessonline` has all eight schema migrations applied, but the local Next.js runtime has no configured URL/publishable/privileged credential. Live account, user-specific RLS, Realtime and two-client API checks cannot be claimed.
- Privileged server operations require `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`), provisioned only in server-side environment settings. Never print or commit values; rotate exposed privileged credentials before any production use.
- Previous Turbopack/permission failures were superseded **for Webpack** by `npm run build -- --webpack` PASS; default Turbopack and hosted CI execution remain unverified.
- Current dependency security audit is inconclusive: `npm audit --omit=dev --json` failed DNS resolution (`getaddrinfo ENOTFOUND registry.npmjs.org`). Recheck when the registry can be reached.
- Authenticated online create/join/move/resign/claim UI has not yet been exercised against the live Supabase project; database structural checks passed but real private Realtime, concurrency, user-specific RLS, timers, draw adjudication, result settlement and two-account E2E are still blocked. Local `psql`, Docker and Supabase CLI were unavailable when checked. MCP migration history timestamps differ from local filenames; reconcile before CLI database push.
- Rated matchmaking, atomic rating settlement, draw offers/rematches, engine analysis, notifications, tournament basics and moderation are unfinished independent scope.
