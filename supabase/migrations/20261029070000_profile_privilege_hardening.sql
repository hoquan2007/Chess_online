-- Rookline staging: limit Data API grants to the operations supported by RLS.
-- Some Supabase projects grant broad table/function privileges by default.
-- Revoking them is defense in depth; row-level policies remain in force.

revoke all on table public.profiles, public.preferences from public, anon, authenticated;

-- Profiles are inserted by the auth.users trigger, not by the client.
grant select on table public.profiles to authenticated;
grant update (username, display_name, avatar_url) on table public.profiles to authenticated;

-- Preferences can be managed only by their owner (preferences_own RLS policy).
grant select, insert, update, delete on table public.preferences to authenticated;

-- No client role should invoke the privileged auth trigger function directly.
-- Existing auth.users triggers continue to execute under the function owner.
revoke all on function public.create_profile_for_user() from public, anon, authenticated;
