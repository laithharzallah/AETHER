'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Field,
  NativeSelect,
  Textarea,
  memberOptions,
  optionsFrom,
} from '@/components/audit/fields'
import { ProcedureStatusBadge, Ref } from '@/components/audit/badges'
import { WorkpaperCard, WorkpaperForm } from '@/components/audit/workpaper-panel'
import { PROCEDURE_STATUSES, PROCEDURE_STATUS_LABEL } from '@/lib/audit/constants'
import { createProcedure, deleteProcedure, updateProcedure } from '@/lib/actions/audit'
import type { EngagementDetail, Member, ProcedureRow } from '@/lib/audit/queries'

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

function ProcedureForm({
  engagementId,
  procedure,
  members,
  onDone,
}: {
  engagementId: string
  procedure?: ProcedureRow
  members: Member[]
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input = {
      ref: String(fd.get('ref') ?? ''),
      area: String(fd.get('area') ?? ''),
      objective: String(fd.get('objective') ?? ''),
      procedure: String(fd.get('procedure') ?? ''),
      controlRef: String(fd.get('controlRef') ?? ''),
      assignedTo: String(fd.get('assignedTo') ?? '') || null,
      status: String(fd.get('status') ?? 'not_started'),
      conclusion: String(fd.get('conclusion') ?? ''),
      hours: fd.get('hours') ? Number(fd.get('hours')) : null,
    }
    startTransition(async () => {
      const result = procedure
        ? await updateProcedure(procedure.id, engagementId, input)
        : await createProcedure(engagementId, input)
      if (result.ok) {
        toast.success(procedure ? 'Procedure updated.' : 'Procedure added.')
        router.refresh()
        onDone()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-border bg-muted/20 p-3"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Ref" htmlFor="pr-ref">
          <Input id="pr-ref" name="ref" defaultValue={procedure?.ref ?? ''} placeholder="auto" />
        </Field>
        <Field label="Area" htmlFor="pr-area">
          <Input id="pr-area" name="area" defaultValue={procedure?.area ?? ''} placeholder="Invoice processing" />
        </Field>
        <Field label="Status" htmlFor="pr-status">
          <NativeSelect id="pr-status" name="status" defaultValue={procedure?.status ?? 'not_started'}>
            {optionsFrom(PROCEDURE_STATUSES, PROCEDURE_STATUS_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="Assigned to" htmlFor="pr-assignee">
          <NativeSelect id="pr-assignee" name="assignedTo" defaultValue={procedure?.assigned_to ?? ''}>
            <option value="">—</option>
            {memberOptions(members)}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Objective" htmlFor="pr-objective">
        <Input
          id="pr-objective"
          name="objective"
          defaultValue={procedure?.objective ?? ''}
          placeholder="Confirm that the three-way match operates as designed and that tolerances are configured and applied."
        />
      </Field>
      <Field
        label="Procedure"
        htmlFor="pr-procedure"
        hint="State the test approach, how the population is defined and validated, the sample size and basis, and the evidence to retain."
      >
        <Textarea
          id="pr-procedure"
          name="procedure"
          defaultValue={procedure?.procedure ?? ''}
          className="min-h-32"
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Control reference" htmlFor="pr-control" hint="Library control, ICFR reference or the entity control ID.">
          <Input id="pr-control" name="controlRef" defaultValue={procedure?.control_ref ?? ''} />
        </Field>
        <Field label="Hours" htmlFor="pr-hours">
          <Input id="pr-hours" name="hours" type="number" min={0} step="0.5" defaultValue={procedure?.hours ?? ''} />
        </Field>
      </div>
      <Field label="Conclusion" htmlFor="pr-conclusion">
        <Textarea
          id="pr-conclusion"
          name="conclusion"
          defaultValue={procedure?.conclusion ?? ''}
          placeholder="What the testing established, the exceptions found and whether the objective was met."
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {procedure ? 'Save procedure' : 'Add procedure'}
        </Button>
      </div>
    </form>
  )
}

function ProcedureRowItem({
  procedure,
  engagementId,
  members,
}: {
  procedure: ProcedureRow
  engagementId: string
  members: Member[]
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  function setStatus(status: string) {
    startTransition(async () => {
      const result = await updateProcedure(procedure.id, engagementId, {
        ref: procedure.ref,
        area: procedure.area,
        objective: procedure.objective,
        procedure: procedure.procedure,
        controlRef: procedure.control_ref,
        assignedTo: procedure.assigned_to,
        status,
        conclusion: procedure.conclusion,
        hours: procedure.hours,
      })
      if (result.ok) router.refresh()
      else toast.error(result.error)
    })
  }

  if (editing) {
    return (
      <div className="border-t border-border p-3">
        <ProcedureForm
          engagementId={engagementId}
          procedure={procedure}
          members={members}
          onDone={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="border-t border-border">
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse procedure' : 'Expand procedure'}
          className="mt-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Ref>{procedure.ref}</Ref>
            {procedure.area && (
              <span className="text-[11px] text-muted-foreground">{procedure.area}</span>
            )}
            <ProcedureStatusBadge status={procedure.status} />
            {procedure.workpaper_refs.length > 0 && (
              <span className="pill pill-info">{procedure.workpaper_refs.join(', ')}</span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium">{procedure.objective ?? procedure.ref}</p>
          {!expanded && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {procedure.procedure}
            </p>
          )}
          {expanded && (
            <div className="mt-2 space-y-2">
              <p className="whitespace-pre-wrap text-xs leading-relaxed">{procedure.procedure}</p>
              {procedure.conclusion && (
                <div className="rounded-lg border border-border bg-muted/20 p-2">
                  <p className="eyebrow">Conclusion</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">
                    {procedure.conclusion}
                  </p>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {procedure.assignee?.name ?? 'Unassigned'}
                {procedure.hours ? ` · ${procedure.hours} hours` : ''}
                {procedure.control_ref ? ` · control ${procedure.control_ref}` : ''}
              </p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <NativeSelect
            aria-label={`Status for ${procedure.ref}`}
            className="h-6 w-auto text-[11px]"
            value={procedure.status}
            disabled={pending}
            onChange={(e) => setStatus(e.target.value)}
          >
            {optionsFrom(PROCEDURE_STATUSES, PROCEDURE_STATUS_LABEL)}
          </NativeSelect>
          <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Delete"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteProcedure(procedure.id, engagementId)
                if (result.ok) {
                  toast.success('Procedure removed.')
                  router.refresh()
                } else {
                  toast.error(result.error)
                }
              })
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function EngagementFieldwork({ detail }: { detail: EngagementDetail }) {
  const { engagement, procedures, workpapers, members } = detail
  const [addingProcedure, setAddingProcedure] = useState(false)
  const [addingWorkpaper, setAddingWorkpaper] = useState(false)
  const complete = procedures.filter(
    (p) => p.status === 'complete' || p.status === 'not_applicable'
  ).length
  const reviewed = workpapers.filter((w) => w.review_status === 'reviewed').length

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">Work program</h2>
            <p className="text-xs text-muted-foreground">
              {complete} of {procedures.length} procedures resolved
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAddingProcedure((v) => !v)}>
            <Plus className="h-4 w-4" />
            Add procedure
          </Button>
        </div>
        {addingProcedure && (
          <div className="mt-3">
            <ProcedureForm
              engagementId={engagement.id}
              members={members}
              onDone={() => setAddingProcedure(false)}
            />
          </div>
        )}
        <div className="surface mt-3">
          {procedures.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No procedures yet. Import a standard program or draft one on the Planning tab.
            </p>
          ) : (
            procedures.map((p) => (
              <ProcedureRowItem
                key={p.id}
                procedure={p}
                engagementId={engagement.id}
                members={members}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">Workpapers</h2>
            <p className="text-xs text-muted-foreground">
              {reviewed} of {workpapers.length} reviewed and signed off. The reviewer must be
              independent of the preparer.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAddingWorkpaper((v) => !v)}>
            <Plus className="h-4 w-4" />
            Add workpaper
          </Button>
        </div>
        {addingWorkpaper && (
          <div className="mt-3">
            <WorkpaperForm
              engagementId={engagement.id}
              procedures={procedures}
              onDone={() => setAddingWorkpaper(false)}
            />
          </div>
        )}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {workpapers.length === 0 && (
            <p className="text-sm text-muted-foreground">No workpapers recorded yet.</p>
          )}
          {workpapers.map((w) => (
            <WorkpaperCard
              key={w.id}
              workpaper={w}
              engagementId={engagement.id}
              procedures={procedures}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
