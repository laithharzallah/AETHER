import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODELS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import {
  OBSERVATION_CATEGORIES,
  OBSERVATION_RATINGS,
  OBSERVATION_RATING_DEFINITION,
  isOneOf,
  type ObservationCategory,
  type ObservationRating,
} from '@/lib/audit/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const SYSTEM_PROMPT = `You are a Big-Four-trained internal audit manager writing audit observations for GCC enterprises, including CMA-listed Saudi companies and SAMA-regulated financial institutions.

You write findings strictly using the four elements required by the IIA Global Internal Audit Standards (2024), Standard 14.1:
- CONDITION: what was found. Factual, quantified, with the population tested, the sample size and the number of exceptions. No opinion, no cause, no consequence.
- CRITERIA: what should be. The specific policy clause, regulation, contract term or control standard the condition is measured against. Cite the source by name.
- CAUSE: why it happened. The underlying reason — an absent control, an unclear responsibility, a system limitation, inadequate training, a capacity constraint. Never a restatement of the condition and never "the control was not performed".
- EFFECT: the actual or potential consequence, quantified in riyals, transaction volumes, regulatory exposure or reputational terms wherever the facts allow.

The recommendation addresses the CAUSE, not the symptom. It is specific, assignable to a role and achievable.

You respond with a single JSON object only. No prose, no Markdown fences.`

type ObservationDraft = {
  title: string
  condition: string
  criteria: string
  cause: string
  effect: string
  recommendation: string
  rating: ObservationRating
  rating_rationale: string
  category: ObservationCategory
  suggested_action: string
  library_control_ref: string | null
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

function requiredText(
  obj: Record<string, unknown>,
  key: string,
  label: string,
  minLength = 20
): string {
  const v = obj[key]
  const s = typeof v === 'string' ? v.trim() : ''
  if (s.length < minLength) {
    throw new Error(`The drafted observation has no usable ${label}.`)
  }
  return s.slice(0, 8000)
}

function validate(payload: unknown, allowedControlRefs: Set<string>): ObservationDraft {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid observation payload')
  const o = payload as Record<string, unknown>

  const rating = o.rating
  if (!isOneOf(OBSERVATION_RATINGS, rating)) {
    throw new Error('The drafted observation has an invalid rating.')
  }
  const category = isOneOf(OBSERVATION_CATEGORIES, o.category)
    ? o.category
    : 'control_operation'

  const title = typeof o.title === 'string' ? o.title.trim().slice(0, 300) : ''
  if (title.length < 8) throw new Error('The drafted observation has no usable title.')

  const rawRef = typeof o.library_control_ref === 'string' ? o.library_control_ref.trim() : ''
  const libraryControlRef =
    rawRef && allowedControlRefs.has(rawRef) ? rawRef : null

  return {
    title,
    condition: requiredText(o, 'condition', 'condition', 40),
    criteria: requiredText(o, 'criteria', 'criteria', 20),
    cause: requiredText(o, 'cause', 'cause', 20),
    effect: requiredText(o, 'effect', 'effect', 20),
    recommendation: requiredText(o, 'recommendation', 'recommendation', 20),
    rating,
    rating_rationale: requiredText(o, 'rating_rationale', 'rating rationale', 20),
    category,
    suggested_action: requiredText(o, 'suggested_action', 'suggested management action', 15),
    library_control_ref: libraryControlRef,
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) return 'Anthropic API authentication failed. Check ANTHROPIC_API_KEY.'
    if (error.status === 429) return 'Rate limit exceeded. Please try again in a moment.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred while drafting the observation.'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { engagementId?: string; notes?: string; procedureRef?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const engagementId = body.engagementId?.trim()
  const notes = (body.notes ?? '').trim()
  if (!engagementId) return Response.json({ error: 'engagementId is required' }, { status: 400 })
  if (notes.length < 20) {
    return Response.json(
      { error: 'Provide the fieldwork notes — what was tested, what was found and how many exceptions.' },
      { status: 400 }
    )
  }

  const { data: engagement, error } = await supabase
    .from('audit_engagements')
    .select('*, audit_universe ( code, name, type, description )')
    .eq('id', engagementId)
    .maybeSingle()
  if (error) console.error('[audit/observation] engagement', error)
  if (!engagement) return Response.json({ error: 'Engagement not found' }, { status: 404 })

  const universe = Array.isArray(engagement.audit_universe)
    ? engagement.audit_universe[0]
    : engagement.audit_universe

  // Candidate criteria from the regulatory control library. The model may cite
  // one of these by control_ref; anything else is discarded during validation.
  const searchTerms = [engagement.title, universe?.name, notes.slice(0, 200)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 4)
    .slice(0, 6)

  const controlQuery = supabase
    .from('controls')
    .select('control_ref, title_en, requirement_en, domain_en, frameworks:framework_id ( code, name_en )')
    .limit(40)
  const { data: controls } = searchTerms.length
    ? await controlQuery.or(
        searchTerms.map((t) => `search_text.ilike.%${t}%`).join(',')
      )
    : await controlQuery

  const controlRows = controls ?? []
  const allowedRefs = new Set(controlRows.map((c) => c.control_ref))

  const { data: procedures } = await supabase
    .from('audit_procedures')
    .select('ref, area, objective, procedure')
    .eq('engagement_id', engagementId)
    .order('sort_order')

  const procedureRef = body.procedureRef?.trim()
  const linkedProcedure = procedureRef
    ? (procedures ?? []).find((p) => p.ref === procedureRef)
    : null

  const userPrompt = `Write up the fieldwork notes below as a single formal audit observation.

## Engagement context
Code: ${engagement.code}
Title: ${engagement.title}
Auditable entity: ${universe ? `${universe.code} — ${universe.name}` : 'not linked'}
Objective: ${engagement.objective ?? 'not documented'}
Scope: ${engagement.scope ?? 'not documented'}
Criteria stated in the engagement plan: ${engagement.criteria ?? 'not stated'}

${
  linkedProcedure
    ? `## The procedure that raised this\n${linkedProcedure.ref} [${linkedProcedure.area ?? 'general'}]\nObjective: ${linkedProcedure.objective ?? 'not stated'}\nProcedure: ${linkedProcedure.procedure}`
    : `## Work program areas covered by this engagement\n${(procedures ?? [])
        .slice(0, 20)
        .map((p) => `- ${p.ref} [${p.area ?? 'general'}] ${p.objective ?? ''}`)
        .join('\n') || '(no procedures recorded)'}`
}

## Candidate criteria from the regulatory control library
Cite AT MOST ONE of these, by its exact control_ref, in "library_control_ref" — and only when the control genuinely governs the condition. Otherwise set it to null and state the criteria from the entity policy or the applicable law.
${
  controlRows.length
    ? controlRows
        .slice(0, 25)
        .map((c) => {
          const f = Array.isArray(c.frameworks) ? c.frameworks[0] : c.frameworks
          return `- ${c.control_ref} (${f?.code ?? 'library'}) ${c.title_en}: ${(c.requirement_en ?? '').slice(0, 220)}`
        })
        .join('\n')
    : '(no library controls matched this engagement)'
}

## Rating scale — apply it strictly
${OBSERVATION_RATINGS.map((r) => `- ${r}: ${OBSERVATION_RATING_DEFINITION[r]}`).join('\n')}

## Auditor fieldwork notes (rough)
${notes.slice(0, 12000)}

## Return exactly this JSON shape
{
  "title": "<short finding title, 6-14 words, states the weakness not the process>",
  "condition": "<what was found; quantified with population, sample size and exception count; factual only>",
  "criteria": "<the specific requirement, cited by name — policy clause, regulation, contract term or library control>",
  "cause": "<the underlying reason; not a restatement of the condition>",
  "effect": "<actual or potential consequence, quantified where the notes allow>",
  "recommendation": "<what management should do, addressing the cause; specific and assignable>",
  "rating": "critical" | "high" | "medium" | "low",
  "rating_rationale": "<one or two sentences justifying the rating against the scale above>",
  "category": ${OBSERVATION_CATEGORIES.map((c) => `"${c}"`).join(' | ')},
  "suggested_action": "<a single management action plan sentence starting with a verb>",
  "library_control_ref": "<exact control_ref from the list above, or null>"
}

Where the notes do not support a quantified effect, state the exposure qualitatively and say what management should quantify. Never invent figures that are not in the notes.`

  try {
    const message = await anthropic.messages.create({
      model: MODELS.SONNET,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const draft = validate(extractJson(text), allowedRefs)

    // Resolve the cited library control to its id so the client can link it.
    let libraryControl: { id: string; control_ref: string; title_en: string } | null = null
    if (draft.library_control_ref) {
      const { data: match } = await supabase
        .from('controls')
        .select('id, control_ref, title_en')
        .eq('control_ref', draft.library_control_ref)
        .limit(1)
        .maybeSingle()
      if (match) libraryControl = match
    }

    return Response.json({ ...draft, library_control: libraryControl })
  } catch (err) {
    console.error('[audit/observation]', err)
    return Response.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
