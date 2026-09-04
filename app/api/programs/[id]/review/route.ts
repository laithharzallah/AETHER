import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODELS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { getProgram, type Implementation } from '@/lib/programs/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Render/nginx may buffer until ~4KB; pad early so tokens stream to the browser.
const STREAM_PAD = '<!-- stream-pad -->\n'.repeat(180)

const SYSTEM_PROMPT = `You are a senior GRC consultant specializing in GCC regulatory frameworks (SAMA, NCA, SDAIA, PDPL, QCB, NCSA, CBUAE, CBJ) and international standards (ISO/IEC 27001, NIST CSF, EU AI Act). You are reviewing a compliance program's implementation status and evidence to produce a candid, board-grade readiness review.

Rules:
- Base every statement strictly on the control data provided. Do not invent controls, statuses or evidence.
- Refer to controls by their exact control reference (e.g. "2-3-1", "A.8.16") as given.
- Treat controls marked implemented without any linked evidence as unverified.
- Be direct about gaps; prioritise by criticality and by domain coverage.`

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  implemented: 'Implemented',
  not_applicable: 'Not applicable',
}

function buildProgramBlock(implementations: Implementation[]): string {
  const byDomain = new Map<string, Implementation[]>()
  for (const impl of implementations) {
    const key = impl.control.domain_en ?? 'General'
    if (!byDomain.has(key)) byDomain.set(key, [])
    byDomain.get(key)!.push(impl)
  }

  const lines: string[] = []
  for (const [domain, items] of byDomain) {
    const implemented = items.filter((i) => i.status === 'implemented').length
    const na = items.filter((i) => i.status === 'not_applicable').length
    lines.push(
      `\n## ${domain} (${items.length} controls, ${implemented} implemented, ${na} N/A)`
    )
    for (const i of items) {
      const parts = [
        `- [${i.control.control_ref}] ${i.control.title_en}`,
        `status=${STATUS_LABEL[i.status] ?? i.status}`,
      ]
      if (i.control.criticality) parts.push(`criticality=${i.control.criticality}`)
      if (i.owner) parts.push(`owner=${i.owner.full_name ?? i.owner.email ?? 'assigned'}`)
      if (i.due_date) parts.push(`due=${i.due_date}`)
      if (i.evidence.length > 0) {
        parts.push(
          `evidence=[${i.evidence
            .map((e) => `${e.name} (${e.review_status})`)
            .join('; ')}]`
        )
      } else {
        parts.push('evidence=none')
      }
      if (i.status === 'not_applicable' && i.na_justification) {
        parts.push(`na_justification="${i.na_justification.slice(0, 200)}"`)
      }
      if (i.notes) parts.push(`notes="${i.notes.slice(0, 240)}"`)
      lines.push(parts.join(' | '))
    }
  }
  return lines.join('\n')
}

function buildUserPrompt(
  frameworkName: string,
  programName: string,
  targetDate: string | null,
  readinessPct: number | null,
  counts: {
    total: number
    implemented: number
    inProgress: number
    notStarted: number
    notApplicable: number
  },
  programBlock: string
): string {
  return `Review the readiness of the compliance program "${programName}" against ${frameworkName}.

Overall: ${counts.total} controls — ${counts.implemented} implemented, ${counts.inProgress} in progress, ${counts.notStarted} not started, ${counts.notApplicable} not applicable. Readiness ${readinessPct ?? 0}%.${
    targetDate ? ` Target date: ${targetDate}.` : ''
  }

Control implementation status grouped by domain:
${programBlock}

Produce a Markdown report with exactly these sections:
1. **Executive summary** — 3–5 sentences on overall readiness and the most material risks.
2. **Readiness by domain** — a Markdown table with columns: Domain | Controls | Implemented | In progress | Not started | N/A | Readiness % | Comment.
3. **Top 10 gaps** — a numbered list; each item names the specific control ref(s), why it matters, and the concrete remediation.
4. **Recommended actions** — three sub-headings: **Next 30 days**, **Next 60 days**, **Next 90 days**, each a bullet list with control refs.
5. **Evidence weaknesses** — controls marked implemented with no evidence, evidence still pending or rejected, expired or thin evidence, and weak N/A justifications.

Use professional language appropriate for a GCC enterprise board pack.`
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) {
      return 'Anthropic API authentication failed. Check ANTHROPIC_API_KEY.'
    }
    if (error.status === 429) {
      return 'Rate limit exceeded. Please try again in a moment.'
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred while generating the review.'
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // getProgram uses the RLS-scoped server client: other tenants get null.
  const detail = await getProgram(id)
  if (!detail) {
    return Response.json({ error: 'Program not found' }, { status: 404 })
  }

  const { program, implementations } = detail
  if (implementations.length === 0) {
    return Response.json(
      { error: 'This program has no controls to review.' },
      { status: 400 }
    )
  }

  const userPrompt = buildUserPrompt(
    program.framework_short_name ?? program.framework_name_en ?? 'the framework',
    program.name ?? 'Program',
    program.target_date,
    program.readiness_pct,
    {
      total: program.total_controls ?? implementations.length,
      implemented: program.implemented ?? 0,
      inProgress: program.in_progress ?? 0,
      notStarted: program.not_started ?? 0,
      notApplicable: program.not_applicable ?? 0,
    },
    buildProgramBlock(implementations)
  )

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
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          controller.close()
        } catch (error) {
          console.error('[programs/review] stream', error)
          controller.enqueue(
            encoder.encode(`\n\n---\nError: ${getErrorMessage(error)}`)
          )
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
  } catch (error) {
    console.error('[programs/review]', error)
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
