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

    default:
      return { result: { error: `Unknown tool ${name}` }, summary: `Unknown tool ${name}` }
  }
}
