'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
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
import { Field, NativeSelect, Textarea } from '@/components/audit/fields'
import { ObservationRatingBadge, Ref } from '@/components/audit/badges'
import {
  FOUR_CS,
  OBSERVATION_CATEGORY_LABEL,
  type ObservationCategory,
} from '@/lib/audit/constants'
import { createAuditAction, createObservation } from '@/lib/actions/audit'
import type { ProcedureRow } from '@/lib/audit/queries'

type Draft = {
  title: string
  condition: string
  criteria: string
  cause: string
  effect: string
  recommendation: string
  rating: string
  rating_rationale: string
  category: string
  suggested_action: string
  library_control: { id: string; control_ref: string; title_en: string } | null
}

export function ObservationDrafter({
  engagementId,
  procedures,
  disabled,
}: {
  engagementId: string
  procedures: ProcedureRow[]
  disabled?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [procedureRef, setProcedureRef] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pending, startTransition] = useTransition()

  async function handleDraft() {
    setDraft(null)
    setDrafting(true)
    try {
      const res = await fetch('/api/audit/observation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'manual',
        body: JSON.stringify({ engagementId, notes, procedureRef: procedureRef || undefined }),
      })
      if (res.status === 401 || res.status === 307 || res.status === 302) {
        toast.error('Session expired. Please refresh and sign in again.')
        return
      }
      const data = (await res.json().catch(() => ({}))) as Draft & { error?: string }
      if (!res.ok || data.error) {
        toast.error(data.error ?? 'Could not draft the observation.')
        return
      }
      setDraft(data)
    } catch {
      toast.error('Network error while drafting the observation.')
    } finally {
      setDrafting(false)
    }
  }

  function handleSave() {
    if (!draft) return
    startTransition(async () => {
      const result = await createObservation(engagementId, {
        title: draft.title,
        condition: draft.condition,
        criteria: draft.criteria,
        cause: draft.cause,
        effect: draft.effect,
        recommendation: draft.recommendation,
        rating: draft.rating,
        category: draft.category,
        libraryControlId: draft.library_control?.id ?? null,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (result.data?.id && draft.suggested_action) {
        await createAuditAction(result.data.id, engagementId, {
          description: draft.suggested_action,
        })
      }
      toast.success('Observation created with a draft management action.')
      setDraft(null)
      setNotes('')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" disabled={disabled} />}>
        <Sparkles className="h-4 w-4" />
        Draft from notes
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Draft an observation from fieldwork notes</DialogTitle>
          <DialogDescription>
            Paste the raw notes. The draft is returned as condition, criteria, cause and
            effect with a rating rationale and a recommendation that addresses the cause.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <Field label="Procedure that raised this (optional)" htmlFor="od-proc">
            <NativeSelect
              id="od-proc"
              value={procedureRef}
              onChange={(e) => setProcedureRef(e.target.value)}
              disabled={drafting}
            >
              <option value="">—</option>
              {procedures.map((p) => (
                <option key={p.id} value={p.ref}>
                  {p.ref} — {p.objective ?? p.area ?? ''}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Fieldwork notes"
            htmlFor="od-notes"
            hint="Include the population, the sample size, the number of exceptions and anything the auditee said about why."
          >
            <Textarea
              id="od-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={drafting}
              className="min-h-32"
              placeholder="Tested 30 of 412 invoices above SAR 50k. 7 had no evidence of the three-way match; 4 of those were released by the same buyer under a tolerance override with no second approval. AP supervisor says the tolerance was widened to 15% during the SAP cutover in March and never reset."
            />
          </Field>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDraft}
              disabled={drafting || notes.trim().length < 20}
            >
              {drafting ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {draft ? 'Redraft' : 'Draft observation'}
            </Button>
          </div>

          {draft && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <ObservationRatingBadge rating={draft.rating} />
                <span className="pill pill-neutral">
                  {OBSERVATION_CATEGORY_LABEL[draft.category as ObservationCategory] ??
                    draft.category}
                </span>
                {draft.library_control && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    criteria cites <Ref>{draft.library_control.control_ref}</Ref>
                    {draft.library_control.title_en}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-medium">{draft.title}</h4>
              {FOUR_CS.map((c) => (
                <div key={c.key}>
                  <p className="eyebrow">{c.label}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed">
                    {draft[c.key]}
                  </p>
                </div>
              ))}
              <div>
                <p className="eyebrow">Recommendation</p>
                <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed">
                  {draft.recommendation}
                </p>
              </div>
              <div>
                <p className="eyebrow">Rating rationale</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {draft.rating_rationale}
                </p>
              </div>
              <div>
                <p className="eyebrow">Suggested management action</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {draft.suggested_action}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!draft || pending}>
            {pending && <Loader2 className="animate-spin" />}
            Create observation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
