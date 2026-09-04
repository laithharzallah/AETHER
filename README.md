# AETHER.ai

A modular GRC platform for GCC enterprises — regulatory intelligence, AI governance, policy management, and audit trail in one multi-tenant SaaS.

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
| Ask AETHER (GRC assistant) | `/dashboard/assistant` | Live — streaming chat with tool access to the library and your policies, EN/AR, cited answers, saved conversations |
| Compliance Programs | `/dashboard/programs` | Live — adopt a framework, per-control status/owner/due/evidence, readiness %, AI readiness review |
| Evidence | `/dashboard/evidence` | Live — private storage bucket, validity/expiry, review workflow, linked to controls |
| ICFR | `/dashboard/icfr` | Live — COSO risk-control matrices, 7 cycle templates (52 risks / 84 controls), design & operating tests, deficiency log, AI RCM + test procedures |
| Regulatory Library | `/dashboard/regulations` | Live — 10 frameworks, 615 controls, EN/AR |
| Policy Generator | `/dashboard/policy-generator` | Live — grounded in the library, cites real control IDs |
| Policies | `/dashboard/policies` | Live — saved policies with control mappings, status workflow |
| Risk Horizon | `/dashboard/risk-horizon` | Placeholder |
| Audit Trail | `/dashboard/audit` | Placeholder |

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

`/api/assistant` runs a Claude tool-use loop (max 6 rounds) with seven read-only tools: `list_frameworks`, `get_framework`, `search_controls`, `get_control`, `list_domain_controls`, `list_policies`, `get_policy`. All tools query through the user's Supabase session, so RLS applies. The response streams as NDJSON events (`text`, `tool`, `citations`, `done`); citations are resolved by matching control IDs in the final answer against the controls the tools actually returned, so the assistant cannot cite something it did not read. Conversations and messages persist per organization (`conversations`, `messages`).

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

## Project layout

- `app/` — routes and layouts
- `app/api/generate-policy/` — streaming policy generation, grounded in the control index
- `components/ui/` — shadcn/ui-style primitives (Base UI)
- `components/regulations/` — bilingual control explorer
- `components/policy-generator/` — generator client with save-to-library
- `lib/regulatory-library/` — queries, citation extraction, prompt index builder
- `lib/programs/`, `lib/evidence/`, `components/programs/`, `components/evidence/` — compliance programs and evidence vault
- `lib/icfr/`, `components/icfr/`, `supabase/seed/icfr-templates/`, `scripts/build-icfr-templates.mjs` — ICFR module and template generator
- `lib/assistant/` — assistant system prompt, tool definitions and executors, conversation queries
- `components/assistant/` — chat client (sidebar, streaming thread, citation chips)
- `lib/actions/` — server actions (auth, policies)
- `lib/supabase/` — browser, server, admin and middleware clients
- `lib/anthropic.ts` — Anthropic SDK client and model config
- `supabase/migrations/` — schema, RLS and seed migrations
- `supabase/seed/regulatory-library/` — framework JSON sources
- `scripts/build-regulatory-seed.mjs` — JSON → SQL generator

## Database

Tables: `organizations`, `profiles`, `client_workspaces`, `modules`, `organization_modules`, `intelligence_sources`, `intelligence_items`, `risk_signals`, `briefs`, `frameworks`, `controls`, `policies`, `policy_control_mappings`, `conversations`, `messages`, `programs`, `control_implementations`, `evidence`, `evidence_links`, `icfr_processes`, `icfr_risks`, `icfr_controls`, `icfr_risk_controls`, `icfr_tests`, `icfr_deficiencies`, `icfr_templates`, `icfr_template_items`. Views: `framework_summary`, `program_summary`, `icfr_process_summary`. Functions: `create_program`, `import_icfr_template`. Storage bucket: `evidence` (private, org-scoped paths).

Regenerate types after schema changes: `npm run db:types`.
