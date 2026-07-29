-- =============================================================================
-- Seed: policy templates, risk taxonomy, obligation templates, AI classification
--
-- These four tables are what make the platform produce work rather than just
-- store it:
--
--   policy_templates         drive the generator prompt and score uploaded policies
--   risk_taxonomy            a shared vocabulary so signals and risks reconcile
--   obligation_templates     instantiate into a dated compliance calendar
--   ai_classification_rules  tier AI systems as data, not hardcoded logic
-- =============================================================================

-- =============================================================================
-- Policy templates
-- =============================================================================

insert into public.policy_templates (
  code, title, category, description, framework_codes, control_codes,
  applies_to_sectors, review_cadence, approver_role, required_sections
) values
(
  'ISP', 'Information Security Policy', 'security',
  'The apex security policy. Every framework in the catalogue expects one, and most assessments open by asking for it.',
  '{NCA-ECC,SAMA-CSF,ISO-27001,NIST-CSF,AE-IA,QA-NIA}',
  '{ISO-27001:A.5.1,NCA-ECC:1-3,SAMA-CSF:3.1.3,NIST-CSF:GV.PO}',
  '{all}', 'annual', 'owner',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver, classification and revision history."},
    {"heading": "Purpose", "guidance": "Why the policy exists and the outcome it protects."},
    {"heading": "Scope", "guidance": "Entities, systems, data, locations and personnel covered, and any explicit exclusions."},
    {"heading": "Policy Statements", "guidance": "Numbered, testable statements. Each one cites the framework control it satisfies."},
    {"heading": "Roles and Responsibilities", "guidance": "Named accountable roles, not individuals. Include the board or equivalent oversight body."},
    {"heading": "Compliance and Enforcement", "guidance": "How compliance is measured, and the consequence of a breach."},
    {"heading": "Exceptions", "guidance": "How an exception is requested, who may approve it, and the maximum duration."},
    {"heading": "Review Cycle", "guidance": "Review frequency, trigger events forcing an early review, and the approving authority."},
    {"heading": "Related Documents", "guidance": "Subordinate standards and procedures that implement this policy."}
  ]'::jsonb
),
(
  'ACP', 'Access Control Policy', 'security',
  'Identity lifecycle, authorisation and privileged access. The single most frequently assessed control area across GCC frameworks.',
  '{NCA-ECC,SAMA-CSF,ISO-27001,NIST-CSF,PCI-DSS,AE-IA}',
  '{ISO-27001:A.5.15,ISO-27001:A.5.16,ISO-27001:A.5.18,ISO-27001:A.8.2,ISO-27001:A.8.5,NCA-ECC:2-2,SAMA-CSF:3.3.5,NIST-CSF:PR.AA,PCI-DSS:R7}',
  '{all}', 'annual', 'owner',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver, classification."},
    {"heading": "Purpose", "guidance": "Restricting access to what each role legitimately requires."},
    {"heading": "Scope", "guidance": "Systems, identities and account types in scope, including service and machine accounts."},
    {"heading": "Access Control Principles", "guidance": "Least privilege, need to know, segregation of duties, deny by default."},
    {"heading": "Identity Lifecycle", "guidance": "Joiner, mover and leaver process with maximum timeframes for revocation."},
    {"heading": "Authentication Requirements", "guidance": "Password standards, MFA scope, and treatment of shared and service accounts."},
    {"heading": "Privileged Access Management", "guidance": "Approval, vaulting, session recording, just-in-time elevation and break-glass procedure."},
    {"heading": "Access Review", "guidance": "Recertification frequency by system criticality, and who attests."},
    {"heading": "Remote and Third-Party Access", "guidance": "Conditions, controls and monitoring for external access."},
    {"heading": "Roles and Responsibilities", "guidance": "System owners, identity administrators, approvers."},
    {"heading": "Compliance and Enforcement", "guidance": "Monitoring, metrics and consequence of non-compliance."},
    {"heading": "Review Cycle", "guidance": "Review frequency and trigger events."}
  ]'::jsonb
),
(
  'DPP', 'Data Protection and Privacy Policy', 'privacy',
  'Personal data handling across its lifecycle. Written to satisfy the Saudi PDPL and the GCC privacy laws, with GDPR alignment where there is EU exposure.',
  '{SA-PDPL,EU-GDPR,AE-PDPL,QA-PDPPL,JO-PDPL,ISO-27701,NCA-DCC}',
  '{SA-PDPL:PDPL-LAWFUL,SA-PDPL:PDPL-NOTICE,SA-PDPL:PDPL-SECURITY,SA-PDPL:PDPL-BREACH,SA-PDPL:PDPL-TRANSFER,EU-GDPR:ART-5,EU-GDPR:ART-32,ISO-27001:A.5.34}',
  '{all}', 'annual', 'owner',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver, classification."},
    {"heading": "Purpose and Legal Basis", "guidance": "The laws the policy answers to, named with their citation."},
    {"heading": "Scope", "guidance": "Categories of personal data, data subjects, systems and jurisdictions."},
    {"heading": "Data Protection Principles", "guidance": "Lawfulness, purpose limitation, minimisation, accuracy, storage limitation, integrity, accountability."},
    {"heading": "Lawful Basis and Consent", "guidance": "Permitted bases, how consent is captured, recorded and withdrawn."},
    {"heading": "Data Subject Rights", "guidance": "Each right, the response deadline, and the verification process."},
    {"heading": "Records of Processing", "guidance": "What the ROPA records and how it is kept current."},
    {"heading": "Impact Assessments", "guidance": "When a DPIA is mandatory, who performs it, and who signs it off."},
    {"heading": "Cross-Border Transfer", "guidance": "Conditions, safeguards and approvals required before data leaves the jurisdiction."},
    {"heading": "Processors and Third Parties", "guidance": "Due diligence, contractual clauses and ongoing oversight."},
    {"heading": "Security of Personal Data", "guidance": "Technical and organisational measures, referencing the security policy set."},
    {"heading": "Breach Response and Notification", "guidance": "Detection, assessment, and the notification deadline for each applicable regulator."},
    {"heading": "Retention and Disposal", "guidance": "Retention schedule and secure destruction method by data category."},
    {"heading": "Roles and Responsibilities", "guidance": "DPO or equivalent, data owners, processors."},
    {"heading": "Review Cycle", "guidance": "Review frequency and trigger events."}
  ]'::jsonb
),
(
  'AUP', 'Acceptable Use Policy', 'security',
  'The rules for staff use of organisational systems, data and devices.',
  '{NCA-ECC,SAMA-CSF,ISO-27001,PCI-DSS}',
  '{ISO-27001:A.5.10,ISO-27001:A.8.1,NCA-ECC:1-3,SAMA-CSF:3.1.3}',
  '{all}', 'annual', 'admin',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver."},
    {"heading": "Purpose", "guidance": "Setting expectations for acceptable use of organisational assets."},
    {"heading": "Scope", "guidance": "All personnel, contractors and the assets covered."},
    {"heading": "Acceptable Use", "guidance": "Permitted use of email, internet, collaboration tools and organisational data."},
    {"heading": "Prohibited Use", "guidance": "Explicitly forbidden activities and their consequences."},
    {"heading": "Personal and Mobile Devices", "guidance": "BYOD conditions, enrolment and separation of personal and corporate data."},
    {"heading": "Generative AI Tools", "guidance": "Approved tools, prohibited data categories, and the disclosure expected of AI-assisted output."},
    {"heading": "Monitoring", "guidance": "What is monitored, the lawful basis, and how staff are informed."},
    {"heading": "Compliance and Enforcement", "guidance": "Disciplinary consequences of a breach."},
    {"heading": "Review Cycle", "guidance": "Review frequency."}
  ]'::jsonb
),
(
  'BCP', 'Business Continuity and Disaster Recovery Policy', 'continuity',
  'Continuity governance, recovery objectives and testing. Required by SAMA and CBUAE for regulated entities.',
  '{NCA-ECC,SAMA-CSF,SAMA-BCM,ISO-22301,ISO-27001,EU-DORA,CBUAE-ISS}',
  '{ISO-27001:A.5.29,ISO-27001:A.5.30,ISO-27001:A.8.13,NCA-ECC:3-1,SAMA-BCM:BIA-1,ISO-22301:C8-1}',
  '{all}', 'annual', 'owner',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver."},
    {"heading": "Purpose", "guidance": "Maintaining critical operations through disruption."},
    {"heading": "Scope", "guidance": "Business processes, systems and locations in scope."},
    {"heading": "Business Impact Analysis", "guidance": "How criticality is determined, and the RTO and RPO set for each tier."},
    {"heading": "Continuity Strategy", "guidance": "Redundancy, alternate sites, workforce arrangements and manual workarounds."},
    {"heading": "Backup and Recovery", "guidance": "Backup scope, frequency, retention, immutability and restore verification."},
    {"heading": "Crisis Management and Escalation", "guidance": "Invocation authority, crisis team composition and communication tree."},
    {"heading": "Testing and Exercising", "guidance": "Test types, frequency by tier, and how findings are tracked to closure."},
    {"heading": "Regulatory Notification", "guidance": "Which regulators must be told, and within what timeframe."},
    {"heading": "Roles and Responsibilities", "guidance": "Continuity owner, process owners, recovery teams."},
    {"heading": "Review Cycle", "guidance": "Review frequency and post-incident review trigger."}
  ]'::jsonb
),
(
  'AIG', 'AI Governance Policy', 'ai_governance',
  'Governance of AI across its lifecycle. Aligned to SDAIA AI Ethics Principles, the EU AI Act where there is EU exposure, and ISO 42001 as the evidence vehicle.',
  '{SDAIA-AI-ETHICS,SDAIA-GENAI,EU-AI-ACT,ISO-42001,NIST-AI-RMF,AE-DIFC-DPL}',
  '{SDAIA-AI-ETHICS:P1,SDAIA-AI-ETHICS:P3,SDAIA-AI-ETHICS:P6,SDAIA-AI-ETHICS:P7,EU-AI-ACT:ART-9,EU-AI-ACT:ART-14,EU-AI-ACT:ART-50,ISO-42001:A.2,ISO-42001:A.9}',
  '{all}', 'annual', 'owner',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver."},
    {"heading": "Purpose and Principles", "guidance": "The ethical principles adopted, named and attributed to their source."},
    {"heading": "Scope", "guidance": "AI systems covered, including procured and embedded AI, and the roles held (provider or deployer)."},
    {"heading": "AI System Inventory", "guidance": "What is recorded per system, who maintains it, and how new systems are captured."},
    {"heading": "Risk Classification", "guidance": "The tiering method, who classifies, and the obligations attaching to each tier."},
    {"heading": "Data Governance for AI", "guidance": "Training data provenance, quality, bias examination and personal data constraints."},
    {"heading": "Human Oversight", "guidance": "Oversight model per tier, and the decisions that may never be fully automated."},
    {"heading": "Transparency and Disclosure", "guidance": "When AI use is disclosed, how synthetic content is marked, and the explanation offered to affected persons."},
    {"heading": "Testing and Validation", "guidance": "Pre-deployment evaluation, accuracy and robustness thresholds, adversarial testing."},
    {"heading": "Monitoring and Incident Response", "guidance": "Post-deployment monitoring, drift detection, incident classification and reporting deadlines."},
    {"heading": "Third-Party and Foundation Models", "guidance": "Due diligence on model providers and the contractual terms required."},
    {"heading": "Prohibited Uses", "guidance": "Uses the organisation will not pursue, including those banned by law."},
    {"heading": "Roles and Responsibilities", "guidance": "AI governance owner, system owners, review board."},
    {"heading": "Review Cycle", "guidance": "Review frequency and regulatory-change trigger."}
  ]'::jsonb
),
(
  'TPRM', 'Third-Party Risk Management Policy', 'third_party',
  'Supplier and outsourcing risk end to end. Carries the SAMA and CBUAE outsourcing expectations as well as the ISO supplier controls.',
  '{NCA-ECC,SAMA-CSF,ISO-27001,NIST-CSF,EU-DORA,CBUAE-ISS,QCB-TRC}',
  '{ISO-27001:A.5.19,ISO-27001:A.5.20,ISO-27001:A.5.21,ISO-27001:A.5.22,NCA-ECC:4-1,SAMA-CSF:3.4.1,SAMA-CSF:3.4.2,NIST-CSF:GV.SC}',
  '{all}', 'annual', 'owner',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver."},
    {"heading": "Purpose", "guidance": "Managing risk introduced by third parties."},
    {"heading": "Scope", "guidance": "Suppliers, outsourcing arrangements, cloud services and subprocessors."},
    {"heading": "Criticality Tiering", "guidance": "How criticality is assessed, and the due diligence depth each tier requires."},
    {"heading": "Due Diligence", "guidance": "Pre-contract assessment, evidence accepted, and grounds for rejection."},
    {"heading": "Contractual Requirements", "guidance": "Mandatory clauses: security, audit rights, breach notification, subcontracting, exit."},
    {"heading": "Regulatory Approval", "guidance": "Where a regulator must approve or be notified of an outsourcing arrangement before it starts."},
    {"heading": "Ongoing Monitoring", "guidance": "Review frequency by tier, performance and security reporting expected."},
    {"heading": "Concentration and Exit", "guidance": "Concentration risk assessment, substitutability, and documented exit plans for critical suppliers."},
    {"heading": "Incident and Breach Handling", "guidance": "Notification obligations flowing from the supplier to the organisation and onward to regulators."},
    {"heading": "Roles and Responsibilities", "guidance": "Relationship owners, procurement, security assessors."},
    {"heading": "Review Cycle", "guidance": "Review frequency."}
  ]'::jsonb
),
(
  'IRP', 'Incident Response Policy', 'security',
  'Detection through post-incident review, including the regulatory notification clocks that differ by jurisdiction.',
  '{NCA-ECC,SAMA-CSF,ISO-27001,NIST-CSF,EU-NIS2,SA-PDPL,EU-GDPR}',
  '{ISO-27001:A.5.24,ISO-27001:A.5.25,ISO-27001:A.5.26,ISO-27001:A.5.27,NCA-ECC:2-13,SAMA-CSF:3.3.15,NIST-CSF:RS.MA,EU-GDPR:ART-33}',
  '{all}', 'annual', 'owner',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver."},
    {"heading": "Purpose", "guidance": "Detecting, containing and learning from security incidents."},
    {"heading": "Scope", "guidance": "Incident types covered, including personal data breaches and AI incidents."},
    {"heading": "Classification and Severity", "guidance": "Severity matrix, and the criteria that make an incident notifiable."},
    {"heading": "Response Lifecycle", "guidance": "Detect, triage, contain, eradicate, recover, review, with owners at each stage."},
    {"heading": "Regulatory Notification", "guidance": "A table of regulator, trigger and deadline. State each clock explicitly rather than generically."},
    {"heading": "Evidence and Forensics", "guidance": "Preservation, chain of custody, and when to engage external forensics."},
    {"heading": "Communication", "guidance": "Internal escalation, customer notification and external communications approval."},
    {"heading": "Post-Incident Review", "guidance": "Timeframe, participants, and how actions are tracked to closure."},
    {"heading": "Testing", "guidance": "Tabletop and simulation frequency."},
    {"heading": "Roles and Responsibilities", "guidance": "Incident commander, response team, legal, communications."},
    {"heading": "Review Cycle", "guidance": "Review frequency and post-incident trigger."}
  ]'::jsonb
),
(
  'CRYPTO', 'Cryptography and Key Management Policy', 'security',
  'Approved algorithms, key lifecycle and the crypto-agility needed to retire an algorithm when a regulator deprecates it.',
  '{NCA-ECC,SAMA-CSF,ISO-27001,PCI-DSS,EU-NIS2}',
  '{ISO-27001:A.8.24,NCA-ECC:2-8,SAMA-CSF:3.3.9,PCI-DSS:R3,PCI-DSS:R4}',
  '{all}', 'annual', 'admin',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver."},
    {"heading": "Purpose", "guidance": "Consistent, approved use of cryptography."},
    {"heading": "Scope", "guidance": "Data at rest, in transit and in use; all key-bearing systems."},
    {"heading": "Approved Algorithms and Key Lengths", "guidance": "Named algorithms with minimum key lengths, and a deprecation list."},
    {"heading": "Key Lifecycle", "guidance": "Generation, distribution, storage, rotation, escrow, revocation, destruction."},
    {"heading": "Key Custody and Separation", "guidance": "Dual control, split knowledge, HSM requirements for high-value keys."},
    {"heading": "Certificate Management", "guidance": "Issuance, inventory, expiry monitoring and renewal ownership."},
    {"heading": "Crypto-Agility", "guidance": "How an algorithm is retired, including inventory of dependencies and post-quantum readiness."},
    {"heading": "Roles and Responsibilities", "guidance": "Key custodians, crypto authority."},
    {"heading": "Review Cycle", "guidance": "Review frequency."}
  ]'::jsonb
),
(
  'CLOUD', 'Cloud Security Policy', 'cloud',
  'Cloud adoption governance and the shared responsibility split, mapped to the NCA Cloud Cybersecurity Controls tenant obligations.',
  '{NCA-CCC,NCA-ECC,SAMA-CSF,ISO-27001,QCB-TRC,KW-CITRA-CSF}',
  '{ISO-27001:A.5.23,NCA-ECC:4-2,NCA-CCC:CST-1,SAMA-CSF:3.4.3}',
  '{all}', 'annual', 'owner',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver."},
    {"heading": "Purpose", "guidance": "Governing secure adoption and operation of cloud services."},
    {"heading": "Scope", "guidance": "IaaS, PaaS and SaaS, including business-procured SaaS."},
    {"heading": "Approval and Onboarding", "guidance": "Assessment gate before adoption, and any regulator approval required first."},
    {"heading": "Shared Responsibility", "guidance": "Which controls sit with the provider and which with the organisation, per service model."},
    {"heading": "Data Residency and Sovereignty", "guidance": "Permitted regions by data classification, and the legal basis for any transfer."},
    {"heading": "Configuration and Hardening", "guidance": "Baselines, drift detection and infrastructure-as-code review."},
    {"heading": "Identity and Access", "guidance": "Federation, privileged cloud roles, and control of long-lived credentials."},
    {"heading": "Logging and Monitoring", "guidance": "Log sources enabled, retention, and export to central monitoring."},
    {"heading": "Exit and Portability", "guidance": "Data extraction, deletion assurance and the exit plan for critical services."},
    {"heading": "Roles and Responsibilities", "guidance": "Cloud owner, platform team, security assurance."},
    {"heading": "Review Cycle", "guidance": "Review frequency."}
  ]'::jsonb
),
(
  'SDLC', 'Secure Development Policy', 'security',
  'Security through the software lifecycle, including outsourced development and environment separation.',
  '{NCA-ECC,SAMA-CSF,ISO-27001,PCI-DSS,EU-NIS2}',
  '{ISO-27001:A.8.25,ISO-27001:A.8.26,ISO-27001:A.8.28,ISO-27001:A.8.29,ISO-27001:A.8.31,NCA-ECC:2-15,SAMA-CSF:3.3.6,PCI-DSS:R6}',
  '{all}', 'annual', 'admin',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver."},
    {"heading": "Purpose", "guidance": "Building security into software rather than testing it in afterwards."},
    {"heading": "Scope", "guidance": "In-house, outsourced and low-code development; AI-assisted coding."},
    {"heading": "Security Requirements", "guidance": "How security requirements are captured and traced through delivery."},
    {"heading": "Secure Coding Standards", "guidance": "Named standards by language, and mandatory code review."},
    {"heading": "Dependency and Supply Chain", "guidance": "Component inventory, provenance, vulnerability thresholds that block release."},
    {"heading": "Testing Gates", "guidance": "SAST, DAST, dependency scanning and penetration testing, with pass criteria."},
    {"heading": "Environment Separation", "guidance": "Development, test and production separation, and rules for test data."},
    {"heading": "Change and Release", "guidance": "Approval, rollback and emergency change handling."},
    {"heading": "Outsourced Development", "guidance": "Contractual security requirements and acceptance criteria."},
    {"heading": "Roles and Responsibilities", "guidance": "Product owners, developers, security champions."},
    {"heading": "Review Cycle", "guidance": "Review frequency."}
  ]'::jsonb
),
(
  'DCP', 'Data Classification and Handling Policy', 'security',
  'Classification scheme and the handling rules each level triggers. Aligned to the NCA Data Cybersecurity Controls.',
  '{NCA-DCC,NCA-ECC,ISO-27001,QA-NIA,KW-CITRA-CSF}',
  '{ISO-27001:A.5.12,ISO-27001:A.5.13,NCA-ECC:2-7,NCA-DCC:DL-1,QA-NIA:CLASS-1}',
  '{all}', 'annual', 'admin',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver."},
    {"heading": "Purpose", "guidance": "Protecting information in proportion to its sensitivity."},
    {"heading": "Scope", "guidance": "All information in any form, including data held by third parties."},
    {"heading": "Classification Levels", "guidance": "Each level with criteria and worked examples. Align to any national scheme that applies."},
    {"heading": "Handling Rules", "guidance": "A matrix of level against storage, transmission, printing, sharing and disposal."},
    {"heading": "Labelling", "guidance": "How labels are applied to documents, email and systems."},
    {"heading": "Ownership", "guidance": "Who classifies, who reclassifies, and how disputes are settled."},
    {"heading": "Retention and Disposal", "guidance": "Retention period and destruction method per level."},
    {"heading": "Roles and Responsibilities", "guidance": "Data owners, custodians, users."},
    {"heading": "Review Cycle", "guidance": "Review frequency."}
  ]'::jsonb
),
(
  'ASSET', 'Asset Management Policy', 'security',
  'Inventory and ownership of information and technology assets — the prerequisite every other control depends on.',
  '{NCA-ECC,SAMA-CSF,ISO-27001,NIST-CSF,AE-IA}',
  '{ISO-27001:A.5.9,ISO-27001:A.5.10,ISO-27001:A.5.11,NCA-ECC:2-1,SAMA-CSF:3.3.3,NIST-CSF:ID.AM}',
  '{all}', 'annual', 'admin',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver."},
    {"heading": "Purpose", "guidance": "Knowing what exists, who owns it and how critical it is."},
    {"heading": "Scope", "guidance": "Hardware, software, data, cloud services and AI systems."},
    {"heading": "Inventory Requirements", "guidance": "Mandatory attributes per asset type, and the authoritative source for each."},
    {"heading": "Ownership and Criticality", "guidance": "Assigning an owner and a criticality rating, and what the rating drives."},
    {"heading": "Lifecycle", "guidance": "Acquisition, deployment, maintenance, decommissioning, disposal."},
    {"heading": "Discovery and Reconciliation", "guidance": "How unmanaged assets and shadow IT are found and brought into scope."},
    {"heading": "Roles and Responsibilities", "guidance": "Asset owners, custodians, inventory maintainers."},
    {"heading": "Review Cycle", "guidance": "Reconciliation and review frequency."}
  ]'::jsonb
),
(
  'RMP', 'Risk Management Policy', 'governance',
  'How risk is identified, scored, treated and escalated — the process the regulator asks to see before it looks at any individual control.',
  '{NCA-ECC,SAMA-CSF,ISO-27001,NIST-CSF,EU-DORA,CBB-OM5}',
  '{NCA-ECC:1-5,SAMA-CSF:3.2.1,NIST-CSF:GV.RM,AE-IA:M2}',
  '{all}', 'annual', 'owner',
  '[
    {"heading": "Document Control", "guidance": "Version, effective date, owner, approver."},
    {"heading": "Purpose", "guidance": "A consistent, repeatable basis for risk decisions."},
    {"heading": "Scope", "guidance": "Risk types covered and organisational scope."},
    {"heading": "Risk Appetite", "guidance": "Board-approved appetite statements, expressed so a given risk score is unambiguously inside or outside."},
    {"heading": "Assessment Methodology", "guidance": "Likelihood and impact scales, the scoring formula, and how inherent and residual differ."},
    {"heading": "Treatment Options", "guidance": "Mitigate, accept, transfer, avoid, and the authority required for each."},
    {"heading": "Acceptance and Exceptions", "guidance": "Who may accept a risk at what score, and for how long."},
    {"heading": "Escalation", "guidance": "Thresholds that force escalation to executive or board level."},
    {"heading": "Monitoring and Reporting", "guidance": "Register review cadence and reporting to governance bodies."},
    {"heading": "Roles and Responsibilities", "guidance": "Risk owners, risk function, board committee."},
    {"heading": "Review Cycle", "guidance": "Review frequency."}
  ]'::jsonb
)
on conflict (code) do update set
  title              = excluded.title,
  category           = excluded.category,
  description        = excluded.description,
  framework_codes    = excluded.framework_codes,
  control_codes      = excluded.control_codes,
  applies_to_sectors = excluded.applies_to_sectors,
  review_cadence     = excluded.review_cadence,
  approver_role      = excluded.approver_role,
  required_sections  = excluded.required_sections;

-- =============================================================================
-- Risk taxonomy
-- =============================================================================

insert into public.risk_taxonomy (
  code, category, name, description, typical_causes, typical_impacts,
  related_frameworks, default_likelihood, default_impact
) values
('cyber-intrusion', 'cyber', 'Unauthorised system intrusion',
 'An external actor gains access to internal systems.',
 '{unpatched internet-facing service,credential compromise,misconfigured remote access}',
 '{data exfiltration,service disruption,regulatory penalty,reputational damage}',
 '{NCA-ECC,SAMA-CSF,ISO-27001,NIST-CSF}', 3, 5),

('ransomware', 'cyber', 'Ransomware and extortion',
 'Encryption or exfiltration of data followed by an extortion demand.',
 '{phishing,exposed RDP or VPN,unsegmented network,inadequate backups}',
 '{operational outage,data loss,extortion payment,regulatory notification}',
 '{NCA-ECC,SAMA-CSF,ISO-27001,EU-NIS2}', 3, 5),

('data-breach', 'cyber', 'Personal data breach',
 'Unauthorised access to, disclosure of, or loss of personal data.',
 '{misconfigured storage,insider access,third-party compromise,lost device}',
 '{regulator notification,data subject notification,fines,civil claims}',
 '{SA-PDPL,EU-GDPR,AE-PDPL,QA-PDPPL,JO-PDPL}', 3, 5),

('insider-threat', 'cyber', 'Malicious or negligent insider',
 'Harm caused by someone with legitimate access.',
 '{excessive privilege,absent monitoring,poor leaver process,disgruntlement}',
 '{data theft,sabotage,fraud,regulatory breach}',
 '{NCA-ECC,SAMA-CSF,ISO-27001}', 2, 4),

('phishing-social-engineering', 'cyber', 'Phishing and social engineering',
 'Manipulation of personnel to disclose credentials or authorise a fraudulent action.',
 '{low awareness,absent email authentication,no MFA,weak payment verification}',
 '{credential compromise,fraudulent payment,malware delivery}',
 '{NCA-ECC,SAMA-CSF,ISO-27001,PCI-DSS}', 4, 4),

('ddos', 'cyber', 'Denial of service',
 'Deliberate exhaustion of capacity making services unavailable.',
 '{no upstream scrubbing,single provider,under-provisioned capacity}',
 '{service unavailability,SLA breach,regulator scrutiny}',
 '{NCA-ECC,SAMA-CSF,EU-DORA}', 3, 3),

('supply-chain-compromise', 'third_party', 'Supply chain compromise',
 'Compromise reaching the organisation through a supplier, component or update channel.',
 '{unvetted dependency,compromised supplier,unsigned update}',
 '{widespread compromise,prolonged detection time,contractual liability}',
 '{ISO-27001,NIST-CSF,EU-NIS2,EU-DORA}', 3, 5),

('cloud-misconfiguration', 'cyber', 'Cloud misconfiguration',
 'Exposure caused by insecure cloud configuration rather than an attack.',
 '{public storage,permissive IAM,disabled logging,configuration drift}',
 '{data exposure,regulatory breach,loss of forensic capability}',
 '{NCA-CCC,NCA-ECC,ISO-27001,QCB-TRC}', 4, 4),

('third-party-failure', 'third_party', 'Critical third-party failure',
 'A supplier the organisation depends on fails, is breached, or exits.',
 '{concentration on one provider,no exit plan,weak contractual protection}',
 '{operational disruption,inability to meet obligations,regulator notification}',
 '{EU-DORA,SAMA-CSF,CBUAE-ISS,ISO-27001}', 3, 4),

('credential-compromise', 'cyber', 'Credential compromise',
 'Legitimate credentials fall into an attacker''s hands.',
 '{reused passwords,absent MFA,infostealer malware,exposed secrets in code}',
 '{account takeover,lateral movement,data access}',
 '{NCA-ECC,SAMA-CSF,ISO-27001,PCI-DSS}', 4, 4),

('vulnerability-exploitation', 'cyber', 'Exploitation of a known vulnerability',
 'A published vulnerability is exploited before it is remediated.',
 '{slow patching,incomplete asset inventory,unsupported software}',
 '{system compromise,data loss,service disruption}',
 '{NCA-ECC,SAMA-CSF,ISO-27001,PCI-DSS}', 4, 4),

('ot-ics-compromise', 'operational', 'Operational technology compromise',
 'Compromise of industrial control or safety systems.',
 '{flat IT/OT network,legacy unsupported controllers,unmanaged remote vendor access}',
 '{physical safety impact,production loss,environmental harm}',
 '{NCA-OTCC,NCA-ECC,EU-NIS2}', 2, 5),

('payment-fraud', 'financial', 'Payment fraud',
 'Unauthorised or manipulated payment transactions.',
 '{weak authorisation controls,business email compromise,insider collusion}',
 '{direct financial loss,regulator reporting,customer redress}',
 '{SAMA-CSF,PCI-DSS,CBUAE-ISS,QCB-TRC}', 3, 4),

('api-abuse', 'cyber', 'API abuse and data scraping',
 'Exposed interfaces abused to extract data or manipulate function.',
 '{missing authorisation checks,no rate limiting,undocumented endpoints}',
 '{bulk data exposure,fraud,service degradation}',
 '{ISO-27001,NCA-ECC,PCI-DSS}', 3, 4),

('regulatory-non-compliance', 'compliance', 'Regulatory non-compliance',
 'Failure to meet an applicable regulatory obligation.',
 '{missed regulatory change,unclear ownership,no evidence retained,missed deadline}',
 '{fines,licence conditions,enforcement action,board accountability}',
 '{NCA-ECC,SAMA-CSF,SA-PDPL,EU-GDPR,EU-AI-ACT}', 3, 4),

('privacy-violation', 'compliance', 'Privacy violation',
 'Processing personal data without a valid basis or beyond the stated purpose.',
 '{no lawful basis,purpose creep,inadequate notice,unhonoured rights request}',
 '{regulator complaint,fines,data subject claims}',
 '{SA-PDPL,EU-GDPR,AE-PDPL,QA-PDPPL,BH-PDPL}', 3, 4),

('cross-border-transfer-breach', 'compliance', 'Unlawful cross-border transfer',
 'Personal data leaves the jurisdiction without the required condition being met.',
 '{cloud region misconfiguration,unassessed subprocessor,no transfer assessment}',
 '{regulator enforcement,order to suspend transfers,fines}',
 '{SA-PDPL,EU-GDPR,AE-PDPL,OM-PDPL}', 3, 4),

('ai-model-risk', 'ai', 'AI model performance and reliability risk',
 'An AI system performs materially worse in production than in evaluation.',
 '{data drift,unrepresentative training data,no monitoring,inadequate testing}',
 '{poor decisions,customer harm,regulatory scrutiny}',
 '{EU-AI-ACT,SDAIA-AI-ETHICS,ISO-42001,NIST-AI-RMF}', 3, 3),

('ai-bias-discrimination', 'ai', 'AI bias and discriminatory outcome',
 'An AI system produces systematically unfair outcomes for a group.',
 '{biased training data,proxy variables,no fairness testing,no affected-group review}',
 '{discrimination claims,regulator enforcement,reputational damage}',
 '{EU-AI-ACT,SDAIA-AI-ETHICS,ISO-42001}', 3, 4),

('ai-output-integrity', 'ai', 'Unreliable generative AI output',
 'Fabricated or incorrect generative output relied on without review.',
 '{no human review,unclear accountability,overreliance on model output}',
 '{incorrect advice,contractual exposure,reputational damage}',
 '{SDAIA-GENAI,EU-AI-ACT,ISO-42001}', 4, 3),

('shadow-ai', 'ai', 'Unsanctioned AI use',
 'Staff use AI tools outside any governance process.',
 '{no approved tooling,no acceptable use guidance,no monitoring}',
 '{confidential data disclosure,privacy breach,unmanaged model risk}',
 '{SDAIA-GENAI,SA-PDPL,ISO-42001}', 4, 3),

('business-continuity-disruption', 'operational', 'Business continuity disruption',
 'A disruptive event stops critical business processes.',
 '{single point of failure,untested plans,unavailable key personnel}',
 '{revenue loss,SLA breach,regulator notification}',
 '{ISO-22301,SAMA-BCM,NCA-ECC,EU-DORA}', 3, 4),

('availability-outage', 'operational', 'Unplanned availability outage',
 'Loss of service availability from a non-adversarial cause.',
 '{failed change,capacity exhaustion,provider outage,expired certificate}',
 '{customer impact,SLA penalties,regulator scrutiny}',
 '{ISO-27001,EU-DORA,SOC2}', 4, 3),

('data-loss', 'operational', 'Irrecoverable data loss',
 'Data is destroyed or corrupted and cannot be restored.',
 '{unverified backups,ransomware reaching backups,accidental deletion}',
 '{operational disruption,regulatory breach,loss of records}',
 '{ISO-27001,NCA-ECC,SAMA-BCM}', 2, 5),

('key-management-failure', 'cyber', 'Cryptographic key management failure',
 'Keys are lost, exposed, or an algorithm is used past its safe life.',
 '{no key inventory,no rotation,keys in source control,deprecated algorithms}',
 '{data exposure,irrecoverable data,compliance failure}',
 '{ISO-27001,NCA-ECC,PCI-DSS}', 2, 4),

('change-failure', 'operational', 'Failed change',
 'An authorised change causes an outage or introduces a security weakness.',
 '{inadequate testing,no rollback,emergency change bypass}',
 '{outage,security regression,audit finding}',
 '{ISO-27001,SAMA-CSF,SOC2}', 4, 3),

('physical-security-breach', 'physical', 'Physical security breach',
 'Unauthorised physical access to facilities or equipment.',
 '{tailgating,unrevoked badges,unattended equipment,weak visitor control}',
 '{equipment or data theft,system tampering}',
 '{ISO-27001,NCA-ECC,QA-NIA}', 2, 3),

('human-error', 'operational', 'Human error',
 'An unintentional action by staff causes loss or exposure.',
 '{unclear procedure,no verification step,fatigue,inadequate training}',
 '{data exposure,outage,financial loss}',
 '{ISO-27001,NCA-ECC}', 4, 3),

('concentration-risk', 'third_party', 'Concentration risk',
 'Excessive dependence on a single provider, region or technology.',
 '{single-vendor strategy,no substitutability assessment,regional concentration}',
 '{systemic disruption,limited negotiating position,regulator concern}',
 '{EU-DORA,CBUAE-ISS,SAMA-CSF}', 3, 4),

('geopolitical-disruption', 'strategic', 'Geopolitical and regional disruption',
 'Regional instability, sanctions or conflict disrupts operations or supply.',
 '{regional tension,sanctions changes,cross-border restrictions}',
 '{supply disruption,payment restrictions,staff safety,data access loss}',
 '{EU-DORA,SAMA-CSF}', 3, 4),

('sanctions-screening-failure', 'compliance', 'Sanctions and screening failure',
 'A prohibited party or transaction is not detected.',
 '{stale screening lists,poor data quality,manual process}',
 '{enforcement action,fines,loss of correspondent relationships}',
 '{SAMA-CSF,CBUAE-ISS,QCB-TRC}', 2, 5),

('legal-contractual', 'strategic', 'Legal and contractual exposure',
 'Contractual commitments cannot be met, or terms create unmanaged liability.',
 '{unreviewed terms,uncapped liability,commitments beyond capability}',
 '{litigation,penalties,loss of client}',
 '{ISO-27001,SOC2}', 2, 3),

('reputational', 'strategic', 'Reputational damage',
 'Loss of stakeholder trust following an incident or disclosure.',
 '{public incident,regulator enforcement,poor incident communication}',
 '{customer attrition,market confidence,recruitment difficulty}',
 '{NCA-ECC,SAMA-CSF,EU-GDPR}', 3, 4)

on conflict (code) do update set
  category           = excluded.category,
  name               = excluded.name,
  description        = excluded.description,
  typical_causes     = excluded.typical_causes,
  typical_impacts    = excluded.typical_impacts,
  related_frameworks = excluded.related_frameworks,
  default_likelihood = excluded.default_likelihood,
  default_impact     = excluded.default_impact;

-- =============================================================================
-- Obligation templates — instantiated into a dated calendar per tenant
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      -- NCA ECC
      ('NCA-ECC', '1-8',  'NCA-ECC-SELF-ASSESS', 'Annual ECC compliance self-assessment',
       'Assess implementation of every applicable ECC control and report the result through the NCA compliance mechanism.',
       'annual', 60, 'critical', array['completed assessment workbook','evidence index per control','approved remediation plan'], 'CISO'),
      ('NCA-ECC', '1-8',  'NCA-ECC-AUDIT', 'Periodic cybersecurity review and audit',
       'Independent review of cybersecurity implementation, with findings tracked to closure.',
       'annual', 45, 'high', array['audit report','management response','remediation tracker'], 'Internal Audit'),
      ('NCA-ECC', '1-5',  'NCA-ECC-RISK-ASSESS', 'Annual cybersecurity risk assessment',
       'Refresh the cybersecurity risk assessment and re-approve the treatment plan.',
       'annual', 30, 'high', array['risk register export','risk treatment plan','approval record'], 'CISO'),
      ('NCA-ECC', '1-10', 'NCA-ECC-AWARENESS', 'Annual cybersecurity awareness programme',
       'Deliver and evidence the awareness programme for all personnel, with role-specific modules.',
       'annual', 30, 'medium', array['completion report','course content','phishing simulation results'], 'CISO'),
      ('NCA-ECC', '2-10', 'NCA-ECC-VULN-SCAN', 'Vulnerability scanning cycle',
       'Scan in-scope assets and remediate findings within the defined service levels.',
       'monthly', 7, 'high', array['scan report','remediation evidence','exception approvals'], 'Security Operations'),
      ('NCA-ECC', '2-11', 'NCA-ECC-PENTEST', 'Penetration testing',
       'Penetration test internet-facing and critical internal systems, and close findings.',
       'annual', 60, 'high', array['test report','retest evidence','remediation plan'], 'CISO'),
      ('NCA-ECC', '3-1',  'NCA-ECC-BCM-TEST', 'Business continuity and recovery test',
       'Exercise recovery of critical systems and confirm recovery objectives are met.',
       'annual', 45, 'high', array['test plan','test results','lessons learned'], 'Continuity Manager'),
      ('NCA-ECC', '4-1',  'NCA-ECC-TPRM-REVIEW', 'Third-party cybersecurity review',
       'Reassess critical third parties against contractual security requirements.',
       'annual', 45, 'medium', array['assessment records','contract review','risk acceptance where applicable'], 'Procurement'),
      ('NCA-ECC', '2-2',  'NCA-ECC-ACCESS-REVIEW', 'Access rights recertification',
       'Recertify user and privileged access to in-scope systems and revoke what is no longer needed.',
       'quarterly', 14, 'high', array['recertification report','revocation evidence','approver sign-off'], 'System Owners'),

      -- SAMA
      ('SAMA-CSF', '3.2.4', 'SAMA-MATURITY', 'SAMA cyber security maturity self-assessment',
       'Complete the maturity self-assessment against every CSF subdomain and submit it to SAMA.',
       'annual', 60, 'critical', array['maturity assessment workbook','evidence per subdomain','board-approved improvement plan'], 'CISO'),
      ('SAMA-CSF', '3.2.5', 'SAMA-AUDIT', 'Cyber security audit',
       'Internal or external audit of the cyber security programme, reported to the audit committee.',
       'annual', 45, 'high', array['audit report','committee minutes','remediation tracker'], 'Internal Audit'),
      ('SAMA-CSF', '3.1.1', 'SAMA-BOARD-REPORT', 'Board cyber security report',
       'Report cyber security posture, incidents and programme progress to the board or its delegated committee.',
       'quarterly', 21, 'high', array['board pack','minutes recording the discussion'], 'CISO'),
      ('SAMA-CSF', '3.3.17','SAMA-PENTEST', 'Penetration testing of critical systems',
       'Penetration test critical and internet-facing systems, including payment channels.',
       'annual', 60, 'high', array['test report','retest evidence'], 'CISO'),
      ('SAMA-CSF', '3.3.15','SAMA-INCIDENT-NOTIFY', 'Cyber incident notification to SAMA',
       'Notify SAMA of a qualifying cyber incident within the timeframe set by the applicable circular, then follow up with a full report.',
       'event_driven', 0, 'critical', array['notification record','incident report','root cause analysis'], 'CISO'),
      ('SAMA-BCM', 'TEST-1','SAMA-BCM-TEST', 'Business continuity exercise',
       'Exercise the continuity and recovery plans for critical business services.',
       'annual', 45, 'high', array['exercise plan','results','improvement actions'], 'Continuity Manager'),

      -- Saudi PDPL
      ('SA-PDPL', 'PDPL-BREACH',   'PDPL-BREACH-NOTIFY', 'Personal data breach notification (PDPL)',
       'Notify SDAIA of a personal data breach, and affected data subjects where the breach may cause them harm, within the statutory timeframe.',
       'event_driven', 0, 'critical', array['breach assessment','notification record','data subject communication'], 'DPO'),
      ('SA-PDPL', 'PDPL-ROPA',     'PDPL-ROPA-REVIEW', 'Records of processing review',
       'Review and update the record of processing activities so it reflects current processing.',
       'annual', 30, 'high', array['updated ROPA','review sign-off'], 'DPO'),
      ('SA-PDPL', 'PDPL-DPIA',     'PDPL-DPIA', 'Impact assessment for high-risk processing',
       'Carry out an impact assessment before starting processing likely to present a high risk to data subjects.',
       'event_driven', 30, 'high', array['completed assessment','mitigation plan','approval record'], 'DPO'),
      ('SA-PDPL', 'PDPL-TRANSFER', 'PDPL-TRANSFER-REVIEW', 'Cross-border transfer review',
       'Reassess transfers of personal data outside the Kingdom against the current conditions and safeguards.',
       'annual', 30, 'high', array['transfer register','assessment records','safeguard evidence'], 'DPO'),

      -- ISO 27001
      ('ISO-27001', 'A.5.35', 'ISO-INTERNAL-AUDIT', 'ISMS internal audit',
       'Audit the information security management system against the standard and the organisation''s own requirements.',
       'annual', 45, 'high', array['audit programme','audit report','nonconformity records'], 'Internal Audit'),
      ('ISO-27001', 'A.5.36', 'ISO-MGMT-REVIEW', 'ISMS management review',
       'Management review of ISMS performance, including audit results, risk status and improvement opportunities.',
       'annual', 30, 'high', array['review inputs','minutes','decisions and actions'], 'CISO'),
      ('ISO-27001', 'A.5.1',  'ISO-SOA-REVIEW', 'Statement of Applicability review',
       'Review the Statement of Applicability so inclusions, exclusions and justifications remain accurate.',
       'annual', 30, 'medium', array['updated SoA','justification for each exclusion'], 'CISO'),
      ('ISO-27001', 'A.8.13', 'ISO-BACKUP-RESTORE-TEST', 'Backup restore verification',
       'Verify that backups can actually be restored within the required objectives.',
       'quarterly', 14, 'high', array['restore test record','result against RTO and RPO'], 'IT Operations'),

      -- PCI DSS
      ('PCI-DSS', 'R11', 'PCI-ASV-SCAN', 'Quarterly external vulnerability scan',
       'Passing external scan by an Approved Scanning Vendor covering all external-facing in-scope systems.',
       'quarterly', 14, 'critical', array['ASV scan report showing a passing result','remediation evidence'], 'Security Operations'),
      ('PCI-DSS', 'R11', 'PCI-PENTEST', 'Annual penetration test',
       'Internal and external penetration test of the cardholder data environment, including segmentation testing.',
       'annual', 60, 'high', array['test report','segmentation test results','remediation evidence'], 'CISO'),
      ('PCI-DSS', 'R12', 'PCI-ANNUAL-ASSESS', 'Annual PCI DSS assessment',
       'Complete the Report on Compliance or the applicable Self-Assessment Questionnaire and Attestation of Compliance.',
       'annual', 90, 'critical', array['ROC or SAQ','Attestation of Compliance','evidence index'], 'Compliance'),
      ('PCI-DSS', 'R1',  'PCI-RULE-REVIEW', 'Network security rule review',
       'Review firewall and router rule sets, removing rules no longer justified.',
       'semiannual', 21, 'medium', array['rule review record','change tickets for removals'], 'Network Operations'),

      -- GDPR
      ('EU-GDPR', 'ART-33', 'GDPR-BREACH-NOTIFY', 'Personal data breach notification (GDPR)',
       'Notify the competent supervisory authority within 72 hours of becoming aware of a notifiable breach.',
       'event_driven', 0, 'critical', array['breach assessment','Article 33 notification','data subject communication where required'], 'DPO'),
      ('EU-GDPR', 'ART-30', 'GDPR-ROPA-REVIEW', 'Article 30 records review',
       'Review the records of processing activities for accuracy and completeness.',
       'annual', 30, 'high', array['updated Article 30 record'], 'DPO'),
      ('EU-GDPR', 'ART-35', 'GDPR-DPIA', 'Data protection impact assessment',
       'Complete a DPIA before processing likely to result in a high risk to data subjects.',
       'event_driven', 30, 'high', array['completed DPIA','DPO advice','residual risk decision'], 'DPO'),

      -- EU AI Act
      ('EU-AI-ACT', 'ART-4',  'AIACT-LITERACY', 'AI literacy programme',
       'Ensure personnel operating AI systems have a sufficient level of AI literacy, and evidence it.',
       'annual', 30, 'medium', array['training records','course content','coverage report'], 'AI Governance Owner'),
      ('EU-AI-ACT', 'ART-9',  'AIACT-RISK-REVIEW', 'High-risk AI system risk review',
       'Review and update the risk management system for each high-risk AI system.',
       'annual', 45, 'high', array['risk management file','test results','residual risk statement'], 'AI Governance Owner'),
      ('EU-AI-ACT', 'ART-72', 'AIACT-POSTMARKET', 'Post-market monitoring review',
       'Review post-market monitoring data for high-risk AI systems and act on what it shows.',
       'annual', 30, 'high', array['monitoring report','performance metrics','corrective actions'], 'AI Governance Owner'),
      ('EU-AI-ACT', 'ART-73', 'AIACT-INCIDENT', 'Serious AI incident reporting',
       'Report serious incidents involving a high-risk AI system to the market surveillance authority within the deadline in Article 73.',
       'event_driven', 0, 'critical', array['incident record','authority notification','corrective action plan'], 'AI Governance Owner'),
      ('EU-AI-ACT', 'ART-27', 'AIACT-FRIA', 'Fundamental rights impact assessment',
       'Complete a fundamental rights impact assessment before deploying an in-scope high-risk AI system.',
       'event_driven', 45, 'high', array['completed assessment','mitigation measures','notification where required'], 'AI Governance Owner'),

      -- DORA
      ('EU-DORA', 'P1', 'DORA-FRAMEWORK-REVIEW', 'ICT risk management framework review',
       'Review the ICT risk management framework and report the outcome to the management body.',
       'annual', 45, 'high', array['framework review record','management body minutes'], 'CISO'),
      ('EU-DORA', 'P4', 'DORA-REGISTER', 'Register of information on ICT third-party arrangements',
       'Maintain and submit the register of information covering all contractual arrangements with ICT third-party providers.',
       'annual', 60, 'critical', array['register of information','submission confirmation'], 'Procurement'),
      ('EU-DORA', 'P3', 'DORA-TLPT', 'Threat-led penetration testing',
       'Threat-led penetration testing for entities in scope of the advanced testing requirement.',
       'triennial', 120, 'high', array['test scope agreement','test report','remediation plan'], 'CISO'),
      ('EU-DORA', 'P2', 'DORA-MAJOR-INCIDENT', 'Major ICT incident reporting',
       'Submit initial, intermediate and final reports for a major ICT-related incident within the regulatory deadlines.',
       'event_driven', 0, 'critical', array['initial notification','intermediate report','final report'], 'CISO'),

      -- NIS2
      ('EU-NIS2', '23-EARLY', 'NIS2-EARLY-WARNING', 'NIS2 24-hour early warning',
       'Submit an early warning to the CSIRT or competent authority within 24 hours of becoming aware of a significant incident.',
       'event_driven', 0, 'critical', array['early warning submission','incident record'], 'CISO'),
      ('EU-NIS2', '23-FULL',  'NIS2-INCIDENT-NOTIFY', 'NIS2 incident notification and final report',
       'Submit the incident notification within 72 hours and the final report within one month.',
       'event_driven', 0, 'critical', array['72-hour notification','final report'], 'CISO'),
      ('EU-NIS2', '21-2-F',   'NIS2-MEASURES-REVIEW', 'Review of risk-management measures',
       'Assess the effectiveness of the Article 21 cybersecurity risk-management measures.',
       'annual', 45, 'high', array['effectiveness assessment','improvement plan'], 'CISO'),

      -- Other GCC financial regulators
      ('CBUAE-ISS', 'INC-1', 'CBUAE-INCIDENT-NOTIFY', 'Incident notification to CBUAE',
       'Notify the Central Bank of the UAE of a qualifying information security or operational incident.',
       'event_driven', 0, 'critical', array['notification record','incident report'], 'CISO'),
      ('QCB-TRC',   'INC-1', 'QCB-INCIDENT-NOTIFY', 'Incident notification to QCB',
       'Notify the Qatar Central Bank of a qualifying technology or information security incident.',
       'event_driven', 0, 'critical', array['notification record','incident report'], 'CISO'),
      ('CBJ-CSF',   'INC-1', 'CBJ-INCIDENT-NOTIFY', 'Incident notification to the Central Bank of Jordan',
       'Notify the Central Bank of Jordan of a qualifying cyber or information security incident.',
       'event_driven', 0, 'critical', array['notification record','incident report'], 'CISO'),
      ('CBB-OM5',   'CYB-1', 'CBB-CYBER-REPORT', 'Cyber security reporting to the CBB',
       'Periodic reporting on cyber security posture and incidents as required by the CBB Rulebook.',
       'quarterly', 21, 'high', array['report submission','supporting metrics'], 'Compliance'),
      ('QA-NIA',    'CERT-1','QNIA-COMPLIANCE-REVIEW', 'NIA compliance review',
       'Review compliance against the National Information Assurance standard and report to the NCSA where required.',
       'annual', 60, 'high', array['compliance assessment','evidence index'], 'CISO'),
      ('AE-IA',     'M8',    'UAEIA-COMPLIANCE-REVIEW', 'UAE IA compliance review',
       'Review implementation of the applicable UAE Information Assurance controls by priority tier.',
       'annual', 60, 'high', array['compliance assessment','remediation plan'], 'CISO')
    ) as t(fw, ctrl, code, title, descr, cadence, lead, sev, evidence, role)
  loop
    insert into public.obligation_templates (
      framework_id, control_code, code, title, description, cadence,
      lead_time_days, severity, evidence_required, responsible_role, citation
    )
    select
      f.id, r.ctrl, r.code, r.title, r.descr, r.cadence,
      r.lead, r.sev, r.evidence, r.role, f.citation
    from public.frameworks f
    where f.code = r.fw
    on conflict (code) do update set
      framework_id      = excluded.framework_id,
      control_code      = excluded.control_code,
      title             = excluded.title,
      description       = excluded.description,
      cadence           = excluded.cadence,
      lead_time_days    = excluded.lead_time_days,
      severity          = excluded.severity,
      evidence_required = excluded.evidence_required,
      responsible_role  = excluded.responsible_role,
      citation          = excluded.citation;
  end loop;
end
$seed$;

-- =============================================================================
-- AI classification rules
--
-- Ordered: the first matching rule wins, so prohibited practices are evaluated
-- before high-risk, and high-risk before transparency-only.
-- =============================================================================

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      -- Prohibited (EU AI Act Article 5)
      ('EUAIA-P-SOCIAL-SCORING', 'eu_ai_act', 'prohibited',
       'Social scoring of natural persons',
       'Article 5(1)(c) prohibits evaluating or classifying people based on social behaviour or personal characteristics where it leads to detrimental or unfavourable treatment that is unjustified or disproportionate.',
       'Regulation (EU) 2024/1689, Article 5(1)(c)',
       array['social scoring','social credit','citizen scoring','trustworthiness score'],
       array[]::text[],
       array['Do not place on the market or put into service','Terminate any existing deployment'], 10),

      ('EUAIA-P-EMOTION-WORK', 'eu_ai_act', 'prohibited',
       'Emotion inference in the workplace or education',
       'Article 5(1)(f) prohibits inferring emotions of a natural person in the workplace or in education institutions, except for medical or safety reasons.',
       'Regulation (EU) 2024/1689, Article 5(1)(f)',
       array['emotion recognition','emotion detection','sentiment of employees','affect recognition'],
       array[]::text[],
       array['Do not deploy in employment or education contexts','Reassess whether a medical or safety exemption genuinely applies'], 11),

      ('EUAIA-P-BIOMETRIC-CATEG', 'eu_ai_act', 'prohibited',
       'Biometric categorisation to infer protected characteristics',
       'Article 5(1)(g) prohibits biometric categorisation systems that infer race, political opinions, trade union membership, religious or philosophical beliefs, sex life or sexual orientation.',
       'Regulation (EU) 2024/1689, Article 5(1)(g)',
       array['biometric categorisation','infer ethnicity','infer religion','infer sexual orientation'],
       array['processes_biometric_data'],
       array['Do not place on the market or put into service'], 12),

      ('EUAIA-P-FACE-SCRAPING', 'eu_ai_act', 'prohibited',
       'Untargeted scraping of facial images',
       'Article 5(1)(e) prohibits creating or expanding facial recognition databases through untargeted scraping of facial images from the internet or CCTV footage.',
       'Regulation (EU) 2024/1689, Article 5(1)(e)',
       array['facial image scraping','face database scraping','untargeted facial recognition'],
       array['processes_biometric_data'],
       array['Do not build or expand the database','Delete unlawfully scraped material'], 13),

      -- High risk (Annex III)
      ('EUAIA-H-BIOMETRICS', 'eu_ai_act', 'high',
       'Annex III(1) — Biometric identification and categorisation',
       'Remote biometric identification, biometric categorisation by sensitive attributes, and emotion recognition, where not otherwise prohibited.',
       'Regulation (EU) 2024/1689, Annex III(1)',
       array['biometric identification','facial recognition','fingerprint matching','iris recognition','voice identification'],
       array['processes_biometric_data'],
       array['Register in the EU database before putting into service','Establish an Article 9 risk management system','Complete Annex IV technical documentation','Implement Article 14 human oversight','Enable Article 12 automatic logging'], 20),

      ('EUAIA-H-CRITICAL-INFRA', 'eu_ai_act', 'high',
       'Annex III(2) — Critical infrastructure',
       'Safety components in the management and operation of critical digital infrastructure, road traffic, or the supply of water, gas, heating or electricity.',
       'Regulation (EU) 2024/1689, Annex III(2)',
       array['traffic management','water supply','electricity grid','gas supply','safety component','SCADA control'],
       array['used_in_critical_infrastructure'],
       array['Establish an Article 9 risk management system','Meet Article 15 accuracy and robustness requirements','Implement human oversight with a documented stop capability'], 21),

      ('EUAIA-H-EDUCATION', 'eu_ai_act', 'high',
       'Annex III(3) — Education and vocational training',
       'Determining access or admission, evaluating learning outcomes, assessing the appropriate level of education, or monitoring prohibited behaviour during tests.',
       'Regulation (EU) 2024/1689, Annex III(3)',
       array['admissions','student assessment','exam proctoring','grading','learning outcome evaluation'],
       array[]::text[],
       array['Complete a fundamental rights impact assessment where Article 27 applies','Implement human oversight of every outcome','Inform affected students that AI is used'], 22),

      ('EUAIA-H-EMPLOYMENT', 'eu_ai_act', 'high',
       'Annex III(4) — Employment and worker management',
       'Recruitment or selection, decisions on promotion or termination, task allocation, and monitoring or evaluating performance and behaviour.',
       'Regulation (EU) 2024/1689, Annex III(4)',
       array['cv screening','candidate ranking','recruitment','promotion decision','performance evaluation','worker monitoring','task allocation'],
       array[]::text[],
       array['Complete a fundamental rights impact assessment where Article 27 applies','Inform workers and their representatives before putting into service','Implement human review of every adverse decision','Test for bias across protected groups'], 23),

      ('EUAIA-H-ESSENTIAL-SERVICES', 'eu_ai_act', 'high',
       'Annex III(5) — Access to essential services',
       'Eligibility for public assistance, creditworthiness and credit scoring, risk assessment and pricing in life and health insurance, and emergency call triage.',
       'Regulation (EU) 2024/1689, Annex III(5)',
       array['credit scoring','creditworthiness','loan decision','insurance pricing','insurance underwriting','benefits eligibility','emergency triage'],
       array[]::text[],
       array['Complete a fundamental rights impact assessment where Article 27 applies','Provide an explanation of the decision to the affected person','Implement human review of adverse decisions','Test for bias across protected groups'], 24),

      ('EUAIA-H-LAW-ENFORCEMENT', 'eu_ai_act', 'high',
       'Annex III(6) — Law enforcement',
       'Individual risk assessments, polygraphs, evidence reliability evaluation, and profiling in the course of detecting, investigating or prosecuting offences.',
       'Regulation (EU) 2024/1689, Annex III(6)',
       array['predictive policing','recidivism','crime risk assessment','evidence evaluation','polygraph'],
       array[]::text[],
       array['Register in the EU database','Establish an Article 9 risk management system','Implement human oversight','Complete a fundamental rights impact assessment'], 25),

      ('EUAIA-H-MIGRATION', 'eu_ai_act', 'high',
       'Annex III(7) — Migration, asylum and border control',
       'Polygraphs, risk assessment of persons entering, examination of applications for asylum, visa or residence permits, and detection or identification in migration contexts.',
       'Regulation (EU) 2024/1689, Annex III(7)',
       array['visa application','asylum application','border control','migration risk assessment'],
       array[]::text[],
       array['Register in the EU database','Establish an Article 9 risk management system','Implement human oversight'], 26),

      ('EUAIA-H-JUSTICE', 'eu_ai_act', 'high',
       'Annex III(8) — Administration of justice and democratic processes',
       'Assisting a judicial authority in researching and interpreting facts and law or applying the law, and influencing the outcome of elections or referenda.',
       'Regulation (EU) 2024/1689, Annex III(8)',
       array['judicial decision support','legal reasoning','sentencing','election influence','voter targeting'],
       array[]::text[],
       array['Register in the EU database','Implement human oversight by the judicial authority','Complete a fundamental rights impact assessment'], 27),

      -- General-purpose AI
      ('EUAIA-GPAI-SYSTEMIC', 'eu_ai_act', 'gpai_systemic',
       'Chapter V — GPAI model with systemic risk',
       'A general-purpose AI model meeting the systemic risk criteria in Article 51 carries the additional obligations in Article 55.',
       'Regulation (EU) 2024/1689, Articles 51 and 55',
       array['foundation model','frontier model','general purpose model'],
       array['is_general_purpose'],
       array['Notify the Commission','Perform model evaluation and adversarial testing','Assess and mitigate systemic risk','Track and report serious incidents','Ensure an adequate level of cybersecurity protection'], 30),

      ('EUAIA-GPAI', 'eu_ai_act', 'gpai',
       'Chapter V — General-purpose AI model',
       'Providers of general-purpose AI models carry the Article 53 documentation, transparency and copyright obligations.',
       'Regulation (EU) 2024/1689, Article 53',
       array['general purpose ai','foundation model','large language model'],
       array['is_general_purpose'],
       array['Draw up technical documentation','Provide information to downstream providers','Put a copyright policy in place','Publish a sufficiently detailed summary of training content'], 31),

      -- Transparency only
      ('EUAIA-L-INTERACTION', 'eu_ai_act', 'limited',
       'Article 50 — Direct interaction with a natural person',
       'Systems intended to interact directly with people must be designed so the person is informed they are interacting with an AI system, unless it is obvious.',
       'Regulation (EU) 2024/1689, Article 50(1)',
       array['chatbot','virtual assistant','conversational agent','customer service bot'],
       array[]::text[],
       array['Disclose AI interaction at the start of the exchange','Offer a route to a human where the context warrants it'], 40),

      ('EUAIA-L-SYNTHETIC', 'eu_ai_act', 'limited',
       'Article 50 — Synthetic content and deepfakes',
       'Generated or manipulated audio, image, video or text must be marked in a machine-readable way and disclosed as artificially generated.',
       'Regulation (EU) 2024/1689, Article 50(2) and 50(4)',
       array['generative','image generation','video generation','voice cloning','deepfake','synthetic media','text generation'],
       array['is_generative'],
       array['Mark output in a machine-readable format','Disclose that content is artificially generated or manipulated','Label deepfakes and AI-generated text on matters of public interest'], 41),

      ('EUAIA-MINIMAL', 'eu_ai_act', 'minimal',
       'Minimal risk',
       'No specific obligation under the AI Act beyond the Article 4 AI literacy duty. Voluntary codes of conduct are encouraged.',
       'Regulation (EU) 2024/1689',
       array[]::text[],
       array[]::text[],
       array['Maintain the system in the AI inventory','Reassess if the purpose or context changes','Meet the Article 4 AI literacy obligation'], 99),

      -- SDAIA tiering
      ('SDAIA-UNACCEPTABLE', 'sdaia', 'unacceptable',
       'Unacceptable risk under the SDAIA AI Ethics Principles',
       'Uses incompatible with human dignity, agency or fundamental rights, which SDAIA expects organisations not to pursue.',
       'SDAIA AI Ethics Principles v1.0',
       array['social scoring','mass surveillance','manipulation of vulnerable groups'],
       array[]::text[],
       array['Do not proceed','Escalate to the AI governance body for a formal decision'], 10),

      ('SDAIA-HIGH', 'sdaia', 'high',
       'High risk under the SDAIA AI Ethics Principles',
       'Systems materially affecting individuals'' rights, safety, health, financial standing or access to services.',
       'SDAIA AI Ethics Principles v1.0',
       array['credit decision','medical diagnosis','recruitment','safety critical','law enforcement','insurance underwriting','government service eligibility'],
       array[]::text[],
       array['Complete a documented risk and impact assessment','Apply all seven principles with evidence for each','Maintain human oversight of consequential decisions','Test for bias across affected groups','Disclose AI use to affected persons'], 20),

      ('SDAIA-LIMITED', 'sdaia', 'limited',
       'Limited risk under the SDAIA AI Ethics Principles',
       'Systems interacting with people or generating content without materially affecting their rights.',
       'SDAIA AI Ethics Principles v1.0',
       array['chatbot','content generation','recommendation','summarisation'],
       array[]::text[],
       array['Disclose AI use','Provide human review of published output','Record the system in the AI inventory'], 40),

      ('SDAIA-LOW', 'sdaia', 'low',
       'Low risk under the SDAIA AI Ethics Principles',
       'Internal or operational AI with no direct effect on individuals.',
       'SDAIA AI Ethics Principles v1.0',
       array[]::text[],
       array[]::text[],
       array['Record the system in the AI inventory','Reassess if the purpose changes'], 99)
    ) as t(code, regime, tier, title, descr, citation, keywords, flags, obligations, ord)
  loop
    insert into public.ai_classification_rules (
      framework_id, code, regime, risk_tier, title, description, citation,
      match_keywords, required_flags, obligations, ordinal
    )
    select
      f.id, r.code, r.regime, r.tier, r.title, r.descr, r.citation,
      r.keywords, r.flags, r.obligations, r.ord
    from public.frameworks f
    where f.code = case r.regime when 'eu_ai_act' then 'EU-AI-ACT' else 'SDAIA-AI-ETHICS' end
    on conflict (code) do update set
      framework_id   = excluded.framework_id,
      regime         = excluded.regime,
      risk_tier      = excluded.risk_tier,
      title          = excluded.title,
      description    = excluded.description,
      citation       = excluded.citation,
      match_keywords = excluded.match_keywords,
      required_flags = excluded.required_flags,
      obligations    = excluded.obligations,
      ordinal        = excluded.ordinal;
  end loop;
end
$seed$;
