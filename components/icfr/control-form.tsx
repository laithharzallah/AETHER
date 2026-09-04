'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox, Field, NativeSelect, Textarea, optionsFrom } from '@/components/icfr/fields'
import { createControl, updateControl } from '@/lib/actions/icfr'
import type { ControlWithDetail, Member, RiskWithLinks } from '@/lib/icfr/queries'
import {
  CONTROL_STATUSES,
  CONTROL_STATUS_LABEL,
  CONTROL_TYPES,
  CONTROL_TYPE_LABEL,
  COSO_COMPONENTS,
  COSO_LABEL,
  FREQUENCIES,
  FREQUENCY_LABEL,
  LEVELS,
  LEVEL_LABEL,
  NATURES,
  NATURE_LABEL,
} from '@/lib/icfr/constants'

export function ControlForm({
  processId,
  control,
  risks,
  members,
  nextRef,
  onDone,
}: {
  processId: string
  control?: ControlWithDetail | null
  risks: RiskWithLinks[]
  members: Member[]
  nextRef?: string
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [riskIds, setRiskIds] = useState<string[]>(control?.risk_ids ?? [])

  function toggleRisk(id: string) {
    setRiskIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input = {
      ref: String(fd.get('ref') ?? ''),
      title: String(fd.get('title') ?? ''),
      description: String(fd.get('description') ?? ''),
      controlType: String(fd.get('controlType') ?? ''),
      nature: String(fd.get('nature') ?? ''),
      frequency: String(fd.get('frequency') ?? ''),
      isKey: fd.get('isKey') === 'on',
      level: String(fd.get('level') ?? ''),
      cosoComponent: String(fd.get('cosoComponent') ?? ''),
      ownerId: String(fd.get('owner') ?? '') || null,
      evidenceDescription: String(fd.get('evidence') ?? ''),
      status: String(fd.get('status') ?? 'implemented'),
      riskIds,
    }
    startTransition(async () => {
      const result = control
        ? await updateControl(control.id, processId, input)
        : await createControl(processId, input)
      if (result.ok) {
        toast.success(control ? 'Control updated.' : 'Control added.')
        router.refresh()
        onDone()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
        <Field label="Ref" htmlFor="c-ref">
          <Input id="c-ref" name="ref" defaultValue={control?.ref ?? nextRef ?? ''} required />
        </Field>
        <Field label="Title" htmlFor="c-title">
          <Input id="c-title" name="title" defaultValue={control?.title ?? ''} required />
        </Field>
      </div>
      <Field label="Control description" htmlFor="c-desc" hint="Who performs what, how often, using which evidence, with what thresholds, and who reviews.">
        <Textarea id="c-desc" name="description" defaultValue={control?.description ?? ''} className="min-h-28" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type" htmlFor="c-type">
          <NativeSelect id="c-type" name="controlType" defaultValue={control?.control_type ?? 'preventive'}>
            {optionsFrom(CONTROL_TYPES, CONTROL_TYPE_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="Nature" htmlFor="c-nature">
          <NativeSelect id="c-nature" name="nature" defaultValue={control?.nature ?? 'manual'}>
            {optionsFrom(NATURES, NATURE_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="Frequency" htmlFor="c-freq">
          <NativeSelect id="c-freq" name="frequency" defaultValue={control?.frequency ?? 'monthly'}>
            {optionsFrom(FREQUENCIES, FREQUENCY_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="Level" htmlFor="c-level">
          <NativeSelect id="c-level" name="level" defaultValue={control?.level ?? 'process'}>
            {optionsFrom(LEVELS, LEVEL_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="COSO component" htmlFor="c-coso">
          <NativeSelect id="c-coso" name="cosoComponent" defaultValue={control?.coso_component ?? 'control_activities'}>
            {optionsFrom(COSO_COMPONENTS, COSO_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="Status" htmlFor="c-status">
          <NativeSelect id="c-status" name="status" defaultValue={control?.status ?? 'implemented'}>
            {optionsFrom(CONTROL_STATUSES, CONTROL_STATUS_LABEL)}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Control owner" htmlFor="c-owner">
          <NativeSelect id="c-owner" name="owner" defaultValue={control?.owner_id ?? ''}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Checkbox name="isKey" label="Key control" defaultChecked={control?.is_key ?? false} className="h-8" />
      </div>
      <Field label="Evidence retained" htmlFor="c-evidence" hint="What a tester will inspect: reports, sign-offs, tickets, screenshots.">
        <Textarea id="c-evidence" name="evidence" defaultValue={control?.evidence_description ?? ''} />
      </Field>

      <div>
        <p className="text-xs text-muted-foreground">Risks addressed</p>
        {risks.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No risks defined yet.</p>
        ) : (
          <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
            {risks.map((r) => (
              <Checkbox
                key={r.id}
                label={`${r.ref} — ${r.description}`}
                checked={riskIds.includes(r.id)}
                onChange={() => toggleRisk(r.id)}
                className="w-full items-start text-xs [&>input]:mt-0.5"
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {control ? 'Save control' : 'Add control'}
        </Button>
      </div>
    </form>
  )
}
