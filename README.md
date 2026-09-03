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
| Regulatory Library | `/dashboard/regulations` | Live — 10 frameworks, 511 controls, EN/AR |
| Policy Generator | `/dashboard/policy-generator` | Live — grounded in the library, cites real control IDs |
| Policies | `/dashboard/policies` | Live — saved policies with control mappings, status workflow |
| Risk Horizon | `/dashboard/risk-horizon` | Placeholder |
| Audit Trail | `/dashboard/audit` | Placeholder |

## Regulatory Library

The library is the substrate every other module reads from. Frameworks and controls are global reference data (readable by all authenticated users, writable only via migrations); policies and mappings are tenant-scoped through RLS.

| Code | Framework | Jurisdiction | Controls | Fidelity |
|---|---|---|---|---|
| `NCA-ECC` | NCA Essential Cybersecurity Controls (ECC-2:2024) | SA | 108 | paraphrased |
| `SAMA-CSF` | SAMA Cyber Security Framework | SA | 48 | paraphrased |
| `KSA-PDPL` | Personal Data Protection Law | SA | 32 | summarized |
| `UAE-IAS` | UAE Information Assurance Standards | AE | 27 | summarized |
| `QA-NIA` | Qatar National Information Assurance Policy | QA | 25 | summarized |
| `QCB-TRM` | QCB Technology Risk & Information Security | QA | 20 | summarized |
| `CBJ-CSF` | CBJ Cyber Security Framework | JO | 18 | summarized |
| `ISO-27001` | ISO/IEC 27001:2022 Annex A | INTL | 93 | paraphrased |
| `NIST-CSF` | NIST Cybersecurity Framework 2.0 | INTL | 106 | structural |
| `EU-AI-ACT` | EU Artificial Intelligence Act | EU | 34 | summarized |

**Fidelity** describes how closely `requirement_en` follows the source: `structural` (near-verbatim, public-domain source), `paraphrased` (control-by-control restatement), `summarized` (obligation-level summary; article or clause numbering may be approximate). `verified` is `false` for every row until a human has checked it against the primary document — the UI shows this. ISO text is deliberately paraphrased, not reproduced.

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

## Project layout

- `app/` — routes and layouts
- `app/api/generate-policy/` — streaming policy generation, grounded in the control index
- `components/ui/` — shadcn/ui-style primitives (Base UI)
- `components/regulations/` — bilingual control explorer
- `components/policy-generator/` — generator client with save-to-library
- `lib/regulatory-library/` — queries, citation extraction, prompt index builder
- `lib/assistant/` — assistant system prompt, tool definitions and executors, conversation queries
- `components/assistant/` — chat client (sidebar, streaming thread, citation chips)
- `lib/actions/` — server actions (auth, policies)
- `lib/supabase/` — browser, server, admin and middleware clients
- `lib/anthropic.ts` — Anthropic SDK client and model config
- `supabase/migrations/` — schema, RLS and seed migrations
- `supabase/seed/regulatory-library/` — framework JSON sources
- `scripts/build-regulatory-seed.mjs` — JSON → SQL generator

## Database

Tables: `organizations`, `profiles`, `client_workspaces`, `modules`, `organization_modules`, `intelligence_sources`, `intelligence_items`, `risk_signals`, `briefs`, `frameworks`, `controls`, `policies`, `policy_control_mappings`, `conversations`, `messages`. View: `framework_summary`.

Regenerate types after schema changes: `npm run db:types`.
