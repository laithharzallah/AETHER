'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Field,
  NativeSelect,
  ScoreSelect,
  Textarea,
  memberOptions,
  optionsFrom,
} from '@/components/audit/fields'
import { RiskScoreBadge } from '@/components/audit/badges'
import {
  RISK_FACTORS,
  RISK_FACTOR_HINT,
  RISK_FACTOR_LABEL,
  RISK_FACTOR_WEIGHT,
  UNIVERSE_STATUSES,
  UNIVERSE_STATUS_LABEL,
  UNIVERSE_TYPES,
  UNIVERSE_TYPE_LABEL,
  computeRiskScore,
  type RiskFactor,
} from '@/lib/audit/constants'
import { createUniverseEntry, updateUniverseEntry } from '@/lib/actions/audit'
import type { Member, UniverseRow } from '@/lib/audit/queries'

function EntityForm({
  entry,
  members,
  parents,
  onDone,
}: {
  entry?: UniverseRow
  members: Member[]
  parents: UniverseRow[]
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [factors, setFactors] = useState<Record<RiskFactor, number>>(() =>
    Object.fromEntries(
      RISK_FACTORS.map((f) => [f, Number(entry?.[f]) || 3])
    ) as Record<RiskFactor, number>
  )
  const score = computeRiskScore(factors)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input = {
      code: String(fd.get('code') ?? ''),
      name: String(fd.get('name') ?? ''),
      type: String(fd.get('type') ?? 'process'),
      description: String(fd.get('description') ?? ''),
      ownerId: String(fd.get('ownerId') ?? '') || null,
      parentId: String(fd.get('parentId') ?? '') || null,
      lastAuditedAt: String(fd.get('lastAuditedAt') ?? '') || null,
      auditFrequencyMonths: Number(fd.get('frequency') ?? 24),
      status: String(fd.get('status') ?? 'active'),
      ...factors,
    }
    startTransition(async () => {
      const result = entry?.id
        ? await updateUniverseEntry(entry.id, input)
        : await createUniverseEntry(input)
      if (result.ok) {
        toast.success(entry ? 'Auditable entity updated.' : 'Auditable entity added.')
        router.refresh()
        onDone()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code" htmlFor="u-code">
          <Input id="u-code" name="code" defaultValue={entry?.code ?? ''} placeholder="AU-P2P" required />
        </Field>
        <Field label="Type" htmlFor="u-type">
          <NativeSelect id="u-type" name="type" defaultValue={entry?.type ?? 'process'}>
            {optionsFrom(UNIVERSE_TYPES, UNIVERSE_TYPE_LABEL)}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Name" htmlFor="u-name">
        <Input id="u-name" name="name" defaultValue={entry?.name ?? ''} required />
      </Field>
      <Field label="Description" htmlFor="u-desc">
        <Textarea
          id="u-desc"
          name="description"
          defaultValue={entry?.description ?? ''}
          placeholder="What this entity covers, the systems and locations involved, and the key business drivers."
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Owner" htmlFor="u-owner">
          <NativeSelect id="u-owner" name="ownerId" defaultValue={entry?.owner_id ?? ''}>
            <option value="">—</option>
            {memberOptions(members)}
          </NativeSelect>
        </Field>
        <Field label="Parent entity" htmlFor="u-parent">
          <NativeSelect id="u-parent" name="parentId" defaultValue={entry?.parent_id ?? ''}>
            <option value="">—</option>
            {parents
              .filter((p) => p.id !== entry?.id)
              .map((p) => (
                <option key={p.id} value={p.id ?? ''}>
                  {p.code} — {p.name}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field label="Last audited" htmlFor="u-last">
          <Input
            id="u-last"
            name="lastAuditedAt"
            type="date"
            defaultValue={entry?.last_audited_at ?? ''}
          />
        </Field>
        <Field label="Audit frequency (months)" htmlFor="u-freq" hint="Entities scoring 60+ are pulled to 12 months automatically.">
          <Input
            id="u-freq"
            name="frequency"
            type="number"
            min={1}
            max={120}
            defaultValue={entry?.audit_frequency_months ?? 24}
          />
        </Field>
        <Field label="Status" htmlFor="u-status">
          <NativeSelect id="u-status" name="status" defaultValue={entry?.status ?? 'active'}>
            {optionsFrom(UNIVERSE_STATUSES, UNIVERSE_STATUS_LABEL)}
          </NativeSelect>
        </Field>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Risk factors</h4>
          <RiskScoreBadge score={score} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Each factor is scored 1 (low) to 5 (high). The weighted score drives plan
          sequencing and the audit cycle.
        </p>
        <div className="mt-3 space-y-2">
          {RISK_FACTORS.map((f) => (
            <div key={f} className="flex items-start gap-3">
              <ScoreSelect
                label={RISK_FACTOR_LABEL[f]}
                value={factors[f]}
                onChange={(n) => setFactors((prev) => ({ ...prev, [f]: n }))}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium">
                  {RISK_FACTOR_LABEL[f]}
                  <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">
                    {Math.round(RISK_FACTOR_WEIGHT[f] * 100)}%
                  </span>
                </p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {RISK_FACTOR_HINT[f]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {entry ? 'Save changes' : 'Add entity'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AddUniverseEntryDialog({
  members,
  parents,
}: {
  members: Member[]
  parents: UniverseRow[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4" />
        Add entity
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add an auditable entity</DialogTitle>
          <DialogDescription>
            The audit universe is the complete set of auditable entities. Score each on
            the six factors so the plan can be built from risk rather than habit.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          {open && <EntityForm members={members} parents={parents} onDone={() => setOpen(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function EditEntityDialog({
  entry,
  members,
  parents,
}: {
  entry: UniverseRow
  members: Member[]
  parents: UniverseRow[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="icon" variant="ghost" aria-label={`Edit ${entry.code}`} />}
      >
        <Pencil className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {entry.code} — {entry.name}
          </DialogTitle>
          <DialogDescription>Update the entity and its risk factors.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          {open && (
            <EntityForm
              key={entry.id}
              entry={entry}
              members={members}
              parents={parents}
              onDone={() => setOpen(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
