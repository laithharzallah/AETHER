import Link from 'next/link'
import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  ClipboardList,
  Radar,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { getDashboardContext } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'
import { Stat, StatGrid } from '@/components/dashboard/stat'
import { EmptyState } from '@/components/dashboard/empty-state'
import { CoverageBar } from '@/components/dashboard/coverage-bar'
import { Pill, PriorityPill } from '@/components/dashboard/pills'
import { formatRelativeDays, pluralize } from '@/lib/dashboard/format'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardOverviewPage() {
  const context = await getDashboardContext()

  if (!context.orgId) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="Welcome to AETHER"
          description={context.fullName ? `Signed in as ${context.fullName}.` : undefined}
        />
        <EmptyState
          className="mt-8"
          icon={ShieldCheck}
          title="Your account is not linked to an organization"
          description="Every record in AETHER is scoped to an organization, so nothing can be shown until yours exists. This usually means signup did not finish. Contact your administrator, or sign up again to create one."
        />
      </div>
    )
  }

  const supabase = await createClient()
  const orgId = context.orgId

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const in30Days = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)

  const [
    posture,
    directives,
    overdueObligations,
    dueSoonObligations,
    publishedPolicies,
    openRisks,
    controlCount,
    lastRun,
  ] = await Promise.all([
    supabase
      .from('compliance_posture')
      .select(
        'framework_code, framework_name, regulator, mandatory, in_scope_controls, implemented, gaps, coverage_percent'
      )
      .eq('organization_id', orgId)
      .order('mandatory', { ascending: false }),
    supabase
      .from('machine_directives_active')
      .select('id, title, directive_type, priority, urgency_score, subject_label')
      .eq('organization_id', orgId)
      .order('urgency_score', { ascending: false })
      .limit(6),
    supabase
      .from('obligations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .lt('due_date', today)
      .not('status', 'in', '("complete","submitted","waived")'),
    supabase
      .from('obligations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('due_date', today)
      .lte('due_date', in30Days)
      .not('status', 'in', '("complete","submitted","waived")'),
    supabase
      .from('policies')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'published'),
    supabase
      .from('risks')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('status', ['open', 'assessing', 'mitigating']),
    supabase
      .from('controls')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .neq('applicability', 'not_applicable'),
    supabase
      .from('machine_runs')
      .select('id, status, finished_at, started_at')
      .is('organization_id', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const postureRows = posture.data ?? []

  // Weighted by control count rather than a mean of percentages: a framework with
  // 93 controls should not count the same as one with 5.
  const totalInScope = postureRows.reduce((sum, r) => sum + (r.in_scope_controls ?? 0), 0)
  const totalImplemented = postureRows.reduce((sum, r) => sum + (r.implemented ?? 0), 0)
  const overallCoverage =
    totalInScope > 0 ? Math.round((totalImplemented / totalInScope) * 100) : 0

  const worstMandatory = postureRows
    .filter((r) => r.mandatory)
    .sort((a, b) => Number(a.coverage_percent ?? 0) - Number(b.coverage_percent ?? 0))[0]

  const directiveRows = directives.data ?? []
  const overdueCount = overdueObligations.count ?? 0
  const dueSoonCount = dueSoonObligations.count ?? 0
  const notProvisioned = (controlCount.count ?? 0) === 0

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Welcome to AETHER"
        description={
          <>
            {context.fullName ? `${context.fullName} · ` : ''}
            {context.orgName}
            {lastRun.data && (
              <>
                {' · '}The Machine last ran{' '}
                {formatRelativeDays(lastRun.data.finished_at ?? lastRun.data.started_at)}
              </>
            )}
          </>
        }
        actions={
          <Link
            href="/dashboard/machine"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <BrainCircuit className="mr-1.5 h-4 w-4" />
            The Machine
          </Link>
        }
      />

      {notProvisioned ? (
        <EmptyState
          icon={ShieldCheck}
          title="No control library yet"
          description="Your organization has no controls, obligations or frameworks instantiated, so there is nothing to report on. An administrator can pick the applicable frameworks in Settings, which builds the control library and the obligation calendar from the regulatory catalogue."
          action={
            context.isAdmin ? (
              <Link href="/dashboard/settings" className={cn(buttonVariants())}>
                Set up frameworks
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ask an owner or admin to set this up.
              </p>
            )
          }
        />
      ) : (
        <>
          <StatGrid>
            <Stat
              label="Control coverage"
              value={`${overallCoverage}%`}
              tone={overallCoverage >= 80 ? 'good' : overallCoverage >= 50 ? 'warn' : 'bad'}
              hint={`${totalImplemented} of ${totalInScope} in-scope controls implemented`}
              href="/dashboard/compliance"
            />
            <Stat
              label="Overdue obligations"
              value={overdueCount}
              tone={overdueCount > 0 ? 'bad' : 'good'}
              hint={
                overdueCount > 0
                  ? 'Past a regulatory deadline'
                  : `${pluralize(dueSoonCount, 'obligation')} due in 30 days`
              }
              href="/dashboard/obligations"
            />
            <Stat
              label="Open directives"
              value={directiveRows.length}
              tone={
                directiveRows.some((d) => d.priority === 'urgent')
                  ? 'bad'
                  : directiveRows.length > 0
                    ? 'warn'
                    : 'good'
              }
              hint="Raised by the autonomous engine"
              href="/dashboard/machine"
            />
            <Stat
              label="Open risks"
              value={openRisks.count ?? 0}
              tone={(openRisks.count ?? 0) > 0 ? 'warn' : 'good'}
              hint={`${pluralize(publishedPolicies.count ?? 0, 'published policy', 'published policies')}`}
              href="/dashboard/risks"
            />
          </StatGrid>

          {worstMandatory && Number(worstMandatory.coverage_percent ?? 0) < 60 && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <p className="font-medium text-destructive">
                {worstMandatory.framework_code} coverage is{' '}
                {Number(worstMandatory.coverage_percent ?? 0).toFixed(0)}%
              </p>
              <p className="mt-1 text-muted-foreground">
                {worstMandatory.framework_name} is mandatory for your organization and is
                enforced by {worstMandatory.regulator}. {worstMandatory.gaps} of{' '}
                {worstMandatory.in_scope_controls} in-scope controls are not implemented
                or not assessed.{' '}
                <Link
                  href={`/dashboard/compliance/${worstMandatory.framework_code}`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Review the gaps
                </Link>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <section className="lg:col-span-3">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-medium">What needs attention</h2>
                <Link
                  href="/dashboard/machine"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  All directives
                </Link>
              </div>

              {directiveRows.length === 0 ? (
                <EmptyState
                  icon={BrainCircuit}
                  title="Nothing outstanding"
                  description="The Machine has not found anything needing attention in your current state. It re-checks on every cycle."
                />
              ) : (
                <ul className="divide-y divide-border/60 overflow-hidden rounded-xl ring-1 ring-foreground/10">
                  {directiveRows.map((directive) => (
                    <li key={directive.id}>
                      <Link
                        href={`/dashboard/machine#${directive.id}`}
                        className="flex items-start gap-3 bg-card p-4 transition-colors hover:bg-foreground/[0.02]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{directive.title}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {(directive.directive_type ?? 'directive').replace(/_/g, ' ')}
                            {directive.subject_label ? ` · ${directive.subject_label}` : ''}
                          </p>
                        </div>
                        <PriorityPill priority={directive.priority ?? 'medium'} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="lg:col-span-2">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-medium">Framework posture</h2>
                <Link
                  href="/dashboard/compliance"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  All frameworks
                </Link>
              </div>

              <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                {postureRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No frameworks instantiated yet.
                  </p>
                ) : (
                  postureRows.slice(0, 8).map((row) => (
                    <Link
                      key={row.framework_code}
                      href={`/dashboard/compliance/${row.framework_code}`}
                      className="block"
                    >
                      <CoverageBar
                        percent={Number(row.coverage_percent ?? 0)}
                        label={`${row.framework_code}${row.mandatory ? ' (mandatory)' : ''}`}
                      />
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>

          <section>
            <h2 className="mb-3 text-sm font-medium">Jump to</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ModuleCard
                href="/dashboard/risk-horizon"
                icon={Radar}
                title="Risk Horizon"
                description="Regulatory intelligence, scored for relevance to your organization."
              />
              <ModuleCard
                href="/dashboard/policy-generator"
                icon={ScrollText}
                title="Policy Generator"
                description="Draft a board-grade policy against the frameworks that apply to you."
              />
              <ModuleCard
                href="/dashboard/obligations"
                icon={CalendarClock}
                title="Obligations"
                description={
                  overdueCount > 0
                    ? `${pluralize(overdueCount, 'obligation')} overdue.`
                    : 'The compliance calendar, with owners and evidence.'
                }
                urgent={overdueCount > 0}
              />
              <ModuleCard
                href="/dashboard/risks"
                icon={TriangleAlert}
                title="Risk Register"
                description="Inherent and residual scoring with treatment plans."
              />
              <ModuleCard
                href="/dashboard/compliance"
                icon={ShieldCheck}
                title="Compliance"
                description="Control library and assessment history."
              />
              <ModuleCard
                href="/dashboard/audit"
                icon={ClipboardList}
                title="Audit Trail"
                description="Hash-chained record of every action, verifiable on demand."
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function ModuleCard({
  href,
  icon: Icon,
  title,
  description,
  urgent,
}: {
  href: string
  icon: typeof Radar
  title: string
  description: string
  urgent?: boolean
}) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:ring-foreground/25"
    >
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/5">
        <Icon className="h-4 w-4" />
      </div>
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {title}
        {urgent && <Pill tone="critical">action needed</Pill>}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </Link>
  )
}
