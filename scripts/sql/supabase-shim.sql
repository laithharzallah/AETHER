-- =============================================================================
-- Minimal stand-in for the pieces of a Supabase project that plain Postgres
-- does not provide. Used only by scripts/verify-migrations.sh — never applied
-- to a real Supabase database, which supplies all of this itself.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Roles that Supabase creates for the PostgREST connection pool
-- -----------------------------------------------------------------------------

do $$ begin
  create role anon nologin noinherit;
exception when duplicate_object then null; end $$;

do $$ begin
  create role authenticated nologin noinherit;
exception when duplicate_object then null; end $$;

do $$ begin
  create role service_role nologin noinherit bypassrls;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- auth schema
-- -----------------------------------------------------------------------------

create schema if not exists auth;

create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);

-- Supabase derives auth.uid() from the request JWT. For local verification the
-- value is taken from a session GUC so tests can impersonate a user with
--   set local request.jwt.claim.sub = '<uuid>';
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
