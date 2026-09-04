import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { ControlIndexEntry } from '@/lib/regulatory-library/queries'

type Client = SupabaseClient<Database>

export type Citation = {
  controlId: string
  frameworkCode: string
  frameworkName: string
  ref: string
  title: string
}

export type ToolActivity = {
  name: string
  input: Record<string, unknown>
  summary: string
}

/**
 * Tool definitions exposed to the model. Keep descriptions precise — they are
 * the model's only guide to when each tool is appropriate.
 */
export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_frameworks',
    description:
      'List every regulatory framework in the AETHER library with code, jurisdiction, regulator, control count and fidelity notes. Call this first when the user asks what is covered, or when you need a framework code for other tools.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_framework',
    description:
      'Get one framework by code (e.g. "NCA-ECC", "SAMA-CSF", "KSA-PDPL", "ISO-27001", "NIST-CSF", "EU-AI-ACT", "UAE-IAS", "QA-NIA", "QCB-TRM", "CBJ-CSF"): description, version, mandatory status, and its domains with control counts.',
    input_schema: {
      type: 'object',
      properties: { code: { type: 'string', description: 'Framework code' } },
      required: ['code'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_controls',
    description:
      'Full-text search across control requirements in the library. Use for any question about what a regulation requires on a topic (e.g. "privileged access", "breach notification 72 hours", "cloud data residency", "third party contracts"). Returns control refs, titles, requirement text, evidence expectations, criticality and fidelity. Restrict by framework codes when the user names a regulator. Search in English; Arabic queries are also matched against Arabic text.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search terms (2–6 words work best)' },
        framework_codes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of framework codes to restrict the search',
        },
        limit: { type: 'integer', minimum: 1, maximum: 25, description: 'Max results (default 10)' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_control',
    description:
      'Fetch one control by framework code and exact control reference (e.g. framework_code "NCA-ECC", control_ref "2-2-3"; "ISO-27001" + "A.8.16"; "NIST-CSF" + "PR.AA-05"; "KSA-PDPL" + "Art. 20"). Use when the user cites a specific control ID.',
    input_schema: {
      type: 'object',
      properties: {
        framework_code: { type: 'string' },
        control_ref: { type: 'string' },
      },
      required: ['framework_code', 'control_ref'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_domain_controls',
    description:
      'List all controls within one domain of a framework (domain names come from get_framework). Use when the user wants the full set of requirements in an area, e.g. all NCA ECC "Cybersecurity Defense" controls.',
    input_schema: {
      type: 'object',
      properties: {
        framework_code: { type: 'string' },
        domain: { type: 'string', description: 'Domain name in English, as returned by get_framework' },
      },
      required: ['framework_code', 'domain'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_policies',
    description:
      "List the user's organization's saved policies (title, type, frameworks, status, mapped control count, last updated). Use when the user asks about their own policies or wants to check coverage.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_policy',
    description:
      "Fetch one of the organization's policies by id, including its full Markdown content (truncated if very long) and the library controls it maps to. Use to review, critique or gap-check a specific policy.",
    input_schema: {
      type: 'object',
      properties: { policy_id: { type: 'string' } },
      required: ['policy_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_programs',
    description:
      "List the organization's compliance programs (framework adopted, readiness %, implemented / in progress / not started / N/A counts, target date). Use when the user asks how ready they are, where gaps are, or about a specific program.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_audit_overview',
    description:
      "The organization's internal audit position: engagements with status, rating and progress; open observations by rating (with title, condition, cause and recommendation); management actions that are overdue or awaiting verification. Use for questions about audits, findings, audit reports, follow-up, or what the audit committee should see.",
    input_schema: {
      type: 'object',
      properties: {
        engagement_id: { type: 'string', description: 'Optional: restrict to one engagement id' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_erm_risks',
    description:
      "The organization's enterprise risk register: each risk with category, owner, inherent / residual / target scores (1–25), trend, appetite level and whether it breaches appetite, open and overdue treatments, KRI status. Also returns KRIs currently red or amber. Use for questions about top risks, appetite, heat map, KRIs, or board risk reporting.",
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Optional risk status filter, e.g. "open", "monitoring", "closed"' },
        min_residual_score: { type: 'number', description: 'Optional: only risks with residual score at or above this value' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_icfr_overview',
    description:
      "The organization's ICFR position: processes with control counts, key controls tested and effective, and the open deficiency log with severity (deficiency / significant_deficiency / material_weakness), remediation plan and due date. Use for SOX-style, COSO, financial-reporting control or deficiency questions.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
]

export type ToolContext = {
  supabase: Client
  /** Every control returned to the model during this turn, for citation resolution. */
  retrieved: Map<string, ControlIndexEntry>
}

type ControlRow = {
  id: string
  control_ref: string
  domain_en: string | null
  subdomain_en: string | null
  title_en: string
  title_ar: string | null
  requirement_en: string
  requirement_ar: string | null
  evidence_en: string | null
  control_type: string | null
  criticality: string | null
  fidelity: string
  verified: boolean
  frameworks: { code: string; short_name: string } | { code: string; short_name: string }[] | null
}

function fw(row: ControlRow): { code: string; short_name: string } {
  const f = Array.isArray(row.frameworks) ? row.frameworks[0] : row.frameworks
  return f ?? { code: '', short_name: '' }
}

function shapeControl(row: ControlRow, ctx: ToolContext) {
  const f = fw(row)
  ctx.retrieved.set(row.id, {
    id: row.id,
    frameworkCode: f.code,
    frameworkName: f.short_name,
    ref: row.control_ref,
    title: row.title_en,
    requirement: row.requirement_en,
  })
  return {
    framework: f.short_name,
    framework_code: f.code,
    ref: row.control_ref,
    cite_as: `${f.short_name} ${row.control_ref}`,
    domain: row.domain_en,
    subdomain: row.subdomain_en,
    title: row.title_en,
    title_ar: row.title_ar,
    requirement: row.requirement_en,
    requirement_ar: row.requirement_ar,
    evidence: row.evidence_en,
    control_type: row.control_type,
    criticality: row.criticality,
    fidelity: row.fidelity,
    verified: row.verified,
  }
}

const CONTROL_SELECT =
  'id, control_ref, domain_en, subdomain_en, title_en, title_ar, requirement_en, requirement_ar, evidence_en, control_type, criticality, fidelity, verified, frameworks!inner ( code, short_name )'

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .slice(0, 6)
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'what', 'does', 'require', 'requires',
  'required', 'requirement', 'requirements', 'must', 'should', 'about', 'from', 'into',
  'are', 'our', 'your', 'have', 'has', 'control', 'controls', 'policy', 'policies',
])

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<{ result: unknown; summary: string }> {
  const { supabase } = ctx

  switch (name) {
    case 'list_frameworks': {
      const { data, error } = await supabase
        .from('framework_summary')
        .select('code, short_name, name_en, jurisdiction, regulator_en, category, version, mandatory, control_count, domain_count, verified_count')
        .order('sort_order')
      if (error) return { result: { error: error.message }, summary: 'Failed to list frameworks' }
      return {
        result: {
          frameworks: data,
          note: 'fidelity/verified flags on individual controls indicate how closely text follows the primary source. QCB-TRM, CBJ-CSF, UAE-IAS and QA-NIA use thematic (not official) clause numbering.',
        },
        summary: `Listed ${data?.length ?? 0} frameworks`,
      }
    }

    case 'get_framework': {
      const code = String(input.code ?? '').toUpperCase()
      const { data: f, error } = await supabase
        .from('framework_summary')
        .select('*')
        .eq('code', code)
        .maybeSingle()
      if (error || !f) return { result: { error: `Framework ${code} not found` }, summary: `Framework ${code} not found` }
      const { data: controls } = await supabase
        .from('controls')
        .select('domain_en, domain_ar, subdomain_en')
        .eq('framework_id', f.id!)
        .order('sort_order')
      const domains = new Map<string, { domain_ar: string | null; subdomains: Set<string>; count: number }>()
      for (const c of controls ?? []) {
        const key = c.domain_en ?? 'General'
        if (!domains.has(key)) domains.set(key, { domain_ar: c.domain_ar, subdomains: new Set(), count: 0 })
        const d = domains.get(key)!
        d.count += 1
        if (c.subdomain_en) d.subdomains.add(c.subdomain_en)
      }
      return {
        result: {
          ...f,
          domains: [...domains.entries()].map(([name, d]) => ({
            domain: name,
            domain_ar: d.domain_ar,
            control_count: d.count,
            subdomains: [...d.subdomains],
          })),
        },
        summary: `Loaded ${f.short_name} (${f.control_count} controls)`,
      }
    }

    case 'search_controls': {
      const query = String(input.query ?? '').trim()
      const codes = Array.isArray(input.framework_codes)
        ? (input.framework_codes as unknown[]).map((c) => String(c).toUpperCase())
        : []
      const limit = Math.min(Math.max(Number(input.limit ?? 10), 1), 25)
      const terms = tokenize(query)

      // Builders mutate in place, so create a fresh one per attempt.
      const base = () => {
        let q = supabase.from('controls').select(CONTROL_SELECT).limit(limit)
        if (codes.length > 0) q = q.in('frameworks.code', codes)
        return q
      }

      // AND across terms; fall back to OR when AND finds nothing.
      let rows: ControlRow[] = []
      if (terms.length > 0) {
        let andQ = base()
        for (const t of terms) andQ = andQ.ilike('search_text', `%${t}%`)
        const { data } = await andQ
        rows = (data ?? []) as unknown as ControlRow[]
        if (rows.length === 0 && terms.length > 1) {
          const { data: orData } = await base().or(
            terms.map((t) => `search_text.ilike.%${t}%`).join(',')
          )
          rows = (orData ?? []) as unknown as ControlRow[]
        }
      } else if (query) {
        const { data } = await base().ilike('search_text', `%${query}%`)
        rows = (data ?? []) as unknown as ControlRow[]
      }

      const shaped = rows.map((r) => shapeControl(r, ctx))
      const scope = codes.length > 0 ? ` in ${codes.join(', ')}` : ''
      return {
        result: { query, matched_terms: terms, results: shaped },
        summary: `Searched "${query}"${scope} — ${shaped.length} result${shaped.length === 1 ? '' : 's'}`,
      }
    }

    case 'get_control': {
      const code = String(input.framework_code ?? '').toUpperCase()
      const ref = String(input.control_ref ?? '').trim()
      const { data } = await supabase
        .from('controls')
        .select(CONTROL_SELECT)
        .eq('frameworks.code', code)
        .eq('control_ref', ref)
        .maybeSingle()
      if (!data) return { result: { error: `Control ${code} ${ref} not found` }, summary: `${code} ${ref} not found` }
      const shaped = shapeControl(data as unknown as ControlRow, ctx)
      return { result: shaped, summary: `Loaded ${shaped.cite_as}` }
    }

    case 'list_domain_controls': {
      const code = String(input.framework_code ?? '').toUpperCase()
      const domain = String(input.domain ?? '').trim()
      const { data } = await supabase
        .from('controls')
        .select(CONTROL_SELECT)
        .eq('frameworks.code', code)
        .ilike('domain_en', `%${domain}%`)
        .order('sort_order')
        .limit(60)
      const shaped = ((data ?? []) as unknown as ControlRow[]).map((r) => shapeControl(r, ctx))
      return {
        result: { framework_code: code, domain, controls: shaped },
        summary: `Listed ${shaped.length} controls in ${code} / ${domain}`,
      }
    }

    case 'list_policies': {
      const { data, error } = await supabase
        .from('policies')
        .select('id, title, policy_type, frameworks, status, version, updated_at, policy_control_mappings ( control_id )')
        .order('updated_at', { ascending: false })
        .limit(50)
      if (error) return { result: { error: error.message }, summary: 'Failed to list policies' }
      const policies = (data ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        policy_type: p.policy_type,
        frameworks: p.frameworks,
        status: p.status,
        version: p.version,
        updated_at: p.updated_at,
        mapped_controls: Array.isArray(p.policy_control_mappings) ? p.policy_control_mappings.length : 0,
      }))
      return { result: { policies }, summary: `Listed ${policies.length} saved polic${policies.length === 1 ? 'y' : 'ies'}` }
    }

    case 'get_policy': {
      const id = String(input.policy_id ?? '')
      const { data: p } = await supabase.from('policies').select('*').eq('id', id).maybeSingle()
      if (!p) return { result: { error: 'Policy not found' }, summary: 'Policy not found' }
      const { data: mappings } = await supabase
        .from('policy_control_mappings')
        .select('controls ( id, control_ref, title_en, requirement_en, frameworks ( code, short_name ) )')
        .eq('policy_id', p.id)
      const mapped = (mappings ?? []).flatMap((m) => {
        const c = Array.isArray(m.controls) ? m.controls[0] : m.controls
        if (!c) return []
        const f = Array.isArray(c.frameworks) ? c.frameworks[0] : c.frameworks
        ctx.retrieved.set(c.id, {
          id: c.id,
          frameworkCode: f?.code ?? '',
          frameworkName: f?.short_name ?? '',
          ref: c.control_ref,
          title: c.title_en,
          requirement: c.requirement_en,
        })
        return [{ cite_as: `${f?.short_name ?? ''} ${c.control_ref}`, title: c.title_en }]
      })
      const MAX = 14000
      const content = p.content_md.length > MAX ? `${p.content_md.slice(0, MAX)}\n\n[… truncated ${p.content_md.length - MAX} characters]` : p.content_md
      return {
        result: {
          id: p.id,
          title: p.title,
          policy_type: p.policy_type,
          frameworks: p.frameworks,
          status: p.status,
          version: p.version,
          org_context: p.org_context,
          mapped_controls: mapped,
          content_markdown: content,
        },
        summary: `Loaded policy "${p.title}"`,
      }
    }

    case 'list_programs': {
      const { data, error } = await supabase
        .from('program_summary')
        .select('id, name, status, framework_code, framework_short_name, framework_jurisdiction, readiness_pct, total_controls, implemented, in_progress, not_started, not_applicable, target_date, updated_at')
        .order('updated_at', { ascending: false })
      if (error) return { result: { error: error.message }, summary: 'Failed to list programs' }
      return { result: { programs: data ?? [] }, summary: `Listed ${data?.length ?? 0} program${data?.length === 1 ? '' : 's'}` }
    }

    case 'get_audit_overview': {
      const engagementId = input.engagement_id ? String(input.engagement_id) : null
      let engQ = supabase
        .from('audit_engagement_summary')
        .select('id, code, title, type, status, universe_name, overall_rating, opinion, start_date, fieldwork_start, fieldwork_end, report_target_date, report_issued_at, procedures_total, procedures_complete, workpapers_total, workpapers_reviewed, observations_total, observations_critical, observations_high, observations_medium, observations_low, open_actions, overdue_actions, executive_summary')
        .order('start_date', { ascending: false })
        .limit(40)
      if (engagementId) engQ = engQ.eq('id', engagementId)
      const { data: engagements, error: e1 } = await engQ
      if (e1) return { result: { error: e1.message }, summary: 'Failed to load engagements' }

      let obsQ = supabase
        .from('audit_observations')
        .select('id, engagement_id, ref, title, rating, category, status, repeat_finding, agreed, condition, criteria, cause, effect, recommendation, management_response, issued_at')
        .neq('status', 'closed')
        .order('rating')
        .limit(60)
      if (engagementId) obsQ = obsQ.eq('engagement_id', engagementId)
      const { data: observations } = await obsQ

      let actQ = supabase
        .from('audit_action_register')
        .select('id, engagement_code, observation_ref, observation_rating, description, status, effective_due_date, is_overdue, days_past_due, extension_count')
        .in('status', ['open', 'in_progress', 'implemented', 'overdue'])
        .order('is_overdue', { ascending: false })
        .limit(60)
      if (engagementId) actQ = actQ.eq('engagement_id', engagementId)
      const { data: actions } = await actQ

      const overdue = (actions ?? []).filter((a) => a.is_overdue).length
      const critical = (observations ?? []).filter((o) => o.rating === 'critical').length
      return {
        result: {
          engagements: engagements ?? [],
          open_observations: observations ?? [],
          management_actions: actions ?? [],
          totals: { engagements: engagements?.length ?? 0, open_observations: observations?.length ?? 0, critical_observations: critical, overdue_actions: overdue },
        },
        summary: `Loaded ${engagements?.length ?? 0} engagement${engagements?.length === 1 ? '' : 's'}, ${observations?.length ?? 0} open observation${observations?.length === 1 ? '' : 's'}, ${overdue} overdue action${overdue === 1 ? '' : 's'}`,
      }
    }

    case 'list_erm_risks': {
      let q = supabase
        .from('erm_risk_summary')
        .select('id, code, title, description, category_code, category_name_en, parent_category_name_en, owner_name, status, emerging, inherent_score, residual_score, target_score, residual_likelihood, residual_impact, velocity, trend, appetite_level, tolerance_threshold, appetite_breach, control_count, open_treatments, overdue_treatments, kri_count, kri_status, last_assessed_at, next_review_at')
        .order('residual_score', { ascending: false, nullsFirst: false })
        .limit(80)
      if (input.status) q = q.eq('status', String(input.status))
      if (typeof input.min_residual_score === 'number') q = q.gte('residual_score', input.min_residual_score)
      const { data: risks, error } = await q
      if (error) return { result: { error: error.message }, summary: 'Failed to load risk register' }
      const { data: kris } = await supabase
        .from('erm_kri_status')
        .select('id, risk_id, name, unit, direction, latest_period, latest_value, green_threshold, amber_threshold, red_threshold, status')
        .in('status', ['red', 'amber'])
        .limit(40)
      const breaches = (risks ?? []).filter((r) => r.appetite_breach).length
      return {
        result: {
          risks: risks ?? [],
          kris_red_or_amber: kris ?? [],
          totals: { risks: risks?.length ?? 0, outside_appetite: breaches, kris_alerting: kris?.length ?? 0 },
          scoring_note: 'Scores are likelihood × impact on 1–5 scales (1–25). Bands: low 1–4, moderate 5–9, high 10–15, extreme 16–25.',
        },
        summary: `Loaded ${risks?.length ?? 0} risk${risks?.length === 1 ? '' : 's'}, ${breaches} outside appetite`,
      }
    }

    case 'get_icfr_overview': {
      const { data: processes, error } = await supabase
        .from('icfr_process_summary')
        .select('id, code, name, cycle, status, risk_count, control_count, key_control_count, tested_key_controls, effective_key_controls, open_deficiencies, material_weaknesses')
        .order('code')
      if (error) return { result: { error: error.message }, summary: 'Failed to load ICFR processes' }
      const { data: deficiencies } = await supabase
        .from('icfr_deficiencies')
        .select('id, control_id, severity, status, description, root_cause, remediation_plan, due_date, identified_at, retest_result, icfr_controls ( ref, title, process_id )')
        .neq('status', 'closed')
        .order('severity')
        .limit(60)
      const mw = (deficiencies ?? []).filter((d) => d.severity === 'material_weakness').length
      return {
        result: { processes: processes ?? [], open_deficiencies: deficiencies ?? [], totals: { processes: processes?.length ?? 0, open_deficiencies: deficiencies?.length ?? 0, material_weaknesses: mw } },
        summary: `Loaded ${processes?.length ?? 0} ICFR process${processes?.length === 1 ? '' : 'es'}, ${deficiencies?.length ?? 0} open deficienc${deficiencies?.length === 1 ? 'y' : 'ies'}`,
      }
    }

    default:
      return { result: { error: `Unknown tool ${name}` }, summary: `Unknown tool ${name}` }
  }
}
