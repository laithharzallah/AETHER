'use client'

import { useState } from 'react'
import { Check, Copy, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PolicyMarkdown } from '@/components/policy-markdown'

type ReadinessReviewProps = {
  programId: string
  disabled?: boolean
}

function cleanStreamChunk(raw: string): string {
  return raw
    .replace(/(?:<!-- stream-pad -->\n?)+/g, '')
    .replace(/\u200B/g, '')
}

export function ReadinessReview({ programId, disabled }: ReadinessReviewProps) {
  const [markdown, setMarkdown] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function run() {
    if (running) return
    setError(null)
    setMarkdown('')
    setCopied(false)
    setRunning(true)

    try {
      const res = await fetch(`/api/programs/${programId}/review`, {
        method: 'POST',
        redirect: 'manual',
      })

      if (res.status === 401 || res.status === 307 || res.status === 302) {
        setError('Session expired. Please refresh the page and sign in again.')
        return
      }
      if (!res.ok) {
        let message = 'Failed to run the readiness review.'
        try {
          const data = (await res.json()) as { error?: string }
          if (data.error) message = data.error
        } catch {
          // non-JSON error body
        }
        setError(message)
        return
      }
      if (!res.body) {
        setError('No response stream received.')
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
      accumulated = cleanStreamChunk(accumulated)
      if (!accumulated.trim()) {
        setError('The review finished with no content. Please try again.')
      }
    } catch {
      setError('Network error while running the review. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard.')
    }
  }

  const hasContent = markdown.trim().length > 0

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium">AI readiness review</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Executive summary, readiness by domain, top gaps, a 30/60/90-day
            plan and evidence weaknesses — generated from the current matrix.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && !running && (
            <Button type="button" variant="ghost" size="sm" onClick={copy}>
              {copied ? <Check /> : <Copy />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={hasContent ? 'outline' : 'default'}
            onClick={run}
            disabled={running || disabled}
          >
            {running ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {running
              ? 'Reviewing…'
              : hasContent
                ? 'Run again'
                : 'Run readiness review'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="border-t border-border/60 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {(hasContent || running) && (
        <div className="border-t border-border/60 p-4">
          {hasContent ? (
            <PolicyMarkdown markdown={markdown} className="border-0 p-0" />
          ) : (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysing control status and evidence…
            </p>
          )}
        </div>
      )}
    </section>
  )
}
