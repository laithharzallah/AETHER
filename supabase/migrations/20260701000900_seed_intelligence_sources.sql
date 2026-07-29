-- =============================================================================
-- Seed: intelligence sources
--
-- Where the Machine looks. `authority_tier` is what separates a binding
-- instrument from commentary, and it feeds directly into signal confidence:
--
--   1  the regulator or legislature itself — binding
--   2  a national agency or standards body — authoritative guidance
--   3  aggregators and commentary — leading indicators, corroboration required
--
-- `fetch_strategy` is set honestly per source. Most GCC regulators publish to
-- HTML index pages with no feed, so `html_index` (fetch the listing, diff it
-- against what we have seen) is the norm rather than the exception. Sources
-- marked `manual` are tracked for completeness but require an analyst to file
-- the item; the ingest phase skips them instead of pretending to poll.
-- =============================================================================

insert into public.intelligence_sources (
  name, type, url, feed_url, country, regulator, fetch_strategy,
  authority_tier, frameworks, sectors, languages, poll_interval_minutes,
  active, notes
) values

-- ---------------------------------------------------------------------------
-- Saudi Arabia
-- ---------------------------------------------------------------------------
('National Cybersecurity Authority', 'regulator', 'https://nca.gov.sa', null, 'SA', 'NCA',
 'html_index', 1, '{NCA-ECC,NCA-CSCC,NCA-CCC,NCA-DCC,NCA-OTCC,NCA-TCC}',
 '{government,banking,energy,healthcare,telecom,critical_infrastructure}', '{ar,en}', 360, true,
 'Publishes control framework revisions and national directives. No feed; the news and regulations listings are diffed.'),

('Saudi Central Bank (SAMA)', 'regulator', 'https://www.sama.gov.sa', null, 'SA', 'SAMA',
 'html_index', 1, '{SAMA-CSF,SAMA-BCM,SAMA-ITGF}',
 '{banking,insurance,financial_services,payments,fintech}', '{ar,en}', 240, true,
 'Circulars and rules for member organisations. Circulars are the operative instrument and often carry short compliance deadlines.'),

('Saudi Data and AI Authority', 'regulator', 'https://sdaia.gov.sa', null, 'SA', 'SDAIA',
 'html_index', 1, '{SA-PDPL,SDAIA-AI-ETHICS,SDAIA-GENAI}',
 '{all}', '{ar,en}', 360, true,
 'PDPL implementing regulations, AI ethics guidance and generative AI guidelines.'),

('Communications, Space and Technology Commission', 'regulator', 'https://www.cst.gov.sa', null, 'SA', 'CST',
 'html_index', 2, '{}', '{telecom,technology}', '{ar,en}', 720, true,
 'Telecom and cloud regulatory framework, including the Cloud Computing Regulatory Framework.'),

('Capital Market Authority (Saudi Arabia)', 'regulator', 'https://cma.org.sa', null, 'SA', 'CMA',
 'html_index', 1, '{}', '{financial_services,capital_markets}', '{ar,en}', 720, true,
 'Rules for capital market institutions, including technology and outsourcing requirements.'),

-- ---------------------------------------------------------------------------
-- Qatar
-- ---------------------------------------------------------------------------
('Qatar National Cyber Security Agency', 'regulator', 'https://www.ncsa.gov.qa', null, 'QA', 'NCSA',
 'html_index', 1, '{QA-NIA}',
 '{government,energy,telecom,banking,critical_infrastructure}', '{ar,en}', 360, true,
 'National Information Assurance standard, advisories and sector directives.'),

('Qatar Central Bank', 'regulator', 'https://www.qcb.gov.qa', null, 'QA', 'QCB',
 'html_index', 1, '{QCB-TRC}',
 '{banking,insurance,financial_services,payments}', '{ar,en}', 360, true,
 'Circulars and rulebook updates for licensed financial institutions.'),

('Qatar Ministry of Communications and Information Technology', 'regulator', 'https://www.mcit.gov.qa', null, 'QA', 'MCIT',
 'html_index', 2, '{QA-PDPPL}', '{all}', '{ar,en}', 720, true,
 'PDPPL guidance and implementing decisions.'),

-- ---------------------------------------------------------------------------
-- United Arab Emirates
-- ---------------------------------------------------------------------------
('UAE Cybersecurity Council', 'regulator', 'https://csc.gov.ae', null, 'AE', 'CSC',
 'html_index', 1, '{AE-IA}',
 '{government,energy,telecom,banking,critical_infrastructure}', '{ar,en}', 360, true,
 'National cybersecurity policy, standards and advisories.'),

('Telecommunications and Digital Government Regulatory Authority', 'regulator', 'https://tdra.gov.ae', null, 'AE', 'TDRA',
 'html_index', 1, '{AE-IA}', '{government,telecom}', '{ar,en}', 720, true,
 'Information Assurance Regulation and related standards.'),

('Central Bank of the UAE', 'regulator', 'https://www.centralbank.ae', null, 'AE', 'CBUAE',
 'html_index', 1, '{CBUAE-ISS}',
 '{banking,insurance,financial_services,payments,fintech}', '{ar,en}', 360, true,
 'Notices, standards and regulations for licensed financial institutions.'),

('UAE Data Office', 'regulator', 'https://u.ae', null, 'AE', 'UAE-DO',
 'html_index', 2, '{AE-PDPL}', '{all}', '{ar,en}', 1440, true,
 'Federal PDPL executive regulations and guidance.'),

('DIFC Commissioner of Data Protection', 'regulator', 'https://www.difc.ae', null, 'AE-DIFC', 'DIFC',
 'html_index', 1, '{AE-DIFC-DPL}',
 '{banking,financial_services,insurance,professional_services}', '{en}', 720, true,
 'DIFC Data Protection Law amendments, regulations and Commissioner guidance including Regulation 10 on autonomous systems.'),

('ADGM Office of Data Protection', 'regulator', 'https://www.adgm.com', null, 'AE-ADGM', 'ADGM',
 'html_index', 1, '{AE-ADGM-DPR}',
 '{banking,financial_services,insurance,professional_services}', '{en}', 720, true,
 'ADGM Data Protection Regulations and guidance.'),

('Dubai Electronic Security Center', 'regulator', 'https://www.desc.gov.ae', null, 'AE', 'DESC',
 'html_index', 1, '{AE-DESC-DCS}',
 '{government,telecom,transport,energy,critical_infrastructure}', '{ar,en}', 720, true,
 'Dubai Cyber Security Standard updates and Dubai government advisories.'),

-- ---------------------------------------------------------------------------
-- Jordan
-- ---------------------------------------------------------------------------
('Central Bank of Jordan', 'regulator', 'https://www.cbj.gov.jo', null, 'JO', 'CBJ',
 'html_index', 1, '{CBJ-CSF}',
 '{banking,financial_services,payments,fintech}', '{ar,en}', 360, true,
 'Instructions and circulars on information security and cyber resilience.'),

('Jordan National Cyber Security Centre', 'regulator', 'https://www.ncsc.jo', null, 'JO', 'NCSC-JO',
 'html_index', 1, '{JO-NCSF}',
 '{government,banking,energy,telecom,healthcare,critical_infrastructure}', '{ar,en}', 360, true,
 'National framework updates, advisories and incident reporting requirements.'),

('Jordan Ministry of Digital Economy and Entrepreneurship', 'regulator', 'https://www.modee.gov.jo', null, 'JO', 'MoDEE',
 'html_index', 2, '{JO-PDPL}', '{all}', '{ar,en}', 1440, true,
 'Personal Data Protection Law implementation, regulations and Council decisions.'),

-- ---------------------------------------------------------------------------
-- Kuwait, Bahrain, Oman
-- ---------------------------------------------------------------------------
('Communication and Information Technology Regulatory Authority (Kuwait)', 'regulator', 'https://citra.gov.kw', null, 'KW', 'CITRA',
 'html_index', 1, '{KW-CITRA-CSF,KW-CITRA-DPPR}',
 '{government,telecom,banking,critical_infrastructure}', '{ar,en}', 720, true,
 'Cybersecurity framework, cloud regulation and data privacy regulation.'),

('Central Bank of Kuwait', 'regulator', 'https://www.cbk.gov.kw', null, 'KW', 'CBK',
 'html_index', 1, '{}', '{banking,financial_services,payments}', '{ar,en}', 720, true,
 'Cybersecurity framework and instructions for Kuwaiti banks.'),

('Central Bank of Bahrain', 'regulator', 'https://www.cbb.gov.bh', null, 'BH', 'CBB',
 'html_index', 1, '{CBB-OM5}',
 '{banking,insurance,financial_services,payments}', '{ar,en}', 360, true,
 'Rulebook volumes and circulars, including the operational risk and cyber security modules.'),

('Bahrain Personal Data Protection Authority', 'regulator', 'https://www.pdp.gov.bh', null, 'BH', 'PDPA-BH',
 'html_index', 2, '{BH-PDPL}', '{all}', '{ar,en}', 1440, true,
 'PDPL guidance, notification and prior-approval requirements.'),

('Central Bank of Oman', 'regulator', 'https://cbo.gov.om', null, 'OM', 'CBO',
 'html_index', 1, '{}', '{banking,financial_services,payments}', '{ar,en}', 720, true,
 'Circulars covering technology and cyber risk for licensed banks.'),

('Oman Ministry of Transport, Communications and IT', 'regulator', 'https://www.mtcit.gov.om', null, 'OM', 'MTCIT',
 'html_index', 2, '{OM-PDPL}', '{all}', '{ar,en}', 1440, true,
 'Personal Data Protection Law executive regulations and guidance.'),

-- ---------------------------------------------------------------------------
-- European Union — extraterritorial reach
-- ---------------------------------------------------------------------------
('EUR-Lex — Official Journal of the EU', 'legislature', 'https://eur-lex.europa.eu', null, 'EU', 'EU',
 'html_index', 1, '{EU-GDPR,EU-AI-ACT,EU-DORA,EU-NIS2}', '{all}', '{en}', 720, true,
 'Authoritative source for EU legal instruments and their amendments.'),

('European Data Protection Board', 'regulator', 'https://www.edpb.europa.eu', null, 'EU', 'EDPB',
 'html_index', 1, '{EU-GDPR}', '{all}', '{en}', 720, true,
 'Guidelines, recommendations and binding decisions interpreting the GDPR.'),

('European Commission — AI Office and AI Act implementation', 'regulator', 'https://digital-strategy.ec.europa.eu', null, 'EU', 'EC',
 'html_index', 1, '{EU-AI-ACT}', '{all}', '{en}', 720, true,
 'Codes of practice, guidelines and implementing acts under the AI Act.'),

('European Union Agency for Cybersecurity', 'agency', 'https://www.enisa.europa.eu', null, 'EU', 'ENISA',
 'html_index', 2, '{EU-NIS2}',
 '{energy,transport,banking,healthcare,telecom,digital_infrastructure}', '{en}', 720, true,
 'Threat landscape reporting and NIS2 implementation guidance.'),

-- ---------------------------------------------------------------------------
-- Standards bodies and threat intelligence
-- ---------------------------------------------------------------------------
('NIST Cybersecurity and AI frameworks', 'standards_body', 'https://www.nist.gov', null, 'US', 'NIST',
 'html_index', 2, '{NIST-CSF,NIST-AI-RMF}', '{all}', '{en}', 1440, true,
 'Framework revisions, profiles and implementation examples.'),

('CISA Cybersecurity Advisories', 'threat_intel', 'https://www.cisa.gov/news-events/cybersecurity-advisories',
 'https://www.cisa.gov/cybersecurity-advisories/all.xml', 'US', 'CISA',
 'rss', 2, '{}', '{all}', '{en}', 120, true,
 'Advisories, alerts and ICS advisories. One of the few sources in this list with a real feed, so it polls frequently.'),

('NIST National Vulnerability Database', 'threat_intel', 'https://nvd.nist.gov', null, 'US', 'NIST',
 'json', 2, '{}', '{all}', '{en}', 180, true,
 'CVE records with CVSS scoring, used to corroborate vulnerability-driven signals.'),

('ISO — standards catalogue', 'standards_body', 'https://www.iso.org', null, 'GLOBAL', 'ISO',
 'html_index', 2, '{ISO-27001,ISO-27701,ISO-42001,ISO-22301}', '{all}', '{en}', 10080, true,
 'Standard revisions, amendments and withdrawal notices.'),

('PCI Security Standards Council', 'standards_body', 'https://www.pcisecuritystandards.org', null, 'GLOBAL', 'PCI-SSC',
 'html_index', 2, '{PCI-DSS}',
 '{banking,payments,retail,ecommerce,fintech}', '{en}', 1440, true,
 'Standard revisions, bulletins and FAQ updates that change assessment expectations.'),

('GCC Standardization Organization', 'standards_body', 'https://www.gso.org.sa', null, 'GLOBAL', 'GSO',
 'html_index', 3, '{}', '{all}', '{ar,en}', 10080, true,
 'Regional standards adoption across GCC member states.')

on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Give every source a state row so the first cycle has a cursor to advance.
-- ---------------------------------------------------------------------------

insert into public.intelligence_source_state (source_id)
select id from public.intelligence_sources
on conflict (source_id) do nothing;

-- ---------------------------------------------------------------------------
-- Platform modules
-- ---------------------------------------------------------------------------

insert into public.modules (slug, name, description, status) values
  ('risk-horizon',     'Risk Horizon',
   'Continuous regulatory and threat intelligence, scored for relevance to your organisation.', 'available'),
  ('policy-generator', 'Policy Generator',
   'Draft board-grade policies aligned to the frameworks you are assessed against.', 'available'),
  ('policies',         'Policy Management',
   'Policy lifecycle, versioning, approvals and framework coverage mapping.', 'available'),
  ('compliance',       'Compliance Posture',
   'Control library, assessments and framework coverage across every applicable framework.', 'available'),
  ('risk-register',    'Risk Register',
   'Inherent and residual risk scoring with treatment plans.', 'available'),
  ('obligations',      'Obligation Calendar',
   'Recurring regulatory duties with owners, deadlines and evidence requirements.', 'available'),
  ('ai-governance',    'AI Governance',
   'AI system inventory with EU AI Act and SDAIA risk classification.', 'available'),
  ('third-party',      'Third-Party Risk',
   'Vendor inventory, criticality and assessment status.', 'available'),
  ('audit-trail',      'Audit Trail',
   'Tamper-evident, hash-chained record of every action, verifiable on demand.', 'available'),
  ('machine',          'The Machine',
   'The autonomous engine: ingest, analyse, correlate, decide, dispatch.', 'available'),
  ('briefs',           'Board Briefs',
   'Periodic board and client reporting packs assembled from platform state.', 'beta')
on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  status      = excluded.status;
