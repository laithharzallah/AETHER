'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FRAMEWORKS, POLICY_TYPES } from '@/lib/policy-generator/constants'
import { cn } from '@/lib/utils'

export default function PolicyGeneratorPage() {
  const [policyType, setPolicyType] = useState<string>('')
  const [frameworks, setFrameworks] = useState<string[]>([])
  const [orgContext, setOrgContext] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [copied, setCopied] = useState(false)

  const canGenerate =
    Boolean(policyType) && frameworks.length > 0 && !isGenerating

  function toggleFramework(framework: string) {
    setFrameworks((prev) =>
      prev.includes(framework)
        ? prev.filter((f) => f !== framework)
        : [...prev, framework]
    )
  }

  async function handleGenerate() {
    if (!canGenerate) return

    setError(null)
    setMarkdown('')
    setIsComplete(false)
    setCopied(false)
    setIsGenerating(true)

    try {
      const res = await fetch('/api/generate-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyType,
          frameworks,
          orgContext: orgContext.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Failed to generate policy.')
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
        setMarkdown(accumulated)
      }

      setIsComplete(true)
    } catch {
      setError('Network error while generating policy. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleCopy() {
    if (!markdown) return
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Failed to copy to clipboard.')
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1
        className="text-3xl tracking-tight md:text-4xl"
        style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
      >
        Policy Generator
      </h1>
      <p className="mt-3 text-muted-foreground">
        Draft board-grade compliance policies aligned to GCC and international
        frameworks.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Select a policy type and the frameworks it should align to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="policy-type">Policy type</Label>
            <Select
              value={policyType}
              onValueChange={(value) => setPolicyType(value ?? '')}
            >
              <SelectTrigger id="policy-type" className="w-full">
                <SelectValue placeholder="Select a policy type" />
              </SelectTrigger>
              <SelectContent>
                {POLICY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Frameworks</Label>
            <div className="flex flex-wrap gap-2">
              {FRAMEWORKS.map((framework) => {
                const selected = frameworks.includes(framework)
                return (
                  <Button
                    key={framework}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={selected}
                    onClick={() => toggleFramework(framework)}
                    className={cn(
                      selected &&
                        'border-foreground/30 bg-foreground/5 text-foreground'
                    )}
                  >
                    {framework}
                  </Button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Select at least one framework.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-context">
              Organization context{' '}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <textarea
              id="org-context"
              value={orgContext}
              onChange={(e) => setOrgContext(e.target.value)}
              placeholder='e.g. "Saudi fintech, 200 employees, cloud-first"'
              rows={3}
              className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>

          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              'Generate Policy'
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div
          className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Generated policy</CardTitle>
            <CardDescription>
              {isGenerating
                ? 'Streaming policy content…'
                : isComplete
                  ? 'Generation complete.'
                  : 'Your policy will appear here.'}
            </CardDescription>
          </div>
          {isComplete && markdown && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isGenerating && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Generating policy…
            </div>
          )}

          {markdown ? (
            <div
              className={cn(
                'prose-policy rounded-lg border border-border/60 bg-card p-6',
                isGenerating && 'opacity-90'
              )}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-4 text-2xl font-semibold tracking-tight">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mt-8 mb-3 text-xl font-semibold tracking-tight">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mt-6 mb-2 text-lg font-medium">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3 leading-relaxed text-foreground/90">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-4 list-disc space-y-1 pl-6">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-4 list-decimal space-y-1 pl-6">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed">{children}</li>
                  ),
                  table: ({ children }) => (
                    <div className="my-4 overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-muted/50">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border/60 px-3 py-2 text-left font-medium">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border/60 px-3 py-2 align-top">
                      {children}
                    </td>
                  ),
                  hr: () => <hr className="my-6 border-border/60" />,
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          ) : (
            !isGenerating && (
              <p className="text-sm text-muted-foreground">
                Configure the form above and click Generate Policy to start.
              </p>
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}
