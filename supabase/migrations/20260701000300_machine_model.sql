-- =============================================================================
-- AETHER.ai — "The Machine"
--
-- The autonomous loop that runs whether or not anyone is logged in:
--
--   ingest -> analyse -> correlate -> decide -> dispatch
--
-- Every cycle is a machine_runs row with one machine_run_steps row per phase, so
-- a run is fully reconstructable after the fact — what it read, what it
-- concluded, and what it created on a tenant's behalf.
--
-- The output that matters is machine_directives: a ranked, expiring list of
-- "this specific thing, in this specific tenant, needs attention now, and here
-- is the reasoning". Directives are advisory until a human accepts one.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ingestion bookkeeping — lets each cycle fetch only what changed
-- -----------------------------------------------------------------------------

create table if not exists public.intelligence_source_state (
  source_id           uuid primary key references public.intelligence_sources (id) on delete cascade,
  etag                text,
  last_modified       text,
  last_success_at     timestamptz,
  last_attempt_at     timestamptz,
  last_status         text,
  last_error          text,
  consecutive_failures integer not null default 0,
  -- Exponential backoff so a dead regulator endpoint is not hammered forever.
  next_attempt_after  timestamptz,
  items_seen          bigint not null default 0,
  updated_at          timestamptz default now()
);

comment on table public.intelligence_source_state is
  'Per-source fetch cursor and health. Drives conditional requests and backoff during the ingest phase.';

-- Fetch mechanics belong with the source itself.
alter table public.intelligence_sources
  add column if not exists fetch_strategy text not null default 'manual';
alter table public.intelligence_sources
  add column if not exists feed_url text;
alter table public.intelligence_sources
  add column if not exists content_selector text;
alter table public.intelligence_sources
  add column if not exists regulator text;
alter table public.intelligence_sources
  add column if not exists frameworks text[] not null default '{}';
alter table public.intelligence_sources
  add column if not exists sectors text[] not null default '{}';
alter table public.intelligence_sources
  add column if not exists languages text[] not null default '{en}';
alter table public.intelligence_sources
  add column if not exists authority_tier integer not null default 2;
alter table public.intelligence_sources
  add column if not exists poll_interval_minutes integer not null default 360;
alter table public.intelligence_sources
  add column if not exists notes text;

comment on column public.intelligence_sources.authority_tier is
  '1 = the regulator itself (binding), 2 = national agency guidance, 3 = commentary/press. Feeds signal confidence.';
comment on column public.intelligence_sources.fetch_strategy is
  'rss | atom | json | html_index | manual. GCC regulators largely lack feeds, so html_index and manual are expected.';

do $$ begin
  alter table public.intelligence_sources add constraint intelligence_sources_fetch_strategy_check
    check (fetch_strategy in ('rss', 'atom', 'json', 'html_index', 'manual'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.intelligence_sources add constraint intelligence_sources_authority_tier_check
    check (authority_tier between 1 and 3);
exception when duplicate_object then null; end $$;

-- Deduplication: the same circular reappearing on an index page must not create
-- a second item.
alter table public.intelligence_items
  add column if not exists content_hash text;
alter table public.intelligence_items
  add column if not exists external_id text;
alter table public.intelligence_items
  add column if not exists summary text;
alter table public.intelligence_items
  add column if not exists document_type text;
alter table public.intelligence_items
  add column if not exists ingested_by_run uuid;
alter table public.intelligence_items
  add column if not exists analysis_status text not null default 'pending';

do $$ begin
  alter table public.intelligence_items add constraint intelligence_items_analysis_status_check
    check (analysis_status in ('pending', 'analyzing', 'analyzed', 'skipped', 'failed'));
exception when duplicate_object then null; end $$;

create unique index if not exists intelligence_items_dedupe_idx
  on public.intelligence_items (source_id, content_hash)
  where content_hash is not null;

create index if not exists intelligence_items_analysis_status_idx
  on public.intelligence_items (analysis_status)
  where analysis_status = 'pending';

-- Richer signal attribution.
alter table public.risk_signals
  add column if not exists confidence numeric(3, 2) not null default 0.6;
alter table public.risk_signals
  add column if not exists control_codes text[] not null default '{}';
alter table public.risk_signals
  add column if not exists effective_date date;
alter table public.risk_signals
  add column if not exists deadline_date date;
alter table public.risk_signals
  add column if not exists analysis_model text;
alter table public.risk_signals
  add column if not exists analysis_method text not null default 'heuristic';
alter table public.risk_signals
  add column if not exists created_by_run uuid;
alter table public.risk_signals
  add column if not exists entity_types text[] not null default '{}';

do $$ begin
  alter table public.risk_signals add constraint risk_signals_analysis_method_check
    check (analysis_method in ('heuristic', 'llm', 'hybrid', 'manual'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.risk_signals add constraint risk_signals_confidence_check
    check (confidence >= 0 and confidence <= 1);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.risk_signals add constraint risk_signals_severity_check
    check (severity in ('info', 'low', 'medium', 'high', 'critical'));
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- machine_runs — one cycle
-- -----------------------------------------------------------------------------

create table if not exists public.machine_runs (
  id            uuid primary key default gen_random_uuid(),
  trigger       text not null default 'cron',
  triggered_by  uuid references public.profiles (id) on delete set null,
  status        text not null default 'running',
  phase         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  duration_ms   integer,
  stats         jsonb not null default '{}'::jsonb,
  error         text,
  -- Set when a run is scoped to one tenant (a manual "run now" from the console).
  organization_id uuid references public.organizations (id) on delete cascade,
  dry_run       boolean not null default false,
  created_at    timestamptz default now()
);

do $$ begin
  alter table public.machine_runs add constraint machine_runs_trigger_check
    check (trigger in ('cron', 'manual', 'webhook', 'backfill'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.machine_runs add constraint machine_runs_status_check
    check (status in ('running', 'succeeded', 'partial', 'failed', 'skipped'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.machine_runs add constraint machine_runs_phase_check
    check (phase is null or phase in (
      'ingest', 'analyze', 'correlate', 'decide', 'dispatch', 'done'
    ));
exception when duplicate_object then null; end $$;

create index if not exists machine_runs_started_at_idx on public.machine_runs (started_at desc);
create index if not exists machine_runs_status_idx on public.machine_runs (status);

-- Only one cycle may be in flight at a time, so concurrent cron deliveries
-- cannot double-ingest. Manual single-tenant runs are exempt.
create unique index if not exists machine_runs_single_active_idx
  on public.machine_runs ((true))
  where status = 'running' and organization_id is null;

-- -----------------------------------------------------------------------------
-- machine_run_steps — per-phase detail
-- -----------------------------------------------------------------------------

create table if not exists public.machine_run_steps (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.machine_runs (id) on delete cascade,
  phase        text not null,
  status       text not null default 'running',
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  duration_ms  integer,
  items_in     integer not null default 0,
  items_out    integer not null default 0,
  detail       jsonb not null default '{}'::jsonb,
  error        text,
  created_at   timestamptz default now()
);

do $$ begin
  alter table public.machine_run_steps add constraint machine_run_steps_status_check
    check (status in ('running', 'succeeded', 'partial', 'failed', 'skipped'));
exception when duplicate_object then null; end $$;

create index if not exists machine_run_steps_run_id_idx on public.machine_run_steps (run_id, started_at);

do $$ begin
  alter table public.intelligence_items
    add constraint intelligence_items_run_fkey
    foreign key (ingested_by_run) references public.machine_runs (id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.risk_signals
    add constraint risk_signals_run_fkey
    foreign key (created_by_run) references public.machine_runs (id) on delete set null;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- signal_assessments — a global signal, scored for one tenant
--
-- The same regulatory change is urgent for a Saudi bank and irrelevant for a
-- Jordanian logistics firm. Relevance is computed per tenant and kept, so the
-- score behind a directive can be explained later.
-- -----------------------------------------------------------------------------

create table if not exists public.signal_assessments (
  id                  uuid primary key default gen_random_uuid(),
  risk_signal_id      uuid not null references public.risk_signals (id) on delete cascade,
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  client_workspace_id uuid references public.client_workspaces (id) on delete cascade,
  relevance_score     numeric(4, 3) not null default 0,
  relevance_band      text not null default 'noise',
  rationale           text,
  score_breakdown     jsonb not null default '{}'::jsonb,
  matched_frameworks  text[] not null default '{}',
  matched_controls    uuid[] not null default '{}',
  matched_sectors     text[] not null default '{}',
  affected_control_count integer not null default 0,
  status              text not null default 'new',
  triaged_by          uuid references public.profiles (id) on delete set null,
  triaged_at          timestamptz,
  dismissal_reason    text,
  created_by_run      uuid references public.machine_runs (id) on delete set null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  check (relevance_score >= 0 and relevance_score <= 1)
);

do $$ begin
  alter table public.signal_assessments add constraint signal_assessments_band_check
    check (relevance_band in ('noise', 'watch', 'relevant', 'urgent', 'critical'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.signal_assessments add constraint signal_assessments_status_check
    check (status in ('new', 'triaged', 'actioned', 'dismissed', 'superseded'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.signal_assessments
    add constraint signal_assessments_unique_per_scope
    unique (risk_signal_id, organization_id, client_workspace_id);
exception when duplicate_object then null; end $$;

create unique index if not exists signal_assessments_unique_org_scope
  on public.signal_assessments (risk_signal_id, organization_id)
  where client_workspace_id is null;

create index if not exists signal_assessments_org_idx
  on public.signal_assessments (organization_id, relevance_score desc);
create index if not exists signal_assessments_status_idx
  on public.signal_assessments (organization_id, status);

-- -----------------------------------------------------------------------------
-- machine_directives — the ranked output
-- -----------------------------------------------------------------------------

create table if not exists public.machine_directives (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  client_workspace_id uuid references public.client_workspaces (id) on delete cascade,
  run_id              uuid references public.machine_runs (id) on delete set null,

  subject_type        text not null,
  subject_id          uuid,
  subject_label       text,

  directive_type      text not null,
  priority            text not null default 'medium',
  urgency_score       numeric(4, 3) not null default 0.5,
  confidence          numeric(3, 2) not null default 0.6,

  title               text not null,
  reasoning           text not null,
  evidence            jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,

  status              text not null default 'open',
  -- Set when acting on a directive creates a task, obligation or risk.
  resulting_task_id       uuid references public.tasks (id) on delete set null,
  resulting_obligation_id uuid references public.obligations (id) on delete set null,
  resulting_risk_id       uuid references public.risks (id) on delete set null,

  acknowledged_by     uuid references public.profiles (id) on delete set null,
  acknowledged_at     timestamptz,
  resolved_at         timestamptz,
  dismissal_reason    text,
  -- A directive that nobody acts on stops being useful; the console hides
  -- expired ones by default rather than growing an infinite backlog.
  expires_at          timestamptz,
  -- Stable identity for "the same conclusion", so re-running the cycle refreshes
  -- a directive instead of duplicating it.
  dedupe_key          text not null,

  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  check (urgency_score >= 0 and urgency_score <= 1),
  check (confidence >= 0 and confidence <= 1)
);

comment on table public.machine_directives is
  'The Machine''s ranked conclusions. Advisory until a human acknowledges one; acting on a directive links it to the task, obligation or risk it produced.';

do $$ begin
  alter table public.machine_directives add constraint machine_directives_subject_type_check
    check (subject_type in (
      'organization', 'client_workspace', 'control', 'policy', 'risk',
      'obligation', 'vendor', 'ai_system', 'risk_signal'
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.machine_directives add constraint machine_directives_type_check
    check (directive_type in (
      'regulatory_change', 'control_gap', 'policy_stale', 'policy_missing',
      'obligation_due', 'obligation_overdue', 'risk_escalation',
      'vendor_review_due', 'ai_classification_required', 'evidence_expiring',
      'assessment_overdue', 'coverage_gap'
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.machine_directives add constraint machine_directives_priority_check
    check (priority in ('low', 'medium', 'high', 'urgent'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.machine_directives add constraint machine_directives_status_check
    check (status in ('open', 'acknowledged', 'actioned', 'dismissed', 'expired', 'superseded'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.machine_directives
    add constraint machine_directives_dedupe_key_unique
    unique (organization_id, dedupe_key);
exception when duplicate_object then null; end $$;

create index if not exists machine_directives_org_priority_idx
  on public.machine_directives (organization_id, status, urgency_score desc);
create index if not exists machine_directives_subject_idx
  on public.machine_directives (organization_id, subject_type, subject_id);
create index if not exists machine_directives_run_idx
  on public.machine_directives (run_id);

-- -----------------------------------------------------------------------------
-- Machine configuration per tenant — what it is allowed to do unattended
-- -----------------------------------------------------------------------------

create table if not exists public.machine_settings (
  organization_id        uuid primary key references public.organizations (id) on delete cascade,
  enabled                boolean not null default true,
  autonomy_level         text not null default 'advise',
  min_relevance_to_alert numeric(4, 3) not null default 0.35,
  min_relevance_to_act   numeric(4, 3) not null default 0.75,
  watch_countries        text[] not null default '{}',
  watch_sectors          text[] not null default '{}',
  watch_frameworks       text[] not null default '{}',
  digest_cadence         text not null default 'weekly',
  notify_roles           text[] not null default '{owner,admin}',
  quiet_hours            jsonb,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  check (min_relevance_to_alert >= 0 and min_relevance_to_alert <= 1),
  check (min_relevance_to_act >= 0 and min_relevance_to_act <= 1)
);

comment on column public.machine_settings.autonomy_level is
  'observe = record only; advise = raise directives (default); act = also create tasks and obligations automatically above min_relevance_to_act.';

do $$ begin
  alter table public.machine_settings add constraint machine_settings_autonomy_check
    check (autonomy_level in ('observe', 'advise', 'act'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.machine_settings add constraint machine_settings_digest_check
    check (digest_cadence in ('off', 'daily', 'weekly', 'monthly'));
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

do $trg$ begin perform public.ensure_updated_at_trigger('public.intelligence_source_state'); end $trg$;
do $trg$ begin perform public.ensure_updated_at_trigger('public.signal_assessments'); end $trg$;
do $trg$ begin perform public.ensure_updated_at_trigger('public.machine_directives'); end $trg$;
do $trg$ begin perform public.ensure_updated_at_trigger('public.machine_settings'); end $trg$;

-- -----------------------------------------------------------------------------
-- Operational views
-- -----------------------------------------------------------------------------

create or replace view public.machine_directives_active as
select d.*
from public.machine_directives d
where d.status in ('open', 'acknowledged')
  and (d.expires_at is null or d.expires_at > now());

comment on view public.machine_directives_active is
  'Directives still worth showing: open or acknowledged, and not past their expiry.';

create or replace view public.machine_run_summary as
select
  r.id,
  r.trigger,
  r.status,
  r.phase,
  r.started_at,
  r.finished_at,
  r.duration_ms,
  r.stats,
  r.error,
  r.organization_id,
  r.dry_run,
  count(s.id)                                             as step_count,
  count(s.id) filter (where s.status = 'failed')          as failed_steps,
  coalesce(sum(s.items_in), 0)                            as total_items_in,
  coalesce(sum(s.items_out), 0)                           as total_items_out
from public.machine_runs r
left join public.machine_run_steps s on s.run_id = r.id
group by r.id;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.intelligence_source_state enable row level security;
alter table public.machine_runs              enable row level security;
alter table public.machine_run_steps         enable row level security;
alter table public.signal_assessments        enable row level security;
alter table public.machine_directives        enable row level security;
alter table public.machine_settings          enable row level security;
