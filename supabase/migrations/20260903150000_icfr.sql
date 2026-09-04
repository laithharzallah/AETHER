-- =============================================================================
-- AETHER ICFR (Internal Control over Financial Reporting) module
--   icfr_processes       — business processes / cycles in scope (tenant)
--   icfr_risks           — what-could-go-wrong risks per process (tenant)
--   icfr_controls        — control activities per process (tenant)
--   icfr_risk_controls   — risk ↔ control matrix links (tenant, via parent)
--   icfr_tests           — design / operating effectiveness tests (tenant)
--   icfr_deficiencies    — control deficiencies and remediation (tenant)
--   icfr_templates       — global RCM templates per cycle (reference data)
--   icfr_template_items  — template risks and controls (reference data)
--
-- Vocabulary follows COSO 2013 and PCAOB AS 2201 / SOX 404 practice:
-- assertions, preventive/detective, manual/automated/IT-dependent manual,
-- key vs non-key, entity-level / process-level / ITGC, and deficiency
-- classification (deficiency, significant deficiency, material weakness).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- icfr_processes
-- -----------------------------------------------------------------------------

create table if not exists public.icfr_processes (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  client_workspace_id  uuid references public.client_workspaces(id) on delete set null,
  code                 text not null,                       -- e.g. 'P2P'
  name                 text not null,
  cycle                text,                                -- e.g. 'Procure-to-Pay'
  owner_id             uuid references public.profiles(id) on delete set null,
  description          text,
  status               text not null default 'active',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint icfr_processes_status_check check (status in ('active', 'inactive', 'archived'))
);

comment on table public.icfr_processes is
  'Business processes / cycles in ICFR scope. Unique code per organization and workspace.';

create unique index if not exists icfr_processes_org_ws_code_uidx
  on public.icfr_processes (
    organization_id,
    coalesce(client_workspace_id, '00000000-0000-0000-0000-000000000000'::uuid),
    code
  );

create index if not exists icfr_processes_org_idx on public.icfr_processes (organization_id);

-- -----------------------------------------------------------------------------
-- icfr_risks
-- -----------------------------------------------------------------------------

create table if not exists public.icfr_risks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  process_id       uuid not null references public.icfr_processes(id) on delete cascade,
  ref              text not null,                            -- e.g. 'R1'
  description      text not null,
  assertions       text[] not null default '{}',
  likelihood       integer,
  impact           integer,
  fraud_risk       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint icfr_risks_process_ref_unique unique (process_id, ref),
  constraint icfr_risks_likelihood_check check (likelihood is null or likelihood between 1 and 5),
  constraint icfr_risks_impact_check check (impact is null or impact between 1 and 5),
  constraint icfr_risks_assertions_check check (
    assertions <@ array[
      'existence_occurrence',
      'completeness',
      'accuracy',
      'valuation_allocation',
      'cutoff',
      'rights_obligations',
      'presentation_disclosure'
    ]::text[]
  )
);

comment on table public.icfr_risks is
  'What-could-go-wrong risks per process, tagged with financial statement assertions.';

create index if not exists icfr_risks_process_idx on public.icfr_risks (process_id);
create index if not exists icfr_risks_org_idx on public.icfr_risks (organization_id);

-- -----------------------------------------------------------------------------
-- icfr_controls
-- -----------------------------------------------------------------------------

create table if not exists public.icfr_controls (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  process_id            uuid not null references public.icfr_processes(id) on delete cascade,
  ref                   text not null,                       -- e.g. 'C1'
  title                 text not null,
  description           text,
  control_type          text not null,
  nature                text not null,
  frequency             text not null,
  is_key                boolean not null default false,
  level                 text not null default 'process',
  coso_component        text not null default 'control_activities',
  owner_id              uuid references public.profiles(id) on delete set null,
  evidence_description  text,
  status                text not null default 'implemented',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint icfr_controls_process_ref_unique unique (process_id, ref),
  constraint icfr_controls_type_check check (control_type in ('preventive', 'detective')),
  constraint icfr_controls_nature_check check (nature in ('manual', 'automated', 'it_dependent')),
  constraint icfr_controls_frequency_check check (frequency in (
    'multiple_daily', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'event_driven'
  )),
  constraint icfr_controls_level_check check (level in ('entity', 'process', 'itgc')),
  constraint icfr_controls_coso_check check (coso_component in (
    'control_environment', 'risk_assessment', 'control_activities',
    'information_communication', 'monitoring'
  )),
  constraint icfr_controls_status_check check (status in ('designed', 'implemented', 'retired'))
);

comment on table public.icfr_controls is
  'Control activities in the risk & control matrix (RCM).';

create index if not exists icfr_controls_process_idx on public.icfr_controls (process_id);
create index if not exists icfr_controls_org_idx on public.icfr_controls (organization_id);

-- -----------------------------------------------------------------------------
-- icfr_risk_controls (matrix links)
-- -----------------------------------------------------------------------------

create table if not exists public.icfr_risk_controls (
  risk_id     uuid not null references public.icfr_risks(id) on delete cascade,
  control_id  uuid not null references public.icfr_controls(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (risk_id, control_id)
);

create index if not exists icfr_risk_controls_control_idx on public.icfr_risk_controls (control_id);

-- -----------------------------------------------------------------------------
-- icfr_tests
-- -----------------------------------------------------------------------------

create table if not exists public.icfr_tests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  control_id       uuid not null references public.icfr_controls(id) on delete cascade,
  period           text not null,                             -- e.g. 'FY2026-Q3'
  test_type        text not null,
  procedure        text,
  population_size  integer,
  sample_size      integer,
  exceptions       integer not null default 0,
  result           text not null default 'not_tested',
  tester_id        uuid references public.profiles(id) on delete set null,
  tested_at        date,
  notes            text,
  workpaper_ref    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint icfr_tests_type_check check (test_type in ('design', 'operating')),
  constraint icfr_tests_result_check check (result in (
    'effective', 'effective_with_exceptions', 'ineffective', 'not_tested'
  )),
  constraint icfr_tests_counts_check check (
    (population_size is null or population_size >= 0)
    and (sample_size is null or sample_size >= 0)
    and exceptions >= 0
  )
);

comment on table public.icfr_tests is
  'Design (walkthrough) and operating effectiveness tests per control and period.';

create index if not exists icfr_tests_control_idx on public.icfr_tests (control_id, test_type, tested_at desc);
create index if not exists icfr_tests_org_idx on public.icfr_tests (organization_id);

-- -----------------------------------------------------------------------------
-- icfr_deficiencies
-- -----------------------------------------------------------------------------

create table if not exists public.icfr_deficiencies (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  control_id        uuid not null references public.icfr_controls(id) on delete cascade,
  test_id           uuid references public.icfr_tests(id) on delete set null,
  severity          text not null,
  description       text not null,
  root_cause        text,
  remediation_plan  text,
  owner_id          uuid references public.profiles(id) on delete set null,
  due_date          date,
  status            text not null default 'open',
  retest_result     text,
  identified_at     date not null default current_date,
  closed_at         date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint icfr_deficiencies_severity_check check (severity in (
    'deficiency', 'significant_deficiency', 'material_weakness'
  )),
  constraint icfr_deficiencies_status_check check (status in (
    'open', 'in_remediation', 'remediated', 'closed'
  ))
);

comment on table public.icfr_deficiencies is
  'Control deficiencies classified per SOX 404 / AS 2201 with remediation tracking.';

create index if not exists icfr_deficiencies_org_status_idx on public.icfr_deficiencies (organization_id, status);
create index if not exists icfr_deficiencies_control_idx on public.icfr_deficiencies (control_id);

-- -----------------------------------------------------------------------------
-- icfr_templates / icfr_template_items (global reference data)
-- -----------------------------------------------------------------------------

create table if not exists public.icfr_templates (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,                         -- e.g. 'P2P'
  name         text not null,
  cycle        text not null,
  description  text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.icfr_templates is
  'Global RCM templates per business cycle. Seeded via migrations only.';

create table if not exists public.icfr_template_items (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid not null references public.icfr_templates(id) on delete cascade,
  kind              text not null,
  ref               text not null,
  title             text not null,
  description       text,
  assertions        text[],
  control_type      text,
  nature            text,
  frequency         text,
  is_key            boolean,
  level             text,
  coso_component    text,
  linked_risk_refs  text[],
  sort_order        integer not null default 0,
  constraint icfr_template_items_unique unique (template_id, ref),
  constraint icfr_template_items_kind_check check (kind in ('risk', 'control')),
  constraint icfr_template_items_type_check check (control_type is null or control_type in ('preventive', 'detective')),
  constraint icfr_template_items_nature_check check (nature is null or nature in ('manual', 'automated', 'it_dependent')),
  constraint icfr_template_items_frequency_check check (frequency is null or frequency in (
    'multiple_daily', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'event_driven'
  )),
  constraint icfr_template_items_level_check check (level is null or level in ('entity', 'process', 'itgc')),
  constraint icfr_template_items_coso_check check (coso_component is null or coso_component in (
    'control_environment', 'risk_assessment', 'control_activities',
    'information_communication', 'monitoring'
  ))
);

create index if not exists icfr_template_items_template_idx on public.icfr_template_items (template_id, sort_order);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists icfr_processes_set_updated_at on public.icfr_processes;
create trigger icfr_processes_set_updated_at
  before update on public.icfr_processes
  for each row execute function public.set_updated_at();

drop trigger if exists icfr_risks_set_updated_at on public.icfr_risks;
create trigger icfr_risks_set_updated_at
  before update on public.icfr_risks
  for each row execute function public.set_updated_at();

drop trigger if exists icfr_controls_set_updated_at on public.icfr_controls;
create trigger icfr_controls_set_updated_at
  before update on public.icfr_controls
  for each row execute function public.set_updated_at();

drop trigger if exists icfr_tests_set_updated_at on public.icfr_tests;
create trigger icfr_tests_set_updated_at
  before update on public.icfr_tests
  for each row execute function public.set_updated_at();

drop trigger if exists icfr_deficiencies_set_updated_at on public.icfr_deficiencies;
create trigger icfr_deficiencies_set_updated_at
  before update on public.icfr_deficiencies
  for each row execute function public.set_updated_at();

drop trigger if exists icfr_templates_set_updated_at on public.icfr_templates;
create trigger icfr_templates_set_updated_at
  before update on public.icfr_templates
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.icfr_processes enable row level security;
alter table public.icfr_risks enable row level security;
alter table public.icfr_controls enable row level security;
alter table public.icfr_risk_controls enable row level security;
alter table public.icfr_tests enable row level security;
alter table public.icfr_deficiencies enable row level security;
alter table public.icfr_templates enable row level security;
alter table public.icfr_template_items enable row level security;

-- Reference data: read-only for authenticated.

drop policy if exists "icfr_templates_select_authenticated" on public.icfr_templates;
create policy "icfr_templates_select_authenticated"
  on public.icfr_templates for select to authenticated using (true);

drop policy if exists "icfr_template_items_select_authenticated" on public.icfr_template_items;
create policy "icfr_template_items_select_authenticated"
  on public.icfr_template_items for select to authenticated using (true);

-- Tenant tables: select/insert/update for org members, delete for owner/admin.

-- icfr_processes
drop policy if exists "icfr_processes_select_tenant" on public.icfr_processes;
create policy "icfr_processes_select_tenant"
  on public.icfr_processes for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "icfr_processes_insert_tenant" on public.icfr_processes;
create policy "icfr_processes_insert_tenant"
  on public.icfr_processes for insert to authenticated
  with check (organization_id = public.current_user_org_id());

drop policy if exists "icfr_processes_update_tenant" on public.icfr_processes;
create policy "icfr_processes_update_tenant"
  on public.icfr_processes for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "icfr_processes_delete_admin" on public.icfr_processes;
create policy "icfr_processes_delete_admin"
  on public.icfr_processes for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  );

-- icfr_risks
drop policy if exists "icfr_risks_select_tenant" on public.icfr_risks;
create policy "icfr_risks_select_tenant"
  on public.icfr_risks for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "icfr_risks_insert_tenant" on public.icfr_risks;
create policy "icfr_risks_insert_tenant"
  on public.icfr_risks for insert to authenticated
  with check (organization_id = public.current_user_org_id());

drop policy if exists "icfr_risks_update_tenant" on public.icfr_risks;
create policy "icfr_risks_update_tenant"
  on public.icfr_risks for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "icfr_risks_delete_admin" on public.icfr_risks;
create policy "icfr_risks_delete_admin"
  on public.icfr_risks for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  );

-- icfr_controls
drop policy if exists "icfr_controls_select_tenant" on public.icfr_controls;
create policy "icfr_controls_select_tenant"
  on public.icfr_controls for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "icfr_controls_insert_tenant" on public.icfr_controls;
create policy "icfr_controls_insert_tenant"
  on public.icfr_controls for insert to authenticated
  with check (organization_id = public.current_user_org_id());

drop policy if exists "icfr_controls_update_tenant" on public.icfr_controls;
create policy "icfr_controls_update_tenant"
  on public.icfr_controls for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "icfr_controls_delete_admin" on public.icfr_controls;
create policy "icfr_controls_delete_admin"
  on public.icfr_controls for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  );

-- icfr_risk_controls: tenancy inherited from the parent control.
drop policy if exists "icfr_risk_controls_select_tenant" on public.icfr_risk_controls;
create policy "icfr_risk_controls_select_tenant"
  on public.icfr_risk_controls for select to authenticated
  using (
    exists (
      select 1 from public.icfr_controls c
      where c.id = control_id and c.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "icfr_risk_controls_insert_tenant" on public.icfr_risk_controls;
create policy "icfr_risk_controls_insert_tenant"
  on public.icfr_risk_controls for insert to authenticated
  with check (
    exists (
      select 1 from public.icfr_controls c
      where c.id = control_id and c.organization_id = public.current_user_org_id()
    )
    and exists (
      select 1 from public.icfr_risks r
      where r.id = risk_id and r.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "icfr_risk_controls_delete_tenant" on public.icfr_risk_controls;
create policy "icfr_risk_controls_delete_tenant"
  on public.icfr_risk_controls for delete to authenticated
  using (
    exists (
      select 1 from public.icfr_controls c
      where c.id = control_id and c.organization_id = public.current_user_org_id()
    )
  );

-- icfr_tests
drop policy if exists "icfr_tests_select_tenant" on public.icfr_tests;
create policy "icfr_tests_select_tenant"
  on public.icfr_tests for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "icfr_tests_insert_tenant" on public.icfr_tests;
create policy "icfr_tests_insert_tenant"
  on public.icfr_tests for insert to authenticated
  with check (organization_id = public.current_user_org_id());

drop policy if exists "icfr_tests_update_tenant" on public.icfr_tests;
create policy "icfr_tests_update_tenant"
  on public.icfr_tests for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "icfr_tests_delete_admin" on public.icfr_tests;
create policy "icfr_tests_delete_admin"
  on public.icfr_tests for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  );

-- icfr_deficiencies
drop policy if exists "icfr_deficiencies_select_tenant" on public.icfr_deficiencies;
create policy "icfr_deficiencies_select_tenant"
  on public.icfr_deficiencies for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "icfr_deficiencies_insert_tenant" on public.icfr_deficiencies;
create policy "icfr_deficiencies_insert_tenant"
  on public.icfr_deficiencies for insert to authenticated
  with check (organization_id = public.current_user_org_id());

drop policy if exists "icfr_deficiencies_update_tenant" on public.icfr_deficiencies;
create policy "icfr_deficiencies_update_tenant"
  on public.icfr_deficiencies for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "icfr_deficiencies_delete_admin" on public.icfr_deficiencies;
create policy "icfr_deficiencies_delete_admin"
  on public.icfr_deficiencies for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  );

-- -----------------------------------------------------------------------------
-- import_icfr_template: copy a global template into the caller's organization
-- -----------------------------------------------------------------------------

create or replace function public.import_icfr_template(
  p_template_code text,
  p_client_workspace_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id      uuid;
  v_template    public.icfr_templates%rowtype;
  v_process_id  uuid;
  v_item        record;
  v_control_id  uuid;
  v_risk_id     uuid;
  v_risk_ref    text;
begin
  v_org_id := public.current_user_org_id();
  if v_org_id is null then
    raise exception 'User is not linked to an organization';
  end if;

  select * into v_template
  from public.icfr_templates
  where code = p_template_code;

  if not found then
    raise exception 'Template % not found', p_template_code;
  end if;

  if exists (
    select 1 from public.icfr_processes p
    where p.organization_id = v_org_id
      and coalesce(p.client_workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_client_workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and p.code = v_template.code
  ) then
    raise exception 'Process already exists';
  end if;

  insert into public.icfr_processes (
    organization_id, client_workspace_id, code, name, cycle, description, owner_id
  )
  values (
    v_org_id, p_client_workspace_id, v_template.code, v_template.name,
    v_template.cycle, v_template.description, auth.uid()
  )
  returning id into v_process_id;

  -- Risks first so controls can be linked by ref.
  insert into public.icfr_risks (organization_id, process_id, ref, description, assertions)
  select v_org_id, v_process_id, i.ref, i.title, coalesce(i.assertions, '{}'::text[])
  from public.icfr_template_items i
  where i.template_id = v_template.id and i.kind = 'risk'
  order by i.sort_order;

  for v_item in
    select * from public.icfr_template_items i
    where i.template_id = v_template.id and i.kind = 'control'
    order by i.sort_order
  loop
    insert into public.icfr_controls (
      organization_id, process_id, ref, title, description, control_type, nature,
      frequency, is_key, level, coso_component, status
    )
    values (
      v_org_id, v_process_id, v_item.ref, v_item.title, v_item.description,
      coalesce(v_item.control_type, 'preventive'),
      coalesce(v_item.nature, 'manual'),
      coalesce(v_item.frequency, 'monthly'),
      coalesce(v_item.is_key, false),
      coalesce(v_item.level, 'process'),
      coalesce(v_item.coso_component, 'control_activities'),
      'implemented'
    )
    returning id into v_control_id;

    if v_item.linked_risk_refs is not null then
      foreach v_risk_ref in array v_item.linked_risk_refs loop
        select r.id into v_risk_id
        from public.icfr_risks r
        where r.process_id = v_process_id and r.ref = v_risk_ref;

        if v_risk_id is not null then
          insert into public.icfr_risk_controls (risk_id, control_id)
          values (v_risk_id, v_control_id)
          on conflict do nothing;
        end if;
      end loop;
    end if;
  end loop;

  return v_process_id;
end;
$$;

revoke all on function public.import_icfr_template(text, uuid) from public;
grant execute on function public.import_icfr_template(text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- icfr_process_summary view
-- -----------------------------------------------------------------------------

create or replace view public.icfr_process_summary
with (security_invoker = true) as
select
  p.id,
  p.organization_id,
  p.client_workspace_id,
  p.code,
  p.name,
  p.cycle,
  p.owner_id,
  p.description,
  p.status,
  p.created_at,
  p.updated_at,
  (select count(*)::integer from public.icfr_risks r where r.process_id = p.id) as risk_count,
  (select count(*)::integer from public.icfr_controls c where c.process_id = p.id) as control_count,
  (select count(*)::integer from public.icfr_controls c
     where c.process_id = p.id and c.is_key and c.status <> 'retired') as key_control_count,
  (select count(*)::integer from public.icfr_controls c
     where c.process_id = p.id and c.is_key and c.status <> 'retired'
       and exists (
         select 1 from public.icfr_tests t
         where t.control_id = c.id and t.test_type = 'operating' and t.result <> 'not_tested'
       )) as tested_key_controls,
  (select count(*)::integer from public.icfr_controls c
     where c.process_id = p.id and c.is_key and c.status <> 'retired'
       and (
         select t.result from public.icfr_tests t
         where t.control_id = c.id and t.test_type = 'operating' and t.result <> 'not_tested'
         order by t.tested_at desc nulls last, t.created_at desc
         limit 1
       ) = 'effective') as effective_key_controls,
  (select count(*)::integer from public.icfr_deficiencies d
     join public.icfr_controls c on c.id = d.control_id
     where c.process_id = p.id and d.status in ('open', 'in_remediation')) as open_deficiencies,
  (select count(*)::integer from public.icfr_deficiencies d
     join public.icfr_controls c on c.id = d.control_id
     where c.process_id = p.id and d.severity = 'material_weakness'
       and d.status in ('open', 'in_remediation')) as material_weaknesses
from public.icfr_processes p;

grant select on public.icfr_process_summary to authenticated;
