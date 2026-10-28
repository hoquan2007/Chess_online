# Vercel deployment guide (pre-release)

1. Create a Supabase project with Auth and PostgreSQL. Run versioned migrations under `supabase/migrations` in staging first.
2. Verify RLS via accounts with different identities; verify RPC grants and that anonymous clients cannot mutate authoritative game tables.
3. Configure environment variables on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. If privileged server operations are used, configure `SUPABASE_SERVICE_ROLE_KEY` as **server-only**. Never prefix privileged keys with `NEXT_PUBLIC_`.
4. Set Supabase Auth redirect / callback URLs to the exact staging and approved production origins. Configure allowed redirect origins and email templates.
5. Build with `npm ci`, run `npm run check` plus Playwright and real integration suites. Verify no known high/critical dependency vulnerabilities and check licenses.
6. Verify two authenticated browsers can play, reconnect, and finish. Verify clocks, immutability, one-time rating updates, logout, rate limiting and audit logs. Test on a preview environment first.
7. Set up preview and production projects in Vercel, custom domain and secure HTTP headers. Owner authorization required before public production deployment and main branch merge.

This guide describes a **planned** deployment. No production deployment, hosted SQL execution or live environment verification has occurred.
