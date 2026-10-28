# Known blockers

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are blank; no linked staging database has been used. Live account, RLS, Realtime and two-client checks cannot be claimed.
- Privileged server function credential (`SUPABASE_SERVICE_ROLE_KEY`) is not provisioned. Server-only operations must fail closed until configured.
- Previous Turbopack/permission failures were superseded **for Webpack** by `npm run build -- --webpack` PASS; default Turbopack and hosted CI execution remain unverified.
- Current dependency security audit is inconclusive: `npm audit --omit=dev --json` failed DNS resolution (`getaddrinfo ENOTFOUND registry.npmjs.org`). Recheck when the registry can be reached.
- Authenticated online create/join/move/resign/claim UI and SQL exist but have never run against a live Supabase DB; real private Realtime, concurrency, RLS, timers, draw adjudication, result settlement and two-account E2E are still blocked. Local `psql`, Docker and Supabase CLI were unavailable when checked.
- Rated matchmaking, atomic rating settlement, draw offers/rematches, engine analysis, notifications, tournament basics and moderation are unfinished independent scope.
