-- =============================================================================
-- AETHER.ai baseline core schema
--
-- The original core tables were created out-of-band (Supabase Studio) and were
-- never captured as a migration, so a fresh project could not be provisioned
-- and `supabase db reset` had nothing to build on. This migration reconstructs
-- them.
--
-- Every statement is idempotent so the migration is a no-op against the
-- existing production database. Because it is timestamped *before* the already
-- applied RLS migration, push it with:
--
--   supabase db push --include-all
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Hex SHA-256 over text. Uses the built-in pg_catalog.sha256 (Postgres 11+)
-- rather than pgcrypto's digest(), because pgcrypto lives in `extensions` on
-- Supabase but `public` on a stock install, and a hardened search_path would
-- resolve neither.
create or replace function public.sha256_hex(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(coalesce(input, ''), 'UTF8')),
    'hex'
  )
$$;

-- Attaches an updated_at trigger without failing if it is already present.
create or replace function public.ensure_updated_at_trigger(target regclass)
returns void
language plpgsql
as $$
declare
  trigger_name text;
begin
  select 'set_updated_at_' || relname into trigger_name
  from pg_class
  where oid = target;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = target and tgname = trigger_name and not tgisinternal
  ) then
    execute format(
      'create trigger %I before update on %s for each row execute function public.set_updated_at()',
      trigger_name,
      target::text
    );
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- organizations — the tenant root
-- -----------------------------------------------------------------------------

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  type        text not null,
  country     text,
  industry    text,
  size        text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

comment on table public.organizations is
  'Tenant root. type distinguishes a consulting firm (manages client workspaces) from a direct enterprise.';

do $$ begin
  alter table public.organizations
    add constraint organizations_type_check
    check (type in ('consulting_firm', 'enterprise', 'regulator', 'internal'));
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- profiles — one row per auth user, carries the tenant binding
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  email           text,
  full_name       text,
  role            text not null default 'member',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

comment on table public.profiles is
  'profiles.id = auth.uid(). profiles.organization_id is the tenant key used by every RLS policy.';

do $$ begin
  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('owner', 'admin', 'analyst', 'member', 'auditor'));
exception when duplicate_object then null; end $$;

create index if not exists profiles_organization_id_idx on public.profiles (organization_id);

-- -----------------------------------------------------------------------------
-- client_workspaces — a consulting firm's individual client engagements
-- -----------------------------------------------------------------------------

create table if not exists public.client_workspaces (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  name                  text not null,
  country               text,
  industry              text,
  applicable_frameworks text[] default '{}',
  risk_profile          jsonb,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index if not exists client_workspaces_organization_id_idx
  on public.client_workspaces (organization_id);

-- -----------------------------------------------------------------------------
-- modules / organization_modules — per-tenant feature entitlement
-- -----------------------------------------------------------------------------

create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  status      text default 'available',
  created_at  timestamptz default now()
);

create table if not exists public.organization_modules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  module_id       uuid not null references public.modules (id) on delete cascade,
  enabled         boolean default true,
  created_at      timestamptz default now()
);

do $$ begin
  alter table public.organization_modules
    add constraint organization_modules_org_module_key
    unique (organization_id, module_id);
exception when duplicate_object then null; end $$;

create index if not exists organization_modules_organization_id_idx
  on public.organization_modules (organization_id);

-- -----------------------------------------------------------------------------
-- intelligence_sources / intelligence_items — regulatory intake
-- -----------------------------------------------------------------------------

create table if not exists public.intelligence_sources (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            text not null,
  url             text,
  country         text,
  active          boolean default true,
  last_checked_at timestamptz,
  created_at      timestamptz default now()
);

create table if not exists public.intelligence_items (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references public.intelligence_sources (id) on delete set null,
  title        text not null,
  url          text,
  content      text,
  language     text default 'en',
  published_at timestamptz,
  status       text default 'new',
  created_at   timestamptz default now()
);

create index if not exists intelligence_items_source_id_idx
  on public.intelligence_items (source_id);
create index if not exists intelligence_items_published_at_idx
  on public.intelligence_items (published_at desc);

-- -----------------------------------------------------------------------------
-- risk_signals — analyzed, actionable output of the intake pipeline
-- -----------------------------------------------------------------------------

create table if not exists public.risk_signals (
  id                    uuid primary key default gen_random_uuid(),
  intelligence_item_id  uuid references public.intelligence_items (id) on delete cascade,
  category              text not null,
  severity              text default 'medium',
  summary               text not null,
  impact_analysis       text,
  recommended_action    text,
  countries             text[] default '{}',
  sectors               text[] default '{}',
  frameworks_affected   text[] default '{}',
  reviewed              boolean default false,
  reviewed_by           uuid references public.profiles (id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz default now()
);

create index if not exists risk_signals_intelligence_item_id_idx
  on public.risk_signals (intelligence_item_id);
create index if not exists risk_signals_created_at_idx
  on public.risk_signals (created_at desc);

-- -----------------------------------------------------------------------------
-- briefs — periodic board / client reporting packs
-- -----------------------------------------------------------------------------

create table if not exists public.briefs (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  client_workspace_id uuid references public.client_workspaces (id) on delete cascade,
  title               text not null,
  content             jsonb,
  period_start        date,
  period_end          date,
  status              text default 'draft',
  sent_at             timestamptz,
  created_at          timestamptz default now()
);

create index if not exists briefs_organization_id_idx on public.briefs (organization_id);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

do $trg$ begin perform public.ensure_updated_at_trigger('public.organizations'); end $trg$;
do $trg$ begin perform public.ensure_updated_at_trigger('public.profiles'); end $trg$;
do $trg$ begin perform public.ensure_updated_at_trigger('public.client_workspaces'); end $trg$;

-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- The original policy migration created policies but never enabled RLS, which
-- left every table readable by any authenticated user. Enable it here so the
-- policies that follow are actually enforced.
-- -----------------------------------------------------------------------------

alter table public.organizations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.client_workspaces    enable row level security;
alter table public.modules              enable row level security;
alter table public.organization_modules enable row level security;
alter table public.intelligence_sources enable row level security;
alter table public.intelligence_items   enable row level security;
alter table public.risk_signals         enable row level security;
alter table public.briefs               enable row level security;

-- Reference/shared tables are readable by any signed-in user; writes stay with
-- the service role, which bypasses RLS entirely.
do $$ begin
  create policy "modules_select_authenticated"
    on public.modules for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "intelligence_sources_select_authenticated"
    on public.intelligence_sources for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "intelligence_items_select_authenticated"
    on public.intelligence_items for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "risk_signals_select_authenticated"
    on public.risk_signals for select to authenticated using (true);
exception when duplicate_object then null; end $$;
