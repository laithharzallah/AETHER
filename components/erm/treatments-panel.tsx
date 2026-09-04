'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
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
import { Field, NativeSelect, ScaleSelect, TextInput, Textarea } from '@/components/erm/fields'
import { StrategyPill, TreatmentStatusPill } from '@/components/erm/badges'
import {
  IMPACT_SCALE,
  ISO_TREATMENT_OPTIONS,
  LIKELIHOOD_SCALE,
  TREATMENT_STATUSES,
  TREATMENT_STATUS_LABEL,
  TREATMENT_STRATEGIES,
  TREATMENT_STRATEGY_HINT,
  TREATMENT_STRATEGY_LABEL,
  type TreatmentStrategy,
} from '@/lib/erm/constants'
import {
  createTreatment,
  deleteTreatment,
  updateTreatment,
  type TreatmentInput,
} from '@/lib/actions/erm'
import type { TreatmentRow } from '@/lib/erm/queries'

function emptyTreatment(riskId: string): TreatmentInput {
  return {
    riskId,
    strategy: 'mitigate',
    title: '',
    description: '',
    ownerId: '',
    dueDate: '',
    status: 'planned',
    costEstimate: null,
    expectedResidualLikelihood: null,
    expectedResidualImpact: null,
  }
}

function TreatmentDialog({
  riskId,
  members,
  initial,
  treatmentId,
  trigger,
}: {
  riskId: string
  members: { id: string; name: string }[]
  initial?: TreatmentInput
  treatmentId?: string
  trigger: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<TreatmentInput>(initial ?? emptyTreatment(riskId))

  function set<K extends keyof TreatmentInput>(key: K, value: TreatmentInput[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function submit() {
    startTransition(async () => {
      const result = treatmentId
        ? await updateTreatment(treatmentId, values)
        : await createTreatment(values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(treatmentId ? 'Treatment updated.' : 'Treatment plan added.')
      setOpen(false)
      if (!treatmentId) setValues(emptyTreatment(riskId))
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{treatmentId ? 'Edit treatment' : 'Add a treatment plan'}</DialogTitle>
          <DialogDescription>
            ISO 31000 §6.5.2 sets out seven treatment options. Each maps to one of the four
            strategies recorded here.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          <Field
            label="Strategy"
            hint={TREATMENT_STRATEGY_HINT[values.strategy as TreatmentStrategy]}
          >
            <NativeSelect
              value={values.strategy}
              onChange={(e) => set('strategy', e.target.value)}
            >
              {TREATMENT_STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {TREATMENT_STRATEGY_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              The seven ISO 31000 treatment options
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {ISO_TREATMENT_OPTIONS.map((o) => (
                <li key={o.option}>
                  {o.option}{' '}
                  <span className="opacity-70">→ {TREATMENT_STRATEGY_LABEL[o.strategy]}</span>
                </li>
              ))}
            </ul>
          </details>

          <Field label="Treatment title" htmlFor="erm-treatment-title">
            <TextInput
              id="erm-treatment-title"
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Implement dual-site failover for the settlement platform"
            />
          </Field>

          <Field label="What will be done" htmlFor="erm-treatment-description">
            <Textarea
              id="erm-treatment-description"
              value={values.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Action owner">
              <NativeSelect
                value={values.ownerId ?? ''}
                onChange={(e) => set('ownerId', e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Due date">
              <TextInput
                type="date"
                value={values.dueDate ?? ''}
                onChange={(e) => set('dueDate', e.target.value)}
              />
            </Field>
            <Field label="Status">
              <NativeSelect
                value={values.status ?? 'planned'}
                onChange={(e) => set('status', e.target.value)}
              >
                {TREATMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TREATMENT_STATUS_LABEL[s]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Cost estimate (SAR)">
              <TextInput
                type="number"
                min={0}
                step="1000"
                value={values.costEstimate ?? ''}
                onChange={(e) =>
                  set('costEstimate', e.target.value === '' ? null : Number(e.target.value))
                }
              />
            </Field>
            <Field label="Expected residual likelihood" hint="Once complete.">
              <ScaleSelect
                scale={LIKELIHOOD_SCALE}
                value={values.expectedResidualLikelihood ?? null}
                onValueChange={(v) => set('expectedResidualLikelihood', v)}
              />
            </Field>
            <Field label="Expected residual impact">
              <ScaleSelect
                scale={IMPACT_SCALE}
                value={values.expectedResidualImpact ?? null}
                onValueChange={(v) => set('expectedResidualImpact', v)}
              />
            </Field>
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button type="button" onClick={submit} disabled={pending || !values.title.trim()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {treatmentId ? 'Save changes' : 'Add treatment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TreatmentsPanel({
  riskId,
  treatments,
  members,
}: {
  riskId: string
  treatments: TreatmentRow[]
  members: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteTreatment(id, riskId)
      if (!result.ok) toast.error(result.error)
      else {
        toast.success('Treatment removed.')
        router.refresh()
      }
    })
  }

  return (
    <div className="surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="eyebrow">Treatment</p>
          <h2 className="mt-1 text-base font-medium">Treatment plans</h2>
        </div>
        <TreatmentDialog
          riskId={riskId}
          members={members}
          trigger={
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          }
        />
      </div>

      {treatments.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No treatment plan recorded. A risk above tolerance needs a documented plan with a
          named owner and a date.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/60">
          {treatments.map((t) => (
            <li key={t.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StrategyPill strategy={t.strategy} />
                    <TreatmentStatusPill status={t.is_overdue ? 'overdue' : t.status} />
                    <span className="font-medium">{t.title}</span>
                  </div>
                  {t.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Owner: {t.owner?.name ?? 'Unassigned'}
                    {t.due_date && <> · Due {t.due_date}</>}
                    {t.cost_estimate !== null && (
                      <> · SAR {Number(t.cost_estimate).toLocaleString('en-US')}</>
                    )}
                    {t.expected_residual_likelihood && t.expected_residual_impact && (
                      <>
                        {' '}
                        · Expected residual {t.expected_residual_likelihood}×
                        {t.expected_residual_impact} ={' '}
                        {t.expected_residual_likelihood * t.expected_residual_impact}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <TreatmentDialog
                    riskId={riskId}
                    members={members}
                    treatmentId={t.id}
                    initial={{
                      riskId,
                      strategy: t.strategy,
                      title: t.title,
                      description: t.description ?? '',
                      ownerId: t.owner_id ?? '',
                      dueDate: t.due_date ?? '',
                      status: t.status,
                      costEstimate: t.cost_estimate === null ? null : Number(t.cost_estimate),
                      expectedResidualLikelihood: t.expected_residual_likelihood,
                      expectedResidualImpact: t.expected_residual_impact,
                    }}
                    trigger={
                      <Button variant="ghost" size="xs">
                        Edit
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => remove(t.id)}
                    aria-label={`Remove treatment ${t.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
