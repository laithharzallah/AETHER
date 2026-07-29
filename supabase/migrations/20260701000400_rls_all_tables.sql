-- =============================================================================
-- AETHER.ai — complete RLS coverage
--
-- The original migration secured four tables and left the rest wide open. This
-- one closes the gap and makes the rule uniform: a row is visible to a user if
-- and only if its organization_id matches the caller's own.
--
-- Policies are generated from a table list rather than written out by hand, so a
-- new tenant table cannot accidentally ship with a different shape of rule — and
-- post-apply-checks.sql fails the build if any table ends up without one.
--
-- Roles:
--   owner, admin   full read/write, including delete
--   analyst        read/write, no delete
--   member         read/write on operational records, no delete
--   auditor        read-only across the whole tenant
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Role predicates
-- -----------------------------------------------------------------------------

create or replace function public.current_user_can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() <> 'auditor', false)
$$;

create or replace function public.current_user_can_delete()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('owner', 'admin'), false)
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('owner', 'admin'), false)
$$;

revoke all on function public.current_user_can_write() from public;
revoke all on function public.current_user_can_delete() from public;
revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_can_write()  to authenticated;
grant execute on function public.current_user_can_delete() to authenticated;
grant execute on function public.current_user_is_admin()   to authenticated;

-- -----------------------------------------------------------------------------
-- Policy generator
-- -----------------------------------------------------------------------------

create or replace function public.apply_tenant_rls(p_table text)
returns void
language plpgsql
as $$
declare
  tenant_match constant text := 'organization_id = public.current_user_org_id()';
begin
  execute format('alter table public.%I enable row level security', p_table);

  begin
    execute format(
      'create policy %I on public.%I for select to authenticated using (%s)',
      p_table || '_select_tenant', p_table, tenant_match
    );
  exception when duplicate_object then null; end;

  begin
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (%s and public.current_user_can_write())',
      p_table || '_insert_tenant', p_table, tenant_match
    );
  exception when duplicate_object then null; end;

  begin
    execute format(
      'create policy %I on public.%I for update to authenticated using (%s and public.current_user_can_write()) with check (%s)',
      p_table || '_update_tenant', p_table, tenant_match, tenant_match
    );
  exception when duplicate_object then null; end;

  begin
    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s and public.current_user_can_delete())',
      p_table || '_delete_tenant', p_table, tenant_match
    );
  exception when duplicate_object then null; end;
end;
$$;

comment on function public.apply_tenant_rls is
  'Applies the standard four tenant policies to a table carrying organization_id. Idempotent.';

-- -----------------------------------------------------------------------------
-- Tenant-scoped tables
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'policies',
    'policy_versions',
    'policy_approvals',
    'policy_control_coverage',
    'controls',
    'control_assessments',
    'evidence',
    'risks',
    'risk_treatments',
    'obligations',
    'tasks',
    'vendors',
    'ai_systems',
    'notifications',
    'signal_assessments',
    'machine_directives',
    'briefs'
  ]
  loop
    perform public.apply_tenant_rls(t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- briefs previously had no policy at all, which meant every brief in the
-- platform was reachable. The generator above now covers it.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- organization_modules — tenant-scoped, but entitlement is not self-service:
-- read your own, and only an admin may toggle.
-- -----------------------------------------------------------------------------

alter table public.organization_modules enable row level security;

do $$ begin
  create policy "organization_modules_select_tenant"
    on public.organization_modules for select to authenticated
    using (organization_id = public.current_user_org_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "organization_modules_update_admin"
    on public.organization_modules for update to authenticated
    using (organization_id = public.current_user_org_id() and public.current_user_is_admin())
    with check (organization_id = public.current_user_org_id());
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- machine_settings — visible to the tenant, changeable only by an admin, since
-- autonomy_level governs what the Machine may do without asking.
-- -----------------------------------------------------------------------------

do $$ begin
  create policy "machine_settings_select_tenant"
    on public.machine_settings for select to authenticated
    using (organization_id = public.current_user_org_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "machine_settings_insert_admin"
    on public.machine_settings for insert to authenticated
    with check (organization_id = public.current_user_org_id() and public.current_user_is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "machine_settings_update_admin"
    on public.machine_settings for update to authenticated
    using (organization_id = public.current_user_org_id() and public.current_user_is_admin())
    with check (organization_id = public.current_user_org_id());
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Machine telemetry
--
-- Runs without an organization_id are platform-wide ingestion cycles. Their
-- stats are deliberately kept free of per-tenant figures (see lib/machine), so
-- exposing timing and totals tells a tenant the pipeline is healthy without
-- revealing anything about other tenants.
-- -----------------------------------------------------------------------------

do $$ begin
  create policy "machine_runs_select_visible"
    on public.machine_runs for select to authenticated
    using (
      organization_id is null
      or organization_id = public.current_user_org_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "machine_run_steps_select_visible"
    on public.machine_run_steps for select to authenticated
    using (
      exists (
        select 1 from public.machine_runs r
        where r.id = machine_run_steps.run_id
          and (r.organization_id is null or r.organization_id = public.current_user_org_id())
      )
    );
exception when duplicate_object then null; end $$;

-- Feed health is public regulator infrastructure, not tenant data.
do $$ begin
  create policy "intelligence_source_state_select_authenticated"
    on public.intelligence_source_state for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Signal triage needs to be writable by the tenant (dismiss / mark actioned)
-- but the score itself is the Machine's; the generated update policy already
-- restricts it to the tenant's own rows.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Harden the SECURITY DEFINER helpers from the original migration. They were
-- created without an explicit owner grant model; make the intent explicit.
-- -----------------------------------------------------------------------------

revoke all on function public.current_user_org_id() from public;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_org_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;

-- -----------------------------------------------------------------------------
-- Views inherit the RLS of their base tables only when they are not owned by a
-- superuser bypassing it. security_invoker makes that explicit and is what
-- Supabase recommends for views over RLS-protected tables.
-- -----------------------------------------------------------------------------

alter view public.obligations_effective        set (security_invoker = on);
alter view public.machine_directives_active    set (security_invoker = on);
alter view public.machine_run_summary          set (security_invoker = on);
alter view public.framework_controls_expanded  set (security_invoker = on);
