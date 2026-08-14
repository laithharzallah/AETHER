import Link from 'next/link'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'
import { Stat, StatGrid } from '@/components/dashboard/stat'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Pill, SeverityPill, StatusPill } from '@/components/dashboard/pills'
import { ObligationActions } from '@/components/obligations/obligation-actions'
import { formatDate, formatRelativeDays, humanize } from '@/lib/dashboard/format'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const VIEWS = ['open', 'overdue', 'event_driven', 'complete'] as const
type View = (typeof VIEWS)[number]

const SETTLED = '("complete","submitted","waived")'

export default async function ObligationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const context = await requireOrganization()
  const { view: rawView } = await searchParams
  const view: View = VIEWS.includes(rawView as View) ? (rawView as View) : 'open'

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  let query = supabase
    .from('obligations_effective')
    .select(
      'id, title, description, framework_code, cadence, due_date, status, effective_status, days_until_due, severity, evidence_required, owner_id, created_by_machine, waived_rationale'
    )
    .eq('organization_id', context.orgId)
    .limit(200)

  if (view === 'open') {
    query = query
      .not('status', 'in', SETTLED)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
  } else if (view === 'overdue') {
    query = query
      .not('status', 'in', SETTLED)
      .lt('due_date', today)
      .order('due_date', { ascending: true })
  } else if (view === 'event_driven') {
    query = query.is('due_date', null).order('severity', { ascending: false })
  } else {
    query = query
      .in('status', ['complete', 'submitted', 'waived'])
      .order('completed_at', { ascending: false, nullsFirst: false })
  }

  const [rows, allRows] = await Promise.all([
    query,
    supabase
      .from('obligations_effective')
      .select('status, effective_status, due_date, days_until_due')
      .eq('organization_id', context.orgId),
  ])

  const all = allRows.data ?? []
  const isSettled = (status: string | null) =>
    ['complete', 'submitted', 'waived'].includes(status ?? '')

  const overdue = all.filter((o) => o.effective_status === 'overdue').length
  const dueSoon = all.filter(
    (o) =>
      o.due_date !== null &&
      o.days_until_due !== null &&
      o.days_until_due >= 0 &&
      o.days_until_due <= 30 &&
      !isSettled(o.status)
  ).length
  const eventDriven = all.filter((o) => o.due_date === null).length
  const completed = all.filter((o) =>
    ['complete', 'submitted'].includes(o.status ?? '')
  ).length

  if (all.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader title="Obligations" />
        <EmptyState
          icon={CalendarClock}
          title="No obligations yet"
          description="The calendar is built from the obligation templates attached to the frameworks you hold — annual self-assessments, quarterly scans, incident notification deadlines and so on. Add your frameworks in Settings to populate it."
          action={
            context.isAdmin ? (
              <Link href="/dashboard/settings" className={cn(buttonVariants())}>
                Set up frameworks
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            ) : undefined
          }
        />
      </div>
    )
  }

  const obligations = rows.data ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Obligations"
        description="Recurring regulatory duties with their deadlines and the evidence each needs. Overdue status is derived from the date, so it is always accurate rather than depending on a nightly job."
      />

      <StatGrid>
        <Stat
          label="Overdue"
          value={overdue}
          tone={overdue > 0 ? 'bad' : 'good'}
          href="/dashboard/obligations?view=overdue"
        />
        <Stat label="Due in 30 days" value={dueSoon} tone={dueSoon > 0 ? 'warn' : 'good'} />
        <Stat
          label="Event-driven"
          value={eventDriven}
          hint="No date — triggered by an incident or filing"
          href="/dashboard/obligations?view=event_driven"
        />
        <Stat
          label="Completed"
          value={completed}
          tone="good"
          href="/dashboard/obligations?view=complete"
        />
      </StatGrid>

      <nav className="flex flex-wrap gap-1" aria-label="Filter obligations">
        {VIEWS.map((option) => (
          <Link
            key={option}
            href={`/dashboard/obligations?view=${option}`}
            aria-current={option === view ? 'true' : undefined}
            className={
              option === view
                ? 'rounded-lg bg-foreground/5 px-2.5 py-1 text-xs font-medium'
                : 'rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-foreground/5'
            }
          >
            {humanize(option)}
          </Link>
        ))}
      </nav>

      {obligations.length === 0 ? (
        <EmptyState
          title={`Nothing in the "${humanize(view)}" view`}
          description={
            view === 'overdue' ? 'No regulatory deadline has been missed.' : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {obligations.map((obligation) => {
            const isOverdue = obligation.effective_status === 'overdue'

            return (
              <article
                key={obligation.id}
                className={cn(
                  'rounded-xl bg-card p-4 ring-1',
                  isOverdue ? 'ring-destructive/30' : 'ring-foreground/10'
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={obligation.effective_status} />
                      <SeverityPill severity={obligation.severity} />
                      {obligation.framework_code && (
                        <Pill>{obligation.framework_code}</Pill>
                      )}
                      <Pill>{humanize(obligation.cadence)}</Pill>
                      {obligation.created_by_machine && (
                        <Pill
                          tone="info"
                          title="Raised automatically from a regulatory signal"
                        >
                          auto-raised
                        </Pill>
                      )}
                    </div>

                    <h2 className="mt-2 text-sm font-medium">{obligation.title}</h2>

                    {obligation.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {obligation.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {obligation.due_date ? (
                          <>
                            Due {formatDate(obligation.due_date)}{' '}
                            <span className={isOverdue ? 'text-destructive' : ''}>
                              ({formatRelativeDays(obligation.due_date)})
                            </span>
                          </>
                        ) : (
                          'No fixed date — triggered by an event'
                        )}
                      </span>
                      {!obligation.owner_id && (
                        <span className="text-amber-600 dark:text-amber-400">
                          No owner assigned
                        </span>
                      )}
                    </div>

                    {(obligation.evidence_required ?? []).length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          Evidence required ({(obligation.evidence_required ?? []).length})
                        </summary>
                        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                          {(obligation.evidence_required ?? []).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {obligation.waived_rationale && (
                      <p className="mt-2 rounded-lg bg-foreground/[0.03] p-2.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Waived: </span>
                        {obligation.waived_rationale}
                      </p>
                    )}
                  </div>

                  {context.canWrite && obligation.id && obligation.status && (
                    <ObligationActions
                      obligationId={obligation.id}
                      status={obligation.status}
                      isAdmin={context.isAdmin}
                    />
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
