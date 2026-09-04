'use client'

import { useState } from 'react'
import { Check, Copy, FileText, Loader2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NativeSelect, optionsFrom } from '@/components/icfr/fields'
import { PolicyMarkdown } from '@/components/policy-markdown'
import { TEST_TYPES, TEST_TYPE_LABEL } from '@/lib/icfr/constants'

function cleanStreamChunk(raw: string): string {
  return raw.replace(/(?:<!-- stream-pad -->\n?)+/g, '').replace(/\u200B/g, '')
}

export function TestProcedureDraft({
  controlId,
  onUse,
}: {
  controlId: string
  onUse: (markdown: string, testType: string) => void
}) {
  const [testType, setTestType] = useState<string>('operating')
  const [markdown, setMarkdown] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleDraft() {
    setMarkdown('')
    setStreaming(true)
    try {
      const res = await fetch('/api/icfr/test-procedure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'manual',
        body: JSON.stringify({ controlId, testType }),
      })
      if (res.status === 401 || res.status === 307 || res.status === 302) {
        toast.error('Session expired. Please refresh and sign in again.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(data.error ?? 'Could not draft the procedure.')
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
      toast.error('Network error while drafting the procedure.')
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">Test procedure</h3>
        <div className="ml-auto flex items-center gap-2">
          <NativeSelect
            aria-label="Test type"
            value={testType}
            onChange={(e) => setTestType(e.target.value)}
            disabled={streaming}
            className="h-7 w-auto text-xs"
          >
            {optionsFrom(TEST_TYPES, TEST_TYPE_LABEL)}
          </NativeSelect>
          <Button size="xs" variant="outline" onClick={handleDraft} disabled={streaming}>
            {streaming ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {markdown ? 'Redraft' : 'Draft test procedure'}
          </Button>
        </div>
      </div>
      {markdown && (
        <div className="space-y-2">
          <PolicyMarkdown markdown={markdown} className="max-h-96 overflow-y-auto p-4 text-xs" />
          <div className="flex justify-end gap-2">
            <Button size="xs" variant="ghost" onClick={handleCopy} disabled={streaming}>
              {copied ? <Check /> : <Copy />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="xs" onClick={() => onUse(markdown, testType)} disabled={streaming}>
              <FileText />
              Use in new test
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
