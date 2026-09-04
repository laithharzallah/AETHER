'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, NativeSelect, Textarea, optionsFrom } from '@/components/audit/fields'
import { Ref, ReviewStatusBadge } from '@/components/audit/badges'
import {
  WORKPAPER_KINDS,
  WORKPAPER_KIND_LABEL,
  formatDate,
  type WorkpaperKind,
} from '@/lib/audit/constants'
import {
  createWorkpaper,
  deleteWorkpaper,
  signOffWorkpaper,
  updateWorkpaper,
} from '@/lib/actions/audit'
import type { ProcedureRow, WorkpaperRow } from '@/lib/audit/queries'

export function WorkpaperForm({
  engagementId,
  workpaper,
  procedures,
  onDone,
}: {
  engagementId: string
  workpaper?: WorkpaperRow
  procedures: ProcedureRow[]
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input = {
      ref: String(fd.get('ref') ?? ''),
      title: String(fd.get('title') ?? ''),
      description: String(fd.get('description') ?? ''),
      kind: String(fd.get('kind') ?? 'document'),
      procedureId: String(fd.get('procedureId') ?? '') || null,
    }
    startTransition(async () => {
      const result = workpaper
        ? await updateWorkpaper(workpaper.id, engagementId, input)
        : await createWorkpaper(engagementId, input)
      if (result.ok) {
        toast.success(workpaper ? 'Workpaper updated.' : 'Workpaper added.')
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
        <Field label="Ref" htmlFor="wp-ref">
          <Input id="wp-ref" name="ref" defaultValue={workpaper?.ref ?? ''} placeholder="auto" />
        </Field>
        <Field label="Type" htmlFor="wp-kind">
          <NativeSelect id="wp-kind" name="kind" defaultValue={workpaper?.kind ?? 'document'}>
            {optionsFrom(WORKPAPER_KINDS, WORKPAPER_KIND_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="Procedure" htmlFor="wp-proc" className="col-span-2">
          <NativeSelect id="wp-proc" name="procedureId" defaultValue={workpaper?.procedure_id ?? ''}>
            <option value="">—</option>
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.ref} — {p.objective ?? p.area ?? ''}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Title" htmlFor="wp-title">
        <Input id="wp-title" name="title" defaultValue={workpaper?.title ?? ''} required />
      </Field>
      <Field
        label="Content and results"
        htmlFor="wp-desc"
        hint="Population, sample selected, attributes tested, exceptions, and the conclusion reached."
      >
        <Textarea
          id="wp-desc"
          name="description"
          defaultValue={workpaper?.description ?? ''}
          className="min-h-28"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {workpaper ? 'Save workpaper' : 'Add workpaper'}
        </Button>
      </div>
    </form>
  )
}

export function WorkpaperCard({
  workpaper,
  engagementId,
  procedures,
}: {
  workpaper: WorkpaperRow
  engagementId: string
  procedures: ProcedureRow[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  function sign(role: 'prepare' | 'review' | 'reopen') {
    startTransition(async () => {
      const result = await signOffWorkpaper(workpaper.id, engagementId, role)
      if (result.ok) {
        toast.success(
          role === 'prepare'
            ? 'Signed off as preparer.'
            : role === 'review'
              ? 'Signed off as reviewer.'
              : 'Workpaper reopened for the preparer.'
        )
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  if (editing) {
    return (
      <div className="surface p-3">
        <WorkpaperForm
          engagementId={engagementId}
          workpaper={workpaper}
          procedures={procedures}
          onDone={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Ref>{workpaper.ref}</Ref>
            <span className="pill pill-neutral">
              {WORKPAPER_KIND_LABEL[workpaper.kind as WorkpaperKind] ?? workpaper.kind}
            </span>
            <ReviewStatusBadge status={workpaper.review_status} />
            {workpaper.procedure_ref && (
              <span className="text-[11px] text-muted-foreground">
                ties to {workpaper.procedure_ref}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm font-medium">{workpaper.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
                const result = await deleteWorkpaper(workpaper.id, engagementId)
                if (result.ok) {
                  toast.success('Workpaper removed.')
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

      {workpaper.description && (
        <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
          {workpaper.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <div className="text-[11px] text-muted-foreground">
          <p>
            Prepared by {workpaper.preparer?.name ?? '—'}
            {workpaper.prepared_at ? ` on ${formatDate(workpaper.prepared_at)}` : ''}
          </p>
          <p>
            Reviewed by {workpaper.reviewer?.name ?? '—'}
            {workpaper.reviewed_at ? ` on ${formatDate(workpaper.reviewed_at)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="xs" variant="outline" disabled={pending} onClick={() => sign('prepare')}>
            {pending && <Loader2 className="animate-spin" />}
            Sign as preparer
          </Button>
          <Button
            size="xs"
            variant="outline"
            disabled={pending || workpaper.review_status === 'draft'}
            onClick={() => sign('review')}
          >
            Sign as reviewer
          </Button>
          {workpaper.review_status === 'reviewed' && (
            <Button size="xs" variant="ghost" disabled={pending} onClick={() => sign('reopen')}>
              Reopen
            </Button>
          )}
        </div>
      </div>
      {workpaper.review_notes && (
        <p className="mt-2 rounded border border-border bg-muted/20 p-2 text-[11px] leading-snug">
          <span className="font-medium">Review note: </span>
          {workpaper.review_notes}
        </p>
      )}
    </div>
  )
}
