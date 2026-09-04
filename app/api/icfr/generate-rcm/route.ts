import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODELS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import {
  ASSERTIONS,
  CONTROL_TYPES,
  COSO_COMPONENTS,
  FREQUENCIES,
  LEVELS,
  NATURES,
  isOneOf,
} from '@/lib/icfr/constants'
import type { GeneratedControl, GeneratedRisk } from '@/lib/actions/icfr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const SYSTEM_PROMPT = `You are a Big-Four-trained ICFR / SOX 404 specialist designing risk and control matrices (RCMs) for GCC enterprises, including CMA-listed Saudi companies reporting under IFRS as endorsed by SOCPA. You apply COSO 2013 and PCAOB AS 2201 vocabulary precisely: financial statement assertions, preventive vs detective, manual / automated / IT-dependent manual, key vs non-key, entity-level / process-level / ITGC. Control descriptions state WHO performs WHAT, HOW OFTEN, using WHICH evidence, with thresholds where relevant, and WHO reviews.

You respond with a single JSON object only. No prose, no Markdown fences.`

type GenerateRequest = {
  processName?: string
  cycle?: string
  description?: string
  industry?: string
}

function buildPrompt(req: Required<Pick<GenerateRequest, 'processName'>> & GenerateRequest) {
  return `Design an RCM for the following process.

Process name: ${req.processName}
Cycle: ${req.cycle?.trim() || 'not specified'}
Industry / context: ${req.industry?.trim() || 'GCC enterprise'}
Description: ${req.description?.trim() || 'not provided'}

Produce 5 to 8 "what could go wrong" risks and 8 to 14 controls. Every risk must be addressed by at least one control and every control must link to at least one risk. Mark 50-70% of controls as key. Include at least one fraud risk where relevant. Use realistic SAR thresholds where appropriate.

Return exactly this JSON shape:
{
  "risks": [
    { "ref": "R1", "title": "<risk statement>", "assertions": ["<assertion>", ...], "fraud_risk": false }
  ],
  "controls": [
    {
      "ref": "C1",
      "title": "<short control title>",
      "description": "<2-4 sentence control description>",
      "control_type": "preventive" | "detective",
      "nature": "manual" | "automated" | "it_dependent",
      "frequency": "multiple_daily" | "daily" | "weekly" | "monthly" | "quarterly" | "annually" | "event_driven",
      "is_key": true | false,
      "level": "entity" | "process" | "itgc",
      "coso_component": "control_environment" | "risk_assessment" | "control_activities" | "information_communication" | "monitoring",
      "linked_risk_refs": ["R1", ...]
    }
  ]
}

Allowed assertion values: ${ASSERTIONS.join(', ')}.
Refs must be sequential: R1..Rn for risks, C1..Cn for controls.`
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1))
    }
    throw new Error('Model did not return JSON')
  }
}

function validate(payload: unknown): { risks: GeneratedRisk[]; controls: GeneratedControl[] } {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid RCM payload')
  const obj = payload as { risks?: unknown; controls?: unknown }
  if (!Array.isArray(obj.risks) || !Array.isArray(obj.controls)) {
    throw new Error('RCM payload must contain risks[] and controls[]')
  }

  const risks: GeneratedRisk[] = obj.risks.map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>
    const ref = typeof r.ref === 'string' && r.ref.trim() ? r.ref.trim() : `R${i + 1}`
    const title = typeof r.title === 'string' ? r.title.trim() : ''
    if (!title) throw new Error(`Risk ${ref} is missing a title`)
    const assertions = Array.isArray(r.assertions)
      ? r.assertions.filter((a): a is string => isOneOf(ASSERTIONS, a))
      : []
    if (assertions.length === 0) throw new Error(`Risk ${ref} has no valid assertions`)
    return { ref, title, assertions, fraud_risk: Boolean(r.fraud_risk) }
  })

  const riskRefs = new Set(risks.map((r) => r.ref))
  if (riskRefs.size !== risks.length) throw new Error('Duplicate risk references')

  const controls: GeneratedControl[] = obj.controls.map((raw, i) => {
    const c = (raw ?? {}) as Record<string, unknown>
    const ref = typeof c.ref === 'string' && c.ref.trim() ? c.ref.trim() : `C${i + 1}`
    const title = typeof c.title === 'string' ? c.title.trim() : ''
    const description = typeof c.description === 'string' ? c.description.trim() : ''
    if (!title) throw new Error(`Control ${ref} is missing a title`)
    if (!isOneOf(CONTROL_TYPES, c.control_type)) throw new Error(`Control ${ref}: invalid control_type`)
    if (!isOneOf(NATURES, c.nature)) throw new Error(`Control ${ref}: invalid nature`)
    if (!isOneOf(FREQUENCIES, c.frequency)) throw new Error(`Control ${ref}: invalid frequency`)
    if (!isOneOf(LEVELS, c.level)) throw new Error(`Control ${ref}: invalid level`)
    if (!isOneOf(COSO_COMPONENTS, c.coso_component)) throw new Error(`Control ${ref}: invalid coso_component`)
    const linked = Array.isArray(c.linked_risk_refs)
      ? c.linked_risk_refs.filter((x): x is string => typeof x === 'string' && riskRefs.has(x))
      : []
    return {
      ref,
      title,
      description,
      control_type: c.control_type,
      nature: c.nature,
      frequency: c.frequency,
      is_key: Boolean(c.is_key),
      level: c.level,
      coso_component: c.coso_component,
      linked_risk_refs: linked,
    }
  })

  const controlRefs = new Set(controls.map((c) => c.ref))
  if (controlRefs.size !== controls.length) throw new Error('Duplicate control references')
  if (risks.length === 0 || controls.length === 0) throw new Error('Generated RCM is empty')

  return { risks, controls }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) return 'Anthropic API authentication failed. Check ANTHROPIC_API_KEY.'
    if (error.status === 429) return 'Rate limit exceeded. Please try again in a moment.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred while generating the RCM.'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: GenerateRequest
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const processName = body.processName?.trim()
  if (!processName) {
    return Response.json({ error: 'processName is required' }, { status: 400 })
  }

  try {
    const message = await anthropic.messages.create({
      model: MODELS.SONNET,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt({ ...body, processName }) }],
    })
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    const validated = validate(extractJson(text))
    return Response.json(validated)
  } catch (error) {
    console.error('[icfr/generate-rcm]', error)
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
