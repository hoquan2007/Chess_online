# Supabase migration history — chessonline staging

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
