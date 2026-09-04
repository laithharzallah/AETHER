'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Search, ShieldQuestion } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Control } from '@/lib/regulatory-library/queries'
import { cn } from '@/lib/utils'

type Lang = 'en' | 'ar'

type ControlsExplorerProps = {
  frameworkCode: string
  frameworkName: string
  controls: Control[]
}

const FIDELITY_LABEL: Record<string, string> = {
  structural: 'Structural',
  paraphrased: 'Paraphrased',
  summarized: 'Summarized',
}

const CRITICALITY_CLASS: Record<string, string> = {
  high: 'text-danger',
  medium: 'text-warning-foreground',
  low: 'text-muted-foreground',
}

export function ControlsExplorer({
  frameworkName,
  controls,
}: ControlsExplorerProps) {
  const [lang, setLang] = useState<Lang>('en')
  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState<string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const deferredQuery = useDeferredValue(query)

  const domains = useMemo(() => {
    const seen = new Map<string, string | null>()
    for (const c of controls) {
      const key = c.domain_en ?? 'General'
      if (!seen.has(key)) seen.set(key, c.domain_ar)
    }
    return [...seen.entries()].map(([en, ar]) => ({ en, ar }))
  }, [controls])

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return controls.filter((c) => {
      if (domain !== 'all' && (c.domain_en ?? 'General') !== domain) return false
      if (!q) return true
      const hay = [
        c.control_ref,
        c.title_en,
        c.title_ar,
        c.requirement_en,
        c.requirement_ar,
        c.subdomain_en,
        c.subdomain_ar,
        c.domain_en,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [controls, deferredQuery, domain])

  const groupedByDomain = useMemo(() => {
    const groups = new Map<string, Control[]>()
    for (const c of filtered) {
      const key = c.domain_en ?? 'General'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(c)
    }
    return groups
  }, [filtered])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const verifiedCount = controls.filter((c) => c.verified).length
  const isAr = lang === 'ar'

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${frameworkName} controls…`}
            className="pl-8"
            aria-label="Search controls"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={lang === 'en' ? 'secondary' : 'ghost'}
              onClick={() => setLang('en')}
              className="h-7 px-3"
            >
              EN
            </Button>
            <Button
              type="button"
              size="sm"
              variant={lang === 'ar' ? 'secondary' : 'ghost'}
              onClick={() => setLang('ar')}
              className="h-7 px-3"
            >
              عربي
            </Button>
          </div>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            aria-label="Filter by domain"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="all">All domains</option>
            {domains.map((d) => (
              <option key={d.en} value={d.en}>
                {isAr && d.ar ? d.ar : d.en}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {filtered.length} of {controls.length} controls
        </span>
        {verifiedCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-success">
            <CheckCircle2 className="h-3 w-3" />
            {verifiedCount} of {controls.length} reviewed by a named reviewer
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-warning-foreground">
            <ShieldQuestion className="h-3 w-3" />
            No control in this framework has been reviewed by a named human yet
          </span>
        )}
        <span>
          Text is machine-drafted from the primary source. Cite the regulator&apos;s
          own document in formal submissions.
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No controls match your search.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {[...groupedByDomain.entries()].map(([domainKey, items]) => {
            const domainAr = items[0]?.domain_ar
            return (
              <section key={domainKey}>
                <h2
                  className={cn(
                    'mb-3 text-sm font-medium tracking-wide uppercase',
                    isAr && domainAr && 'text-right'
                  )}
                  dir={isAr && domainAr ? 'rtl' : 'ltr'}
                >
                  {isAr && domainAr ? domainAr : domainKey}
                  <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </h2>
                <div className="surface overflow-hidden">
                  {items.map((c, i) => {
                    const open = expanded.has(c.id)
                    const title = isAr && c.title_ar ? c.title_ar : c.title_en
                    const requirement =
                      isAr && c.requirement_ar ? c.requirement_ar : c.requirement_en
                    const subdomain =
                      isAr && c.subdomain_ar ? c.subdomain_ar : c.subdomain_en
                    const rtl = isAr && Boolean(c.title_ar)

                    return (
                      <div
                        key={c.id}
                        className={cn(
                          'bg-card',
                          i > 0 && 'border-t border-border'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          aria-expanded={open}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/[0.03]"
                        >
                          {open ? (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                            {c.control_ref}
                          </code>
                          <div
                            className={cn('min-w-0 flex-1', rtl && 'text-right')}
                            dir={rtl ? 'rtl' : 'ltr'}
                            lang={rtl ? 'ar' : 'en'}
                          >
                            <p className="text-sm font-medium">{title}</p>
                            {subdomain && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {subdomain}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {c.criticality && (
                              <span
                                className={cn(
                                  'text-[11px] font-medium uppercase',
                                  CRITICALITY_CLASS[c.criticality]
                                )}
                              >
                                {c.criticality}
                              </span>
                            )}
                            {c.verified ? (
                              <span
                                title={
                                  c.verified_by
                                    ? `Reviewed by ${c.verified_by}${c.verified_at ? ` · ${c.verified_at}` : ''}`
                                    : 'Reviewed'
                                }
                              >
                                <CheckCircle2
                                  className="h-4 w-4 text-success"
                                  aria-label={`Reviewed by ${c.verified_by ?? 'a named reviewer'}`}
                                />
                              </span>
                            ) : (
                              <span title="Not yet reviewed by a human">
                                <ShieldQuestion
                                  className="h-4 w-4 text-muted-foreground/50"
                                  aria-label="Not yet reviewed by a human"
                                />
                              </span>
                            )}
                          </div>
                        </button>

                        {open && (
                          <div
                            className={cn(
                              'border-t border-border bg-muted/20 px-4 py-4 pl-[3.25rem]',
                              rtl && 'pr-[3.25rem] pl-4 text-right'
                            )}
                            dir={rtl ? 'rtl' : 'ltr'}
                            lang={rtl ? 'ar' : 'en'}
                          >
                            <p className="text-sm leading-relaxed text-foreground/90">
                              {requirement}
                            </p>
                            {c.evidence_en && (
                              <div className="mt-3" dir="ltr" lang="en">
                                <p className="text-xs font-medium text-muted-foreground uppercase">
                                  Evidence an assessor expects
                                </p>
                                <p className="mt-1 text-sm text-foreground/80">
                                  {c.evidence_en}
                                </p>
                              </div>
                            )}
                            <div
                              className="mt-3 flex flex-wrap items-center gap-2"
                              dir="ltr"
                            >
                              {c.control_type && (
                                <Badge variant="outline" className="capitalize">
                                  {c.control_type}
                                </Badge>
                              )}
                              <Badge variant="ghost">
                                {FIDELITY_LABEL[c.fidelity] ?? c.fidelity}
                              </Badge>
                              {c.verified ? (
                                <span className="inline-flex items-center gap-1 text-xs text-success">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Reviewed by {c.verified_by}
                                  {c.verified_at ? ` · ${c.verified_at}` : ''}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Machine-drafted · not yet reviewed by a named human.
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
