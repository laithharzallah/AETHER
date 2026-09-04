'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DeficiencyStatusBadge, SeverityBadge, formatDate } from '@/components/icfr/badges'
import { Field, NativeSelect, Textarea, optionsFrom } from '@/components/icfr/fields'
import { createDeficiency, updateDeficiencyStatus } from '@/lib/actions/icfr'
import type { ControlWithDetail, Member } from '@/lib/icfr/queries'
import {
  DEFICIENCY_STATUSES,
  DEFICIENCY_STATUS_LABEL,
  SEVERITIES,
  SEVERITY_LABEL,
} from '@/lib/icfr/constants'
import { cn } from '@/lib/utils'

export function DeficiencyForm({
  controlId,
  processId,
  members,
  tests,
  onDone,
}: {
  controlId: string
  processId: string
  members: Member[]
  tests: { id: string; period: string; test_type: string }[]
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createDeficiency(controlId, processId, {
        severity: String(fd.get('severity') ?? ''),
        description: String(fd.get('description') ?? ''),
        rootCause: String(fd.get('rootCause') ?? ''),
        remediationPlan: String(fd.get('remediationPlan') ?? ''),
        ownerId: String(fd.get('owner') ?? '') || null,
        dueDate: String(fd.get('dueDate') ?? '') || null,
        testId: String(fd.get('testId') ?? '') || null,
        status: 'open',
      })
      if (result.ok) {
        toast.success('Deficiency logged.')
        router.refresh()
        onDone()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Severity" htmlFor="d-sev">
          <NativeSelect id="d-sev" name="severity" defaultValue="deficiency">
            {optionsFrom(SEVERITIES, SEVERITY_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="Identified in test" htmlFor="d-test">
          <NativeSelect id="d-test" name="testId" defaultValue="">
            <option value="">—</option>
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.period} · {t.test_type}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Description of the deficiency" htmlFor="d-desc">
        <Textarea id="d-desc" name="description" required className="min-h-16" />
      </Field>
      <Field label="Root cause" htmlFor="d-root">
        <Textarea id="d-root" name="rootCause" className="min-h-14" />
      </Field>
      <Field label="Remediation plan" htmlFor="d-plan">
        <Textarea id="d-plan" name="remediationPlan" className="min-h-14" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Remediation owner" htmlFor="d-owner">
          <NativeSelect id="d-owner" name="owner" defaultValue="">
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Due date" htmlFor="d-due">
          <Input id="d-due" name="dueDate" type="date" />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Log deficiency
        </Button>
      </div>
    </form>
  )
}

export function DeficienciesPanel({
  control,
  processId,
  members,
}: {
  control: ControlWithDetail
  processId: string
  members: Member[]
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [pending, startTransition] = useTransition()
  const today = new Date().toISOString().slice(0, 10)

  function handleStatus(id: string, status: string) {
    startTransition(async () => {
      const result = await updateDeficiencyStatus(id, status, processId)
      if (result.ok) {
        toast.success('Status updated.')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Deficiencies</h3>
        {!adding && (
          <Button size="xs" variant="outline" onClick={() => setAdding(true)}>
            <Plus />
            Log deficiency
          </Button>
        )}
      </div>
      {adding && (
        <DeficiencyForm
          controlId={control.id}
          processId={processId}
          members={members}
          tests={control.tests}
          onDone={() => setAdding(false)}
        />
      )}
      {control.deficiencies.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">No deficiencies logged for this control.</p>
      )}
      <ul className="space-y-1.5">
        {control.deficiencies.map((d) => {
          const overdue =
            d.due_date && d.due_date < today && (d.status === 'open' || d.status === 'in_remediation')
          return (
            <li key={d.id} className="surface px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={d.severity} />
                <DeficiencyStatusBadge status={d.status} />
                <span className="text-muted-foreground">
                  Identified {formatDate(d.identified_at)}
                </span>
                {d.due_date && (
                  <span className={cn('text-muted-foreground', overdue && 'font-medium text-danger')}>
                    Due {formatDate(d.due_date)}
                    {overdue && ' (overdue)'}
                  </span>
                )}
                <NativeSelect
                  aria-label="Deficiency status"
                  value={d.status}
                  disabled={pending}
                  onChange={(e) => handleStatus(d.id, e.target.value)}
                  className="ml-auto h-6 w-auto text-xs"
                >
                  {DEFICIENCY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {DEFICIENCY_STATUS_LABEL[s]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <p className="mt-1.5">{d.description}</p>
              {d.remediation_plan && (
                <p className="mt-1 text-muted-foreground">
                  <span className="font-medium">Remediation:</span> {d.remediation_plan}
                </p>
              )}
              {d.owner && <p className="mt-1 text-muted-foreground">Owner: {d.owner.name}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
