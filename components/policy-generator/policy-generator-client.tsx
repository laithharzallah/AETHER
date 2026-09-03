'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, Copy, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PolicyMarkdown } from '@/components/policy-markdown'
import { savePolicy } from '@/lib/actions/policies'
import { POLICY_TYPES } from '@/lib/policy-generator/constants'
import { cn } from '@/lib/utils'

export type FrameworkOption = {
  code: string
  label: string
  jurisdiction: string
  controlCount: number
}

type PolicyGeneratorClientProps = {
  frameworkOptions: FrameworkOption[]
  libraryAvailable: boolean
}

const JURISDICTION_ORDER = ['SA', 'AE', 'QA', 'JO', 'BH', 'KW', 'OM', 'EU', 'INTL']
const JURISDICTION_SHORT: Record<string, string> = {
  SA: 'Saudi Arabia',
  AE: 'UAE',
  QA: 'Qatar',
  JO: 'Jordan',
  BH: 'Bahrain',
  KW: 'Kuwait',
  OM: 'Oman',
  EU: 'EU',
  INTL: 'International',
}

function cleanStreamChunk(raw: string): string {
  return raw
    .replace(/(?:<!-- stream-pad -->\n?)+/g, '')
    .replace(/\u200B/g, '')
}

export function PolicyGeneratorClient({
  frameworkOptions,
  libraryAvailable,
}: PolicyGeneratorClientProps) {
  const [policyType, setPolicyType] = useState<string>('')
  const [frameworks, setFrameworks] = useState<string[]>([])
  const [orgContext, setOrgContext] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [hasStreamContent, setHasStreamContent] = useState(false)
  const [title, setTitle] = useState('')
  const [savedPolicyId, setSavedPolicyId] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  const canGenerate =
    Boolean(policyType) && frameworks.length > 0 && !isGenerating

  const grouped = useMemo(() => {
    const map = new Map<string, FrameworkOption[]>()
    for (const f of frameworkOptions) {
      if (!map.has(f.jurisdiction)) map.set(f.jurisdiction, [])
      map.get(f.jurisdiction)!.push(f)
    }
    return [...map.entries()].sort(
      (a, b) =>
        JURISDICTION_ORDER.indexOf(a[0]) - JURISDICTION_ORDER.indexOf(b[0])
    )
  }, [frameworkOptions])

  const selectedControlCount = useMemo(
    () =>
      frameworkOptions
        .filter((f) => frameworks.includes(f.code))
        .reduce((n, f) => n + f.controlCount, 0),
    [frameworkOptions, frameworks]
  )

  useEffect(() => {
    if (!isGenerating) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isGenerating])

  function toggleFramework(code: string) {
    setFrameworks((prev) =>
      prev.includes(code) ? prev.filter((f) => f !== code) : [...prev, code]
    )
  }

  async function handleGenerate() {
    if (!canGenerate) return

    setError(null)
    setMarkdown('')
    setIsComplete(false)
    setCopied(false)
    setSavedPolicyId(null)
    setHasStreamContent(false)
    setElapsedSeconds(0)
    setIsGenerating(true)
    if (!title) setTitle(policyType)

    try {
      const res = await fetch('/api/generate-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'manual',
        body: JSON.stringify({
          policyType,
          frameworks,
          orgContext: orgContext.trim() || undefined,
        }),
      })

      if (res.status === 401 || res.status === 307 || res.status === 302) {
        setError('Session expired. Please refresh the page and sign in again.')
        return
      }

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Failed to generate policy.')
        return
      }

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('text/plain')) {
        setError('Unexpected response from server. Please try again.')
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
        const cleaned = cleanStreamChunk(accumulated)
        if (cleaned.trim().length > 0) setHasStreamContent(true)
        setMarkdown(cleaned)
      }

      accumulated = cleanStreamChunk(accumulated)
      if (!accumulated.trim()) {
        setError('Generation finished with no content. Please try again.')
        return
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

  function handleSave() {
    if (!markdown || !isComplete || savedPolicyId) return
    startSaving(async () => {
      const result = await savePolicy({
        title: title.trim() || policyType,
        policyType,
        frameworks,
        orgContext: orgContext.trim() || undefined,
        contentMd: markdown,
        model: 'claude-sonnet-4-5',
      })
      if (result.ok) {
        setSavedPolicyId(result.policyId)
        toast.success(
          result.mappedControls > 0
            ? `Saved with ${result.mappedControls} control mapping${result.mappedControls === 1 ? '' : 's'}.`
            : 'Policy saved to your library.'
        )
      } else {
        toast.error(result.error)
      }
    })
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
        Draft board-grade compliance policies grounded in AETHER&apos;s
        regulatory library — every statement cites a real control.
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

          <div className="space-y-3">
            <Label>Frameworks</Label>
            {grouped.map(([jurisdiction, options]) => (
              <div key={jurisdiction}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {JURISDICTION_SHORT[jurisdiction] ?? jurisdiction}
                </p>
                <div className="flex flex-wrap gap-2">
                  {options.map((f) => {
                    const selected = frameworks.includes(f.code)
                    return (
                      <Button
                        key={f.code}
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-pressed={selected}
                        onClick={() => toggleFramework(f.code)}
                        className={cn(
                          selected &&
                            'border-foreground/30 bg-foreground/5 text-foreground'
                        )}
                      >
                        {f.label}
                        {f.controlCount > 0 && (
                          <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">
                            {f.controlCount}
                          </span>
                        )}
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              {frameworks.length === 0
                ? 'Select at least one framework.'
                : `${frameworks.length} framework${frameworks.length === 1 ? '' : 's'} selected${
                    libraryAvailable
                      ? ` · ${selectedControlCount.toLocaleString()} controls available for citation`
                      : ''
                  }.`}
              {!libraryAvailable && (
                <>
                  {' '}
                  The regulatory library is not seeded yet, so citations will
                  rely on the model&apos;s own knowledge.{' '}
                  <Link href="/dashboard/regulations" className="underline">
                    Learn more
                  </Link>
                  .
                </>
              )}
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
              placeholder='e.g. "Saudi fintech, 200 employees, cloud-first, SAMA-licensed"'
              rows={3}
              className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>

          <Button type="button" onClick={handleGenerate} disabled={!canGenerate}>
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
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
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
            <div className="mb-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                {hasStreamContent
                  ? 'Streaming policy content…'
                  : elapsedSeconds < 20
                    ? 'Starting generation…'
                    : elapsedSeconds < 90
                      ? 'Drafting policy — first text usually appears within a few seconds; large policies can take 1–2 minutes on the free tier.'
                      : 'Still generating — almost done. Full policies can take up to 2 minutes.'}
              </div>
              {!hasStreamContent && elapsedSeconds > 0 && (
                <p className="text-xs tabular-nums">
                  Elapsed: {elapsedSeconds}s
                  {elapsedSeconds >= 10 &&
                    ' — the model is drafting a full board-grade policy with framework control mappings.'}
                </p>
              )}
            </div>
          )}

          {isComplete && markdown && (
            <div className="mb-5 flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="policy-title">Save to library as</Label>
                <Input
                  id="policy-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={policyType}
                  disabled={Boolean(savedPolicyId) || saving}
                />
              </div>
              {savedPolicyId ? (
                <Link
                  href={`/dashboard/policies/${savedPolicyId}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm hover:bg-muted"
                >
                  <Check className="h-4 w-4" />
                  Saved · Open
                </Link>
              ) : (
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-4 w-4" />
                      Save policy
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {markdown ? (
            <PolicyMarkdown
              markdown={markdown}
              className={cn(isGenerating && 'opacity-90')}
            />
          ) : (
            isGenerating && (
              <p className="text-sm text-muted-foreground">
                Waiting for the first section of your policy…
              </p>
            )
          )}

          {!isGenerating && !markdown && (
            <p className="text-sm text-muted-foreground">
              Configure the form above and click Generate Policy to start.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
