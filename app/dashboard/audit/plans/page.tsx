import Link from 'next/link'
import { ArrowLeft, ArrowRight, CalendarRange } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Meter, PlanStatusBadge } from '@/components/audit/badges'
import { GeneratePlanDialog, NewPlanDialog } from '@/components/audit/plan-dialogs'
import { formatDate, formatDays } from '@/lib/audit/constants'
import { listPlans, listUniverse } from '@/lib/audit/queries'

export const dynamic = 'force-dynamic'

export default async function AuditPlansPage() {
  const [plans, universe] = await Promise.all([listPlans(), listUniverse()])
  const dueCount = universe.filter((u) => u.is_due).length

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/dashboard/audit"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Internal Audit
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Audit plans</h1>
          <p className="page-lede">
            The plan is built from the audit universe by risk score and constrained by
            available capacity. Deferred items are the residual assurance gap and are
            reported to the audit committee, which approves the plan under the CMA
            Corporate Governance Regulations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NewPlanDialog />
          <GeneratePlanDialog dueCount={dueCount} />
        </div>
      </div>

      {plans.length === 0 ? (
        <Card className="mt-8">
          <CardHeader>
            <div className="icon-tile mb-2">
              <CalendarRange className="h-5 w-5" />
            </div>
            <CardTitle>No audit plan yet</CardTitle>
            <CardDescription>
              {dueCount > 0
                ? `${dueCount} auditable entit${dueCount === 1 ? 'y is' : 'ies are'} currently due. Generate a plan to sequence them by risk against your capacity.`
                : 'Add auditable entities to the universe first, then generate a plan from them.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <GeneratePlanDialog dueCount={dueCount} />
            <Link
              href="/dashboard/audit/universe"
              className="text-sm text-primary hover:underline"
            >
              Go to the audit universe
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/audit/plans/${p.id}`}
              className="group surface p-4 transition-colors hover:border-foreground/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-medium">{p.period}</span>
                    <PlanStatusBadge status={p.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.item_count} engagement(s) · {formatDays(p.planned_days)} of{' '}
                    {formatDays(p.total_capacity_days)} days
                    {p.approved_at ? ` · approved ${formatDate(p.approved_at)}` : ''}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>

              <div className="mt-4 space-y-2">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Capacity utilisation</span>
                    <span className="tabular-nums">{p.utilisation_pct}%</span>
                  </div>
                  <Meter value={p.utilisation_pct} className="mt-1" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Completion</span>
                    <span className="tabular-nums">
                      {p.completed_count} reported · {p.completion_pct}%
                    </span>
                  </div>
                  <Meter value={p.completion_pct} className="mt-1" />
                </div>
              </div>

              {p.deferred_count > 0 && (
                <p className="mt-3 text-[11px] text-warning-foreground">
                  {p.deferred_count} engagement(s) deferred ({formatDays(p.deferred_days)} days)
                  for lack of capacity.
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
