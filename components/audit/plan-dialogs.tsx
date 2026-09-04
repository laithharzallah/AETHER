'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange, CheckCircle2, Loader2, Plus, Sparkles } from 'lucide-react'
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
import { Field, NativeSelect, Textarea, optionsFrom } from '@/components/audit/fields'
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PLAN_ITEM_STATUSES,
  PLAN_ITEM_STATUS_LABEL,
  QUARTERS,
} from '@/lib/audit/constants'
import {
  approvePlan,
  createPlan,
  createPlanItem,
  generatePlanFromUniverse,
} from '@/lib/actions/audit'
import type { PlanItemRow, UniverseRow } from '@/lib/audit/queries'

function defaultPeriod() {
  return `FY${new Date().getFullYear() + 1}`
}

export function GeneratePlanDialog({ dueCount }: { dueCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const period = String(fd.get('period') ?? '')
    const capacity = Number(fd.get('capacity') ?? 0)
    startTransition(async () => {
      const result = await generatePlanFromUniverse(period, capacity)
      if (result.ok && result.data) {
        toast.success('Plan proposed from the audit universe.')
        setOpen(false)
        router.push(`/dashboard/audit/plans/${result.data.planId}`)
      } else if (!result.ok) {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Sparkles className="h-4 w-4" />
        Generate from universe
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate a risk-based plan</DialogTitle>
          <DialogDescription>
            Every active entity that has fallen due against its audit cycle is sequenced by
            risk score and allocated to a quarter. Once cumulative days exceed the
            available capacity the remainder is marked deferred, so the capacity gap is
            visible to the audit committee rather than hidden.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            {dueCount} entit{dueCount === 1 ? 'y is' : 'ies are'} currently due for coverage.
          </div>
          <Field label="Period" htmlFor="g-period">
            <Input id="g-period" name="period" defaultValue={defaultPeriod()} required />
          </Field>
          <Field
            label="Available capacity (days)"
            htmlFor="g-capacity"
            hint="Total audit days available after leave, training, follow-up and administration."
          >
            <Input
              id="g-capacity"
              name="capacity"
              type="number"
              min={0}
              step="0.5"
              defaultValue={220}
              required
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Generate plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function NewPlanDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createPlan({
        period: String(fd.get('period') ?? ''),
        totalCapacityDays: Number(fd.get('capacity') ?? 0),
        notes: String(fd.get('notes') ?? ''),
      })
      if (result.ok && result.data) {
        toast.success('Plan created.')
        setOpen(false)
        router.push(`/dashboard/audit/plans/${result.data.id}`)
      } else if (!result.ok) {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <CalendarRange className="h-4 w-4" />
        New plan
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New audit plan</DialogTitle>
          <DialogDescription>
            Create an empty plan and add engagements manually.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Period" htmlFor="p-period">
            <Input id="p-period" name="period" defaultValue={defaultPeriod()} required />
          </Field>
          <Field label="Available capacity (days)" htmlFor="p-capacity">
            <Input id="p-capacity" name="capacity" type="number" min={0} step="0.5" defaultValue={220} />
          </Field>
          <Field label="Notes" htmlFor="p-notes">
            <Textarea
              id="p-notes"
              name="notes"
              placeholder="Basis of the plan, assumptions on resourcing and co-source, and any areas covered by second line instead."
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Create plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ApprovePlanButton({ planId, status }: { planId: string; status: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  if (status !== 'draft') return null
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await approvePlan(planId)
          if (result.ok) {
            toast.success('Plan recorded as approved by the audit committee.')
            router.refresh()
          } else {
            toast.error(result.error)
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
      Record audit committee approval
    </Button>
  )
}

export function AddPlanItemDialog({
  planId,
  universe,
  existing,
}: {
  planId: string
  universe: UniverseRow[]
  existing: PlanItemRow[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const used = new Set(existing.map((i) => i.universe_id).filter(Boolean))

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createPlanItem(planId, {
        universeId: String(fd.get('universeId') ?? '') || null,
        title: String(fd.get('title') ?? ''),
        quarter: String(fd.get('quarter') ?? 'Q1'),
        plannedDays: Number(fd.get('days') ?? 10),
        priority: String(fd.get('priority') ?? 'medium'),
        rationale: String(fd.get('rationale') ?? ''),
        status: String(fd.get('status') ?? 'planned'),
      })
      if (result.ok) {
        toast.success('Engagement added to the plan.')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="h-4 w-4" />
        Add engagement
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a planned engagement</DialogTitle>
          <DialogDescription>
            Link the engagement to an auditable entity so coverage is tracked back to the
            universe, or give it a standalone title for a management request.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Auditable entity" htmlFor="i-universe">
            <NativeSelect id="i-universe" name="universeId" defaultValue="">
              <option value="">— standalone engagement —</option>
              {universe.map((u) => (
                <option key={u.id} value={u.id ?? ''}>
                  {u.code} — {u.name} ({Number(u.risk_score ?? 0).toFixed(0)})
                  {used.has(u.id) ? ' · already in plan' : ''}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Title override" htmlFor="i-title" hint="Required when no entity is selected.">
            <Input id="i-title" name="title" placeholder="Special review of ..." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quarter" htmlFor="i-quarter">
              <NativeSelect id="i-quarter" name="quarter" defaultValue="Q1">
                {QUARTERS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Planned days" htmlFor="i-days">
              <Input id="i-days" name="days" type="number" min={0} step="0.5" defaultValue={12} />
            </Field>
            <Field label="Priority" htmlFor="i-priority">
              <NativeSelect id="i-priority" name="priority" defaultValue="medium">
                {optionsFrom(PRIORITIES, PRIORITY_LABEL)}
              </NativeSelect>
            </Field>
            <Field label="Status" htmlFor="i-status">
              <NativeSelect id="i-status" name="status" defaultValue="planned">
                {optionsFrom(PLAN_ITEM_STATUSES, PLAN_ITEM_STATUS_LABEL)}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Rationale" htmlFor="i-rationale">
            <Textarea
              id="i-rationale"
              name="rationale"
              placeholder="Why this engagement is on the plan — risk score, time since last coverage, regulatory driver or management request."
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Add to plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
