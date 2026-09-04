import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODELS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import {
  ENGAGEMENT_TYPE_LABEL,
  OBSERVATION_CATEGORY_LABEL,
  OVERALL_RATING_DEFINITION,
  OVERALL_RATINGS,
  type EngagementType,
  type ObservationCategory,
} from '@/lib/audit/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Render/nginx may buffer until ~4KB; pad early so tokens stream to the browser.
const STREAM_PAD = '<!-- stream-pad -->\n'.repeat(180)

const SYSTEM_PROMPT = `You are a Big-Four-trained internal audit manager drafting engagement reports for the audit committee of a GCC enterprise, including CMA-listed Saudi companies and SAMA-regulated financial institutions.

You follow the IIA Global Internal Audit Standards (2024), Standard 15.1 (communicating engagement results): the report is accurate, objective, clear, concise, constructive, complete and timely. The executive summary is written for a non-executive audit committee member who will read nothing else: it states the conclusion first, then what drove it. Observations are presented as condition, criteria, cause and effect with the management response and the agreed action owner and date. You never soften an unsatisfactory conclusion and you never introduce a finding that is not in the data supplied.

Output clean Markdown. Do not use first person. Write in British English.`

function getErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) return 'Anthropic API authentication failed. Check ANTHROPIC_API_KEY.'
    if (error.status === 429) return 'Rate limit exceeded. Please try again in a moment.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred while drafting the report.'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { engagementId?: string; scopeLimitations?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const engagementId = body.engagementId?.trim()
  if (!engagementId) return Response.json({ error: 'engagementId is required' }, { status: 400 })
  const scopeLimitations = (body.scopeLimitations ?? '').trim().slice(0, 4000)

  const { data: engagement, error } = await supabase
    .from('audit_engagements')
    .select('*, audit_universe ( code, name, type, description )')
    .eq('id', engagementId)
    .maybeSingle()
  if (error) console.error('[audit/report] engagement', error)
  if (!engagement) return Response.json({ error: 'Engagement not found' }, { status: 404 })

  const [obsRes, procRes, wpRes, membersRes] = await Promise.all([
    supabase
      .from('audit_observations')
      .select('*, audit_actions ( description, owner_id, due_date, revised_due_date, status )')
      .eq('engagement_id', engagementId)
      .order('ref'),
    supabase
      .from('audit_procedures')
      .select('ref, area, objective, status, conclusion')
      .eq('engagement_id', engagementId)
      .order('sort_order'),
    supabase
      .from('audit_workpapers')
      .select('ref, review_status')
      .eq('engagement_id', engagementId),
    supabase.from('profiles').select('id, full_name, email'),
  ])

  const observations = obsRes.data ?? []
  const procedures = procRes.data ?? []
  const workpapers = wpRes.data ?? []
  const nameById = new Map(
    (membersRes.data ?? []).map((p) => [p.id, p.full_name || p.email || 'Unassigned'])
  )

  if (observations.length === 0 && procedures.length === 0) {
    return Response.json(
      { error: 'Add procedures and observations before drafting the report.' },
      { status: 400 }
    )
  }

  const universe = Array.isArray(engagement.audit_universe)
    ? engagement.audit_universe[0]
    : engagement.audit_universe

  const ratingOrder = ['critical', 'high', 'medium', 'low']
  const sorted = [...observations].sort(
    (a, b) => ratingOrder.indexOf(a.rating) - ratingOrder.indexOf(b.rating)
  )
  const counts = ratingOrder.map(
    (r) => `${r}: ${observations.filter((o) => o.rating === r).length}`
  )

  const observationBlock = sorted
    .map((o) => {
      const actions = (Array.isArray(o.audit_actions) ? o.audit_actions : [])
        .filter((a) => a.status !== 'cancelled')
        .map(
          (a) =>
            `    - ${a.description} | Owner: ${a.owner_id ? nameById.get(a.owner_id) ?? 'Unassigned' : 'Unassigned'} | Due: ${a.revised_due_date ?? a.due_date ?? 'not agreed'} | Status: ${a.status}`
        )
        .join('\n')
      return `### ${o.ref} — ${o.title}
- Rating: ${o.rating}
- Category: ${OBSERVATION_CATEGORY_LABEL[o.category as ObservationCategory] ?? o.category}
- Repeat finding: ${o.repeat_finding ? 'Yes — raised in a previous engagement' : 'No'}
- Condition: ${o.condition ?? 'NOT DOCUMENTED'}
- Criteria: ${o.criteria ?? 'NOT DOCUMENTED'}
- Cause: ${o.cause ?? 'NOT DOCUMENTED'}
- Effect: ${o.effect ?? 'NOT DOCUMENTED'}
- Recommendation: ${o.recommendation ?? 'NOT DOCUMENTED'}
- Management response: ${o.management_response ?? 'NOT YET RECEIVED'}
- Management agreed: ${o.agreed === null ? 'not recorded' : o.agreed ? 'Yes' : 'No — see response'}
- Agreed actions:
${actions || '    - (none recorded)'}`
    })
    .join('\n\n')

  const areas = Array.from(new Set(procedures.map((p) => p.area).filter(Boolean)))
  const notApplicable = procedures.filter((p) => p.status === 'not_applicable')
  const incomplete = procedures.filter(
    (p) => p.status !== 'complete' && p.status !== 'not_applicable'
  )

  const userPrompt = `Draft the internal audit engagement report from the engagement record below. Use only the facts supplied.

## Engagement
Code: ${engagement.code}
Title: ${engagement.title}
Type: ${ENGAGEMENT_TYPE_LABEL[engagement.type as EngagementType] ?? engagement.type}
Auditable entity: ${universe ? `${universe.code} — ${universe.name}` : 'not linked to the audit universe'}
Objective: ${engagement.objective ?? 'NOT DOCUMENTED'}
Scope: ${engagement.scope ?? 'NOT DOCUMENTED'}
Out of scope: ${engagement.out_of_scope ?? 'not stated'}
Criteria: ${engagement.criteria ?? 'not stated'}
Fieldwork: ${engagement.fieldwork_start ?? 'TBC'} to ${engagement.fieldwork_end ?? 'TBC'}
Lead auditor: ${engagement.lead_auditor_id ? nameById.get(engagement.lead_auditor_id) ?? 'Unassigned' : 'Unassigned'}
Auditee owner: ${engagement.auditee_owner_id ? nameById.get(engagement.auditee_owner_id) ?? 'Unassigned' : 'Unassigned'}
Budget days: ${engagement.budget_days ?? 'not set'} | Actual days: ${engagement.actual_days ?? 'not recorded'}
Overall rating concluded by the engagement lead: ${engagement.overall_rating ?? 'NOT YET CONCLUDED'}
${
  engagement.overall_rating
    ? `Definition of that rating: ${OVERALL_RATING_DEFINITION[engagement.overall_rating as (typeof OVERALL_RATINGS)[number]] ?? ''}`
    : `Available ratings: ${OVERALL_RATINGS.map((r) => `${r} — ${OVERALL_RATING_DEFINITION[r]}`).join(' / ')}`
}
Draft executive summary supplied by the lead: ${engagement.executive_summary ?? 'none — draft one'}
Draft opinion supplied by the lead: ${engagement.opinion ?? 'none — draft one'}

## Work performed
Procedures: ${procedures.length} (${procedures.filter((p) => p.status === 'complete').length} complete, ${notApplicable.length} not applicable, ${incomplete.length} not complete)
Areas covered: ${areas.join(', ') || 'not categorised'}
Workpapers: ${workpapers.length} (${workpapers.filter((w) => w.review_status === 'reviewed').length} reviewed and signed off)
Procedure conclusions:
${procedures
  .filter((p) => p.conclusion)
  .slice(0, 30)
  .map((p) => `- ${p.ref} [${p.area ?? 'general'}]: ${String(p.conclusion).slice(0, 400)}`)
  .join('\n') || '- (no procedure conclusions recorded)'}

## Observations (${observations.length}) — ${counts.join(', ')}
${observationBlock || '(no observations raised)'}

## Scope limitations reported by the team
${scopeLimitations || (incomplete.length ? `${incomplete.length} procedure(s) were not completed: ${incomplete.map((p) => p.ref).join(', ')}.` : 'None reported.')}

## Required report structure (Markdown)

# Internal Audit Report — ${engagement.title}
A header block giving the report reference, the auditable entity, the period covered, the fieldwork dates, the distribution list (Audit Committee, CEO, the auditee owner) and the overall rating.

## 1. Executive summary
Six to twelve sentences for the audit committee. Lead with the conclusion and the overall rating, then the two or three matters that drove it, then the number of observations by rating and whether any is a repeat finding. State clearly whether management has agreed the actions.

## 2. Objective and scope
The objective, the period and processes covered, the entities, locations and systems in scope, and what was excluded and why.

## 3. Approach
The methodology: risk assessment performed, the techniques applied (walkthroughs, sample testing, re-performance, data analytics), the population and sample basis at a summary level, and confirmation that the engagement was conducted in conformance with the IIA Global Internal Audit Standards. Reference the number of procedures and workpapers.

## 4. Overall conclusion
State the rating and justify it against the rating definition supplied. Where the lead has not concluded a rating, propose one and state the reasoning explicitly as a recommendation to the engagement lead.

## 5. Summary of observations
A Markdown table with columns | Ref | Observation | Rating | Category | Owner | Agreed due date | Status |, ordered critical first. Follow it with one short paragraph on themes and root causes across the observations.

## 6. Detailed observations
For each observation in rating order, a subsection with the four Cs under bold labels (Condition, Criteria, Cause, Effect), then Recommendation, then Management response, then a table of agreed actions with owner and due date. Mark any element recorded as NOT DOCUMENTED as an open drafting point in bold rather than inventing content.

## Appendix A — Scope limitations and restrictions on use
State any scope limitation, incomplete procedure or evidence not made available, and the effect on the conclusion. Close with the standard restriction that the report is prepared for the audit committee and management of the entity and is not intended for any other party.

Do not invent findings, figures, dates or names that are not in the data above.`

  try {
    const messageStream = anthropic.messages.stream({
      model: MODELS.SONNET,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(STREAM_PAD))
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode('\u200B'))
          } catch {
            clearInterval(heartbeat)
          }
        }, 3000)
        try {
          for await (const event of messageStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          controller.close()
        } catch (err) {
          console.error('[audit/report] stream', err)
          controller.enqueue(encoder.encode(`\n\n---\nError: ${getErrorMessage(err)}`))
          controller.close()
        } finally {
          clearInterval(heartbeat)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('[audit/report]', err)
    return Response.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
