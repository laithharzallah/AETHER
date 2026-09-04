'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AssertionChips } from '@/components/icfr/badges'
import { Checkbox, Field, NativeSelect, Textarea } from '@/components/icfr/fields'
import { createRisk, deleteRisk, updateRisk } from '@/lib/actions/icfr'
import type { RiskWithLinks } from '@/lib/icfr/queries'
import { ASSERTIONS, ASSERTION_LABEL } from '@/lib/icfr/constants'

function nextRef(risks: RiskWithLinks[]) {
  const nums = risks
    .map((r) => Number(r.ref.replace(/^[A-Za-z]+/, '')))
    .filter((n) => Number.isFinite(n))
  return `R${(nums.length ? Math.max(...nums) : 0) + 1}`
}

function RiskForm({
  processId,
  risk,
  nextRef: suggestedRef,
  onDone,
}: {
  processId: string
  risk?: RiskWithLinks
  nextRef?: string
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [assertions, setAssertions] = useState<string[]>(risk?.assertions ?? [])

  function toggleAssertion(a: string) {
    setAssertions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input = {
      ref: String(fd.get('ref') ?? ''),
      description: String(fd.get('description') ?? ''),
      assertions,
      likelihood: fd.get('likelihood') ? Number(fd.get('likelihood')) : null,
      impact: fd.get('impact') ? Number(fd.get('impact')) : null,
      fraudRisk: fd.get('fraudRisk') === 'on',
    }
    startTransition(async () => {
      const result = risk
        ? await updateRisk(risk.id, processId, input)
        : await createRisk(processId, input)
      if (result.ok) {
        toast.success(risk ? 'Risk updated.' : 'Risk added.')
        router.refresh()
        onDone()
      } else {
        toast.error(result.error)
      }
    })
  }

  const scale = ['', '1', '2', '3', '4', '5']

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="grid gap-3 sm:grid-cols-[90px_1fr]">
        <Field label="Ref" htmlFor="r-ref">
          <Input id="r-ref" name="ref" defaultValue={risk?.ref ?? suggestedRef ?? ''} required />
        </Field>
        <Field label="What could go wrong" htmlFor="r-desc">
          <Textarea id="r-desc" name="description" defaultValue={risk?.description ?? ''} required className="min-h-16" />
        </Field>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Assertions</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
          {ASSERTIONS.map((a) => (
            <Checkbox
              key={a}
              label={ASSERTION_LABEL[a]}
              checked={assertions.includes(a)}
              onChange={() => toggleAssertion(a)}
              className="text-xs"
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Likelihood (1–5)" htmlFor="r-lik" className="w-28">
          <NativeSelect id="r-lik" name="likelihood" defaultValue={risk?.likelihood?.toString() ?? ''}>
            {scale.map((s) => (
              <option key={s} value={s}>
                {s || '—'}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Impact (1–5)" htmlFor="r-imp" className="w-28">
          <NativeSelect id="r-imp" name="impact" defaultValue={risk?.impact?.toString() ?? ''}>
            {scale.map((s) => (
              <option key={s} value={s}>
                {s || '—'}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Checkbox name="fraudRisk" label="Fraud risk" defaultChecked={risk?.fraud_risk ?? false} className="h-8" />
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {risk ? 'Save' : 'Add risk'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export function RisksTable({
  processId,
  risks,
  controlRefById,
}: {
  processId: string
  risks: RiskWithLinks[]
  controlRefById: Map<string, string>
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDelete(id: string) {
    if (confirmId !== id) {
      setConfirmId(id)
      setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 4000)
      return
    }
    startTransition(async () => {
      const result = await deleteRisk(id, processId)
      if (result.ok) {
        toast.success('Risk deleted.')
        router.refresh()
      } else {
        toast.error(result.error)
      }
      setConfirmId(null)
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {risks.length} risk{risks.length === 1 ? '' : 's'} ·{' '}
          {risks.filter((r) => r.fraud_risk).length} fraud
        </p>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add risk
          </Button>
        )}
      </div>

      {adding && (
        <RiskForm processId={processId} nextRef={nextRef(risks)} onDone={() => setAdding(false)} />
      )}

      {risks.length === 0 && !adding ? (
        <p className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          No risks yet. Start with what could go wrong in this process.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2.5 font-medium">Risk</th>
                <th className="hidden px-3 py-2.5 font-medium md:table-cell">Assertions</th>
                <th className="hidden px-3 py-2.5 font-medium sm:table-cell">L × I</th>
                <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Controls</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {risks.map((r) =>
                editingId === r.id ? (
                  <tr key={r.id} className="border-t border-border/60">
                    <td colSpan={5} className="p-2">
                      <RiskForm processId={processId} risk={r} onDone={() => setEditingId(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-foreground/[0.02]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                          {r.ref}
                        </code>
                        <span>{r.description}</span>
                        {r.fraud_risk && (
                          <Badge variant="destructive" className="shrink-0">
                            Fraud
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      <AssertionChips assertions={r.assertions} />
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs tabular-nums sm:table-cell">
                      {r.likelihood && r.impact ? (
                        <span title="Likelihood × Impact">
                          {r.likelihood}×{r.impact} = {r.likelihood * r.impact}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2.5 lg:table-cell">
                      {r.control_ids.length === 0 ? (
                        <span className="text-xs text-amber-600 dark:text-amber-400">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.control_ids.map((cid) => (
                            <code key={cid} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                              {controlRefById.get(cid) ?? '?'}
                            </code>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Edit risk"
                        onClick={() => setEditingId(r.id)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant={confirmId === r.id ? 'destructive' : 'ghost'}
                        size={confirmId === r.id ? 'xs' : 'icon-xs'}
                        aria-label="Delete risk"
                        disabled={pending}
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 />
                        {confirmId === r.id && 'Confirm'}
                      </Button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
