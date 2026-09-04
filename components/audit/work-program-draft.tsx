'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Loader2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, NativeSelect, Textarea } from '@/components/audit/fields'
import { PolicyMarkdown } from '@/components/policy-markdown'
import { addProceduresFromDraft, applyProgramTemplate } from '@/lib/actions/audit'
import type { TemplateSummary } from '@/lib/audit/queries'

function cleanStreamChunk(raw: string): string {
  return raw.replace(/(?:<!-- stream-pad -->\n?)+/g, '').replace(/\u200B/g, '')
}

/**
 * Parses the "### 5. Work program" section of the drafted Markdown into
 * procedure rows. Each procedure begins with a bold "**P-nn — title**" line.
 */
export function parseWorkProgram(markdown: string): {
  area: string | null
  objective: string | null
  procedure: string
}[] {
  const programStart = markdown.search(/^#{2,4}\s*5\.?\s*Work program/im)
  const section = programStart >= 0 ? markdown.slice(programStart) : markdown
  const wrapUp = section.search(/^#{2,4}\s*6\.?\s*Wrap-?up/im)
  const body = wrapUp > 0 ? section.slice(0, wrapUp) : section

  const blocks = body.split(/\n(?=\*\*P-\d+)/g).filter((b) => /^\*\*P-\d+/.test(b.trim()))
  return blocks.map((block) => {
    const lines = block.trim().split('\n')
    const heading = lines[0].replace(/\*\*/g, '').trim()
    const title = heading.replace(/^P-\d+\s*[—-]\s*/, '').trim()
    const field = (name: string) => {
      const m = new RegExp(`\\*\\*${name}:?\\*\\*\\s*(.+)`, 'i').exec(block)
      return m ? m[1].trim() : null
    }
    return {
      area: field('Area'),
      objective: field('Objective') ?? title,
      procedure: lines.slice(1).join('\n').trim() || block.trim(),
    }
  })
}

export function WorkProgramDraft({
  engagementId,
  templates,
  disabled,
}: {
  engagementId: string
  templates: TemplateSummary[]
  disabled?: boolean
}) {
  const router = useRouter()
  const [markdown, setMarkdown] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [focus, setFocus] = useState('')
  const [count, setCount] = useState('12')
  const [templateCode, setTemplateCode] = useState('')

  async function handleDraft() {
    setMarkdown('')
    setStreaming(true)
    try {
      const res = await fetch('/api/audit/work-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'manual',
        body: JSON.stringify({ engagementId, focus, procedureCount: Number(count) }),
      })
      if (res.status === 401 || res.status === 307 || res.status === 302) {
        toast.error('Session expired. Please refresh and sign in again.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(data.error ?? 'Could not draft the work program.')
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
      toast.error('Network error while drafting the work program.')
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

  async function handleAdd() {
    const steps = parseWorkProgram(markdown)
    if (steps.length === 0) {
      toast.error('No procedures could be parsed from the draft. Copy them in manually.')
      return
    }
    setSaving(true)
    const result = await addProceduresFromDraft(engagementId, steps)
    setSaving(false)
    if (result.ok) {
      toast.success(`${result.data?.inserted ?? 0} procedure(s) added to the work program.`)
      setMarkdown('')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  async function handleApplyTemplate() {
    if (!templateCode) return
    setSaving(true)
    const result = await applyProgramTemplate(engagementId, templateCode)
    setSaving(false)
    if (result.ok) {
      toast.success(`${result.data?.inserted ?? 0} standard procedure(s) added.`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface p-4">
        <h3 className="text-sm font-medium">Standard work program</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Import a global program written to Big Four fieldwork standard, then tailor it.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Template" htmlFor="wp-template" className="min-w-64">
            <NativeSelect
              id="wp-template"
              value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value)}
              disabled={disabled || saving}
            >
              <option value="">Select a program</option>
              {templates.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name} ({t.step_count} procedures) — {t.area}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Button
            variant="outline"
            onClick={handleApplyTemplate}
            disabled={disabled || saving || !templateCode}
          >
            {saving && <Loader2 className="animate-spin" />}
            Append to work program
          </Button>
        </div>
      </div>

      <div className="surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Draft a risk-based work program</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Objectives, scope, criteria, an engagement risk assessment and numbered
              procedures with test approach, sample basis and evidence.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NativeSelect
              aria-label="Number of procedures"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              disabled={streaming}
              className="h-7 w-auto text-xs"
            >
              {['8', '10', '12', '15', '18', '22'].map((n) => (
                <option key={n} value={n}>
                  {n} procedures
                </option>
              ))}
            </NativeSelect>
            <Button size="xs" variant="outline" onClick={handleDraft} disabled={streaming || disabled}>
              {streaming ? <Loader2 className="animate-spin" /> : <Wand2 />}
              {markdown ? 'Redraft' : 'Draft work program'}
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <Field label="Direction for the drafter (optional)" htmlFor="wp-focus">
            <Textarea
              id="wp-focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              disabled={streaming}
              className="min-h-16"
              placeholder="For example: focus on the SAP migration that went live in March, exclude the Bahrain branch, and cover the SAMA outsourcing requirements for the collections vendor."
            />
          </Field>
        </div>

        {markdown && (
          <div className="mt-4 space-y-2">
            <PolicyMarkdown markdown={markdown} className="max-h-[32rem] overflow-y-auto p-4 text-xs" />
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="xs" variant="ghost" onClick={handleCopy} disabled={streaming}>
                {copied ? <Check /> : <Copy />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button size="xs" onClick={handleAdd} disabled={streaming || saving}>
                {saving && <Loader2 className="animate-spin" />}
                Add {parseWorkProgram(markdown).length} procedure(s) to the work program
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
