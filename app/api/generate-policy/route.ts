import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient, hasAnthropicKey, MODELS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Render's proxy buffers a response until roughly 4KB has accumulated, which made
 * streaming look like a hang for the first several seconds. Padding the front of
 * the stream forces the flush; the client strips the marker.
 */
const STREAM_PAD = '<!-- stream-pad -->\n'.repeat(180)

const SYSTEM_PROMPT = `You are a senior GRC consultant specialising in GCC regulatory frameworks. You write formal, board-grade compliance policies for GCC enterprises, precise enough to survive review by an internal audit function and an external assessor.

Rules you never break:
- Cite only real control identifiers from the list you are given. Never invent a control number, clause reference or article number. If you are not certain, describe the requirement without a citation.
- Write testable statements. "Access shall be reviewed quarterly by the system owner" is auditable; "access should be managed appropriately" is not.
- Name accountable roles, never individuals.
- Do not pad. A shorter policy that is entirely enforceable beats a long one that is not.`

type GeneratePolicyRequest = {
  policyType?: string
  frameworks?: string[]
  orgContext?: string
  templateCode?: string
}

type TemplateSection = { heading: string; guidance?: string }

function parseSections(value: unknown): TemplateSection[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const record = entry as Record<string, unknown>
    if (typeof record.heading !== 'string') return []
    return [
      {
        heading: record.heading,
        guidance: typeof record.guidance === 'string' ? record.guidance : undefined,
      },
    ]
  })
}

const DEFAULT_SECTIONS: TemplateSection[] = [
  {
    heading: 'Document Control',
    guidance: 'Version, effective date, owner, approver, classification.',
  },
  { heading: 'Purpose', guidance: 'Why the policy exists and the outcome it protects.' },
  {
    heading: 'Scope',
    guidance: 'Entities, systems, data and personnel covered, and explicit exclusions.',
  },
  {
    heading: 'Policy Statements',
    guidance:
      'Numbered, testable statements, each citing the framework control it satisfies.',
  },
  { heading: 'Roles and Responsibilities', guidance: 'Named accountable roles.' },
  {
    heading: 'Compliance and Enforcement',
    guidance: 'How compliance is measured and the consequence of a breach.',
  },
  {
    heading: 'Review Cycle',
    guidance: 'Review frequency and the trigger events forcing an early review.',
  },
]

/**
 * Builds the prompt from the tenant's own catalogue rather than a static string,
 * so the policy cites controls that exist in the frameworks the organisation is
 * actually assessed against. Handing the model the real identifiers is the main
 * defence against invented citations.
 */
function buildUserPrompt(
  policyType: string,
  frameworks: Array<{
    code: string
    name: string
    regulator: string
    citation: string | null
  }>,
  controls: Array<{ framework: string; code: string; title: string }>,
  sections: TemplateSection[],
  orgContext?: string
): string {
  const frameworkBlock = frameworks
    .map(
      (f) =>
        `- ${f.code} — ${f.name} (${f.regulator})${f.citation ? `. Cite as: ${f.citation}` : ''}`
    )
    .join('\n')

  const grouped = new Map<string, string[]>()
  for (const control of controls) {
    const list = grouped.get(control.framework) ?? []
    list.push(`${control.code} ${control.title}`)
    grouped.set(control.framework, list)
  }

  const controlBlock = [...grouped.entries()]
    .map(([code, list]) => `${code}:\n${list.map((l) => `  ${l}`).join('\n')}`)
    .join('\n\n')

  const sectionBlock = sections
    .map(
      (section, index) =>
        `${index + 1}. ${section.heading}${section.guidance ? ` — ${section.guidance}` : ''}`
    )
    .join('\n')

  return `Write a complete ${policyType}.

Frameworks it must align to:
${frameworkBlock}

${
  controlBlock
    ? `These are the real control identifiers available in those frameworks. Cite only from this list:

${controlBlock}`
    : 'No control catalogue was available, so describe requirements without citing identifiers rather than guessing them.'
}

${orgContext?.trim() ? `Organisation context:\n${orgContext.trim()}\n` : ''}
Required sections, in this order, as Markdown h2 headings:
${sectionBlock}

Output clean Markdown starting with an h1 title. Use a Markdown table for Document Control. Number the policy statements and attach the relevant control citation to each.`
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) {
      return 'Anthropic API authentication failed. Check ANTHROPIC_API_KEY.'
    }
    if (error.status === 429) {
      return 'Rate limit exceeded. Please try again in a moment.'
    }
    if (error.status === 529 || error.status === 503) {
      return 'The model is temporarily overloaded. Please try again in a moment.'
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred while generating the policy.'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!hasAnthropicKey()) {
    return Response.json(
      {
        error:
          'Policy generation needs an Anthropic API key. Set ANTHROPIC_API_KEY in the environment, or write the policy manually from a template.',
      },
      { status: 503 }
    )
  }

  let body: GeneratePolicyRequest
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const policyType = body.policyType?.trim()
  const requestedFrameworks = body.frameworks?.filter(
    (f): f is string => typeof f === 'string' && f.trim().length > 0
  )
  const orgContext = typeof body.orgContext === 'string' ? body.orgContext : undefined
  const templateCode =
    typeof body.templateCode === 'string' && body.templateCode.trim()
      ? body.templateCode.trim()
      : undefined

  if (!policyType) {
    return Response.json({ error: 'policyType is required' }, { status: 400 })
  }
  if (!requestedFrameworks?.length) {
    return Response.json(
      { error: 'frameworks must be a non-empty array of strings' },
      { status: 400 }
    )
  }

  // Resolve frameworks against the catalogue. A code that does not exist is simply
  // absent from the prompt, so a bad request degrades into a less specific policy
  // rather than a fabricated one.
  const [frameworkResult, templateResult] = await Promise.all([
    supabase
      .from('frameworks')
      .select('code, name, regulator, citation')
      .in('code', requestedFrameworks),
    templateCode
      ? supabase
          .from('policy_templates')
          .select('required_sections')
          .eq('code', templateCode)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const frameworks = frameworkResult.data ?? []

  if (frameworks.length === 0) {
    return Response.json(
      { error: 'None of the requested frameworks exist in the catalogue.' },
      { status: 400 }
    )
  }

  const { data: controls } = await supabase
    .from('framework_controls_expanded')
    .select('framework_code, control_code, control_title')
    .in(
      'framework_code',
      frameworks.map((f) => f.code)
    )
    .order('framework_code')
    .order('ordinal')
    // Enough for the model to work from real identifiers without flooding the
    // context: ISO 27001 alone is 93 controls.
    .limit(400)

  const sections = parseSections(templateResult.data?.required_sections)

  const userPrompt = buildUserPrompt(
    policyType,
    frameworks,
    (controls ?? []).flatMap((c) =>
      c.framework_code && c.control_code && c.control_title
        ? [
            {
              framework: c.framework_code,
              code: c.control_code,
              title: c.control_title,
            },
          ]
        : []
    ),
    sections.length > 0 ? sections : DEFAULT_SECTIONS,
    orgContext
  )

  try {
    const messageStream = getAnthropicClient().messages.stream({
      model: MODELS.SONNET,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(STREAM_PAD))

        // Zero-width spaces keep the connection warm through any intermediary idle
        // timeout while the model is still thinking.
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
          // The response has already been committed with a 200, so an error has to
          // be delivered in-band. The client renders anything after this marker as
          // a failure rather than as policy text.
          controller.enqueue(encoder.encode(`\n\n---\nError: ${getErrorMessage(error)}`))
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
