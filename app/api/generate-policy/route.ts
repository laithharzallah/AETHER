import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODELS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SYSTEM_PROMPT = `You are a senior GRC consultant specializing in GCC regulatory frameworks (SAMA, NCA, SDAIA, ISO 27001, NIST). You write formal, board-grade compliance policies for GCC enterprises. Your output is precise, authoritative, and suitable for executive and audit review.`

type GeneratePolicyRequest = {
  policyType?: string
  frameworks?: string[]
  orgContext?: string
}

function buildUserPrompt(
  policyType: string,
  frameworks: string[],
  orgContext?: string
): string {
  const frameworkList = frameworks.join(', ')
  const contextBlock = orgContext?.trim()
    ? `\n\nOrganization context:\n${orgContext.trim()}`
    : ''

  return `Generate a complete ${policyType} aligned to these frameworks: ${frameworkList}.${contextBlock}

The policy MUST include these sections in order:
1. Document Control (version, effective date, owner, classification)
2. Purpose
3. Scope
4. Policy Statements — each mapped to specific named controls from the listed frameworks
5. Roles & Responsibilities
6. Compliance & Enforcement
7. Review Cycle

Output in clean Markdown. Use professional language appropriate for a GCC enterprise board pack. Where framework controls apply, cite the specific control identifier (e.g. SAMA CSF domain/control, NCA ECC control, ISO 27001:2022 clause, NIST CSF function/category).`
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
  const frameworks = body.frameworks?.filter(
    (f): f is string => typeof f === 'string' && f.trim().length > 0
  )
  const orgContext =
    typeof body.orgContext === 'string' ? body.orgContext : undefined

  if (!policyType) {
    return Response.json({ error: 'policyType is required' }, { status: 400 })
  }

  if (!frameworks?.length) {
    return Response.json(
      { error: 'frameworks must be a non-empty array of strings' },
      { status: 400 }
    )
  }

  const userPrompt = buildUserPrompt(policyType, frameworks, orgContext)

  try {
    const messageStream = anthropic.messages.stream({
      model: MODELS.SONNET,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        // Flush response headers immediately (helps Render/proxy streaming).
        controller.enqueue(encoder.encode(''))
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
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('[generate-policy]', error)
    return Response.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
