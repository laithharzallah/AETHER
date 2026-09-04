'use client'

import { useState } from 'react'
import { Check, Copy, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, TextInput, Textarea } from '@/components/erm/fields'
import { PolicyMarkdown } from '@/components/policy-markdown'

function cleanStreamChunk(raw: string): string {
  return raw.replace(/(?:<!-- stream-pad -->\n?)+/g, '').replace(/​/g, '')
}

export function BoardReportDialog({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [entityName, setEntityName] = useState('')
  const [periodLabel, setPeriodLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [generating, setGenerating] = useState(false)
  const [complete, setComplete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setGenerating(true)
    setComplete(false)
    setError(null)
    setMarkdown('')

    try {
      const res = await fetch('/api/erm/board-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityName, periodLabel, notes }),
      })

      if (res.status === 401) {
        setError('Session expired. Refresh the page and sign in again.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Could not draft the board report.')
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

      const finished = cleanStreamChunk(accumulated)
      if (!finished.trim()) {
        setError('The report finished with no content. Try again.')
        return
      }
      setMarkdown(finished)
      setComplete(true)
    } catch {
      setError('Network error while drafting the report.')
    } finally {
      setGenerating(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy to the clipboard.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" disabled={disabled} />}>
        <FileText className="h-4 w-4" />
        Board risk report
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Board risk report</DialogTitle>
          <DialogDescription>
            Drafts the risk section of the board pack from the register: profile and
            movement, principal risks, risks outside appetite, KRI breaches, emerging risks
            and the asks of the board. Every figure comes from the register.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Entity name" htmlFor="erm-report-entity">
            <TextInput
              id="erm-report-entity"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="Al Khobar Industrial Company"
            />
          </Field>
          <Field label="Reporting period" htmlFor="erm-report-period">
            <TextInput
              id="erm-report-period"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="Q3 2026"
            />
          </Field>
        </div>
        <Field label="Context for the drafter" htmlFor="erm-report-notes">
          <Textarea
            id="erm-report-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything the board asked for last time, or events since the last report."
          />
        </Field>

        <div className="flex items-center gap-2">
          <Button type="button" onClick={generate} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {markdown ? 'Regenerate' : 'Draft report'}
          </Button>
          {complete && markdown && (
            <Button type="button" variant="outline" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy Markdown'}
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {markdown && (
          <div className="max-h-[50vh] overflow-y-auto">
            <PolicyMarkdown markdown={markdown} />
          </div>
        )}
        {generating && !markdown && (
          <p className="text-sm text-muted-foreground">Reading the register…</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
