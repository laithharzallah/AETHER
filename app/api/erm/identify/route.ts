import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODELS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { listCategories } from '@/lib/erm/queries'
import {
  IMPACT_SCALE,
  LIKELIHOOD_SCALE,
  TREATMENT_STRATEGIES,
  VELOCITY_SCALE,
  isOneOf,
} from '@/lib/erm/constants'
import type { CandidateRisk } from '@/lib/actions/erm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const SYSTEM_PROMPT = `You are a Big-Four-trained enterprise risk management specialist facilitating risk identification workshops for GCC organisations, including CMA-listed Saudi companies and SAMA-supervised financial institutions.

You apply ISO 31000:2018 and COSO ERM 2017 vocabulary precisely:
- Risk is the effect of uncertainty on objectives. Every risk you write is anchored to a stated objective.
- A risk statement is structured as risk source → event → consequence. Never a one-word hazard, never a restatement of a control gap, never a synonym for "bad thing happens".
- Inherent risk is assessed before the effect of controls. You are identifying risks, so score inherent, not residual.
- Risk velocity is the speed with which the consequence lands once the event occurs — it is independent of likelihood.
- Treatment options come from ISO 31000 §6.5.2: avoid the activity, take or increase the risk to pursue an opportunity, remove the risk source, change the likelihood, change the consequences, share the risk, retain the risk by informed decision.

You respond with a single JSON object only. No prose, no Markdown fences.`

type IdentifyRequest = {
  businessContext?: string
  sector?: string
  objectives?: string
  count?: number
}

function scaleBlock(
  title: string,
  scale: readonly { value: number; label: string; descriptor: string }[]
): string {
  return `${title}\n${scale.map((s) => `  ${s.value} = ${s.label} — ${s.descriptor}`).join('\n')}`
}

function buildPrompt(
  req: IdentifyRequest,
  categories: { code: string; name: string }[],
  count: number
): string {
  const catBlock = categories.length
    ? categories.map((c) => `  ${c.code} — ${c.name}`).join('\n')
    : '  (no taxonomy imported — set category_code to null)'

  return `Identify candidate enterprise risks for the following organisation.

Sector: ${req.sector?.trim() || 'not specified'}
Business context: ${req.businessContext?.trim() || 'not provided'}
Objectives the risks must be assessed against:
${req.objectives?.trim() || 'not provided — infer from the sector and context, and say so in the description'}

Produce ${count} candidate risks. Requirements:
- Spread them across the taxonomy; do not cluster in one domain.
- Each description must be a single flowing statement in the form "Risk source → event → consequence", written out in prose (for example: "Concentration of settlement processing on a single unsupported platform (source) may cause an extended outage during month-end (event), resulting in missed regulatory reporting deadlines and SAMA supervisory action (consequence).").
- Include at least one regulatory risk relevant to the Saudi or GCC environment and at least one emerging or slow-burn risk.
- Score inherent likelihood and impact on the 5×5 scales below, before controls.
- Suggest one to three treatments per risk, each naming the ISO 31000 option in the title.

${scaleBlock('Inherent likelihood scale (12-month horizon):', LIKELIHOOD_SCALE)}

${scaleBlock('Impact scale (worst credible single consequence):', IMPACT_SCALE)}

${scaleBlock('Velocity scale (speed to consequence):', VELOCITY_SCALE)}

Available risk categories (use the exact code, or null if none fits):
${catBlock}

Return exactly this JSON shape:
{
  "risks": [
    {
      "title": "<short risk title, no more than 12 words>",
      "description": "<source → event → consequence, 2-4 sentences>",
      "causes": "<the risk sources / drivers, one or two sentences>",
      "consequences": "<the consequences if untreated, one or two sentences>",
      "category_code": "<code from the list above, or null>",
      "inherent_likelihood": 1-5,
      "inherent_impact": 1-5,
      "velocity": 1-5,
      "treatments": [
        { "strategy": "mitigate" | "transfer" | "avoid" | "accept", "title": "<the treatment action>" }
      ]
    }
  ]
}`
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

function scale(value: unknown, field: string, index: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error(`Risk ${index + 1}: ${field} must be an integer from 1 to 5`)
  }
  return n
}

function validate(payload: unknown, validCodes: Set<string>): CandidateRisk[] {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid payload')
  const obj = payload as { risks?: unknown }
  if (!Array.isArray(obj.risks) || obj.risks.length === 0) {
    throw new Error('Payload must contain a non-empty risks[]')
  }

  return obj.risks.map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>
    const title = typeof r.title === 'string' ? r.title.trim() : ''
    const description = typeof r.description === 'string' ? r.description.trim() : ''
    if (!title) throw new Error(`Risk ${i + 1} is missing a title`)
    if (!description) throw new Error(`Risk ${i + 1} is missing a description`)

    const code =
      typeof r.category_code === 'string' && validCodes.has(r.category_code.trim())
        ? r.category_code.trim()
        : null

    const treatments = Array.isArray(r.treatments)
      ? r.treatments
          .map((t) => (t ?? {}) as Record<string, unknown>)
          .filter((t) => isOneOf(TREATMENT_STRATEGIES, t.strategy))
          .map((t) => ({
            strategy: t.strategy as string,
            title: typeof t.title === 'string' ? t.title.trim() : '',
          }))
          .filter((t) => t.title.length > 0)
          .slice(0, 3)
      : []

    return {
      title: title.slice(0, 300),
      description: description.slice(0, 4000),
      causes: typeof r.causes === 'string' ? r.causes.trim().slice(0, 2000) : null,
      consequences:
        typeof r.consequences === 'string' ? r.consequences.trim().slice(0, 2000) : null,
      category_code: code,
      inherent_likelihood: scale(r.inherent_likelihood, 'inherent_likelihood', i),
      inherent_impact: scale(r.inherent_impact, 'inherent_impact', i),
      velocity: scale(r.velocity, 'velocity', i),
      treatments,
    }
  })
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) return 'Anthropic API authentication failed. Check ANTHROPIC_API_KEY.'
    if (error.status === 429) return 'Rate limit exceeded. Please try again in a moment.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred while identifying risks.'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: IdentifyRequest
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const businessContext = body.businessContext?.trim()
  if (!businessContext) {
    return Response.json({ error: 'businessContext is required' }, { status: 400 })
  }

  const count = Math.min(Math.max(Number(body.count) || 8, 3), 15)
  const categories = await listCategories()
  const catOptions = categories.map((c) => ({ code: c.code, name: c.name_en }))
  const validCodes = new Set(categories.map((c) => c.code))

  try {
    const message = await anthropic.messages.create({
      model: MODELS.SONNET,
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildPrompt({ ...body, businessContext }, catOptions, count) },
      ],
    })
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    const risks = validate(extractJson(text), validCodes)
    return Response.json({ risks })
  } catch (error) {
    console.error('[erm/identify]', error)
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
