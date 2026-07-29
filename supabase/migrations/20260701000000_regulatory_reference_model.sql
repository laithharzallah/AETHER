-- =============================================================================
-- AETHER.ai regulatory reference model
--
-- Global, tenant-independent catalogue of the frameworks AETHER reasons about:
-- the frameworks themselves, their domain structure, their individual controls,
-- and the crosswalks between them.
--
-- The crosswalk graph is what lets one piece of evidence satisfy a control in
-- SAMA CSF, NCA ECC and ISO 27001 simultaneously, and what turns a single
-- regulatory signal into a precise list of affected controls per tenant.
--
-- Reference data is readable by every authenticated user and writable only by
-- the service role.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- frameworks
-- -----------------------------------------------------------------------------

create table if not exists public.frameworks (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  name                text not null,
  name_ar             text,
  short_name          text,
  regulator           text not null,
  regulator_code      text,
  jurisdiction        text not null,
  category            text not null,
  version             text,
  effective_date      date,
  mandatory           boolean not null default false,
  applies_to_sectors  text[] not null default '{}',
  applies_to_entities text,
  description         text,
  authority_url       text,
  citation            text,
  -- How much of this framework is encoded below. Set honestly so the UI can
  -- distinguish a complete control catalogue from a structural outline.
  catalogue_depth     text not null default 'domain',
  control_count       integer,
  maturity_model      jsonb,
  language            text not null default 'en',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

comment on table public.frameworks is
  'Regulatory and standards frameworks AETHER maps against. catalogue_depth records whether we hold the full control text, control titles, or only the domain outline.';
comment on column public.frameworks.catalogue_depth is
  'domain = domain/subdomain outline only; control = individual controls enumerated; full = controls with requirement text.';
comment on column public.frameworks.jurisdiction is
  'ISO 3166-1 alpha-2 country code, a supranational code (EU), an emirate free-zone code (AE-DIFC), or GLOBAL.';

do $$ begin
  alter table public.frameworks add constraint frameworks_category_check
    check (category in (
      'cybersecurity', 'privacy', 'ai_governance', 'financial_services',
      'cloud', 'operational_technology', 'business_continuity',
      'payments', 'sector_specific', 'assurance'
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.frameworks add constraint frameworks_catalogue_depth_check
    check (catalogue_depth in ('domain', 'control', 'full'));
exception when duplicate_object then null; end $$;

create index if not exists frameworks_jurisdiction_idx on public.frameworks (jurisdiction);
create index if not exists frameworks_category_idx on public.frameworks (category);

-- -----------------------------------------------------------------------------
-- framework_domains — the domain / subdomain tree inside a framework
-- -----------------------------------------------------------------------------

create table if not exists public.framework_domains (
  id            uuid primary key default gen_random_uuid(),
  framework_id  uuid not null references public.frameworks (id) on delete cascade,
  parent_id     uuid references public.framework_domains (id) on delete cascade,
  code          text not null,
  title         text not null,
  title_ar      text,
  description   text,
  ordinal       integer not null default 0,
  created_at    timestamptz default now(),
  unique (framework_id, code)
);

create index if not exists framework_domains_framework_id_idx
  on public.framework_domains (framework_id);
create index if not exists framework_domains_parent_id_idx
  on public.framework_domains (parent_id);

-- -----------------------------------------------------------------------------
-- framework_controls — the individual, citable requirements
-- -----------------------------------------------------------------------------

create table if not exists public.framework_controls (
  id                uuid primary key default gen_random_uuid(),
  framework_id      uuid not null references public.frameworks (id) on delete cascade,
  domain_id         uuid references public.framework_domains (id) on delete set null,
  code              text not null,
  title             text not null,
  title_ar          text,
  objective         text,
  requirement_text  text,
  control_type      text,
  control_nature    text[] not null default '{}',
  applies_when      text,
  evidence_examples text[] not null default '{}',
  tags              text[] not null default '{}',
  ordinal           integer not null default 0,
  created_at        timestamptz default now(),
  unique (framework_id, code)
);

comment on column public.framework_controls.control_nature is
  'preventive / detective / corrective / directive — a control can be several.';
comment on column public.framework_controls.control_type is
  'technical / administrative / physical / governance.';

do $$ begin
  alter table public.framework_controls add constraint framework_controls_type_check
    check (control_type is null or control_type in (
      'technical', 'administrative', 'physical', 'governance', 'legal'
    ));
exception when duplicate_object then null; end $$;

create index if not exists framework_controls_framework_id_idx
  on public.framework_controls (framework_id);
create index if not exists framework_controls_domain_id_idx
  on public.framework_controls (domain_id);
create index if not exists framework_controls_tags_idx
  on public.framework_controls using gin (tags);

-- -----------------------------------------------------------------------------
-- control_crosswalks — the mapping graph between frameworks
--
-- Directed edges. `equivalent` edges are inserted in both directions by the
-- seed so traversal is symmetric; `informs` edges are intentionally one-way.
-- -----------------------------------------------------------------------------

create table if not exists public.control_crosswalks (
  id                 uuid primary key default gen_random_uuid(),
  source_control_id  uuid not null references public.framework_controls (id) on delete cascade,
  target_control_id  uuid not null references public.framework_controls (id) on delete cascade,
  relationship       text not null default 'partial',
  confidence         numeric(3, 2) not null default 0.75,
  rationale          text,
  created_at         timestamptz default now(),
  unique (source_control_id, target_control_id),
  check (source_control_id <> target_control_id),
  check (confidence >= 0 and confidence <= 1)
);

do $$ begin
  alter table public.control_crosswalks add constraint control_crosswalks_relationship_check
    check (relationship in ('equivalent', 'partial', 'informs', 'superset', 'subset'));
exception when duplicate_object then null; end $$;

create index if not exists control_crosswalks_source_idx
  on public.control_crosswalks (source_control_id);
create index if not exists control_crosswalks_target_idx
  on public.control_crosswalks (target_control_id);

-- -----------------------------------------------------------------------------
-- obligation_templates — recurring regulatory duties with a cadence
--
-- Instantiated per tenant at provisioning time to build the compliance calendar.
-- -----------------------------------------------------------------------------

create table if not exists public.obligation_templates (
  id                 uuid primary key default gen_random_uuid(),
  framework_id       uuid not null references public.frameworks (id) on delete cascade,
  control_code       text,
  code               text not null unique,
  title              text not null,
  description        text,
  cadence            text not null,
  cadence_detail     text,
  lead_time_days     integer not null default 30,
  severity           text not null default 'medium',
  evidence_required  text[] not null default '{}',
  responsible_role   text,
  applies_to_sectors text[] not null default '{}',
  citation           text,
  created_at         timestamptz default now()
);

do $$ begin
  alter table public.obligation_templates add constraint obligation_templates_cadence_check
    check (cadence in (
      'continuous', 'monthly', 'quarterly', 'semiannual', 'annual',
      'biennial', 'triennial', 'event_driven', 'one_time'
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.obligation_templates add constraint obligation_templates_severity_check
    check (severity in ('low', 'medium', 'high', 'critical'));
exception when duplicate_object then null; end $$;

create index if not exists obligation_templates_framework_id_idx
  on public.obligation_templates (framework_id);

-- -----------------------------------------------------------------------------
-- policy_templates — the skeleton the policy generator builds on
-- -----------------------------------------------------------------------------

create table if not exists public.policy_templates (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  title              text not null,
  category           text not null default 'security',
  description        text,
  framework_codes    text[] not null default '{}',
  required_sections  jsonb not null default '[]'::jsonb,
  control_codes      text[] not null default '{}',
  applies_to_sectors text[] not null default '{}',
  review_cadence     text not null default 'annual',
  approver_role      text default 'owner',
  created_at         timestamptz default now()
);

comment on column public.policy_templates.required_sections is
  'Ordered array of {heading, guidance} objects. Drives both the generator prompt and completeness scoring of an uploaded policy.';

-- -----------------------------------------------------------------------------
-- risk_taxonomy — a shared vocabulary for the risk register
-- -----------------------------------------------------------------------------

create table if not exists public.risk_taxonomy (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  category          text not null,
  name              text not null,
  description       text,
  typical_causes    text[] not null default '{}',
  typical_impacts   text[] not null default '{}',
  related_frameworks text[] not null default '{}',
  default_likelihood integer,
  default_impact     integer,
  created_at        timestamptz default now(),
  check (default_likelihood is null or default_likelihood between 1 and 5),
  check (default_impact is null or default_impact between 1 and 5)
);

-- -----------------------------------------------------------------------------
-- ai_classification_rules — EU AI Act / SDAIA risk tiering
--
-- Encoded as data rather than code so the tiering logic is auditable and can be
-- updated without a deploy.
-- -----------------------------------------------------------------------------

create table if not exists public.ai_classification_rules (
  id            uuid primary key default gen_random_uuid(),
  framework_id  uuid references public.frameworks (id) on delete cascade,
  code          text not null unique,
  regime        text not null,
  risk_tier     text not null,
  title         text not null,
  description   text,
  citation      text,
  -- Matched against an ai_systems row: any of match_keywords appearing in the
  -- purpose/context, plus every flag in required_flags being true.
  match_keywords text[] not null default '{}',
  required_flags text[] not null default '{}',
  obligations    text[] not null default '{}',
  ordinal        integer not null default 0,
  created_at     timestamptz default now()
);

do $$ begin
  alter table public.ai_classification_rules add constraint ai_classification_rules_tier_check
    check (risk_tier in ('prohibited', 'high', 'limited', 'minimal', 'gpai', 'gpai_systemic'));
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Convenience view: a control with its framework and domain resolved
-- -----------------------------------------------------------------------------

create or replace view public.framework_controls_expanded as
select
  fc.id,
  fc.code                as control_code,
  fc.title               as control_title,
  fc.objective,
  fc.requirement_text,
  fc.control_type,
  fc.control_nature,
  fc.tags,
  fc.ordinal,
  f.id                   as framework_id,
  f.code                 as framework_code,
  f.name                 as framework_name,
  f.regulator,
  f.jurisdiction,
  f.category             as framework_category,
  f.mandatory,
  d.id                   as domain_id,
  d.code                 as domain_code,
  d.title                as domain_title,
  parent.code            as parent_domain_code,
  parent.title           as parent_domain_title
from public.framework_controls fc
join public.frameworks f on f.id = fc.framework_id
left join public.framework_domains d on d.id = fc.domain_id
left join public.framework_domains parent on parent.id = d.parent_id;

comment on view public.framework_controls_expanded is
  'Denormalised control lookup used by the policy generator, the crosswalk explorer and the Machine correlation phase.';

-- -----------------------------------------------------------------------------
-- Crosswalk traversal: every control reachable from a starting control
-- -----------------------------------------------------------------------------

create or replace function public.related_controls(
  p_control_id uuid,
  p_max_depth  integer default 2,
  p_min_confidence numeric default 0.5
)
returns table (
  control_id     uuid,
  framework_code text,
  control_code   text,
  control_title  text,
  depth          integer,
  path_confidence numeric
)
language sql
stable
set search_path = ''
as $$
  with recursive walk as (
    select
      cw.target_control_id       as control_id,
      1                          as depth,
      cw.confidence::numeric     as path_confidence
    from public.control_crosswalks cw
    where cw.source_control_id = p_control_id
      and cw.confidence >= p_min_confidence

    union all

    select
      cw.target_control_id,
      w.depth + 1,
      w.path_confidence * cw.confidence
    from walk w
    join public.control_crosswalks cw on cw.source_control_id = w.control_id
    where w.depth < p_max_depth
      and cw.confidence >= p_min_confidence
      and cw.target_control_id <> p_control_id
  )
  select
    w.control_id,
    f.code,
    fc.code,
    fc.title,
    min(w.depth)::integer,
    max(w.path_confidence)::numeric
  from walk w
  join public.framework_controls fc on fc.id = w.control_id
  join public.frameworks f on f.id = fc.framework_id
  group by w.control_id, f.code, fc.code, fc.title
  order by max(w.path_confidence) desc, min(w.depth);
$$;

comment on function public.related_controls is
  'Walks the crosswalk graph from one control, multiplying edge confidence along each path. Used to expand a single cited control into every equivalent obligation a tenant holds.';

-- -----------------------------------------------------------------------------
-- RLS — reference data is world-readable to signed-in users, service-role write
-- -----------------------------------------------------------------------------

alter table public.frameworks              enable row level security;
alter table public.framework_domains       enable row level security;
alter table public.framework_controls      enable row level security;
alter table public.control_crosswalks      enable row level security;
alter table public.obligation_templates    enable row level security;
alter table public.policy_templates        enable row level security;
alter table public.risk_taxonomy           enable row level security;
alter table public.ai_classification_rules enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'frameworks', 'framework_domains', 'framework_controls', 'control_crosswalks',
    'obligation_templates', 'policy_templates', 'risk_taxonomy',
    'ai_classification_rules'
  ]
  loop
    begin
      execute format(
        'create policy %I on public.%I for select to authenticated using (true)',
        t || '_select_authenticated', t
      );
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

do $trg$ begin perform public.ensure_updated_at_trigger('public.frameworks'); end $trg$;
