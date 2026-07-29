-- =============================================================================
-- AETHER.ai governance operations model
--
-- The tenant-scoped working set: policies and their version history, the
-- instantiated control library, the risk register, the obligation calendar,
-- evidence, third parties, the AI system inventory, tasks and notifications.
--
-- Every table carries organization_id (the tenant key) and an optional
-- client_workspace_id so a consulting firm can keep client engagements apart
-- inside one tenant.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- policies — the living document, always pointing at its current content
-- -----------------------------------------------------------------------------

create table if not exists public.policies (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  client_workspace_id uuid references public.client_workspaces (id) on delete cascade,
  template_id         uuid references public.policy_templates (id) on delete set null,
  title               text not null,
  policy_type         text not null,
  reference_code      text,
  status              text not null default 'draft',
  version             integer not null default 1,
  classification      text not null default 'internal',
  summary             text,
  content_md          text not null default '',
  content_hash        text,
  framework_codes     text[] not null default '{}',
  owner_id            uuid references public.profiles (id) on delete set null,
  approver_id         uuid references public.profiles (id) on delete set null,
  source              text not null default 'manual',
  generation_meta     jsonb,
  effective_date      date,
  review_cadence      text not null default 'annual',
  next_review_at      date,
  approved_at         timestamptz,
  published_at        timestamptz,
  retired_at          timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

comment on table public.policies is
  'Current state of each policy document. Immutable snapshots live in policy_versions.';

do $$ begin
  alter table public.policies add constraint policies_status_check
    check (status in ('draft', 'in_review', 'approved', 'published', 'retired'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.policies add constraint policies_classification_check
    check (classification in ('public', 'internal', 'confidential', 'restricted'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.policies add constraint policies_source_check
    check (source in ('manual', 'ai_generated', 'template', 'imported'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.policies add constraint policies_review_cadence_check
    check (review_cadence in ('annual', 'semiannual', 'quarterly', 'biennial'));
exception when duplicate_object then null; end $$;

create index if not exists policies_organization_id_idx on public.policies (organization_id);
create index if not exists policies_workspace_idx on public.policies (client_workspace_id);
create index if not exists policies_status_idx on public.policies (organization_id, status);
create index if not exists policies_next_review_idx on public.policies (next_review_at)
  where status = 'published';

-- -----------------------------------------------------------------------------
-- policy_versions — append-only snapshots
-- -----------------------------------------------------------------------------

create table if not exists public.policy_versions (
  id             uuid primary key default gen_random_uuid(),
  policy_id      uuid not null references public.policies (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version        integer not null,
  content_md     text not null,
  content_hash   text not null,
  change_summary text,
  status_at_snapshot text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz default now(),
  unique (policy_id, version)
);

create index if not exists policy_versions_policy_id_idx
  on public.policy_versions (policy_id, version desc);

-- -----------------------------------------------------------------------------
-- policy_approvals — the review trail behind a status change
-- -----------------------------------------------------------------------------

create table if not exists public.policy_approvals (
  id              uuid primary key default gen_random_uuid(),
  policy_id       uuid not null references public.policies (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version         integer not null,
  approver_id     uuid references public.profiles (id) on delete set null,
  decision        text not null,
  comment         text,
  decided_at      timestamptz default now()
);

do $$ begin
  alter table public.policy_approvals add constraint policy_approvals_decision_check
    check (decision in ('approved', 'rejected', 'changes_requested'));
exception when duplicate_object then null; end $$;

create index if not exists policy_approvals_policy_id_idx on public.policy_approvals (policy_id);

-- -----------------------------------------------------------------------------
-- policy_control_coverage — which framework controls a policy actually addresses
--
-- Turns "we have an access control policy" into "we demonstrably cover NCA ECC
-- 2-2-1, SAMA CSF 3.3.5 and ISO 27001 A.5.15".
-- -----------------------------------------------------------------------------

create table if not exists public.policy_control_coverage (
  id                   uuid primary key default gen_random_uuid(),
  policy_id            uuid not null references public.policies (id) on delete cascade,
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  framework_control_id uuid not null references public.framework_controls (id) on delete cascade,
  coverage             text not null default 'partial',
  section_ref          text,
  notes                text,
  asserted_by          uuid references public.profiles (id) on delete set null,
  created_at           timestamptz default now(),
  unique (policy_id, framework_control_id)
);

do $$ begin
  alter table public.policy_control_coverage add constraint policy_control_coverage_check
    check (coverage in ('full', 'partial', 'referenced', 'none'));
exception when duplicate_object then null; end $$;

create index if not exists policy_control_coverage_org_idx
  on public.policy_control_coverage (organization_id);
create index if not exists policy_control_coverage_control_idx
  on public.policy_control_coverage (framework_control_id);

-- -----------------------------------------------------------------------------
-- controls — a tenant's instance of a framework control
-- -----------------------------------------------------------------------------

create table if not exists public.controls (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  client_workspace_id   uuid references public.client_workspaces (id) on delete cascade,
  framework_control_id  uuid references public.framework_controls (id) on delete set null,
  framework_code        text not null,
  control_code          text not null,
  title                 text not null,
  owner_id              uuid references public.profiles (id) on delete set null,
  implementation_status text not null default 'not_assessed',
  effectiveness         text not null default 'untested',
  maturity              integer,
  applicability         text not null default 'applicable',
  exclusion_rationale   text,
  implementation_notes  text,
  last_assessed_at      timestamptz,
  next_assessment_at    date,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  check (maturity is null or maturity between 0 and 5)
);

comment on column public.controls.maturity is
  'SAMA CSF maturity scale 0-5. Level 3 (Structured and formalised) is the SAMA target for member organisations.';

do $$ begin
  alter table public.controls add constraint controls_implementation_status_check
    check (implementation_status in (
      'not_assessed', 'not_implemented', 'planned', 'partially_implemented',
      'implemented', 'not_applicable'
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.controls add constraint controls_effectiveness_check
    check (effectiveness in ('untested', 'ineffective', 'needs_improvement', 'effective'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.controls add constraint controls_applicability_check
    check (applicability in ('applicable', 'not_applicable', 'compensating'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.controls add constraint controls_unique_per_scope
    unique (organization_id, client_workspace_id, framework_code, control_code);
exception when duplicate_object then null; end $$;

create index if not exists controls_organization_id_idx on public.controls (organization_id);
create index if not exists controls_framework_idx on public.controls (organization_id, framework_code);
create index if not exists controls_status_idx on public.controls (organization_id, implementation_status);

-- A partial unique index so org-level controls (workspace null) are also unique;
-- the composite constraint above does not constrain NULL workspaces.
create unique index if not exists controls_unique_org_scope
  on public.controls (organization_id, framework_code, control_code)
  where client_workspace_id is null;

-- -----------------------------------------------------------------------------
-- control_assessments — point-in-time evaluation history
-- -----------------------------------------------------------------------------

create table if not exists public.control_assessments (
  id                    uuid primary key default gen_random_uuid(),
  control_id            uuid not null references public.controls (id) on delete cascade,
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  assessed_by           uuid references public.profiles (id) on delete set null,
  assessed_at           timestamptz not null default now(),
  implementation_status text not null,
  effectiveness         text not null,
  maturity              integer,
  findings              text,
  recommendation        text,
  assessment_type       text not null default 'self',
  created_at            timestamptz default now(),
  check (maturity is null or maturity between 0 and 5)
);

do $$ begin
  alter table public.control_assessments add constraint control_assessments_type_check
    check (assessment_type in ('self', 'internal_audit', 'external_audit', 'regulator', 'automated'));
exception when duplicate_object then null; end $$;

create index if not exists control_assessments_control_id_idx
  on public.control_assessments (control_id, assessed_at desc);
create index if not exists control_assessments_org_idx
  on public.control_assessments (organization_id);

-- -----------------------------------------------------------------------------
-- evidence — artefacts backing a control, policy or obligation
-- -----------------------------------------------------------------------------

create table if not exists public.evidence (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_workspace_id uuid references public.client_workspaces (id) on delete cascade,
  control_id      uuid references public.controls (id) on delete cascade,
  policy_id       uuid references public.policies (id) on delete cascade,
  obligation_id   uuid,
  title           text not null,
  description     text,
  evidence_type   text not null default 'document',
  storage_path    text,
  external_url    text,
  content_hash    text,
  collected_at    timestamptz default now(),
  collected_by    uuid references public.profiles (id) on delete set null,
  valid_until     date,
  created_at      timestamptz default now()
);

do $$ begin
  alter table public.evidence add constraint evidence_type_check
    check (evidence_type in (
      'document', 'screenshot', 'log_export', 'configuration', 'attestation',
      'certificate', 'report', 'ticket', 'contract'
    ));
exception when duplicate_object then null; end $$;

create index if not exists evidence_organization_id_idx on public.evidence (organization_id);
create index if not exists evidence_control_id_idx on public.evidence (control_id);
create index if not exists evidence_policy_id_idx on public.evidence (policy_id);

-- -----------------------------------------------------------------------------
-- risks — the register
-- -----------------------------------------------------------------------------

create table if not exists public.risks (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  client_workspace_id uuid references public.client_workspaces (id) on delete cascade,
  reference_code      text,
  title               text not null,
  description         text,
  category            text not null,
  inherent_likelihood integer not null default 3,
  inherent_impact     integer not null default 3,
  residual_likelihood integer,
  residual_impact     integer,
  status              text not null default 'open',
  treatment_strategy  text,
  owner_id            uuid references public.profiles (id) on delete set null,
  frameworks_affected text[] not null default '{}',
  affected_assets     text[] not null default '{}',
  risk_signal_id      uuid references public.risk_signals (id) on delete set null,
  identified_at       timestamptz default now(),
  review_due          date,
  closed_at           timestamptz,
  accepted_rationale  text,
  created_by          uuid references public.profiles (id) on delete set null,
  created_by_machine  boolean not null default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  check (inherent_likelihood between 1 and 5),
  check (inherent_impact between 1 and 5),
  check (residual_likelihood is null or residual_likelihood between 1 and 5),
  check (residual_impact is null or residual_impact between 1 and 5)
);

do $$ begin
  alter table public.risks add constraint risks_status_check
    check (status in ('open', 'assessing', 'mitigating', 'accepted', 'transferred', 'closed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.risks add constraint risks_treatment_check
    check (treatment_strategy is null or treatment_strategy in (
      'mitigate', 'accept', 'transfer', 'avoid'
    ));
exception when duplicate_object then null; end $$;

create index if not exists risks_organization_id_idx on public.risks (organization_id);
create index if not exists risks_status_idx on public.risks (organization_id, status);
create index if not exists risks_signal_idx on public.risks (risk_signal_id);

-- Inherent and residual scores, computed rather than stored so they cannot drift.
alter table public.risks
  add column if not exists inherent_score integer
  generated always as (inherent_likelihood * inherent_impact) stored;

alter table public.risks
  add column if not exists residual_score integer
  generated always as (
    coalesce(residual_likelihood, inherent_likelihood) *
    coalesce(residual_impact, inherent_impact)
  ) stored;

-- -----------------------------------------------------------------------------
-- risk_treatments — the plan for each risk
-- -----------------------------------------------------------------------------

create table if not exists public.risk_treatments (
  id              uuid primary key default gen_random_uuid(),
  risk_id         uuid not null references public.risks (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  action          text not null,
  owner_id        uuid references public.profiles (id) on delete set null,
  due_date        date,
  status          text not null default 'planned',
  completed_at    timestamptz,
  control_id      uuid references public.controls (id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

do $$ begin
  alter table public.risk_treatments add constraint risk_treatments_status_check
    check (status in ('planned', 'in_progress', 'blocked', 'complete', 'cancelled'));
exception when duplicate_object then null; end $$;

create index if not exists risk_treatments_risk_id_idx on public.risk_treatments (risk_id);
create index if not exists risk_treatments_org_idx on public.risk_treatments (organization_id);

-- -----------------------------------------------------------------------------
-- obligations — the compliance calendar
-- -----------------------------------------------------------------------------

create table if not exists public.obligations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  client_workspace_id uuid references public.client_workspaces (id) on delete cascade,
  template_id         uuid references public.obligation_templates (id) on delete set null,
  framework_code      text,
  control_code        text,
  title               text not null,
  description         text,
  cadence             text not null default 'annual',
  due_date            date,
  status              text not null default 'upcoming',
  severity            text not null default 'medium',
  owner_id            uuid references public.profiles (id) on delete set null,
  evidence_required   text[] not null default '{}',
  source              text not null default 'template',
  risk_signal_id      uuid references public.risk_signals (id) on delete set null,
  completed_at        timestamptz,
  waived_rationale    text,
  created_by_machine  boolean not null default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

do $$ begin
  alter table public.obligations add constraint obligations_status_check
    check (status in ('upcoming', 'in_progress', 'submitted', 'complete', 'overdue', 'waived'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.obligations add constraint obligations_source_check
    check (source in ('template', 'signal', 'manual', 'regulator_request'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.obligations add constraint obligations_severity_check
    check (severity in ('low', 'medium', 'high', 'critical'));
exception when duplicate_object then null; end $$;

create index if not exists obligations_organization_id_idx on public.obligations (organization_id);
create index if not exists obligations_due_date_idx on public.obligations (organization_id, due_date);
create index if not exists obligations_status_idx on public.obligations (organization_id, status);

-- Keeps a tenant from accumulating duplicate rows for the same recurring duty.
create unique index if not exists obligations_unique_template_cycle
  on public.obligations (organization_id, template_id, due_date)
  where template_id is not null;

-- -----------------------------------------------------------------------------
-- tasks — the unit of work everything else funnels into
-- -----------------------------------------------------------------------------

create table if not exists public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  client_workspace_id uuid references public.client_workspaces (id) on delete cascade,
  title               text not null,
  description         text,
  task_type           text not null default 'remediation',
  priority            text not null default 'medium',
  status              text not null default 'open',
  owner_id            uuid references public.profiles (id) on delete set null,
  due_date            date,
  control_id          uuid references public.controls (id) on delete cascade,
  policy_id           uuid references public.policies (id) on delete cascade,
  risk_id             uuid references public.risks (id) on delete cascade,
  obligation_id       uuid references public.obligations (id) on delete cascade,
  risk_signal_id      uuid references public.risk_signals (id) on delete set null,
  created_by          uuid references public.profiles (id) on delete set null,
  created_by_machine  boolean not null default false,
  completed_at        timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

do $$ begin
  alter table public.tasks add constraint tasks_type_check
    check (task_type in (
      'remediation', 'assessment', 'filing', 'review', 'investigation',
      'policy_update', 'training', 'evidence_collection'
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.tasks add constraint tasks_priority_check
    check (priority in ('low', 'medium', 'high', 'urgent'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.tasks add constraint tasks_status_check
    check (status in ('open', 'in_progress', 'blocked', 'complete', 'cancelled'));
exception when duplicate_object then null; end $$;

create index if not exists tasks_organization_id_idx on public.tasks (organization_id);
create index if not exists tasks_status_idx on public.tasks (organization_id, status);
create index if not exists tasks_owner_idx on public.tasks (owner_id) where status <> 'complete';

-- -----------------------------------------------------------------------------
-- vendors — third-party / supply chain risk
-- -----------------------------------------------------------------------------

create table if not exists public.vendors (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  client_workspace_id uuid references public.client_workspaces (id) on delete cascade,
  name                text not null,
  category            text,
  description         text,
  country             text,
  data_residency      text,
  criticality         text not null default 'medium',
  data_categories     text[] not null default '{}',
  services_provided   text[] not null default '{}',
  is_subprocessor     boolean not null default false,
  is_cloud_provider   boolean not null default false,
  contract_start      date,
  contract_end        date,
  assessment_status   text not null default 'not_started',
  inherent_risk       text,
  residual_risk       text,
  certifications      text[] not null default '{}',
  last_reviewed_at    timestamptz,
  next_review_at      date,
  owner_id            uuid references public.profiles (id) on delete set null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

do $$ begin
  alter table public.vendors add constraint vendors_criticality_check
    check (criticality in ('low', 'medium', 'high', 'critical'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.vendors add constraint vendors_assessment_status_check
    check (assessment_status in (
      'not_started', 'questionnaire_sent', 'under_review', 'approved',
      'approved_with_conditions', 'rejected', 'expired'
    ));
exception when duplicate_object then null; end $$;

create index if not exists vendors_organization_id_idx on public.vendors (organization_id);

-- -----------------------------------------------------------------------------
-- ai_systems — the AI inventory that EU AI Act and SDAIA both require
-- -----------------------------------------------------------------------------

create table if not exists public.ai_systems (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  client_workspace_id    uuid references public.client_workspaces (id) on delete cascade,
  name                   text not null,
  purpose                text not null,
  description            text,
  lifecycle_stage        text not null default 'design',
  role                   text not null default 'deployer',
  model_provider         text,
  model_family           text,
  is_generative          boolean not null default false,
  is_general_purpose     boolean not null default false,
  deployment_context     text,
  business_function      text,
  affected_persons       text[] not null default '{}',
  -- Flags the classifier reads. Names match ai_classification_rules.required_flags.
  processes_personal_data       boolean not null default false,
  processes_special_category    boolean not null default false,
  processes_biometric_data      boolean not null default false,
  makes_automated_decisions     boolean not null default false,
  affects_legal_rights          boolean not null default false,
  human_in_the_loop             boolean not null default true,
  publicly_accessible           boolean not null default false,
  used_in_critical_infrastructure boolean not null default false,
  eu_market_exposure     boolean not null default false,
  eu_ai_act_class        text,
  eu_ai_act_rationale    text,
  sdaia_risk_tier        text,
  classification_at      timestamptz,
  classified_by_machine  boolean not null default false,
  transparency_measures  text,
  oversight_measures     text,
  last_risk_assessment_at timestamptz,
  next_review_at         date,
  owner_id               uuid references public.profiles (id) on delete set null,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

do $$ begin
  alter table public.ai_systems add constraint ai_systems_lifecycle_check
    check (lifecycle_stage in (
      'design', 'development', 'testing', 'pilot', 'production',
      'monitoring', 'retired'
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ai_systems add constraint ai_systems_role_check
    check (role in ('provider', 'deployer', 'importer', 'distributor', 'authorised_representative'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ai_systems add constraint ai_systems_eu_class_check
    check (eu_ai_act_class is null or eu_ai_act_class in (
      'prohibited', 'high', 'limited', 'minimal', 'gpai', 'gpai_systemic'
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ai_systems add constraint ai_systems_sdaia_tier_check
    check (sdaia_risk_tier is null or sdaia_risk_tier in (
      'unacceptable', 'high', 'limited', 'low'
    ));
exception when duplicate_object then null; end $$;

create index if not exists ai_systems_organization_id_idx on public.ai_systems (organization_id);
create index if not exists ai_systems_class_idx on public.ai_systems (organization_id, eu_ai_act_class);

-- -----------------------------------------------------------------------------
-- notifications — what a human needs to look at
-- -----------------------------------------------------------------------------

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id      uuid references public.profiles (id) on delete cascade,
  kind            text not null default 'info',
  severity        text not null default 'info',
  title           text not null,
  body            text,
  link            text,
  entity_type     text,
  entity_id       uuid,
  read_at         timestamptz,
  created_at      timestamptz default now()
);

do $$ begin
  alter table public.notifications add constraint notifications_severity_check
    check (severity in ('info', 'low', 'medium', 'high', 'critical'));
exception when duplicate_object then null; end $$;

create index if not exists notifications_recipient_idx
  on public.notifications (organization_id, profile_id, read_at);
create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

-- -----------------------------------------------------------------------------
-- Late FK now that obligations exists
-- -----------------------------------------------------------------------------

do $$ begin
  alter table public.evidence
    add constraint evidence_obligation_id_fkey
    foreign key (obligation_id) references public.obligations (id) on delete cascade;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

do $trg$ begin perform public.ensure_updated_at_trigger('public.policies'); end $trg$;
do $trg$ begin perform public.ensure_updated_at_trigger('public.controls'); end $trg$;
do $trg$ begin perform public.ensure_updated_at_trigger('public.risks'); end $trg$;
do $trg$ begin perform public.ensure_updated_at_trigger('public.risk_treatments'); end $trg$;
do $trg$ begin perform public.ensure_updated_at_trigger('public.obligations'); end $trg$;
do $trg$ begin perform public.ensure_updated_at_trigger('public.tasks'); end $trg$;
do $trg$ begin perform public.ensure_updated_at_trigger('public.vendors'); end $trg$;
do $trg$ begin perform public.ensure_updated_at_trigger('public.ai_systems'); end $trg$;

-- -----------------------------------------------------------------------------
-- Policy versioning: every content change is snapshotted automatically, so the
-- history cannot be bypassed by writing straight to the table.
-- -----------------------------------------------------------------------------

create or replace function public.snapshot_policy_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_hash text;
begin
  new_hash := public.sha256_hex(new.content_md);

  if tg_op = 'INSERT' then
    new.content_hash := new_hash;
    insert into public.policy_versions (
      policy_id, organization_id, version, content_md, content_hash,
      change_summary, status_at_snapshot, created_by
    )
    values (
      new.id, new.organization_id, new.version, coalesce(new.content_md, ''),
      new_hash, 'Initial version', new.status, new.created_by
    )
    on conflict (policy_id, version) do nothing;
    return new;
  end if;

  -- Content changed: bump the version and snapshot, unless the caller already
  -- set an explicit new version number.
  if coalesce(old.content_md, '') <> coalesce(new.content_md, '') then
    if new.version = old.version then
      new.version := old.version + 1;
    end if;
    new.content_hash := new_hash;

    insert into public.policy_versions (
      policy_id, organization_id, version, content_md, content_hash,
      change_summary, status_at_snapshot, created_by
    )
    values (
      new.id, new.organization_id, new.version, coalesce(new.content_md, ''),
      new_hash, null, new.status, new.created_by
    )
    on conflict (policy_id, version) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists snapshot_policy_version_ins on public.policies;
create trigger snapshot_policy_version_ins
  before insert on public.policies
  for each row execute function public.snapshot_policy_version();

drop trigger if exists snapshot_policy_version_upd on public.policies;
create trigger snapshot_policy_version_upd
  before update on public.policies
  for each row execute function public.snapshot_policy_version();

-- -----------------------------------------------------------------------------
-- Obligations flip to overdue on their own; nothing has to run to notice.
-- -----------------------------------------------------------------------------

create or replace view public.obligations_effective as
select
  o.*,
  case
    when o.status in ('complete', 'submitted', 'waived') then o.status
    when o.due_date is not null and o.due_date < current_date then 'overdue'
    else o.status
  end as effective_status,
  case
    when o.due_date is null then null
    else (o.due_date - current_date)
  end as days_until_due
from public.obligations o;

comment on view public.obligations_effective is
  'obligations with a date-derived overdue status, so nothing depends on a nightly job to stay accurate.';
