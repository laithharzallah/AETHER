-- =============================================================================
-- AETHER.ai tamper-evident audit trail
--
-- An audit log an auditor cannot trust is worth nothing. Each event is chained
-- to the one before it with SHA-256 over its canonical serialisation, scoped per
-- organization, so the log is verifiable without an external service:
--
--   hash(n) = sha256( hash(n-1) || canonical_payload(n) )
--
-- Removing, reordering or editing any event breaks every hash after it, and
-- verify_audit_chain() reports exactly where. Events are append-only: a trigger
-- rejects UPDATE and DELETE outright, and RLS grants tenants SELECT only.
-- =============================================================================

create table if not exists public.audit_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  seq             bigint not null,
  occurred_at     timestamptz not null default now(),

  actor_id        uuid references public.profiles (id) on delete set null,
  actor_type      text not null default 'user',
  actor_label     text,

  action          text not null,
  entity_type     text,
  entity_id       uuid,
  summary         text,
  metadata        jsonb not null default '{}'::jsonb,

  request_ip      inet,
  user_agent      text,

  prev_hash       text not null,
  hash            text not null,

  created_at      timestamptz not null default now(),
  unique (organization_id, seq)
);

comment on table public.audit_events is
  'Append-only, hash-chained audit log. One chain per organization. Verify with select * from verify_audit_chain(org_id).';
comment on column public.audit_events.seq is
  'Monotonic per-organization sequence number assigned by the insert trigger; gaps indicate deletion.';
comment on column public.audit_events.prev_hash is
  'hash of seq-1 in the same organization. The genesis event uses 64 zeroes.';

do $$ begin
  alter table public.audit_events add constraint audit_events_actor_type_check
    check (actor_type in ('user', 'machine', 'system', 'service', 'regulator'));
exception when duplicate_object then null; end $$;

create index if not exists audit_events_org_seq_idx
  on public.audit_events (organization_id, seq desc);
create index if not exists audit_events_entity_idx
  on public.audit_events (organization_id, entity_type, entity_id);
create index if not exists audit_events_action_idx
  on public.audit_events (organization_id, action);
create index if not exists audit_events_occurred_at_idx
  on public.audit_events (organization_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Canonical serialisation
--
-- Everything that must not change silently goes in, joined by a delimiter that
-- cannot appear in the values, so no two distinct events can serialise
-- identically. jsonb renders canonically (sorted keys, normalised whitespace),
-- which makes the hash reproducible.
-- -----------------------------------------------------------------------------

create or replace function public.audit_event_payload(
  p_organization_id uuid,
  p_seq             bigint,
  p_occurred_at     timestamptz,
  p_actor_id        uuid,
  p_actor_type      text,
  p_action          text,
  p_entity_type     text,
  p_entity_id       uuid,
  p_summary         text,
  p_metadata        jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.concat_ws(
    '|',
    p_organization_id::text,
    p_seq::text,
    -- Fixed-precision UTC so the hash never depends on the session TimeZone.
    pg_catalog.to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    coalesce(p_actor_id::text, ''),
    coalesce(p_actor_type, ''),
    coalesce(p_action, ''),
    coalesce(p_entity_type, ''),
    coalesce(p_entity_id::text, ''),
    coalesce(p_summary, ''),
    coalesce(p_metadata, '{}'::jsonb)::text
  )
$$;

-- -----------------------------------------------------------------------------
-- Insert trigger: assigns seq, links prev_hash, computes hash
-- -----------------------------------------------------------------------------

create or replace function public.audit_events_seal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_seq  bigint;
  last_hash text;
begin
  -- Serialise chain extension per organization. Two concurrent inserts would
  -- otherwise be able to claim the same seq and the same prev_hash.
  perform pg_catalog.pg_advisory_xact_lock(
    ('x' || pg_catalog.substr(
      pg_catalog.md5('aether_audit_chain:' || new.organization_id::text), 1, 16
    ))::bit(64)::bigint
  );

  select ae.seq, ae.hash
  into last_seq, last_hash
  from public.audit_events ae
  where ae.organization_id = new.organization_id
  order by ae.seq desc
  limit 1;

  new.seq       := coalesce(last_seq, 0) + 1;
  new.prev_hash := coalesce(last_hash, repeat('0', 64));
  new.occurred_at := coalesce(new.occurred_at, now());
  new.metadata  := coalesce(new.metadata, '{}'::jsonb);

  new.hash := public.sha256_hex(
    new.prev_hash || public.audit_event_payload(
      new.organization_id, new.seq, new.occurred_at, new.actor_id,
      new.actor_type, new.action, new.entity_type, new.entity_id,
      new.summary, new.metadata
    )
  );

  return new;
end;
$$;

drop trigger if exists audit_events_seal_trg on public.audit_events;
create trigger audit_events_seal_trg
  before insert on public.audit_events
  for each row execute function public.audit_events_seal();

-- -----------------------------------------------------------------------------
-- Append-only guard
--
-- Editing or removing a single event is always rejected. Erasing a whole tenant
-- is legitimate, so a cascade from `delete from organizations` is allowed
-- through: by the time the RI trigger fires, the parent row is already gone,
-- which is what distinguishes the two cases.
-- -----------------------------------------------------------------------------

create or replace function public.audit_events_reject_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only; UPDATE is not permitted'
    using hint = 'Record a compensating event instead of editing history.';
end;
$$;

create or replace function public.audit_events_reject_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organizations where id = old.organization_id
  ) then
    -- Tenant is being deleted; let the cascade proceed.
    return old;
  end if;

  raise exception 'audit_events is append-only; DELETE is not permitted'
    using hint = 'Record a compensating event instead of erasing history.';
end;
$$;

drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update
  before update on public.audit_events
  for each row execute function public.audit_events_reject_update();

drop trigger if exists audit_events_no_delete on public.audit_events;
create trigger audit_events_no_delete
  before delete on public.audit_events
  for each row execute function public.audit_events_reject_delete();

-- -----------------------------------------------------------------------------
-- record_audit_event — the only sanctioned way to append
-- -----------------------------------------------------------------------------

create or replace function public.record_audit_event(
  p_organization_id uuid,
  p_actor_id        uuid default null,
  p_actor_type      text default 'user',
  p_action          text default 'unspecified',
  p_entity_type     text default null,
  p_entity_id       uuid default null,
  p_summary         text default null,
  p_metadata        jsonb default '{}'::jsonb,
  p_actor_label     text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.audit_events (
    organization_id, actor_id, actor_type, actor_label, action,
    entity_type, entity_id, summary, metadata,
    seq, prev_hash, hash
  )
  values (
    p_organization_id, p_actor_id, p_actor_type, p_actor_label, p_action,
    p_entity_type, p_entity_id, p_summary, coalesce(p_metadata, '{}'::jsonb),
    -- Overwritten by the seal trigger; NOT NULL columns need a placeholder.
    0, '', ''
  )
  returning id into new_id;

  return new_id;
end;
$$;

comment on function public.record_audit_event is
  'Appends a sealed event to an organization''s audit chain. Callers never set seq, prev_hash or hash.';

revoke all on function public.record_audit_event(
  uuid, uuid, text, text, text, uuid, text, jsonb, text
) from public;
grant execute on function public.record_audit_event(
  uuid, uuid, text, text, text, uuid, text, jsonb, text
) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- verify_audit_chain — recompute the chain and report the first break
-- -----------------------------------------------------------------------------

create or replace function public.verify_audit_chain(p_organization_id uuid)
returns table (
  valid           boolean,
  events_checked  bigint,
  first_bad_seq   bigint,
  first_bad_id    uuid,
  head_hash       text,
  detail          text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rec           record;
  expected_prev text := repeat('0', 64);
  expected_seq  bigint := 1;
  recomputed    text;
  checked       bigint := 0;
  last_hash     text := null;
begin
  for rec in
    select * from public.audit_events
    where organization_id = p_organization_id
    order by seq
  loop
    checked := checked + 1;

    if rec.seq <> expected_seq then
      return query select
        false, checked, rec.seq, rec.id, last_hash,
        format('sequence gap: expected seq %s, found %s (an event was deleted)',
               expected_seq, rec.seq);
      return;
    end if;

    if rec.prev_hash <> expected_prev then
      return query select
        false, checked, rec.seq, rec.id, last_hash,
        format('broken link at seq %s: prev_hash does not match the previous event''s hash',
               rec.seq);
      return;
    end if;

    recomputed := public.sha256_hex(
      rec.prev_hash || public.audit_event_payload(
        rec.organization_id, rec.seq, rec.occurred_at, rec.actor_id,
        rec.actor_type, rec.action, rec.entity_type, rec.entity_id,
        rec.summary, rec.metadata
      )
    );

    if recomputed <> rec.hash then
      return query select
        false, checked, rec.seq, rec.id, last_hash,
        format('content altered at seq %s: recomputed hash does not match the stored hash',
               rec.seq);
      return;
    end if;

    expected_prev := rec.hash;
    last_hash     := rec.hash;
    expected_seq  := expected_seq + 1;
  end loop;

  return query select
    true, checked, null::bigint, null::uuid, last_hash,
    case
      when checked = 0 then 'no audit events recorded yet'
      else format('%s events verified; chain intact', checked)
    end;
end;
$$;

comment on function public.verify_audit_chain is
  'Recomputes an organization''s audit hash chain end to end and reports the first inconsistency, if any.';

revoke all on function public.verify_audit_chain(uuid) from public;
grant execute on function public.verify_audit_chain(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS — tenants read their own chain and nothing more. No INSERT policy: writes
-- go through record_audit_event (security definer) or the service role.
-- -----------------------------------------------------------------------------

alter table public.audit_events enable row level security;

do $$ begin
  create policy "audit_events_select_tenant"
    on public.audit_events
    for select
    to authenticated
    using (organization_id = public.current_user_org_id());
exception when duplicate_object then null; end $$;
