-- =============================================================================
-- AETHER Internal Audit — additive follow-up to 20260904100000_internal_audit.sql
--
--   1. Seeds eight global standard work programs (audit_program_templates and
--      audit_program_template_steps). Reference data, readable by every
--      authenticated user, written by migrations only.
--   2. Adds public.audit_action_register — the follow-up register with ageing
--      and overdue flags used by the Actions page and the dashboard.
--
-- Work-program steps are written to Big Four fieldwork standard: each step
-- states the objective, the test approach, the sample basis and the evidence to
-- retain in the workpaper. Frameworks referenced use the library codes in
-- public.frameworks (NCA-ECC, SAMA-CSF, ISO-27001, NIST-CSF, KSA-PDPL).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- audit_action_register — management actions with ageing, joined to the
-- observation and engagement that raised them.
-- -----------------------------------------------------------------------------

create or replace view public.audit_action_register
with (security_invoker = true) as
select
  a.id,
  a.organization_id,
  a.observation_id,
  a.description,
  a.owner_id,
  a.due_date,
  a.revised_due_date,
  a.extension_count,
  a.status,
  a.implemented_at,
  a.verified_by,
  a.verified_at,
  a.verification_notes,
  a.evidence_id,
  a.created_at,
  a.updated_at,
  coalesce(a.revised_due_date, a.due_date)                       as effective_due_date,
  case
    when coalesce(a.revised_due_date, a.due_date) is null then null
    else (current_date - coalesce(a.revised_due_date, a.due_date))
  end                                                            as days_past_due,
  (
    a.status in ('open', 'in_progress', 'overdue')
    and coalesce(a.revised_due_date, a.due_date) is not null
    and coalesce(a.revised_due_date, a.due_date) < current_date
  )                                                              as is_overdue,
  (current_date - a.created_at::date)                            as age_days,
  o.ref                                                          as observation_ref,
  o.title                                                        as observation_title,
  o.rating                                                       as observation_rating,
  o.status                                                       as observation_status,
  o.repeat_finding                                               as observation_repeat,
  e.id                                                           as engagement_id,
  e.code                                                         as engagement_code,
  e.title                                                        as engagement_title,
  e.status                                                       as engagement_status
from public.audit_actions a
join public.audit_observations o on o.id = a.observation_id
join public.audit_engagements  e on e.id = o.engagement_id;

grant select on public.audit_action_register to authenticated;

comment on view public.audit_action_register is
  'Management action follow-up register with ageing and overdue flags (IIA Standard 15.2).';

-- -----------------------------------------------------------------------------
-- Templates
-- -----------------------------------------------------------------------------

insert into public.audit_program_templates (code, name, area, description, frameworks, sort_order)
values
  ('P2P', 'Procure-to-Pay', 'Finance',
   'End-to-end review of purchase requisitioning, vendor master maintenance, purchase ordering, goods receipt, three-way match, invoice processing and payment release, including segregation of duties and fraud indicators.',
   '{}', 10),
  ('O2C', 'Revenue / Order-to-Cash', 'Finance',
   'Review of customer master data, credit approval, order entry, delivery and revenue recognition, billing accuracy, cash application, credit notes and receivables provisioning under IFRS 15 and IFRS 9.',
   '{}', 20),
  ('PAY', 'Payroll', 'Finance',
   'Review of joiner-mover-leaver processing, payroll master data, time and attendance, payroll calculation, GOSI and end-of-service benefit accruals, payroll disbursement and reconciliation, and Saudization / WPS compliance.',
   '{}', 30),
  ('TRE', 'Treasury and Cash Management', 'Finance',
   'Review of treasury policy and delegated authority, bank mandates and signatories, cash forecasting, investment and borrowing execution, FX and hedging, payment release controls and bank reconciliations.',
   '{}', 40),
  ('ITGC', 'IT General Controls', 'Technology',
   'Review of access to programs and data, program change management, program development and computer operations across in-scope financially relevant applications, databases and operating systems.',
   '{ISO-27001,NCA-ECC,SAMA-CSF}', 50),
  ('INFOSEC', 'Information Security', 'Technology',
   'Review of the information security management system: governance, asset and data classification, vulnerability and patch management, endpoint and network security, logging and monitoring, incident response and personal-data protection.',
   '{ISO-27001,NCA-ECC,SAMA-CSF,NIST-CSF,KSA-PDPL}', 60),
  ('TPRM', 'Third-Party and Vendor Management', 'Operations',
   'Review of third-party lifecycle governance: risk tiering, due diligence and onboarding, contracting and SLAs, ongoing performance and risk monitoring, fourth-party and concentration risk, and exit and termination.',
   '{ISO-27001,SAMA-CSF}', 70),
  ('BCM', 'Business Continuity and Disaster Recovery', 'Operations',
   'Review of the business continuity management system: business impact analysis, recovery objectives, continuity and disaster-recovery plans, backup and restoration, crisis communication, exercising and post-exercise improvement.',
   '{ISO-27001,NCA-ECC,SAMA-CSF}', 80)
on conflict (code) do update set
  name        = excluded.name,
  area        = excluded.area,
  description = excluded.description,
  frameworks  = excluded.frameworks,
  sort_order  = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- P2P — Procure-to-Pay (16 steps)
-- -----------------------------------------------------------------------------

with t as (select id from public.audit_program_templates where code = 'P2P')
insert into public.audit_program_template_steps
  (template_id, ref, area, objective, procedure, evidence, control_hint, sort_order)
select t.id, v.ref, v.area, v.objective, v.procedure, v.evidence, v.control_hint, v.sort_order
from t, (values
('P-01', 'Governance',
 'Confirm that a current, approved procurement policy and delegation of authority (DoA) exist and are communicated.',
 'Obtain the procurement policy and the DoA matrix in force during the audit period. Inspect the approval evidence and the version history for both. Agree the approval authority levels in the DoA to the workflow configuration extracted from the ERP. Interview the Head of Procurement on how policy exceptions are raised and approved, and inspect all policy waivers granted in the period.',
 'Approved policy PDF with signature or board minute reference, DoA matrix, ERP release-strategy configuration export, waiver log.',
 'Procurement policy and DoA governance', 10),
('P-02', 'Master data',
 'Confirm that vendor master creation and amendment are authorised, supported and segregated from payment execution.',
 'Extract the vendor master change log for the period. Select 25 vendor creations and 25 bank-detail amendments on a random basis (all changes where the population is below 25). For each, inspect the request form, the independent approval, the supporting documents (CR, VAT certificate, IBAN letter on bank letterhead) and confirm the requester is not the approver. Reconcile the user IDs that made the changes against the user list with payment-release rights to test segregation of duties.',
 'Change log extract, vendor onboarding files, IBAN confirmation letters, SoD conflict matrix.',
 'Vendor master maintenance and SoD', 20),
('P-03', 'Master data',
 'Identify duplicate, dormant and suspicious vendors in the vendor master.',
 'Run data analytics over the full vendor master: exact and fuzzy duplicates on name, CR number, VAT number, IBAN and address; vendors sharing bank details with another vendor; vendors sharing bank details or address with an employee (match against the HR master); vendors with no transactions for more than 24 months that remain active; vendors with PO Box only addresses. Investigate every exception with Procurement and, for matches to employee data, escalate under the fraud response protocol.',
 'Vendor master extract, HR master extract, analytics scripts and output, exception clearance notes.',
 'Vendor master integrity analytics', 30),
('P-04', 'Requisition',
 'Confirm that purchases are initiated by an authorised requisition supported by a budget.',
 'Extract all purchase orders raised in the period. Select 40 POs stratified by value band (25 above the DoA threshold selected on a monetary-unit basis, 15 below selected randomly). For each, inspect the underlying purchase requisition, the requester authority against the DoA, and the budget availability check at the point of release.',
 'PO listing with values, requisition documents, DoA extract, budget check screenshots.',
 'Requisition approval and budget check', 40),
('P-05', 'Sourcing',
 'Confirm that competitive tendering was applied where required and that single-source awards were justified and approved.',
 'From the PO population, identify all awards above the tender threshold. Select 20 awards (all where fewer than 20 exist). Inspect the RFQ or tender documentation, the number of bids received, the technical and commercial evaluation, the award recommendation and the approval. For all single-source or direct awards, inspect the written justification and confirm approval at the level required by the DoA.',
 'Tender files, bid comparison sheets, evaluation committee minutes, single-source justification memos.',
 'Competitive tendering and award approval', 50),
('P-06', 'Sourcing',
 'Test for bid-rigging and collusion indicators in the tender population.',
 'Analyse the full tender population for: repeated participation by the same bidder set, bidders sharing address, phone, CR ownership or bank details, losing bids that are consistently a fixed percentage above the winner, and awards where the winner was the last bidder to submit. Corroborate any indicator through inspection of the tender file and interview with the evaluation committee chair.',
 'Bid registers, bidder company data, analytics output, interview notes.',
 'Fraud indicator — bid rigging', 60),
('P-07', 'Purchase order',
 'Confirm that purchase orders are complete, accurate and released only by authorised users.',
 'Reconcile the PO listing to the ERP purchasing document table to confirm completeness. Select 25 POs on a random basis and agree quantity, unit price, delivery terms and payment terms to the approved requisition and the contract or awarded quotation. Inspect the release strategy applied and confirm the releaser held the required authority on the release date.',
 'PO documents, contracts or quotations, release strategy log, authority matrix.',
 'PO accuracy and release authority', 70),
('P-08', 'Purchase order',
 'Test for split purchase orders used to circumvent authority thresholds.',
 'Analyse the full PO population for POs to the same vendor for the same material or service raised within 30 days whose combined value crosses a DoA threshold while each individual PO falls below it. Select the 15 highest-value clusters and inspect the business rationale with the requesting department.',
 'PO population extract, clustering analytics output, requester explanations.',
 'Fraud indicator — PO splitting', 80),
('P-09', 'Receiving',
 'Confirm that goods and services are received, inspected and recorded before payment.',
 'Select 30 invoices paid in the period on a monetary-unit sampling basis. For each, inspect the goods receipt note or service acceptance certificate, confirm it is dated on or before the invoice date, confirm it was raised by an individual independent of the requester, and agree the received quantity to the PO and to the invoice.',
 'GRNs, service acceptance certificates, delivery notes, PO and invoice copies.',
 'Goods receipt and service acceptance', 90),
('P-10', 'Invoice processing',
 'Confirm the three-way match operates as designed and that tolerances are configured and applied.',
 'Obtain the ERP configuration for the price and quantity tolerance limits and agree it to the approved policy. Re-perform the three-way match for the 30 items selected at P-09 by agreeing PO, GRN and invoice quantities and values. Separately extract all invoices posted with a tolerance override or a blocked-invoice release in the period and inspect the approval for the 20 highest-value overrides.',
 'ERP tolerance configuration export, matched document sets, override and block-release reports with approvals.',
 'Three-way match and tolerance override', 100),
('P-11', 'Invoice processing',
 'Confirm that invoices without a purchase order (non-PO spend) are controlled.',
 'Quantify non-PO spend as a percentage of total spend and analyse it by department and expense type. Select 20 non-PO invoices on a value-stratified basis and inspect the exceptional approval, the business justification and the coding to the general ledger. Assess whether recurring non-PO categories should be brought under PO control and raise this where the percentage exceeds the policy limit.',
 'Non-PO spend analysis, invoice copies with approvals, policy limit, GL coding.',
 'Non-PO spend control', 110),
('P-12', 'Invoice processing',
 'Test for duplicate payments and duplicate invoice postings.',
 'Run duplicate analytics over the full payment population on four rules: same vendor, same invoice number; same vendor, same amount, same date; same amount and same invoice date across different vendors; and invoice numbers differing only by leading zeros, spaces or transposed characters. Confirm each candidate against the source document and quantify the recoverable amount for confirmed duplicates.',
 'Payment population extract, analytics output, invoice images, recovery correspondence.',
 'Duplicate payment analytics', 120),
('P-13', 'Payment',
 'Confirm that payment release is properly authorised and segregated.',
 'Obtain the bank mandate and the payment approval matrix. Select 25 payment runs on a random basis and inspect the approval of the payment proposal at the required number of signatories and levels. Confirm through the user access listing that no individual can create a vendor, post an invoice and release a payment. Inspect the exception report for any payment released outside the standard run.',
 'Bank mandates, payment run approval evidence, user access listing with roles, off-cycle payment log.',
 'Payment authorisation and SoD', 130),
('P-14', 'Payment',
 'Confirm that payments are made to the vendor bank account recorded in the approved master data.',
 'For the 25 payments selected at P-13, agree the beneficiary IBAN on the bank confirmation to the vendor master record and to the independently verified IBAN letter. Extract all vendor bank-detail changes made within 15 days before a payment to that vendor and inspect the callback verification evidence for each.',
 'Bank payment confirmations, vendor master bank details, callback verification records.',
 'Fraud indicator — payment diversion', 140),
('P-15', 'Accounting',
 'Confirm accrual completeness at period end for goods and services received but not invoiced.',
 'Obtain the GR/IR (goods received / invoice received) ageing at period end. Test the reconciliation of the GR/IR account and investigate all items older than 90 days. Select the 20 largest open items and determine whether an accrual or a reversal is required. Agree the accrual computed by management to the underlying GRNs.',
 'GR/IR ageing report, account reconciliation, accrual schedule, supporting GRNs.',
 'GR/IR clearing and accrual completeness', 150),
('P-16', 'Compliance',
 'Confirm compliance with VAT, withholding tax and conflict-of-interest requirements in the procurement cycle.',
 'Select 25 invoices covering resident and non-resident vendors. Agree the VAT treatment and the input VAT recovery to the ZATCA-compliant tax invoice, and confirm withholding tax was deducted and remitted at the correct rate for non-resident payments. Separately, obtain the conflict-of-interest declarations for procurement staff and tender committee members and confirm completeness against the HR listing.',
 'Tax invoices, VAT return workings, WHT computations and remittance evidence, COI declaration register.',
 'Tax compliance and conflict of interest', 160)
) as v(ref, area, objective, procedure, evidence, control_hint, sort_order)
on conflict (template_id, ref) do update set
  area = excluded.area, objective = excluded.objective, procedure = excluded.procedure,
  evidence = excluded.evidence, control_hint = excluded.control_hint, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- O2C — Revenue / Order-to-Cash (15 steps)
-- -----------------------------------------------------------------------------

with t as (select id from public.audit_program_templates where code = 'O2C')
insert into public.audit_program_template_steps
  (template_id, ref, area, objective, procedure, evidence, control_hint, sort_order)
select t.id, v.ref, v.area, v.objective, v.procedure, v.evidence, v.control_hint, v.sort_order
from t, (values
('P-01', 'Governance',
 'Confirm that an approved revenue and credit policy exists and reflects current IFRS 15 accounting conclusions.',
 'Obtain the revenue recognition policy, the credit policy and the pricing and discount authority matrix. Inspect the approval evidence and the effective dates. Compare the documented five-step IFRS 15 assessment for each material revenue stream to the actual contract terms for two contracts per stream.',
 'Approved policies, IFRS 15 position papers, sample contracts.',
 'Revenue policy and IFRS 15 assessment', 10),
('P-02', 'Master data',
 'Confirm that customer master creation, credit limits and price conditions are authorised and segregated.',
 'Extract the customer master change log. Select 25 customer creations and all credit-limit increases above the DoA threshold. Inspect the credit assessment, the approval against the DoA and the supporting documentation (CR, financial statements or credit bureau report). Confirm that the user who maintains customer master data cannot post sales invoices or apply cash.',
 'Change log, credit files, approval evidence, SoD conflict matrix.',
 'Customer master and credit limit approval', 20),
('P-03', 'Order entry',
 'Confirm that sales orders are entered accurately and only for approved customers within credit limits.',
 'Select 30 sales orders on a value-stratified basis. Agree the price, quantity, discount and payment terms to the approved price list or signed contract. Inspect the credit-check result at order entry. Extract all orders released despite a credit block and inspect the approval for the 15 highest-value releases.',
 'Sales orders, price lists, contracts, credit block release report with approvals.',
 'Order entry accuracy and credit block release', 30),
('P-04', 'Order entry',
 'Confirm that discounts, rebates and price overrides are within authority.',
 'Extract all sales lines where the invoiced price differs from the standard price list. Analyse override frequency by user and by customer. Select the 25 largest overrides and inspect the approval against the discount authority matrix. Assess whether rebate and volume-discount accruals recorded at period end are complete.',
 'Price variance analytics, override approvals, discount authority matrix, rebate accrual schedule.',
 'Pricing override authorisation', 40),
('P-05', 'Delivery',
 'Confirm that goods dispatched or services rendered are supported by evidence of transfer of control.',
 'Select 30 revenue transactions on a monetary-unit sampling basis. For goods, inspect the delivery note signed by the customer and agree the Incoterms to the contract to confirm the point at which control transfers. For services, inspect the customer acceptance, milestone certificate or timesheet approval supporting the amount recognised.',
 'Delivery notes, proof of delivery, acceptance certificates, approved timesheets, contracts.',
 'Transfer of control evidence', 50),
('P-06', 'Billing',
 'Confirm that all delivered goods and services are billed (completeness of revenue).',
 'Reconcile the quantity dispatched per the inventory movement report to the quantity billed per the sales register for the period, and investigate the reconciling items. Extract all deliveries with no linked billing document at period end and confirm each is either a valid unbilled accrual or a billing omission.',
 'Inventory movement report, sales register, delivery-to-billing reconciliation, unbilled listing.',
 'Billing completeness', 60),
('P-07', 'Billing',
 'Confirm that invoices are accurate and comply with ZATCA e-invoicing requirements.',
 'For the 30 transactions at P-05, re-perform the invoice calculation (quantity times price, less discount, plus VAT). Confirm the invoice contains every field required by the ZATCA e-invoicing regulation, that the cryptographic stamp and QR code are present for the applicable phase, and that the invoice was reported or cleared through Fatoora within the required timeframe.',
 'Invoice images, ZATCA clearance or reporting confirmations, e-invoicing integration logs.',
 'Invoice accuracy and ZATCA e-invoicing', 70),
('P-08', 'Cut-off',
 'Confirm that revenue is recorded in the correct period.',
 'Select the 15 largest revenue transactions recorded in the 10 days before and the 10 days after period end. Agree the date of transfer of control to the delivery or acceptance evidence and confirm the accounting period. Extract all credit notes issued in the first 60 days after period end that relate to pre period-end revenue and evaluate whether they indicate premature recognition.',
 'Cut-off testing schedule, delivery evidence, post period-end credit note listing.',
 'Revenue cut-off', 80),
('P-09', 'Credit notes',
 'Confirm that credit notes, returns and write-offs are authorised and supported.',
 'Extract all credit notes issued in the period and analyse by reason code, by issuing user and by customer. Select 25 on a value-stratified basis and inspect the approval against the DoA, the reason and the supporting evidence (return note, dispute correspondence). Confirm the user issuing the credit note cannot also apply cash to the same account.',
 'Credit note listing and analytics, approval evidence, return notes, SoD matrix.',
 'Credit note authorisation', 90),
('P-10', 'Cash application',
 'Confirm that customer receipts are applied completely, accurately and on a timely basis.',
 'Select 25 receipts from the bank statement on a random basis and trace to the customer account application. Test the ageing of the unapplied cash and suspense accounts at period end and investigate all items older than 30 days. Confirm daily reconciliation between the collection bank accounts and the receivables sub-ledger is performed and independently reviewed.',
 'Bank statements, cash application postings, unapplied cash ageing, reconciliation evidence with reviewer sign-off.',
 'Cash application and unapplied cash', 100),
('P-11', 'Cash application',
 'Test for lapping and misappropriation indicators in receipts handling.',
 'Analyse the interval between receipt date per the bank statement and posting date to the customer account, by user. Investigate patterns of delayed application, receipts applied to a different customer and later reversed, and manual journal reallocations between customer accounts. Corroborate exceptions with the collections supervisor.',
 'Receipt timing analytics, reversal and reallocation journals, supervisor explanations.',
 'Fraud indicator — lapping', 110),
('P-12', 'Receivables',
 'Confirm the existence and accuracy of trade receivables.',
 'Agree the receivables ageing to the general ledger control account. Select 20 customer balances on a monetary-unit sampling basis and either obtain direct confirmation or perform subsequent-receipts testing to the bank statement. Investigate all credit balances in receivables and all balances with no movement for more than 12 months.',
 'Ageing report, GL reconciliation, confirmations or subsequent receipts, exception listings.',
 'Receivables existence', 120),
('P-13', 'Receivables',
 'Confirm that the expected credit loss provision is calculated in accordance with IFRS 9 and approved.',
 'Obtain the ECL model and the provision matrix. Re-perform the calculation for the largest ageing bucket and agree the loss rates to the historical default data and the forward-looking adjustment. Inspect the approval of the provision by the CFO or audit committee, and test whether specific provisions exist for all balances identified as credit-impaired.',
 'ECL model workings, historical default analysis, provision approval, credit-impaired listing.',
 'IFRS 9 expected credit loss provision', 130),
('P-14', 'Collections',
 'Confirm that collections and dunning activity is timely and escalated.',
 'Obtain the dunning or collections policy and the overdue ageing. Select 20 balances overdue by more than 90 days and inspect the collection activity log, the escalation to legal or management, and the payment plan approval where one exists. Compute days sales outstanding for the period and compare to prior periods and to the target.',
 'Collections policy, ageing report, activity logs, escalation and legal referral evidence, DSO analysis.',
 'Collections and escalation', 140),
('P-15', 'Reporting',
 'Confirm that manual journals affecting revenue are limited, authorised and supported.',
 'Extract all manual journal entries posted to revenue accounts in the period. Analyse by user, by value, by posting date (weekend, holiday and last-day-of-period postings) and by round-sum amounts. Select the 20 highest-risk entries and inspect the preparer, the independent approver and the supporting documentation.',
 'Manual journal extract, journal analytics, journal support files, approval evidence.',
 'Manual revenue journals', 150)
) as v(ref, area, objective, procedure, evidence, control_hint, sort_order)
on conflict (template_id, ref) do update set
  area = excluded.area, objective = excluded.objective, procedure = excluded.procedure,
  evidence = excluded.evidence, control_hint = excluded.control_hint, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- PAY — Payroll (14 steps)
-- -----------------------------------------------------------------------------

with t as (select id from public.audit_program_templates where code = 'PAY')
insert into public.audit_program_template_steps
  (template_id, ref, area, objective, procedure, evidence, control_hint, sort_order)
select t.id, v.ref, v.area, v.objective, v.procedure, v.evidence, v.control_hint, v.sort_order
from t, (values
('P-01', 'Governance',
 'Confirm that approved HR and payroll policies and a compensation authority matrix are in force.',
 'Obtain the HR policy, the payroll processing procedure and the compensation approval matrix. Inspect the approval and the effective dates. Confirm the policies address Saudi Labour Law requirements for working hours, overtime, leave, and end-of-service benefits, and that they have been communicated to staff.',
 'Approved policies, board or ExCom approval evidence, communication records.',
 'Payroll policy and compensation authority', 10),
('P-02', 'Master data',
 'Confirm that new joiners are added to payroll only on the basis of an approved offer and a completed hire.',
 'Extract all additions to the payroll master in the period. Select 25 on a random basis (all if fewer). Inspect the approved manpower requisition, the signed offer letter and employment contract, the approval of the salary against the compensation matrix, and confirm the start date on the contract agrees to the first pay period.',
 'Payroll master additions report, requisitions, signed contracts, salary approvals.',
 'Joiner processing', 20),
('P-03', 'Master data',
 'Confirm that leavers are removed from payroll promptly and that final settlements are accurate.',
 'Reconcile the HR leaver listing to the payroll deletions for the period and investigate every difference. Select 20 leavers and re-perform the end-of-service benefit calculation under Articles 84 to 87 of the Saudi Labour Law, agree unused leave encashment to the leave balance, confirm the clearance certificate was completed and confirm no payment was made after the last working day.',
 'HR leaver listing, payroll deletions, EOSB computations, clearance certificates, final settlement approvals.',
 'Leaver processing and final settlement', 30),
('P-04', 'Master data',
 'Confirm that changes to salary, allowances and bank details are authorised and segregated.',
 'Extract the payroll master change log. Select 30 changes stratified across salary, allowance and bank-detail types. Inspect the approval against the compensation authority matrix and confirm the requester is not the approver and not the person who input the change. Confirm the payroll master maintainer cannot release the payroll payment.',
 'Change log, approval forms, bank detail evidence, SoD conflict matrix.',
 'Payroll master change authorisation', 40),
('P-05', 'Master data',
 'Test the payroll master for ghost employees and data-integrity exceptions.',
 'Run analytics over the payroll master: duplicate national ID or Iqama numbers, duplicate IBANs across employees, employees with no Iqama expiry or an expired Iqama, employees with no leave taken in 12 months, employees whose bank account matches a vendor bank account, and employees with a start date after the current period. Corroborate every exception with HR and confirm the physical existence of a sample of 10 employees by inspecting HR files and confirming with the line manager.',
 'Payroll master extract, HR and vendor master extracts, analytics output, existence confirmation evidence.',
 'Fraud indicator — ghost employees', 50),
('P-06', 'Time and attendance',
 'Confirm that time recorded and overtime paid are accurate and approved.',
 'Select 25 employees with overtime in the period on a value-stratified basis. Agree the hours paid to the approved timesheet or the biometric attendance record, re-perform the overtime rate calculation against the Labour Law requirement, and inspect the line manager approval. Analyse overtime by department and by employee for outliers and obtain explanations for the ten highest.',
 'Timesheets, biometric attendance extracts, overtime approvals, overtime analytics.',
 'Time and attendance and overtime', 60),
('P-07', 'Processing',
 'Confirm that the payroll calculation is accurate and complete.',
 'Perform a month-on-month payroll variance analysis by component (basic, housing, transport, other allowances, deductions) and obtain explanations for variances above the materiality threshold. Independently re-perform the gross-to-net calculation for 25 employees selected on a value-stratified basis, including allowances, GOSI deductions, loan deductions and other deductions.',
 'Payroll registers for the period and comparative, variance analysis, recalculation workings.',
 'Payroll calculation accuracy', 70),
('P-08', 'Processing',
 'Confirm that the payroll register is reviewed and approved before disbursement.',
 'Select 6 monthly payroll runs across the period. Inspect evidence that the payroll register was independently reviewed by an individual outside the payroll preparation team and approved by the authorised signatory prior to the payment file being released. Confirm the approved register total agrees to the payment file total and to the bank debit.',
 'Payroll registers with reviewer and approver sign-off, payment files, bank statements.',
 'Payroll review and approval', 80),
('P-09', 'Disbursement',
 'Confirm that payroll is disbursed to the correct employees through compliant channels.',
 'For the 6 payroll runs at P-08, agree the payment file to the bank confirmation and confirm disbursement through the Wage Protection System. Inspect the WPS compliance status returned by the Ministry of Human Resources and Social Development and investigate any non-compliant month. Test that off-cycle and manual payments were separately approved.',
 'Payment files, bank confirmations, WPS submission and status reports, off-cycle payment approvals.',
 'Payroll disbursement and WPS compliance', 90),
('P-10', 'Statutory',
 'Confirm that GOSI contributions are calculated, deducted and remitted correctly and on time.',
 'Reconcile the GOSI contribution per the payroll register to the GOSI portal statement for three months. Re-perform the employee and employer contribution calculation for 20 employees covering both Saudi and non-Saudi nationals at the applicable rates. Inspect the remittance evidence and confirm payment within the statutory deadline; quantify any late-payment penalty.',
 'Payroll registers, GOSI portal statements, contribution recalculations, remittance receipts.',
 'GOSI contribution compliance', 100),
('P-11', 'Statutory',
 'Confirm compliance with Saudization (Nitaqat) and work-permit requirements.',
 'Obtain the current Nitaqat band and the Saudization percentage from the Qiwa platform. Reconcile the headcount by nationality per the payroll master to the platform. Confirm that Iqama and work-permit renewals are tracked, and list every employee whose Iqama expires within 60 days without a renewal in progress. Evaluate the business consequences of any downgrade in the Nitaqat band.',
 'Qiwa and Nitaqat reports, headcount reconciliation, Iqama expiry tracker, renewal evidence.',
 'Saudization and work permit compliance', 110),
('P-12', 'Accounting',
 'Confirm that payroll costs, accruals and provisions are completely and accurately recorded.',
 'Reconcile the payroll register to the payroll expense posted in the general ledger for three months and investigate reconciling items. Test the end-of-service benefit provision: agree the actuarial or management computation to the underlying service data, confirm the assumptions are approved, and confirm the movement in the provision is supported. Test the accrual for leave, bonus and air-ticket entitlements.',
 'Payroll-to-GL reconciliations, EOSB provision workings and actuarial report, accrual schedules.',
 'Payroll accounting and EOSB provision', 120),
('P-13', 'Access',
 'Confirm that access to the payroll system is restricted and appropriate.',
 'Obtain the payroll system user listing with roles. Confirm every user is a current employee with an approved access request, review privileged and administrator access for appropriateness, and confirm that a periodic user access review was performed and evidenced. Test that terminated payroll staff were removed from the system on their last working day.',
 'User access listing, access request approvals, user access review evidence, leaver access removal log.',
 'Payroll system access management', 130),
('P-14', 'Confidentiality',
 'Confirm that payroll and employee personal data are protected in line with the PDPL.',
 'Trace how payroll data is stored, transmitted to the bank and shared with third parties (insurers, actuaries). Confirm the lawful basis for processing, the existence of data-processing agreements with third parties, encryption of files in transit and at rest, and restriction of access to payroll reports. Test that data-retention periods are defined and applied.',
 'Data flow documentation, processing agreements, encryption configuration, retention schedule, access logs.',
 'Payroll data protection (PDPL)', 140)
) as v(ref, area, objective, procedure, evidence, control_hint, sort_order)
on conflict (template_id, ref) do update set
  area = excluded.area, objective = excluded.objective, procedure = excluded.procedure,
  evidence = excluded.evidence, control_hint = excluded.control_hint, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- TRE — Treasury and Cash Management (14 steps)
-- -----------------------------------------------------------------------------

with t as (select id from public.audit_program_templates where code = 'TRE')
insert into public.audit_program_template_steps
  (template_id, ref, area, objective, procedure, evidence, control_hint, sort_order)
select t.id, v.ref, v.area, v.objective, v.procedure, v.evidence, v.control_hint, v.sort_order
from t, (values
('P-01', 'Governance',
 'Confirm that an approved treasury policy defines permitted instruments, counterparty limits and delegated authority.',
 'Obtain the treasury policy and confirm board or audit committee approval and the review date. Confirm the policy defines permitted investment and borrowing instruments, counterparty and concentration limits, FX and interest-rate hedging mandates, and the delegation of authority for execution. Confirm the policy addresses Shariah compliance requirements where applicable.',
 'Approved treasury policy, board or ALCO minutes, delegation of authority matrix.',
 'Treasury policy and mandate', 10),
('P-02', 'Governance',
 'Confirm that treasury front, middle and back office duties are segregated.',
 'Map the treasury organisation to the deal lifecycle: dealing, confirmation, settlement, accounting and reconciliation. Obtain the treasury management system user listing with roles and identify any individual who can both execute a deal and confirm or settle it. Test whether compensating controls (dual authorisation, independent confirmation matching) operate where segregation is not achievable.',
 'Organisation chart, role descriptions, TMS user and role listing, SoD conflict analysis.',
 'Treasury segregation of duties', 20),
('P-03', 'Bank relationships',
 'Confirm that bank accounts and mandates are authorised, complete and current.',
 'Obtain the complete listing of bank accounts and independently confirm it with each bank. Agree the account listing to the general ledger and investigate any account not recorded. Inspect the board resolution or mandate for each account and confirm the signatories are current employees at the authorised level. Confirm that mandates were updated for every treasury leaver in the period.',
 'Bank account listing, bank confirmations, board resolutions, mandate letters, HR leaver listing.',
 'Bank mandate and signatory control', 30),
('P-04', 'Forecasting',
 'Confirm that cash forecasting is performed, reviewed and reasonably accurate.',
 'Obtain the rolling cash forecast for the period. Compare the forecast to actual cash flows for six months and compute the forecast variance. Inspect evidence of independent review of the forecast by the CFO or treasurer. Assess whether liquidity headroom and covenant compliance are monitored against the forecast.',
 'Rolling cash forecasts, forecast-versus-actual analysis, review sign-off, covenant compliance schedule.',
 'Cash forecasting and liquidity monitoring', 40),
('P-05', 'Investments',
 'Confirm that investments are executed within policy limits and properly authorised.',
 'Extract all investment transactions in the period. Select 25 on a value-stratified basis. Agree the instrument type, tenor, counterparty and amount to the policy limits, inspect the pre-deal approval at the required authority level, and agree the executed terms to the independent counterparty confirmation. Test the counterparty concentration against the limit at three month-end dates.',
 'Deal blotter, deal tickets with approvals, counterparty confirmations, limit monitoring reports.',
 'Investment execution within mandate', 50),
('P-06', 'Borrowings',
 'Confirm that borrowings are authorised and that facility terms and covenants are monitored.',
 'Obtain the schedule of all facilities and agree to signed facility agreements and to the general ledger. Inspect the board approval for each facility. Re-perform the covenant calculation at the two most recent test dates and agree to the certificate submitted to the lender. Confirm interest and profit charges for three periods by recalculation from the facility terms.',
 'Facility agreements, board approvals, covenant certificates and workings, interest recalculations.',
 'Borrowing authorisation and covenant compliance', 60),
('P-07', 'FX and hedging',
 'Confirm that FX and derivative transactions are within mandate and economically justified.',
 'Extract all FX and derivative transactions. Select 20 and agree each to an underlying exposure, confirming the transaction is a hedge rather than a speculative position. Inspect the pre-trade approval, the counterparty confirmation and the mark-to-market valuation at period end. Where hedge accounting is applied, inspect the hedge documentation prepared at inception as required by IFRS 9.',
 'Derivative deal listing, exposure schedules, deal approvals, confirmations, MTM valuations, hedge documentation.',
 'FX and derivative mandate compliance', 70),
('P-08', 'Payments',
 'Confirm that payment release from treasury systems requires dual authorisation by mandated signatories.',
 'Obtain the bank platform and TMS payment approval configuration. Confirm the configured limits and approver groups agree to the bank mandate. Select 25 payments across the period and inspect the two independent approvals recorded in the platform audit log. Extract and investigate every payment released with a single approval or by an emergency override.',
 'Platform approval configuration, payment audit logs, mandate letters, override log with approvals.',
 'Dual payment authorisation', 80),
('P-09', 'Payments',
 'Confirm that beneficiary details used for treasury payments are independently verified.',
 'Obtain the beneficiary master from the banking platform. Select 20 beneficiaries added or amended in the period and inspect the independent callback verification to a previously known contact and the approval by a second person. Analyse for beneficiaries added and used within 24 hours and investigate each.',
 'Beneficiary master extract, callback verification records, approval evidence.',
 'Fraud indicator — beneficiary manipulation', 90),
('P-10', 'Reconciliation',
 'Confirm that bank reconciliations are prepared, reviewed and cleared on a timely basis.',
 'Select all bank accounts at two month-end dates. Inspect the reconciliation for each, confirm preparation within the policy deadline and independent review evidenced by sign-off. Investigate every reconciling item older than 30 days and all unidentified debits and credits. Agree the reconciled bank balance to the bank statement and to the general ledger.',
 'Bank reconciliations with preparer and reviewer sign-off, bank statements, GL balances, ageing of reconciling items.',
 'Bank reconciliation', 100),
('P-11', 'Petty cash',
 'Confirm that petty cash and cash floats are controlled and physically verified.',
 'Obtain the listing of cash floats and custodians. Perform a surprise cash count for a sample of 5 locations, agree the count to the imprest balance and investigate differences. Inspect the reimbursement documentation for the two most recent replenishments per location and confirm approval within the DoA.',
 'Float register, surprise cash count sheets signed by custodian and auditor, reimbursement vouchers.',
 'Petty cash custody and count', 110),
('P-12', 'Accounting',
 'Confirm that treasury transactions are completely and accurately recorded.',
 'Reconcile the treasury deal blotter to the general ledger for investments, borrowings and derivatives at period end. Re-perform the amortised cost and effective interest computation for three borrowings. Confirm that FX translation of foreign-currency balances uses the correct closing rate and that gains and losses are correctly classified.',
 'Deal blotter, GL extracts, effective interest workings, FX rate source and translation schedule.',
 'Treasury accounting accuracy', 120),
('P-13', 'Systems access',
 'Confirm that access to banking platforms and the treasury management system is restricted.',
 'Obtain user listings for every banking platform and the TMS. Confirm each user is a current employee with an approved request, review administrator and token-holder assignments, and confirm periodic access reviews are performed and evidenced. Test that access for treasury leavers was revoked and that their tokens were returned and deactivated.',
 'User access listings, access approvals, access review evidence, token register, leaver revocation evidence.',
 'Banking platform access management', 130),
('P-14', 'Compliance',
 'Confirm compliance with sanctions screening and anti-money-laundering requirements on treasury counterparties.',
 'Confirm that counterparties and payment beneficiaries are screened against sanctions and PEP lists at onboarding and on an ongoing basis. Select 20 counterparties and inspect the screening evidence and the disposition of any alert. Confirm the escalation route for a true match is defined and that no payment proceeded while an alert was open.',
 'Screening system configuration and logs, alert disposition records, escalation procedure.',
 'Sanctions and AML screening', 140)
) as v(ref, area, objective, procedure, evidence, control_hint, sort_order)
on conflict (template_id, ref) do update set
  area = excluded.area, objective = excluded.objective, procedure = excluded.procedure,
  evidence = excluded.evidence, control_hint = excluded.control_hint, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- ITGC — IT General Controls (16 steps)
-- -----------------------------------------------------------------------------

with t as (select id from public.audit_program_templates where code = 'ITGC')
insert into public.audit_program_template_steps
  (template_id, ref, area, objective, procedure, evidence, control_hint, sort_order)
select t.id, v.ref, v.area, v.objective, v.procedure, v.evidence, v.control_hint, v.sort_order
from t, (values
('P-01', 'Scoping',
 'Confirm the population of in-scope applications, databases and operating systems supporting financial reporting.',
 'Obtain the IT application inventory and the financial reporting process narratives. Determine the in-scope layers for each significant account: application, database, operating system and network. Agree the resulting scope to the external auditor scoping memorandum where one exists, and document the rationale for any system excluded.',
 'Application inventory, process narratives, scoping memorandum, exclusion rationale.',
 'ITGC scoping', 10),
('P-02', 'Access — provisioning',
 'Confirm that access is granted only on the basis of an approved request.',
 'Extract all user accounts created in the period for each in-scope system. Select 25 across systems on a random basis. Inspect the access request, the approval by the data or system owner, and confirm the roles granted match the roles approved. Confirm no account was created without a request.',
 'User creation logs, access request tickets with approvals, role assignment screenshots.',
 'User provisioning approval', 20),
('P-03', 'Access — de-provisioning',
 'Confirm that access is removed promptly on termination or transfer.',
 'Reconcile the HR leaver listing for the period to the user account listing for each in-scope system as at the audit date, and investigate every leaver with active access. For 25 leavers, compute the elapsed days between the last working day and the disabling of the account and evaluate against the policy target.',
 'HR leaver listing, system user listings, account disable timestamps, policy SLA.',
 'Timely access revocation', 30),
('P-04', 'Access — review',
 'Confirm that periodic user access reviews are performed, evidenced and remediated.',
 'Obtain the user access review for each in-scope system for the period. Confirm the review covered the complete user population by agreeing the reviewed listing to a system-generated extract. Inspect the reviewer sign-off, the exceptions identified and the evidence that revocations arising from the review were actioned. Test that revocations were completed by re-checking 15 accounts.',
 'Access review packs, system-generated user extracts, reviewer sign-off, remediation tickets and closure evidence.',
 'Periodic user access review', 40),
('P-05', 'Access — privileged',
 'Confirm that privileged and administrator access is restricted, justified and monitored.',
 'Obtain the listing of accounts with administrator, superuser or SAP_ALL equivalent privileges at application, database and operating-system level. Confirm each is justified by role and approved. Inspect how privileged activity is logged and independently reviewed, and select 10 privileged sessions to confirm the review occurred. Confirm generic and shared administrator accounts are vaulted or otherwise controlled.',
 'Privileged account listings, approvals, privileged session logs, review evidence, PAM vault configuration.',
 'Privileged access management', 50),
('P-06', 'Access — authentication',
 'Confirm that authentication controls meet policy and regulatory requirements.',
 'Extract the password and authentication configuration for each in-scope system and agree the parameters (length, complexity, history, lockout, session timeout) to the policy and to the applicable NCA ECC or SAMA requirement. Confirm multi-factor authentication is enforced for remote and privileged access, and test a sample of 5 logins to confirm the challenge occurs.',
 'Configuration exports, policy, MFA configuration and enrolment reports, login test evidence.',
 'Authentication configuration', 60),
('P-07', 'Access — segregation of duties',
 'Confirm that segregation of duties conflicts within applications are identified and mitigated.',
 'Obtain the SoD conflict ruleset configured in the application or GRC tool and assess whether it covers the critical financial conflicts. Run the conflict report for the full user population. For the 20 highest-risk conflicts, inspect the approved mitigating control and evidence that it operated during the period.',
 'SoD ruleset, conflict report, mitigating control documentation and operating evidence.',
 'Application segregation of duties', 70),
('P-08', 'Change management',
 'Confirm that changes to in-scope systems are authorised, tested and approved before migration.',
 'Extract the complete population of changes migrated to production in the period from the transport or release log, and reconcile it to the change management ticket system to confirm completeness. Select 30 changes on a random basis. Inspect the business approval, the test evidence, the user acceptance sign-off and the approval to migrate.',
 'Transport or release logs, change tickets, test scripts and results, UAT sign-off, migration approvals.',
 'Change authorisation and testing', 80),
('P-09', 'Change management',
 'Confirm that developers cannot migrate their own changes to production.',
 'Obtain the listing of users with migration or deployment rights to production for each in-scope system and compare it to the listing of users with development rights. Investigate every individual holding both. For the 30 changes at P-08, confirm the person who migrated the change is not the person who developed it. Inspect the compensating control where separation is not possible.',
 'Migration rights listing, development rights listing, change records showing developer and migrator, compensating control evidence.',
 'Developer access to production', 90),
('P-10', 'Change management',
 'Confirm that emergency changes follow a defined process with retrospective approval.',
 'Extract all emergency or expedited changes in the period. Select all where fewer than 20, otherwise 20 on a value-stratified basis. Inspect the emergency justification, the approval obtained at the time (even if verbal, subsequently documented), the retrospective business approval, and the testing performed after the fact. Analyse the emergency change rate as a percentage of all changes.',
 'Emergency change log, justifications, retrospective approvals, post-implementation test evidence.',
 'Emergency change control', 100),
('P-11', 'Change management',
 'Confirm that production, test and development environments are separated.',
 'Confirm through system documentation and inspection that development, test and production environments are logically or physically separate. Test whether production data is copied to non-production environments and, if so, whether it is masked or anonymised in line with the PDPL. Confirm that non-production access does not confer production access.',
 'Environment architecture documentation, data-refresh procedures, masking configuration, access listings per environment.',
 'Environment segregation', 110),
('P-12', 'Development',
 'Confirm that new system implementations and major upgrades follow the approved SDLC.',
 'Identify all implementations and major upgrades that went live in the period. For each, inspect the project approval and business case, the requirements and design documentation, the system and user acceptance testing results, the data-migration reconciliation, the go-live approval and the post-implementation review.',
 'Project charters, steering committee minutes, test summary reports, data migration reconciliations, go-live approvals, PIR reports.',
 'Program development lifecycle', 120),
('P-13', 'Operations',
 'Confirm that batch jobs and interfaces are scheduled, monitored and failures resolved.',
 'Obtain the job schedule and the interface inventory for in-scope systems. Extract the job failure log for the period. Select 25 failures and inspect the alert raised, the resolution and the confirmation that data integrity was restored. Test the completeness and accuracy of two key financial interfaces by reconciling record counts and control totals between source and target.',
 'Job schedule, failure logs, incident tickets, interface reconciliations with control totals.',
 'Batch and interface monitoring', 130),
('P-14', 'Operations',
 'Confirm that data is backed up and that restoration has been successfully tested.',
 'Obtain the backup policy and the backup schedule for in-scope systems. Extract the backup job results for the period and quantify failures and their resolution. Confirm that backups are stored offsite or in a separate region and are encrypted. Inspect the most recent restoration test for each in-scope system and confirm it met the defined recovery point and recovery time objectives.',
 'Backup policy and schedule, backup job logs, offsite or replication configuration, restoration test reports.',
 'Backup and restoration', 140),
('P-15', 'Operations',
 'Confirm that incidents and problems affecting in-scope systems are logged, prioritised and resolved.',
 'Extract the incident population for the period for in-scope systems. Analyse by priority, by resolution time against the SLA and by recurrence. Select 20 high-priority incidents and inspect the root-cause analysis, the corrective action and the closure approval. Assess whether recurring incidents were escalated to problem management.',
 'Incident listings, SLA definitions, root-cause analyses, corrective action records.',
 'IT incident and problem management', 150),
('P-16', 'Reliance',
 'Confirm that reliance on service organisations is supported by assurance reports and complementary user controls.',
 'Identify in-scope systems hosted or operated by third parties. Obtain the current ISAE 3402 or SOC 1 Type II report for each. Confirm the report period covers the audit period, read the auditor opinion and every exception, and evaluate the impact. Confirm the complementary user entity controls listed in the report are implemented and test three of them.',
 'ISAE 3402 or SOC 1 reports, bridge letters, CUEC assessment and test evidence.',
 'Service organisation reliance (ISAE 3402)', 160)
) as v(ref, area, objective, procedure, evidence, control_hint, sort_order)
on conflict (template_id, ref) do update set
  area = excluded.area, objective = excluded.objective, procedure = excluded.procedure,
  evidence = excluded.evidence, control_hint = excluded.control_hint, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- INFOSEC — Information Security (15 steps)
-- -----------------------------------------------------------------------------

with t as (select id from public.audit_program_templates where code = 'INFOSEC')
insert into public.audit_program_template_steps
  (template_id, ref, area, objective, procedure, evidence, control_hint, sort_order)
select t.id, v.ref, v.area, v.objective, v.procedure, v.evidence, v.control_hint, v.sort_order
from t, (values
('P-01', 'Governance',
 'Confirm that information security governance is established with defined accountability.',
 'Obtain the information security policy set and confirm approval by the board or the authorised committee and review within the last 12 months. Confirm a Chief Information Security Officer or equivalent is appointed with a reporting line that preserves independence from IT operations, as required by the NCA ECC and, for SAMA-regulated entities, the SAMA Cyber Security Framework. Inspect security committee minutes for the period.',
 'Approved policy set, appointment letter and organisation chart, committee charter and minutes.',
 'Security governance and CISO independence', 10),
('P-02', 'Governance',
 'Confirm that the organisation has assessed itself against the applicable national framework and is closing gaps.',
 'Obtain the most recent NCA ECC (or SAMA CSF) self-assessment and maturity rating. Agree the reported maturity for 10 controls to the underlying evidence and re-assess independently. Obtain the remediation plan for the gaps, test the status of 10 remediation items and confirm overdue items are escalated.',
 'Self-assessment workbook, evidence for sampled controls, remediation plan with owners and dates, escalation records.',
 'Framework compliance self-assessment', 20),
('P-03', 'Risk management',
 'Confirm that information security risks are identified, assessed and treated.',
 'Obtain the information security risk register. Confirm it is current, that each risk has an owner, an inherent and residual assessment and a treatment decision. Test that risks arising from incidents, vulnerability scans and audit findings in the period were added to the register. Confirm risks accepted above appetite were approved at the required level.',
 'Risk register, risk assessment methodology, treatment plans, risk acceptance approvals.',
 'Information security risk management', 30),
('P-04', 'Asset management',
 'Confirm that information assets are inventoried, owned and classified.',
 'Obtain the information asset inventory and confirm coverage by reconciling to the network discovery scan and the CMDB. Confirm each asset has an owner and a classification. Select 20 assets and confirm the classification applied matches the data-classification standard and that handling requirements for the classification are applied in practice.',
 'Asset inventory, discovery scan output, CMDB extract, classification standard, handling evidence.',
 'Asset inventory and data classification', 40),
('P-05', 'Access control',
 'Confirm that identity and access management operates across the estate.',
 'Test the joiner, mover and leaver process end to end for 25 identities across the directory service and key applications. Confirm role-based access is used, that privileged accounts are vaulted, and that MFA is enforced for remote access, privileged access and access to systems holding personal data. Reconcile the directory account listing to the HR active-employee listing and investigate orphaned accounts.',
 'IAM process documentation, JML test evidence, directory extracts, PAM configuration, MFA enrolment reports, orphan account analysis.',
 'Identity and access management', 50),
('P-06', 'Vulnerability management',
 'Confirm that vulnerabilities are identified and remediated within defined timeframes.',
 'Obtain the vulnerability scan results for the period and confirm scan coverage against the asset inventory. Analyse open vulnerabilities by severity and by age against the policy remediation SLA. Select 20 critical and high vulnerabilities and trace to remediation, risk acceptance or compensating control. Quantify the number breaching SLA at the audit date.',
 'Scan schedules and coverage analysis, vulnerability reports, remediation tickets, SLA policy, risk acceptances.',
 'Vulnerability management and SLA', 60),
('P-07', 'Patch management',
 'Confirm that security patches are deployed across the estate on a timely basis.',
 'Obtain the patch compliance report by platform. Reconcile the devices reported to the asset inventory to identify unmanaged devices. Select the three most recent critical vendor patches and test the deployment percentage and the elapsed time from vendor release to deployment. Inspect the approval for any device excluded from patching.',
 'Patch management console reports, asset reconciliation, patch deployment timelines, exclusion approvals.',
 'Patch management', 70),
('P-08', 'Network security',
 'Confirm that network segmentation and perimeter controls are effective.',
 'Obtain the network architecture diagram and confirm it is current. Test that the production, corporate and guest networks are segmented and that systems holding regulated data sit in a restricted zone. Obtain the firewall rule base, test for any-any rules, rules with no business owner and rules unused for 12 months, and inspect the evidence of the periodic firewall rule review.',
 'Network diagrams, segmentation test evidence, firewall rule base export, rule review records, change tickets for rules.',
 'Network segmentation and firewall rules', 80),
('P-09', 'Endpoint security',
 'Confirm that endpoints are protected and centrally managed.',
 'Obtain the endpoint protection console report and reconcile the covered endpoints to the asset inventory to quantify unprotected devices. Confirm signatures or detection content are current, that disk encryption is enforced, that local administrator rights are restricted, and that removable-media controls operate. Test 10 endpoints against the hardening baseline.',
 'EDR console reports, asset reconciliation, encryption compliance report, local admin listing, hardening baseline test results.',
 'Endpoint protection and hardening', 90),
('P-10', 'Cryptography',
 'Confirm that data is encrypted in transit and at rest and that keys are managed.',
 'Identify systems holding confidential or personal data and confirm encryption at rest. Test the TLS configuration of external-facing services for approved protocol versions and cipher suites. Obtain the key management procedure and confirm key generation, storage, rotation and destruction are defined and evidenced, and that keys are held separately from the data they protect.',
 'Encryption configuration evidence, TLS scan results, key management procedure, key rotation records, HSM or key vault configuration.',
 'Encryption and key management', 100),
('P-11', 'Logging and monitoring',
 'Confirm that security events are logged, centralised, retained and monitored.',
 'Confirm that in-scope systems forward logs to the SIEM by reconciling log sources to the asset inventory. Confirm the retention period meets the regulatory requirement. Review the use-case and alert rule set for coverage of privileged activity, failed authentication, data exfiltration and configuration change. Select 20 alerts from the period and inspect triage, escalation and closure within the SLA.',
 'SIEM log source inventory, retention configuration, use-case catalogue, alert records with triage and closure notes.',
 'Security monitoring and SIEM', 110),
('P-12', 'Incident response',
 'Confirm that security incidents are managed and reported to the regulator where required.',
 'Obtain the incident response plan and confirm approval and annual testing. Extract the security incident population for the period. Select 15 and inspect classification, containment, eradication, recovery, root-cause analysis and lessons learned. For any incident meeting the notification threshold, confirm notification to the NCA, SAMA or SDAIA within the required timeframe.',
 'IR plan, tabletop exercise reports, incident records, root-cause analyses, regulator notification evidence.',
 'Security incident response and notification', 120),
('P-13', 'Data protection',
 'Confirm compliance with the Personal Data Protection Law for personal data processed.',
 'Obtain the record of processing activities and confirm coverage of all personal-data flows. Confirm the lawful basis for each, that privacy notices are provided, that data-subject rights can be exercised within the statutory period, and that cross-border transfers meet the PDPL transfer conditions. Test the retention and deletion schedule against three data sets.',
 'Record of processing activities, privacy notices, data-subject request log, transfer assessments, retention and deletion evidence.',
 'PDPL personal data compliance', 130),
('P-14', 'Awareness',
 'Confirm that security awareness training and phishing simulation are delivered and effective.',
 'Obtain the training completion report and reconcile to the HR active-employee listing to compute the completion rate, including new joiners within the required period. Obtain the results of phishing simulations for the period, analyse click and reporting rates by department and trend, and inspect the remedial action for repeat clickers.',
 'Training completion reports, HR headcount, phishing simulation results, remedial action records.',
 'Security awareness and phishing simulation', 140),
('P-15', 'Assurance',
 'Confirm that independent technical testing is performed and findings remediated.',
 'Obtain the most recent penetration test and red-team reports covering external, internal and application layers. Confirm scope, independence of the tester and frequency against policy and the applicable regulatory requirement. Trace every critical and high finding to remediation and inspect the retest evidence confirming closure.',
 'Penetration test reports, scope and rules of engagement, tester independence evidence, remediation tracker, retest reports.',
 'Independent penetration testing', 150)
) as v(ref, area, objective, procedure, evidence, control_hint, sort_order)
on conflict (template_id, ref) do update set
  area = excluded.area, objective = excluded.objective, procedure = excluded.procedure,
  evidence = excluded.evidence, control_hint = excluded.control_hint, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- TPRM — Third-Party and Vendor Management (13 steps)
-- -----------------------------------------------------------------------------

with t as (select id from public.audit_program_templates where code = 'TPRM')
insert into public.audit_program_template_steps
  (template_id, ref, area, objective, procedure, evidence, control_hint, sort_order)
select t.id, v.ref, v.area, v.objective, v.procedure, v.evidence, v.control_hint, v.sort_order
from t, (values
('P-01', 'Governance',
 'Confirm that an approved third-party risk management policy and lifecycle framework exist.',
 'Obtain the third-party risk management policy and the outsourcing policy. Confirm approval at the required level and review within the last 12 months. Confirm the framework defines the full lifecycle (tiering, due diligence, contracting, monitoring, exit) and that it addresses the SAMA outsourcing requirements where the entity is SAMA-regulated, including regulatory notification or no-objection for material outsourcing.',
 'Approved policies, approval evidence, lifecycle procedure documents, regulatory correspondence.',
 'Third-party risk policy and outsourcing framework', 10),
('P-02', 'Inventory',
 'Confirm that the third-party inventory is complete and accurate.',
 'Obtain the third-party register. Reconcile it to the vendor master and to the accounts payable spend analysis for the period to identify third parties transacting but not registered. Confirm each entry records the service, the business owner, the risk tier, the contract dates and the data accessed. Quantify and report the completeness gap.',
 'Third-party register, vendor master, AP spend analysis, reconciliation and gap listing.',
 'Third-party inventory completeness', 20),
('P-03', 'Tiering',
 'Confirm that third parties are risk-tiered consistently and that tiering drives the level of diligence.',
 'Obtain the tiering methodology and confirm the criteria (criticality of service, data sensitivity, regulatory materiality, substitutability, spend). Independently re-tier 20 third parties and compare to the recorded tier. Confirm that the diligence and monitoring requirements actually applied match the requirements for the recorded tier.',
 'Tiering methodology, tiering questionnaires, re-tiering workpaper, diligence requirement matrix.',
 'Risk tiering methodology', 30),
('P-04', 'Due diligence',
 'Confirm that pre-contract due diligence is performed proportionate to the tier.',
 'Select 20 third parties onboarded in the period, weighted to the critical and high tiers. Inspect the due diligence file for financial assessment, legal and CR verification, sanctions and adverse-media screening, beneficial ownership identification, information security assessment and, where relevant, site visit or assurance report. Confirm the risk owner accepted any residual risk before contract signature.',
 'Due diligence questionnaires and files, screening reports, security assessments, residual risk acceptance.',
 'Pre-contract due diligence', 40),
('P-05', 'Due diligence',
 'Confirm that conflicts of interest and related-party relationships are identified.',
 'Match the third-party register against the register of related parties, the board and senior-management interests declarations, and the employee master (address, phone, bank account, family name). Investigate every match and confirm that the relationship was declared and that the individual was recused from the award decision.',
 'Related party register, interest declarations, employee master, match analytics, recusal evidence.',
 'Conflict of interest and related parties', 50),
('P-06', 'Contracting',
 'Confirm that contracts contain the clauses required by policy and regulation.',
 'Select 20 contracts across tiers. Confirm the presence and adequacy of clauses for service levels, pricing and price adjustment, confidentiality, data protection and PDPL processing terms, sub-contracting consent, audit and inspection rights (including regulator access for SAMA-regulated entities), business continuity, liability and indemnity, and termination and exit assistance. Confirm legal review and signature within the DoA.',
 'Contract files, clause checklist workpaper, legal review evidence, signature authority matrix.',
 'Contract clause adequacy', 60),
('P-07', 'Contracting',
 'Confirm that contracts are current and that renewals and variations are controlled.',
 'Extract all contracts from the register and identify those expired, auto-renewed or operating without a signed contract at the audit date. Select 15 variations or renewals in the period and inspect the business justification, the revised commercial terms and the approval at the required authority. Quantify spend under expired contracts.',
 'Contract register with dates, expiry analysis, variation approvals, spend analysis under expired contracts.',
 'Contract currency and renewal control', 70),
('P-08', 'Monitoring',
 'Confirm that service levels and performance are measured and managed.',
 'Select 15 critical and high-tier third parties. Obtain the SLA definitions and the performance reports for the period. Confirm performance is measured against the contracted SLA, that the reporting is validated rather than self-certified alone, that service credits due were claimed, and that governance meetings were held at the contracted frequency with minuted actions.',
 'SLA schedules, performance reports, validation evidence, service credit calculations and claims, governance meeting minutes.',
 'Service level monitoring', 80),
('P-09', 'Monitoring',
 'Confirm that third-party risk is monitored on an ongoing basis after onboarding.',
 'For the 15 third parties at P-08, confirm the periodic re-assessment was performed at the frequency required by the tier. Inspect the refreshed screening, the current assurance report (ISAE 3402 or SOC 2) with review of exceptions and complementary user controls, and the financial viability check. Confirm findings were logged and tracked to closure.',
 'Re-assessment records, refreshed screening, assurance reports with review notes, financial viability assessments, finding tracker.',
 'Ongoing third-party monitoring', 90),
('P-10', 'Concentration',
 'Confirm that concentration and fourth-party risk are identified and managed.',
 'Analyse the third-party population for concentration by service, by spend and by shared underlying infrastructure (including cloud regions and shared sub-contractors). Confirm material sub-contractors (fourth parties) are identified for critical services and that sub-contracting consent was obtained. Evaluate whether concentration exceeding appetite has been escalated.',
 'Concentration analysis, sub-contractor disclosures, consent records, escalation evidence.',
 'Concentration and fourth-party risk', 100),
('P-11', 'Data and access',
 'Confirm that third-party access to systems and data is controlled and revoked when no longer required.',
 'Extract all third-party user accounts across in-scope systems. Confirm each is sponsored by a named internal owner, approved, time-bound and subject to MFA. Reconcile the accounts to active contracts and investigate accounts belonging to terminated third parties. Confirm periodic review of third-party access is performed.',
 'Third-party account listings, sponsorship and approval records, contract status, access review evidence.',
 'Third-party logical access', 110),
('P-12', 'Continuity',
 'Confirm that continuity and exit arrangements exist for critical third parties.',
 'For critical third parties, obtain the continuity and disaster-recovery arrangements and confirm the recovery objectives align to the internal business impact analysis. Confirm a documented exit plan exists identifying the alternative provider or in-sourcing route, data return and deletion, and estimated transition time and cost. Test whether any exit plan has been rehearsed.',
 'Third-party BCP and DR documentation, internal BIA, exit plans, rehearsal or transition evidence.',
 'Third-party continuity and exit planning', 120),
('P-13', 'Termination',
 'Confirm that terminations are executed completely, including data return and access removal.',
 'Select all third parties terminated in the period (or 15 where more exist). Inspect the termination checklist and confirm final settlement, return or certified destruction of data, revocation of logical and physical access, return of assets, and removal from the vendor master or blocking for payment.',
 'Termination checklists, data destruction certificates, access revocation evidence, asset return records, vendor master status.',
 'Third-party exit execution', 130)
) as v(ref, area, objective, procedure, evidence, control_hint, sort_order)
on conflict (template_id, ref) do update set
  area = excluded.area, objective = excluded.objective, procedure = excluded.procedure,
  evidence = excluded.evidence, control_hint = excluded.control_hint, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- BCM — Business Continuity and Disaster Recovery (12 steps)
-- -----------------------------------------------------------------------------

with t as (select id from public.audit_program_templates where code = 'BCM')
insert into public.audit_program_template_steps
  (template_id, ref, area, objective, procedure, evidence, control_hint, sort_order)
select t.id, v.ref, v.area, v.objective, v.procedure, v.evidence, v.control_hint, v.sort_order
from t, (values
('P-01', 'Governance',
 'Confirm that a business continuity policy and programme governance are established.',
 'Obtain the business continuity policy and confirm approval by the board or the authorised committee and review within the last 12 months. Confirm a programme owner is appointed, that the scope covers all critical business units and locations, and that the programme is reported to senior management at a defined frequency. Inspect the governance minutes for the period.',
 'Approved BCM policy, approval evidence, programme charter, steering or management committee minutes.',
 'BCM governance', 10),
('P-02', 'Business impact analysis',
 'Confirm that a current business impact analysis identifies critical processes and recovery objectives.',
 'Obtain the BIA and confirm it was refreshed within the last 12 months and covers every business unit. Confirm each critical process has a defined maximum tolerable period of disruption, recovery time objective and recovery point objective, and that dependencies (people, systems, suppliers, premises, data) are identified. Re-perform the criticality assessment for three processes and compare to the BIA conclusion.',
 'BIA documentation, refresh evidence, RTO and RPO schedule, dependency maps, re-performance workpaper.',
 'Business impact analysis', 20),
('P-03', 'Risk assessment',
 'Confirm that continuity threat scenarios are assessed and reflect the operating environment.',
 'Obtain the continuity risk and threat assessment. Confirm it addresses scenarios relevant to the location and sector, including loss of premises, loss of IT, loss of key personnel, loss of a critical supplier, cyber attack and regional or geopolitical disruption. Confirm the treatment decisions for the highest-rated scenarios are approved and funded.',
 'Threat and risk assessment, scenario register, treatment plans and approvals, budget evidence.',
 'Continuity threat assessment', 30),
('P-04', 'Strategy',
 'Confirm that the recovery strategy is capable of meeting the recovery objectives.',
 'Compare the documented recovery strategy (alternate site, work-from-home capability, manual workarounds, standby capacity, cloud failover) to the RTO and RPO from the BIA for each critical process. Confirm the capacity of the alternate arrangements is sufficient for the required headcount and transaction volume. Identify and report every process where the strategy cannot meet the stated objective.',
 'Recovery strategy documentation, alternate site contracts and capacity data, gap analysis workpaper.',
 'Recovery strategy adequacy', 40),
('P-05', 'Plans',
 'Confirm that business continuity plans are documented, current and actionable.',
 'Select the plans for 8 critical processes. Confirm each identifies the invocation criteria and authority, the recovery team and deputies, the step-by-step recovery actions with timings, the resources required and the interdependencies. Confirm each plan was reviewed and approved within the last 12 months and is accessible when primary systems are unavailable.',
 'BCP documents with version and approval history, contact trees, offline or out-of-band copies.',
 'Business continuity plan currency', 50),
('P-06', 'IT disaster recovery',
 'Confirm that IT disaster recovery plans exist for systems supporting critical processes.',
 'Reconcile the systems supporting the critical processes identified in the BIA to the DR plan inventory to identify systems without a plan. For 8 in-scope systems, confirm the DR plan documents the recovery sequence, the technical steps, the dependencies and the assigned recovery personnel, and that the technical RTO and RPO align to the business requirement.',
 'BIA system dependency list, DR plan inventory, DR runbooks, RTO and RPO alignment analysis.',
 'IT disaster recovery planning', 60),
('P-07', 'Backup',
 'Confirm that backups support the recovery point objectives and are protected.',
 'Obtain the backup schedule and confirm the frequency supports the RPO for each critical system. Extract backup job results for the period and quantify failures and their resolution. Confirm backups are encrypted, stored in a geographically separate location, and protected against ransomware through immutability or an offline copy. Inspect the most recent successful restoration test per system.',
 'Backup schedules and job logs, encryption and replication configuration, immutability settings, restoration test results.',
 'Backup and restoration capability', 70),
('P-08', 'Exercising',
 'Confirm that continuity and disaster recovery arrangements are exercised.',
 'Obtain the exercise calendar and the reports for exercises performed in the period. Confirm the type and frequency meet policy and any regulatory requirement (the SAMA Business Continuity Management Framework requires periodic testing for regulated entities). For 3 exercises, confirm the scope, the participants, whether recovery objectives were achieved and whether the exercise involved actual failover rather than a walkthrough alone.',
 'Exercise calendar, exercise plans, exercise reports with results against RTO and RPO, failover evidence.',
 'Continuity and DR exercising', 80),
('P-09', 'Exercising',
 'Confirm that lessons from exercises and actual disruptions are acted upon.',
 'Extract the actions raised from exercises and from actual disruption events in the period. Confirm each has an owner and a due date, test the status of all overdue actions, and confirm that plans were updated to reflect the lessons learned. Confirm significant failures to meet recovery objectives were escalated to senior management.',
 'Post-exercise action logs, incident after-action reviews, updated plan versions, escalation evidence.',
 'Post-exercise improvement', 90),
('P-10', 'Crisis management',
 'Confirm that crisis management and communication arrangements are defined and rehearsed.',
 'Obtain the crisis management plan. Confirm the crisis team composition, the escalation and invocation thresholds, the decision-making authority and the deputisation arrangements. Confirm that internal and external communication templates exist, including for regulators, customers and media, and that contact data was verified within the last 6 months. Test the call tree for one business unit.',
 'Crisis management plan, contact trees with verification dates, communication templates, call tree test evidence.',
 'Crisis management and communication', 100),
('P-11', 'Dependencies',
 'Confirm that continuity dependencies on third parties and shared services are managed.',
 'Identify the third parties supporting critical processes from the BIA. Confirm that continuity requirements are contracted, that current third-party continuity evidence has been obtained and reviewed, and that at least one joint exercise or a review of the third-party exercise result has occurred for the most critical providers.',
 'BIA supplier dependencies, contract continuity clauses, third-party BCP and exercise reports, joint exercise evidence.',
 'Third-party continuity dependency', 110),
('P-12', 'Awareness',
 'Confirm that staff understand their continuity responsibilities.',
 'Obtain the continuity awareness and role-specific training records and reconcile completion to the recovery team rosters. Interview 5 recovery team members without notice to confirm they know their role, the invocation process and where to access the plan. Report any recovery role held by a person who has left or changed role.',
 'Training records, recovery team rosters, interview notes, HR movement listing.',
 'Continuity awareness and role readiness', 120)
) as v(ref, area, objective, procedure, evidence, control_hint, sort_order)
on conflict (template_id, ref) do update set
  area = excluded.area, objective = excluded.objective, procedure = excluded.procedure,
  evidence = excluded.evidence, control_hint = excluded.control_hint, sort_order = excluded.sort_order;
