-- =============================================================================
-- AETHER Compliance Programs + Evidence
--   programs                 — a tenant's adoption of a framework (per workspace)
--   control_implementations  — one row per framework control per program
--   evidence                 — tenant evidence vault (files in the 'evidence'
--                              storage bucket, links, or notes)
--   evidence_links           — evidence <-> control implementation mapping
--   create_program()         — creates a program and seeds implementations
--   program_summary          — readiness roll-up view
--
-- Tenancy: programs + evidence are scoped on organization_id via
-- public.current_user_org_id(); child tables inherit through exists().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- programs
-- -----------------------------------------------------------------------------

create table if not exists public.programs (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  client_workspace_id  uuid references public.client_workspaces(id) on delete set null,
  framework_id         uuid not null references public.frameworks(id),
  name                 text not null,
  status               text not null default 'active',
  target_date          date,
  description          text,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint programs_status_check check (status in ('active', 'paused', 'completed', 'archived'))
);

comment on table public.programs is
  'A compliance program: an organization (optionally per client workspace) adopting one framework and tracking control implementation.';

create unique index if not exists programs_org_framework_workspace_uidx
  on public.programs (
    organization_id,
    framework_id,
    coalesce(client_workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists programs_org_idx on public.programs (organization_id, updated_at desc);

-- -----------------------------------------------------------------------------
-- control_implementations
-- -----------------------------------------------------------------------------

create table if not exists public.control_implementations (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid not null references public.programs(id) on delete cascade,
  control_id        uuid not null references public.controls(id) on delete cascade,
  status            text not null default 'not_started',
  owner_id          uuid references public.profiles(id) on delete set null,
  due_date          date,
  notes             text,
  na_justification  text,
  last_reviewed_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint control_implementations_status_check
    check (status in ('not_started', 'in_progress', 'implemented', 'not_applicable')),
  constraint control_implementations_program_control_unique unique (program_id, control_id)
);

comment on table public.control_implementations is
  'Per-program implementation status of each framework control.';

create index if not exists control_implementations_program_status_idx
  on public.control_implementations (program_id, status);
create index if not exists control_implementations_control_idx
  on public.control_implementations (control_id);

-- -----------------------------------------------------------------------------
-- evidence
-- -----------------------------------------------------------------------------

create table if not exists public.evidence (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  description      text,
  storage_path     text,                                  -- path within the 'evidence' bucket
  file_name        text,
  mime_type        text,
  size_bytes       bigint,
  source           text not null default 'upload',
  external_url     text,
  valid_from       date,
  valid_until      date,
  review_status    text not null default 'pending',
  reviewed_by      uuid references public.profiles(id) on delete set null,
  reviewed_at      timestamptz,
  uploaded_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint evidence_source_check check (source in ('upload', 'link', 'note')),
  constraint evidence_review_status_check check (review_status in ('pending', 'accepted', 'rejected'))
);

comment on table public.evidence is
  'Tenant evidence vault. Uploaded files live in the private ''evidence'' storage bucket under <organization_id>/.';

create index if not exists evidence_org_idx on public.evidence (organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- evidence_links
-- -----------------------------------------------------------------------------

create table if not exists public.evidence_links (
  evidence_id                uuid not null references public.evidence(id) on delete cascade,
  control_implementation_id  uuid not null references public.control_implementations(id) on delete cascade,
  created_at                 timestamptz not null default now(),
  primary key (evidence_id, control_implementation_id)
);

create index if not exists evidence_links_implementation_idx
  on public.evidence_links (control_implementation_id);

-- -----------------------------------------------------------------------------
-- updated_at triggers (public.set_updated_at() exists from the library migration)
-- -----------------------------------------------------------------------------

drop trigger if exists programs_set_updated_at on public.programs;
create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

drop trigger if exists control_implementations_set_updated_at on public.control_implementations;
create trigger control_implementations_set_updated_at
  before update on public.control_implementations
  for each row execute function public.set_updated_at();

drop trigger if exists evidence_set_updated_at on public.evidence;
create trigger evidence_set_updated_at
  before update on public.evidence
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- create_program(): insert program + seed one implementation per control
-- -----------------------------------------------------------------------------

create or replace function public.create_program(
  p_framework_id        uuid,
  p_name                text,
  p_client_workspace_id uuid default null,
  p_target_date         date default null,
  p_description         text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id     uuid;
  v_program_id uuid;
begin
  v_org_id := public.current_user_org_id();
  if v_org_id is null then
    raise exception 'Current user is not linked to an organization';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Program name is required';
  end if;

  if not exists (select 1 from public.frameworks f where f.id = p_framework_id) then
    raise exception 'Unknown framework %', p_framework_id;
  end if;

  insert into public.programs (
    organization_id, client_workspace_id, framework_id, name,
    target_date, description, created_by
  )
  values (
    v_org_id, p_client_workspace_id, p_framework_id, trim(p_name),
    p_target_date, p_description, auth.uid()
  )
  returning id into v_program_id;

  insert into public.control_implementations (program_id, control_id, status)
  select v_program_id, c.id, 'not_started'
  from public.controls c
  where c.framework_id = p_framework_id
  on conflict (program_id, control_id) do nothing;

  return v_program_id;
end;
$$;

revoke all on function public.create_program(uuid, text, uuid, date, text) from public;
grant execute on function public.create_program(uuid, text, uuid, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.programs enable row level security;
alter table public.control_implementations enable row level security;
alter table public.evidence enable row level security;
alter table public.evidence_links enable row level security;

-- programs

drop policy if exists "programs_select_tenant" on public.programs;
create policy "programs_select_tenant"
  on public.programs
  for select
  to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "programs_insert_tenant" on public.programs;
create policy "programs_insert_tenant"
  on public.programs
  for insert
  to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and (created_by is null or created_by = (select auth.uid()))
  );

drop policy if exists "programs_update_tenant" on public.programs;
create policy "programs_update_tenant"
  on public.programs
  for update
  to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "programs_delete_admin" on public.programs;
create policy "programs_delete_admin"
  on public.programs
  for delete
  to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  );

-- control_implementations (inherit tenancy from the program)

drop policy if exists "ci_select_tenant" on public.control_implementations;
create policy "ci_select_tenant"
  on public.control_implementations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and p.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "ci_insert_tenant" on public.control_implementations;
create policy "ci_insert_tenant"
  on public.control_implementations
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and p.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "ci_update_tenant" on public.control_implementations;
create policy "ci_update_tenant"
  on public.control_implementations
  for update
  to authenticated
  using (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and p.organization_id = public.current_user_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and p.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "ci_delete_tenant" on public.control_implementations;
create policy "ci_delete_tenant"
  on public.control_implementations
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and p.organization_id = public.current_user_org_id()
    )
  );

-- evidence

drop policy if exists "evidence_select_tenant" on public.evidence;
create policy "evidence_select_tenant"
  on public.evidence
  for select
  to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "evidence_insert_tenant" on public.evidence;
create policy "evidence_insert_tenant"
  on public.evidence
  for insert
  to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and (uploaded_by is null or uploaded_by = (select auth.uid()))
  );

drop policy if exists "evidence_update_tenant" on public.evidence;
create policy "evidence_update_tenant"
  on public.evidence
  for update
  to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "evidence_delete_admin" on public.evidence;
create policy "evidence_delete_admin"
  on public.evidence
  for delete
  to authenticated
  using (
    organization_id = public.current_user_org_id()
    and public.current_user_role() in ('owner', 'admin')
  );

-- evidence_links (both sides must belong to the tenant)

drop policy if exists "evidence_links_select_tenant" on public.evidence_links;
create policy "evidence_links_select_tenant"
  on public.evidence_links
  for select
  to authenticated
  using (
    exists (
      select 1 from public.evidence e
      where e.id = evidence_id
        and e.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "evidence_links_insert_tenant" on public.evidence_links;
create policy "evidence_links_insert_tenant"
  on public.evidence_links
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.evidence e
      where e.id = evidence_id
        and e.organization_id = public.current_user_org_id()
    )
    and exists (
      select 1
      from public.control_implementations ci
      join public.programs p on p.id = ci.program_id
      where ci.id = control_implementation_id
        and p.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "evidence_links_delete_tenant" on public.evidence_links;
create policy "evidence_links_delete_tenant"
  on public.evidence_links
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.evidence e
      where e.id = evidence_id
        and e.organization_id = public.current_user_org_id()
    )
  );

-- -----------------------------------------------------------------------------
-- program_summary view
-- -----------------------------------------------------------------------------

create or replace view public.program_summary
with (security_invoker = true) as
select
  p.id,
  p.organization_id,
  p.client_workspace_id,
  p.framework_id,
  p.name,
  p.status,
  p.target_date,
  p.description,
  p.created_by,
  p.created_at,
  p.updated_at,
  f.code                                                                   as framework_code,
  f.short_name                                                             as framework_short_name,
  f.name_en                                                                as framework_name_en,
  f.jurisdiction                                                           as framework_jurisdiction,
  count(ci.id)::integer                                                    as total_controls,
  count(ci.id) filter (where ci.status = 'implemented')::integer           as implemented,
  count(ci.id) filter (where ci.status = 'in_progress')::integer           as in_progress,
  count(ci.id) filter (where ci.status = 'not_started')::integer           as not_started,
  count(ci.id) filter (where ci.status = 'not_applicable')::integer        as not_applicable,
  round(
    100.0 * count(ci.id) filter (where ci.status = 'implemented')
    / nullif(
        count(ci.id) - count(ci.id) filter (where ci.status = 'not_applicable'),
        0
      )
  )::integer                                                               as readiness_pct
from public.programs p
join public.frameworks f on f.id = p.framework_id
left join public.control_implementations ci on ci.program_id = p.id
group by p.id, f.id;

grant select on public.program_summary to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: private 'evidence' bucket, objects keyed by <organization_id>/...
-- No-ops when the storage schema is absent (e.g. plain Postgres in CI).
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (
       select 1 from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'storage' and c.relname = 'buckets'
     )
  then
    execute $sql$
      insert into storage.buckets (id, name, public)
      values ('evidence', 'evidence', false)
      on conflict (id) do nothing
    $sql$;

    execute 'drop policy if exists "evidence_objects_select_tenant" on storage.objects';
    execute $sql$
      create policy "evidence_objects_select_tenant"
        on storage.objects
        for select
        to authenticated
        using (
          bucket_id = 'evidence'
          and (storage.foldername(name))[1] = public.current_user_org_id()::text
        )
    $sql$;

    execute 'drop policy if exists "evidence_objects_insert_tenant" on storage.objects';
    execute $sql$
      create policy "evidence_objects_insert_tenant"
        on storage.objects
        for insert
        to authenticated
        with check (
          bucket_id = 'evidence'
          and (storage.foldername(name))[1] = public.current_user_org_id()::text
        )
    $sql$;

    execute 'drop policy if exists "evidence_objects_update_tenant" on storage.objects';
    execute $sql$
      create policy "evidence_objects_update_tenant"
        on storage.objects
        for update
        to authenticated
        using (
          bucket_id = 'evidence'
          and (storage.foldername(name))[1] = public.current_user_org_id()::text
        )
        with check (
          bucket_id = 'evidence'
          and (storage.foldername(name))[1] = public.current_user_org_id()::text
        )
    $sql$;

    execute 'drop policy if exists "evidence_objects_delete_tenant" on storage.objects';
    execute $sql$
      create policy "evidence_objects_delete_tenant"
        on storage.objects
        for delete
        to authenticated
        using (
          bucket_id = 'evidence'
          and (storage.foldername(name))[1] = public.current_user_org_id()::text
        )
    $sql$;
  end if;
end
$$;
