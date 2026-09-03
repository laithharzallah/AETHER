import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODELS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { ASSISTANT_TOOLS, executeTool, type Citation, type ToolActivity, type ToolContext } from '@/lib/assistant/tools'
import { ASSISTANT_SYSTEM_PROMPT, conversationTitleFrom } from '@/lib/assistant/prompt'
import { extractCitedControlIds } from '@/lib/regulatory-library/citations'
import type { Json } from '@/lib/database.types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_TOOL_ROUNDS = 6
const HISTORY_LIMIT = 24
const MAX_TOKENS = 3000

type AssistantRequest = {
  conversationId?: string | null
  message?: string
}

/** NDJSON event emitted to the client. */
type StreamEvent =
  | { type: 'pad' }
  | { type: 'ping' }
  | { type: 'conversation'; id: string; title: string }
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string; summary: string }
  | { type: 'citations'; items: Citation[] }
  | { type: 'done'; messageId: string | null }
  | { type: 'error'; message: string }

function errorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) return 'Anthropic API authentication failed. Check ANTHROPIC_API_KEY.'
    if (error.status === 429) return 'Rate limit exceeded. Please try again in a moment.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'Unexpected error.'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: AssistantRequest
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const userMessage = body.message?.trim()
  if (!userMessage) return Response.json({ error: 'message is required' }, { status: 400 })
  if (userMessage.length > 8000) {
    return Response.json({ error: 'Message is too long (max 8000 characters).' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) {
    return Response.json({ error: 'Your profile is not linked to an organization.' }, { status: 400 })
  }
  const organizationId = profile.organization_id

  // Resolve or create the conversation.
  let conversationId = body.conversationId ?? null
  let conversationTitle = ''
  if (conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, title')
      .eq('id', conversationId)
      .maybeSingle()
    if (!conv) return Response.json({ error: 'Conversation not found' }, { status: 404 })
    conversationTitle = conv.title
  } else {
    conversationTitle = conversationTitleFrom(userMessage)
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({ organization_id: organizationId, created_by: user.id, title: conversationTitle })
      .select('id')
      .single()
    if (error || !conv) {
      console.error('[assistant] create conversation', error)
      return Response.json({ error: 'Could not start a conversation.' }, { status: 500 })
    }
    conversationId = conv.id
  }

  // Load history (before persisting the new user message).
  const { data: historyRows } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  const history: Anthropic.MessageParam[] = (historyRows ?? [])
    .reverse()
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  // Persist the user turn.
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userMessage,
  })

  const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: userMessage }]
  const toolCtx: ToolContext = { supabase, retrieved: new Map() }
  const convId = conversationId
  const convTitle = conversationTitle

  const encoder = new TextEncoder()
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        } catch {
          // stream closed
        }
      }

      // Defeat proxy buffering (Render/nginx hold ~4KB before flushing).
      for (let i = 0; i < 160; i += 1) send({ type: 'pad' })
      send({ type: 'conversation', id: convId, title: convTitle })

      const heartbeat = setInterval(() => send({ type: 'ping' }), 3000)

      let finalText = ''
      const activity: ToolActivity[] = []
      let inputTokens = 0
      let outputTokens = 0

      try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
          const stream = anthropic.messages.stream({
            model: MODELS.SONNET,
            max_tokens: MAX_TOKENS,
            system: ASSISTANT_SYSTEM_PROMPT,
            tools: ASSISTANT_TOOLS,
            messages,
          })

          let roundText = ''
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              roundText += event.delta.text
              send({ type: 'text', delta: event.delta.text })
            }
          }

          const final = await stream.finalMessage()
          inputTokens += final.usage?.input_tokens ?? 0
          outputTokens += final.usage?.output_tokens ?? 0
          if (roundText) finalText += (finalText && roundText ? '\n\n' : '') + roundText

          if (final.stop_reason !== 'tool_use') break

          // Execute every tool call in this turn, then continue the loop.
          messages.push({ role: 'assistant', content: final.content })
          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const block of final.content) {
            if (block.type !== 'tool_use') continue
            const input = (block.input ?? {}) as Record<string, unknown>
            const { result, summary } = await executeTool(block.name, input, toolCtx)
            activity.push({ name: block.name, input, summary })
            send({ type: 'tool', name: block.name, summary })
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            })
          }
          messages.push({ role: 'user', content: toolResults })

          if (round === MAX_TOOL_ROUNDS) {
            const note = '\n\n_Reached the tool-call limit for a single answer; ask a follow-up to continue._'
            finalText += note
            send({ type: 'text', delta: note })
          }
        }

        // Resolve citations against everything the tools returned this turn.
        const index = [...toolCtx.retrieved.values()]
        const citedIds = new Set(extractCitedControlIds(finalText, index))
        const citations: Citation[] = index
          .filter((e) => citedIds.has(e.id))
          .map((e) => ({
            controlId: e.id,
            frameworkCode: e.frameworkCode,
            frameworkName: e.frameworkName,
            ref: e.ref,
            title: e.title,
          }))
        if (citations.length > 0) send({ type: 'citations', items: citations })

        const { data: saved } = await supabase
          .from('messages')
          .insert({
            conversation_id: convId,
            role: 'assistant',
            content: finalText,
            tool_activity: activity as unknown as Json,
            citations: citations as unknown as Json,
            model: MODELS.SONNET,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          })
          .select('id')
          .single()

        send({ type: 'done', messageId: saved?.id ?? null })
      } catch (error) {
        console.error('[assistant]', error)
        send({ type: 'error', message: errorMessage(error) })
      } finally {
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
