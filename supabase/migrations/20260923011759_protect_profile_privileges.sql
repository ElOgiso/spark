-- RLS limits rows, not columns. Keep existing profile and admin RPC contracts.
-- Auth's handle_new_user owns account creation and privileged defaults.
revoke insert, update, delete on public.profiles from public, anon, authenticated;
-- Remove any historic column grants as well as the table-wide grants.
do $$
declare c record;
begin
  for c in select attname from pg_attribute
    where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped
  loop
    execute format('revoke insert (%I), update (%I) on public.profiles from public, anon, authenticated', c.attname, c.attname);
  end loop;
end $$;
grant update (display_name, full_name, username, avatar_url, onboarding_complete, active_brand_id, updated_at)
  on public.profiles to authenticated;
-- Existing SECURITY DEFINER admin RPCs retain their owner privileges and checks.
