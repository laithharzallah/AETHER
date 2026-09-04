-- =============================================================================
-- AETHER Regulatory Library
--   frameworks               — global catalogue of regulations / standards
--   controls                 — control-level requirements (EN/AR) per framework
--   policies                 — tenant-owned generated policies (persistence)
--   policy_control_mappings  — which controls a policy claims to address
--
-- frameworks + controls are shared reference data: readable by every
-- authenticated user, writable only via the service role (seed migrations).
-- policies + mappings are tenant-scoped via current_user_org_id().
-- =============================================================================

create extension if not exists pg_trgm;

-- -----------------------------------------------------------------------------
-- frameworks
-- -----------------------------------------------------------------------------

create table if not exists public.frameworks (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,                 -- e.g. 'NCA-ECC'
  name_en        text not null,
  name_ar        text,
  short_name     text not null,                        -- e.g. 'NCA ECC'
  regulator_en   text not null,
  regulator_ar   text,
  jurisdiction   text not null,                        -- ISO-3166 alpha-2 or 'INTL' / 'EU'
  category       text not null,                        -- cybersecurity | data-protection | ai-governance | technology-risk | information-security
  version        text,
  effective_date date,
  source_url     text,
  description_en text,
  description_ar text,
  mandatory      boolean not null default false,       -- legally binding for in-scope entities
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.frameworks is
  'Global catalogue of regulatory frameworks and standards covered by AETHER.';

-- -----------------------------------------------------------------------------
-- controls
-- -----------------------------------------------------------------------------

create table if not exists public.controls (
  id             uuid primary key default gen_random_uuid(),
  framework_id   uuid not null references public.frameworks(id) on delete cascade,
  control_ref    text not null,                        -- e.g. '2-3-1', 'A.8.16', 'PR.AA-01', 'Art. 12'
  domain_en      text,
  domain_ar      text,
  subdomain_en   text,
  subdomain_ar   text,
  title_en       text not null,
  title_ar       text,
  requirement_en text not null,
  requirement_ar text,
  evidence_en    text,                                 -- what an assessor expects to see
  control_type   text,                                 -- governance | preventive | detective | corrective
  criticality    text,                                 -- high | medium | low
  fidelity       text not null default 'paraphrased',  -- structural | paraphrased | summarized
  verified       boolean not null default false,       -- reviewed against the primary source
  verified_by    text,                                 -- named human reviewer who signed off
  verified_at    date,                                 -- date that reviewer signed off
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  search_text    text generated always as (
    coalesce(control_ref, '') || ' ' ||
    coalesce(title_en, '') || ' ' ||
    coalesce(title_ar, '') || ' ' ||
    coalesce(requirement_en, '') || ' ' ||
    coalesce(requirement_ar, '') || ' ' ||
    coalesce(domain_en, '') || ' ' ||
    coalesce(subdomain_en, '')
  ) stored,
  constraint controls_framework_ref_unique unique (framework_id, control_ref),
  constraint controls_fidelity_check check (fidelity in ('structural', 'paraphrased', 'summarized')),
  constraint controls_type_check check (control_type is null or control_type in ('governance', 'preventive', 'detective', 'corrective')),
  constraint controls_criticality_check check (criticality is null or criticality in ('high', 'medium', 'low')),
  constraint controls_verified_requires_reviewer check (verified = false or verified_by is not null)
);

comment on table public.controls is
  'Control-level requirements for each framework. fidelity indicates how closely requirement text follows the source; verified marks human review against the primary document.';

create index if not exists controls_framework_id_idx on public.controls (framework_id, sort_order);
create index if not exists controls_search_trgm_idx on public.controls using gin (search_text gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- policies (tenant-owned)
-- -----------------------------------------------------------------------------

create table if not exists public.policies (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  client_workspace_id  uuid references public.client_workspaces(id) on delete set null,
  title                text not null,
  policy_type          text not null,
  frameworks           text[] not null default '{}',   -- framework codes at generation time
  org_context          text,
  content_md           text not null,
  status               text not null default 'draft',
  version              integer not null default 1,
  model                text,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint policies_status_check check (status in ('draft', 'in_review', 'approved', 'archived'))
);

comment on table public.policies is
  'Generated and uploaded policies, scoped to the owning organization.';

create index if not exists policies_org_idx on public.policies (organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- policy_control_mappings
-- -----------------------------------------------------------------------------

create table if not exists public.policy_control_mappings (
  policy_id   uuid not null references public.policies(id) on delete cascade,
  control_id  uuid not null references public.controls(id) on delete cascade,
  coverage    text not null default 'addresses',       -- addresses | partial | references
  created_at  timestamptz not null default now(),
  primary key (policy_id, control_id),
  constraint policy_control_mappings_coverage_check check (coverage in ('addresses', 'partial', 'references'))
);

create index if not exists policy_control_mappings_control_idx on public.policy_control_mappings (control_id);

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists frameworks_set_updated_at on public.frameworks;
create trigger frameworks_set_updated_at
  before update on public.frameworks
  for each row execute function public.set_updated_at();

drop trigger if exists controls_set_updated_at on public.controls;
create trigger controls_set_updated_at
  before update on public.controls
  for each row execute function public.set_updated_at();

drop trigger if exists policies_set_updated_at on public.policies;
create trigger policies_set_updated_at
  before update on public.policies
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.frameworks enable row level security;
alter table public.controls enable row level security;
alter table public.policies enable row level security;
alter table public.policy_control_mappings enable row level security;

-- Reference data: read for all authenticated users. No write policies —
-- only the service role (seed migrations / admin tooling) may modify.

drop policy if exists "frameworks_select_authenticated" on public.frameworks;
create policy "frameworks_select_authenticated"
  on public.frameworks
  for select
  to authenticated
  using (true);

drop policy if exists "controls_select_authenticated" on public.controls;
create policy "controls_select_authenticated"
  on public.controls
  for select
  to authenticated
  using (true);

-- Tenant data

drop policy if exists "policies_select_tenant" on public.policies;
create policy "policies_select_tenant"
  on public.policies
  for select
  to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "policies_insert_tenant" on public.policies;
create policy "policies_insert_tenant"
  on public.policies
  for insert
  to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and (created_by is null or created_by = (select auth.uid()))
  );

drop policy if exists "policies_update_tenant" on public.policies;
create policy "policies_update_tenant"
  on public.policies
  for update
  to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "policies_delete_admin" on public.policies;
create policy "policies_delete_admin"
  on public.policies
  for delete
  to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  );

-- Mappings inherit tenancy from the parent policy.

drop policy if exists "pcm_select_tenant" on public.policy_control_mappings;
create policy "pcm_select_tenant"
  on public.policy_control_mappings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.policies p
      where p.id = policy_id
        and p.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "pcm_insert_tenant" on public.policy_control_mappings;
create policy "pcm_insert_tenant"
  on public.policy_control_mappings
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.policies p
      where p.id = policy_id
        and p.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "pcm_delete_tenant" on public.policy_control_mappings;
create policy "pcm_delete_tenant"
  on public.policy_control_mappings
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.policies p
      where p.id = policy_id
        and p.organization_id = public.current_user_org_id()
    )
  );

-- -----------------------------------------------------------------------------
-- Convenience view: framework catalogue with control counts
-- -----------------------------------------------------------------------------

create or replace view public.framework_summary
with (security_invoker = true) as
select
  f.id,
  f.code,
  f.short_name,
  f.name_en,
  f.name_ar,
  f.regulator_en,
  f.regulator_ar,
  f.jurisdiction,
  f.category,
  f.version,
  f.effective_date,
  f.source_url,
  f.description_en,
  f.description_ar,
  f.mandatory,
  f.sort_order,
  count(c.id)::integer                                   as control_count,
  count(c.id) filter (where c.verified)::integer         as verified_count,
  count(distinct c.domain_en)::integer                   as domain_count
from public.frameworks f
left join public.controls c on c.framework_id = f.id
group by f.id;

grant select on public.framework_summary to authenticated;
