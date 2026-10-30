# Supabase migration history — chessonline staging

**Revalidated 2026-10-31, checkpoint 72 — remote SQL content parity:** Queried `supabase_migrations.schema_migrations` in dedicated staging `tyvczicinpjixmxgjhjn` (read only). All nine installed entries each contain one stored SQL statement. Comparing `md5(array_to_string(statements, E'\n'))` for each entry to the corresponding local UTF-8 SQL file after removing exactly one terminal `LF` gave **9/9 identical hashes**. Thus the currently recorded migration SQL bodies match the tracked source; the local and remote *version identifiers still differ*, so `supabase db push` remains prohibited until deliberate history reconciliation and backup. The tenth rated migration remains unapplied. `npm run verify:migrations` now checks these pinned fingerprints locally as a drift safeguard; this local script is a snapshot check and cannot replace a future live database comparison. No database writes or credentials were used in this verification.

Read-only remote revalidation query:

```sql
select version, name, cardinality(statements) as statement_count,
  md5(coalesce(array_to_string(statements, E'\n'), '')) as statements_md5
from supabase_migrations.schema_migrations
order by version;
```

**Revalidated 2026-10-31, checkpoint 62:** Connected `list_migrations` returned these same nine remote versions and names. Read-only queries confirmed all seven public tables have RLS enabled; games, moves, ratings, rating_history, profiles and game_rate_limits disallow direct authenticated writes, while preferences allows authenticated writes subject to RLS. Security advisor still reports one INFO for deliberately policy-free `game_rate_limits`, and performance advisor two unused-index INFO notices. The mapping remains a record of names/versions and **does not independently prove remote SQL text equals the local files**. No history or schema changes were made.

Verified 2026-10-30 against the connected Supabase project `tyvczicinpjixmxgjhjn`. The table shows the **local filename** and the **remote version** recorded by Supabase when the MCP migration tool applied its SQL. Project identifiers and timestamps are not authentication secrets. No credentials belong in this document.

| Local SQL file (under `supabase/migrations/`) | Remote version | Remote migration name |
| --- | --- | --- |
| `20261029010000_foundation.sql` | `20261029164050` | `foundation` |
| `20261029020000_game_rate_limits.sql` | `20261029164242` | `game_rate_limits` |
| `20261029030000_draw_claims.sql` | `20261029164303` | `draw_claims` |
| `20261029040000_resignation_clock_authority.sql` | `20261029164333` | `resignation_clock_authority` |
| `20261029050000_mating_potential_adjudication.sql` | `20261029164420` | `mating_potential_adjudication` |
| `20261029060000_locked_move_and_claim_clocks.sql` | `20261029164501` | `locked_move_and_claim_clocks` |
| `20261029070000_profile_privilege_hardening.sql` | `20261029165046` | `profile_privilege_hardening` |
| `20261029080000_event_trigger_and_fk_indexes.sql` | `20261029172009` | `event_trigger_and_fk_indexes` |
| `20261029090000_cancel_waiting_challenge.sql` | `20261030003110` | `cancel_waiting_challenge` |

All nine migrations are present on the dedicated hosted project as of checkpoint 24. The ninth migration was applied through the connected staging migration tool, then confirmed with `list_migrations`; its creator-only cancellation function, row lock, service-role-only EXECUTE grant, and updated rate-limit constraint passed SQL checks. The complete structural acceptance SQL also ran successfully. **Authenticated user behavior and cancellation-versus-join races have not been tested live.** Do **not** run `supabase db push` against this database with the unmodified local history: source timestamps differ from the recorded remote IDs, so the CLI may attempt to reapply already executed changes. Before adopting CLI migrations, take a database backup, compare `supabase_migrations.schema_migrations` to the source set, decide on and review a migration-history reconciliation procedure, and verify the resulting plan performs no duplicate DDL. Never rewrite previously deployed SQL.

Hosted checks: seven public Rookline tables have RLS enabled; `game_rate_limits` intentionally has no client policies and is service-only. Profile updates are limited to `username`, `display_name` and `avatar_url`. All privileged game RPCs and `rls_auto_enable()` deny `EXECUTE` to `anon` and `authenticated` while `service_role` retains it. Three foreign-key-covering indexes exist. Security advisor reports only the rate-limit INFO (no WARN); performance advisor reports INFO about unused indexes on a new, largely unused database. None of these observations proves two-user Auth/RLS, row-lock concurrency, private Realtime or rated settlement. Those remain live acceptance tests.

Security references: Supabase linter [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [anonymous SECURITY DEFINER function](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated SECURITY DEFINER function](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
