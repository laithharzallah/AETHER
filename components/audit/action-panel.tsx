'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react'
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
} from '@/components/ui/dialog'
import { Field, NativeSelect, Textarea, memberOptions, optionsFrom } from '@/components/audit/fields'
import {
  ActionStatusBadge,
  ObservationRatingBadge,
  Ref,
} from '@/components/audit/badges'
import {
  ACTION_STATUSES,
  ACTION_STATUS_LABEL,
  OBSERVATION_RATING_TARGET_DAYS,
  formatDate,
  type ObservationRating,
} from '@/lib/audit/constants'
import {
  createAuditAction,
  deleteAuditAction,
  markActionImplemented,
  updateAuditAction,
  verifyAndCloseAction,
} from '@/lib/actions/audit'
import type { EngagementDetail, Member, ObservationRow } from '@/lib/audit/queries'
import { cn } from '@/lib/utils'

type ActionItem = ObservationRow['actions'][number]

export function VerifyActionDialog({
  actionId,
  engagementId,
  label,
  size = 'xs',
}: {
  actionId: string
  engagementId: string | null
  label?: string
  size?: 'xs' | 'sm'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <>
      <Button size={size} variant="outline" onClick={() => setOpen(true)}>
        <ShieldCheck />
        {label ?? 'Verify and close'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Verify the management action</DialogTitle>
            <DialogDescription>
              Internal audit confirms the action was implemented and is operating. Record what
              was re-tested, over what period and with what result. Closing the last open
              action on an observation closes the observation.
            </DialogDescription>
          </DialogHeader>
          <Field
            label="Verification testing performed"
            htmlFor="va-notes"
            hint="For example: re-tested 15 invoices raised in October and November; the tolerance is reset to 5% and all overrides carry a second approval."
          >
            <Textarea
              id="va-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-28"
            />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={pending || notes.trim().length === 0}
              onClick={() =>
                startTransition(async () => {
                  const result = await verifyAndCloseAction(actionId, engagementId, notes)
                  if (result.ok) {
                    toast.success(
                      result.data?.observationClosed
                        ? 'Action verified. All actions closed, so the observation is now closed.'
                        : 'Action verified and closed.'
                    )
                    setOpen(false)
                    setNotes('')
                    router.refresh()
                  } else {
                    toast.error(result.error)
                  }
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              Verify and close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ActionForm({
  observationId,
  engagementId,
  action,
  members,
  rating,
  onDone,
}: {
  observationId: string
  engagementId: string
  action?: ActionItem
  members: Member[]
  rating: string
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const targetDays = OBSERVATION_RATING_TARGET_DAYS[rating as ObservationRating] ?? 90

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input = {
      description: String(fd.get('description') ?? ''),
      ownerId: String(fd.get('ownerId') ?? '') || null,
      dueDate: String(fd.get('dueDate') ?? '') || null,
      revisedDueDate: String(fd.get('revisedDueDate') ?? '') || null,
      status: String(fd.get('status') ?? 'open'),
      implementedAt: String(fd.get('implementedAt') ?? '') || null,
    }
    startTransition(async () => {
      const result = action
        ? await updateAuditAction(action.id, engagementId, input)
        : await createAuditAction(observationId, engagementId, input)
      if (result.ok) {
        toast.success(action ? 'Action updated.' : 'Action added.')
        router.refresh()
        onDone()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <Field
        label="Management action"
        htmlFor="ac-desc"
        hint="One action, starting with a verb, that addresses the cause and can be evidenced."
      >
        <Textarea
          id="ac-desc"
          name="description"
          defaultValue={action?.description ?? ''}
          className="min-h-20"
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Owner" htmlFor="ac-owner">
          <NativeSelect id="ac-owner" name="ownerId" defaultValue={action?.owner_id ?? ''}>
            <option value="">—</option>
            {memberOptions(members)}
          </NativeSelect>
        </Field>
        <Field label="Due date" htmlFor="ac-due" hint={`Target ${targetDays} days`}>
          <Input id="ac-due" name="dueDate" type="date" defaultValue={action?.due_date ?? ''} />
        </Field>
        <Field
          label="Revised due date"
          htmlFor="ac-revised"
          hint={action ? `${action.extension_count} extension(s) so far` : 'Each change is counted'}
        >
          <Input
            id="ac-revised"
            name="revisedDueDate"
            type="date"
            defaultValue={action?.revised_due_date ?? ''}
          />
        </Field>
        <Field label="Status" htmlFor="ac-status">
          <NativeSelect id="ac-status" name="status" defaultValue={action?.status ?? 'open'}>
            {optionsFrom(ACTION_STATUSES, ACTION_STATUS_LABEL)}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Implemented on" htmlFor="ac-impl" className="max-w-48">
        <Input
          id="ac-impl"
          name="implementedAt"
          type="date"
          defaultValue={action?.implemented_at ?? ''}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {action ? 'Save action' : 'Add action'}
        </Button>
      </div>
    </form>
  )
}

function ActionLine({
  action,
  engagementId,
  members,
  rating,
}: {
  action: ActionItem
  engagementId: string
  members: Member[]
  rating: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  if (editing) {
    return (
      <ActionForm
        observationId={action.observation_id}
        engagementId={engagementId}
        action={action}
        members={members}
        rating={rating}
        onDone={() => setEditing(false)}
      />
    )
  }

  const due = action.revised_due_date ?? action.due_date

  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-relaxed">{action.description}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {action.owner?.name ?? 'Unassigned'} · due {formatDate(due)}
            {action.extension_count > 0 && ` · ${action.extension_count} extension(s)`}
            {action.verified_at && ` · verified ${formatDate(action.verified_at)}`}
          </p>
          {action.verification_notes && (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Verification: {action.verification_notes}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <span className={cn(action.is_overdue && 'ring-1 ring-danger/40 rounded-full')}>
            <ActionStatusBadge status={action.is_overdue ? 'overdue' : action.status} />
          </span>
          {action.status !== 'verified' && action.status !== 'cancelled' && (
            <>
              {action.status !== 'implemented' && (
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await markActionImplemented(action.id, engagementId)
                      if (result.ok) {
                        toast.success('Recorded as implemented, awaiting verification.')
                        router.refresh()
                      } else {
                        toast.error(result.error)
                      }
                    })
                  }
                >
                  <CheckCircle2 />
                  Implemented
                </Button>
              )}
              <VerifyActionDialog actionId={action.id} engagementId={engagementId} />
            </>
          )}
          <Button size="icon" variant="ghost" aria-label="Edit action" onClick={() => setEditing(true)}>
            <Plus className="h-3.5 w-3.5 rotate-45" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Delete action"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteAuditAction(action.id, engagementId)
                if (result.ok) {
                  toast.success('Action removed.')
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

export function EngagementActions({ detail }: { detail: EngagementDetail }) {
  const { engagement, observations, members } = detail
  const [addingFor, setAddingFor] = useState<string | null>(null)

  if (observations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Management actions are recorded against observations. Raise an observation on the
        Reporting tab first.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Every observation must carry at least one agreed management action before the report
        can be issued. Internal audit verifies implementation before an action is closed.
      </p>
      {observations.map((o) => (
        <div key={o.id} className="surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Ref>{o.ref}</Ref>
              <ObservationRatingBadge rating={o.rating} />
              <span className="text-sm font-medium">{o.title}</span>
            </div>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setAddingFor(addingFor === o.id ? null : o.id)}
            >
              <Plus />
              Add action
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {addingFor === o.id && (
              <ActionForm
                observationId={o.id}
                engagementId={engagement.id}
                members={members}
                rating={o.rating}
                onDone={() => setAddingFor(null)}
              />
            )}
            {o.actions.length === 0 && addingFor !== o.id && (
              <p className="text-xs text-danger">
                No management action agreed. The report cannot be issued until one is recorded
                or the observation is formally risk-accepted.
              </p>
            )}
            {o.actions.map((a) => (
              <ActionLine
                key={a.id}
                action={a}
                engagementId={engagement.id}
                members={members}
                rating={o.rating}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
