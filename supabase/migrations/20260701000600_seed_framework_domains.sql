-- =============================================================================
-- Seed: framework domain structures
--
-- The domain / subdomain tree for each framework. These are the citable units an
-- auditor or regulator refers to ("NCA ECC 2-2", "SAMA CSF 3.3.5"), so the codes
-- match the published numbering exactly.
--
-- Upsert helpers are defined here and reused by the control and crosswalk seeds.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Seed helpers
-- -----------------------------------------------------------------------------

create or replace function public.upsert_framework_domain(
  p_framework_code text,
  p_code           text,
  p_title          text,
  p_parent_code    text default null,
  p_ordinal        integer default 0,
  p_title_ar       text default null,
  p_description    text default null
)
returns uuid
language plpgsql
as $$
declare
  v_framework_id uuid;
  v_parent_id    uuid;
  v_id           uuid;
begin
  select id into v_framework_id from public.frameworks where code = p_framework_code;
  if v_framework_id is null then
    raise exception 'unknown framework code %', p_framework_code;
  end if;

  if p_parent_code is not null then
    select id into v_parent_id
    from public.framework_domains
    where framework_id = v_framework_id and code = p_parent_code;

    if v_parent_id is null then
      raise exception 'unknown parent domain %.%', p_framework_code, p_parent_code;
    end if;
  end if;

  insert into public.framework_domains (
    framework_id, parent_id, code, title, title_ar, description, ordinal
  )
  values (
    v_framework_id, v_parent_id, p_code, p_title, p_title_ar, p_description, p_ordinal
  )
  on conflict (framework_id, code) do update set
    parent_id   = excluded.parent_id,
    title       = excluded.title,
    title_ar    = excluded.title_ar,
    description = excluded.description,
    ordinal     = excluded.ordinal
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.upsert_framework_control(
  p_framework_code   text,
  p_code             text,
  p_title            text,
  p_domain_code      text default null,
  p_control_type     text default null,
  p_control_nature   text[] default '{}',
  p_tags             text[] default '{}',
  p_ordinal          integer default 0,
  p_objective        text default null,
  p_requirement_text text default null,
  p_evidence_examples text[] default '{}',
  p_title_ar         text default null
)
returns uuid
language plpgsql
as $$
declare
  v_framework_id uuid;
  v_domain_id    uuid;
  v_id           uuid;
begin
  select id into v_framework_id from public.frameworks where code = p_framework_code;
  if v_framework_id is null then
    raise exception 'unknown framework code %', p_framework_code;
  end if;

  if p_domain_code is not null then
    select id into v_domain_id
    from public.framework_domains
    where framework_id = v_framework_id and code = p_domain_code;

    if v_domain_id is null then
      raise exception 'unknown domain %.%', p_framework_code, p_domain_code;
    end if;
  end if;

  insert into public.framework_controls (
    framework_id, domain_id, code, title, title_ar, objective,
    requirement_text, control_type, control_nature, evidence_examples, tags, ordinal
  )
  values (
    v_framework_id, v_domain_id, p_code, p_title, p_title_ar, p_objective,
    p_requirement_text, p_control_type, p_control_nature, p_evidence_examples,
    p_tags, p_ordinal
  )
  on conflict (framework_id, code) do update set
    domain_id         = excluded.domain_id,
    title             = excluded.title,
    title_ar          = excluded.title_ar,
    objective         = excluded.objective,
    requirement_text  = excluded.requirement_text,
    control_type      = excluded.control_type,
    control_nature    = excluded.control_nature,
    evidence_examples = excluded.evidence_examples,
    tags              = excluded.tags,
    ordinal           = excluded.ordinal
  returning id into v_id;

  return v_id;
end;
$$;

-- Bidirectional by default: an `equivalent` mapping is symmetric, and traversal
-- code should not have to care which side it was seeded from.
create or replace function public.upsert_crosswalk(
  p_source_framework text,
  p_source_code      text,
  p_target_framework text,
  p_target_code      text,
  p_relationship     text default 'partial',
  p_confidence       numeric default 0.75,
  p_rationale        text default null,
  p_bidirectional    boolean default true
)
returns void
language plpgsql
as $$
declare
  v_source uuid;
  v_target uuid;
  v_inverse text;
begin
  select fc.id into v_source
  from public.framework_controls fc
  join public.frameworks f on f.id = fc.framework_id
  where f.code = p_source_framework and fc.code = p_source_code;

  select fc.id into v_target
  from public.framework_controls fc
  join public.frameworks f on f.id = fc.framework_id
  where f.code = p_target_framework and fc.code = p_target_code;

  if v_source is null then
    raise exception 'crosswalk source not found: %.%', p_source_framework, p_source_code;
  end if;
  if v_target is null then
    raise exception 'crosswalk target not found: %.%', p_target_framework, p_target_code;
  end if;

  insert into public.control_crosswalks (
    source_control_id, target_control_id, relationship, confidence, rationale
  )
  values (v_source, v_target, p_relationship, p_confidence, p_rationale)
  on conflict (source_control_id, target_control_id) do update set
    relationship = excluded.relationship,
    confidence   = excluded.confidence,
    rationale    = excluded.rationale;

  if p_bidirectional then
    v_inverse := case p_relationship
      when 'superset' then 'subset'
      when 'subset'   then 'superset'
      else p_relationship
    end;

    insert into public.control_crosswalks (
      source_control_id, target_control_id, relationship, confidence, rationale
    )
    values (v_target, v_source, v_inverse, p_confidence, p_rationale)
    on conflict (source_control_id, target_control_id) do update set
      relationship = excluded.relationship,
      confidence   = excluded.confidence,
      rationale    = excluded.rationale;
  end if;
end;
$$;

-- =============================================================================
-- NCA Essential Cybersecurity Controls — 5 main domains, 29 subdomains
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('NCA-ECC', '1', 'Cybersecurity Governance', null, 1, 'حكومة الأمن السيبراني');
  perform public.upsert_framework_domain('NCA-ECC', '2', 'Cybersecurity Defence', null, 2, 'تحصين الأمن السيبراني');
  perform public.upsert_framework_domain('NCA-ECC', '3', 'Cybersecurity Resilience', null, 3, 'صمود الأمن السيبراني');
  perform public.upsert_framework_domain('NCA-ECC', '4', 'Third-Party and Cloud Computing Cybersecurity', null, 4, 'الأمن السيبراني المتعلق بالأطراف الخارجية والحوسبة السحابية');
  perform public.upsert_framework_domain('NCA-ECC', '5', 'Industrial Control Systems Cybersecurity', null, 5, 'الأمن السيبراني لأنظمة التحكم الصناعي');

  -- 1 Cybersecurity Governance
  perform public.upsert_framework_domain('NCA-ECC', '1-1', 'Cybersecurity Strategy', '1', 1);
  perform public.upsert_framework_domain('NCA-ECC', '1-2', 'Cybersecurity Management', '1', 2);
  perform public.upsert_framework_domain('NCA-ECC', '1-3', 'Cybersecurity Policies and Procedures', '1', 3);
  perform public.upsert_framework_domain('NCA-ECC', '1-4', 'Cybersecurity Roles and Responsibilities', '1', 4);
  perform public.upsert_framework_domain('NCA-ECC', '1-5', 'Cybersecurity Risk Management', '1', 5);
  perform public.upsert_framework_domain('NCA-ECC', '1-6', 'Cybersecurity in Information and Technology Project Management', '1', 6);
  perform public.upsert_framework_domain('NCA-ECC', '1-7', 'Compliance with Cybersecurity Standards, Laws and Regulations', '1', 7);
  perform public.upsert_framework_domain('NCA-ECC', '1-8', 'Periodical Cybersecurity Review and Audit', '1', 8);
  perform public.upsert_framework_domain('NCA-ECC', '1-9', 'Cybersecurity in Human Resources', '1', 9);
  perform public.upsert_framework_domain('NCA-ECC', '1-10', 'Cybersecurity Awareness and Training Program', '1', 10);

  -- 2 Cybersecurity Defence
  perform public.upsert_framework_domain('NCA-ECC', '2-1', 'Asset Management', '2', 1);
  perform public.upsert_framework_domain('NCA-ECC', '2-2', 'Identity and Access Management', '2', 2);
  perform public.upsert_framework_domain('NCA-ECC', '2-3', 'Information System and Information Processing Facilities Protection', '2', 3);
  perform public.upsert_framework_domain('NCA-ECC', '2-4', 'Email Protection', '2', 4);
  perform public.upsert_framework_domain('NCA-ECC', '2-5', 'Networks Security Management', '2', 5);
  perform public.upsert_framework_domain('NCA-ECC', '2-6', 'Mobile Devices Security', '2', 6);
  perform public.upsert_framework_domain('NCA-ECC', '2-7', 'Data and Information Protection', '2', 7);
  perform public.upsert_framework_domain('NCA-ECC', '2-8', 'Cryptography', '2', 8);
  perform public.upsert_framework_domain('NCA-ECC', '2-9', 'Backup and Recovery Management', '2', 9);
  perform public.upsert_framework_domain('NCA-ECC', '2-10', 'Vulnerabilities Management', '2', 10);
  perform public.upsert_framework_domain('NCA-ECC', '2-11', 'Penetration Testing', '2', 11);
  perform public.upsert_framework_domain('NCA-ECC', '2-12', 'Cybersecurity Event Logs and Monitoring Management', '2', 12);
  perform public.upsert_framework_domain('NCA-ECC', '2-13', 'Cybersecurity Incident and Threat Management', '2', 13);
  perform public.upsert_framework_domain('NCA-ECC', '2-14', 'Physical Security', '2', 14);
  perform public.upsert_framework_domain('NCA-ECC', '2-15', 'Web Application Security', '2', 15);

  -- 3 Cybersecurity Resilience
  perform public.upsert_framework_domain('NCA-ECC', '3-1', 'Cybersecurity Resilience Aspects of Business Continuity Management', '3', 1);

  -- 4 Third-Party and Cloud Computing
  perform public.upsert_framework_domain('NCA-ECC', '4-1', 'Third-Party Cybersecurity', '4', 1);
  perform public.upsert_framework_domain('NCA-ECC', '4-2', 'Cloud Computing and Hosting Cybersecurity', '4', 2);

  -- 5 Industrial Control Systems
  perform public.upsert_framework_domain('NCA-ECC', '5-1', 'Industrial Control Systems Protection', '5', 1);
end
$seed$;

-- =============================================================================
-- SAMA Cyber Security Framework — 4 domains, 33 subdomains
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('SAMA-CSF', '3.1', 'Cyber Security Leadership and Governance', null, 1);
  perform public.upsert_framework_domain('SAMA-CSF', '3.2', 'Cyber Security Risk Management and Compliance', null, 2);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3', 'Cyber Security Operations and Technology', null, 3);
  perform public.upsert_framework_domain('SAMA-CSF', '3.4', 'Third Party Cyber Security', null, 4);

  perform public.upsert_framework_domain('SAMA-CSF', '3.1.1', 'Cyber Security Governance', '3.1', 1);
  perform public.upsert_framework_domain('SAMA-CSF', '3.1.2', 'Cyber Security Strategy', '3.1', 2);
  perform public.upsert_framework_domain('SAMA-CSF', '3.1.3', 'Cyber Security Policy', '3.1', 3);
  perform public.upsert_framework_domain('SAMA-CSF', '3.1.4', 'Cyber Security Roles and Responsibilities', '3.1', 4);
  perform public.upsert_framework_domain('SAMA-CSF', '3.1.5', 'Cyber Security in Project Management', '3.1', 5);
  perform public.upsert_framework_domain('SAMA-CSF', '3.1.6', 'Cyber Security Awareness', '3.1', 6);
  perform public.upsert_framework_domain('SAMA-CSF', '3.1.7', 'Cyber Security Training', '3.1', 7);

  perform public.upsert_framework_domain('SAMA-CSF', '3.2.1', 'Cyber Security Risk Management', '3.2', 1);
  perform public.upsert_framework_domain('SAMA-CSF', '3.2.2', 'Regulatory Compliance', '3.2', 2);
  perform public.upsert_framework_domain('SAMA-CSF', '3.2.3', 'Compliance with (inter)national industry standards', '3.2', 3);
  perform public.upsert_framework_domain('SAMA-CSF', '3.2.4', 'Cyber Security Review', '3.2', 4);
  perform public.upsert_framework_domain('SAMA-CSF', '3.2.5', 'Cyber Security Audits', '3.2', 5);

  perform public.upsert_framework_domain('SAMA-CSF', '3.3.1', 'Human Resources', '3.3', 1);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.2', 'Physical Security', '3.3', 2);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.3', 'Asset Management', '3.3', 3);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.4', 'Cyber Security Architecture', '3.3', 4);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.5', 'Identity and Access Management', '3.3', 5);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.6', 'Application Security', '3.3', 6);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.7', 'Change Management', '3.3', 7);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.8', 'Infrastructure Security', '3.3', 8);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.9', 'Cryptography', '3.3', 9);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.10', 'Bring Your Own Device (BYOD)', '3.3', 10);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.11', 'Secure Disposal of Information Assets', '3.3', 11);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.12', 'Payment Systems', '3.3', 12);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.13', 'Electronic Banking Services', '3.3', 13);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.14', 'Cyber Security Event Management', '3.3', 14);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.15', 'Cyber Security Incident Management', '3.3', 15);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.16', 'Threat Management', '3.3', 16);
  perform public.upsert_framework_domain('SAMA-CSF', '3.3.17', 'Vulnerability Management', '3.3', 17);

  perform public.upsert_framework_domain('SAMA-CSF', '3.4.1', 'Contract and Vendor Management', '3.4', 1);
  perform public.upsert_framework_domain('SAMA-CSF', '3.4.2', 'Outsourcing', '3.4', 2);
  perform public.upsert_framework_domain('SAMA-CSF', '3.4.3', 'Cloud Computing', '3.4', 3);
end
$seed$;

-- =============================================================================
-- ISO/IEC 27001:2022 Annex A — 4 themes
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('ISO-27001', 'A.5', 'Organizational controls', null, 1, null,
    '37 controls covering policy, roles, asset and supplier management, incident handling and compliance.');
  perform public.upsert_framework_domain('ISO-27001', 'A.6', 'People controls', null, 2, null,
    '8 controls covering screening, terms of employment, awareness and post-employment obligations.');
  perform public.upsert_framework_domain('ISO-27001', 'A.7', 'Physical controls', null, 3, null,
    '14 controls covering perimeters, entry, equipment and media.');
  perform public.upsert_framework_domain('ISO-27001', 'A.8', 'Technological controls', null, 4, null,
    '34 controls covering endpoints, access, cryptography, networks, development and change.');
end
$seed$;

-- =============================================================================
-- NIST Cybersecurity Framework 2.0 — 6 functions
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('NIST-CSF', 'GV', 'GOVERN', null, 1, null,
    'The cybersecurity risk management strategy, expectations and policy are established, communicated and monitored. Added in version 2.0.');
  perform public.upsert_framework_domain('NIST-CSF', 'ID', 'IDENTIFY', null, 2, null,
    'The organization''s current cybersecurity risks are understood.');
  perform public.upsert_framework_domain('NIST-CSF', 'PR', 'PROTECT', null, 3, null,
    'Safeguards to manage the organization''s cybersecurity risks are used.');
  perform public.upsert_framework_domain('NIST-CSF', 'DE', 'DETECT', null, 4, null,
    'Possible cybersecurity attacks and compromises are found and analysed.');
  perform public.upsert_framework_domain('NIST-CSF', 'RS', 'RESPOND', null, 5, null,
    'Actions regarding a detected cybersecurity incident are taken.');
  perform public.upsert_framework_domain('NIST-CSF', 'RC', 'RECOVER', null, 6, null,
    'Assets and operations affected by a cybersecurity incident are restored.');
end
$seed$;

-- =============================================================================
-- ISO/IEC 42001:2023 — AI management system
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('ISO-42001', 'A.2', 'Policies related to AI', null, 1);
  perform public.upsert_framework_domain('ISO-42001', 'A.3', 'Internal organization', null, 2);
  perform public.upsert_framework_domain('ISO-42001', 'A.4', 'Resources for AI systems', null, 3);
  perform public.upsert_framework_domain('ISO-42001', 'A.5', 'Assessing impacts of AI systems', null, 4);
  perform public.upsert_framework_domain('ISO-42001', 'A.6', 'AI system life cycle', null, 5);
  perform public.upsert_framework_domain('ISO-42001', 'A.7', 'Data for AI systems', null, 6);
  perform public.upsert_framework_domain('ISO-42001', 'A.8', 'Information for interested parties', null, 7);
  perform public.upsert_framework_domain('ISO-42001', 'A.9', 'Use of AI systems', null, 8);
  perform public.upsert_framework_domain('ISO-42001', 'A.10', 'Third-party and customer relationships', null, 9);
end
$seed$;

-- =============================================================================
-- EU AI Act — the chapters that carry operative obligations
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('EU-AI-ACT', 'CH-I', 'Chapter I — General provisions', null, 1, null,
    'Subject matter, scope, definitions, and the Article 4 AI literacy obligation.');
  perform public.upsert_framework_domain('EU-AI-ACT', 'CH-II', 'Chapter II — Prohibited AI practices', null, 2, null,
    'Article 5. Applicable since 2 February 2025.');
  perform public.upsert_framework_domain('EU-AI-ACT', 'CH-III', 'Chapter III — High-risk AI systems', null, 3, null,
    'Classification (Articles 6-7 and Annex III) and the requirements and obligations in Articles 8-27.');
  perform public.upsert_framework_domain('EU-AI-ACT', 'CH-IV', 'Chapter IV — Transparency obligations', null, 4, null,
    'Article 50. Disclosure duties for interaction with AI, synthetic content, emotion recognition and deepfakes.');
  perform public.upsert_framework_domain('EU-AI-ACT', 'CH-V', 'Chapter V — General-purpose AI models', null, 5, null,
    'Articles 51-56, including systemic-risk classification and the obligations attached to it.');
  perform public.upsert_framework_domain('EU-AI-ACT', 'CH-IX', 'Chapter IX — Post-market monitoring and incident reporting', null, 6, null,
    'Articles 72-73, including serious incident reporting.');
end
$seed$;

-- =============================================================================
-- GDPR — the chapters most often assessed
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('EU-GDPR', 'CH-II', 'Chapter II — Principles', null, 1,  null, 'Articles 5-11.');
  perform public.upsert_framework_domain('EU-GDPR', 'CH-III', 'Chapter III — Rights of the data subject', null, 2, null, 'Articles 12-23.');
  perform public.upsert_framework_domain('EU-GDPR', 'CH-IV', 'Chapter IV — Controller and processor', null, 3, null, 'Articles 24-43.');
  perform public.upsert_framework_domain('EU-GDPR', 'CH-V', 'Chapter V — Transfers to third countries', null, 4, null, 'Articles 44-50.');
end
$seed$;

-- =============================================================================
-- Saudi PDPL — thematic obligation groups
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('SA-PDPL', 'LAWFUL', 'Lawful basis and consent', null, 1);
  perform public.upsert_framework_domain('SA-PDPL', 'RIGHTS', 'Data subject rights', null, 2);
  perform public.upsert_framework_domain('SA-PDPL', 'GOVERN', 'Governance and accountability', null, 3);
  perform public.upsert_framework_domain('SA-PDPL', 'SECURITY', 'Security and breach response', null, 4);
  perform public.upsert_framework_domain('SA-PDPL', 'TRANSFER', 'Cross-border transfer', null, 5);
end
$seed$;

-- =============================================================================
-- SDAIA AI Ethics Principles
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('SDAIA-AI-ETHICS', 'PRINCIPLES', 'AI Ethics Principles', null, 1, null,
    'Seven principles applied proportionately to the assessed risk tier of the AI system.');
end
$seed$;

-- =============================================================================
-- PCI DSS v4.0.1 — 6 goals
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('PCI-DSS', 'G1', 'Build and Maintain a Secure Network and Systems', null, 1);
  perform public.upsert_framework_domain('PCI-DSS', 'G2', 'Protect Account Data', null, 2);
  perform public.upsert_framework_domain('PCI-DSS', 'G3', 'Maintain a Vulnerability Management Program', null, 3);
  perform public.upsert_framework_domain('PCI-DSS', 'G4', 'Implement Strong Access Control Measures', null, 4);
  perform public.upsert_framework_domain('PCI-DSS', 'G5', 'Regularly Monitor and Test Networks', null, 5);
  perform public.upsert_framework_domain('PCI-DSS', 'G6', 'Maintain an Information Security Policy', null, 6);
end
$seed$;

-- =============================================================================
-- SOC 2 Trust Services Criteria
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('SOC2', 'TSC', 'Trust Services Criteria', null, 1, null,
    'Security is always in scope; the remaining four categories are elected by the service organisation.');
end
$seed$;

-- =============================================================================
-- ISO 22301 — management system clauses
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('ISO-22301', 'C4', 'Context of the organization', null, 4);
  perform public.upsert_framework_domain('ISO-22301', 'C5', 'Leadership', null, 5);
  perform public.upsert_framework_domain('ISO-22301', 'C6', 'Planning', null, 6);
  perform public.upsert_framework_domain('ISO-22301', 'C7', 'Support', null, 7);
  perform public.upsert_framework_domain('ISO-22301', 'C8', 'Operation', null, 8);
  perform public.upsert_framework_domain('ISO-22301', 'C9', 'Performance evaluation', null, 9);
  perform public.upsert_framework_domain('ISO-22301', 'C10', 'Improvement', null, 10);
end
$seed$;

-- =============================================================================
-- ISO 27701 — PIMS extension
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('ISO-27701', 'A', 'Additional guidance for PII controllers', null, 1);
  perform public.upsert_framework_domain('ISO-27701', 'B', 'Additional guidance for PII processors', null, 2);
end
$seed$;

-- =============================================================================
-- NIST AI RMF 1.0 — 4 functions
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('NIST-AI-RMF', 'GOVERN', 'GOVERN', null, 1, null,
    'A culture of AI risk management is cultivated and present.');
  perform public.upsert_framework_domain('NIST-AI-RMF', 'MAP', 'MAP', null, 2, null,
    'Context is recognised and risks related to that context are identified.');
  perform public.upsert_framework_domain('NIST-AI-RMF', 'MEASURE', 'MEASURE', null, 3, null,
    'Identified risks are assessed, analysed and tracked.');
  perform public.upsert_framework_domain('NIST-AI-RMF', 'MANAGE', 'MANAGE', null, 4, null,
    'Risks are prioritised and acted upon based on projected impact.');
end
$seed$;

-- =============================================================================
-- EU DORA — 5 pillars
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('EU-DORA', 'P1', 'ICT risk management', null, 1, null, 'Articles 5-16.');
  perform public.upsert_framework_domain('EU-DORA', 'P2', 'ICT-related incident management and reporting', null, 2, null, 'Articles 17-23.');
  perform public.upsert_framework_domain('EU-DORA', 'P3', 'Digital operational resilience testing', null, 3, null, 'Articles 24-27.');
  perform public.upsert_framework_domain('EU-DORA', 'P4', 'ICT third-party risk management', null, 4, null, 'Articles 28-44.');
  perform public.upsert_framework_domain('EU-DORA', 'P5', 'Information and intelligence sharing', null, 5, null, 'Article 45.');
end
$seed$;

-- =============================================================================
-- EU NIS2 — Article 21(2) measures
-- =============================================================================

do $seed$
begin
  perform public.upsert_framework_domain('EU-NIS2', 'ART21', 'Article 21(2) — Cybersecurity risk-management measures', null, 1);
  perform public.upsert_framework_domain('EU-NIS2', 'ART23', 'Article 23 — Reporting obligations', null, 2);
end
$seed$;

-- =============================================================================
-- Remaining GCC frameworks — domain outlines used as crosswalk anchors
-- =============================================================================

do $seed$
begin
  -- Qatar NIA
  perform public.upsert_framework_domain('QA-NIA', 'GOV', 'Information security governance', null, 1);
  perform public.upsert_framework_domain('QA-NIA', 'RISK', 'Risk management', null, 2);
  perform public.upsert_framework_domain('QA-NIA', 'CLASS', 'Data labelling and classification', null, 3);
  perform public.upsert_framework_domain('QA-NIA', 'CTRL', 'Security controls', null, 4);
  perform public.upsert_framework_domain('QA-NIA', 'BCM', 'Business continuity', null, 5);
  perform public.upsert_framework_domain('QA-NIA', 'CERT', 'Certification and compliance', null, 6);

  -- UAE Information Assurance
  perform public.upsert_framework_domain('AE-IA', 'M', 'Management controls', null, 1, null,
    'Strategy, risk, awareness, incident management, continuity, compliance and third-party families.');
  perform public.upsert_framework_domain('AE-IA', 'T', 'Technical controls', null, 2, null,
    'Access control, cryptography, communications, operations, physical and system acquisition families.');

  -- CBUAE
  perform public.upsert_framework_domain('CBUAE-ISS', 'GOV', 'Governance and oversight', null, 1);
  perform public.upsert_framework_domain('CBUAE-ISS', 'SEC', 'Information security', null, 2);
  perform public.upsert_framework_domain('CBUAE-ISS', 'RES', 'Operational resilience and continuity', null, 3);
  perform public.upsert_framework_domain('CBUAE-ISS', 'OUT', 'Outsourcing and third parties', null, 4);
  perform public.upsert_framework_domain('CBUAE-ISS', 'INC', 'Incident reporting', null, 5);

  -- QCB
  perform public.upsert_framework_domain('QCB-TRC', 'GOV', 'Technology governance', null, 1);
  perform public.upsert_framework_domain('QCB-TRC', 'SEC', 'Information security', null, 2);
  perform public.upsert_framework_domain('QCB-TRC', 'OUT', 'Outsourcing and cloud', null, 3);
  perform public.upsert_framework_domain('QCB-TRC', 'INC', 'Incident management and reporting', null, 4);

  -- CBJ
  perform public.upsert_framework_domain('CBJ-CSF', 'GOV', 'Governance and accountability', null, 1);
  perform public.upsert_framework_domain('CBJ-CSF', 'SEC', 'Information security controls', null, 2);
  perform public.upsert_framework_domain('CBJ-CSF', 'RES', 'Cyber resilience and continuity', null, 3);
  perform public.upsert_framework_domain('CBJ-CSF', 'INC', 'Incident reporting to the Central Bank', null, 4);

  -- Jordan national framework
  perform public.upsert_framework_domain('JO-NCSF', 'GOV', 'National governance and sector obligations', null, 1);
  perform public.upsert_framework_domain('JO-NCSF', 'CTRL', 'Baseline security controls', null, 2);
  perform public.upsert_framework_domain('JO-NCSF', 'INC', 'Incident reporting to the NCSC', null, 3);

  -- CBB
  perform public.upsert_framework_domain('CBB-OM5', 'OM', 'Operational risk management', null, 1);
  perform public.upsert_framework_domain('CBB-OM5', 'CYB', 'Cyber security', null, 2);
  perform public.upsert_framework_domain('CBB-OM5', 'OUT', 'Outsourcing', null, 3);

  -- CITRA
  perform public.upsert_framework_domain('KW-CITRA-CSF', 'GOV', 'Governance', null, 1);
  perform public.upsert_framework_domain('KW-CITRA-CSF', 'CTRL', 'Security controls', null, 2);
  perform public.upsert_framework_domain('KW-CITRA-CSF', 'CLOUD', 'Cloud and data classification', null, 3);

  -- DESC
  perform public.upsert_framework_domain('AE-DESC-DCS', 'GOV', 'Governance', null, 1);
  perform public.upsert_framework_domain('AE-DESC-DCS', 'CTRL', 'Security controls', null, 2);

  -- SAMA BCM / ITGF
  perform public.upsert_framework_domain('SAMA-BCM', 'GOV', 'BCM governance', null, 1);
  perform public.upsert_framework_domain('SAMA-BCM', 'BIA', 'Business impact analysis and recovery objectives', null, 2);
  perform public.upsert_framework_domain('SAMA-BCM', 'TEST', 'Testing and exercising', null, 3);
  perform public.upsert_framework_domain('SAMA-ITGF', 'GOV', 'IT governance', null, 1);
  perform public.upsert_framework_domain('SAMA-ITGF', 'SVC', 'IT service management', null, 2);

  -- NCA extension control sets
  perform public.upsert_framework_domain('NCA-CCC', 'CSP', 'Cloud service provider controls', null, 1);
  perform public.upsert_framework_domain('NCA-CCC', 'CST', 'Cloud service tenant controls', null, 2);
  perform public.upsert_framework_domain('NCA-DCC', 'LIFECYCLE', 'Data lifecycle protection', null, 1);
  perform public.upsert_framework_domain('NCA-CSCC', 'CS', 'Critical systems controls', null, 1);
  perform public.upsert_framework_domain('NCA-OTCC', 'OT', 'Operational technology controls', null, 1);
  perform public.upsert_framework_domain('NCA-TCC', 'TW', 'Telework controls', null, 1);

  -- Privacy laws: shared thematic outline so crosswalks between them are possible
  perform public.upsert_framework_domain('QA-PDPPL', 'CORE', 'Core obligations', null, 1);
  perform public.upsert_framework_domain('AE-PDPL', 'CORE', 'Core obligations', null, 1);
  perform public.upsert_framework_domain('AE-DIFC-DPL', 'CORE', 'Core obligations', null, 1);
  perform public.upsert_framework_domain('AE-DIFC-DPL', 'AUTO', 'Autonomous and semi-autonomous systems', null, 2);
  perform public.upsert_framework_domain('AE-ADGM-DPR', 'CORE', 'Core obligations', null, 1);
  perform public.upsert_framework_domain('JO-PDPL', 'CORE', 'Core obligations', null, 1);
  perform public.upsert_framework_domain('BH-PDPL', 'CORE', 'Core obligations', null, 1);
  perform public.upsert_framework_domain('OM-PDPL', 'CORE', 'Core obligations', null, 1);
  perform public.upsert_framework_domain('KW-CITRA-DPPR', 'CORE', 'Core obligations', null, 1);
  perform public.upsert_framework_domain('SDAIA-GENAI', 'CORE', 'Generative AI adoption guidance', null, 1);
end
$seed$;
