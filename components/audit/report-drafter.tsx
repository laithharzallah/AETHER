'use client'

import { useState } from 'react'
import { Check, Copy, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Textarea } from '@/components/audit/fields'
import { PolicyMarkdown } from '@/components/policy-markdown'

function cleanStreamChunk(raw: string): string {
  return raw.replace(/(?:<!-- stream-pad -->\n?)+/g, '').replace(/\u200B/g, '')
}

export function ReportDrafter({ engagementId }: { engagementId: string }) {
  const [markdown, setMarkdown] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [limitations, setLimitations] = useState('')

  async function handleDraft() {
    setMarkdown('')
    setStreaming(true)
    try {
      const res = await fetch('/api/audit/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'manual',
        body: JSON.stringify({ engagementId, scopeLimitations: limitations }),
      })
      if (res.status === 401 || res.status === 307 || res.status === 302) {
        toast.error('Session expired. Please refresh and sign in again.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(data.error ?? 'Could not draft the report.')
        return
      }
      if (!res.body) {
        toast.error('No response stream received.')
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMarkdown(cleanStreamChunk(accumulated))
      }
      setMarkdown(cleanStreamChunk(accumulated))
    } catch {
      toast.error('Network error while drafting the report.')
    } finally {
      setStreaming(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy.')
    }
  }

  return (
    <div className="surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Engagement report</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Executive summary, objective and scope, approach, overall conclusion, the
            observation summary by rating, the detailed observations with management
            responses, and an appendix on scope limitations. Drafted only from what is
            recorded on this engagement.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleDraft} disabled={streaming}>
          {streaming ? <Loader2 className="animate-spin" /> : <FileText />}
          {markdown ? 'Redraft report' : 'Draft report'}
        </Button>
      </div>

      <div className="mt-3">
        <Field
          label="Scope limitations (optional)"
          htmlFor="rd-limits"
          hint="Evidence not made available, systems not accessible, procedures not completed and the reason."
        >
          <Textarea
            id="rd-limits"
            value={limitations}
            onChange={(e) => setLimitations(e.target.value)}
            disabled={streaming}
            className="min-h-16"
          />
        </Field>
      </div>

      {markdown && (
        <div className="mt-4 space-y-2">
          <PolicyMarkdown markdown={markdown} className="max-h-[40rem] overflow-y-auto p-5 text-sm" />
          <div className="flex justify-end">
            <Button size="xs" variant="ghost" onClick={handleCopy} disabled={streaming}>
              {copied ? <Check /> : <Copy />}
              {copied ? 'Copied' : 'Copy Markdown'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
