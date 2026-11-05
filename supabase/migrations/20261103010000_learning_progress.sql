-- S4: additive, account-scoped completion records. Existing device progress
-- remains usable offline. Apply to isolated staging before hosted E2E.
create table public.learning_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('puzzle','study')),
  item_id text not null check (item_id ~ '^[a-z0-9:-]{3,64}$'),
  completed_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);

create index learning_progress_user_recent on public.learning_progress (user_id, completed_at desc);
alter table public.learning_progress enable row level security;
create policy learning_progress_owner_read on public.learning_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy learning_progress_owner_insert on public.learning_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
revoke all on public.learning_progress from public, anon, authenticated;
grant select, insert on public.learning_progress to authenticated;
