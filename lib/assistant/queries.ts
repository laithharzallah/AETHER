import { createClient } from '@/lib/supabase/server'
import type { Citation, ToolActivity } from '@/lib/assistant/tools'

export type ConversationSummary = {
  id: string
  title: string
  updated_at: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[]
  toolActivity: ToolActivity[]
  createdAt: string
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) {
    console.error('[assistant] listConversations', error)
    return []
  }
  return data ?? []
}

export async function getConversation(
  id: string
): Promise<{ conversation: ConversationSummary; messages: ChatMessage[] } | null> {
  const supabase = await createClient()
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .eq('id', id)
    .maybeSingle()
  if (!conversation) return null

  const { data: rows } = await supabase
    .from('messages')
    .select('id, role, content, citations, tool_activity, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  const messages: ChatMessage[] = (rows ?? []).map((m) => ({
    id: m.id,
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
    citations: Array.isArray(m.citations) ? (m.citations as unknown as Citation[]) : [],
    toolActivity: Array.isArray(m.tool_activity) ? (m.tool_activity as unknown as ToolActivity[]) : [],
    createdAt: m.created_at,
  }))

  return { conversation, messages }
}
