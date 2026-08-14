-- =============================================================================
-- Seed: control crosswalks
--
-- The mapping graph. This is what turns "SAMA published a circular touching
-- identity management" into "these 14 controls in your library are affected,
-- across four frameworks you are assessed against".
--
-- ISO/IEC 27001:2022 Annex A is the pivot: most frameworks are mapped to it, and
-- two-hop traversal (see public.related_controls) reaches the rest.
--
-- confidence is deliberate, not decorative:
--   0.90-1.00  the two controls address the same requirement
--   0.70-0.89  substantially overlapping, differing in scope or depth
--   0.50-0.69  related, one partially satisfies the other
--   below 0.50 contextual only
-- =============================================================================

-- -----------------------------------------------------------------------------
-- NCA ECC  <->  ISO/IEC 27001:2022
-- -----------------------------------------------------------------------------

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('1-1',  'A.5.1',  'partial',    0.70, 'ECC requires a documented, approved cybersecurity strategy; ISO A.5.1 covers the policy set that carries it.'),
      ('1-2',  'A.5.4',  'partial',    0.75, 'Both place accountability for the security programme with management.'),
      ('1-3',  'A.5.1',  'equivalent', 0.95, 'Both require an approved, communicated and periodically reviewed policy set.'),
      ('1-3',  'A.5.37', 'partial',    0.75, 'ECC 1-3 extends to documented procedures, which ISO addresses in A.5.37.'),
      ('1-4',  'A.5.2',  'equivalent', 0.95, 'Defined and allocated information security roles and responsibilities.'),
      ('1-6',  'A.5.8',  'equivalent', 0.90, 'Security integrated into project management.'),
      ('1-7',  'A.5.31', 'equivalent', 0.90, 'Identification of and compliance with legal and regulatory requirements.'),
      ('1-7',  'A.5.36', 'partial',    0.80, 'Compliance with internal policies and standards.'),
      ('1-8',  'A.5.35', 'equivalent', 0.90, 'Independent, periodic review of information security.'),
      ('1-9',  'A.6.1',  'partial',    0.80, 'Pre-employment screening.'),
      ('1-9',  'A.6.2',  'partial',    0.80, 'Security responsibilities in employment terms.'),
      ('1-9',  'A.6.5',  'partial',    0.75, 'Obligations on termination or role change.'),
      ('1-10', 'A.6.3',  'equivalent', 0.95, 'Security awareness, education and training programme.'),
      ('2-1',  'A.5.9',  'equivalent', 0.90, 'Inventory of information and associated assets.'),
      ('2-2',  'A.5.15', 'equivalent', 0.90, 'Access control policy and rules.'),
      ('2-2',  'A.5.16', 'equivalent', 0.90, 'Identity lifecycle management.'),
      ('2-2',  'A.5.17', 'partial',    0.85, 'Management of authentication information.'),
      ('2-2',  'A.5.18', 'partial',    0.85, 'Provisioning and review of access rights.'),
      ('2-2',  'A.8.2',  'partial',    0.85, 'Restriction and monitoring of privileged access.'),
      ('2-2',  'A.8.5',  'partial',    0.85, 'Secure authentication, including multi-factor.'),
      ('2-3',  'A.8.7',  'partial',    0.80, 'Malware protection on systems and processing facilities.'),
      ('2-3',  'A.8.9',  'partial',    0.80, 'Secure configuration and hardening.'),
      ('2-3',  'A.8.19', 'partial',    0.70, 'Control over software installed on operational systems.'),
      ('2-4',  'A.5.14', 'partial',    0.65, 'Email as an information transfer channel.'),
      ('2-4',  'A.8.7',  'partial',    0.60, 'Malware filtering on inbound mail.'),
      ('2-5',  'A.8.20', 'equivalent', 0.90, 'Network security management.'),
      ('2-5',  'A.8.21', 'partial',    0.80, 'Security of network services.'),
      ('2-5',  'A.8.22', 'partial',    0.80, 'Network segregation.'),
      ('2-6',  'A.8.1',  'equivalent', 0.85, 'Security of user endpoint and mobile devices.'),
      ('2-6',  'A.7.9',  'partial',    0.70, 'Protection of assets taken off premises.'),
      ('2-7',  'A.5.12', 'equivalent', 0.90, 'Information classification.'),
      ('2-7',  'A.5.13', 'partial',    0.80, 'Labelling in line with classification.'),
      ('2-7',  'A.8.12', 'partial',    0.75, 'Prevention of data leakage.'),
      ('2-8',  'A.8.24', 'equivalent', 0.95, 'Use of cryptography and key management.'),
      ('2-9',  'A.8.13', 'equivalent', 0.95, 'Backup, and verification of restore capability.'),
      ('2-10', 'A.8.8',  'equivalent', 0.95, 'Identification and remediation of technical vulnerabilities.'),
      ('2-11', 'A.8.29', 'partial',    0.75, 'Security testing; ECC 2-11 is specifically penetration testing.'),
      ('2-12', 'A.8.15', 'equivalent', 0.90, 'Generation and protection of event logs.'),
      ('2-12', 'A.8.16', 'equivalent', 0.90, 'Monitoring of systems and networks for anomalous behaviour.'),
      ('2-13', 'A.5.24', 'equivalent', 0.90, 'Incident management planning and preparation.'),
      ('2-13', 'A.5.26', 'equivalent', 0.90, 'Response to information security incidents.'),
      ('2-13', 'A.5.7',  'partial',    0.80, 'Threat intelligence feeding incident and threat management.'),
      ('2-14', 'A.7.1',  'equivalent', 0.85, 'Physical security perimeters.'),
      ('2-14', 'A.7.2',  'partial',    0.85, 'Physical entry controls.'),
      ('2-14', 'A.7.4',  'partial',    0.75, 'Physical security monitoring.'),
      ('2-15', 'A.8.26', 'partial',    0.85, 'Application security requirements.'),
      ('2-15', 'A.8.28', 'partial',    0.75, 'Secure coding practices.'),
      ('3-1',  'A.5.29', 'equivalent', 0.90, 'Information security during disruption.'),
      ('3-1',  'A.5.30', 'equivalent', 0.90, 'ICT readiness for business continuity.'),
      ('4-1',  'A.5.19', 'equivalent', 0.90, 'Information security in supplier relationships.'),
      ('4-1',  'A.5.20', 'partial',    0.85, 'Security requirements in supplier agreements.'),
      ('4-1',  'A.5.22', 'partial',    0.80, 'Monitoring and review of supplier services.'),
      ('4-2',  'A.5.23', 'equivalent', 0.95, 'Information security for use of cloud services.')
    ) as t(ecc, iso, rel, conf, why)
  loop
    perform public.upsert_crosswalk('NCA-ECC', r.ecc, 'ISO-27001', r.iso, r.rel, r.conf, r.why);
  end loop;
end
$seed$;

-- -----------------------------------------------------------------------------
-- SAMA CSF  <->  ISO/IEC 27001:2022
-- -----------------------------------------------------------------------------

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('3.1.1',  'A.5.4',  'partial',    0.80, 'Board and executive accountability for cyber security.'),
      ('3.1.2',  'A.5.1',  'partial',    0.70, 'Strategy expressed through the approved policy set.'),
      ('3.1.3',  'A.5.1',  'equivalent', 0.95, 'Approved, communicated, periodically reviewed cyber security policy.'),
      ('3.1.4',  'A.5.2',  'equivalent', 0.95, 'Defined cyber security roles and responsibilities.'),
      ('3.1.5',  'A.5.8',  'equivalent', 0.90, 'Cyber security in project management.'),
      ('3.1.6',  'A.6.3',  'partial',    0.85, 'Awareness programme.'),
      ('3.1.7',  'A.6.3',  'partial',    0.85, 'Role-specific security training.'),
      ('3.2.2',  'A.5.31', 'equivalent', 0.90, 'Compliance with regulatory requirements, SAMA''s in particular.'),
      ('3.2.3',  'A.5.36', 'partial',    0.80, 'Compliance with adopted industry standards.'),
      ('3.2.4',  'A.5.35', 'equivalent', 0.90, 'Periodic independent review.'),
      ('3.2.5',  'A.5.35', 'partial',    0.85, 'Internal and external cyber security audits.'),
      ('3.2.5',  'A.8.34', 'partial',    0.65, 'Protecting live systems during audit testing.'),
      ('3.3.1',  'A.6.1',  'partial',    0.80, 'Personnel screening and employment security.'),
      ('3.3.2',  'A.7.1',  'equivalent', 0.85, 'Physical security of facilities.'),
      ('3.3.3',  'A.5.9',  'equivalent', 0.90, 'Asset inventory and ownership.'),
      ('3.3.4',  'A.8.27', 'equivalent', 0.85, 'Secure architecture and engineering principles.'),
      ('3.3.5',  'A.5.15', 'equivalent', 0.90, 'Access control.'),
      ('3.3.5',  'A.5.16', 'equivalent', 0.90, 'Identity management.'),
      ('3.3.5',  'A.8.2',  'partial',    0.85, 'Privileged access management.'),
      ('3.3.5',  'A.8.5',  'partial',    0.85, 'Strong authentication.'),
      ('3.3.6',  'A.8.26', 'equivalent', 0.85, 'Application security requirements.'),
      ('3.3.6',  'A.8.25', 'partial',    0.80, 'Secure development lifecycle.'),
      ('3.3.7',  'A.8.32', 'equivalent', 0.90, 'Change management.'),
      ('3.3.8',  'A.8.20', 'partial',    0.85, 'Infrastructure and network security.'),
      ('3.3.8',  'A.8.9',  'partial',    0.80, 'Secure configuration of infrastructure.'),
      ('3.3.9',  'A.8.24', 'equivalent', 0.95, 'Cryptography and key management.'),
      ('3.3.10', 'A.8.1',  'equivalent', 0.85, 'BYOD as user endpoint device security.'),
      ('3.3.11', 'A.7.14', 'equivalent', 0.90, 'Secure disposal or re-use of equipment.'),
      ('3.3.11', 'A.8.10', 'partial',    0.85, 'Deletion of information no longer required.'),
      ('3.3.13', 'A.8.26', 'partial',    0.75, 'Security requirements for electronic banking channels.'),
      ('3.3.14', 'A.8.15', 'equivalent', 0.90, 'Security event logging.'),
      ('3.3.14', 'A.8.16', 'equivalent', 0.90, 'Monitoring and alerting on security events.'),
      ('3.3.15', 'A.5.24', 'equivalent', 0.90, 'Incident management preparation.'),
      ('3.3.15', 'A.5.26', 'equivalent', 0.90, 'Incident response.'),
      ('3.3.16', 'A.5.7',  'equivalent', 0.90, 'Threat intelligence and threat management.'),
      ('3.3.17', 'A.8.8',  'equivalent', 0.95, 'Vulnerability management.'),
      ('3.4.1',  'A.5.20', 'equivalent', 0.90, 'Security requirements in vendor contracts.'),
      ('3.4.2',  'A.5.19', 'equivalent', 0.90, 'Security in supplier and outsourcing relationships.'),
      ('3.4.2',  'A.5.22', 'partial',    0.85, 'Ongoing monitoring of outsourced services.'),
      ('3.4.3',  'A.5.23', 'equivalent', 0.95, 'Use of cloud services.')
    ) as t(sama, iso, rel, conf, why)
  loop
    perform public.upsert_crosswalk('SAMA-CSF', r.sama, 'ISO-27001', r.iso, r.rel, r.conf, r.why);
  end loop;
end
$seed$;

-- -----------------------------------------------------------------------------
-- NCA ECC  <->  SAMA CSF
--
-- Saudi banks and insurers are assessed against both. These direct edges avoid a
-- lossy two-hop through ISO.
-- -----------------------------------------------------------------------------

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('1-1',  '3.1.2',  'equivalent', 0.90, 'Cybersecurity strategy.'),
      ('1-2',  '3.1.1',  'equivalent', 0.90, 'Programme management and governance.'),
      ('1-3',  '3.1.3',  'equivalent', 0.95, 'Approved cyber security policy set.'),
      ('1-4',  '3.1.4',  'equivalent', 0.95, 'Roles and responsibilities.'),
      ('1-5',  '3.2.1',  'equivalent', 0.95, 'Cyber security risk management process.'),
      ('1-6',  '3.1.5',  'equivalent', 0.90, 'Security in project management.'),
      ('1-7',  '3.2.2',  'equivalent', 0.90, 'Regulatory compliance.'),
      ('1-8',  '3.2.4',  'equivalent', 0.90, 'Periodic review.'),
      ('1-8',  '3.2.5',  'partial',    0.85, 'Audit programme.'),
      ('1-9',  '3.3.1',  'equivalent', 0.90, 'Human resources security.'),
      ('1-10', '3.1.6',  'equivalent', 0.90, 'Awareness programme.'),
      ('1-10', '3.1.7',  'partial',    0.85, 'Training programme.'),
      ('2-1',  '3.3.3',  'equivalent', 0.95, 'Asset management.'),
      ('2-2',  '3.3.5',  'equivalent', 0.95, 'Identity and access management.'),
      ('2-3',  '3.3.8',  'partial',    0.80, 'System and infrastructure protection.'),
      ('2-5',  '3.3.8',  'partial',    0.85, 'Network and infrastructure security.'),
      ('2-6',  '3.3.10', 'partial',    0.85, 'Mobile devices and BYOD.'),
      ('2-7',  '3.3.3',  'partial',    0.65, 'Data protection tied to asset classification.'),
      ('2-8',  '3.3.9',  'equivalent', 0.95, 'Cryptography.'),
      ('2-10', '3.3.17', 'equivalent', 0.95, 'Vulnerability management.'),
      ('2-11', '3.3.17', 'partial',    0.80, 'Penetration testing within vulnerability management.'),
      ('2-12', '3.3.14', 'equivalent', 0.95, 'Event logging and monitoring.'),
      ('2-13', '3.3.15', 'equivalent', 0.95, 'Incident management.'),
      ('2-13', '3.3.16', 'partial',    0.85, 'Threat management.'),
      ('2-14', '3.3.2',  'equivalent', 0.90, 'Physical security.'),
      ('2-15', '3.3.6',  'equivalent', 0.90, 'Application and web application security.'),
      ('3-1',  '3.3.15', 'partial',    0.60, 'Resilience overlaps incident recovery.'),
      ('4-1',  '3.4.1',  'equivalent', 0.90, 'Vendor and contract management.'),
      ('4-1',  '3.4.2',  'equivalent', 0.90, 'Outsourcing.'),
      ('4-2',  '3.4.3',  'equivalent', 0.95, 'Cloud computing.')
    ) as t(ecc, sama, rel, conf, why)
  loop
    perform public.upsert_crosswalk('NCA-ECC', r.ecc, 'SAMA-CSF', r.sama, r.rel, r.conf, r.why);
  end loop;
end
$seed$;

-- -----------------------------------------------------------------------------
-- ISO/IEC 27001  <->  NIST CSF 2.0
-- -----------------------------------------------------------------------------

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('A.5.1',  'GV.PO', 'equivalent', 0.90, 'Cybersecurity policy established and communicated.'),
      ('A.5.2',  'GV.RR', 'equivalent', 0.90, 'Roles, responsibilities and authorities.'),
      ('A.5.4',  'GV.OV', 'partial',    0.80, 'Management oversight of the programme.'),
      ('A.5.31', 'GV.OC', 'partial',    0.80, 'Legal and regulatory requirements as organizational context.'),
      ('A.5.35', 'GV.OV', 'partial',    0.80, 'Independent review supporting oversight.'),
      ('A.5.7',  'ID.RA', 'partial',    0.80, 'Threat intelligence informing risk assessment.'),
      ('A.5.9',  'ID.AM', 'equivalent', 0.90, 'Asset inventory.'),
      ('A.5.12', 'ID.AM', 'partial',    0.75, 'Classification as part of asset management.'),
      ('A.8.8',  'ID.RA', 'equivalent', 0.85, 'Vulnerability identification and prioritisation.'),
      ('A.5.27', 'ID.IM', 'equivalent', 0.85, 'Learning from incidents drives improvement.'),
      ('A.5.15', 'PR.AA', 'equivalent', 0.90, 'Access control.'),
      ('A.5.16', 'PR.AA', 'equivalent', 0.90, 'Identity management.'),
      ('A.5.17', 'PR.AA', 'partial',    0.85, 'Authentication information management.'),
      ('A.5.18', 'PR.AA', 'partial',    0.85, 'Access rights lifecycle.'),
      ('A.8.2',  'PR.AA', 'partial',    0.85, 'Privileged access rights.'),
      ('A.8.5',  'PR.AA', 'partial',    0.85, 'Secure authentication.'),
      ('A.6.3',  'PR.AT', 'equivalent', 0.95, 'Awareness and training.'),
      ('A.8.24', 'PR.DS', 'partial',    0.85, 'Cryptographic protection of data.'),
      ('A.8.13', 'PR.DS', 'partial',    0.85, 'Backups protecting data availability.'),
      ('A.8.12', 'PR.DS', 'partial',    0.80, 'Data leakage prevention.'),
      ('A.8.10', 'PR.DS', 'partial',    0.75, 'Secure deletion.'),
      ('A.8.9',  'PR.PS', 'equivalent', 0.85, 'Configuration management and hardening.'),
      ('A.8.7',  'PR.PS', 'partial',    0.80, 'Malware protection on platforms.'),
      ('A.8.19', 'PR.PS', 'partial',    0.75, 'Control of installed software.'),
      ('A.8.32', 'PR.PS', 'partial',    0.75, 'Change management of platforms.'),
      ('A.8.20', 'PR.IR', 'equivalent', 0.85, 'Network security.'),
      ('A.8.22', 'PR.IR', 'partial',    0.80, 'Network segregation.'),
      ('A.8.14', 'PR.IR', 'partial',    0.80, 'Redundancy of processing facilities.'),
      ('A.8.15', 'DE.CM', 'equivalent', 0.90, 'Logging feeding continuous monitoring.'),
      ('A.8.16', 'DE.CM', 'equivalent', 0.90, 'Monitoring activities.'),
      ('A.7.4',  'DE.CM', 'partial',    0.70, 'Physical security monitoring.'),
      ('A.5.25', 'DE.AE', 'equivalent', 0.85, 'Assessment and decision on security events.'),
      ('A.6.8',  'DE.AE', 'partial',    0.70, 'User event reporting as a detection source.'),
      ('A.5.24', 'RS.MA', 'equivalent', 0.90, 'Incident management planning.'),
      ('A.5.26', 'RS.MA', 'equivalent', 0.90, 'Incident response execution.'),
      ('A.5.28', 'RS.AN', 'equivalent', 0.85, 'Evidence collection and incident analysis.'),
      ('A.5.5',  'RS.CO', 'partial',    0.80, 'Contact with authorities during response.'),
      ('A.5.29', 'RC.RP', 'equivalent', 0.85, 'Continuity of information security during disruption.'),
      ('A.5.30', 'RC.RP', 'equivalent', 0.90, 'ICT readiness for business continuity.'),
      ('A.5.19', 'GV.SC', 'equivalent', 0.90, 'Supplier relationship security.'),
      ('A.5.20', 'GV.SC', 'partial',    0.85, 'Security in supplier agreements.'),
      ('A.5.21', 'GV.SC', 'equivalent', 0.90, 'ICT supply chain security.'),
      ('A.5.22', 'GV.SC', 'partial',    0.85, 'Supplier service monitoring.')
    ) as t(iso, nist, rel, conf, why)
  loop
    perform public.upsert_crosswalk('ISO-27001', r.iso, 'NIST-CSF', r.nist, r.rel, r.conf, r.why);
  end loop;

  -- Risk management lives in ISO 27001 clause 6, not Annex A, so the ECC and SAMA
  -- risk subdomains map to NIST rather than to an Annex A control.
  perform public.upsert_crosswalk('NCA-ECC', '1-5', 'NIST-CSF', 'GV.RM', 'equivalent', 0.90,
    'Cybersecurity risk management strategy. ISO 27001 addresses this in clause 6.1 rather than Annex A.');
  perform public.upsert_crosswalk('SAMA-CSF', '3.2.1', 'NIST-CSF', 'GV.RM', 'equivalent', 0.90,
    'Cyber security risk management. ISO 27001 addresses this in clause 6.1 rather than Annex A.');
end
$seed$;

-- -----------------------------------------------------------------------------
-- PCI DSS  <->  ISO/IEC 27001
-- -----------------------------------------------------------------------------

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('R1',  'A.8.20', 'partial',    0.80, 'Network security controls.'),
      ('R1',  'A.8.22', 'partial',    0.80, 'Segmentation of the cardholder data environment.'),
      ('R2',  'A.8.9',  'equivalent', 0.85, 'Secure configuration of system components.'),
      ('R3',  'A.8.24', 'partial',    0.80, 'Cryptographic protection of stored account data.'),
      ('R3',  'A.5.12', 'partial',    0.65, 'Account data as a classified information type.'),
      ('R4',  'A.8.24', 'partial',    0.85, 'Strong cryptography in transit.'),
      ('R5',  'A.8.7',  'equivalent', 0.90, 'Protection against malicious software.'),
      ('R6',  'A.8.25', 'partial',    0.85, 'Secure development lifecycle.'),
      ('R6',  'A.8.8',  'partial',    0.80, 'Patching of known vulnerabilities.'),
      ('R7',  'A.8.3',  'equivalent', 0.85, 'Need-to-know access restriction.'),
      ('R8',  'A.8.5',  'equivalent', 0.85, 'User identification and authentication.'),
      ('R8',  'A.5.16', 'partial',    0.80, 'Identity management.'),
      ('R9',  'A.7.2',  'equivalent', 0.85, 'Physical access restriction.'),
      ('R10', 'A.8.15', 'equivalent', 0.90, 'Logging of access to systems and account data.'),
      ('R10', 'A.8.17', 'partial',    0.75, 'Clock synchronisation for log correlation.'),
      ('R11', 'A.8.8',  'partial',    0.85, 'Vulnerability scanning.'),
      ('R11', 'A.8.29', 'partial',    0.80, 'Penetration testing.'),
      ('R12', 'A.5.1',  'equivalent', 0.85, 'Information security policy and programme.'),
      ('R12', 'A.6.3',  'partial',    0.75, 'Security awareness programme.')
    ) as t(pci, iso, rel, conf, why)
  loop
    perform public.upsert_crosswalk('PCI-DSS', r.pci, 'ISO-27001', r.iso, r.rel, r.conf, r.why);
  end loop;

  perform public.upsert_crosswalk('SAMA-CSF', '3.3.12', 'PCI-DSS', 'R3', 'partial', 0.80,
    'SAMA payment system requirements overlap the PCI DSS account data protection requirement.');
end
$seed$;

-- -----------------------------------------------------------------------------
-- GDPR  <->  Saudi PDPL, and GDPR/PDPL  <->  the other GCC privacy regimes
-- -----------------------------------------------------------------------------

do $seed$
declare
  r  record;
  fw text;
begin
  for r in
    select * from (values
      ('ART-5',  'PDPL-MINIMISE',  'partial',    0.85, 'Purpose limitation, minimisation and accuracy principles.'),
      ('ART-6',  'PDPL-LAWFUL',    'equivalent', 0.85, 'Lawful basis for processing. The PDPL basis set is narrower than Article 6.'),
      ('ART-7',  'PDPL-CONSENT',   'equivalent', 0.85, 'Conditions for valid, withdrawable consent.'),
      ('ART-12', 'PDPL-NOTICE',    'equivalent', 0.85, 'Transparent information to the data subject.'),
      ('ART-15', 'PDPL-ACCESS',    'equivalent', 0.90, 'Right of access and to obtain a copy.'),
      ('ART-17', 'PDPL-DESTROY',   'equivalent', 0.85, 'Right to erasure / destruction.'),
      ('ART-28', 'PDPL-PROCESSOR', 'equivalent', 0.85, 'Controller obligations when engaging a processor.'),
      ('ART-30', 'PDPL-ROPA',      'equivalent', 0.90, 'Records of processing activities.'),
      ('ART-32', 'PDPL-SECURITY',  'equivalent', 0.90, 'Appropriate technical and organisational security measures.'),
      ('ART-33', 'PDPL-BREACH',    'equivalent', 0.85, 'Breach notification to the supervisory authority. Deadlines differ.'),
      ('ART-35', 'PDPL-DPIA',      'equivalent', 0.85, 'Impact assessment for higher-risk processing.'),
      ('ART-37', 'PDPL-DPO',       'equivalent', 0.85, 'Designation of a data protection officer.'),
      ('ART-44', 'PDPL-TRANSFER',  'partial',    0.80, 'Restrictions on transfers outside the jurisdiction; PDPL conditions are stricter.')
    ) as t(gdpr, pdpl, rel, conf, why)
  loop
    perform public.upsert_crosswalk('EU-GDPR', r.gdpr, 'SA-PDPL', r.pdpl, r.rel, r.conf, r.why);
  end loop;

  -- The remaining GCC privacy laws share a common obligation spine.
  foreach fw in array array[
    'QA-PDPPL', 'AE-PDPL', 'AE-DIFC-DPL', 'AE-ADGM-DPR',
    'JO-PDPL', 'BH-PDPL', 'OM-PDPL', 'KW-CITRA-DPPR'
  ]
  loop
    for r in
      select * from (values
        ('ART-6',  'LAWFUL',    'PDPL-LAWFUL',    0.80, 'Lawful basis and consent for processing.'),
        ('ART-12', 'NOTICE',     'PDPL-NOTICE',    0.80, 'Transparency and privacy notice obligations.'),
        ('ART-15', 'RIGHTS',     'PDPL-ACCESS',    0.75, 'Data subject rights handling.'),
        ('ART-32', 'SECURITY',   'PDPL-SECURITY',  0.85, 'Security of personal data.'),
        ('ART-33', 'BREACH',     'PDPL-BREACH',    0.80, 'Breach notification. Deadlines and thresholds vary by jurisdiction.'),
        ('ART-30', 'ROPA',       'PDPL-ROPA',      0.80, 'Records of processing and accountability.'),
        ('ART-28', 'PROCESSOR',  'PDPL-PROCESSOR', 0.80, 'Processor engagement and oversight.'),
        ('ART-44', 'TRANSFER',   'PDPL-TRANSFER',  0.75, 'Cross-border transfer conditions.')
      ) as t(gdpr, spine, pdpl, conf, why)
    loop
      perform public.upsert_crosswalk('EU-GDPR', r.gdpr, fw, r.spine, 'partial', r.conf, r.why);
      perform public.upsert_crosswalk('SA-PDPL', r.pdpl, fw, r.spine, 'partial', r.conf,
        r.why || ' Both derive from the same GCC drafting lineage.');
    end loop;
  end loop;

  -- Privacy security obligations lean on the ISO security controls for evidence.
  perform public.upsert_crosswalk('EU-GDPR', 'ART-32', 'ISO-27001', 'A.8.24', 'partial', 0.80,
    'Encryption named in Article 32(1)(a) as an example of an appropriate measure.');
  perform public.upsert_crosswalk('EU-GDPR', 'ART-32', 'ISO-27001', 'A.5.34', 'equivalent', 0.85,
    'Privacy and protection of PII.');
  perform public.upsert_crosswalk('EU-GDPR', 'ART-33', 'ISO-27001', 'A.5.26', 'partial', 0.80,
    'Breach notification depends on the incident response process.');
  perform public.upsert_crosswalk('EU-GDPR', 'ART-25', 'ISO-27001', 'A.8.25', 'partial', 0.75,
    'Data protection by design realised through the secure development lifecycle.');
  perform public.upsert_crosswalk('EU-GDPR', 'ART-24', 'ISO-27701', 'A-1', 'equivalent', 0.85,
    'ISO 27701 Annex A operationalises controller accountability.');
  perform public.upsert_crosswalk('EU-GDPR', 'ART-28', 'ISO-27701', 'B-1', 'equivalent', 0.85,
    'ISO 27701 Annex B operationalises processor obligations.');
  perform public.upsert_crosswalk('SA-PDPL', 'PDPL-SECURITY', 'NCA-DCC', 'DL-1', 'partial', 0.80,
    'The NCA Data Cybersecurity Controls are the control set most often cited as PDPL security evidence in Saudi Arabia.');
end
$seed$;

-- -----------------------------------------------------------------------------
-- AI governance: EU AI Act, SDAIA, ISO 42001, NIST AI RMF, DIFC
-- -----------------------------------------------------------------------------

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('EU-AI-ACT', 'ART-9',  'ISO-42001',    'A.5',     'equivalent', 0.85, 'AI risk management and impact assessment.'),
      ('EU-AI-ACT', 'ART-9',  'NIST-AI-RMF',  'MANAGE',  'equivalent', 0.85, 'Continuous risk management across the lifecycle.'),
      ('EU-AI-ACT', 'ART-9',  'NIST-AI-RMF',  'MAP',     'partial',    0.80, 'Risk identification precedes management.'),
      ('EU-AI-ACT', 'ART-10', 'ISO-42001',    'A.7',     'equivalent', 0.85, 'Data governance for AI systems.'),
      ('EU-AI-ACT', 'ART-10', 'SDAIA-AI-ETHICS', 'P1',   'partial',    0.80, 'Examination of data sets for bias.'),
      ('EU-AI-ACT', 'ART-11', 'ISO-42001',    'A.6',     'partial',    0.80, 'Lifecycle documentation.'),
      ('EU-AI-ACT', 'ART-12', 'ISO-27001',    'A.8.15',  'partial',    0.75, 'Automatic event recording relies on the logging control.'),
      ('EU-AI-ACT', 'ART-13', 'SDAIA-AI-ETHICS', 'P6',   'equivalent', 0.85, 'Transparency and explainability.'),
      ('EU-AI-ACT', 'ART-13', 'ISO-42001',    'A.8',     'equivalent', 0.85, 'Information for interested parties.'),
      ('EU-AI-ACT', 'ART-14', 'SDAIA-AI-ETHICS', 'P3',   'equivalent', 0.85, 'Human oversight and human agency.'),
      ('EU-AI-ACT', 'ART-14', 'ISO-42001',    'A.9',     'equivalent', 0.85, 'Controlled use of AI systems.'),
      ('EU-AI-ACT', 'ART-15', 'SDAIA-AI-ETHICS', 'P5',   'equivalent', 0.85, 'Reliability, robustness and safety.'),
      ('EU-AI-ACT', 'ART-15', 'ISO-27001',    'A.8.8',   'partial',    0.70, 'Cybersecurity of the AI system.'),
      ('EU-AI-ACT', 'ART-17', 'ISO-42001',    'A.2',     'equivalent', 0.85, 'AI policy as part of the management system.'),
      ('EU-AI-ACT', 'ART-17', 'ISO-42001',    'A.3',     'partial',    0.80, 'Internal organisation and accountability.'),
      ('EU-AI-ACT', 'ART-26', 'ISO-42001',    'A.9',     'equivalent', 0.85, 'Deployer obligations map to controlled use.'),
      ('EU-AI-ACT', 'ART-27', 'EU-GDPR',      'ART-35',  'partial',    0.80, 'The fundamental rights impact assessment overlaps a DPIA and can be combined with it.'),
      ('EU-AI-ACT', 'ART-50', 'SDAIA-GENAI',  'GEN-4',   'equivalent', 0.85, 'Disclosure of AI-generated content and deepfake labelling.'),
      ('EU-AI-ACT', 'ART-50', 'SDAIA-AI-ETHICS', 'P6',   'partial',    0.80, 'Transparency toward affected persons.'),
      ('EU-AI-ACT', 'ART-72', 'ISO-42001',    'A.6',     'partial',    0.75, 'Post-market monitoring within lifecycle management.'),
      ('EU-AI-ACT', 'ART-73', 'ISO-27001',    'A.5.26',  'partial',    0.75, 'Serious incident reporting depends on incident response.'),
      ('EU-AI-ACT', 'ART-4',  'ISO-27001',    'A.6.3',   'partial',    0.70, 'AI literacy delivered through the awareness and training programme.'),
      ('SDAIA-AI-ETHICS', 'P2', 'SA-PDPL',    'PDPL-SECURITY', 'partial', 0.80, 'Privacy and security of personal data used by AI systems.'),
      ('SDAIA-AI-ETHICS', 'P7', 'ISO-42001',  'A.3',     'equivalent', 0.85, 'Accountability and assigned responsibility.'),
      ('SDAIA-AI-ETHICS', 'P4', 'ISO-42001',  'A.5',     'partial',    0.70, 'Societal and environmental impact assessment.'),
      ('NIST-AI-RMF', 'GOVERN',  'ISO-42001', 'A.2',     'equivalent', 0.85, 'AI governance and policy.'),
      ('NIST-AI-RMF', 'MAP',     'ISO-42001', 'A.5',     'partial',    0.80, 'Context and impact identification.'),
      ('NIST-AI-RMF', 'MEASURE', 'ISO-42001', 'A.6',     'partial',    0.75, 'Measurement within lifecycle management.'),
      ('AE-DIFC-DPL', 'AUTO-10', 'EU-AI-ACT', 'ART-13',  'partial',    0.75, 'Both require transparency about automated decision systems.'),
      ('AE-DIFC-DPL', 'AUTO-10', 'EU-GDPR',   'ART-22',  'partial',    0.80, 'Both constrain solely automated decision-making affecting individuals.'),
      ('EU-GDPR', 'ART-22', 'EU-AI-ACT',      'ART-14',  'partial',    0.75, 'Human intervention in automated decisions.'),
      ('EU-GDPR', 'ART-22', 'SDAIA-AI-ETHICS','P3',      'partial',    0.75, 'Human agency over consequential decisions.')
    ) as t(sf, sc, tf, tc, rel, conf, why)
  loop
    perform public.upsert_crosswalk(r.sf, r.sc, r.tf, r.tc, r.rel, r.conf, r.why);
  end loop;
end
$seed$;

-- -----------------------------------------------------------------------------
-- EU NIS2 and DORA  <->  ISO/IEC 27001 and NCA ECC
-- -----------------------------------------------------------------------------

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('EU-NIS2', '21-2-A',  'ISO-27001', 'A.5.1',   'partial',    0.80, 'Risk analysis and information system security policies.'),
      ('EU-NIS2', '21-2-B',  'ISO-27001', 'A.5.24',  'equivalent', 0.85, 'Incident handling.'),
      ('EU-NIS2', '21-2-C',  'ISO-27001', 'A.8.13',  'partial',    0.85, 'Backup management.'),
      ('EU-NIS2', '21-2-C',  'ISO-27001', 'A.5.30',  'partial',    0.85, 'Disaster recovery and crisis management.'),
      ('EU-NIS2', '21-2-D',  'ISO-27001', 'A.5.21',  'equivalent', 0.85, 'Supply chain security.'),
      ('EU-NIS2', '21-2-E',  'ISO-27001', 'A.8.25',  'equivalent', 0.85, 'Security in acquisition and development.'),
      ('EU-NIS2', '21-2-F',  'ISO-27001', 'A.5.35',  'equivalent', 0.85, 'Assessing effectiveness of risk-management measures.'),
      ('EU-NIS2', '21-2-G',  'ISO-27001', 'A.6.3',   'equivalent', 0.90, 'Cyber hygiene and training.'),
      ('EU-NIS2', '21-2-H',  'ISO-27001', 'A.8.24',  'equivalent', 0.90, 'Cryptography and encryption policy.'),
      ('EU-NIS2', '21-2-I',  'ISO-27001', 'A.6.1',   'partial',    0.80, 'Human resources security.'),
      ('EU-NIS2', '21-2-I',  'ISO-27001', 'A.5.15',  'partial',    0.80, 'Access control.'),
      ('EU-NIS2', '21-2-J',  'ISO-27001', 'A.8.5',   'equivalent', 0.85, 'Multi-factor authentication.'),
      ('EU-NIS2', '23-EARLY','ISO-27001', 'A.5.5',   'partial',    0.75, 'Contact with authorities during an incident.'),
      ('EU-DORA', 'P2',      'ISO-27001', 'A.5.24',  'partial',    0.80, 'ICT incident management and classification.'),
      ('EU-DORA', 'P3',      'ISO-27001', 'A.8.29',  'partial',    0.80, 'Resilience testing, including threat-led penetration testing.'),
      ('EU-DORA', 'P4',      'ISO-27001', 'A.5.19',  'partial',    0.85, 'ICT third-party risk management.'),
      ('EU-DORA', 'P4',      'NCA-ECC',   '4-1',     'partial',    0.80, 'Third-party cybersecurity obligations align.'),
      ('EU-DORA', 'P5',      'ISO-27001', 'A.5.6',   'partial',    0.75, 'Information sharing through special interest groups.'),
      ('EU-DORA', 'P1',      'NIST-CSF',  'GV.RM',   'partial',    0.80, 'ICT risk management framework.')
    ) as t(sf, sc, tf, tc, rel, conf, why)
  loop
    perform public.upsert_crosswalk(r.sf, r.sc, r.tf, r.tc, r.rel, r.conf, r.why);
  end loop;
end
$seed$;

-- -----------------------------------------------------------------------------
-- GCC national and financial regulator anchors  <->  ISO/IEC 27001
--
-- These let a single control assessment answer a UAE, Qatari, Jordanian,
-- Bahraini and Kuwaiti requirement at once — the core case for a regional
-- consultancy running several engagements from one library.
-- -----------------------------------------------------------------------------

do $seed$
declare
  r record;
begin
  for r in
    select * from (values
      ('AE-IA',        'M1',      'ISO-27001', 'A.5.1',  'partial',    0.80, 'Security strategy and policy.'),
      ('AE-IA',        'M3',      'ISO-27001', 'A.6.3',  'equivalent', 0.90, 'Awareness and training.'),
      ('AE-IA',        'M4',      'ISO-27001', 'A.6.1',  'partial',    0.85, 'Human resources security.'),
      ('AE-IA',        'M5',      'ISO-27001', 'A.5.24', 'equivalent', 0.85, 'Incident management.'),
      ('AE-IA',        'M6',      'ISO-27001', 'A.5.29', 'equivalent', 0.85, 'Business continuity.'),
      ('AE-IA',        'M7',      'ISO-27001', 'A.5.19', 'equivalent', 0.85, 'Third-party security.'),
      ('AE-IA',        'M8',      'ISO-27001', 'A.5.35', 'equivalent', 0.85, 'Compliance and audit.'),
      ('AE-IA',        'T1',      'ISO-27001', 'A.5.9',  'equivalent', 0.90, 'Asset management.'),
      ('AE-IA',        'T2',      'ISO-27001', 'A.7.1',  'equivalent', 0.85, 'Physical and environmental security.'),
      ('AE-IA',        'T3',      'ISO-27001', 'A.5.15', 'equivalent', 0.90, 'Access control.'),
      ('AE-IA',        'T4',      'ISO-27001', 'A.8.24', 'equivalent', 0.90, 'Cryptography.'),
      ('AE-IA',        'T5',      'ISO-27001', 'A.8.9',  'partial',    0.80, 'Operations and configuration management.'),
      ('AE-IA',        'T6',      'ISO-27001', 'A.8.20', 'equivalent', 0.85, 'Communications security.'),
      ('AE-IA',        'T7',      'ISO-27001', 'A.8.25', 'equivalent', 0.85, 'System acquisition and development.'),
      ('AE-IA',        'M2',      'NIST-CSF',  'GV.RM',  'equivalent', 0.85, 'Risk management.'),
      ('QA-NIA',       'GOV-1',   'ISO-27001', 'A.5.1',  'partial',    0.80, 'Governance through the policy set.'),
      ('QA-NIA',       'CLASS-1', 'ISO-27001', 'A.5.12', 'equivalent', 0.90, 'Data classification and labelling.'),
      ('QA-NIA',       'CTRL-1',  'ISO-27001', 'A.5.15', 'partial',    0.70, 'Baseline access controls.'),
      ('QA-NIA',       'BCM-1',   'ISO-27001', 'A.5.29', 'equivalent', 0.85, 'Business continuity.'),
      ('QA-NIA',       'CERT-1',  'ISO-27001', 'A.5.35', 'equivalent', 0.85, 'Certification and independent review.'),
      ('QA-NIA',       'RISK-1',  'NIST-CSF',  'GV.RM',  'equivalent', 0.85, 'Risk management process.'),
      ('CBUAE-ISS',    'GOV-1',   'ISO-27001', 'A.5.4',  'partial',    0.80, 'Board and senior management responsibility.'),
      ('CBUAE-ISS',    'SEC-1',   'ISO-27001', 'A.5.1',  'partial',    0.75, 'Information security control framework.'),
      ('CBUAE-ISS',    'RES-1',   'ISO-27001', 'A.5.29', 'partial',    0.80, 'Operational resilience.'),
      ('CBUAE-ISS',    'OUT-1',   'ISO-27001', 'A.5.19', 'partial',    0.85, 'Outsourcing and third-party risk.'),
      ('CBUAE-ISS',    'INC-1',   'ISO-27001', 'A.5.5',  'partial',    0.80, 'Notification to the regulator.'),
      ('CBUAE-ISS',    'SEC-1',   'SAMA-CSF',  '3.1.3',  'partial',    0.75, 'Comparable policy expectations across two GCC central banks.'),
      ('CBUAE-ISS',    'OUT-1',   'SAMA-CSF',  '3.4.2',  'partial',    0.80, 'Comparable outsourcing expectations.'),
      ('QCB-TRC',      'GOV-1',   'ISO-27001', 'A.5.4',  'partial',    0.80, 'Technology governance oversight.'),
      ('QCB-TRC',      'SEC-1',   'ISO-27001', 'A.5.1',  'partial',    0.75, 'Information security requirements.'),
      ('QCB-TRC',      'OUT-1',   'ISO-27001', 'A.5.23', 'partial',    0.80, 'Cloud adoption approval and control.'),
      ('QCB-TRC',      'INC-1',   'ISO-27001', 'A.5.26', 'partial',    0.80, 'Incident management and reporting.'),
      ('QCB-TRC',      'SEC-1',   'SAMA-CSF',  '3.1.3',  'partial',    0.75, 'Comparable central bank security expectations.'),
      ('CBJ-CSF',      'GOV-1',   'ISO-27001', 'A.5.4',  'partial',    0.80, 'Board accountability.'),
      ('CBJ-CSF',      'SEC-1',   'ISO-27001', 'A.5.15', 'partial',    0.75, 'Information security controls.'),
      ('CBJ-CSF',      'RES-1',   'ISO-27001', 'A.5.29', 'partial',    0.80, 'Cyber resilience and continuity.'),
      ('CBJ-CSF',      'INC-1',   'ISO-27001', 'A.5.5',  'partial',    0.80, 'Reporting to the central bank.'),
      ('CBJ-CSF',      'SEC-1',   'SAMA-CSF',  '3.1.3',  'partial',    0.70, 'Comparable central bank security expectations.'),
      ('CBB-OM5',      'OM-1',    'NIST-CSF',  'GV.RM',  'partial',    0.80, 'Operational risk management framework.'),
      ('CBB-OM5',      'CYB-1',   'ISO-27001', 'A.5.1',  'partial',    0.75, 'Cyber security control requirements.'),
      ('CBB-OM5',      'OUT-1',   'ISO-27001', 'A.5.19', 'partial',    0.85, 'Outsourcing arrangements.'),
      ('JO-NCSF',      'GOV-1',   'ISO-27001', 'A.5.31', 'partial',    0.75, 'National and sector legal obligations.'),
      ('JO-NCSF',      'CTRL-1',  'ISO-27001', 'A.5.15', 'partial',    0.70, 'Baseline controls.'),
      ('JO-NCSF',      'INC-1',   'ISO-27001', 'A.5.5',  'partial',    0.80, 'Reporting to the national CERT.'),
      ('KW-CITRA-CSF', 'GOV-1',   'ISO-27001', 'A.5.1',  'partial',    0.80, 'Cybersecurity governance and policy.'),
      ('KW-CITRA-CSF', 'CTRL-1',  'ISO-27001', 'A.5.15', 'partial',    0.70, 'Security control implementation.'),
      ('KW-CITRA-CSF', 'CLOUD-1', 'ISO-27001', 'A.5.23', 'partial',    0.80, 'Cloud services and classification.'),
      ('AE-DESC-DCS',  'GOV-1',   'ISO-27001', 'A.5.1',  'partial',    0.80, 'Governance and policy.'),
      ('AE-DESC-DCS',  'CTRL-1',  'ISO-27001', 'A.5.15', 'partial',    0.70, 'Control implementation by impact tier.'),
      ('SAMA-BCM',     'GOV-1',   'ISO-22301', 'C6-1',   'partial',    0.85, 'BCM governance and planning.'),
      ('SAMA-BCM',     'BIA-1',   'ISO-22301', 'C6-1',   'equivalent', 0.90, 'Business impact analysis.'),
      ('SAMA-BCM',     'TEST-1',  'ISO-22301', 'C9-1',   'equivalent', 0.90, 'Exercising and testing.'),
      ('ISO-22301',    'C6-1',    'ISO-27001', 'A.5.29', 'partial',    0.80, 'Continuity requirements determination.'),
      ('ISO-22301',    'C8-1',    'ISO-27001', 'A.5.30', 'equivalent', 0.85, 'Continuity plans and ICT readiness.'),
      ('ISO-22301',    'C9-1',    'ISO-27001', 'A.5.35', 'partial',    0.75, 'Performance evaluation and review.'),
      ('NCA-CCC',      'CST-1',   'ISO-27001', 'A.5.23', 'equivalent', 0.90, 'Cloud tenant security obligations.'),
      ('NCA-CCC',      'CST-1',   'NCA-ECC',   '4-2',    'subset',     0.90, 'The CCC expands ECC 4-2 for cloud specifically.'),
      ('NCA-DCC',      'DL-1',    'ISO-27001', 'A.5.12', 'partial',    0.80, 'Data classification across the lifecycle.'),
      ('NCA-DCC',      'DL-1',    'NCA-ECC',   '2-7',    'subset',     0.90, 'The DCC expands ECC 2-7 across the data lifecycle.'),
      ('NCA-CSCC',     'CS-1',    'NCA-ECC',   '1-3',    'subset',     0.85, 'The CSCC layers additional controls onto the ECC for critical systems.'),
      ('NCA-OTCC',     'OT-1',    'NCA-ECC',   '5-1',    'subset',     0.90, 'The OTCC expands ECC 5-1 for operational technology.'),
      ('NCA-OTCC',     'OT-1',    'ISO-27001', 'A.8.22', 'partial',    0.70, 'IT/OT network segregation.'),
      ('NCA-TCC',      'TW-1',    'ISO-27001', 'A.6.7',  'equivalent', 0.90, 'Remote working security.'),
      ('NCA-TCC',      'TW-1',    'NCA-ECC',   '2-6',    'partial',    0.80, 'Remote access from mobile and personal devices.'),
      ('SAMA-ITGF',    'GOV-1',   'ISO-27001', 'A.5.2',  'partial',    0.70, 'IT governance roles and accountability.'),
      ('SAMA-ITGF',    'SVC-1',   'ISO-27001', 'A.8.32', 'partial',    0.75, 'Change and service management.'),
      ('SOC2',         'CC',      'ISO-27001', 'A.5.1',  'partial',    0.75, 'The Common Criteria broadly track the ISMS control set.'),
      ('SOC2',         'A',       'ISO-27001', 'A.8.14', 'partial',    0.80, 'Availability through redundancy.'),
      ('SOC2',         'C',       'ISO-27001', 'A.8.24', 'partial',    0.80, 'Confidentiality through cryptography.'),
      ('SOC2',         'P',       'ISO-27701', 'A-1',    'partial',    0.80, 'Privacy criteria map to the PIMS controller controls.'),
      ('SOC2',         'PI',      'ISO-27001', 'A.8.32', 'partial',    0.70, 'Processing integrity through change control.')
    ) as t(sf, sc, tf, tc, rel, conf, why)
  loop
    perform public.upsert_crosswalk(r.sf, r.sc, r.tf, r.tc, r.rel, r.conf, r.why);
  end loop;
end
$seed$;
