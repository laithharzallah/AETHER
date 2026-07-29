-- =============================================================================
-- AETHER.ai organization provisioning
--
-- Turns a bare organizations row into a working tenant: entitled modules, a
-- control library instantiated from the frameworks that actually apply, a dated
-- obligation calendar, Machine settings, and a genesis audit event.
--
-- Idempotent throughout, so it can be re-run when a tenant adds a framework
-- without duplicating anything they already have.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Which frameworks apply, given a country and industry
--
-- Returned in priority order: mandatory local regulator first, then sector
-- regulator, then the international standards used as evidence vehicles.
-- -----------------------------------------------------------------------------

create or replace function public.suggested_frameworks(
  p_country  text,
  p_industry text default null
)
returns table (framework_code text, reason text, priority integer)
language sql
stable
set search_path = ''
as $$
  select f.code, r.reason, r.priority
  from (values
    -- Mandatory national baselines
    ('SA',      null,        'NCA-ECC',         'Mandatory national cybersecurity baseline for Saudi Arabia',              1),
    ('SA',      null,        'SA-PDPL',         'Applies to any processing of personal data of residents of the Kingdom',  1),
    ('QA',      null,        'QA-NIA',          'Qatar national information assurance baseline',                            1),
    ('QA',      null,        'QA-PDPPL',        'Qatar personal data privacy protection law',                               1),
    ('AE',      null,        'AE-IA',           'UAE national information assurance regulation',                            1),
    ('AE',      null,        'AE-PDPL',         'UAE federal personal data protection law',                                 1),
    ('JO',      null,        'JO-NCSF',         'Jordan national cybersecurity framework',                                  1),
    ('JO',      null,        'JO-PDPL',         'Jordan personal data protection law',                                      1),
    ('KW',      null,        'KW-CITRA-CSF',    'Kuwait national cybersecurity framework',                                  1),
    ('KW',      null,        'KW-CITRA-DPPR',   'Kuwait data privacy protection regulation',                                1),
    ('BH',      null,        'BH-PDPL',         'Bahrain personal data protection law',                                     1),
    ('OM',      null,        'OM-PDPL',         'Oman personal data protection law',                                        1),
    -- Sector regulators
    ('SA',      'financial', 'SAMA-CSF',        'SAMA cyber security framework applies to SAMA-regulated entities',         2),
    ('SA',      'financial', 'SAMA-BCM',        'SAMA business continuity framework applies to SAMA-regulated entities',    2),
    ('QA',      'financial', 'QCB-TRC',         'Qatar Central Bank technology and information security requirements',      2),
    ('AE',      'financial', 'CBUAE-ISS',       'CBUAE information security and technology risk standards',                 2),
    ('JO',      'financial', 'CBJ-CSF',         'Central Bank of Jordan information security instructions',                 2),
    ('BH',      'financial', 'CBB-OM5',         'CBB Rulebook operational risk and cyber security modules',                 2),
    ('SA',      'payments',  'PCI-DSS',         'Required where cardholder data is stored, processed or transmitted',       2),
    -- International standards, applicable everywhere
    (null,      null,        'ISO-27001',       'The certifiable ISMS standard and the pivot for framework mapping',        3),
    (null,      null,        'NIST-CSF',        'Widely used to structure and report cybersecurity posture',                4)
  ) as r(country, sector_group, framework_code, reason, priority)
  join public.frameworks f on f.code = r.framework_code
  where (r.country is null or r.country = p_country)
    and (
      r.sector_group is null
      or (r.sector_group = 'financial' and p_industry = any(array[
           'banking', 'insurance', 'financial_services', 'payments',
           'fintech', 'capital_markets'
         ]))
      or (r.sector_group = 'payments' and p_industry = any(array[
           'banking', 'payments', 'retail', 'ecommerce', 'fintech', 'hospitality'
         ]))
    )
  order by r.priority, f.code;
$$;

comment on function public.suggested_frameworks is
  'Frameworks that apply to an organisation given its country and industry, in the order a GRC programme would adopt them.';

-- -----------------------------------------------------------------------------
-- Next due date for a cadence
--
-- Event-driven obligations have no date: they are triggered by something
-- happening, and giving them a fake deadline would corrupt the calendar.
-- -----------------------------------------------------------------------------

create or replace function public.next_obligation_due_date(
  p_cadence        text,
  p_lead_time_days integer default 30,
  p_from           date default null
)
returns date
language sql
immutable
set search_path = ''
as $$
  select case p_cadence
    when 'continuous'  then null
    when 'event_driven' then null
    when 'monthly'     then (coalesce(p_from, current_date) + interval '1 month')::date
    when 'quarterly'   then (coalesce(p_from, current_date) + interval '3 months')::date
    when 'semiannual'  then (coalesce(p_from, current_date) + interval '6 months')::date
    when 'annual'      then (coalesce(p_from, current_date) + interval '1 year')::date
    when 'biennial'    then (coalesce(p_from, current_date) + interval '2 years')::date
    when 'triennial'   then (coalesce(p_from, current_date) + interval '3 years')::date
    when 'one_time'    then (coalesce(p_from, current_date) + (greatest(p_lead_time_days, 1) || ' days')::interval)::date
    else (coalesce(p_from, current_date) + interval '1 year')::date
  end;
$$;

-- -----------------------------------------------------------------------------
-- provision_organization
-- -----------------------------------------------------------------------------

create or replace function public.provision_organization(
  p_organization_id uuid,
  p_framework_codes text[] default null,
  p_actor_id        uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org            record;
  v_codes          text[];
  v_modules_added  integer := 0;
  v_controls_added integer := 0;
  v_obligations_added integer := 0;
  v_settings_added integer := 0;
begin
  select * into v_org from public.organizations where id = p_organization_id;
  if v_org.id is null then
    raise exception 'unknown organization %', p_organization_id;
  end if;

  -- Resolve the framework set: explicit argument wins, otherwise infer it.
  if p_framework_codes is not null and array_length(p_framework_codes, 1) > 0 then
    v_codes := p_framework_codes;
  else
    select array_agg(framework_code order by priority)
    into v_codes
    from public.suggested_frameworks(v_org.country, v_org.industry);
  end if;

  v_codes := coalesce(v_codes, array['ISO-27001']);

  -- ---------------------------------------------------------------------------
  -- Modules
  -- ---------------------------------------------------------------------------
  with inserted as (
    insert into public.organization_modules (organization_id, module_id, enabled)
    select p_organization_id, m.id, true
    from public.modules m
    where m.status in ('available', 'beta')
    on conflict (organization_id, module_id) do nothing
    returning 1
  )
  select count(*) into v_modules_added from inserted;

  -- ---------------------------------------------------------------------------
  -- Control library, instantiated from the applicable frameworks
  -- ---------------------------------------------------------------------------
  with inserted as (
    insert into public.controls (
      organization_id, framework_control_id, framework_code, control_code, title
    )
    select
      p_organization_id, fc.id, f.code, fc.code, fc.title
    from public.framework_controls fc
    join public.frameworks f on f.id = fc.framework_id
    where f.code = any(v_codes)
    on conflict do nothing
    returning 1
  )
  select count(*) into v_controls_added from inserted;

  -- ---------------------------------------------------------------------------
  -- Obligation calendar
  -- ---------------------------------------------------------------------------
  with inserted as (
    insert into public.obligations (
      organization_id, template_id, framework_code, control_code, title,
      description, cadence, due_date, severity, evidence_required, source, status
    )
    select
      p_organization_id,
      ot.id,
      f.code,
      ot.control_code,
      ot.title,
      ot.description,
      ot.cadence,
      public.next_obligation_due_date(ot.cadence, ot.lead_time_days),
      ot.severity,
      ot.evidence_required,
      'template',
      'upcoming'
    from public.obligation_templates ot
    join public.frameworks f on f.id = ot.framework_id
    where f.code = any(v_codes)
    on conflict do nothing
    returning 1
  )
  select count(*) into v_obligations_added from inserted;

  -- ---------------------------------------------------------------------------
  -- Machine settings, seeded from the tenant's own context so the first cycle
  -- already scores relevance sensibly instead of treating everything as noise.
  -- ---------------------------------------------------------------------------
  with inserted as (
    insert into public.machine_settings (
      organization_id, watch_countries, watch_sectors, watch_frameworks
    )
    values (
      p_organization_id,
      case when v_org.country is null then '{}'::text[] else array[v_org.country] end,
      case when v_org.industry is null then '{}'::text[] else array[v_org.industry] end,
      v_codes
    )
    on conflict (organization_id) do update set
      watch_frameworks = (
        select array_agg(distinct code)
        from unnest(
          public.machine_settings.watch_frameworks || excluded.watch_frameworks
        ) as code
      ),
      updated_at = now()
    returning 1
  )
  select count(*) into v_settings_added from inserted;

  -- ---------------------------------------------------------------------------
  -- Audit
  -- ---------------------------------------------------------------------------
  perform public.record_audit_event(
    p_organization_id,
    p_actor_id,
    case when p_actor_id is null then 'system' else 'user' end,
    'organization.provisioned',
    'organization',
    p_organization_id,
    format(
      'Provisioned %s framework(s): %s',
      coalesce(array_length(v_codes, 1), 0),
      array_to_string(v_codes, ', ')
    ),
    jsonb_build_object(
      'frameworks',        to_jsonb(v_codes),
      'modules_added',     v_modules_added,
      'controls_added',    v_controls_added,
      'obligations_added', v_obligations_added
    )
  );

  return jsonb_build_object(
    'organization_id',   p_organization_id,
    'frameworks',        to_jsonb(v_codes),
    'modules_added',     v_modules_added,
    'controls_added',    v_controls_added,
    'obligations_added', v_obligations_added,
    'settings_created',  v_settings_added
  );
end;
$$;

comment on function public.provision_organization is
  'Instantiates the control library, obligation calendar, module entitlements and Machine settings for an organization. Safe to re-run.';

revoke all on function public.provision_organization(uuid, text[], uuid) from public;
grant execute on function public.provision_organization(uuid, text[], uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Compliance posture — one row per framework a tenant holds controls for
--
-- Computed rather than stored, so it cannot fall out of step with the
-- assessments underneath it.
-- -----------------------------------------------------------------------------

create or replace view public.compliance_posture as
select
  c.organization_id,
  c.client_workspace_id,
  c.framework_code,
  f.name                    as framework_name,
  f.regulator,
  f.jurisdiction,
  f.mandatory,
  count(*)                  as total_controls,
  count(*) filter (where c.applicability = 'not_applicable')       as excluded_controls,
  count(*) filter (where c.applicability <> 'not_applicable')      as in_scope_controls,
  count(*) filter (where c.implementation_status = 'implemented')  as implemented,
  count(*) filter (where c.implementation_status = 'partially_implemented') as partially_implemented,
  count(*) filter (where c.implementation_status in ('not_implemented', 'not_assessed')) as gaps,
  count(*) filter (where c.effectiveness = 'effective')           as effective,
  count(*) filter (where c.last_assessed_at is null)               as never_assessed,
  round(avg(c.maturity)::numeric, 2)                              as average_maturity,
  -- Partial implementation counts for half. Anything unassessed counts for zero:
  -- an unverified control is not evidence of compliance.
  round(
    100.0 * (
      count(*) filter (where c.implementation_status = 'implemented')
      + 0.5 * count(*) filter (where c.implementation_status = 'partially_implemented')
    ) / greatest(count(*) filter (where c.applicability <> 'not_applicable'), 1),
    1
  ) as coverage_percent
from public.controls c
join public.frameworks f on f.code = c.framework_code
group by c.organization_id, c.client_workspace_id, c.framework_code,
         f.name, f.regulator, f.jurisdiction, f.mandatory;

comment on view public.compliance_posture is
  'Per-framework coverage derived from the control library. Unassessed controls score zero rather than being ignored.';

alter view public.compliance_posture set (security_invoker = on);

-- -----------------------------------------------------------------------------
-- Control coverage by policy — which controls no policy claims to address
-- -----------------------------------------------------------------------------

create or replace view public.control_policy_coverage as
select
  c.organization_id,
  c.id                as control_id,
  c.framework_code,
  c.control_code,
  c.title,
  count(pcc.id) filter (where pcc.coverage in ('full', 'partial')) as covering_policies,
  bool_or(pcc.coverage = 'full')                                   as fully_covered
from public.controls c
left join public.policy_control_coverage pcc
  on pcc.framework_control_id = c.framework_control_id
 and pcc.organization_id = c.organization_id
where c.applicability <> 'not_applicable'
group by c.organization_id, c.id, c.framework_code, c.control_code, c.title;

alter view public.control_policy_coverage set (security_invoker = on);
