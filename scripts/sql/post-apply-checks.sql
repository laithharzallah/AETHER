-- =============================================================================
-- Invariants that must hold after every migration has been applied.
-- Each check raises an exception on failure so verify-migrations.sh exits non-zero.
-- =============================================================================

\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- 1. Every table in `public` must have RLS enabled.
--
-- This is the bug that shipped originally: policies existed but RLS was off, so
-- any signed-in user could read every tenant's rows.
-- -----------------------------------------------------------------------------
do $$
declare
  offenders text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
  into offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if offenders is not null then
    raise exception 'RLS is not enabled on: %', offenders;
  end if;

  raise notice 'check 1 ok: RLS enabled on all public tables';
end $$;

-- -----------------------------------------------------------------------------
-- 2. Every table must carry at least one policy, otherwise RLS denies all
--    access to `authenticated` and the feature silently returns nothing.
-- -----------------------------------------------------------------------------
do $$
declare
  offenders text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
  into offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not exists (
      select 1 from pg_policy p where p.polrelid = c.oid
    );

  if offenders is not null then
    raise exception 'RLS enabled but no policies defined on: %', offenders;
  end if;

  raise notice 'check 2 ok: every public table has at least one policy';
end $$;

-- -----------------------------------------------------------------------------
-- 3. Tenant-scoped tables must not expose a policy that is unconditionally
--    true for SELECT. Reference//catalogue tables are allowed to.
-- -----------------------------------------------------------------------------
do $$
declare
  offenders text;
begin
  select string_agg(distinct c.relname, ', ')
  into offenders
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and p.polcmd in ('r', '*')
    and pg_get_expr(p.polqual, p.polrelid) = 'true'
    and exists (
      select 1 from information_schema.columns col
      where col.table_schema = 'public'
        and col.table_name = c.relname
        and col.column_name = 'organization_id'
    );

  if offenders is not null then
    raise exception 'tenant tables expose an unrestricted SELECT policy: %', offenders;
  end if;

  raise notice 'check 3 ok: no tenant table has a blanket SELECT policy';
end $$;

-- -----------------------------------------------------------------------------
-- 4. Foreign keys pointing at tenant-scoped parents must cascade or null out,
--    so deleting an organization cannot leave orphaned rows behind.
-- -----------------------------------------------------------------------------
do $$
declare
  offenders text;
begin
  select string_agg(format('%s.%s', c.relname, con.conname), ', ')
  into offenders
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_class ref on ref.oid = con.confrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and con.contype = 'f'
    and ref.relname = 'organizations'
    and con.confdeltype = 'a'; -- 'a' = NO ACTION

  if offenders is not null then
    raise exception 'FKs to organizations without a delete rule: %', offenders;
  end if;

  raise notice 'check 4 ok: organization FKs all declare a delete rule';
end $$;

-- -----------------------------------------------------------------------------
-- 5. Reference data must actually be seeded — an empty framework catalogue
--    means the platform has nothing to map policies or controls against.
-- -----------------------------------------------------------------------------
do $$
declare
  n_frameworks  int;
  n_domains     int;
  n_controls    int;
  n_crosswalks  int;
  n_sources     int;
  n_templates   int;
  n_taxonomy    int;
  n_obligations int;
begin
  select count(*) into n_frameworks  from public.frameworks;
  select count(*) into n_domains     from public.framework_domains;
  select count(*) into n_controls    from public.framework_controls;
  select count(*) into n_crosswalks  from public.control_crosswalks;
  select count(*) into n_sources     from public.intelligence_sources;
  select count(*) into n_templates   from public.policy_templates;
  select count(*) into n_taxonomy    from public.risk_taxonomy;
  select count(*) into n_obligations from public.obligation_templates;

  if n_frameworks < 20 then
    raise exception 'expected >= 20 frameworks, found %', n_frameworks;
  end if;
  if n_domains < 80 then
    raise exception 'expected >= 80 framework domains, found %', n_domains;
  end if;
  if n_controls < 200 then
    raise exception 'expected >= 200 framework controls, found %', n_controls;
  end if;
  if n_crosswalks < 100 then
    raise exception 'expected >= 100 control crosswalks, found %', n_crosswalks;
  end if;
  if n_sources < 25 then
    raise exception 'expected >= 25 intelligence sources, found %', n_sources;
  end if;
  if n_templates < 8 then
    raise exception 'expected >= 8 policy templates, found %', n_templates;
  end if;
  if n_taxonomy < 20 then
    raise exception 'expected >= 20 risk taxonomy entries, found %', n_taxonomy;
  end if;
  if n_obligations < 20 then
    raise exception 'expected >= 20 obligation templates, found %', n_obligations;
  end if;

  raise notice 'check 5 ok: % frameworks, % domains, % controls, % crosswalks, % sources, % policy templates, % risk categories, % obligation templates',
    n_frameworks, n_domains, n_controls, n_crosswalks, n_sources, n_templates, n_taxonomy, n_obligations;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Crosswalks must never dangle or point at themselves.
-- -----------------------------------------------------------------------------
do $$
declare
  bad int;
begin
  select count(*) into bad
  from public.control_crosswalks
  where source_control_id = target_control_id;

  if bad > 0 then
    raise exception '% self-referencing crosswalks', bad;
  end if;

  raise notice 'check 6 ok: crosswalk graph is well formed';
end $$;

-- -----------------------------------------------------------------------------
-- 7. The audit trail must be a verifiable hash chain: appending rows keeps it
--    intact, and tampering with a row must be detected.
-- -----------------------------------------------------------------------------
do $$
declare
  org_id  uuid;
  result  record;
  tampered_id uuid;
begin
  insert into public.organizations (name, slug, type)
  values ('Audit Chain Check', 'audit-chain-check', 'enterprise')
  returning id into org_id;

  perform public.record_audit_event(
    org_id, null, 'system', 'check.' || i::text, 'test', null,
    'chain check ' || i::text, '{}'::jsonb
  )
  from generate_series(1, 25) as g(i);

  select * into result from public.verify_audit_chain(org_id);
  if not result.valid then
    raise exception 'freshly written audit chain did not verify: %', result.detail;
  end if;
  if result.events_checked <> 25 then
    raise exception 'expected 25 audit events, verified %', result.events_checked;
  end if;

  -- An UPDATE must be refused outright.
  begin
    update public.audit_events set summary = 'tampered'
    where organization_id = org_id and seq = 5;
    raise exception 'audit_events accepted an UPDATE; it must be append-only';
  exception when raise_exception then
    if sqlerrm like '%accepted an UPDATE%' then raise; end if;
  end;

  -- Now bypass the append-only trigger the way an attacker with database access
  -- would, and confirm the hash chain still catches the edit.
  select id into tampered_id
  from public.audit_events
  where organization_id = org_id
  order by seq
  offset 12 limit 1;

  alter table public.audit_events disable trigger audit_events_no_update;
  update public.audit_events set summary = 'tampered' where id = tampered_id;
  alter table public.audit_events enable trigger audit_events_no_update;

  select * into result from public.verify_audit_chain(org_id);
  if result.valid then
    raise exception 'tampering with audit event % was not detected', tampered_id;
  end if;
  if result.first_bad_seq <> 13 then
    raise exception 'chain break reported at seq %, expected 13', result.first_bad_seq;
  end if;

  delete from public.organizations where id = org_id;

  raise notice 'check 7 ok: audit chain verifies, and tampering is detected';
end $$;

-- -----------------------------------------------------------------------------
-- 8. Provisioning a new organization must produce a usable working set:
--    enabled modules, control instances and an obligation calendar.
-- -----------------------------------------------------------------------------
do $$
declare
  org_id       uuid;
  n_modules    int;
  n_controls   int;
  n_obligations int;
begin
  insert into public.organizations (name, slug, type, country, industry)
  values ('Provisioning Check', 'provisioning-check', 'enterprise', 'SA', 'banking')
  returning id into org_id;

  perform public.provision_organization(org_id, array['NCA-ECC', 'SAMA-CSF', 'ISO-27001']);

  select count(*) into n_modules from public.organization_modules
    where organization_id = org_id and enabled;
  select count(*) into n_controls from public.controls
    where organization_id = org_id;
  select count(*) into n_obligations from public.obligations
    where organization_id = org_id;

  if n_modules = 0 then
    raise exception 'provisioning enabled no modules';
  end if;
  if n_controls = 0 then
    raise exception 'provisioning created no control instances';
  end if;
  if n_obligations = 0 then
    raise exception 'provisioning created no obligations';
  end if;

  -- Idempotency: running it again must not duplicate anything.
  perform public.provision_organization(org_id, array['NCA-ECC', 'SAMA-CSF', 'ISO-27001']);

  if (select count(*) from public.controls where organization_id = org_id) <> n_controls then
    raise exception 'provision_organization is not idempotent for controls';
  end if;
  if (select count(*) from public.obligations where organization_id = org_id) <> n_obligations then
    raise exception 'provision_organization is not idempotent for obligations';
  end if;

  delete from public.organizations where id = org_id;

  raise notice 'check 8 ok: provisioning yields % modules, % controls, % obligations (idempotent)',
    n_modules, n_controls, n_obligations;
end $$;

-- -----------------------------------------------------------------------------
-- 9. Deleting an organization must leave nothing behind in any tenant table.
-- -----------------------------------------------------------------------------
do $$
declare
  org_id    uuid;
  tbl       record;
  leftover  int;
  offenders text := '';
begin
  insert into public.organizations (name, slug, type)
  values ('Cascade Check', 'cascade-check', 'enterprise')
  returning id into org_id;

  perform public.provision_organization(org_id, array['NCA-ECC']);

  insert into public.policies (organization_id, title, policy_type, content_md)
  values (org_id, 'Cascade Policy', 'Information Security Policy', '# test');
  insert into public.risks (organization_id, title, category)
  values (org_id, 'Cascade Risk', 'cyber-intrusion');
  insert into public.vendors (organization_id, name) values (org_id, 'Cascade Vendor');
  insert into public.ai_systems (organization_id, name, purpose)
  values (org_id, 'Cascade Model', 'test');

  delete from public.organizations where id = org_id;

  for tbl in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join information_schema.columns col
      on col.table_schema = 'public'
     and col.table_name = c.relname
     and col.column_name = 'organization_id'
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  loop
    execute format(
      'select count(*) from public.%I where organization_id = $1', tbl.relname
    ) into leftover using org_id;

    if leftover > 0 then
      offenders := offenders || format('%s(%s) ', tbl.relname, leftover);
    end if;
  end loop;

  if offenders <> '' then
    raise exception 'rows survived organization delete: %', offenders;
  end if;

  raise notice 'check 9 ok: organization delete cascades cleanly';
end $$;

\echo 'All post-apply checks passed.'
