-- =============================================================================
-- AETHER Enterprise Risk Management (ERM) module
--   erm_taxonomy_templates — global default risk taxonomy (reference data)
--   erm_categories         — tenant risk taxonomy, level 1 / level 2
--   erm_appetite           — risk appetite statements and tolerance thresholds
--   erm_risks              — enterprise risk register (RSK-0001 per org)
--   erm_risk_controls      — risk ↔ library / ICFR / custom controls
--   erm_treatments         — treatment plans (mitigate / transfer / avoid / accept)
--   erm_kris               — key risk indicators with RAG thresholds
--   erm_kri_readings       — periodic KRI observations
--   erm_assessments        — score history snapshots (trigger-maintained)
--   erm_links              — soft links to other modules (no cross-module FK)
--   views: erm_kri_status, erm_risk_summary, erm_heatmap
--
-- Vocabulary follows ISO 31000:2018 (risk = effect of uncertainty on
-- objectives; risk source → event → consequence; treatment options) and
-- COSO ERM 2017 (risk appetite, tolerance, inherent vs residual vs target,
-- velocity, portfolio view, KRIs).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- erm_taxonomy_templates (global reference data)
-- -----------------------------------------------------------------------------

create table if not exists public.erm_taxonomy_templates (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,                     -- e.g. 'STR', 'STR-01'
  parent_code     text references public.erm_taxonomy_templates(code) on delete cascade,
  name_en         text not null,
  name_ar         text not null,
  description_en  text,
  description_ar  text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.erm_taxonomy_templates is
  'Global default risk taxonomy (GCC-flavoured). Copied into a tenant via import_erm_taxonomy(). Seeded via migrations only.';

create index if not exists erm_taxonomy_templates_parent_idx
  on public.erm_taxonomy_templates (parent_code, sort_order);

-- -----------------------------------------------------------------------------
-- erm_categories (tenant taxonomy)
-- -----------------------------------------------------------------------------

create table if not exists public.erm_categories (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  code             text not null,
  name_en          text not null,
  name_ar          text,
  parent_id        uuid references public.erm_categories(id) on delete cascade,
  level            integer not null default 1,
  description      text,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint erm_categories_org_code_unique unique (organization_id, code),
  constraint erm_categories_level_check check (level in (1, 2)),
  constraint erm_categories_level_parent_check check (
    (level = 1 and parent_id is null) or (level = 2 and parent_id is not null)
  )
);

comment on table public.erm_categories is
  'Tenant risk taxonomy. Level 1 = risk domain, level 2 = risk sub-category.';

create index if not exists erm_categories_org_idx on public.erm_categories (organization_id, sort_order);
create index if not exists erm_categories_parent_idx on public.erm_categories (parent_id);

-- -----------------------------------------------------------------------------
-- erm_appetite
-- -----------------------------------------------------------------------------

create table if not exists public.erm_appetite (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  category_id          uuid references public.erm_categories(id) on delete cascade, -- null = enterprise-wide
  statement_en         text not null,
  statement_ar         text,
  appetite_level       text not null default 'cautious',
  tolerance_threshold  integer not null default 12,             -- residual score above which escalation is required
  approved_by          uuid references public.profiles(id) on delete set null,
  approved_at          timestamptz,
  review_date          date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint erm_appetite_level_check check (appetite_level in ('averse', 'minimal', 'cautious', 'open', 'hungry')),
  constraint erm_appetite_tolerance_check check (tolerance_threshold between 1 and 25)
);

comment on table public.erm_appetite is
  'Risk appetite statements per category (category_id null = enterprise-wide). tolerance_threshold is the residual score (L×I) above which a risk breaches appetite.';

create unique index if not exists erm_appetite_org_category_uidx
  on public.erm_appetite (
    organization_id,
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- -----------------------------------------------------------------------------
-- erm_risks
-- -----------------------------------------------------------------------------

create table if not exists public.erm_risks (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  client_workspace_id   uuid references public.client_workspaces(id) on delete set null,
  code                  text not null default '',                 -- filled by trigger when blank: RSK-0001
  title                 text not null,
  description           text,
  category_id           uuid references public.erm_categories(id) on delete set null,
  owner_id              uuid references public.profiles(id) on delete set null,
  sponsor_id            uuid references public.profiles(id) on delete set null,
  source                text not null default 'workshop',
  status                text not null default 'identified',
  inherent_likelihood   integer,
  inherent_impact       integer,
  residual_likelihood   integer,
  residual_impact       integer,
  target_likelihood     integer,
  target_impact         integer,
  velocity              integer,
  trend                 text not null default 'stable',
  impact_dimensions     jsonb not null default '{}'::jsonb,       -- {financial, operational, regulatory, reputational, safety}: 1-5
  causes                text,
  consequences          text,
  emerging              boolean not null default false,
  last_assessed_at      timestamptz,
  next_review_at        date,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  inherent_score        integer generated always as (inherent_likelihood * inherent_impact) stored,
  residual_score        integer generated always as (residual_likelihood * residual_impact) stored,
  target_score          integer generated always as (target_likelihood * target_impact) stored,
  constraint erm_risks_org_code_unique unique (organization_id, code),
  constraint erm_risks_source_check check (source in (
    'workshop', 'audit', 'incident', 'regulatory', 'strategic_review', 'kri'
  )),
  constraint erm_risks_status_check check (status in (
    'identified', 'assessed', 'treating', 'monitoring', 'closed', 'accepted'
  )),
  constraint erm_risks_trend_check check (trend in ('increasing', 'stable', 'decreasing')),
  constraint erm_risks_scale_check check (
    (inherent_likelihood is null or inherent_likelihood between 1 and 5)
    and (inherent_impact is null or inherent_impact between 1 and 5)
    and (residual_likelihood is null or residual_likelihood between 1 and 5)
    and (residual_impact is null or residual_impact between 1 and 5)
    and (target_likelihood is null or target_likelihood between 1 and 5)
    and (target_impact is null or target_impact between 1 and 5)
    and (velocity is null or velocity between 1 and 5)
  ),
  constraint erm_risks_impact_dimensions_check check (jsonb_typeof(impact_dimensions) = 'object')
);

comment on table public.erm_risks is
  'Enterprise risk register. Scores are likelihood × impact on 5×5 scales; inherent (before controls), residual (after controls), target (post-treatment).';

create index if not exists erm_risks_org_status_idx on public.erm_risks (organization_id, status);
create index if not exists erm_risks_org_category_idx on public.erm_risks (organization_id, category_id);
create index if not exists erm_risks_owner_idx on public.erm_risks (owner_id);

-- -----------------------------------------------------------------------------
-- erm_risk_controls
-- -----------------------------------------------------------------------------

create table if not exists public.erm_risk_controls (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  risk_id          uuid not null references public.erm_risks(id) on delete cascade,
  control_id       uuid references public.controls(id) on delete cascade,        -- regulatory library
  icfr_control_id  uuid references public.icfr_controls(id) on delete cascade,   -- ICFR RCM
  name             text,                                                          -- custom control
  description      text,
  control_type     text,
  effectiveness    integer,                                                       -- 1 (ineffective) – 5 (fully effective)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint erm_risk_controls_one_of_check check (
    control_id is not null or icfr_control_id is not null or nullif(btrim(coalesce(name, '')), '') is not null
  ),
  constraint erm_risk_controls_type_check check (
    control_type is null or control_type in ('preventive', 'detective', 'directive', 'corrective')
  ),
  constraint erm_risk_controls_effectiveness_check check (effectiveness is null or effectiveness between 1 and 5)
);

comment on table public.erm_risk_controls is
  'Controls mitigating a risk: a library control, an ICFR control, or a free-text control. At least one of the three is set.';

create index if not exists erm_risk_controls_risk_idx on public.erm_risk_controls (risk_id);
create index if not exists erm_risk_controls_org_idx on public.erm_risk_controls (organization_id);
create unique index if not exists erm_risk_controls_risk_library_uidx
  on public.erm_risk_controls (risk_id, control_id) where control_id is not null;
create unique index if not exists erm_risk_controls_risk_icfr_uidx
  on public.erm_risk_controls (risk_id, icfr_control_id) where icfr_control_id is not null;

-- -----------------------------------------------------------------------------
-- erm_treatments
-- -----------------------------------------------------------------------------

create table if not exists public.erm_treatments (
  id                            uuid primary key default gen_random_uuid(),
  organization_id               uuid not null references public.organizations(id) on delete cascade,
  risk_id                       uuid not null references public.erm_risks(id) on delete cascade,
  strategy                      text not null default 'mitigate',
  title                         text not null,
  description                   text,
  owner_id                      uuid references public.profiles(id) on delete set null,
  due_date                      date,
  status                        text not null default 'planned',
  cost_estimate                 numeric(14, 2),
  expected_residual_likelihood  integer,
  expected_residual_impact      integer,
  completed_at                  timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  constraint erm_treatments_strategy_check check (strategy in ('mitigate', 'transfer', 'avoid', 'accept')),
  constraint erm_treatments_status_check check (status in ('planned', 'in_progress', 'complete', 'overdue', 'cancelled')),
  constraint erm_treatments_expected_check check (
    (expected_residual_likelihood is null or expected_residual_likelihood between 1 and 5)
    and (expected_residual_impact is null or expected_residual_impact between 1 and 5)
  ),
  constraint erm_treatments_cost_check check (cost_estimate is null or cost_estimate >= 0)
);

comment on table public.erm_treatments is
  'Risk treatment plans per ISO 31000 §6.5 — mitigate, transfer, avoid or accept.';

create index if not exists erm_treatments_risk_idx on public.erm_treatments (risk_id);
create index if not exists erm_treatments_org_status_idx on public.erm_treatments (organization_id, status, due_date);

-- -----------------------------------------------------------------------------
-- erm_kris / erm_kri_readings
-- -----------------------------------------------------------------------------

create table if not exists public.erm_kris (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  risk_id          uuid not null references public.erm_risks(id) on delete cascade,
  name             text not null,
  description      text,
  unit             text,
  direction        text not null default 'higher_is_worse',
  green_threshold  numeric,
  amber_threshold  numeric not null,
  red_threshold    numeric not null,
  frequency        text not null default 'monthly',
  owner_id         uuid references public.profiles(id) on delete set null,
  data_source      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint erm_kris_direction_check check (direction in ('higher_is_worse', 'lower_is_worse')),
  constraint erm_kris_frequency_check check (frequency in ('weekly', 'monthly', 'quarterly')),
  constraint erm_kris_threshold_order_check check (
    (direction = 'higher_is_worse' and amber_threshold <= red_threshold)
    or (direction = 'lower_is_worse' and amber_threshold >= red_threshold)
  )
);

comment on table public.erm_kris is
  'Key risk indicators. Status is green until amber_threshold is reached, amber until red_threshold, then red (direction-aware).';

create index if not exists erm_kris_risk_idx on public.erm_kris (risk_id);
create index if not exists erm_kris_org_idx on public.erm_kris (organization_id);

create table if not exists public.erm_kri_readings (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  kri_id           uuid not null references public.erm_kris(id) on delete cascade,
  period_date      date not null,
  value            numeric not null,
  note             text,
  recorded_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint erm_kri_readings_unique unique (kri_id, period_date)
);

create index if not exists erm_kri_readings_kri_idx on public.erm_kri_readings (kri_id, period_date desc);
create index if not exists erm_kri_readings_org_idx on public.erm_kri_readings (organization_id);

-- -----------------------------------------------------------------------------
-- erm_assessments (history snapshots)
-- -----------------------------------------------------------------------------

create table if not exists public.erm_assessments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  risk_id          uuid not null references public.erm_risks(id) on delete cascade,
  assessed_at      timestamptz not null default now(),
  assessed_by      uuid references public.profiles(id) on delete set null,
  inherent_l       integer,
  inherent_i       integer,
  residual_l       integer,
  residual_i       integer,
  rationale        text,
  created_at       timestamptz not null default now()
);

comment on table public.erm_assessments is
  'Immutable score history. A snapshot is written by trigger whenever a risk''s inherent or residual score changes, or explicitly via erm_assess_risk().';

create index if not exists erm_assessments_risk_idx on public.erm_assessments (risk_id, assessed_at desc);
create index if not exists erm_assessments_org_idx on public.erm_assessments (organization_id);

-- -----------------------------------------------------------------------------
-- erm_links (soft cross-module links — uuid + kind, no FK)
-- -----------------------------------------------------------------------------

create table if not exists public.erm_links (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  risk_id          uuid not null references public.erm_risks(id) on delete cascade,
  kind             text not null,
  target_id        uuid not null,
  label            text,
  created_at       timestamptz not null default now(),
  constraint erm_links_unique unique (risk_id, kind, target_id),
  constraint erm_links_kind_check check (kind in (
    'audit_observation', 'icfr_deficiency', 'program_control_implementation'
  ))
);

comment on table public.erm_links is
  'Links from a risk to records in other modules by (kind, uuid). No FK by design to avoid migration-order coupling.';

create index if not exists erm_links_risk_idx on public.erm_links (risk_id);
create index if not exists erm_links_org_idx on public.erm_links (organization_id);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists erm_taxonomy_templates_set_updated_at on public.erm_taxonomy_templates;
create trigger erm_taxonomy_templates_set_updated_at
  before update on public.erm_taxonomy_templates
  for each row execute function public.set_updated_at();

drop trigger if exists erm_categories_set_updated_at on public.erm_categories;
create trigger erm_categories_set_updated_at
  before update on public.erm_categories
  for each row execute function public.set_updated_at();

drop trigger if exists erm_appetite_set_updated_at on public.erm_appetite;
create trigger erm_appetite_set_updated_at
  before update on public.erm_appetite
  for each row execute function public.set_updated_at();

drop trigger if exists erm_risks_set_updated_at on public.erm_risks;
create trigger erm_risks_set_updated_at
  before update on public.erm_risks
  for each row execute function public.set_updated_at();

drop trigger if exists erm_risk_controls_set_updated_at on public.erm_risk_controls;
create trigger erm_risk_controls_set_updated_at
  before update on public.erm_risk_controls
  for each row execute function public.set_updated_at();

drop trigger if exists erm_treatments_set_updated_at on public.erm_treatments;
create trigger erm_treatments_set_updated_at
  before update on public.erm_treatments
  for each row execute function public.set_updated_at();

drop trigger if exists erm_kris_set_updated_at on public.erm_kris;
create trigger erm_kris_set_updated_at
  before update on public.erm_kris
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- next_risk_code(org): RSK-0001 sequence per organization
-- -----------------------------------------------------------------------------

create or replace function public.next_risk_code(p_org uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
begin
  -- Serialise per-org code generation; the unique (org, code) index is the backstop.
  perform pg_advisory_xact_lock(hashtext('erm_risk_code:' || p_org::text));
  select coalesce(max(substring(r.code from '^RSK-(\d+)$')::integer), 0) + 1
    into v_next
  from public.erm_risks r
  where r.organization_id = p_org and r.code ~ '^RSK-\d+$';
  return 'RSK-' || lpad(v_next::text, 4, '0');
end;
$$;

revoke all on function public.next_risk_code(uuid) from public;
grant execute on function public.next_risk_code(uuid) to authenticated;

create or replace function public.erm_risks_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.code is null or btrim(new.code) = '' then
      new.code := public.next_risk_code(new.organization_id);
    end if;
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    if new.inherent_likelihood is not null or new.residual_likelihood is not null then
      new.last_assessed_at := coalesce(new.last_assessed_at, now());
    end if;
  elsif tg_op = 'UPDATE' then
    if new.inherent_likelihood is distinct from old.inherent_likelihood
       or new.inherent_impact is distinct from old.inherent_impact
       or new.residual_likelihood is distinct from old.residual_likelihood
       or new.residual_impact is distinct from old.residual_impact then
      new.last_assessed_at := now();
    end if;
    if new.status = 'closed' and old.status <> 'closed' and new.trend = 'increasing' then
      new.trend := 'stable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists erm_risks_before_write on public.erm_risks;
create trigger erm_risks_before_write
  before insert or update on public.erm_risks
  for each row execute function public.erm_risks_before_write();

-- -----------------------------------------------------------------------------
-- Assessment snapshot trigger
-- The rationale is passed through a transaction-local GUC set by erm_assess_risk().
-- -----------------------------------------------------------------------------

create or replace function public.erm_risks_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_changed := new.inherent_likelihood is not null or new.residual_likelihood is not null;
  else
    v_changed :=
      new.inherent_likelihood is distinct from old.inherent_likelihood
      or new.inherent_impact is distinct from old.inherent_impact
      or new.residual_likelihood is distinct from old.residual_likelihood
      or new.residual_impact is distinct from old.residual_impact;
  end if;

  if v_changed then
    insert into public.erm_assessments (
      organization_id, risk_id, assessed_at, assessed_by,
      inherent_l, inherent_i, residual_l, residual_i, rationale
    ) values (
      new.organization_id, new.id, now(), auth.uid(),
      new.inherent_likelihood, new.inherent_impact,
      new.residual_likelihood, new.residual_impact,
      nullif(current_setting('erm.assessment_rationale', true), '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists erm_risks_snapshot on public.erm_risks;
create trigger erm_risks_snapshot
  after insert or update on public.erm_risks
  for each row execute function public.erm_risks_snapshot();

-- -----------------------------------------------------------------------------
-- erm_assess_risk: update scores + write a snapshot with rationale in one call
-- -----------------------------------------------------------------------------

create or replace function public.erm_assess_risk(
  p_risk_id uuid,
  p_inherent_l integer,
  p_inherent_i integer,
  p_residual_l integer,
  p_residual_i integer,
  p_rationale text default null,
  p_velocity integer default null,
  p_trend text default null,
  p_target_l integer default null,
  p_target_i integer default null,
  p_impact_dimensions jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old public.erm_risks%rowtype;
  v_changed boolean;
begin
  select * into v_old from public.erm_risks where id = p_risk_id;
  if not found then
    raise exception 'Risk not found';
  end if;

  v_changed :=
    p_inherent_l is distinct from v_old.inherent_likelihood
    or p_inherent_i is distinct from v_old.inherent_impact
    or p_residual_l is distinct from v_old.residual_likelihood
    or p_residual_i is distinct from v_old.residual_impact;

  perform set_config('erm.assessment_rationale', coalesce(p_rationale, ''), true);

  update public.erm_risks set
    inherent_likelihood = p_inherent_l,
    inherent_impact     = p_inherent_i,
    residual_likelihood = p_residual_l,
    residual_impact     = p_residual_i,
    velocity            = coalesce(p_velocity, velocity),
    trend               = coalesce(p_trend, trend),
    target_likelihood   = coalesce(p_target_l, target_likelihood),
    target_impact       = coalesce(p_target_i, target_impact),
    impact_dimensions   = coalesce(p_impact_dimensions, impact_dimensions),
    last_assessed_at    = now(),
    status              = case when status = 'identified' then 'assessed' else status end
  where id = p_risk_id;

  perform set_config('erm.assessment_rationale', '', true);

  -- Re-affirmation without score change still records an assessment event.
  if not v_changed then
    insert into public.erm_assessments (
      organization_id, risk_id, assessed_at, assessed_by,
      inherent_l, inherent_i, residual_l, residual_i, rationale
    ) values (
      v_old.organization_id, p_risk_id, now(), auth.uid(),
      p_inherent_l, p_inherent_i, p_residual_l, p_residual_i, p_rationale
    );
  end if;

  return p_risk_id;
end;
$$;

revoke all on function public.erm_assess_risk(uuid, integer, integer, integer, integer, text, integer, text, integer, integer, jsonb) from public;
grant execute on function public.erm_assess_risk(uuid, integer, integer, integer, integer, text, integer, text, integer, integer, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Treatment overdue roll-forward helper (called by queries; cheap, idempotent)
-- -----------------------------------------------------------------------------

create or replace function public.erm_mark_overdue_treatments()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.erm_treatments
     set status = 'overdue'
   where status in ('planned', 'in_progress')
     and due_date is not null
     and due_date < current_date
     and organization_id = public.current_user_org_id();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.erm_mark_overdue_treatments() from public;
grant execute on function public.erm_mark_overdue_treatments() to authenticated;

-- -----------------------------------------------------------------------------
-- import_erm_taxonomy: copy the global template into the caller's organization
-- -----------------------------------------------------------------------------

create or replace function public.import_erm_taxonomy()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id   uuid;
  v_inserted integer := 0;
  v_row      integer;
begin
  v_org_id := public.current_user_org_id();
  if v_org_id is null then
    raise exception 'User is not linked to an organization';
  end if;

  -- Level 1
  insert into public.erm_categories (organization_id, code, name_en, name_ar, level, description, sort_order)
  select v_org_id, t.code, t.name_en, t.name_ar, 1, t.description_en, t.sort_order
  from public.erm_taxonomy_templates t
  where t.parent_code is null
  on conflict (organization_id, code) do nothing;
  get diagnostics v_row = row_count;
  v_inserted := v_inserted + v_row;

  -- Level 2
  insert into public.erm_categories (organization_id, code, name_en, name_ar, parent_id, level, description, sort_order)
  select v_org_id, t.code, t.name_en, t.name_ar, p.id, 2, t.description_en, t.sort_order
  from public.erm_taxonomy_templates t
  join public.erm_categories p
    on p.organization_id = v_org_id and p.code = t.parent_code
  where t.parent_code is not null
  on conflict (organization_id, code) do nothing;
  get diagnostics v_row = row_count;
  v_inserted := v_inserted + v_row;

  -- Default enterprise-wide appetite if none exists yet (owner/admin only — RLS).
  if public.current_user_role() in ('owner', 'admin') then
  insert into public.erm_appetite (organization_id, category_id, statement_en, statement_ar, appetite_level, tolerance_threshold)
  select v_org_id, null,
    'The organisation accepts risk in pursuit of its strategic objectives but will not accept risks that threaten regulatory standing, solvency, safety of people or the trust of customers and regulators. Residual risks scored above the tolerance threshold require executive escalation and a documented treatment plan.',
    'تقبل المنظمة المخاطر في سبيل تحقيق أهدافها الاستراتيجية، لكنها لا تقبل المخاطر التي تهدد وضعها التنظيمي أو ملاءتها المالية أو سلامة الأفراد أو ثقة العملاء والجهات الرقابية. تتطلب المخاطر المتبقية التي تتجاوز حد التحمل تصعيداً تنفيذياً وخطة معالجة موثقة.',
    'cautious', 12
  where not exists (
    select 1 from public.erm_appetite a where a.organization_id = v_org_id and a.category_id is null
  );
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.import_erm_taxonomy() from public;
grant execute on function public.import_erm_taxonomy() to authenticated;

-- -----------------------------------------------------------------------------
-- KRI RAG helper + view
-- -----------------------------------------------------------------------------

create or replace function public.erm_kri_rag(
  p_direction text, p_value numeric, p_amber numeric, p_red numeric
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null then 'none'
    when p_direction = 'lower_is_worse' then
      case when p_value <= p_red then 'red' when p_value <= p_amber then 'amber' else 'green' end
    else
      case when p_value >= p_red then 'red' when p_value >= p_amber then 'amber' else 'green' end
  end
$$;

create or replace view public.erm_kri_status
with (security_invoker = true) as
select
  k.id,
  k.organization_id,
  k.risk_id,
  k.name,
  k.unit,
  k.direction,
  k.green_threshold,
  k.amber_threshold,
  k.red_threshold,
  k.frequency,
  k.owner_id,
  k.data_source,
  lr.period_date  as latest_period,
  lr.value        as latest_value,
  public.erm_kri_rag(k.direction, lr.value, k.amber_threshold, k.red_threshold) as status,
  (select count(*)::integer from public.erm_kri_readings r where r.kri_id = k.id) as reading_count
from public.erm_kris k
left join lateral (
  select r.period_date, r.value
  from public.erm_kri_readings r
  where r.kri_id = k.id
  order by r.period_date desc
  limit 1
) lr on true;

grant select on public.erm_kri_status to authenticated;

-- -----------------------------------------------------------------------------
-- erm_risk_summary view
-- -----------------------------------------------------------------------------

create or replace view public.erm_risk_summary
with (security_invoker = true) as
select
  r.id,
  r.organization_id,
  r.client_workspace_id,
  r.code,
  r.title,
  r.description,
  r.category_id,
  c.code       as category_code,
  c.name_en    as category_name_en,
  c.name_ar    as category_name_ar,
  pc.id        as parent_category_id,
  pc.code      as parent_category_code,
  pc.name_en   as parent_category_name_en,
  r.owner_id,
  coalesce(o.full_name, o.email) as owner_name,
  r.sponsor_id,
  coalesce(s.full_name, s.email) as sponsor_name,
  r.source,
  r.status,
  r.inherent_likelihood,
  r.inherent_impact,
  r.inherent_score,
  r.residual_likelihood,
  r.residual_impact,
  r.residual_score,
  r.target_likelihood,
  r.target_impact,
  r.target_score,
  r.velocity,
  r.trend,
  r.impact_dimensions,
  r.emerging,
  r.last_assessed_at,
  r.next_review_at,
  r.created_at,
  r.updated_at,
  ap.tolerance_threshold,
  ap.appetite_level,
  (r.residual_score is not null and ap.tolerance_threshold is not null
     and r.residual_score > ap.tolerance_threshold
     and r.status not in ('closed')) as appetite_breach,
  (select count(*)::integer from public.erm_risk_controls rc where rc.risk_id = r.id) as control_count,
  (select count(*)::integer from public.erm_treatments t
     where t.risk_id = r.id and t.status in ('planned', 'in_progress', 'overdue')) as open_treatments,
  (select count(*)::integer from public.erm_treatments t
     where t.risk_id = r.id
       and (t.status = 'overdue' or (t.status in ('planned', 'in_progress') and t.due_date < current_date))) as overdue_treatments,
  (select count(*)::integer from public.erm_kris k where k.risk_id = r.id) as kri_count,
  (select case
       when bool_or(ks.status = 'red') then 'red'
       when bool_or(ks.status = 'amber') then 'amber'
       when bool_or(ks.status = 'green') then 'green'
       when count(*) > 0 then 'none'
       else null end
     from public.erm_kri_status ks where ks.risk_id = r.id) as kri_status
from public.erm_risks r
left join public.erm_categories c on c.id = r.category_id
left join public.erm_categories pc on pc.id = c.parent_id
left join public.profiles o on o.id = r.owner_id
left join public.profiles s on s.id = r.sponsor_id
left join lateral (
  -- Most specific appetite: L2 category, then its L1 parent, then enterprise-wide.
  select a.tolerance_threshold, a.appetite_level
  from public.erm_appetite a
  where a.organization_id = r.organization_id
    and (a.category_id = r.category_id or a.category_id = c.parent_id or a.category_id is null)
  order by case
    when a.category_id = r.category_id then 0
    when a.category_id = c.parent_id then 1
    else 2 end
  limit 1
) ap on true;

grant select on public.erm_risk_summary to authenticated;

-- -----------------------------------------------------------------------------
-- erm_heatmap view — risks per L×I cell (open risks only), residual and inherent
-- -----------------------------------------------------------------------------

create or replace view public.erm_heatmap
with (security_invoker = true) as
select organization_id, 'residual'::text as basis,
       residual_likelihood as likelihood, residual_impact as impact,
       count(*)::integer as risk_count
from public.erm_risks
where status <> 'closed' and residual_likelihood is not null and residual_impact is not null
group by organization_id, residual_likelihood, residual_impact
union all
select organization_id, 'inherent'::text as basis,
       inherent_likelihood, inherent_impact, count(*)::integer
from public.erm_risks
where status <> 'closed' and inherent_likelihood is not null and inherent_impact is not null
group by organization_id, inherent_likelihood, inherent_impact;

grant select on public.erm_heatmap to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.erm_taxonomy_templates enable row level security;
alter table public.erm_categories enable row level security;
alter table public.erm_appetite enable row level security;
alter table public.erm_risks enable row level security;
alter table public.erm_risk_controls enable row level security;
alter table public.erm_treatments enable row level security;
alter table public.erm_kris enable row level security;
alter table public.erm_kri_readings enable row level security;
alter table public.erm_assessments enable row level security;
alter table public.erm_links enable row level security;

-- Reference data: read-only for authenticated.
drop policy if exists "erm_taxonomy_templates_select_authenticated" on public.erm_taxonomy_templates;
create policy "erm_taxonomy_templates_select_authenticated"
  on public.erm_taxonomy_templates for select to authenticated using (true);

-- Tenant tables: select/insert/update for org members, delete for owner/admin.
-- Generated in a loop to keep the policy shape identical across tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'erm_categories', 'erm_risks', 'erm_risk_controls', 'erm_treatments',
    'erm_kris', 'erm_kri_readings', 'erm_assessments', 'erm_links'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_tenant', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = public.current_user_org_id())',
      t || '_select_tenant', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert_tenant', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = public.current_user_org_id())',
      t || '_insert_tenant', t);

    execute format('drop policy if exists %I on public.%I', t || '_update_tenant', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = public.current_user_org_id()) with check (organization_id = public.current_user_org_id())',
      t || '_update_tenant', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete_admin', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = public.current_user_org_id() and public.current_user_role() in (''owner'', ''admin''))',
      t || '_delete_admin', t);
  end loop;
end $$;

-- erm_appetite: readable by members; writable by owner/admin only.
drop policy if exists "erm_appetite_select_tenant" on public.erm_appetite;
create policy "erm_appetite_select_tenant"
  on public.erm_appetite for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "erm_appetite_insert_admin" on public.erm_appetite;
create policy "erm_appetite_insert_admin"
  on public.erm_appetite for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  );

drop policy if exists "erm_appetite_update_admin" on public.erm_appetite;
create policy "erm_appetite_update_admin"
  on public.erm_appetite for update to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  );

drop policy if exists "erm_appetite_delete_admin" on public.erm_appetite;
create policy "erm_appetite_delete_admin"
  on public.erm_appetite for delete to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  );
