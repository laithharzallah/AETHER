-- Roles and tenant membership are authorization data, not editable profile data.
-- Signup provisions these fields with the service-role client (lib/actions/auth.ts).
-- Preserve SELECT/RLS and service-role provisioning; allow self-service name edits.
revoke update on table public.profiles from public, anon, authenticated;
revoke update (id, organization_id, full_name, email, role, created_at, updated_at)
  on public.profiles from public, anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

do $$
begin
  if has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
    or has_column_privilege('authenticated', 'public.profiles', 'organization_id', 'UPDATE')
    or has_column_privilege('anon', 'public.profiles', 'role', 'UPDATE') then
    raise exception 'Profile authorization privileges are still writable';
  end if;
  if not has_column_privilege('service_role', 'public.profiles', 'role', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') then
    raise exception 'Required profile provisioning/edit privileges are missing';
  end if;
end $$;
