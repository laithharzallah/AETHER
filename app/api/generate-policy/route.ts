import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODELS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { getControlIndex } from '@/lib/regulatory-library/queries'
import { buildControlIndexBlock } from '@/lib/regulatory-library/citations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Render/nginx may buffer until ~4KB; pad early so tokens stream to the browser.
const STREAM_PAD = '<!-- stream-pad -->\n'.repeat(180)

const SYSTEM_PROMPT = `You are a senior GRC consultant specializing in GCC regulatory frameworks (SAMA, NCA, SDAIA, PDPL, QCB, NCSA, CBUAE, CBJ) and international standards (ISO/IEC 27001, NIST CSF, EU AI Act). You write formal, board-grade compliance policies for GCC enterprises. Your output is precise, authoritative, and suitable for executive and audit review.

When a control index is provided, you MUST cite controls using the exact identifiers from that index (for example "NCA ECC 2-3-1", "ISO 27001 A.8.16", "NIST CSF PR.AA-01", "SAMA CSF 3.3.5"). Do not invent identifiers that are not in the index. If a framework has no index, cite it by domain name only.`

type GeneratePolicyRequest = {
  policyType?: string
  frameworks?: string[]
  orgContext?: string
}

function buildUserPrompt(
  policyType: string,
  frameworkNames: string[],
  controlIndexBlock: string,
  orgContext?: string
): string {
  const frameworkList = frameworkNames.join(', ')
  const contextBlock = orgContext?.trim()
    ? `\n\nOrganization context:\n${orgContext.trim()}`
    : ''
  const indexBlock = controlIndexBlock
    ? `\n\nControl index (cite ONLY these identifiers, verbatim):\n\n${controlIndexBlock}`
    : ''

  return `Generate a complete ${policyType} aligned to these frameworks: ${frameworkList}.${contextBlock}${indexBlock}

The policy MUST include these sections in order:
1. Document Control (version, effective date, owner, classification)
2. Purpose
3. Scope
4. Policy Statements — each mapped to specific named controls from the listed frameworks
5. Roles & Responsibilities
6. Compliance & Enforcement
7. Review Cycle
8. Control Mapping Table — a Markdown table with columns: Policy Statement | Framework | Control ID | Control Title

Output in clean Markdown. Use professional language appropriate for a GCC enterprise board pack. Every policy statement must cite at least one control identifier from the control index.`
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
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred while generating the policy.'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: GeneratePolicyRequest
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const policyType = body.policyType?.trim()
  const frameworkCodes = body.frameworks?.filter(
    (f): f is string => typeof f === 'string' && f.trim().length > 0
  )
  const orgContext =
    typeof body.orgContext === 'string' ? body.orgContext : undefined

  if (!policyType) {
    return Response.json({ error: 'policyType is required' }, { status: 400 })
  }

  if (!frameworkCodes?.length) {
    return Response.json(
      { error: 'frameworks must be a non-empty array of strings' },
      { status: 400 }
    )
  }

  // Ground the prompt in the regulatory library. Falls back gracefully when
  // the library has not been seeded (index is empty).
  const controlIndex = await getControlIndex(frameworkCodes)
  const controlIndexBlock = buildControlIndexBlock(controlIndex)

  const frameworkNames = frameworkCodes.map((code) => {
    const entry = controlIndex.find((c) => c.frameworkCode === code)
    return entry?.frameworkName ?? code
  })

  const userPrompt = buildUserPrompt(
    policyType,
    frameworkNames,
    controlIndexBlock,
    orgContext
  )

  try {
    const messageStream = anthropic.messages.stream({
      model: MODELS.SONNET,
      max_tokens: 6000,
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
          console.error('[generate-policy] stream', error)
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
    console.error('[generate-policy]', error)
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
