'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox, Field, NativeSelect, Textarea, optionsFrom } from '@/components/audit/fields'
import {
  ObservationRatingBadge,
  ObservationStatusBadge,
  Ref,
} from '@/components/audit/badges'
import { ObservationDrafter } from '@/components/audit/observation-drafter'
import { ReportDrafter } from '@/components/audit/report-drafter'
import {
  FOUR_CS,
  OBSERVATION_CATEGORIES,
  OBSERVATION_CATEGORY_LABEL,
  OBSERVATION_RATINGS,
  OBSERVATION_RATING_DEFINITION,
  OBSERVATION_RATING_LABEL,
  OBSERVATION_STATUSES,
  OBSERVATION_STATUS_LABEL,
  formatDate,
  type ObservationRating,
} from '@/lib/audit/constants'
import {
  createObservation,
  deleteObservation,
  updateObservation,
} from '@/lib/actions/audit'
import type { EngagementDetail, ObservationRow } from '@/lib/audit/queries'

function ObservationForm({
  engagementId,
  observation,
  onDone,
}: {
  engagementId: string
  observation?: ObservationRow
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const agreedRaw = String(fd.get('agreed') ?? '')
    const input = {
      ref: String(fd.get('ref') ?? ''),
      title: String(fd.get('title') ?? ''),
      condition: String(fd.get('condition') ?? ''),
      criteria: String(fd.get('criteria') ?? ''),
      cause: String(fd.get('cause') ?? ''),
      effect: String(fd.get('effect') ?? ''),
      recommendation: String(fd.get('recommendation') ?? ''),
      rating: String(fd.get('rating') ?? 'medium'),
      category: String(fd.get('category') ?? 'control_operation'),
      repeatFinding: fd.get('repeat') === 'on',
      managementResponse: String(fd.get('response') ?? ''),
      agreed: agreedRaw === '' ? null : agreedRaw === 'yes',
      status: String(fd.get('status') ?? 'draft'),
      libraryControlId: observation?.library_control_id ?? null,
      icfrControlId: observation?.icfr_control_id ?? null,
    }
    startTransition(async () => {
      const result = observation
        ? await updateObservation(observation.id, engagementId, input)
        : await createObservation(engagementId, input)
      if (result.ok) {
        toast.success(observation ? 'Observation updated.' : 'Observation added.')
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
        <Field label="Ref" htmlFor="ob-ref">
          <Input id="ob-ref" name="ref" defaultValue={observation?.ref ?? ''} placeholder="auto" />
        </Field>
        <Field label="Rating" htmlFor="ob-rating">
          <NativeSelect id="ob-rating" name="rating" defaultValue={observation?.rating ?? 'medium'}>
            {optionsFrom(OBSERVATION_RATINGS, OBSERVATION_RATING_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="Category" htmlFor="ob-category">
          <NativeSelect
            id="ob-category"
            name="category"
            defaultValue={observation?.category ?? 'control_operation'}
          >
            {optionsFrom(OBSERVATION_CATEGORIES, OBSERVATION_CATEGORY_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="Status" htmlFor="ob-status">
          <NativeSelect id="ob-status" name="status" defaultValue={observation?.status ?? 'draft'}>
            {optionsFrom(OBSERVATION_STATUSES, OBSERVATION_STATUS_LABEL)}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Title" htmlFor="ob-title">
        <Input id="ob-title" name="title" defaultValue={observation?.title ?? ''} required />
      </Field>

      {FOUR_CS.map((c) => (
        <Field key={c.key} label={c.label} htmlFor={`ob-${c.key}`} hint={c.hint}>
          <Textarea
            id={`ob-${c.key}`}
            name={c.key}
            defaultValue={observation?.[c.key] ?? ''}
            className="min-h-20"
            required={c.key === 'condition'}
          />
        </Field>
      ))}

      <Field
        label="Recommendation"
        htmlFor="ob-recommendation"
        hint="Addresses the cause, not the symptom. Specific and assignable to a role."
      >
        <Textarea
          id="ob-recommendation"
          name="recommendation"
          defaultValue={observation?.recommendation ?? ''}
          className="min-h-20"
        />
      </Field>
      <Field label="Management response" htmlFor="ob-response">
        <Textarea
          id="ob-response"
          name="response"
          defaultValue={observation?.management_response ?? ''}
          className="min-h-20"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <Field label="Management agreed" htmlFor="ob-agreed" className="w-40">
          <NativeSelect
            id="ob-agreed"
            name="agreed"
            defaultValue={observation?.agreed === null || observation?.agreed === undefined ? '' : observation.agreed ? 'yes' : 'no'}
          >
            <option value="">Not recorded</option>
            <option value="yes">Agreed</option>
            <option value="no">Not agreed</option>
          </NativeSelect>
        </Field>
        <Checkbox
          name="repeat"
          label="Repeat finding from a previous engagement"
          defaultChecked={observation?.repeat_finding ?? false}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {observation ? 'Save observation' : 'Add observation'}
        </Button>
      </div>
    </form>
  )
}

function ObservationCard({
  observation,
  engagementId,
}: {
  observation: ObservationRow
  engagementId: string
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  if (editing) {
    return (
      <div className="surface p-3">
        <ObservationForm
          engagementId={engagementId}
          observation={observation}
          onDone={() => setEditing(false)}
        />
      </div>
    )
  }

  const missing = FOUR_CS.filter((c) => !observation[c.key]).map((c) => c.label)

  return (
    <div className="surface p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse observation' : 'Expand observation'}
          className="mt-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Ref>{observation.ref}</Ref>
            <ObservationRatingBadge rating={observation.rating} />
            <ObservationStatusBadge status={observation.status} />
            {observation.repeat_finding && <span className="pill pill-danger">Repeat</span>}
            <span className="text-[11px] text-muted-foreground">
              {OBSERVATION_CATEGORY_LABEL[
                observation.category as keyof typeof OBSERVATION_CATEGORY_LABEL
              ] ?? observation.category}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-medium">{observation.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {observation.actions.length} management action(s), {observation.open_action_count} open
            {observation.issued_at ? ` · issued ${formatDate(observation.issued_at)}` : ''}
          </p>
          {missing.length > 0 && (
            <p className="mt-1 text-[11px] text-danger">
              Incomplete write-up: {missing.join(', ')} not documented.
            </p>
          )}

          {expanded && (
            <div className="mt-3 space-y-3">
              {FOUR_CS.map((c) => (
                <div key={c.key}>
                  <p className="eyebrow">{c.label}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed">
                    {observation[c.key] ?? <span className="text-muted-foreground">Not documented.</span>}
                  </p>
                </div>
              ))}
              {observation.library_control && (
                <p className="text-[11px] text-muted-foreground">
                  Criteria cites library control <Ref>{observation.library_control.control_ref}</Ref>{' '}
                  {observation.library_control.title_en}
                </p>
              )}
              <div>
                <p className="eyebrow">Recommendation</p>
                <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed">
                  {observation.recommendation ?? 'Not documented.'}
                </p>
              </div>
              <div>
                <p className="eyebrow">Management response</p>
                <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed">
                  {observation.management_response ?? 'Not yet received.'}
                  {observation.agreed === false && (
                    <span className="ml-1 text-danger">(management did not agree)</span>
                  )}
                </p>
              </div>
              <p className="rounded border border-border bg-muted/20 p-2 text-[11px] leading-snug text-muted-foreground">
                <span className="font-medium">
                  {OBSERVATION_RATING_LABEL[observation.rating as ObservationRating]} rating:{' '}
                </span>
                {OBSERVATION_RATING_DEFINITION[observation.rating as ObservationRating]}
              </p>
            </div>
          )}
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
                const result = await deleteObservation(observation.id, engagementId)
                if (result.ok) {
                  toast.success('Observation removed.')
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

export function EngagementReporting({ detail }: { detail: EngagementDetail }) {
  const { engagement, observations, procedures } = detail
  const [adding, setAdding] = useState(false)
  const byRating = OBSERVATION_RATINGS.map((r) => ({
    rating: r,
    count: observations.filter((o) => o.rating === r).length,
  }))

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">Observations</h2>
            <p className="text-xs text-muted-foreground">
              {byRating.map((b) => `${b.count} ${b.rating}`).join(' · ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ObservationDrafter engagementId={engagement.id} procedures={procedures} />
            <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
              <Plus className="h-4 w-4" />
              Add observation
            </Button>
          </div>
        </div>
        {adding && (
          <div className="mt-3">
            <ObservationForm engagementId={engagement.id} onDone={() => setAdding(false)} />
          </div>
        )}
        <div className="mt-3 space-y-3">
          {observations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No observations raised. An engagement may be reported with no findings.
            </p>
          )}
          {observations.map((o) => (
            <ObservationCard key={o.id} observation={o} engagementId={engagement.id} />
          ))}
        </div>
      </section>

      <ReportDrafter engagementId={engagement.id} />
    </div>
  )
}
