-- Read-only staging SQL smoke. Run only against dedicated Rookline project
-- tyvczicinpjixmxgjhjn; a successful result is structural evidence, NOT
-- authenticated browser/RLS, row-lock concurrency, or Realtime delivery proof.
-- Raise on any mismatch; this script creates no users, rows or migrations.

do $rookline_smoke$
declare
  v_table text;
  v_function text;
  v_white uuid := '00000000-0000-4000-8000-000000000001';
  v_black uuid := '00000000-0000-4000-8000-000000000002';
begin
  foreach v_table in array array[
    'profiles','preferences','games','moves','ratings','rating_history','game_rate_limits'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table and c.relrowsecurity
    ) then
      raise exception 'Missing RLS on public.%', v_table;
    end if;
  end loop;

  foreach v_table in array array[
    'games','moves','ratings','rating_history','game_rate_limits'
  ] loop
    if has_table_privilege('authenticated', format('public.%I',v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I',v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I',v_table), 'DELETE')
       or has_table_privilege('anon', format('public.%I',v_table), 'SELECT') then
      raise exception 'Unexpected client privileges on public.%', v_table;
    end if;
  end loop;

  if has_column_privilege('authenticated','public.profiles','id','UPDATE')
     or not has_column_privilege('authenticated','public.profiles','display_name','UPDATE') then
    raise exception 'Profile presentation-field grants mismatch';
  end if;

  foreach v_function in array array[
    'rookline_join_game','rookline_commit_move','rookline_resign_game',
    'rookline_expire_game','rookline_claim_draw',
    'create_profile_for_user','rls_auto_enable'
  ] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=v_function
    ) then
      raise exception 'Missing function public.%', v_function;
    end if;
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=v_function
        and (has_function_privilege('anon',p.oid,'EXECUTE')
          or has_function_privilege('authenticated',p.oid,'EXECUTE')
          or not has_function_privilege('service_role',p.oid,'EXECUTE'))
    ) then
      raise exception 'Privileged function grant mismatch on public.%', v_function;
    end if;
  end loop;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='games'
  ) then
    raise exception 'games is absent from the Supabase Realtime publication';
  end if;
  if to_regclass('public.games_winner_id_idx') is null
     or to_regclass('public.moves_player_id_idx') is null
     or to_regclass('public.rating_history_user_id_idx') is null then
    raise exception 'Missing a Rookline foreign-key covering index';
  end if;

  -- Actual hosted execution of the FIDE mating-potential helper, including
  -- promoted same-colour bishops and the opposite-colour exception.
  if public.rookline_timeout_winner(
      '7k/8/8/8/8/8/8/K7 w - - 0 1', 'w', v_white, v_black
    ) is not null then
    raise exception 'Bare kings must draw on timeout';
  end if;
  if public.rookline_timeout_winner(
      '2b4k/8/4b3/8/8/8/8/K7 w - - 0 1', 'w', v_white, v_black
    ) is not null then
    raise exception 'Same-colour bishop-only timeout must draw';
  end if;
  if public.rookline_timeout_winner(
      '2b4k/8/5b2/8/8/8/8/K7 w - - 0 1', 'w', v_white, v_black
    ) is distinct from v_black then
    raise exception 'Opposite-colour bishops can win on timeout';
  end if;
  if public.rookline_timeout_winner(
      '7k/8/8/8/8/8/8/K6R b - - 0 1', 'b', v_white, v_black
    ) is distinct from v_white then
    raise exception 'Rook can win on opponent timeout';
  end if;

  raise notice 'Rookline staging structural smoke passed (privileges, RLS, Realtime publication, helper).';
end
$rookline_smoke$;
