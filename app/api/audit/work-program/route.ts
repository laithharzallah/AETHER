import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODELS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import {
  ENGAGEMENT_TYPE_LABEL,
  UNIVERSE_TYPE_LABEL,
  type EngagementType,
  type UniverseType,
} from '@/lib/audit/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Render/nginx may buffer until ~4KB; pad early so tokens stream to the browser.
const STREAM_PAD = '<!-- stream-pad -->\n'.repeat(180)

const SYSTEM_PROMPT = `You are a Big-Four-trained internal audit manager writing risk-based engagement work programs for GCC enterprises, including CMA-listed Saudi companies and SAMA-regulated financial institutions.

You apply the IIA Global Internal Audit Standards (2024) precisely: engagement objectives and scope (Standard 13.2 and 13.3), engagement risk assessment (13.2), and the engagement work program (13.4). Procedures state the test approach (inquiry, observation, inspection, re-performance, data analytics, confirmation), the population and the sample basis, and the evidence to retain in the workpaper. You quantify sample sizes and name the systems, reports and documents an auditor would actually request.

You never write filler such as "review relevant documentation". Every step is executable by a senior auditor without further instruction. Output clean Markdown.`

function getErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) return 'Anthropic API authentication failed. Check ANTHROPIC_API_KEY.'
    if (error.status === 429) return 'Rate limit exceeded. Please try again in a moment.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred while drafting the work program.'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { engagementId?: string; focus?: string; procedureCount?: number }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const engagementId = body.engagementId?.trim()
  if (!engagementId) return Response.json({ error: 'engagementId is required' }, { status: 400 })
  const focus = (body.focus ?? '').trim().slice(0, 2000)
  const count = Math.min(Math.max(Number(body.procedureCount) || 12, 6), 24)

  const { data: engagement, error } = await supabase
    .from('audit_engagements')
    .select(
      '*, audit_universe ( code, name, type, description, risk_score, inherent_risk, control_environment, regulatory_exposure, financial_materiality, change_velocity, prior_findings )'
    )
    .eq('id', engagementId)
    .maybeSingle()

  if (error) console.error('[audit/work-program] engagement', error)
  if (!engagement) return Response.json({ error: 'Engagement not found' }, { status: 404 })

  const universe = Array.isArray(engagement.audit_universe)
    ? engagement.audit_universe[0]
    : engagement.audit_universe

  const [{ data: existingProcedures }, { data: priorObservations }] = await Promise.all([
    supabase
      .from('audit_procedures')
      .select('ref, area, objective')
      .eq('engagement_id', engagementId)
      .order('sort_order'),
    engagement.universe_id
      ? supabase
          .from('audit_observations')
          .select('ref, title, rating, cause, audit_engagements!inner ( universe_id )')
          .eq('audit_engagements.universe_id', engagement.universe_id)
          .in('rating', ['critical', 'high'])
          .limit(12)
      : Promise.resolve({ data: [] as { ref: string; title: string; rating: string; cause: string | null }[] }),
  ])

  const userPrompt = `Draft a risk-based internal audit work program for the engagement below.

## Engagement
Code: ${engagement.code}
Title: ${engagement.title}
Type: ${ENGAGEMENT_TYPE_LABEL[engagement.type as EngagementType] ?? engagement.type}
Auditable entity: ${universe ? `${universe.code} — ${universe.name} (${UNIVERSE_TYPE_LABEL[universe.type as UniverseType] ?? universe.type})` : 'not linked to the audit universe'}
Entity description: ${universe?.description ?? 'not documented'}
${
  universe
    ? `Risk score: ${universe.risk_score}/100 (inherent ${universe.inherent_risk}/5, control environment ${universe.control_environment}/5, regulatory exposure ${universe.regulatory_exposure}/5, financial materiality ${universe.financial_materiality}/5, change velocity ${universe.change_velocity}/5, prior findings ${universe.prior_findings}/5)`
    : ''
}
Stated objective: ${engagement.objective ?? 'not yet documented — propose one'}
Stated scope: ${engagement.scope ?? 'not yet documented — propose one'}
Explicitly out of scope: ${engagement.out_of_scope ?? 'not stated'}
Criteria / frameworks: ${engagement.criteria ?? 'not stated — propose the policies, regulations and standards this engagement should be measured against'}
Fieldwork window: ${engagement.fieldwork_start ?? 'TBC'} to ${engagement.fieldwork_end ?? 'TBC'}
Budget: ${engagement.budget_days ?? 'not set'} days

${
  (existingProcedures ?? []).length > 0
    ? `## Procedures already in the work program (do not repeat these)\n${(existingProcedures ?? [])
        .map((p) => `- ${p.ref} [${p.area ?? 'general'}] ${p.objective ?? ''}`)
        .join('\n')}`
    : '## Procedures already in the work program\n(none — this is the first draft)'
}

${
  (priorObservations ?? []).length > 0
    ? `## Prior high and critical findings on this entity — design procedures that re-test these areas\n${(priorObservations ?? [])
        .map((o) => `- ${o.ref} (${o.rating}): ${o.title}${o.cause ? ` — root cause: ${o.cause}` : ''}`)
        .join('\n')}`
    : ''
}

${focus ? `## Additional direction from the engagement lead\n${focus}` : ''}

## Required output (Markdown)

### 1. Engagement objective
One or two sentences stating what assurance this engagement will provide and to whom.

### 2. Scope
State the period covered, the entities, locations, systems and processes in scope, and what is explicitly excluded with the reason.

### 3. Criteria
The specific policies, regulations, contracts and frameworks the condition will be measured against. Cite Saudi requirements by name where relevant (CMA Corporate Governance Regulations, SAMA circulars, ZATCA e-invoicing, Saudi Labour Law, NCA ECC, PDPL) and only where genuinely applicable.

### 4. Engagement risk assessment
A table with columns | # | Risk (what could go wrong) | Impact | Likelihood | Expected key control |. Include 6 to 9 risks specific to this area, including at least one fraud risk.

### 5. Work program
Exactly ${count} numbered procedures. For each, use this structure:

**P-nn — [short title]**
- **Area:** the sub-process or domain
- **Risk addressed:** the risk number(s) from section 4
- **Objective:** what this step is designed to establish
- **Test approach:** the specific technique and the exact steps, naming the reports, systems and documents to obtain
- **Population and sample basis:** how the population is defined and validated for completeness, the sample size with the rationale (statistical, monetary-unit, value-stratified, judgemental, or 100% analytics), and the selection method
- **Evidence to obtain:** what is retained in the workpaper

Weight the number of procedures towards the highest-rated risks. Include at least two data-analytics procedures run over the full population and at least one procedure testing segregation of duties.

### 6. Wrap-up
Two or three steps covering exception evaluation, discussion of preliminary findings with the auditee, and workpaper review and sign-off.

Be specific to this engagement. Do not produce generic text.`

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
          console.error('[audit/work-program] stream', err)
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
    console.error('[audit/work-program]', err)
    return Response.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
