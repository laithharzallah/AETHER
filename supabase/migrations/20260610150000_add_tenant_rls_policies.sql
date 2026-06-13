-- =============================================================================
-- AETHER.ai tenant RLS policies
-- Model: profiles.id = auth.uid(); tenant = profiles.organization_id
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECURITY DEFINER helpers (bypass RLS — avoid recursion on profiles)
-- -----------------------------------------------------------------------------

create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_user_org_id() from public;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_org_id() to authenticated;
grant execute on function public.current_user_role()  to authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create policy "profiles_select_own_or_org"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or organization_id = public.current_user_org_id()
  );

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (
    id = (select auth.uid())
  )
  with check (
    id = (select auth.uid())
    and organization_id = public.current_user_org_id()
  );

-- No INSERT / DELETE for authenticated — created via service role at signup.

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------

create policy "organizations_select_tenant"
  on public.organizations
  for select
  to authenticated
  using (
    id = public.current_user_org_id()
  );

create policy "organizations_update_admin"
  on public.organizations
  for update
  to authenticated
  using (
    id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  );

-- No INSERT / DELETE for authenticated — handled by service role at signup.

-- -----------------------------------------------------------------------------
-- client_workspaces
-- -----------------------------------------------------------------------------

create policy "client_workspaces_select_tenant"
  on public.client_workspaces
  for select
  to authenticated
  using (
    organization_id = public.current_user_org_id()
  );

create policy "client_workspaces_insert_tenant"
  on public.client_workspaces
  for insert
  to authenticated
  with check (
    organization_id = public.current_user_org_id()
  );

create policy "client_workspaces_update_tenant"
  on public.client_workspaces
  for update
  to authenticated
  using (
    organization_id = public.current_user_org_id()
  )
  with check (
    organization_id = public.current_user_org_id()
  );

create policy "client_workspaces_delete_tenant"
  on public.client_workspaces
  for delete
  to authenticated
  using (
    organization_id = public.current_user_org_id()
  );
