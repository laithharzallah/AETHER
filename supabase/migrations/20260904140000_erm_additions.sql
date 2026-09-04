-- =============================================================================
-- AETHER ERM — additive migration
--   1. Seeds the global risk taxonomy (erm_taxonomy_templates), GCC-flavoured,
--      two levels, English + Arabic.
--   2. Adds erm_treatment_summary — per-organization treatment portfolio counts
--      used by the board pack and the ERM dashboard.
--
-- Idempotent: re-running updates the seed rows in place and replaces the view.
-- Nothing in 20260904110000_erm.sql is modified.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Global taxonomy seed
-- -----------------------------------------------------------------------------

insert into public.erm_taxonomy_templates
  (code, parent_code, name_en, name_ar, description_en, description_ar, sort_order)
values
-- ---------------------------------------------------------------- Strategic --
('STR', null, 'Strategic', 'المخاطر الاستراتيجية',
 'Uncertainty affecting the achievement of strategic objectives, the chosen business model and the organisation''s position in its markets.',
 'حالة عدم اليقين التي تؤثر على تحقيق الأهداف الاستراتيجية ونموذج الأعمال ومكانة المنظمة في أسواقها.', 10),
('STR-01', 'STR', 'Market and competitive disruption', 'اضطراب السوق والمنافسة',
 'New entrants, substitute offerings or pricing pressure erode market share and margin.', null, 11),
('STR-02', 'STR', 'Business model and diversification', 'نموذج الأعمال والتنويع',
 'Failure to adapt the revenue model to Vision 2030 diversification, localisation and privatisation agendas.', null, 12),
('STR-03', 'STR', 'Mergers, acquisitions and investments', 'عمليات الاندماج والاستحواذ والاستثمار',
 'Inadequate due diligence, valuation error or post-merger integration failure destroys invested capital.', null, 13),
('STR-04', 'STR', 'Capital projects and major programmes', 'المشاريع الرأسمالية والبرامج الكبرى',
 'Cost overrun, schedule slippage or scope failure on giga-projects and capital programmes.', null, 14),
('STR-05', 'STR', 'Macroeconomic and commodity price volatility', 'تقلبات الاقتصاد الكلي وأسعار السلع',
 'Oil price, government spending or regional demand shifts change the operating environment faster than the plan can absorb.', null, 15),

-- ---------------------------------------------------------------- Financial --
('FIN', null, 'Financial', 'المخاطر المالية',
 'Uncertainty affecting liquidity, capital, earnings quality and the integrity of financial reporting.',
 'حالة عدم اليقين التي تؤثر على السيولة ورأس المال وجودة الأرباح وسلامة التقارير المالية.', 20),
('FIN-01', 'FIN', 'Liquidity and funding', 'السيولة والتمويل',
 'Insufficient cash or committed facilities to meet obligations as they fall due.', null, 21),
('FIN-02', 'FIN', 'Credit and counterparty', 'الائتمان والطرف المقابل',
 'Customer, borrower or counterparty default leads to impairment and cash-flow loss.', null, 22),
('FIN-03', 'FIN', 'Market risk (FX, interest rate, commodity)', 'مخاطر السوق (الصرف وأسعار الفائدة والسلع)',
 'Adverse movements in rates, currencies or commodity prices affect earnings and the balance sheet.', null, 23),
('FIN-04', 'FIN', 'Financial reporting and disclosure', 'التقارير المالية والإفصاح',
 'Material misstatement or late disclosure under IFRS as endorsed in Saudi Arabia and CMA listing rules.', null, 24),
('FIN-05', 'FIN', 'Tax and Zakat', 'الضريبة والزكاة',
 'Incorrect VAT, withholding tax, transfer pricing or Zakat positions result in ZATCA assessments and penalties.', null, 25),
('FIN-06', 'FIN', 'Fraud and misappropriation of assets', 'الاحتيال واختلاس الأصول',
 'Override of controls, fictitious vendors or payroll and expense abuse cause financial loss.', null, 26),

-- -------------------------------------------------------------- Operational --
('OPS', null, 'Operational', 'المخاطر التشغيلية',
 'Uncertainty arising from inadequate or failed internal processes, people, systems and physical assets.',
 'حالة عدم اليقين الناشئة عن قصور أو إخفاق العمليات الداخلية والأفراد والأنظمة والأصول المادية.', 30),
('OPS-01', 'OPS', 'Process failure and service disruption', 'إخفاق العمليات وتعطل الخدمة',
 'Breakdown in a core operating process interrupts delivery to customers or beneficiaries.', null, 31),
('OPS-02', 'OPS', 'Supply chain and logistics', 'سلسلة الإمداد والخدمات اللوجستية',
 'Shipping, customs or upstream shortages disrupt input availability and cost.', null, 32),
('OPS-03', 'OPS', 'Asset integrity and maintenance', 'سلامة الأصول والصيانة',
 'Deferred maintenance or equipment failure causes unplanned outage, loss of production or a safety event.', null, 33),
('OPS-04', 'OPS', 'Health, safety and environment', 'الصحة والسلامة والبيئة',
 'A workplace incident causes injury, environmental damage, regulatory action and loss of licence to operate.', null, 34),
('OPS-05', 'OPS', 'Business continuity and crisis management', 'استمرارية الأعمال وإدارة الأزمات',
 'Untested recovery arrangements extend the outage window beyond stated recovery time objectives.', null, 35),

-- --------------------------------------------------------- Technology/Cyber --
('TEC', null, 'Technology and Cyber', 'التقنية والأمن السيبراني',
 'Uncertainty arising from the confidentiality, integrity, availability and governance of information and technology.',
 'حالة عدم اليقين الناشئة عن سرية المعلومات والتقنية وسلامتها وتوافرها وحوكمتها.', 40),
('TEC-01', 'TEC', 'Cyber attack and data breach', 'الهجمات السيبرانية وتسريب البيانات',
 'Ransomware, intrusion or insider exfiltration compromises critical systems and personal data.', null, 41),
('TEC-02', 'TEC', 'IT availability and resilience', 'توافر أنظمة تقنية المعلومات ومرونتها',
 'Unplanned outage of a critical application or data centre interrupts business services.', null, 42),
('TEC-03', 'TEC', 'Data governance and privacy', 'حوكمة البيانات والخصوصية',
 'Personal data processed outside the Personal Data Protection Law and SDAIA implementing regulations.', null, 43),
('TEC-04', 'TEC', 'Legacy systems and technical debt', 'الأنظمة القديمة والدين التقني',
 'Unsupported platforms cannot be patched or integrated, raising cost and exposure.', null, 44),
('TEC-05', 'TEC', 'Artificial intelligence and emerging technology', 'الذكاء الاصطناعي والتقنيات الناشئة',
 'Model bias, hallucination or ungoverned AI adoption produces wrong decisions and regulatory exposure.', null, 45),

-- --------------------------------------------------- Regulatory/Compliance --
('REG', null, 'Regulatory and Compliance', 'المخاطر التنظيمية والامتثال',
 'Uncertainty arising from laws, regulations and supervisory expectations applicable to the organisation.',
 'حالة عدم اليقين الناشئة عن الأنظمة واللوائح والتوقعات الرقابية المطبقة على المنظمة.', 50),
('REG-01', 'REG', 'Licensing and regulatory breach', 'التراخيص ومخالفة الأنظمة',
 'Non-compliance with CMA, SAMA or sector licensing conditions attracts enforcement, fines or licence restriction.', null, 51),
('REG-02', 'REG', 'Corporate governance and board effectiveness', 'حوكمة الشركات وفاعلية المجلس',
 'Board and committee arrangements fall short of the CMA Corporate Governance Regulations, including board oversight of risk management.', null, 52),
('REG-03', 'REG', 'Financial crime, AML and sanctions', 'الجرائم المالية وغسل الأموال والعقوبات',
 'Weak customer due diligence or screening exposes the organisation to money laundering and sanctions breaches.', null, 53),
('REG-04', 'REG', 'Bribery and corruption', 'الرشوة والفساد',
 'Improper payments or conflicts of interest in procurement and government dealings trigger Nazaha investigation.', null, 54),
('REG-05', 'REG', 'Contractual and litigation exposure', 'المخاطر التعاقدية والتقاضي',
 'Poorly drafted obligations or disputed performance lead to claims, arbitration and provisioning.', null, 55),

-- --------------------------------------------------------------- Third party --
('TPR', null, 'Third Party', 'مخاطر الأطراف الخارجية',
 'Uncertainty transferred to the organisation through vendors, outsourcing arrangements and partners.',
 'حالة عدم اليقين المنتقلة إلى المنظمة عبر الموردين وترتيبات الإسناد الخارجي والشركاء.', 60),
('TPR-01', 'TPR', 'Vendor selection and due diligence', 'اختيار الموردين والعناية الواجبة',
 'Onboarding a vendor without adequate financial, security or integrity screening.', null, 61),
('TPR-02', 'TPR', 'Outsourcing and service provider failure', 'الإسناد الخارجي وإخفاق مزودي الخدمة',
 'A material outsourced service fails without an executable exit or substitution plan.', null, 62),
('TPR-03', 'TPR', 'Concentration and single-source dependency', 'التركز والاعتماد على مصدر واحد',
 'Dependence on one supplier, platform or region removes the ability to switch at acceptable cost.', null, 63),
('TPR-04', 'TPR', 'Fourth party and sub-contractor risk', 'مخاطر الأطراف الرابعة والمقاولين من الباطن',
 'Undisclosed sub-contracting moves data or delivery outside the assessed control environment.', null, 64),
('TPR-05', 'TPR', 'Contract performance and SLA breach', 'أداء العقود والإخلال باتفاقيات مستوى الخدمة',
 'Service levels are not met and contractual remedies are not enforced.', null, 65),

-- ------------------------------------------------------------------- People --
('PPL', null, 'People', 'مخاطر الموارد البشرية',
 'Uncertainty arising from workforce capacity, capability, conduct and culture.',
 'حالة عدم اليقين الناشئة عن قدرة القوى العاملة وكفاءتها وسلوكها وثقافتها.', 70),
('PPL-01', 'PPL', 'Talent attraction and retention', 'استقطاب المواهب والاحتفاظ بها',
 'Attrition in scarce skills raises cost and delays delivery of the strategy.', null, 71),
('PPL-02', 'PPL', 'Key person dependency and succession', 'الاعتماد على الأشخاص الرئيسيين والتعاقب الوظيفي',
 'Loss of an individual holding undocumented knowledge or sole authority interrupts operations.', null, 72),
('PPL-03', 'PPL', 'Saudization and workforce nationalisation', 'السعودة وتوطين الوظائف',
 'Failure to meet Nitaqat bands restricts visas, government services and eligibility to contract.', null, 73),
('PPL-04', 'PPL', 'Capability and skills gap', 'الكفاءات والفجوة في المهارات',
 'The workforce lacks the technical or digital skills the operating model now requires.', null, 74),
('PPL-05', 'PPL', 'Conduct, culture and ethics', 'السلوك والثقافة والأخلاقيات',
 'Tone from the top and incentives encourage behaviour outside the stated values and code of conduct.', null, 75),

-- --------------------------------------------------------- Reputational/ESG --
('ESG', null, 'Reputational and ESG', 'السمعة والاستدامة والحوكمة البيئية والاجتماعية',
 'Uncertainty affecting stakeholder trust and the environmental and social consequences of the organisation''s activity.',
 'حالة عدم اليقين التي تؤثر على ثقة أصحاب المصلحة والآثار البيئية والاجتماعية لأنشطة المنظمة.', 80),
('ESG-01', 'ESG', 'Brand and reputation damage', 'الإضرار بالعلامة التجارية والسمعة',
 'An incident or adverse media cycle reduces customer, investor and regulator confidence.', null, 81),
('ESG-02', 'ESG', 'Climate transition and physical risk', 'مخاطر التحول المناخي والمخاطر المادية',
 'Carbon pricing, transition policy or extreme heat and flooding affect assets, cost and demand.', null, 82),
('ESG-03', 'ESG', 'Environmental compliance and emissions', 'الامتثال البيئي والانبعاثات',
 'Breach of National Center for Environmental Compliance limits on emissions, effluent or waste.', null, 83),
('ESG-04', 'ESG', 'Social licence and community relations', 'الرخصة الاجتماعية وعلاقات المجتمع',
 'Community opposition or labour practice concerns disrupt operations and permitting.', null, 84),
('ESG-05', 'ESG', 'Sustainability reporting and greenwashing', 'تقارير الاستدامة والتضليل البيئي',
 'Unsupported sustainability claims or inconsistent Tadawul ESG disclosure attract challenge.', null, 85)
on conflict (code) do update set
  parent_code    = excluded.parent_code,
  name_en        = excluded.name_en,
  name_ar        = excluded.name_ar,
  description_en = excluded.description_en,
  description_ar = excluded.description_ar,
  sort_order     = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- 2. erm_treatment_summary — treatment portfolio joined to its risk
-- -----------------------------------------------------------------------------

create or replace view public.erm_treatment_summary
with (security_invoker = true) as
select
  t.id,
  t.organization_id,
  t.risk_id,
  r.code                          as risk_code,
  r.title                         as risk_title,
  r.residual_score                as risk_residual_score,
  t.strategy,
  t.title,
  t.description,
  t.owner_id,
  coalesce(p.full_name, p.email)  as owner_name,
  t.due_date,
  t.status,
  t.cost_estimate,
  t.expected_residual_likelihood,
  t.expected_residual_impact,
  (t.expected_residual_likelihood * t.expected_residual_impact) as expected_residual_score,
  t.completed_at,
  t.created_at,
  t.updated_at,
  (t.status = 'overdue'
   or (t.status in ('planned', 'in_progress')
       and t.due_date is not null
       and t.due_date < current_date)) as is_overdue,
  case
    when t.due_date is null then null
    else (t.due_date - current_date)
  end as days_to_due
from public.erm_treatments t
join public.erm_risks r on r.id = t.risk_id
left join public.profiles p on p.id = t.owner_id;

grant select on public.erm_treatment_summary to authenticated;

comment on view public.erm_treatment_summary is
  'Treatment plans with their parent risk and owner, plus a computed overdue flag that does not require erm_mark_overdue_treatments() to have run.';
