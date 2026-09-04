'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, NativeSelect, TextInput, Textarea } from '@/components/erm/fields'
import { ScoreChip } from '@/components/erm/badges'
import {
  TREATMENT_STRATEGY_LABEL,
  VELOCITY_LABEL,
  type TreatmentStrategy,
} from '@/lib/erm/constants'
import { importCandidateRisks, type CandidateRisk } from '@/lib/actions/erm'
import { cn } from '@/lib/utils'

export function IdentifyRisksDialog({
  categoryNames,
}: {
  categoryNames: Record<string, string>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [businessContext, setBusinessContext] = useState('')
  const [sector, setSector] = useState('')
  const [objectives, setObjectives] = useState('')
  const [count, setCount] = useState('8')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<CandidateRisk[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [pending, startTransition] = useTransition()

  async function identify() {
    setLoading(true)
    setError(null)
    setCandidates([])
    setSelected(new Set())
    try {
      const res = await fetch('/api/erm/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessContext,
          sector,
          objectives,
          count: Number(count),
        }),
      })
      const data = (await res.json()) as { risks?: CandidateRisk[]; error?: string }
      if (!res.ok || !data.risks) {
        setError(data.error ?? 'Could not identify risks.')
        return
      }
      setCandidates(data.risks)
      setSelected(new Set(data.risks.map((_, i) => i)))
    } catch {
      setError('Network error while identifying risks.')
    } finally {
      setLoading(false)
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function addSelected() {
    const chosen = candidates.filter((_, i) => selected.has(i))
    if (chosen.length === 0) return
    startTransition(async () => {
      const result = await importCandidateRisks(chosen)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        `${result.data?.created ?? 0} risks added to the register${
          result.data?.skipped ? `, ${result.data.skipped} skipped` : ''
        }.`
      )
      setOpen(false)
      setCandidates([])
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Sparkles className="h-4 w-4" />
        Identify risks
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Identify candidate risks</DialogTitle>
          <DialogDescription>
            Drafts candidate risks in register shape — source → event → consequence, an
            inherent score on the calibrated 5×5 scales, velocity, and suggested ISO 31000
            treatments. Everything is a draft for the workshop to challenge, not a result.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Sector" className="sm:col-span-2">
              <TextInput
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Petrochemicals, Saudi Arabia — Tadawul listed"
              />
            </Field>
            <Field label="How many">
              <NativeSelect value={count} onChange={(e) => setCount(e.target.value)}>
                {[5, 8, 10, 12, 15].map((n) => (
                  <option key={n} value={n}>
                    {n} risks
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Field label="Business context" htmlFor="erm-identify-context">
            <Textarea
              id="erm-identify-context"
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              rows={3}
              placeholder="What the entity does, its scale, where it operates, and anything unusual about its operating model."
            />
          </Field>

          <Field
            label="Objectives"
            htmlFor="erm-identify-objectives"
            hint="Risk is the effect of uncertainty on objectives — name them and the risks stay anchored."
          >
            <Textarea
              id="erm-identify-objectives"
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              rows={3}
            />
          </Field>

          <Button
            type="button"
            onClick={identify}
            disabled={loading || !businessContext.trim()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {candidates.length ? 'Identify again' : 'Identify'}
          </Button>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        {candidates.length > 0 && (
          <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
            {candidates.map((c, i) => {
              const active = selected.has(i)
              return (
                <button
                  key={`${c.title}-${i}`}
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={active}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                    active
                      ? 'border-foreground/40 bg-foreground/[0.04]'
                      : 'border-border hover:bg-primary/[0.03]'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.title}</span>
                    <ScoreChip
                      label="Inherent"
                      likelihood={c.inherent_likelihood}
                      impact={c.inherent_impact}
                    />
                    {c.category_code && (
                      <span className="pill pill-neutral">
                        {categoryNames[c.category_code] ?? c.category_code}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      Velocity: {VELOCITY_LABEL[c.velocity]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{c.description}</p>
                  {c.treatments.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {c.treatments.map((t, ti) => (
                        <li key={ti} className="text-xs text-muted-foreground">
                          <span className="pill pill-info mr-1.5">
                            {TREATMENT_STRATEGY_LABEL[t.strategy as TreatmentStrategy] ??
                              t.strategy}
                          </span>
                          {t.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <DialogFooter showCloseButton>
          <Button
            type="button"
            onClick={addSelected}
            disabled={pending || selected.size === 0}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add {selected.size} to the register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
