# AETHER.ai

A modular GRC platform for GCC enterprises — regulatory library, compliance programs, evidence, ICFR, internal audit, enterprise risk and an AI advisor in one multi-tenant SaaS.

Built with Next.js 16 (App Router), Supabase, Anthropic Claude, and Tailwind CSS v4.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Anthropic keys
npm run db:push              # apply migrations (schema + regulatory library seed)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is already in use, Next.js will bind to the next available port (e.g. **3001**).

## Modules

| Module | Route | Status |
|---|---|---|
| Ask AETHER (GRC assistant) | `/dashboard/assistant` | Live — streaming chat with tool access to the library, your policies, programs, audits, risks and ICFR; EN/AR; cited answers; answers beyond the library from general expertise, marked as such |
| Compliance Programs | `/dashboard/programs` | Live — adopt a framework, per-control status/owner/due/evidence, readiness %, AI readiness review |
| Evidence | `/dashboard/evidence` | Live — private storage bucket, validity/expiry, review workflow, linked to controls |
| ICFR | `/dashboard/icfr` | Live — COSO risk-control matrices, 7 cycle templates (52 risks / 84 controls), design & operating tests, deficiency log, AI RCM + test procedures |
| Regulatory Library | `/dashboard/regulations` | Live — 10 frameworks, 615 controls, EN/AR |
| Policy Generator | `/dashboard/policy-generator` | Live — grounded in the library, cites real control IDs |
| Policies | `/dashboard/policies` | Live — saved policies with control mappings, status workflow |
| Internal Audit | `/dashboard/audit` | Live — risk-scored audit universe, annual plan with capacity, engagement workbench (planning / fieldwork / reporting / actions), 8 standard work programs (115 procedures), observation and follow-up registers, AI work program / observation / report drafting |
| Enterprise Risk | `/dashboard/erm` | Live — bilingual GCC taxonomy, appetite per category, 5×5 heat map, treatments, KRIs, assessment history, AI risk identification and board report |
| Risk Horizon | `/dashboard/risk-horizon` | Placeholder |

## Regulatory Library

The library is the substrate every other module reads from. Frameworks and controls are global reference data (readable by all authenticated users, writable only via migrations); policies and mappings are tenant-scoped through RLS.

| Code | Framework | Jurisdiction | Controls | Fidelity |
|---|---|---|---|---|
| `NCA-ECC` | NCA Essential Cybersecurity Controls (ECC-2:2024) | SA | 108 | paraphrased |
| `SAMA-CSF` | SAMA Cyber Security Framework | SA | 152 | paraphrased |
| `KSA-PDPL` | Personal Data Protection Law | SA | 32 | summarized |
| `UAE-IAS` | UAE Information Assurance Standards | AE | 27 | summarized |
| `QA-NIA` | Qatar National Information Assurance Policy | QA | 25 | summarized |
| `QCB-TRM` | QCB Technology Risk & Information Security | QA | 20 | summarized |
| `CBJ-CSF` | CBJ Cyber Security Framework | JO | 18 | summarized |
| `ISO-27001` | ISO/IEC 27001:2022 Annex A | INTL | 93 | paraphrased |
| `NIST-CSF` | NIST Cybersecurity Framework 2.0 | INTL | 106 | structural |
| `EU-AI-ACT` | EU Artificial Intelligence Act | EU | 34 | summarized |

**Fidelity** describes how closely `requirement_en` follows the source: `structural` (near-verbatim, public-domain source), `paraphrased` (control-by-control restatement), `summarized` (obligation-level summary; article or clause numbering may be approximate). `verified` is `false` for every row until a human has checked it against the primary document — the UI shows this. ISO text is deliberately paraphrased, not reproduced.

### Arabic review (how a control becomes "verified")

Every control ships `verified = false`. The database refuses to mark a control verified
without a named reviewer (`controls_verified_requires_reviewer`), so the system cannot
award itself a tick — a human has to sign.

```bash
# 1. Generate a bilingual review workbook (English beside Arabic, OK/Fix dropdowns)
python3 scripts/export_arabic_review.py NCA-ECC review/
python3 scripts/export_arabic_review.py SAMA-CSF review/

# 2. Reviewer fills in the yellow cells and their name on the 'Read me' sheet.

# 3. Read the corrections back into the seed JSON and stamp the reviewer's name
python3 scripts/apply_arabic_review.py review/aether-arabic-review-nca-ecc.xlsx --dry-run
python3 scripts/apply_arabic_review.py review/aether-arabic-review-nca-ecc.xlsx

# 4. Emit an update migration and push
node scripts/build-regulatory-seed.mjs --as-new-migration
supabase db push
```

A row marked **Fix** with no correction is left unverified and reported, never silently
accepted. A workbook with no reviewer name applies nothing. The library UI shows
"Reviewed by <name> · <date>" on signed controls and an explicit unreviewed marker on
the rest.

### Editing the library

Source of truth is `supabase/seed/regulatory-library/*.json`. Never edit the generated SQL.

```bash
node scripts/build-regulatory-seed.mjs --check   # validate JSON
node scripts/build-regulatory-seed.mjs           # regenerate the seed migration
npm run db:push
```

The seed is idempotent (`on conflict ... do update`), so editing a row's text and re-pushing updates it in place. To add a framework, add a JSON file with a unique `framework.code` and `sort_order`.

## Ask AETHER

`/api/assistant` runs a Claude tool-use loop (max 6 rounds) with eleven read-only tools: `list_frameworks`, `get_framework`, `search_controls`, `get_control`, `list_domain_controls`, `list_policies`, `get_policy`, `list_programs`, `get_audit_overview`, `list_erm_risks`, `get_icfr_overview`. The prompt draws a line between two kinds of statement: what a regulation requires (grounded in the library and cited) and everything else (answered from general expertise and marked "not in the library"). It never refuses a question for being outside the library. All tools query through the user's Supabase session, so RLS applies. The response streams as NDJSON events (`text`, `tool`, `citations`, `done`); citations are resolved by matching control IDs in the final answer against the controls the tools actually returned, so the assistant cannot cite something it did not read. Conversations and messages persist per organization (`conversations`, `messages`).

## Compliance Programs + Evidence

- **Programs** (`/dashboard/programs`) — adopt a framework from the Regulatory Library as a program. `create_program()` seeds one `control_implementations` row per library control; the `program_summary` view rolls up readiness (`implemented / (total - not_applicable)`). The program page is a control matrix grouped by domain: per-control status, owner, due date, notes, N/A justification, linked evidence, bulk status updates, and a streamed AI readiness review (`POST /api/programs/[id]/review`, Claude Sonnet) with executive summary, readiness by domain, top gaps, 30/60/90-day actions and evidence weaknesses.
- **Evidence** (`/dashboard/evidence`) — tenant evidence vault. Files upload directly from the browser to the private `evidence` storage bucket under `<organization_id>/…` (25 MB max; pdf/docx/xlsx/png/jpg/csv/txt/zip), or record a link / note. Evidence has validity dates (expired / expiring-soon badges), owner/admin accept/reject review, and can be linked to any control implementation. Downloads use short-lived signed URLs.
- Schema: `supabase/migrations/20260903140000_compliance_programs.sql` (`programs`, `control_implementations`, `evidence`, `evidence_links`, `program_summary`, `create_program`, storage bucket + object policies). All tables are RLS tenant-scoped via `current_user_org_id()`; deletes require owner/admin.
- Code: `lib/programs/queries.ts`, `lib/actions/programs.ts`, `lib/actions/evidence.ts`, `components/programs/*`, `components/evidence/*`.

## ICFR (Internal Control over Financial Reporting)

`/dashboard/icfr` — COSO 2013 / SOX 404-style control program for CMA-listed and Aramco-affiliate style entities.

- **Risk & control matrices by cycle** — import Big-Four-quality templates (P2P, O2C, R2R, PAY, FA, TRS, ITGC; 52 risks / 84 controls) or generate an RCM with Claude (`POST /api/icfr/generate-rcm`, validated JSON → `importGeneratedRcm`).
- **Process workspace** (`/dashboard/icfr/[processId]`) — matrix view (risks × controls, click to link), controls table with type / nature / frequency / key / COSO / owner / latest design & operating results, risks table with assertions and likelihood × impact.
- **Control drawer** — description, evidence, risk links, design/operating tests (period, sample, exceptions, result, tester, workpaper ref), AI-drafted test procedure (`POST /api/icfr/test-procedure`, streaming Markdown with frequency-based sample sizes), and deficiency logging.
- **Deficiency log** (`/dashboard/icfr/deficiencies`) — deficiency / significant deficiency / material weakness with remediation owner, due date (overdue highlighting) and inline status updates.

Schema: `supabase/migrations/20260903150000_icfr.sql` (tables `icfr_processes`, `icfr_risks`, `icfr_controls`, `icfr_risk_controls`, `icfr_tests`, `icfr_deficiencies`, global `icfr_templates` / `icfr_template_items`, view `icfr_process_summary`, function `import_icfr_template`). Template seed is generated from `supabase/seed/icfr-templates/*.json` by `node scripts/build-icfr-templates.mjs`.

## Internal Audit

Risk-based internal audit aligned to the IIA Global Internal Audit Standards (2024),
with the audit committee oversight expected under the CMA Corporate Governance
Regulations and the additional expectations that apply to SAMA-regulated entities.

**Audit universe** (`/dashboard/audit/universe`) — the population of auditable
entities, each scored 1–5 on six weighted factors (inherent risk 25%, control
environment 20%, regulatory exposure 20%, financial materiality 15%, change
velocity 10%, prior findings 10%). The weighted 0–100 score is a generated column;
entities at 60 or above are pulled to at least annual coverage. Scores are edited
inline and coverage staleness is shown against the effective cycle.

**Planning** (`/dashboard/audit/plans`) — `create_audit_plan_from_universe` proposes a
plan for a period: every entity that has fallen due is sequenced by risk score,
allocated to a quarter and given budgeted days by entity type. Once cumulative days
exceed the stated capacity the remainder is marked deferred, so the assurance gap is
visible rather than hidden. Plans record audit committee approval.

**Engagement workbench** (`/dashboard/audit/engagements/[id]`) — four tabs:
- *Planning*: objective, scope, out-of-scope, criteria, team, dates and budget; import
  one of eight global standard work programs, or draft a risk-based program with AI
  (objectives, scope, criteria, an engagement risk assessment, and numbered procedures
  each with test approach, sample basis and evidence).
- *Fieldwork*: procedures with status and conclusions; workpapers with preparer and
  independent reviewer sign-off — the reviewer cannot be the preparer.
- *Reporting*: observations written as condition / criteria / cause / effect with a
  rating, a recommendation and the management response. Rough fieldwork notes can be
  turned into a structured observation that cites a regulatory library control where
  one applies. The engagement report drafts to Markdown.
- *Actions*: management action plans per observation with owner, due date and
  tracked extensions.

Stage advancement is gated: fieldwork requires a documented objective, scope and a
work program; reporting requires every procedure resolved and every workpaper
reviewed; issuing requires an overall rating, an executive summary, and every
observation fully written up with a management response and an agreed action;
closing requires every action verified, cancelled or risk-accepted. Issuing a report
opens the observations for follow-up and stamps the universe with the coverage date.

**Registers** — `/dashboard/audit/observations` is the org-wide observation register
with filters by rating, status, category and repeat finding.
`/dashboard/audit/actions` is the follow-up register with ageing buckets, overdue
highlighting and internal audit verification before closure.

**Standard work programs** — eight global templates seeded as reference data:
Procure-to-Pay (16 steps), Revenue / Order-to-Cash (15), Payroll (14), Treasury and
Cash Management (14), IT General Controls (16), Information Security (15),
Third-Party and Vendor Management (13), Business Continuity and Disaster Recovery
(12) — 115 procedures in total, each with objective, test approach, sample basis and
the evidence to retain.

## Enterprise Risk Management (ERM)

A board-level enterprise risk register built on ISO 31000:2018 and COSO ERM 2017.
Risk is treated as the effect of uncertainty on objectives; every risk is stated as
risk source → event → consequence and scored inherent (before controls), residual
(after controls) and target (after treatment) on calibrated 5×5 likelihood and
impact scales, with a separate velocity rating for speed to consequence.

**Pages**

- `/dashboard/erm` — portfolio dashboard: stat strip, an interactive 5×5 heat map
  with an inherent/residual toggle and click-to-filter cells, top ten risks by
  residual score with movement since the last assessment, and the residual band
  distribution by risk domain.
- `/dashboard/erm/risks` — the register, filterable by category, owner, residual
  band, status and appetite breach.
- `/dashboard/erm/risks/[id]` — risk detail: statement, causes and consequences,
  inherent/residual/target scoring with rationale, velocity and trend, impact by
  dimension, mitigating controls (regulatory library, ICFR, or named), treatment
  plans, KRIs with reading sparklines, the immutable assessment history, and
  links to audit observations and ICFR deficiencies.
- `/dashboard/erm/appetite` — appetite statements per category with tolerance
  thresholds, current utilisation and approval status.
- `/dashboard/erm/kris` — KRI dashboard with RAG status, trend, breach history and
  reading entry.
- `/dashboard/erm/taxonomy` — the tenant taxonomy, with import from the global
  bilingual GCC template.

**AI endpoints**

- `POST /api/erm/identify` — returns validated candidate risks in register shape
  (statement, category, inherent likelihood/impact, velocity, suggested ISO 31000
  treatments). Enum and 1–5 scale values are validated server-side before return.
- `POST /api/erm/board-report` — streams a Markdown board risk report built only
  from register data: executive summary, profile and movement, principal risks,
  risks outside appetite, KRI breaches, emerging risks and asks of the board.

**Saudi context.** The CMA Corporate Governance Regulations make the board
responsible for overseeing the risk management system and approving the risk
appetite; SAMA sets equivalent expectations for supervised financial institutions.
The appetite page and the board report are written against that responsibility.

**Migrations.** `20260904110000_erm.sql` (schema, views, RLS, `import_erm_taxonomy()`,
`erm_assess_risk()`) and `20260904140000_erm_additions.sql` (global taxonomy seed
of 8 domains and 41 sub-categories in English and Arabic, plus the
`erm_treatment_summary` view).

## Project layout

- `app/` — routes and layouts
- `app/api/generate-policy/` — streaming policy generation, grounded in the control index
- `components/ui/` — shadcn/ui-style primitives (Base UI)
- `components/regulations/` — bilingual control explorer
- `components/policy-generator/` — generator client with save-to-library
- `lib/regulatory-library/` — queries, citation extraction, prompt index builder
- `lib/programs/`, `lib/evidence/`, `components/programs/`, `components/evidence/` — compliance programs and evidence vault
- `lib/icfr/`, `components/icfr/`, `supabase/seed/icfr-templates/`, `scripts/build-icfr-templates.mjs` — ICFR module and template generator
- `lib/audit/`, `lib/actions/audit.ts`, `components/audit/`, `app/api/audit/` — internal audit module
- `lib/erm/`, `lib/actions/erm.ts`, `components/erm/`, `app/api/erm/` — enterprise risk module
- `lib/assistant/` — assistant system prompt, tool definitions and executors, conversation queries
- `components/assistant/` — chat client (sidebar, streaming thread, citation chips)
- `lib/actions/` — server actions (auth, policies)
- `lib/supabase/` — browser, server, admin and middleware clients
- `lib/anthropic.ts` — Anthropic SDK client and model config
- `supabase/migrations/` — schema, RLS and seed migrations
- `supabase/seed/regulatory-library/` — framework JSON sources
- `scripts/build-regulatory-seed.mjs` — JSON → SQL generator

## Database

Tables: `organizations`, `profiles`, `client_workspaces`, `modules`, `organization_modules`, `intelligence_sources`, `intelligence_items`, `risk_signals`, `briefs`, `frameworks`, `controls`, `policies`, `policy_control_mappings`, `conversations`, `messages`, `programs`, `control_implementations`, `evidence`, `evidence_links`, `icfr_processes`, `icfr_risks`, `icfr_controls`, `icfr_risk_controls`, `icfr_tests`, `icfr_deficiencies`, `icfr_templates`, `icfr_template_items`, `audit_universe`, `audit_plans`, `audit_plan_items`, `audit_engagements`, `audit_procedures`, `audit_workpapers`, `audit_observations`, `audit_actions`, `audit_program_templates`, `audit_program_template_steps`, `erm_taxonomy_templates`, `erm_categories`, `erm_appetite`, `erm_risks`, `erm_risk_controls`, `erm_treatments`, `erm_kris`, `erm_kri_readings`, `erm_assessments`, `erm_links`. Views: `framework_summary`, `program_summary`, `icfr_process_summary`, `audit_universe_scored`, `audit_engagement_summary`, `audit_action_register`, `erm_risk_summary`, `erm_kri_status`, `erm_heatmap`, `erm_treatment_summary`. Functions: `create_program`, `import_icfr_template`, `create_audit_plan_from_universe`, `import_erm_taxonomy`, `erm_assess_risk`, `erm_kri_rag`, `erm_mark_overdue_treatments`. Storage bucket: `evidence` (private, org-scoped paths).

Regenerate types after schema changes: `npm run db:types`.
