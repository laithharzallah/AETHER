import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODELS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import {
  CONTROL_TYPE_LABEL,
  COSO_LABEL,
  FREQUENCY_LABEL,
  LEVEL_LABEL,
  NATURE_LABEL,
  SAMPLE_SIZE_GUIDE,
  TEST_TYPES,
  isOneOf,
  type ControlType,
  type CosoComponent,
  type Frequency,
  type Level,
  type Nature,
} from '@/lib/icfr/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Render/nginx may buffer until ~4KB; pad early so tokens stream to the browser.
const STREAM_PAD = '<!-- stream-pad -->\n'.repeat(180)

const SYSTEM_PROMPT = `You are a Big-Four-trained ICFR / SOX 404 testing specialist. You write test of controls procedures that a staff auditor or internal control tester can execute and that will withstand external auditor and PCAOB-style review. You use precise COSO 2013 / AS 2201 vocabulary. Output clean Markdown.`

const SAMPLE_GUIDE_TEXT = Object.entries(SAMPLE_SIZE_GUIDE)
  .map(([f, g]) => `- ${FREQUENCY_LABEL[f as Frequency]}: ${g.min === g.max ? g.min : `${g.min}–${g.max}`}`)
  .join('\n')

function getErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) return 'Anthropic API authentication failed. Check ANTHROPIC_API_KEY.'
    if (error.status === 429) return 'Rate limit exceeded. Please try again in a moment.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred while drafting the test procedure.'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { controlId?: string; testType?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const controlId = body.controlId?.trim()
  const testType = isOneOf(TEST_TYPES, body.testType) ? body.testType : 'operating'
  if (!controlId) return Response.json({ error: 'controlId is required' }, { status: 400 })

  const { data: control, error } = await supabase
    .from('icfr_controls')
    .select(
      '*, icfr_processes ( code, name, cycle ), icfr_risk_controls ( icfr_risks ( ref, description, assertions ) )'
    )
    .eq('id', controlId)
    .maybeSingle()

  if (error) console.error('[icfr/test-procedure] control', error)
  if (!control) return Response.json({ error: 'Control not found' }, { status: 404 })

  const process = Array.isArray(control.icfr_processes)
    ? control.icfr_processes[0]
    : control.icfr_processes
  const risks = (control.icfr_risk_controls ?? []).flatMap((rc) => {
    const r = Array.isArray(rc.icfr_risks) ? rc.icfr_risks[0] : rc.icfr_risks
    return r ? [r] : []
  })

  const guide = SAMPLE_SIZE_GUIDE[control.frequency as Frequency]
  const userPrompt = `Draft a ${testType === 'design' ? 'design effectiveness (walkthrough)' : 'operating effectiveness'} test procedure for the control below.

Process: ${process?.code ?? ''} — ${process?.name ?? ''} (${process?.cycle ?? ''})
Control ${control.ref}: ${control.title}
Description: ${control.description ?? 'not documented'}
Type: ${CONTROL_TYPE_LABEL[control.control_type as ControlType] ?? control.control_type}
Nature: ${NATURE_LABEL[control.nature as Nature] ?? control.nature}
Frequency: ${FREQUENCY_LABEL[control.frequency as Frequency] ?? control.frequency}
Key control: ${control.is_key ? 'Yes' : 'No'}
Level: ${LEVEL_LABEL[control.level as Level] ?? control.level}
COSO component: ${COSO_LABEL[control.coso_component as CosoComponent] ?? control.coso_component}
Evidence retained: ${control.evidence_description ?? 'not documented'}

Risks addressed:
${risks.length ? risks.map((r) => `- ${r.ref}: ${r.description} [${(r.assertions ?? []).join(', ')}]`).join('\n') : '- (no linked risks)'}

Sample size guidance by frequency (operating effectiveness, low deviation rate expected):
${SAMPLE_GUIDE_TEXT}
${guide ? `\nFor this control's frequency, recommend ${guide.min === guide.max ? guide.min : `${guide.min}–${guide.max}`} items; explain when to use the upper end (key control, higher risk, prior exceptions) and how to scale for automated controls (test of one plus ITGC reliance).` : ''}

Structure the procedure with these Markdown sections:
1. **Test objective** — what assertion(s) and risk(s) the test addresses
2. **Population definition** — how to define and obtain the complete population for the period, and how to validate completeness of the population
3. **Sample size and selection** — recommended sample size with rationale, selection method (random/haphazard), period coverage, and roll-forward considerations
4. **Attributes to test** — a numbered list of specific attributes (each attribute should be observable and binary pass/fail) ${testType === 'design' ? 'including walkthrough inquiry, observation, inspection and re-performance steps to confirm the control is designed to address the risk and is implemented' : ''}
5. **Evidence to obtain** — specific documents / system screenshots / reports to retain in the workpaper
6. **Exception evaluation** — how to classify deviations, when a deviation is a control deficiency, expanding the sample, and aggregation considerations (deficiency / significant deficiency / material weakness)
7. **Workpaper documentation** — what the tester documents and the sign-off expectation

Be specific to this control; do not write generic text.`

  try {
    const messageStream = anthropic.messages.stream({
      model: MODELS.SONNET,
      max_tokens: 3000,
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
          console.error('[icfr/test-procedure] stream', err)
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
    console.error('[icfr/test-procedure]', err)
    return Response.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
