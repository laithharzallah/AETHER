'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUp,
  BookOpen,
  Loader2,
  MessageSquarePlus,
  Sparkles,
  Square,
  Trash2,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PolicyMarkdown } from '@/components/policy-markdown'
import { deleteConversation } from '@/lib/actions/conversations'
import type { ChatMessage, ConversationSummary } from '@/lib/assistant/queries'
import type { Citation, ToolActivity } from '@/lib/assistant/tools'
import { cn } from '@/lib/utils'

type AssistantClientProps = {
  conversations: ConversationSummary[]
  activeConversation: ConversationSummary | null
  initialMessages: ChatMessage[]
  libraryStats: { frameworks: number; controls: number; jurisdictions: number }
  initialQuery?: string
}

type StreamEvent =
  | { type: 'pad' }
  | { type: 'ping' }
  | { type: 'conversation'; id: string; title: string }
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string; summary: string }
  | { type: 'citations'; items: Citation[] }
  | { type: 'done'; messageId: string | null }
  | { type: 'error'; message: string }

const SUGGESTIONS = [
  'What does SAMA CSF require for privileged access, and how does that map to NCA ECC and ISO 27001?',
  'Summarize the Saudi PDPL breach notification obligations with timelines.',
  'Which of my saved policies cover third-party risk, and what is missing against NCA ECC domain 4?',
  'Compare EU AI Act high-risk obligations with what a Saudi bank must do under SAMA and SDAIA.',
  'ما هي متطلبات الهيئة الوطنية للأمن السيبراني بشأن النسخ الاحتياطي؟',
]

function isArabic(text: string): boolean {
  const sample = text.slice(0, 200)
  const arabic = (sample.match(/[؀-ۿ]/g) ?? []).length
  return arabic > sample.length * 0.3
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function AssistantClient({
  conversations,
  activeConversation,
  initialMessages,
  libraryStats,
  initialQuery,
}: AssistantClientProps) {
  const router = useRouter()
  const initialQueryRef = useRef(initialQuery)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftActivity, setDraftActivity] = useState<ToolActivity[]>([])
  const [draftCitations, setDraftCitations] = useState<Citation[]>([])
  const [conversationId, setConversationId] = useState<string | null>(activeConversation?.id ?? null)
  const [localNew, setLocalNew] = useState<ConversationSummary | null>(null)
  const sidebar = localNew ? [localNew, ...conversations.filter((c) => c.id !== localNew.id)] : conversations
  const [deleting, startDelete] = useTransition()
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, draft, draftActivity])

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || streaming) return

      setInput('')
      setStreaming(true)
      setDraft('')
      setDraftActivity([])
      setDraftCitations([])

      const userMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content,
        citations: [],
        toolActivity: [],
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])

      const controller = new AbortController()
      abortRef.current = controller

      let accumulated = ''
      let activity: ToolActivity[] = []
      let citations: Citation[] = []
      let newConversationId: string | null = null
      let newTitle = ''

      try {
        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, message: content }),
          signal: controller.signal,
          redirect: 'manual',
        })

        if (res.status === 401 || res.status === 302 || res.status === 307) {
          toast.error('Session expired. Please refresh and sign in again.')
          return
        }
        if (!res.ok || !res.body) {
          let msg = 'The assistant could not respond.'
          try {
            const data = (await res.json()) as { error?: string }
            msg = data.error ?? msg
          } catch {
            // ignore
          }
          toast.error(msg)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const handle = (event: StreamEvent) => {
          switch (event.type) {
            case 'conversation':
              if (!conversationId) {
                newConversationId = event.id
                newTitle = event.title
                setConversationId(event.id)
              }
              break
            case 'text':
              accumulated += event.delta
              setDraft(accumulated)
              break
            case 'tool':
              activity = [...activity, { name: event.name, input: {}, summary: event.summary }]
              setDraftActivity(activity)
              break
            case 'citations':
              citations = event.items
              setDraftCitations(citations)
              break
            case 'error':
              toast.error(event.message)
              break
            default:
              break
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let nl = buffer.indexOf('\n')
          while (nl >= 0) {
            const line = buffer.slice(0, nl).trim()
            buffer = buffer.slice(nl + 1)
            if (line) {
              try {
                handle(JSON.parse(line) as StreamEvent)
              } catch {
                // partial / malformed line — skip
              }
            }
            nl = buffer.indexOf('\n')
          }
        }
        if (buffer.trim()) {
          try {
            handle(JSON.parse(buffer.trim()) as StreamEvent)
          } catch {
            // ignore trailing garbage
          }
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          toast.error('Network error while talking to the assistant.')
        }
      } finally {
        const assistantMsg: ChatMessage = {
          id: `local-a-${Date.now()}`,
          role: 'assistant',
          content: accumulated || '_No response._',
          citations,
          toolActivity: activity,
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMsg])
        setDraft('')
        setDraftActivity([])
        setDraftCitations([])
        setStreaming(false)
        abortRef.current = null

        if (newConversationId) {
          setLocalNew({ id: newConversationId, title: newTitle, updated_at: new Date().toISOString() })
          window.history.replaceState(null, '', `/dashboard/assistant/${newConversationId}`)
        }
        textareaRef.current?.focus()
      }
    },
    [conversationId, streaming]
  )

  // A query handed over from the top-bar search: send it once on mount.
  useEffect(() => {
    const q = initialQueryRef.current
    if (!q) return
    initialQueryRef.current = undefined
    window.history.replaceState(null, '', '/dashboard/assistant')
    void send(q)
  }, [send])

  function stop() {
    abortRef.current?.abort()
  }

  function handleDelete(id: string) {
    startDelete(async () => {
      try {
        await deleteConversation(id)
      } catch {
        toast.error('Could not delete conversation.')
      }
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  const empty = messages.length === 0 && !streaming

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] md:-m-8">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border md:flex">
        <div className="p-3">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => router.push('/dashboard/assistant')}
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New conversation
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {sidebar.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              Your conversations will appear here.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {sidebar.map((c) => {
                const active = c.id === conversationId
                return (
                  <li key={c.id} className="group relative">
                    <Link
                      href={`/dashboard/assistant/${c.id}`}
                      className={cn(
                        'block rounded-lg px-3 py-2 pr-8 text-sm transition-colors',
                        active
                          ? 'bg-foreground/5 font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                      )}
                    >
                      <span className="line-clamp-1">{c.title}</span>
                      <span className="block text-[11px] text-muted-foreground/70">
                        {formatWhen(c.updated_at)}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      disabled={deleting}
                      aria-label="Delete conversation"
                      className="absolute top-2 right-2 hidden rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3" />
            Grounded in {libraryStats.controls.toLocaleString()} controls ·{' '}
            {libraryStats.frameworks} frameworks
          </div>
        </div>
      </aside>

      {/* Thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
            {empty ? (
              <div className="pt-10">
                <div className="mb-3 icon-tile">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h1 className="page-title">
                  Ask AETHER
                </h1>
                <p className="mt-3 max-w-xl text-muted-foreground">
                  A GRC advisor that reads the regulatory library and your saved
                  policies before it answers. Every regulatory claim is cited to a
                  control you can open.
                </p>
                <div className="mt-8 grid gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      dir={isArabic(s) ? 'rtl' : 'ltr'}
                      className={cn(
                        'surface px-3.5 py-3 text-left text-sm text-foreground/90 transition-colors hover:border-border hover:bg-primary/[0.03]',
                        isArabic(s) && 'text-right'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {streaming && (
                  <MessageBubble
                    message={{
                      id: 'draft',
                      role: 'assistant',
                      content: draft,
                      citations: draftCitations,
                      toolActivity: draftActivity,
                      createdAt: new Date().toISOString(),
                    }}
                    streaming
                  />
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-background">
          <div className="mx-auto max-w-3xl px-4 py-3 md:px-6">
            <div className="flex items-end gap-2 rounded-xl border border-input bg-card p-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={Math.min(6, Math.max(1, input.split('\n').length))}
                placeholder="Ask about any regulation, control, or one of your policies…"
                dir={isArabic(input) ? 'rtl' : 'ltr'}
                className="max-h-48 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                disabled={streaming}
              />
              {streaming ? (
                <Button type="button" size="icon" variant="outline" onClick={stop} aria-label="Stop">
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  onClick={() => void send(input)}
                  disabled={!input.trim()}
                  aria-label="Send"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Enter to send · Shift+Enter for a new line · Answers cite library
              controls; summarized frameworks use thematic numbering — verify
              against the primary source for formal submissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  streaming = false,
}: {
  message: ChatMessage
  streaming?: boolean
}) {
  const rtl = isArabic(message.content)

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          dir={rtl ? 'rtl' : 'ltr'}
          className={cn(
            'max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm whitespace-pre-wrap text-background',
            rtl && 'text-right'
          )}
        >
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        {message.toolActivity.length > 0 && (
          <ul className="mb-2 space-y-1">
            {message.toolActivity.map((t, i) => (
              <li
                key={`${t.name}-${i}`}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Wrench className="h-3 w-3 shrink-0" />
                <span>{t.summary}</span>
              </li>
            ))}
          </ul>
        )}

        {message.content ? (
          <div dir={rtl ? 'rtl' : 'ltr'} className={cn(rtl && 'text-right')}>
            <PolicyMarkdown
              markdown={message.content}
              className={cn('border-0 bg-transparent p-0', streaming && 'opacity-90')}
            />
          </div>
        ) : streaming ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {message.toolActivity.length > 0 ? 'Reading the library…' : 'Thinking…'}
          </div>
        ) : null}

        {message.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5" dir="ltr">
            {message.citations.map((c) => (
              <Link
                key={c.controlId}
                href={`/dashboard/regulations/${encodeURIComponent(c.frameworkCode)}`}
                title={c.title}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] hover:border-border hover:bg-primary/[0.03]"
              >
                <BookOpen className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{c.frameworkName}</span>
                <code className="font-mono">{c.ref}</code>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
