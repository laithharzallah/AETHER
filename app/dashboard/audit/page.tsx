import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  ClipboardCheck,
  ListChecks,
  Network,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EngagementStatusBadge, Meter, Ref, Stat } from '@/components/audit/badges'
import {
  AGEING_BUCKETS,
  COVERAGE_WINDOW_MONTHS,
  ENGAGEMENT_STATUS_LABEL,
  OBSERVATION_RATINGS,
  OBSERVATION_RATING_LABEL,
  RISK_BAND_LABEL,
  RISK_BAND_SWATCH,
  formatDays,
  type EngagementStatus,
} from '@/lib/audit/constants'
import { getAuditDashboard, listEngagements } from '@/lib/audit/queries'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const RATING_BAR: Record<string, string> = {
  critical: 'bg-danger',
  high: 'bg-warning',
  medium: 'bg-info',
  low: 'bg-muted-foreground/40',
}

export default async function AuditPage() {
  const [dashboard, engagements] = await Promise.all([getAuditDashboard(), listEngagements()])
  const active = engagements.filter(
    (e) => e.status === 'planning' || e.status === 'fieldwork' || e.status === 'reporting'
  )
  const maxRating = Math.max(1, ...OBSERVATION_RATINGS.map((r) => dashboard.observationsByRating[r]))

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Internal Audit</h1>
          <p className="page-lede">
            Risk-based planning from the audit universe, engagement execution with
            supervised workpapers, findings written as condition, criteria, cause and
            effect, and monitoring of management actions — aligned to the IIA Global
            Internal Audit Standards (2024) and the audit committee oversight expected
            under the CMA Corporate Governance Regulations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/audit/universe" className={cn(buttonVariants({ variant: 'ghost' }))}>
            <Network className="h-4 w-4" />
            Universe
          </Link>
          <Link href="/dashboard/audit/plans" className={cn(buttonVariants({ variant: 'outline' }))}>
            <CalendarRange className="h-4 w-4" />
            Plans
          </Link>
          <Link href="/dashboard/audit/actions" className={cn(buttonVariants())}>
            <ListChecks className="h-4 w-4" />
            Follow-up register
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Stat
          label="Plan completion"
          value={`${dashboard.planCompletionPct}%`}
          hint={dashboard.currentPlan ? dashboard.currentPlan.period : 'No plan yet'}
          tone={dashboard.planCompletionPct >= 75 ? 'good' : 'warn'}
        />
        <Stat
          label="Capacity used"
          value={`${formatDays(dashboard.planPlannedDays)}`}
          hint={`of ${formatDays(dashboard.planCapacityDays)} days`}
        />
        <Stat
          label="Active engagements"
          value={dashboard.engagementsActive}
          hint={`${dashboard.engagementsByStage.issued + dashboard.engagementsByStage.closed} reported`}
        />
        <Stat
          label="Open observations"
          value={dashboard.observationsOpen}
          hint={`${dashboard.repeatFindings} repeat finding(s)`}
          tone={dashboard.observationsOpen > 0 ? 'warn' : 'good'}
        />
        <Stat
          label="Critical findings"
          value={dashboard.observationsCritical}
          tone={dashboard.observationsCritical > 0 ? 'bad' : 'good'}
        />
        <Stat
          label="Overdue actions"
          value={dashboard.actionsOverdue}
          hint={`${dashboard.actionsOpen} open`}
          tone={dashboard.actionsOverdue > 0 ? 'bad' : 'good'}
        />
        <Stat
          label="Awaiting review"
          value={dashboard.workpapersAwaitingReview}
          hint="workpapers"
          tone={dashboard.workpapersAwaitingReview > 0 ? 'warn' : 'default'}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan progress</CardTitle>
            <CardDescription>
              {dashboard.currentPlan
                ? `${dashboard.currentPlan.period} — ${dashboard.currentPlan.completed_count} of ${dashboard.currentPlan.item_count} engagements reported`
                : 'No plan has been created yet.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.currentPlan ? (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Completion</span>
                    <span className="tabular-nums">{dashboard.planCompletionPct}%</span>
                  </div>
                  <Meter value={dashboard.planCompletionPct} className="mt-1.5" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Capacity utilisation</span>
                    <span className="tabular-nums">
                      {dashboard.currentPlan.utilisation_pct}%
                    </span>
                  </div>
                  <Meter value={dashboard.currentPlan.utilisation_pct} className="mt-1.5" />
                </div>
                {dashboard.planDeferredCount > 0 && (
                  <p className="text-xs text-warning-foreground">
                    {dashboard.planDeferredCount} planned engagement(s) deferred for lack of
                    capacity — report this as the residual assurance gap.
                  </p>
                )}
                <Link
                  href={`/dashboard/audit/plans/${dashboard.currentPlan.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open the plan
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <Link href="/dashboard/audit/plans" className={cn(buttonVariants({ size: 'sm' }))}>
                Build the plan
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagements by stage</CardTitle>
            <CardDescription>Where the portfolio sits in the lifecycle.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(Object.keys(dashboard.engagementsByStage) as EngagementStatus[])
                .filter((s) => s !== 'cancelled' || dashboard.engagementsByStage[s] > 0)
                .map((s) => {
                  const n = dashboard.engagementsByStage[s]
                  const total = Math.max(1, engagements.length)
                  return (
                    <div key={s}>
                      <div className="flex items-center justify-between text-xs">
                        <span>{ENGAGEMENT_STATUS_LABEL[s]}</span>
                        <span className="tabular-nums text-muted-foreground">{n}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.round((n / total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open observations by rating</CardTitle>
            <CardDescription>
              Unresolved findings across all engagements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {OBSERVATION_RATINGS.map((r) => {
                const n = dashboard.observationsByRating[r]
                return (
                  <div key={r}>
                    <div className="flex items-center justify-between text-xs">
                      <span>{OBSERVATION_RATING_LABEL[r]}</span>
                      <span className="tabular-nums text-muted-foreground">{n}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', RATING_BAR[r])}
                        style={{ width: `${Math.round((n / maxRating) * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <Link
              href="/dashboard/audit/observations"
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Observation register
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Management action ageing</CardTitle>
            <CardDescription>
              {dashboard.actionsOverdue} overdue · {dashboard.actionsAwaitingVerification} implemented
              and awaiting internal audit verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {AGEING_BUCKETS.map((b) => {
                const n = dashboard.actionsByAgeing[b.key]
                return (
                  <div key={b.key} className="rounded-lg border border-border p-2 text-center">
                    <p
                      className={cn(
                        'text-lg font-medium tabular-nums',
                        b.key !== 'not_due' && n > 0 && 'text-danger'
                      )}
                    >
                      {n}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                      {b.label}
                    </p>
                  </div>
                )
              })}
            </div>
            <Link
              href="/dashboard/audit/actions"
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Follow-up register
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Universe coverage — rolling {COVERAGE_WINDOW_MONTHS} months
            </CardTitle>
            <CardDescription>
              {dashboard.coveragePct}% of the active universe covered · {dashboard.highRiskCoveragePct}%
              of high and critical entities · {dashboard.universeDue} entit
              {dashboard.universeDue === 1 ? 'y' : 'ies'} currently due.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.coverage.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                The audit universe is empty. Add auditable entities to build the plan from risk.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1">
                  {dashboard.coverage.slice(0, 90).map((c) => (
                    <span
                      key={c.id}
                      title={`${c.code} — ${c.name} · ${RISK_BAND_LABEL[c.band]} (${c.risk_score.toFixed(0)}) · ${
                        c.covered ? 'covered in window' : 'not covered'
                      }`}
                      className={cn(
                        'h-5 w-5 rounded-sm',
                        RISK_BAND_SWATCH[c.band],
                        !c.covered && 'opacity-25 ring-1 ring-inset ring-border'
                      )}
                    />
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Colour is the risk band; faded squares are entities with no coverage in the
                  window. Hover a square for the entity.
                </p>
              </>
            )}
            <Link
              href="/dashboard/audit/universe"
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Audit universe
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Engagements in progress</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <Card className="mt-3">
            <CardHeader>
              <div className="icon-tile mb-2">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <CardTitle>No engagements in progress</CardTitle>
              <CardDescription>
                Build the plan from the audit universe, then open an engagement from a plan
                item to start the work program.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/audit/plans" className={cn(buttonVariants({ size: 'sm' }))}>
                Go to plans
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {active.map((e) => (
              <Link
                key={e.id}
                href={`/dashboard/audit/engagements/${e.id}`}
                className="group surface p-4 transition-colors hover:border-foreground/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Ref>{e.code}</Ref>
                      <EngagementStatusBadge status={e.status} />
                    </div>
                    <p className="mt-2 truncate font-medium group-hover:underline">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.universe_code ? `${e.universe_code} · ` : ''}
                      {e.lead_auditor?.name ?? 'No lead assigned'}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Work program {e.procedures_complete ?? 0}/{e.procedures_total ?? 0}
                    </span>
                    <span>{e.progress_pct}%</span>
                  </div>
                  <Meter value={e.progress_pct} className="mt-1.5" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  {(e.observations_critical ?? 0) + (e.observations_high ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-danger">
                      <AlertTriangle className="h-3 w-3" />
                      {(e.observations_critical ?? 0) + (e.observations_high ?? 0)} critical/high
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {e.observations_total ?? 0} observation(s)
                  </span>
                  {(e.overdue_actions ?? 0) > 0 && (
                    <span className="text-danger">{e.overdue_actions} overdue action(s)</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
