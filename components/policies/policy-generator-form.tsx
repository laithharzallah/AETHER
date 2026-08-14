'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { Check, CircleAlert, CircleCheck, Copy, Loader2, Save } from 'lucide-react'
import { createPolicy, type PolicyActionState } from '@/lib/actions/policies'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Pill } from '@/components/dashboard/pills'
import { PolicyMarkdown } from '@/components/policies/policy-markdown'
import { assessPolicyCompleteness } from '@/lib/policy/completeness'
import { cn } from '@/lib/utils'

export type TemplateOption = {
  code: string
  title: string
  description: string | null
  framework_codes: string[]
  required_sections: Array<{ heading: string; guidance?: string }>
}

export type FrameworkOption = {
  code: string
  name: string
  short_name: string | null
  regulator: string
  mandatory: boolean
  /** True when the tenant holds controls for it. */
  held: boolean
}

function cleanStreamChunk(raw: string): string {
  return raw.replace(/(?:<!-- stream-pad -->\n?)+/g, '').replace(/\u200B/g, '')
}

/** The streaming route appends in-band errors after this marker. */
const STREAM_ERROR_MARKER = '\n\n---\nError: '

export function PolicyGeneratorForm({
  templates,
  frameworks,
  initialTemplate,
}: {
  templates: TemplateOption[]
  frameworks: FrameworkOption[]
  initialTemplate?: string
}) {
  const [templateCode, setTemplateCode] = useState(initialTemplate ?? '')
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(() =>
    frameworks.filter((f) => f.held && f.mandatory).map((f) => f.code)
  )
  const [orgContext, setOrgContext] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [streaming, setStreaming] = useState(false)

  const [saveState, saveAction, savePending] = useActionState<PolicyActionState, FormData>(
    createPolicy,
    {}
  )

  const template = templates.find((t) => t.code === templateCode)

  /**
   * Choosing a template pre-selects the frameworks it is written against,
   * intersected with what the tenant holds — offering to cite a framework they
   * are not assessed against produces a policy nobody can use.
   *
   * Done in the change handler rather than an effect: this responds to a user
   * action, not to synchronisation with an external system.
   */
  function selectTemplate(code: string) {
    setTemplateCode(code)

    const chosen = templates.find((t) => t.code === code)
    if (!chosen) return

    const held = new Set(frameworks.filter((f) => f.held).map((f) => f.code))
    const suggested = chosen.framework_codes.filter((framework) => held.has(framework))
    if (suggested.length > 0) setSelectedFrameworks(suggested)
  }

  useEffect(() => {
    if (!isGenerating) return
    const startedAt = Date.now()
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    )
    return () => window.clearInterval(timer)
  }, [isGenerating])

  const completeness = useMemo(() => {
    if (!markdown.trim() || !template || template.required_sections.length === 0) {
      return null
    }
    return assessPolicyCompleteness(markdown, template.required_sections)
  }, [markdown, template])

  const canGenerate = Boolean(templateCode) && selectedFrameworks.length > 0 && !isGenerating

  function toggleFramework(code: string) {
    setSelectedFrameworks((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  async function handleGenerate() {
    if (!canGenerate || !template) return

    setError(null)
    setMarkdown('')
    setIsComplete(false)
    setCopied(false)
    setStreaming(false)
    setElapsed(0)
    setIsGenerating(true)

    try {
      const response = await fetch('/api/generate-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'manual',
        body: JSON.stringify({
          policyType: template.title,
          templateCode: template.code,
          frameworks: selectedFrameworks,
          orgContext: orgContext.trim() || undefined,
        }),
      })

      if ([401, 302, 307].includes(response.status)) {
        setError('Your session expired. Refresh the page and sign in again.')
        return
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        setError(data.error ?? 'Failed to generate the policy.')
        return
      }

      if (!response.body) {
        setError('No response stream was received.')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const cleaned = cleanStreamChunk(accumulated)
        if (cleaned.trim().length > 0) setStreaming(true)
        setMarkdown(cleaned)
      }

      const final = cleanStreamChunk(accumulated)

      // The route commits a 200 before the model finishes, so a mid-stream
      // failure arrives as text. Surface it rather than saving it as policy.
      const errorIndex = final.indexOf(STREAM_ERROR_MARKER)
      if (errorIndex >= 0) {
        setMarkdown(final.slice(0, errorIndex))
        setError(final.slice(errorIndex + STREAM_ERROR_MARKER.length).trim())
        return
      }

      if (!final.trim()) {
        setError('Generation finished with no content. Please try again.')
        return
      }

      setMarkdown(final)
      setIsComplete(true)
    } catch {
      setError('Network error while generating the policy. Please try again.')
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
      setError('Could not copy to the clipboard.')
    }
  }

  const heldFrameworks = frameworks.filter((f) => f.held)
  const otherFrameworks = frameworks.filter((f) => !f.held)

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium">Configuration</h2>

        <div className="mt-4 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="template">Policy</Label>
            <select
              id="template"
              value={templateCode}
              onChange={(event) => selectTemplate(event.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">Select a policy…</option>
              {templates.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.title}
                </option>
              ))}
            </select>
            {template?.description && (
              <p className="text-xs text-muted-foreground">{template.description}</p>
            )}
            {template && template.required_sections.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {template.required_sections.length} required sections will be requested,
                and the draft is scored against them.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Frameworks to cite</Label>
            {heldFrameworks.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Your organization holds no framework controls yet, so there are no real
                control identifiers to cite. Set up frameworks in Settings first —
                otherwise the policy can only describe requirements generically.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {heldFrameworks.map((framework) => {
                    const selected = selectedFrameworks.includes(framework.code)
                    return (
                      <button
                        key={framework.code}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleFramework(framework.code)}
                        title={`${framework.name} — ${framework.regulator}`}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                          selected
                            ? 'border-foreground/30 bg-foreground/5 font-medium text-foreground'
                            : 'border-input text-muted-foreground hover:bg-foreground/5'
                        )}
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {framework.short_name ?? framework.code}
                        {framework.mandatory && (
                          <span
                            className="text-[10px] text-amber-600 dark:text-amber-400"
                            title="Mandatory for your organization"
                          >
                            ●
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedFrameworks.length === 0
                    ? 'Select at least one framework.'
                    : `${selectedFrameworks.length} selected. Only real control identifiers from these are offered to the model.`}
                </p>
              </>
            )}

            {otherFrameworks.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Frameworks you do not hold controls for ({otherFrameworks.length})
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {otherFrameworks.map((framework) => {
                    const selected = selectedFrameworks.includes(framework.code)
                    return (
                      <button
                        key={framework.code}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleFramework(framework.code)}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                          selected
                            ? 'border-foreground/30 bg-foreground/5 font-medium'
                            : 'border-input text-muted-foreground hover:bg-foreground/5'
                        )}
                      >
                        {framework.short_name ?? framework.code}
                      </button>
                    )
                  })}
                </div>
              </details>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-context">
              Organization context{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id="org-context"
              value={orgContext}
              onChange={(event) => setOrgContext(event.target.value)}
              placeholder="e.g. Saudi fintech, 200 employees, cloud-first on AWS Bahrain, no on-premise estate, outsourced SOC"
              rows={3}
              className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <p className="text-xs text-muted-foreground">
              The more specific this is, the fewer generic statements the policy will
              contain.
            </p>
          </div>

          <Button type="button" onClick={handleGenerate} disabled={!canGenerate}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Drafting…
              </>
            ) : (
              'Generate policy'
            )}
          </Button>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {(markdown || isGenerating) && (
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">Draft</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {isGenerating
                  ? streaming
                    ? 'Streaming…'
                    : elapsed < 15
                      ? 'Starting…'
                      : `Still drafting (${elapsed}s). A full policy with control mappings takes up to two minutes.`
                  : isComplete
                    ? 'Complete. Review it before saving — you are accountable for what it says, not the model.'
                    : 'Incomplete.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {markdown && (
                <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </Button>
              )}

              {isComplete && markdown && template && (
                <form action={saveAction}>
                  <input type="hidden" name="title" value={template.title} />
                  <input type="hidden" name="policyType" value={template.title} />
                  <input type="hidden" name="templateCode" value={template.code} />
                  <input type="hidden" name="contentMd" value={markdown} />
                  <input type="hidden" name="source" value="ai_generated" />
                  {selectedFrameworks.map((code) => (
                    <input key={code} type="hidden" name="frameworkCodes" value={code} />
                  ))}
                  <Button type="submit" size="sm" disabled={savePending}>
                    {savePending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Save as draft
                  </Button>
                </form>
              )}
            </div>
          </div>

          {saveState.error && (
            <p role="alert" className="mt-3 text-xs text-destructive">
              {saveState.error}
            </p>
          )}

          {completeness && (
            <div className="mt-4 rounded-lg bg-foreground/[0.03] p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-medium">Completeness against the template</p>
                <p
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    completeness.score >= 90
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : completeness.score >= 60
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-destructive'
                  )}
                >
                  {completeness.score}%
                </p>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                {completeness.sections.map((section) => (
                  <span
                    key={section.heading}
                    className="inline-flex items-center gap-1 text-[11px]"
                    title={
                      section.present
                        ? `${section.wordCount} words`
                        : 'Not found in the draft'
                    }
                  >
                    {section.present && !section.thin ? (
                      <CircleCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <CircleAlert
                        className={
                          section.present
                            ? 'h-3 w-3 text-amber-600 dark:text-amber-400'
                            : 'h-3 w-3 text-destructive'
                        }
                      />
                    )}
                    <span className={section.present ? '' : 'text-muted-foreground'}>
                      {section.heading}
                    </span>
                  </span>
                ))}
              </div>

              {completeness.citedControls.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] text-muted-foreground">
                    {completeness.citedControls.length} control citation(s) detected
                    across {completeness.citedFrameworks.join(', ')}. These are mapped to
                    your control library when you save.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {completeness.citedControls.slice(0, 18).map((control) => (
                      <Pill key={`${control.framework}-${control.code}`}>
                        {control.framework} {control.code}
                      </Pill>
                    ))}
                    {completeness.citedControls.length > 18 && (
                      <Pill>+{completeness.citedControls.length - 18}</Pill>
                    )}
                  </div>
                </div>
              )}

              {completeness.warnings.length > 0 && !isGenerating && (
                <ul className="mt-3 space-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                  {completeness.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {markdown ? (
            <div
              className={cn(
                'prose-policy mt-4 rounded-lg border border-border/60 p-6',
                isGenerating && 'opacity-90'
              )}
            >
              <PolicyMarkdown>{markdown}</PolicyMarkdown>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Waiting for the first section…
            </p>
          )}
        </section>
      )}
    </div>
  )
}
