'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, NativeSelect, Textarea, memberOptions, optionsFrom } from '@/components/audit/fields'
import { EngagementFieldwork } from '@/components/audit/engagement-fieldwork'
import { EngagementReporting } from '@/components/audit/engagement-reporting'
import { EngagementActions } from '@/components/audit/action-panel'
import { WorkProgramDraft } from '@/components/audit/work-program-draft'
import { Meter } from '@/components/audit/badges'
import {
  ENGAGEMENT_STATUS_LABEL,
  ENGAGEMENT_TYPES,
  ENGAGEMENT_TYPE_LABEL,
  OVERALL_RATINGS,
  OVERALL_RATING_DEFINITION,
  OVERALL_RATING_LABEL,
  nextEngagementStage,
  pct,
  type EngagementStatus,
} from '@/lib/audit/constants'
import { advanceEngagementStage, updateEngagement } from '@/lib/actions/audit'
import type { EngagementDetail, UniverseRow } from '@/lib/audit/queries'

type Tab = 'planning' | 'fieldwork' | 'reporting' | 'actions'

const TABS: { value: Tab; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'fieldwork', label: 'Fieldwork' },
  { value: 'reporting', label: 'Reporting' },
  { value: 'actions', label: 'Actions' },
]

function PlanningForm({
  detail,
  universe,
}: {
  detail: EngagementDetail
  universe: UniverseRow[]
}) {
  const router = useRouter()
  const { engagement, members } = detail
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateEngagement(engagement.id, {
        title: String(fd.get('title') ?? ''),
        universeId: String(fd.get('universeId') ?? '') || null,
        planItemId: engagement.plan_item_id,
        type: String(fd.get('type') ?? 'assurance'),
        objective: String(fd.get('objective') ?? ''),
        scope: String(fd.get('scope') ?? ''),
        outOfScope: String(fd.get('outOfScope') ?? ''),
        criteria: String(fd.get('criteria') ?? ''),
        leadAuditorId: String(fd.get('lead') ?? '') || null,
        auditeeOwnerId: String(fd.get('auditee') ?? '') || null,
        startDate: String(fd.get('startDate') ?? '') || null,
        fieldworkStart: String(fd.get('fieldworkStart') ?? '') || null,
        fieldworkEnd: String(fd.get('fieldworkEnd') ?? '') || null,
        reportTargetDate: String(fd.get('reportTarget') ?? '') || null,
        budgetDays: fd.get('budgetDays') ? Number(fd.get('budgetDays')) : null,
        actualDays: fd.get('actualDays') ? Number(fd.get('actualDays')) : null,
        overallRating: String(fd.get('rating') ?? '') || null,
        executiveSummary: String(fd.get('summary') ?? ''),
        opinion: String(fd.get('opinion') ?? ''),
      })
      if (result.ok) {
        toast.success('Engagement updated.')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const rating = engagement.overall_rating

  return (
    <form onSubmit={handleSubmit} className="surface space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" htmlFor="e-title">
          <Input id="e-title" name="title" defaultValue={engagement.title} required />
        </Field>
        <Field label="Type" htmlFor="e-type">
          <NativeSelect id="e-type" name="type" defaultValue={engagement.type}>
            {optionsFrom(ENGAGEMENT_TYPES, ENGAGEMENT_TYPE_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="Auditable entity" htmlFor="e-universe">
          <NativeSelect id="e-universe" name="universeId" defaultValue={engagement.universe_id ?? ''}>
            <option value="">—</option>
            {universe.map((u) => (
              <option key={u.id} value={u.id ?? ''}>
                {u.code} — {u.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Lead auditor" htmlFor="e-lead">
          <NativeSelect id="e-lead" name="lead" defaultValue={engagement.lead_auditor_id ?? ''}>
            <option value="">—</option>
            {memberOptions(members)}
          </NativeSelect>
        </Field>
        <Field label="Auditee owner" htmlFor="e-auditee">
          <NativeSelect id="e-auditee" name="auditee" defaultValue={engagement.auditee_owner_id ?? ''}>
            <option value="">—</option>
            {memberOptions(members)}
          </NativeSelect>
        </Field>
        <Field label="Budget days" htmlFor="e-budget">
          <Input
            id="e-budget"
            name="budgetDays"
            type="number"
            min={0}
            step="0.5"
            defaultValue={engagement.budget_days ?? ''}
          />
        </Field>
      </div>

      <Field
        label="Objective"
        htmlFor="e-objective"
        hint="What assurance this engagement provides and to whom. Required before fieldwork can start."
      >
        <Textarea id="e-objective" name="objective" defaultValue={engagement.objective ?? ''} />
      </Field>
      <Field
        label="Scope"
        htmlFor="e-scope"
        hint="Period covered, entities, locations, systems and processes in scope."
      >
        <Textarea id="e-scope" name="scope" defaultValue={engagement.scope ?? ''} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Explicitly out of scope" htmlFor="e-oos">
          <Textarea id="e-oos" name="outOfScope" defaultValue={engagement.out_of_scope ?? ''} />
        </Field>
        <Field
          label="Criteria"
          htmlFor="e-criteria"
          hint="Policies, regulations, contracts and frameworks the condition will be measured against."
        >
          <Textarea id="e-criteria" name="criteria" defaultValue={engagement.criteria ?? ''} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Start" htmlFor="e-start">
          <Input id="e-start" name="startDate" type="date" defaultValue={engagement.start_date ?? ''} />
        </Field>
        <Field label="Fieldwork from" htmlFor="e-fws">
          <Input
            id="e-fws"
            name="fieldworkStart"
            type="date"
            defaultValue={engagement.fieldwork_start ?? ''}
          />
        </Field>
        <Field label="Fieldwork to" htmlFor="e-fwe">
          <Input
            id="e-fwe"
            name="fieldworkEnd"
            type="date"
            defaultValue={engagement.fieldwork_end ?? ''}
          />
        </Field>
        <Field label="Report target" htmlFor="e-rt">
          <Input
            id="e-rt"
            name="reportTarget"
            type="date"
            defaultValue={engagement.report_target_date ?? ''}
          />
        </Field>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <h3 className="text-sm font-medium">Conclusion</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Required before the report can be issued.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Overall rating" htmlFor="e-rating">
            <NativeSelect id="e-rating" name="rating" defaultValue={rating ?? ''}>
              <option value="">Not concluded</option>
              {optionsFrom(OVERALL_RATINGS, OVERALL_RATING_LABEL)}
            </NativeSelect>
          </Field>
          <Field label="Actual days" htmlFor="e-actual">
            <Input
              id="e-actual"
              name="actualDays"
              type="number"
              min={0}
              step="0.5"
              defaultValue={engagement.actual_days ?? ''}
            />
          </Field>
        </div>
        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          {OVERALL_RATINGS.map((r) => (
            <li key={r}>
              <span className="font-medium text-foreground">{OVERALL_RATING_LABEL[r]}: </span>
              {OVERALL_RATING_DEFINITION[r]}
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-3">
          <Field label="Executive summary" htmlFor="e-summary">
            <Textarea
              id="e-summary"
              name="summary"
              defaultValue={engagement.executive_summary ?? ''}
              className="min-h-24"
            />
          </Field>
          <Field label="Opinion" htmlFor="e-opinion">
            <Textarea id="e-opinion" name="opinion" defaultValue={engagement.opinion ?? ''} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />}
          Save engagement
        </Button>
      </div>
    </form>
  )
}

export function AdvanceStageButton({
  engagementId,
  status,
}: {
  engagementId: string
  status: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const next = nextEngagementStage(status)
  if (!next) return null

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await advanceEngagementStage(engagementId, next)
          if (result.ok) {
            toast.success(`Engagement moved to ${ENGAGEMENT_STATUS_LABEL[next]}.`)
            router.refresh()
          } else {
            toast.error(result.error, { duration: 12000 })
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <ArrowRight className="h-4 w-4" />}
      Move to {ENGAGEMENT_STATUS_LABEL[next as EngagementStatus].toLowerCase()}
    </Button>
  )
}

export function EngagementWorkbench({
  detail,
  universe,
}: {
  detail: EngagementDetail
  universe: UniverseRow[]
}) {
  const { engagement, procedures, workpapers, observations, templates } = detail
  const initialTab: Tab =
    engagement.status === 'fieldwork'
      ? 'fieldwork'
      : engagement.status === 'planning'
        ? 'planning'
        : 'reporting'
  const [tab, setTab] = useState<Tab>(initialTab)

  const proceduresDone = procedures.filter(
    (p) => p.status === 'complete' || p.status === 'not_applicable'
  ).length
  const openActions = observations.reduce((n, o) => n + o.open_action_count, 0)
  const locked = engagement.status === 'issued' || engagement.status === 'closed'

  const counts: Record<Tab, string> = {
    planning: '',
    fieldwork: `${proceduresDone}/${procedures.length}`,
    reporting: String(observations.length),
    actions: String(openActions),
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="surface p-3">
          <p className="eyebrow">Work program</p>
          <p className="mt-1 text-lg font-medium tabular-nums">
            {proceduresDone} / {procedures.length}
          </p>
          <Meter value={pct(proceduresDone, procedures.length)} className="mt-2" />
        </div>
        <div className="surface p-3">
          <p className="eyebrow">Workpapers reviewed</p>
          <p className="mt-1 text-lg font-medium tabular-nums">
            {workpapers.filter((w) => w.review_status === 'reviewed').length} / {workpapers.length}
          </p>
          <Meter
            value={pct(
              workpapers.filter((w) => w.review_status === 'reviewed').length,
              workpapers.length
            )}
            className="mt-2"
          />
        </div>
        <div className="surface p-3">
          <p className="eyebrow">Observations</p>
          <p className="mt-1 text-lg font-medium tabular-nums">{observations.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {observations.filter((o) => o.rating === 'critical' || o.rating === 'high').length}{' '}
            critical or high · {openActions} action(s) open
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-1 border-b border-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t.value
                ? 'border-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {counts[t.value] && (
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {counts[t.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'planning' && (
          <div className="space-y-6">
            <PlanningForm detail={detail} universe={universe} />
            <WorkProgramDraft
              engagementId={engagement.id}
              templates={templates}
              disabled={locked}
            />
          </div>
        )}
        {tab === 'fieldwork' && <EngagementFieldwork detail={detail} />}
        {tab === 'reporting' && <EngagementReporting detail={detail} />}
        {tab === 'actions' && <EngagementActions detail={detail} />}
      </div>
    </div>
  )
}
