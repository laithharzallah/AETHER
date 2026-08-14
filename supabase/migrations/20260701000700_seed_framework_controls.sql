-- =============================================================================
-- Seed: framework control catalogues
--
-- ISO/IEC 27001:2022 Annex A is encoded in full (all 93 controls) because it is
-- the pivot every other framework is crosswalked through. NIST CSF 2.0 is
-- encoded at category level, and NCA ECC and SAMA CSF at subdomain level —
-- which is the granularity those frameworks are actually cited at.
--
-- Every control carries `tags` drawn from one shared vocabulary. That is what
-- lets the Machine correlate a regulatory signal to controls across frameworks
-- even where no explicit crosswalk edge exists.
-- =============================================================================

-- =============================================================================
-- ISO/IEC 27001:2022 Annex A — 93 controls
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      -- A.5 Organizational controls (37)
      ('A.5.1',  'Policies for information security',                                        'A.5', 'governance',     array['governance','policy'],                       1),
      ('A.5.2',  'Information security roles and responsibilities',                          'A.5', 'governance',     array['governance','roles'],                        2),
      ('A.5.3',  'Segregation of duties',                                                    'A.5', 'administrative', array['access_control','governance'],               3),
      ('A.5.4',  'Management responsibilities',                                              'A.5', 'governance',     array['governance'],                                4),
      ('A.5.5',  'Contact with authorities',                                                 'A.5', 'governance',     array['governance','incident_response'],            5),
      ('A.5.6',  'Contact with special interest groups',                                     'A.5', 'governance',     array['threat_intel'],                              6),
      ('A.5.7',  'Threat intelligence',                                                      'A.5', 'technical',      array['threat_intel','monitoring'],                 7),
      ('A.5.8',  'Information security in project management',                                'A.5', 'governance',     array['governance','change_management'],            8),
      ('A.5.9',  'Inventory of information and other associated assets',                     'A.5', 'administrative', array['asset_management'],                          9),
      ('A.5.10', 'Acceptable use of information and other associated assets',                'A.5', 'administrative', array['asset_management','policy'],                10),
      ('A.5.11', 'Return of assets',                                                         'A.5', 'administrative', array['asset_management','hr_security'],           11),
      ('A.5.12', 'Classification of information',                                            'A.5', 'administrative', array['data_classification'],                      12),
      ('A.5.13', 'Labelling of information',                                                 'A.5', 'administrative', array['data_classification'],                      13),
      ('A.5.14', 'Information transfer',                                                     'A.5', 'technical',      array['data_protection','cryptography'],           14),
      ('A.5.15', 'Access control',                                                           'A.5', 'technical',      array['access_control'],                           15),
      ('A.5.16', 'Identity management',                                                      'A.5', 'technical',      array['identity','access_control'],                16),
      ('A.5.17', 'Authentication information',                                               'A.5', 'technical',      array['authentication','identity'],                17),
      ('A.5.18', 'Access rights',                                                            'A.5', 'technical',      array['access_control','identity'],                18),
      ('A.5.19', 'Information security in supplier relationships',                           'A.5', 'administrative', array['third_party','supply_chain'],               19),
      ('A.5.20', 'Addressing information security within supplier agreements',               'A.5', 'legal',          array['third_party','supply_chain'],               20),
      ('A.5.21', 'Managing information security in the ICT supply chain',                    'A.5', 'administrative', array['supply_chain','third_party'],               21),
      ('A.5.22', 'Monitoring, review and change management of supplier services',            'A.5', 'administrative', array['third_party','outsourcing'],                22),
      ('A.5.23', 'Information security for use of cloud services',                           'A.5', 'technical',      array['cloud','third_party'],                      23),
      ('A.5.24', 'Information security incident management planning and preparation',        'A.5', 'administrative', array['incident_response'],                        24),
      ('A.5.25', 'Assessment and decision on information security events',                   'A.5', 'administrative', array['incident_response','monitoring'],           25),
      ('A.5.26', 'Response to information security incidents',                               'A.5', 'administrative', array['incident_response'],                        26),
      ('A.5.27', 'Learning from information security incidents',                             'A.5', 'administrative', array['incident_response'],                        27),
      ('A.5.28', 'Collection of evidence',                                                   'A.5', 'administrative', array['incident_response','forensics'],            28),
      ('A.5.29', 'Information security during disruption',                                   'A.5', 'administrative', array['continuity'],                              29),
      ('A.5.30', 'ICT readiness for business continuity',                                    'A.5', 'technical',      array['continuity','recovery'],                    30),
      ('A.5.31', 'Legal, statutory, regulatory and contractual requirements',                'A.5', 'legal',          array['compliance'],                               31),
      ('A.5.32', 'Intellectual property rights',                                             'A.5', 'legal',          array['compliance'],                               32),
      ('A.5.33', 'Protection of records',                                                    'A.5', 'administrative', array['data_protection','compliance'],             33),
      ('A.5.34', 'Privacy and protection of PII',                                            'A.5', 'legal',          array['privacy','data_protection'],                34),
      ('A.5.35', 'Independent review of information security',                                'A.5', 'governance',     array['audit','compliance'],                       35),
      ('A.5.36', 'Compliance with policies, rules and standards for information security',   'A.5', 'governance',     array['compliance','audit'],                       36),
      ('A.5.37', 'Documented operating procedures',                                          'A.5', 'administrative', array['governance','policy'],                      37),

      -- A.6 People controls (8)
      ('A.6.1',  'Screening',                                                                'A.6', 'administrative', array['hr_security'],                              1),
      ('A.6.2',  'Terms and conditions of employment',                                       'A.6', 'legal',          array['hr_security'],                              2),
      ('A.6.3',  'Information security awareness, education and training',                   'A.6', 'administrative', array['awareness','training'],                     3),
      ('A.6.4',  'Disciplinary process',                                                     'A.6', 'administrative', array['hr_security'],                              4),
      ('A.6.5',  'Responsibilities after termination or change of employment',               'A.6', 'administrative', array['hr_security','access_control'],             5),
      ('A.6.6',  'Confidentiality or non-disclosure agreements',                             'A.6', 'legal',          array['hr_security','third_party'],                6),
      ('A.6.7',  'Remote working',                                                           'A.6', 'technical',      array['teleworking','endpoint'],                   7),
      ('A.6.8',  'Information security event reporting',                                     'A.6', 'administrative', array['incident_response','awareness'],            8),

      -- A.7 Physical controls (14)
      ('A.7.1',  'Physical security perimeters',                                             'A.7', 'physical',       array['physical'],                                 1),
      ('A.7.2',  'Physical entry',                                                           'A.7', 'physical',       array['physical','access_control'],                2),
      ('A.7.3',  'Securing offices, rooms and facilities',                                   'A.7', 'physical',       array['physical'],                                 3),
      ('A.7.4',  'Physical security monitoring',                                             'A.7', 'physical',       array['physical','monitoring'],                    4),
      ('A.7.5',  'Protecting against physical and environmental threats',                    'A.7', 'physical',       array['physical','continuity'],                    5),
      ('A.7.6',  'Working in secure areas',                                                  'A.7', 'physical',       array['physical'],                                 6),
      ('A.7.7',  'Clear desk and clear screen',                                              'A.7', 'physical',       array['physical','data_protection'],               7),
      ('A.7.8',  'Equipment siting and protection',                                          'A.7', 'physical',       array['physical','asset_management'],              8),
      ('A.7.9',  'Security of assets off-premises',                                          'A.7', 'physical',       array['physical','mobile','asset_management'],     9),
      ('A.7.10', 'Storage media',                                                            'A.7', 'physical',       array['media','data_protection'],                 10),
      ('A.7.11', 'Supporting utilities',                                                     'A.7', 'physical',       array['physical','continuity'],                   11),
      ('A.7.12', 'Cabling security',                                                         'A.7', 'physical',       array['physical','network_security'],             12),
      ('A.7.13', 'Equipment maintenance',                                                    'A.7', 'physical',       array['physical','asset_management'],             13),
      ('A.7.14', 'Secure disposal or re-use of equipment',                                   'A.7', 'physical',       array['secure_disposal','media'],                 14),

      -- A.8 Technological controls (34)
      ('A.8.1',  'User end point devices',                                                   'A.8', 'technical',      array['endpoint','mobile'],                        1),
      ('A.8.2',  'Privileged access rights',                                                 'A.8', 'technical',      array['privileged_access','access_control'],       2),
      ('A.8.3',  'Information access restriction',                                           'A.8', 'technical',      array['access_control','data_protection'],         3),
      ('A.8.4',  'Access to source code',                                                    'A.8', 'technical',      array['access_control','secure_development'],      4),
      ('A.8.5',  'Secure authentication',                                                    'A.8', 'technical',      array['authentication','identity'],               5),
      ('A.8.6',  'Capacity management',                                                      'A.8', 'technical',      array['capacity','continuity'],                    6),
      ('A.8.7',  'Protection against malware',                                               'A.8', 'technical',      array['malware','endpoint'],                       7),
      ('A.8.8',  'Management of technical vulnerabilities',                                  'A.8', 'technical',      array['vulnerability','patching'],                 8),
      ('A.8.9',  'Configuration management',                                                 'A.8', 'technical',      array['configuration','change_management'],        9),
      ('A.8.10', 'Information deletion',                                                     'A.8', 'technical',      array['secure_disposal','data_protection'],       10),
      ('A.8.11', 'Data masking',                                                             'A.8', 'technical',      array['data_protection','privacy'],               11),
      ('A.8.12', 'Data leakage prevention',                                                  'A.8', 'technical',      array['dlp','data_protection'],                   12),
      ('A.8.13', 'Information backup',                                                       'A.8', 'technical',      array['backup','recovery'],                       13),
      ('A.8.14', 'Redundancy of information processing facilities',                           'A.8', 'technical',      array['redundancy','continuity'],                 14),
      ('A.8.15', 'Logging',                                                                  'A.8', 'technical',      array['logging','monitoring'],                    15),
      ('A.8.16', 'Monitoring activities',                                                    'A.8', 'technical',      array['monitoring','siem'],                       16),
      ('A.8.17', 'Clock synchronization',                                                    'A.8', 'technical',      array['clock_sync','logging'],                    17),
      ('A.8.18', 'Use of privileged utility programs',                                       'A.8', 'technical',      array['privileged_access'],                       18),
      ('A.8.19', 'Installation of software on operational systems',                          'A.8', 'technical',      array['configuration','change_management'],       19),
      ('A.8.20', 'Networks security',                                                        'A.8', 'technical',      array['network_security'],                        20),
      ('A.8.21', 'Security of network services',                                             'A.8', 'technical',      array['network_security'],                        21),
      ('A.8.22', 'Segregation of networks',                                                  'A.8', 'technical',      array['segmentation','network_security'],          22),
      ('A.8.23', 'Web filtering',                                                            'A.8', 'technical',      array['web_filtering','network_security'],         23),
      ('A.8.24', 'Use of cryptography',                                                      'A.8', 'technical',      array['cryptography','key_management'],           24),
      ('A.8.25', 'Secure development life cycle',                                             'A.8', 'technical',      array['secure_development'],                      25),
      ('A.8.26', 'Application security requirements',                                        'A.8', 'technical',      array['appsec','secure_development'],             26),
      ('A.8.27', 'Secure system architecture and engineering principles',                    'A.8', 'technical',      array['secure_development','architecture'],       27),
      ('A.8.28', 'Secure coding',                                                            'A.8', 'technical',      array['secure_development','appsec'],             28),
      ('A.8.29', 'Security testing in development and acceptance',                            'A.8', 'technical',      array['secure_development','pentest'],            29),
      ('A.8.30', 'Outsourced development',                                                   'A.8', 'administrative', array['secure_development','third_party'],        30),
      ('A.8.31', 'Separation of development, test and production environments',              'A.8', 'technical',      array['segmentation','change_management'],        31),
      ('A.8.32', 'Change management',                                                        'A.8', 'technical',      array['change_management'],                       32),
      ('A.8.33', 'Test information',                                                         'A.8', 'technical',      array['data_protection','secure_development'],    33),
      ('A.8.34', 'Protection of information systems during audit testing',                    'A.8', 'technical',      array['audit'],                                   34)
    ) as t(code, title, domain, ctype, tags, ord)
  loop
    perform public.upsert_framework_control(
      'ISO-27001', r.code, r.title, r.domain, r.ctype, '{}'::text[], r.tags, r.ord
    );
  end loop;
end
$seed$;

-- =============================================================================
-- NIST Cybersecurity Framework 2.0 — 22 categories
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('GV.OC', 'Organizational Context',                                'GV', array['governance','compliance'],                  1),
      ('GV.RM', 'Risk Management Strategy',                              'GV', array['risk_management','governance'],             2),
      ('GV.RR', 'Roles, Responsibilities, and Authorities',              'GV', array['governance','roles'],                       3),
      ('GV.PO', 'Policy',                                                'GV', array['policy','governance'],                      4),
      ('GV.OV', 'Oversight',                                             'GV', array['governance','audit'],                       5),
      ('GV.SC', 'Cybersecurity Supply Chain Risk Management',            'GV', array['supply_chain','third_party'],               6),
      ('ID.AM', 'Asset Management',                                      'ID', array['asset_management'],                         1),
      ('ID.RA', 'Risk Assessment',                                       'ID', array['risk_management','vulnerability'],          2),
      ('ID.IM', 'Improvement',                                           'ID', array['governance','audit'],                       3),
      ('PR.AA', 'Identity Management, Authentication, and Access Control','PR', array['identity','access_control','authentication'],1),
      ('PR.AT', 'Awareness and Training',                                'PR', array['awareness','training'],                     2),
      ('PR.DS', 'Data Security',                                         'PR', array['data_protection','cryptography'],           3),
      ('PR.PS', 'Platform Security',                                     'PR', array['configuration','patching','endpoint'],      4),
      ('PR.IR', 'Technology Infrastructure Resilience',                  'PR', array['network_security','redundancy','continuity'],5),
      ('DE.CM', 'Continuous Monitoring',                                 'DE', array['monitoring','logging','siem'],              1),
      ('DE.AE', 'Adverse Event Analysis',                                'DE', array['monitoring','incident_response'],           2),
      ('RS.MA', 'Incident Management',                                   'RS', array['incident_response'],                        1),
      ('RS.AN', 'Incident Analysis',                                     'RS', array['incident_response','forensics'],            2),
      ('RS.CO', 'Incident Response Reporting and Communication',         'RS', array['incident_response','breach_notification'],   3),
      ('RS.MI', 'Incident Mitigation',                                   'RS', array['incident_response'],                        4),
      ('RC.RP', 'Incident Recovery Plan Execution',                      'RC', array['recovery','continuity'],                    1),
      ('RC.CO', 'Incident Recovery Communication',                       'RC', array['recovery','incident_response'],             2)
    ) as t(code, title, domain, tags, ord)
  loop
    perform public.upsert_framework_control(
      'NIST-CSF', r.code, r.title, r.domain, 'governance', '{}'::text[], r.tags, r.ord
    );
  end loop;
end
$seed$;

-- =============================================================================
-- NCA Essential Cybersecurity Controls — subdomain anchors
--
-- The ECC numbers individual controls as <domain>-<subdomain>-<n>. Anchoring at
-- subdomain level keeps every code verifiable against the published document
-- while still giving the crosswalk graph something precise to attach to.
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('1-1',  'Cybersecurity Strategy',                                                'governance',     array['governance','policy'],                      1),
      ('1-2',  'Cybersecurity Management',                                              'governance',     array['governance','roles'],                       2),
      ('1-3',  'Cybersecurity Policies and Procedures',                                 'governance',     array['policy','governance'],                      3),
      ('1-4',  'Cybersecurity Roles and Responsibilities',                              'governance',     array['governance','roles'],                       4),
      ('1-5',  'Cybersecurity Risk Management',                                         'governance',     array['risk_management'],                          5),
      ('1-6',  'Cybersecurity in Information and Technology Project Management',         'governance',     array['change_management','secure_development'],   6),
      ('1-7',  'Compliance with Cybersecurity Standards, Laws and Regulations',          'legal',          array['compliance'],                               7),
      ('1-8',  'Periodical Cybersecurity Review and Audit',                              'governance',     array['audit','compliance'],                       8),
      ('1-9',  'Cybersecurity in Human Resources',                                      'administrative', array['hr_security'],                              9),
      ('1-10', 'Cybersecurity Awareness and Training Program',                           'administrative', array['awareness','training'],                    10),
      ('2-1',  'Asset Management',                                                      'administrative', array['asset_management'],                        11),
      ('2-2',  'Identity and Access Management',                                        'technical',      array['identity','access_control','authentication'],12),
      ('2-3',  'Information System and Information Processing Facilities Protection',   'technical',      array['endpoint','malware','configuration'],      13),
      ('2-4',  'Email Protection',                                                      'technical',      array['email_security'],                          14),
      ('2-5',  'Networks Security Management',                                          'technical',      array['network_security','segmentation'],         15),
      ('2-6',  'Mobile Devices Security',                                               'technical',      array['mobile','byod','endpoint'],                16),
      ('2-7',  'Data and Information Protection',                                       'technical',      array['data_protection','data_classification'],   17),
      ('2-8',  'Cryptography',                                                          'technical',      array['cryptography','key_management'],           18),
      ('2-9',  'Backup and Recovery Management',                                        'technical',      array['backup','recovery'],                       19),
      ('2-10', 'Vulnerabilities Management',                                            'technical',      array['vulnerability','patching'],                20),
      ('2-11', 'Penetration Testing',                                                   'technical',      array['pentest'],                                 21),
      ('2-12', 'Cybersecurity Event Logs and Monitoring Management',                     'technical',      array['logging','monitoring','siem'],             22),
      ('2-13', 'Cybersecurity Incident and Threat Management',                           'technical',      array['incident_response','threat_intel'],        23),
      ('2-14', 'Physical Security',                                                     'physical',       array['physical'],                                24),
      ('2-15', 'Web Application Security',                                              'technical',      array['appsec','web_security'],                   25),
      ('3-1',  'Cybersecurity Resilience Aspects of Business Continuity Management',      'administrative', array['continuity','recovery'],                   26),
      ('4-1',  'Third-Party Cybersecurity',                                             'administrative', array['third_party','outsourcing','supply_chain'],27),
      ('4-2',  'Cloud Computing and Hosting Cybersecurity',                              'technical',      array['cloud','third_party'],                     28),
      ('5-1',  'Industrial Control Systems Protection',                                  'technical',      array['ot_ics'],                                  29)
    ) as t(code, title, ctype, tags, ord)
  loop
    perform public.upsert_framework_control(
      'NCA-ECC', r.code, r.title, r.code, r.ctype, '{}'::text[], r.tags, r.ord
    );
  end loop;
end
$seed$;

-- =============================================================================
-- SAMA Cyber Security Framework — subdomain anchors
--
-- Each SAMA subdomain states a Principle, an Objective and Control
-- Considerations, so the subdomain *is* the citable unit.
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('3.1.1',  'Cyber Security Governance',                    'governance',     array['governance'],                              1),
      ('3.1.2',  'Cyber Security Strategy',                      'governance',     array['governance','policy'],                     2),
      ('3.1.3',  'Cyber Security Policy',                        'governance',     array['policy','governance'],                     3),
      ('3.1.4',  'Cyber Security Roles and Responsibilities',    'governance',     array['governance','roles'],                      4),
      ('3.1.5',  'Cyber Security in Project Management',         'governance',     array['change_management','secure_development'],  5),
      ('3.1.6',  'Cyber Security Awareness',                     'administrative', array['awareness'],                               6),
      ('3.1.7',  'Cyber Security Training',                      'administrative', array['training','awareness'],                    7),
      ('3.2.1',  'Cyber Security Risk Management',               'governance',     array['risk_management'],                         8),
      ('3.2.2',  'Regulatory Compliance',                        'legal',          array['compliance'],                              9),
      ('3.2.3',  'Compliance with (inter)national industry standards','legal',     array['compliance'],                             10),
      ('3.2.4',  'Cyber Security Review',                        'governance',     array['audit','compliance'],                     11),
      ('3.2.5',  'Cyber Security Audits',                        'governance',     array['audit'],                                  12),
      ('3.3.1',  'Human Resources',                              'administrative', array['hr_security'],                            13),
      ('3.3.2',  'Physical Security',                            'physical',       array['physical'],                               14),
      ('3.3.3',  'Asset Management',                             'administrative', array['asset_management'],                       15),
      ('3.3.4',  'Cyber Security Architecture',                  'technical',      array['architecture','network_security'],        16),
      ('3.3.5',  'Identity and Access Management',               'technical',      array['identity','access_control','authentication'],17),
      ('3.3.6',  'Application Security',                         'technical',      array['appsec','secure_development'],            18),
      ('3.3.7',  'Change Management',                            'technical',      array['change_management'],                      19),
      ('3.3.8',  'Infrastructure Security',                      'technical',      array['network_security','configuration'],       20),
      ('3.3.9',  'Cryptography',                                 'technical',      array['cryptography','key_management'],          21),
      ('3.3.10', 'Bring Your Own Device (BYOD)',                 'technical',      array['byod','mobile','endpoint'],               22),
      ('3.3.11', 'Secure Disposal of Information Assets',        'administrative', array['secure_disposal','media'],                23),
      ('3.3.12', 'Payment Systems',                              'technical',      array['payments'],                               24),
      ('3.3.13', 'Electronic Banking Services',                  'technical',      array['appsec','web_security','payments'],       25),
      ('3.3.14', 'Cyber Security Event Management',              'technical',      array['logging','monitoring','siem'],            26),
      ('3.3.15', 'Cyber Security Incident Management',           'technical',      array['incident_response'],                      27),
      ('3.3.16', 'Threat Management',                            'technical',      array['threat_intel','monitoring'],              28),
      ('3.3.17', 'Vulnerability Management',                     'technical',      array['vulnerability','patching','pentest'],     29),
      ('3.4.1',  'Contract and Vendor Management',               'administrative', array['third_party'],                            30),
      ('3.4.2',  'Outsourcing',                                  'administrative', array['outsourcing','third_party'],              31),
      ('3.4.3',  'Cloud Computing',                              'technical',      array['cloud','third_party'],                    32)
    ) as t(code, title, ctype, tags, ord)
  loop
    perform public.upsert_framework_control(
      'SAMA-CSF', r.code, r.title, r.code, r.ctype, '{}'::text[], r.tags, r.ord
    );
  end loop;
end
$seed$;

-- =============================================================================
-- SDAIA AI Ethics Principles — 7 principles
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('P1', 'Fairness',                            array['bias_fairness','ai_governance'],                 'Avoid bias and discrimination in data, models and outcomes; ensure equitable treatment across groups.', 1),
      ('P2', 'Privacy and Security',                array['privacy','data_protection','ai_governance'],     'Protect personal data throughout the AI lifecycle and secure models and training data against compromise.', 2),
      ('P3', 'Humanity',                            array['human_oversight','ai_governance'],               'Preserve human dignity, agency and wellbeing; keep meaningful human control over consequential decisions.', 3),
      ('P4', 'Social and Environmental Benefits',   array['ai_governance'],                                 'Direct AI toward societal benefit and account for environmental cost.', 4),
      ('P5', 'Reliability and Safety',              array['ai_risk_assessment','ai_governance'],            'Ensure AI systems perform as intended, are robust to misuse and fail safely.', 5),
      ('P6', 'Transparency and Explainability',     array['ai_transparency','explainability'],              'Disclose the use of AI and provide explanations proportionate to the impact of the decision.', 6),
      ('P7', 'Accountability and Responsibility',   array['ai_governance','governance','roles'],            'Assign clear ownership for AI outcomes and maintain auditable records of decisions.', 7)
    ) as t(code, title, tags, objective, ord)
  loop
    perform public.upsert_framework_control(
      'SDAIA-AI-ETHICS', r.code, r.title, 'PRINCIPLES', 'governance',
      '{}'::text[], r.tags, r.ord, r.objective
    );
  end loop;
end
$seed$;

-- =============================================================================
-- EU AI Act — operative articles
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('ART-4',  'Article 4 — AI literacy',                                 'CH-I',   array['ai_governance','training','awareness'], 'Providers and deployers must ensure a sufficient level of AI literacy among staff operating AI systems.', 1),
      ('ART-5',  'Article 5 — Prohibited AI practices',                     'CH-II',  array['ai_governance','ai_risk_assessment'],   'Bans manipulative techniques, exploitation of vulnerabilities, social scoring, certain biometric categorisation, untargeted facial scraping, emotion inference at work and in education, and most real-time remote biometric identification in public for law enforcement.', 2),
      ('ART-6',  'Article 6 — Classification rules for high-risk AI systems','CH-III', array['ai_risk_assessment','ai_governance'],   'Establishes when a system is high-risk, via product safety legislation in Annex I or the use cases in Annex III.', 3),
      ('ART-9',  'Article 9 — Risk management system',                      'CH-III', array['ai_risk_assessment','risk_management'], 'A continuous, iterative risk management system must run across the entire high-risk AI system lifecycle.', 4),
      ('ART-10', 'Article 10 — Data and data governance',                   'CH-III', array['ai_governance','data_protection','bias_fairness'], 'Training, validation and testing data sets must meet quality criteria and be examined for bias.', 5),
      ('ART-11', 'Article 11 — Technical documentation',                    'CH-III', array['ai_governance','ai_transparency'],      'Technical documentation per Annex IV must be drawn up before placing the system on the market and kept up to date.', 6),
      ('ART-12', 'Article 12 — Record-keeping',                             'CH-III', array['logging','ai_governance'],              'High-risk AI systems must technically allow automatic recording of events (logs) over their lifetime.', 7),
      ('ART-13', 'Article 13 — Transparency and provision of information',  'CH-III', array['ai_transparency','explainability'],     'Systems must be sufficiently transparent for deployers to interpret output, with instructions for use.', 8),
      ('ART-14', 'Article 14 — Human oversight',                            'CH-III', array['human_oversight'],                     'High-risk systems must be designed so natural persons can effectively oversee them.', 9),
      ('ART-15', 'Article 15 — Accuracy, robustness and cybersecurity',     'CH-III', array['ai_risk_assessment','vulnerability'],   'Systems must achieve appropriate accuracy, robustness and cybersecurity throughout their lifecycle.', 10),
      ('ART-17', 'Article 17 — Quality management system',                  'CH-III', array['ai_governance','governance'],           'Providers must operate a documented quality management system covering the full compliance strategy.', 11),
      ('ART-26', 'Article 26 — Obligations of deployers',                   'CH-III', array['ai_governance','human_oversight'],      'Deployers must use systems per instructions, assign competent human oversight, monitor operation and keep logs.', 12),
      ('ART-27', 'Article 27 — Fundamental rights impact assessment',       'CH-III', array['ai_risk_assessment','dpia'],            'Certain deployers must carry out a fundamental rights impact assessment before putting a high-risk system into use.', 13),
      ('ART-50', 'Article 50 — Transparency obligations',                   'CH-IV',  array['ai_transparency','deepfake'],           'Disclose AI interaction, mark synthetic content machine-readably, and label deepfakes and AI-generated text on matters of public interest.', 14),
      ('ART-53', 'Article 53 — Obligations for GPAI model providers',       'CH-V',   array['gpai','ai_governance'],                 'Technical documentation, information for downstream providers, a copyright policy and a training-content summary.', 15),
      ('ART-55', 'Article 55 — GPAI models with systemic risk',             'CH-V',   array['gpai','ai_risk_assessment'],            'Model evaluation, adversarial testing, systemic risk mitigation, incident tracking and cybersecurity protection.', 16),
      ('ART-72', 'Article 72 — Post-market monitoring',                     'CH-IX',  array['monitoring','ai_governance'],           'Providers must establish a proportionate post-market monitoring system for high-risk AI systems.', 17),
      ('ART-73', 'Article 73 — Reporting of serious incidents',             'CH-IX',  array['incident_response','breach_notification'], 'Serious incidents must be reported to market surveillance authorities within the deadlines set by the Article.', 18)
    ) as t(code, title, domain, tags, objective, ord)
  loop
    perform public.upsert_framework_control(
      'EU-AI-ACT', r.code, r.title, r.domain, 'legal', '{}'::text[], r.tags, r.ord, r.objective
    );
  end loop;
end
$seed$;

-- =============================================================================
-- GDPR — the articles that drive control design
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('ART-5',  'Article 5 — Principles relating to processing of personal data', 'CH-II',  array['privacy','governance'],                    1),
      ('ART-6',  'Article 6 — Lawfulness of processing',                          'CH-II',  array['privacy','consent'],                       2),
      ('ART-7',  'Article 7 — Conditions for consent',                            'CH-II',  array['consent','privacy'],                       3),
      ('ART-9',  'Article 9 — Processing of special categories of personal data',  'CH-II',  array['privacy','data_classification'],           4),
      ('ART-12', 'Article 12 — Transparent information and communication',         'CH-III', array['privacy','data_subject_rights'],           5),
      ('ART-15', 'Article 15 — Right of access by the data subject',               'CH-III', array['data_subject_rights'],                     6),
      ('ART-17', 'Article 17 — Right to erasure',                                 'CH-III', array['data_subject_rights','secure_disposal'],   7),
      ('ART-22', 'Article 22 — Automated individual decision-making and profiling','CH-III', array['data_subject_rights','ai_governance','human_oversight'], 8),
      ('ART-24', 'Article 24 — Responsibility of the controller',                  'CH-IV',  array['governance','privacy'],                    9),
      ('ART-25', 'Article 25 — Data protection by design and by default',          'CH-IV',  array['privacy','secure_development'],           10),
      ('ART-28', 'Article 28 — Processor',                                         'CH-IV',  array['third_party','privacy'],                  11),
      ('ART-30', 'Article 30 — Records of processing activities',                  'CH-IV',  array['records_of_processing','privacy'],        12),
      ('ART-32', 'Article 32 — Security of processing',                            'CH-IV',  array['data_protection','cryptography'],         13),
      ('ART-33', 'Article 33 — Notification of a breach to the supervisory authority','CH-IV',array['breach_notification','incident_response'],14),
      ('ART-34', 'Article 34 — Communication of a breach to the data subject',      'CH-IV',  array['breach_notification'],                    15),
      ('ART-35', 'Article 35 — Data protection impact assessment',                 'CH-IV',  array['dpia','risk_management'],                 16),
      ('ART-37', 'Article 37 — Designation of the data protection officer',         'CH-IV',  array['dpo','governance'],                       17),
      ('ART-44', 'Article 44 — General principle for transfers',                   'CH-V',   array['cross_border_transfer'],                  18),
      ('ART-46', 'Article 46 — Transfers subject to appropriate safeguards',        'CH-V',   array['cross_border_transfer'],                  19)
    ) as t(code, title, domain, tags, ord)
  loop
    perform public.upsert_framework_control(
      'EU-GDPR', r.code, r.title, r.domain, 'legal', '{}'::text[], r.tags, r.ord
    );
  end loop;
end
$seed$;

-- =============================================================================
-- Saudi PDPL — obligation groups
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('PDPL-LAWFUL',    'Lawful basis for processing',                    'LAWFUL',   array['privacy','consent'],                   1),
      ('PDPL-CONSENT',   'Consent requirements and withdrawal',           'LAWFUL',   array['consent','privacy'],                   2),
      ('PDPL-NOTICE',    'Privacy notice and transparency',               'LAWFUL',   array['privacy','data_subject_rights'],       3),
      ('PDPL-MINIMISE',  'Purpose limitation and data minimisation',      'LAWFUL',   array['privacy','data_protection'],           4),
      ('PDPL-ACCESS',    'Right to access and obtain a copy',             'RIGHTS',   array['data_subject_rights'],                 5),
      ('PDPL-CORRECT',   'Right to correction and completion',            'RIGHTS',   array['data_subject_rights'],                 6),
      ('PDPL-DESTROY',   'Right to destruction of personal data',         'RIGHTS',   array['data_subject_rights','secure_disposal'],7),
      ('PDPL-ROPA',      'Records of processing activities',              'GOVERN',   array['records_of_processing'],               8),
      ('PDPL-DPO',       'Appointment of a personal data protection officer','GOVERN',array['dpo','governance'],                    9),
      ('PDPL-DPIA',      'Assessment of the impact of processing',        'GOVERN',   array['dpia','risk_management'],             10),
      ('PDPL-PROCESSOR', 'Engagement and oversight of processors',        'GOVERN',   array['third_party','privacy'],              11),
      ('PDPL-SECURITY',  'Organisational and technical security measures','SECURITY', array['data_protection','cryptography'],     12),
      ('PDPL-BREACH',    'Personal data breach notification',            'SECURITY', array['breach_notification','incident_response'],13),
      ('PDPL-TRANSFER',  'Transfer of personal data outside the Kingdom', 'TRANSFER', array['cross_border_transfer'],              14),
      ('PDPL-REGISTER',  'Registration and national register obligations','GOVERN',   array['compliance','governance'],            15)
    ) as t(code, title, domain, tags, ord)
  loop
    perform public.upsert_framework_control(
      'SA-PDPL', r.code, r.title, r.domain, 'legal', '{}'::text[], r.tags, r.ord
    );
  end loop;
end
$seed$;

-- =============================================================================
-- PCI DSS v4.0.1 — 12 requirements
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('R1',  'Install and Maintain Network Security Controls',                              'G1', array['network_security','segmentation'],           1),
      ('R2',  'Apply Secure Configurations to All System Components',                        'G1', array['configuration'],                             2),
      ('R3',  'Protect Stored Account Data',                                                 'G2', array['data_protection','cryptography','payments'], 3),
      ('R4',  'Protect Cardholder Data with Strong Cryptography During Transmission',        'G2', array['cryptography','payments'],                   4),
      ('R5',  'Protect All Systems and Networks from Malicious Software',                     'G3', array['malware','endpoint'],                        5),
      ('R6',  'Develop and Maintain Secure Systems and Software',                             'G3', array['secure_development','patching','appsec'],    6),
      ('R7',  'Restrict Access to System Components and Cardholder Data by Business Need to Know','G4', array['access_control'],                        7),
      ('R8',  'Identify Users and Authenticate Access to System Components',                  'G4', array['identity','authentication'],                 8),
      ('R9',  'Restrict Physical Access to Cardholder Data',                                  'G4', array['physical'],                                  9),
      ('R10', 'Log and Monitor All Access to System Components and Cardholder Data',           'G5', array['logging','monitoring','clock_sync'],        10),
      ('R11', 'Test Security of Systems and Networks Regularly',                              'G5', array['vulnerability','pentest'],                  11),
      ('R12', 'Support Information Security with Organizational Policies and Programs',        'G6', array['policy','governance','awareness'],          12)
    ) as t(code, title, domain, tags, ord)
  loop
    perform public.upsert_framework_control(
      'PCI-DSS', r.code, r.title, r.domain, 'technical', '{}'::text[], r.tags, r.ord
    );
  end loop;
end
$seed$;

-- =============================================================================
-- ISO/IEC 42001:2023 — Annex A control areas
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('A.2', 'Policies related to AI',                      array['ai_governance','policy'],                          1),
      ('A.3', 'Internal organization',                       array['ai_governance','roles','governance'],              2),
      ('A.4', 'Resources for AI systems',                    array['ai_governance','asset_management'],                3),
      ('A.5', 'Assessing impacts of AI systems',             array['ai_risk_assessment','dpia'],                       4),
      ('A.6', 'AI system life cycle',                        array['ai_governance','secure_development'],              5),
      ('A.7', 'Data for AI systems',                         array['ai_governance','data_protection','bias_fairness'], 6),
      ('A.8', 'Information for interested parties',          array['ai_transparency','explainability'],                7),
      ('A.9', 'Use of AI systems',                           array['human_oversight','ai_governance'],                 8),
      ('A.10','Third-party and customer relationships',      array['third_party','ai_governance'],                     9)
    ) as t(code, title, tags, ord)
  loop
    perform public.upsert_framework_control(
      'ISO-42001', r.code, r.title, r.code, 'governance', '{}'::text[], r.tags, r.ord
    );
  end loop;
end
$seed$;

-- =============================================================================
-- NIST AI RMF 1.0 — functions
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('GOVERN',  'GOVERN — cultivate a culture of AI risk management', array['ai_governance','governance'],       1),
      ('MAP',     'MAP — establish context and identify risks',          array['ai_risk_assessment'],               2),
      ('MEASURE', 'MEASURE — assess, analyse and track risks',           array['ai_risk_assessment','monitoring'],  3),
      ('MANAGE',  'MANAGE — prioritise and act on risks',                array['ai_risk_assessment','risk_management'],4)
    ) as t(code, title, tags, ord)
  loop
    perform public.upsert_framework_control(
      'NIST-AI-RMF', r.code, r.title, r.code, 'governance', '{}'::text[], r.tags, r.ord
    );
  end loop;
end
$seed$;

-- =============================================================================
-- SOC 2 — Trust Services Criteria categories
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('CC',  'Security (Common Criteria)', array['governance','access_control','monitoring'], 1),
      ('A',   'Availability',               array['continuity','redundancy','capacity'],       2),
      ('PI',  'Processing Integrity',       array['change_management','monitoring'],           3),
      ('C',   'Confidentiality',           array['data_protection','cryptography'],           4),
      ('P',   'Privacy',                    array['privacy','data_subject_rights'],            5)
    ) as t(code, title, tags, ord)
  loop
    perform public.upsert_framework_control(
      'SOC2', r.code, r.title, 'TSC', 'governance', '{}'::text[], r.tags, r.ord
    );
  end loop;
end
$seed$;

-- =============================================================================
-- EU NIS2 — Article 21(2) measures and Article 23 reporting
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('21-2-A', 'Policies on risk analysis and information system security',              'ART21', array['risk_management','policy'],               1),
      ('21-2-B', 'Incident handling',                                                      'ART21', array['incident_response'],                      2),
      ('21-2-C', 'Business continuity, backup management and disaster recovery',           'ART21', array['continuity','backup','recovery'],         3),
      ('21-2-D', 'Supply chain security',                                                  'ART21', array['supply_chain','third_party'],             4),
      ('21-2-E', 'Security in network and information systems acquisition and development','ART21', array['secure_development','vulnerability'],     5),
      ('21-2-F', 'Policies to assess the effectiveness of risk-management measures',       'ART21', array['audit','compliance'],                     6),
      ('21-2-G', 'Basic cyber hygiene practices and cybersecurity training',               'ART21', array['awareness','training'],                   7),
      ('21-2-H', 'Policies on the use of cryptography and encryption',                     'ART21', array['cryptography'],                           8),
      ('21-2-I', 'Human resources security, access control and asset management',          'ART21', array['hr_security','access_control','asset_management'], 9),
      ('21-2-J', 'Multi-factor authentication and secured communications',                 'ART21', array['authentication','network_security'],     10),
      ('23-EARLY','Article 23 — 24-hour early warning of a significant incident',          'ART23', array['breach_notification','incident_response'],11),
      ('23-FULL', 'Article 23 — 72-hour incident notification and final report',            'ART23', array['breach_notification','incident_response'],12)
    ) as t(code, title, domain, tags, ord)
  loop
    perform public.upsert_framework_control(
      'EU-NIS2', r.code, r.title, r.domain, 'legal', '{}'::text[], r.tags, r.ord
    );
  end loop;
end
$seed$;

-- =============================================================================
-- EU DORA — pillar anchors
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('P1', 'ICT risk management framework',                       'P1', array['risk_management','governance'],           1),
      ('P2', 'ICT-related incident management and reporting',        'P2', array['incident_response','breach_notification'],2),
      ('P3', 'Digital operational resilience testing',              'P3', array['pentest','continuity'],                   3),
      ('P4', 'ICT third-party risk management',                     'P4', array['third_party','outsourcing','cloud'],      4),
      ('P5', 'Information and intelligence sharing',                'P5', array['threat_intel'],                           5)
    ) as t(code, title, domain, tags, ord)
  loop
    perform public.upsert_framework_control(
      'EU-DORA', r.code, r.title, r.domain, 'legal', '{}'::text[], r.tags, r.ord
    );
  end loop;
end
$seed$;

-- =============================================================================
-- GCC privacy laws — a shared obligation spine so they crosswalk to each other
-- and to GDPR without inventing article numbers we cannot verify.
-- =============================================================================

do $seed$
declare
  fw   text;
  r    record;
begin
  foreach fw in array array[
    'QA-PDPPL', 'AE-PDPL', 'AE-DIFC-DPL', 'AE-ADGM-DPR',
    'JO-PDPL', 'BH-PDPL', 'OM-PDPL', 'KW-CITRA-DPPR'
  ]
  loop
    for r in
      select * from (values
        ('LAWFUL',   'Lawful basis and consent for processing',        array['privacy','consent'],                     1),
        ('NOTICE',   'Transparency and privacy notice',                array['privacy','data_subject_rights'],         2),
        ('RIGHTS',   'Data subject rights handling',                   array['data_subject_rights'],                   3),
        ('SECURITY', 'Security of personal data',                      array['data_protection','cryptography'],         4),
        ('BREACH',   'Personal data breach notification',              array['breach_notification','incident_response'],5),
        ('ROPA',     'Records of processing and accountability',       array['records_of_processing','governance'],     6),
        ('PROCESSOR','Processor engagement and oversight',             array['third_party','privacy'],                 7),
        ('TRANSFER', 'Cross-border transfer conditions',               array['cross_border_transfer'],                 8)
      ) as t(code, title, tags, ord)
    loop
      perform public.upsert_framework_control(
        fw, r.code, r.title, 'CORE', 'legal', '{}'::text[], r.tags, r.ord
      );
    end loop;
  end loop;

  -- DIFC is the one GCC privacy regime with an explicit autonomous-systems rule.
  perform public.upsert_framework_control(
    'AE-DIFC-DPL', 'AUTO-10', 'Regulation 10 — Autonomous and semi-autonomous systems',
    'AUTO', 'legal', '{}'::text[],
    array['ai_governance','ai_transparency','human_oversight','data_subject_rights'], 9,
    'Requires controllers deploying autonomous or semi-autonomous systems to document them, assess their impact on data subjects and maintain human accountability.'
  );
end
$seed$;

-- =============================================================================
-- GCC cybersecurity / financial regulator anchors
-- =============================================================================

do $seed$
declare
  r record;
begin
  -- Qatar NIA
  for r in
    select * from (values
      ('GOV-1',   'Information security governance and management',    'GOV',   array['governance','policy'],                    1),
      ('RISK-1',  'Risk management process',                           'RISK',  array['risk_management'],                        2),
      ('CLASS-1', 'Data labelling and classification',                 'CLASS', array['data_classification','data_protection'],  3),
      ('CTRL-1',  'Baseline security controls implementation',          'CTRL',  array['access_control','network_security','logging'], 4),
      ('BCM-1',   'Business continuity and disaster recovery',          'BCM',   array['continuity','recovery','backup'],         5),
      ('CERT-1',  'Certification, audit and compliance reporting',      'CERT',  array['audit','compliance'],                     6)
    ) as t(code, title, domain, tags, ord)
  loop
    perform public.upsert_framework_control('QA-NIA', r.code, r.title, r.domain, 'governance', '{}'::text[], r.tags, r.ord);
  end loop;

  -- UAE Information Assurance
  for r in
    select * from (values
      ('M1', 'Strategy and planning',                     'M', array['governance','policy'],                    1),
      ('M2', 'Information security risk management',      'M', array['risk_management'],                        2),
      ('M3', 'Awareness and training',                    'M', array['awareness','training'],                   3),
      ('M4', 'Human resources security',                  'M', array['hr_security'],                            4),
      ('M5', 'Incident management',                       'M', array['incident_response'],                      5),
      ('M6', 'Business continuity management',            'M', array['continuity','recovery'],                  6),
      ('M7', 'Third-party security management',           'M', array['third_party','outsourcing'],              7),
      ('M8', 'Compliance and audit',                      'M', array['compliance','audit'],                     8),
      ('T1', 'Asset management',                          'T', array['asset_management'],                       9),
      ('T2', 'Physical and environmental security',       'T', array['physical'],                              10),
      ('T3', 'Access control',                            'T', array['access_control','identity','authentication'], 11),
      ('T4', 'Cryptography',                              'T', array['cryptography','key_management'],         12),
      ('T5', 'Operations management',                     'T', array['configuration','malware','patching'],    13),
      ('T6', 'Communications security',                   'T', array['network_security','segmentation'],       14),
      ('T7', 'System acquisition, development and maintenance', 'T', array['secure_development','appsec'],     15)
    ) as t(code, title, domain, tags, ord)
  loop
    perform public.upsert_framework_control('AE-IA', r.code, r.title, r.domain, 'technical', '{}'::text[], r.tags, r.ord);
  end loop;

  -- Financial regulators, same operative spine so cross-jurisdiction mapping works
  for r in
    select * from (values
      ('CBUAE-ISS', 'GOV-1', 'Board and senior management oversight of technology risk', 'GOV', array['governance','roles'],                    1),
      ('CBUAE-ISS', 'SEC-1', 'Information security control framework',                    'SEC', array['access_control','cryptography','logging'],2),
      ('CBUAE-ISS', 'RES-1', 'Operational resilience and business continuity',            'RES', array['continuity','recovery'],                 3),
      ('CBUAE-ISS', 'OUT-1', 'Outsourcing and third-party risk management',               'OUT', array['outsourcing','third_party','cloud'],     4),
      ('CBUAE-ISS', 'INC-1', 'Incident notification to the Central Bank',                 'INC', array['incident_response','breach_notification'],5),
      ('QCB-TRC',   'GOV-1', 'Technology governance and risk oversight',                  'GOV', array['governance','risk_management'],          1),
      ('QCB-TRC',   'SEC-1', 'Information security requirements',                          'SEC', array['access_control','cryptography','monitoring'],2),
      ('QCB-TRC',   'OUT-1', 'Outsourcing and cloud adoption approval',                   'OUT', array['outsourcing','cloud','third_party'],     3),
      ('QCB-TRC',   'INC-1', 'Incident management and regulatory reporting',               'INC', array['incident_response','breach_notification'],4),
      ('CBJ-CSF',   'GOV-1', 'Governance and board accountability',                        'GOV', array['governance','roles'],                    1),
      ('CBJ-CSF',   'SEC-1', 'Information security controls',                              'SEC', array['access_control','network_security','logging'],2),
      ('CBJ-CSF',   'RES-1', 'Cyber resilience and continuity',                            'RES', array['continuity','recovery'],                 3),
      ('CBJ-CSF',   'INC-1', 'Incident reporting to the Central Bank of Jordan',           'INC', array['incident_response','breach_notification'],4),
      ('CBB-OM5',   'OM-1',  'Operational risk management framework',                      'OM',  array['risk_management','governance'],          1),
      ('CBB-OM5',   'CYB-1', 'Cyber security control requirements',                        'CYB', array['access_control','monitoring','vulnerability'],2),
      ('CBB-OM5',   'OUT-1', 'Outsourcing arrangements and approval',                      'OUT', array['outsourcing','third_party'],             3),
      ('JO-NCSF',   'GOV-1', 'Sector governance and national obligations',                 'GOV', array['governance','compliance'],               1),
      ('JO-NCSF',   'CTRL-1','Baseline security controls',                                 'CTRL',array['access_control','network_security'],      2),
      ('JO-NCSF',   'INC-1', 'Incident reporting to the NCSC',                              'INC', array['incident_response','breach_notification'],3),
      ('KW-CITRA-CSF','GOV-1','Cybersecurity governance',                                  'GOV', array['governance','policy'],                   1),
      ('KW-CITRA-CSF','CTRL-1','Security control implementation',                          'CTRL',array['access_control','network_security','logging'],2),
      ('KW-CITRA-CSF','CLOUD-1','Cloud adoption and data classification',                  'CLOUD',array['cloud','data_classification'],          3),
      ('AE-DESC-DCS','GOV-1','Governance and risk tiering',                                'GOV', array['governance','risk_management'],          1),
      ('AE-DESC-DCS','CTRL-1','Security control implementation by impact tier',            'CTRL',array['access_control','network_security'],      2),
      ('SAMA-BCM',  'GOV-1', 'BCM governance and policy',                                  'GOV', array['continuity','governance'],               1),
      ('SAMA-BCM',  'BIA-1', 'Business impact analysis and recovery objectives',            'BIA', array['continuity','recovery'],                 2),
      ('SAMA-BCM',  'TEST-1','Continuity testing and exercising',                          'TEST',array['continuity'],                            3),
      ('SAMA-ITGF', 'GOV-1', 'IT governance framework',                                    'GOV', array['governance'],                            1),
      ('SAMA-ITGF', 'SVC-1', 'IT service management',                                      'SVC', array['change_management','capacity'],          2),
      ('NCA-CCC',   'CSP-1', 'Cloud service provider control obligations',                 'CSP', array['cloud','third_party'],                   1),
      ('NCA-CCC',   'CST-1', 'Cloud service tenant control obligations',                   'CST', array['cloud','third_party','data_classification'],2),
      ('NCA-DCC',   'DL-1',  'Data cybersecurity across the data lifecycle',               'LIFECYCLE', array['data_protection','data_classification','secure_disposal'],1),
      ('NCA-CSCC',  'CS-1',  'Additional controls for critical systems',                   'CS',  array['access_control','monitoring','segmentation'],1),
      ('NCA-OTCC',  'OT-1',  'Operational technology cybersecurity controls',              'OT',  array['ot_ics','segmentation','asset_management'],1),
      ('NCA-TCC',   'TW-1',  'Telework and remote access controls',                        'TW',  array['teleworking','endpoint','authentication'],1),
      ('ISO-27701', 'A-1',   'PII controller additional controls',                          'A',   array['privacy','records_of_processing','data_subject_rights'],1),
      ('ISO-27701', 'B-1',   'PII processor additional controls',                           'B',   array['privacy','third_party'],                 2),
      ('ISO-22301', 'C6-1',  'Business impact analysis and risk assessment',                'C6',  array['continuity','risk_management'],          1),
      ('ISO-22301', 'C8-1',  'Business continuity strategy, plans and procedures',          'C8',  array['continuity','recovery'],                 2),
      ('ISO-22301', 'C9-1',  'Exercising, testing and performance evaluation',              'C9',  array['continuity','audit'],                    3),
      ('SDAIA-GENAI','GEN-1','Acceptable use of generative AI',                            'CORE',array['ai_governance','policy'],                1),
      ('SDAIA-GENAI','GEN-2','Data handling and confidentiality in generative AI use',      'CORE',array['ai_governance','data_protection'],       2),
      ('SDAIA-GENAI','GEN-3','Human review of generative AI output',                        'CORE',array['human_oversight','ai_governance'],       3),
      ('SDAIA-GENAI','GEN-4','Disclosure of AI-generated content and deepfake handling',    'CORE',array['ai_transparency','deepfake'],            4)
    ) as t(fw, code, title, domain, tags, ord)
  loop
    perform public.upsert_framework_control(r.fw, r.code, r.title, r.domain, 'governance', '{}'::text[], r.tags, r.ord);
  end loop;
end
$seed$;
