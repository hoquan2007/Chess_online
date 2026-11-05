-- S5: authenticated tournament registration and private moderation intake.
-- Staging-only until independently tested with real JWTs and concurrency.
-- A tournament cannot advance to play or award ratings until a separately
-- validated server-authoritative pairing and result pipeline exists.

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users(id),
  title text not null check (char_length(title) between 4 and 80),
  description text not null default '' check (char_length(description) <= 400),
  starts_at timestamptz not null,
  capacity integer not null check (capacity between 4 and 64),
  status text not null default 'registration' check (status in ('registration', 'cancelled')),
  created_at timestamptz not null default clock_timestamp()
);
create index tournaments_starts_idx on public.tournaments(starts_at) where status = 'registration';
create index tournaments_owner_created_idx on public.tournaments(organizer_id, created_at desc);

create table public.tournament_entries (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default clock_timestamp(),
  primary key (tournament_id, player_id)
);
create index tournament_entries_player_idx on public.tournament_entries(player_id);

create table public.player_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references auth.users(id),
  target_id uuid not null references auth.users(id),
  category text not null check (category in ('harassment','spam','cheating','other')),
  details text not null check (char_length(details) between 20 and 500),
  status text not null default 'pending' check (status in ('pending','resolved','dismissed')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check (reporter_id <> target_id),
  check ((status = 'pending') = (reviewed_at is null and reviewed_by is null))
);
create index player_reports_reporter_idx on public.player_reports(reporter_id, created_at desc);
create index player_reports_queue_idx on public.player_reports(created_at) where status = 'pending';

-- Only database owners may grant staff privileges. No client read/write access.
create table public.moderation_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  appointed_at timestamptz not null default now()
);

alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.player_reports enable row level security;
alter table public.moderation_staff enable row level security;
create policy player_reports_own_read on public.player_reports for select to authenticated
  using (reporter_id = (select auth.uid()));
revoke all on public.tournaments, public.tournament_entries, public.player_reports,
  public.moderation_staff from public, anon, authenticated;
grant select on public.player_reports to authenticated;
-- Expose aggregate tournament listings only through a bounded RPC. Never
-- expose entrant lists or confidential reports to a participant.

create or replace function public.rookline_tournament_create(
  p_title text, p_description text, p_starts_at timestamptz, p_capacity integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz;
  v_id uuid;
begin
  if v_actor is null then raise exception 'sign_in_required'; end if;
  v_now := clock_timestamp();
  if p_title is null or char_length(btrim(p_title)) not between 4 and 80
    or p_title <> btrim(p_title)
    or p_description is null or char_length(p_description) > 400
    or p_starts_at is null or p_starts_at < v_now + interval '1 hour'
    or p_starts_at > v_now + interval '90 days'
    or p_capacity is null or p_capacity not between 4 and 64 then
    raise exception 'invalid_tournament';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('tournament_create:' || v_actor::text, 0));
  if (select count(*) from public.tournaments
      where organizer_id = v_actor and created_at > v_now - interval '24 hours') >= 3 then
    raise exception 'tournament_rate_limited';
  end if;
  insert into public.tournaments(organizer_id, title, description, starts_at, capacity)
    values(v_actor, p_title, p_description, p_starts_at, p_capacity)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.rookline_tournament_action(p_action text, p_tournament uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_event public.tournaments%rowtype;
begin
  if v_actor is null then raise exception 'sign_in_required'; end if;
  if p_action not in ('join','leave','cancel') or p_action is null or p_tournament is null then
    raise exception 'invalid_tournament_action';
  end if;
  -- The same event row serializes join-versus-join and join-versus-cancel.
  select * into v_event from public.tournaments where id = p_tournament for update;
  if not found then raise exception 'tournament_unavailable'; end if;
  if p_action = 'cancel' then
    if v_event.organizer_id <> v_actor or v_event.status <> 'registration'
      or v_event.starts_at <= clock_timestamp() then raise exception 'tournament_unavailable'; end if;
    update public.tournaments set status='cancelled' where id=p_tournament;
    return 'cancelled';
  end if;
  if v_event.status <> 'registration' or
      v_event.starts_at - interval '15 minutes' <= clock_timestamp() then
    raise exception 'tournament_closed';
  end if;
  if p_action = 'leave' then
    delete from public.tournament_entries where tournament_id=p_tournament and player_id=v_actor;
    return 'left';
  end if;
  if exists (select 1 from public.tournament_entries
      where tournament_id=p_tournament and player_id=v_actor) then return 'already_joined'; end if;
  if (select count(*) from public.tournament_entries where tournament_id=p_tournament) >= v_event.capacity then
    raise exception 'tournament_full';
  end if;
  insert into public.tournament_entries(tournament_id,player_id) values(p_tournament,v_actor);
  return 'joined';
end $$;

create or replace function public.rookline_tournament_list()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'title', t.title, 'description', t.description,
    'organizerId', t.organizer_id, 'startsAt', t.starts_at,
    'capacity', t.capacity, 'status', t.status,
    'entries', (select count(*) from public.tournament_entries e where e.tournament_id=t.id),
    'joined', exists (select 1 from public.tournament_entries e where e.tournament_id=t.id and e.player_id=auth.uid())
  ) order by t.starts_at), '[]'::jsonb)
  from (select * from public.tournaments
    where auth.uid() is not null and (status='registration' or organizer_id=auth.uid())
    order by starts_at limit 40) t;
$$;

create or replace function public.rookline_report_player(p_target uuid, p_category text, p_details text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz;
  v_id bigint;
begin
  if v_actor is null then raise exception 'sign_in_required'; end if;
  if p_target is null or p_target = v_actor or
    p_category is null or p_category not in ('harassment','spam','cheating','other') or
    p_details is null or char_length(btrim(p_details)) not between 20 and 500 or
    not exists (select 1 from public.profiles where id=p_target) then
    raise exception 'invalid_report';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('report_rate:' || v_actor::text, 0));
  v_now := clock_timestamp();
  if (select count(*) from public.player_reports
      where reporter_id=v_actor and created_at > v_now - interval '24 hours') >= 5 then
    raise exception 'report_rate_limited';
  end if;
  if exists (select 1 from public.player_reports where reporter_id=v_actor
      and target_id=p_target and category=p_category and created_at > v_now - interval '24 hours') then
    raise exception 'report_duplicate';
  end if;
  insert into public.player_reports(reporter_id,target_id,category,details)
    values(v_actor,p_target,p_category,btrim(p_details)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.rookline_moderation_queue()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.moderation_staff where user_id=auth.uid()) then
    raise exception 'moderator_required';
  end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at), '[]'::jsonb) into v_result
    from (select id, reporter_id, target_id, category, details, created_at
      from public.player_reports where status='pending' order by created_at limit 50) q;
  return v_result;
end $$;

create or replace function public.rookline_moderate_report(p_report bigint, p_decision text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.uid() is null or not exists (select 1 from public.moderation_staff where user_id=auth.uid()) then
    raise exception 'moderator_required';
  end if;
  if p_decision not in ('resolved','dismissed') or p_decision is null or p_report is null then
    raise exception 'invalid_moderation_action';
  end if;
  update public.player_reports set status=p_decision, reviewed_at=clock_timestamp(), reviewed_by=auth.uid()
    where id=p_report and status='pending';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'report_already_reviewed'; end if;
  return p_decision;
end $$;

revoke all on function public.rookline_tournament_create(text,text,timestamptz,integer),
  public.rookline_tournament_action(text,uuid), public.rookline_tournament_list(),
  public.rookline_report_player(uuid,text,text), public.rookline_moderation_queue(),
  public.rookline_moderate_report(bigint,text) from public, anon, authenticated;
grant execute on function public.rookline_tournament_create(text,text,timestamptz,integer),
  public.rookline_tournament_action(text,uuid), public.rookline_tournament_list(),
  public.rookline_report_player(uuid,text,text), public.rookline_moderation_queue(),
  public.rookline_moderate_report(bigint,text) to authenticated;
