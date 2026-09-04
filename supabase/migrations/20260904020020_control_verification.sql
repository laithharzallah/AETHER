-- =============================================================================
-- Control verification provenance
--
-- `verified` alone is not an assurance — it does not say who checked the row.
-- These columns record the named human who signed off on a control's text and
-- when, so the UI can show "Verified by <name> on <date>" rather than a bare
-- tick that the system awarded itself.
-- =============================================================================

alter table public.controls
  add column if not exists verified_by text,
  add column if not exists verified_at date;

comment on column public.controls.verified_by is
  'Name of the human reviewer who checked this control against the primary source. Null means nobody has signed off.';
comment on column public.controls.verified_at is
  'Date the reviewer named in verified_by signed off.';

-- A row cannot claim verification without a named reviewer.
alter table public.controls
  drop constraint if exists controls_verified_requires_reviewer;
alter table public.controls
  add constraint controls_verified_requires_reviewer
  check (verified = false or verified_by is not null);
