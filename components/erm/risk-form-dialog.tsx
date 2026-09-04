'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Plus } from 'lucide-react'
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
import {
  Checkbox,
  Field,
  NativeSelect,
  ScaleSelect,
  TextInput,
  Textarea,
  optionsFrom,
} from '@/components/erm/fields'
import {
  IMPACT_DIMENSIONS,
  IMPACT_DIMENSION_LABEL,
  IMPACT_SCALE,
  LIKELIHOOD_SCALE,
  RISK_SOURCES,
  RISK_SOURCE_LABEL,
  RISK_STATUSES,
  RISK_STATUS_LABEL,
  RISK_TRENDS,
  RISK_TREND_LABEL,
  VELOCITY_SCALE,
} from '@/lib/erm/constants'
import { createRisk, updateRisk, type RiskInput } from '@/lib/actions/erm'
import type { CategoryOption } from '@/components/erm/risk-register-table'

export type RiskFormValues = RiskInput & { id?: string }

const EMPTY: RiskFormValues = {
  title: '',
  description: '',
  causes: '',
  consequences: '',
  categoryId: '',
  ownerId: '',
  sponsorId: '',
  source: 'workshop',
  status: 'identified',
  inherentLikelihood: null,
  inherentImpact: null,
  residualLikelihood: null,
  residualImpact: null,
  targetLikelihood: null,
  targetImpact: null,
  velocity: null,
  trend: 'stable',
  emerging: false,
  nextReviewAt: '',
  impactDimensions: {},
}

export function RiskFormDialog({
  categories,
  members,
  initial,
  triggerLabel,
  variant = 'default',
}: {
  categories: CategoryOption[]
  members: { id: string; name: string }[]
  initial?: RiskFormValues
  triggerLabel?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<RiskFormValues>(initial ?? EMPTY)
  const editing = Boolean(initial?.id)

  function set<K extends keyof RiskFormValues>(key: K, value: RiskFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function setDimension(key: string, value: number | null) {
    setValues((v) => {
      const next = { ...(v.impactDimensions ?? {}) }
      if (value === null) delete next[key]
      else next[key] = value
      return { ...v, impactDimensions: next }
    })
  }

  function submit() {
    startTransition(async () => {
      const result =
        editing && initial?.id
          ? await updateRisk(initial.id, values)
          : await createRisk(values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(editing ? 'Risk updated.' : 'Risk added to the register.')
      setOpen(false)
      if (!editing) setValues(EMPTY)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} />}>
        {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {triggerLabel ?? (editing ? 'Edit risk' : 'Add risk')}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit risk' : 'Add a risk to the register'}</DialogTitle>
          <DialogDescription>
            State the risk as source → event → consequence, anchored to the objective it
            threatens. Score inherent risk before controls and residual risk after them.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Risk title" htmlFor="erm-risk-title">
            <TextInput
              id="erm-risk-title"
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Prolonged outage of the core settlement platform"
            />
          </Field>

          <Field
            label="Risk statement"
            htmlFor="erm-risk-description"
            hint="Source → event → consequence, written out in full."
          >
            <Textarea
              id="erm-risk-description"
              value={values.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Risk sources / causes" htmlFor="erm-risk-causes">
              <Textarea
                id="erm-risk-causes"
                value={values.causes ?? ''}
                onChange={(e) => set('causes', e.target.value)}
                rows={2}
              />
            </Field>
            <Field label="Consequences if untreated" htmlFor="erm-risk-consequences">
              <Textarea
                id="erm-risk-consequences"
                value={values.consequences ?? ''}
                onChange={(e) => set('consequences', e.target.value)}
                rows={2}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Category">
              <NativeSelect
                value={values.categoryId ?? ''}
                onChange={(e) => set('categoryId', e.target.value)}
              >
                <option value="">Unclassified</option>
                {categories
                  .filter((c) => c.level === 1)
                  .map((c) => (
                    <optgroup key={c.id} label={`${c.code} — ${c.name_en}`}>
                      <option value={c.id}>{c.name_en} (level 1)</option>
                      {categories
                        .filter((k) => k.parent_id === c.id)
                        .map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.code} — {k.name_en}
                          </option>
                        ))}
                    </optgroup>
                  ))}
              </NativeSelect>
            </Field>
            <Field label="Risk owner" hint="Accountable for managing the risk.">
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
            <Field label="Executive sponsor">
              <NativeSelect
                value={values.sponsorId ?? ''}
                onChange={(e) => set('sponsorId', e.target.value)}
              >
                <option value="">None</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium">Assessment</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Inherent likelihood" hint="Before the effect of controls.">
                <ScaleSelect
                  scale={LIKELIHOOD_SCALE}
                  value={values.inherentLikelihood ?? null}
                  onValueChange={(v) => set('inherentLikelihood', v)}
                />
              </Field>
              <Field label="Inherent impact">
                <ScaleSelect
                  scale={IMPACT_SCALE}
                  value={values.inherentImpact ?? null}
                  onValueChange={(v) => set('inherentImpact', v)}
                />
              </Field>
              <Field label="Residual likelihood" hint="After the controls that are actually in place.">
                <ScaleSelect
                  scale={LIKELIHOOD_SCALE}
                  value={values.residualLikelihood ?? null}
                  onValueChange={(v) => set('residualLikelihood', v)}
                />
              </Field>
              <Field label="Residual impact">
                <ScaleSelect
                  scale={IMPACT_SCALE}
                  value={values.residualImpact ?? null}
                  onValueChange={(v) => set('residualImpact', v)}
                />
              </Field>
              <Field label="Target likelihood" hint="Where treatment is intended to land it.">
                <ScaleSelect
                  scale={LIKELIHOOD_SCALE}
                  value={values.targetLikelihood ?? null}
                  onValueChange={(v) => set('targetLikelihood', v)}
                />
              </Field>
              <Field label="Target impact">
                <ScaleSelect
                  scale={IMPACT_SCALE}
                  value={values.targetImpact ?? null}
                  onValueChange={(v) => set('targetImpact', v)}
                />
              </Field>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-5">
              {IMPACT_DIMENSIONS.map((d) => (
                <Field key={d} label={IMPACT_DIMENSION_LABEL[d]}>
                  <ScaleSelect
                    scale={IMPACT_SCALE}
                    value={values.impactDimensions?.[d] ?? null}
                    onValueChange={(v) => setDimension(d, v)}
                  />
                </Field>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Velocity" hint="Speed to consequence.">
              <ScaleSelect
                scale={VELOCITY_SCALE}
                value={values.velocity ?? null}
                onValueChange={(v) => set('velocity', v)}
              />
            </Field>
            <Field label="Trend">
              <NativeSelect
                value={values.trend ?? 'stable'}
                onChange={(e) => set('trend', e.target.value)}
              >
                {optionsFrom(RISK_TRENDS, RISK_TREND_LABEL)}
              </NativeSelect>
            </Field>
            <Field label="Identified through">
              <NativeSelect
                value={values.source ?? 'workshop'}
                onChange={(e) => set('source', e.target.value)}
              >
                {optionsFrom(RISK_SOURCES, RISK_SOURCE_LABEL)}
              </NativeSelect>
            </Field>
            <Field label="Status">
              <NativeSelect
                value={values.status ?? 'identified'}
                onChange={(e) => set('status', e.target.value)}
              >
                {optionsFrom(RISK_STATUSES, RISK_STATUS_LABEL)}
              </NativeSelect>
            </Field>
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <Field label="Next review date" className="w-48">
              <TextInput
                type="date"
                value={values.nextReviewAt ?? ''}
                onChange={(e) => set('nextReviewAt', e.target.value)}
              />
            </Field>
            <Checkbox
              label="Emerging risk"
              checked={Boolean(values.emerging)}
              onChange={(e) => set('emerging', e.target.checked)}
              className="pb-2"
            />
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button type="button" onClick={submit} disabled={pending || !values.title.trim()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? 'Save changes' : 'Add risk'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
