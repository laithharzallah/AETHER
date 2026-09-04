-- =============================================================================
-- AETHER Internal Audit module
--   audit_universe                — auditable entities with risk-factor scoring (tenant)
--   audit_plans                   — annual / periodic risk-based audit plans (tenant)
--   audit_plan_items              — planned engagements per quarter (tenant)
--   audit_engagements             — engagements: planning → fieldwork → reporting → issued → closed (tenant)
--   audit_procedures              — work program steps (tenant)
--   audit_workpapers              — workpapers with preparer / reviewer sign-off (tenant)
--   audit_observations            — findings using the 4 Cs (condition, criteria, cause, effect) (tenant)
--   audit_actions                 — management action plans with verification (tenant)
--   audit_program_templates       — global standard work programs (reference data)
--   audit_program_template_steps  — template procedures (reference data)
--
-- Vocabulary follows the IIA Global Internal Audit Standards (2024): risk-based
-- planning (Domain V / Standard 9.4), engagement planning and work programs
-- (Standards 13.x), supervision and review (Standard 12.x / 13.x), findings
-- with condition/criteria/cause/effect (Standard 14.x), communication of
-- results and monitoring of action plans (Standard 15.x). Audit-committee
-- oversight follows CMA Corporate Governance Regulations (Saudi Arabia) and
-- SAMA requirements for regulated entities.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- audit_universe
-- -----------------------------------------------------------------------------

create table if not exists public.audit_universe (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  code                   text not null,                        -- e.g. 'AU-P2P'
  name                   text not null,
  type                   text not null default 'process',
  description            text,
  owner_id               uuid references public.profiles(id) on delete set null,
  parent_id              uuid references public.audit_universe(id) on delete set null,
  last_audited_at        date,
  inherent_risk          integer not null default 3,
  control_environment    integer not null default 3,
  financial_materiality  integer not null default 3,
  regulatory_exposure    integer not null default 3,
  change_velocity        integer not null default 3,
  prior_findings         integer not null default 3,
  -- Weighted average of the six 1–5 factors, scaled to 0–100.
  -- Weights: inherent 25%, control environment 20%, regulatory 20%,
  -- financial materiality 15%, change velocity 10%, prior findings 10%.
  risk_score             numeric(5,1) generated always as (
    round((
      inherent_risk * 0.25
      + control_environment * 0.20
      + regulatory_exposure * 0.20
      + financial_materiality * 0.15
      + change_velocity * 0.10
      + prior_findings * 0.10
    ) * 20, 1)
  ) stored,
  audit_frequency_months integer not null default 24,
  status                 text not null default 'active',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint audit_universe_org_code_unique unique (organization_id, code),
  constraint audit_universe_type_check check (type in (
    'process', 'entity', 'system', 'project', 'function', 'third_party', 'regulation'
  )),
  constraint audit_universe_status_check check (status in ('active', 'retired')),
  constraint audit_universe_factor_check check (
    inherent_risk between 1 and 5
    and control_environment between 1 and 5
    and financial_materiality between 1 and 5
    and regulatory_exposure between 1 and 5
    and change_velocity between 1 and 5
    and prior_findings between 1 and 5
  ),
  constraint audit_universe_frequency_check check (audit_frequency_months between 1 and 120)
);

comment on table public.audit_universe is
  'Audit universe: auditable entities with six-factor risk scoring (0–100) and audit frequency.';

create index if not exists audit_universe_org_idx on public.audit_universe (organization_id, status);
create index if not exists audit_universe_parent_idx on public.audit_universe (parent_id);

-- -----------------------------------------------------------------------------
-- audit_plans
-- -----------------------------------------------------------------------------

create table if not exists public.audit_plans (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  period               text not null,                          -- e.g. 'FY2026'
  status               text not null default 'draft',
  approved_by          uuid references public.profiles(id) on delete set null,
  approved_at          timestamptz,
  total_capacity_days  numeric(8,1) not null default 0,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint audit_plans_org_period_unique unique (organization_id, period),
  constraint audit_plans_status_check check (status in ('draft', 'approved', 'in_progress', 'closed')),
  constraint audit_plans_capacity_check check (total_capacity_days >= 0)
);

comment on table public.audit_plans is
  'Risk-based internal audit plans per period, approved by the audit committee (IIA Standard 9.4).';

create index if not exists audit_plans_org_idx on public.audit_plans (organization_id, period desc);

-- -----------------------------------------------------------------------------
-- audit_plan_items (engagement_id FK added after audit_engagements exists)
-- -----------------------------------------------------------------------------

create table if not exists public.audit_plan_items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  plan_id          uuid not null references public.audit_plans(id) on delete cascade,
  universe_id      uuid references public.audit_universe(id) on delete set null,
  title            text,                                        -- override when universe_id is null
  quarter          text not null default 'Q1',
  planned_days     numeric(6,1) not null default 10,
  priority         text not null default 'medium',
  rationale        text,
  status           text not null default 'planned',
  engagement_id    uuid,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint audit_plan_items_quarter_check check (quarter in ('Q1', 'Q2', 'Q3', 'Q4')),
  constraint audit_plan_items_priority_check check (priority in ('high', 'medium', 'low')),
  constraint audit_plan_items_status_check check (status in (
    'planned', 'scheduled', 'in_progress', 'reported', 'cancelled', 'deferred'
  )),
  constraint audit_plan_items_days_check check (planned_days >= 0)
);

comment on table public.audit_plan_items is
  'Planned engagements within an audit plan, spread by quarter with budgeted days.';

create index if not exists audit_plan_items_plan_idx on public.audit_plan_items (plan_id, quarter, sort_order);
create index if not exists audit_plan_items_org_idx on public.audit_plan_items (organization_id);

-- -----------------------------------------------------------------------------
-- audit_engagements
-- -----------------------------------------------------------------------------

create table if not exists public.audit_engagements (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  code                text not null,                             -- e.g. 'IA-2026-07'
  title               text not null,
  universe_id         uuid references public.audit_universe(id) on delete set null,
  plan_item_id        uuid references public.audit_plan_items(id) on delete set null,
  type                text not null default 'assurance',
  objective           text,
  scope               text,
  out_of_scope        text,
  criteria            text,                                      -- frameworks / policies referenced
  lead_auditor_id     uuid references public.profiles(id) on delete set null,
  team                jsonb not null default '[]'::jsonb,        -- array of profile ids
  auditee_owner_id    uuid references public.profiles(id) on delete set null,
  start_date          date,
  fieldwork_start     date,
  fieldwork_end       date,
  report_target_date  date,
  status              text not null default 'planning',
  overall_rating      text,
  executive_summary   text,
  opinion             text,
  budget_days         numeric(6,1),
  actual_days         numeric(6,1),
  report_issued_at    timestamptz,
  closed_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint audit_engagements_org_code_unique unique (organization_id, code),
  constraint audit_engagements_type_check check (type in (
    'assurance', 'advisory', 'follow_up', 'investigation', 'compliance_review'
  )),
  constraint audit_engagements_status_check check (status in (
    'planning', 'fieldwork', 'reporting', 'issued', 'closed', 'cancelled'
  )),
  constraint audit_engagements_rating_check check (
    overall_rating is null or overall_rating in ('satisfactory', 'needs_improvement', 'unsatisfactory')
  ),
  constraint audit_engagements_team_check check (jsonb_typeof(team) = 'array'),
  constraint audit_engagements_days_check check (
    (budget_days is null or budget_days >= 0) and (actual_days is null or actual_days >= 0)
  )
);

comment on table public.audit_engagements is
  'Internal audit engagements with lifecycle planning → fieldwork → reporting → issued → closed.';

create index if not exists audit_engagements_org_status_idx on public.audit_engagements (organization_id, status);
create index if not exists audit_engagements_universe_idx on public.audit_engagements (universe_id);
create index if not exists audit_engagements_plan_item_idx on public.audit_engagements (plan_item_id);

-- Circular FK: plan item → engagement.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audit_plan_items_engagement_id_fkey'
  ) then
    alter table public.audit_plan_items
      add constraint audit_plan_items_engagement_id_fkey
      foreign key (engagement_id) references public.audit_engagements(id) on delete set null;
  end if;
end $$;

create index if not exists audit_plan_items_engagement_idx on public.audit_plan_items (engagement_id);

-- -----------------------------------------------------------------------------
-- audit_procedures (work program)
-- -----------------------------------------------------------------------------

create table if not exists public.audit_procedures (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  engagement_id    uuid not null references public.audit_engagements(id) on delete cascade,
  ref              text not null,                                -- e.g. 'P-01'
  area             text,
  objective        text,
  procedure        text not null,
  control_ref      text,                                         -- free text: library cite_as or ICFR ref
  assigned_to      uuid references public.profiles(id) on delete set null,
  status           text not null default 'not_started',
  conclusion       text,
  hours            numeric(6,1),
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint audit_procedures_engagement_ref_unique unique (engagement_id, ref),
  constraint audit_procedures_status_check check (status in (
    'not_started', 'in_progress', 'complete', 'not_applicable'
  )),
  constraint audit_procedures_hours_check check (hours is null or hours >= 0)
);

comment on table public.audit_procedures is
  'Engagement work program steps (IIA Standard 13.4).';

create index if not exists audit_procedures_engagement_idx on public.audit_procedures (engagement_id, sort_order);
create index if not exists audit_procedures_org_idx on public.audit_procedures (organization_id);

-- -----------------------------------------------------------------------------
-- audit_workpapers
-- -----------------------------------------------------------------------------

create table if not exists public.audit_workpapers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  engagement_id    uuid not null references public.audit_engagements(id) on delete cascade,
  procedure_id     uuid references public.audit_procedures(id) on delete set null,
  ref              text not null,                                -- e.g. 'WP-01'
  title            text not null,
  description      text,
  kind             text not null default 'document',
  evidence_id      uuid references public.evidence(id) on delete set null,
  prepared_by      uuid references public.profiles(id) on delete set null,
  prepared_at      timestamptz,
  reviewed_by      uuid references public.profiles(id) on delete set null,
  reviewed_at      timestamptz,
  review_status    text not null default 'draft',
  review_notes     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint audit_workpapers_engagement_ref_unique unique (engagement_id, ref),
  constraint audit_workpapers_kind_check check (kind in (
    'document', 'interview', 'walkthrough', 'sample_test', 'analytics',
    'reperformance', 'observation', 'other'
  )),
  constraint audit_workpapers_review_status_check check (review_status in (
    'draft', 'prepared', 'reviewed', 'reopened'
  ))
);

comment on table public.audit_workpapers is
  'Engagement workpapers with preparer and independent reviewer sign-off (IIA Standard 12.3 / 13.6).';

create index if not exists audit_workpapers_engagement_idx on public.audit_workpapers (engagement_id, ref);
create index if not exists audit_workpapers_org_idx on public.audit_workpapers (organization_id);
create index if not exists audit_workpapers_procedure_idx on public.audit_workpapers (procedure_id);

-- -----------------------------------------------------------------------------
-- audit_observations (findings — the 4 Cs)
-- -----------------------------------------------------------------------------

create table if not exists public.audit_observations (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  engagement_id        uuid not null references public.audit_engagements(id) on delete cascade,
  ref                  text not null,                            -- e.g. 'OBS-01'
  title                text not null,
  condition            text,
  criteria             text,
  cause                text,
  effect               text,
  recommendation       text,
  rating               text not null default 'medium',
  category             text not null default 'control_operation',
  repeat_finding       boolean not null default false,
  management_response  text,
  agreed               boolean,
  status               text not null default 'draft',
  library_control_id   uuid references public.controls(id) on delete set null,
  icfr_control_id      uuid references public.icfr_controls(id) on delete set null,
  issued_at            timestamptz,
  closed_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint audit_observations_engagement_ref_unique unique (engagement_id, ref),
  constraint audit_observations_rating_check check (rating in ('critical', 'high', 'medium', 'low')),
  constraint audit_observations_category_check check (category in (
    'control_design', 'control_operation', 'compliance', 'efficiency',
    'governance', 'it', 'fraud_indicator'
  )),
  constraint audit_observations_status_check check (status in (
    'draft', 'issued', 'open', 'in_progress', 'closed', 'risk_accepted', 'overdue'
  ))
);

comment on table public.audit_observations is
  'Audit observations documented as condition / criteria / cause / effect with rating and management response (IIA Standard 14.x).';

create index if not exists audit_observations_engagement_idx on public.audit_observations (engagement_id, ref);
create index if not exists audit_observations_org_status_idx on public.audit_observations (organization_id, status, rating);
create index if not exists audit_observations_library_control_idx on public.audit_observations (library_control_id);
create index if not exists audit_observations_icfr_control_idx on public.audit_observations (icfr_control_id);

-- -----------------------------------------------------------------------------
-- audit_actions (management action plans)
-- -----------------------------------------------------------------------------

create table if not exists public.audit_actions (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  observation_id      uuid not null references public.audit_observations(id) on delete cascade,
  description         text not null,
  owner_id            uuid references public.profiles(id) on delete set null,
  due_date            date,
  revised_due_date    date,
  extension_count     integer not null default 0,
  status              text not null default 'open',
  implemented_at      date,
  verified_by         uuid references public.profiles(id) on delete set null,
  verified_at         timestamptz,
  verification_notes  text,
  evidence_id         uuid references public.evidence(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint audit_actions_status_check check (status in (
    'open', 'in_progress', 'implemented', 'verified', 'overdue', 'cancelled'
  )),
  constraint audit_actions_extension_check check (extension_count >= 0)
);

comment on table public.audit_actions is
  'Management action plans per observation, tracked to implementation and internal-audit verification (IIA Standard 15.2).';

create index if not exists audit_actions_observation_idx on public.audit_actions (observation_id);
create index if not exists audit_actions_org_status_idx on public.audit_actions (organization_id, status, due_date);
create index if not exists audit_actions_owner_idx on public.audit_actions (owner_id);

-- -----------------------------------------------------------------------------
-- audit_program_templates / audit_program_template_steps (global reference data)
-- -----------------------------------------------------------------------------

create table if not exists public.audit_program_templates (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,                             -- e.g. 'P2P'
  name         text not null,
  area         text not null,                                    -- e.g. 'Finance', 'Technology'
  description  text,
  frameworks   text[] not null default '{}',                     -- library framework codes referenced
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.audit_program_templates is
  'Global standard internal audit work programs. Seeded via migrations only.';

create table if not exists public.audit_program_template_steps (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.audit_program_templates(id) on delete cascade,
  ref           text not null,
  area          text,
  objective     text not null,
  procedure     text not null,
  evidence      text,
  control_hint  text,
  sort_order    integer not null default 0,
  constraint audit_program_template_steps_unique unique (template_id, ref)
);

create index if not exists audit_program_template_steps_template_idx
  on public.audit_program_template_steps (template_id, sort_order);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists audit_universe_set_updated_at on public.audit_universe;
create trigger audit_universe_set_updated_at
  before update on public.audit_universe
  for each row execute function public.set_updated_at();

drop trigger if exists audit_plans_set_updated_at on public.audit_plans;
create trigger audit_plans_set_updated_at
  before update on public.audit_plans
  for each row execute function public.set_updated_at();

drop trigger if exists audit_plan_items_set_updated_at on public.audit_plan_items;
create trigger audit_plan_items_set_updated_at
  before update on public.audit_plan_items
  for each row execute function public.set_updated_at();

drop trigger if exists audit_engagements_set_updated_at on public.audit_engagements;
create trigger audit_engagements_set_updated_at
  before update on public.audit_engagements
  for each row execute function public.set_updated_at();

drop trigger if exists audit_procedures_set_updated_at on public.audit_procedures;
create trigger audit_procedures_set_updated_at
  before update on public.audit_procedures
  for each row execute function public.set_updated_at();

drop trigger if exists audit_workpapers_set_updated_at on public.audit_workpapers;
create trigger audit_workpapers_set_updated_at
  before update on public.audit_workpapers
  for each row execute function public.set_updated_at();

drop trigger if exists audit_observations_set_updated_at on public.audit_observations;
create trigger audit_observations_set_updated_at
  before update on public.audit_observations
  for each row execute function public.set_updated_at();

drop trigger if exists audit_actions_set_updated_at on public.audit_actions;
create trigger audit_actions_set_updated_at
  before update on public.audit_actions
  for each row execute function public.set_updated_at();

drop trigger if exists audit_program_templates_set_updated_at on public.audit_program_templates;
create trigger audit_program_templates_set_updated_at
  before update on public.audit_program_templates
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.audit_universe enable row level security;
alter table public.audit_plans enable row level security;
alter table public.audit_plan_items enable row level security;
alter table public.audit_engagements enable row level security;
alter table public.audit_procedures enable row level security;
alter table public.audit_workpapers enable row level security;
alter table public.audit_observations enable row level security;
alter table public.audit_actions enable row level security;
alter table public.audit_program_templates enable row level security;
alter table public.audit_program_template_steps enable row level security;

-- Reference data: read-only for authenticated.

drop policy if exists "audit_program_templates_select_authenticated" on public.audit_program_templates;
create policy "audit_program_templates_select_authenticated"
  on public.audit_program_templates for select to authenticated using (true);

drop policy if exists "audit_program_template_steps_select_authenticated" on public.audit_program_template_steps;
create policy "audit_program_template_steps_select_authenticated"
  on public.audit_program_template_steps for select to authenticated using (true);

-- Tenant tables: select/insert/update for org members, delete for owner/admin.
-- Generated in a loop to keep the policy set uniform across the eight tables.

do $$
declare
  t text;
begin
  foreach t in array array[
    'audit_universe', 'audit_plans', 'audit_plan_items', 'audit_engagements',
    'audit_procedures', 'audit_workpapers', 'audit_observations', 'audit_actions'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_tenant', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = public.current_user_org_id())',
      t || '_select_tenant', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert_tenant', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = public.current_user_org_id())',
      t || '_insert_tenant', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update_tenant', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = public.current_user_org_id()) with check (organization_id = public.current_user_org_id())',
      t || '_update_tenant', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_delete_admin', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = public.current_user_org_id() and public.current_user_role() in (''owner'', ''admin''))',
      t || '_delete_admin', t
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- audit_universe_scored view
--   months_since_last_audit: null when never audited.
--   effective_frequency:     entities scoring >= 60 are audited at least annually.
--   is_due:                  active and (never audited or months since >= effective frequency).
-- -----------------------------------------------------------------------------

create or replace view public.audit_universe_scored
with (security_invoker = true) as
select
  u.*,
  case
    when u.last_audited_at is null then null
    else round(((current_date - u.last_audited_at)::numeric / 30.4375), 1)
  end as months_since_last_audit,
  case
    when u.risk_score >= 60 then least(u.audit_frequency_months, 12)
    else u.audit_frequency_months
  end as effective_frequency_months,
  (
    u.status = 'active'
    and (
      u.last_audited_at is null
      or ((current_date - u.last_audited_at)::numeric / 30.4375)
         >= case when u.risk_score >= 60 then least(u.audit_frequency_months, 12)
                 else u.audit_frequency_months end
    )
  ) as is_due,
  (select count(*)::integer from public.audit_engagements e
     where e.universe_id = u.id and e.status <> 'cancelled') as engagement_count,
  (select count(*)::integer from public.audit_observations o
     join public.audit_engagements e on e.id = o.engagement_id
     where e.universe_id = u.id and o.status in ('issued', 'open', 'in_progress', 'overdue')) as open_observations
from public.audit_universe u;

grant select on public.audit_universe_scored to authenticated;

-- -----------------------------------------------------------------------------
-- audit_engagement_summary view
-- -----------------------------------------------------------------------------

create or replace view public.audit_engagement_summary
with (security_invoker = true) as
select
  e.*,
  (select count(*)::integer from public.audit_procedures p where p.engagement_id = e.id) as procedures_total,
  (select count(*)::integer from public.audit_procedures p
     where p.engagement_id = e.id and p.status in ('complete', 'not_applicable')) as procedures_complete,
  (select count(*)::integer from public.audit_workpapers w where w.engagement_id = e.id) as workpapers_total,
  (select count(*)::integer from public.audit_workpapers w
     where w.engagement_id = e.id and w.review_status = 'reviewed') as workpapers_reviewed,
  (select count(*)::integer from public.audit_observations o where o.engagement_id = e.id) as observations_total,
  (select count(*)::integer from public.audit_observations o
     where o.engagement_id = e.id and o.rating = 'critical') as observations_critical,
  (select count(*)::integer from public.audit_observations o
     where o.engagement_id = e.id and o.rating = 'high') as observations_high,
  (select count(*)::integer from public.audit_observations o
     where o.engagement_id = e.id and o.rating = 'medium') as observations_medium,
  (select count(*)::integer from public.audit_observations o
     where o.engagement_id = e.id and o.rating = 'low') as observations_low,
  (select count(*)::integer from public.audit_observations o
     where o.engagement_id = e.id and o.status = 'draft') as observations_draft,
  (select count(*)::integer from public.audit_actions a
     join public.audit_observations o on o.id = a.observation_id
     where o.engagement_id = e.id and a.status in ('open', 'in_progress', 'overdue')) as open_actions,
  (select count(*)::integer from public.audit_actions a
     join public.audit_observations o on o.id = a.observation_id
     where o.engagement_id = e.id
       and a.status in ('open', 'in_progress', 'overdue')
       and coalesce(a.revised_due_date, a.due_date) < current_date) as overdue_actions,
  (select u.name from public.audit_universe u where u.id = e.universe_id) as universe_name,
  (select u.code from public.audit_universe u where u.id = e.universe_id) as universe_code
from public.audit_engagements e;

grant select on public.audit_engagement_summary to authenticated;

-- -----------------------------------------------------------------------------
-- create_engagement_from_template: append template steps to an engagement's work program
-- -----------------------------------------------------------------------------

create or replace function public.create_engagement_from_template(
  p_engagement_id uuid,
  p_template_code text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id     uuid;
  v_engagement public.audit_engagements%rowtype;
  v_template   public.audit_program_templates%rowtype;
  v_step       record;
  v_next       integer;
  v_sort       integer;
  v_inserted   integer := 0;
begin
  v_org_id := public.current_user_org_id();
  if v_org_id is null then
    raise exception 'User is not linked to an organization';
  end if;

  select * into v_engagement
  from public.audit_engagements
  where id = p_engagement_id and organization_id = v_org_id;
  if not found then
    raise exception 'Engagement not found';
  end if;

  if v_engagement.status in ('issued', 'closed', 'cancelled') then
    raise exception 'Work program cannot be changed once the report is issued';
  end if;

  select * into v_template
  from public.audit_program_templates
  where code = p_template_code;
  if not found then
    raise exception 'Template % not found', p_template_code;
  end if;

  select coalesce(max(substring(ref from '^P-(\d+)$')::integer), 0) + 1, coalesce(max(sort_order), 0)
    into v_next, v_sort
  from public.audit_procedures
  where engagement_id = p_engagement_id;

  for v_step in
    select * from public.audit_program_template_steps s
    where s.template_id = v_template.id
    order by s.sort_order
  loop
    v_sort := v_sort + 10;
    insert into public.audit_procedures (
      organization_id, engagement_id, ref, area, objective, procedure, control_ref, sort_order
    )
    values (
      v_org_id, p_engagement_id, 'P-' || lpad(v_next::text, 2, '0'),
      v_step.area, v_step.objective,
      v_step.procedure
        || case when v_step.evidence is not null then E'\n\nTypical evidence: ' || v_step.evidence else '' end,
      v_step.control_hint, v_sort
    );
    v_next := v_next + 1;
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.create_engagement_from_template(uuid, text) from public;
grant execute on function public.create_engagement_from_template(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- create_audit_plan_from_universe: propose a risk-based plan for a period
--   - creates the plan (or reuses an existing draft for the period)
--   - due entities (audit_universe_scored.is_due) not already in the plan are added
--   - quarter by score (>=80 Q1, >=60 Q2, >=40 Q3, else Q4)
--   - planned days by entity type; priority by score
--   - once cumulative planned days exceed capacity the remainder is 'deferred'
-- -----------------------------------------------------------------------------

create or replace function public.create_audit_plan_from_universe(
  p_period text,
  p_capacity_days numeric
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id    uuid;
  v_plan_id   uuid;
  v_status    text;
  v_used      numeric := 0;
  v_row       record;
  v_days      numeric;
  v_quarter   text;
  v_priority  text;
  v_status_i  text;
  v_sort      integer := 0;
begin
  v_org_id := public.current_user_org_id();
  if v_org_id is null then
    raise exception 'User is not linked to an organization';
  end if;
  if p_period is null or length(trim(p_period)) = 0 then
    raise exception 'Period is required';
  end if;

  select id, status into v_plan_id, v_status
  from public.audit_plans
  where organization_id = v_org_id and period = trim(p_period);

  if v_plan_id is null then
    insert into public.audit_plans (organization_id, period, total_capacity_days, notes)
    values (v_org_id, trim(p_period), coalesce(p_capacity_days, 0),
            'Proposed from the audit universe on ' || to_char(current_date, 'DD Mon YYYY') || '.')
    returning id into v_plan_id;
  elsif v_status <> 'draft' then
    raise exception 'Plan % is % and can no longer be regenerated', trim(p_period), v_status;
  else
    update public.audit_plans
      set total_capacity_days = coalesce(p_capacity_days, total_capacity_days)
      where id = v_plan_id;
    select coalesce(sum(planned_days), 0), coalesce(max(sort_order), 0)
      into v_used, v_sort
    from public.audit_plan_items
    where plan_id = v_plan_id and status <> 'deferred' and status <> 'cancelled';
  end if;

  for v_row in
    select s.*
    from public.audit_universe_scored s
    where s.organization_id = v_org_id
      and s.is_due
      and not exists (
        select 1 from public.audit_plan_items i
        where i.plan_id = v_plan_id and i.universe_id = s.id
      )
    order by s.risk_score desc, s.months_since_last_audit desc nulls first, s.name
  loop
    v_days := case v_row.type
      when 'process'     then 15
      when 'entity'      then 20
      when 'system'      then 12
      when 'project'     then 10
      when 'function'    then 12
      when 'third_party' then 8
      when 'regulation'  then 10
      else 10 end;
    v_quarter := case
      when v_row.risk_score >= 80 then 'Q1'
      when v_row.risk_score >= 60 then 'Q2'
      when v_row.risk_score >= 40 then 'Q3'
      else 'Q4' end;
    v_priority := case
      when v_row.risk_score >= 70 then 'high'
      when v_row.risk_score >= 45 then 'medium'
      else 'low' end;

    if coalesce(p_capacity_days, 0) > 0 and v_used + v_days > p_capacity_days then
      v_status_i := 'deferred';
    else
      v_status_i := 'planned';
      v_used := v_used + v_days;
    end if;

    v_sort := v_sort + 10;
    insert into public.audit_plan_items (
      organization_id, plan_id, universe_id, quarter, planned_days, priority, rationale, status, sort_order
    )
    values (
      v_org_id, v_plan_id, v_row.id, v_quarter, v_days, v_priority,
      format(
        'Risk score %s/100 (inherent %s, control environment %s, regulatory %s). %s. Frequency %s months.%s',
        v_row.risk_score, v_row.inherent_risk, v_row.control_environment, v_row.regulatory_exposure,
        case when v_row.last_audited_at is null then 'Never audited'
             else 'Last audited ' || to_char(v_row.last_audited_at, 'Mon YYYY')
                  || ' (' || v_row.months_since_last_audit || ' months ago)' end,
        v_row.effective_frequency_months,
        case when v_status_i = 'deferred' then ' Deferred: exceeds available capacity.' else '' end
      ),
      v_status_i, v_sort
    );
  end loop;

  return v_plan_id;
end;
$$;

revoke all on function public.create_audit_plan_from_universe(text, numeric) from public;
grant execute on function public.create_audit_plan_from_universe(text, numeric) to authenticated;
