import Link from 'next/link'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'
import { Stat, StatGrid } from '@/components/dashboard/stat'
import { EmptyState } from '@/components/dashboard/empty-state'
import { CoverageBar } from '@/components/dashboard/coverage-bar'
import { Pill } from '@/components/dashboard/pills'
import { countryName } from '@/lib/dashboard/format'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  const context = await requireOrganization()
  const supabase = await createClient()

  const { data: posture } = await supabase
    .from('compliance_posture')
    .select(
      'framework_code, framework_name, regulator, jurisdiction, mandatory, in_scope_controls, implemented, partially_implemented, gaps, effective, never_assessed, average_maturity, coverage_percent'
    )
    .eq('organization_id', context.orgId)
    .order('mandatory', { ascending: false })
    .order('coverage_percent')

  const rows = posture ?? []

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader title="Compliance" />
        <EmptyState
          icon={ShieldCheck}
          title="No control library yet"
          description="Coverage is computed from your control library, and there is nothing in it. An administrator can pick the applicable frameworks in Settings, which instantiates the controls from the regulatory catalogue and builds the obligation calendar."
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

  const totals = rows.reduce(
    (acc, row) => ({
      inScope: acc.inScope + (row.in_scope_controls ?? 0),
      implemented: acc.implemented + (row.implemented ?? 0),
      neverAssessed: acc.neverAssessed + (row.never_assessed ?? 0),
      effective: acc.effective + (row.effective ?? 0),
    }),
    { inScope: 0, implemented: 0, neverAssessed: 0, effective: 0 }
  )

  const overall =
    totals.inScope > 0 ? Math.round((totals.implemented / totals.inScope) * 100) : 0

  const mandatoryGaps = rows.filter(
    (row) => row.mandatory && Number(row.coverage_percent ?? 0) < 80
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Compliance"
        description="Coverage across every framework in your control library. Partially implemented controls count for half; controls never assessed count for nothing, because an unverified control is not evidence of compliance."
      />

      <StatGrid>
        <Stat
          label="Overall coverage"
          value={`${overall}%`}
          tone={overall >= 80 ? 'good' : overall >= 50 ? 'warn' : 'bad'}
          hint={`${totals.implemented} of ${totals.inScope} controls`}
        />
        <Stat
          label="Frameworks"
          value={rows.length}
          hint={`${rows.filter((r) => r.mandatory).length} mandatory`}
        />
        <Stat
          label="Never assessed"
          value={totals.neverAssessed}
          tone={totals.neverAssessed > 0 ? 'warn' : 'good'}
          hint="Posture unknown until assessed"
        />
        <Stat
          label="Tested effective"
          value={totals.effective}
          tone="good"
          hint="Implemented and verified working"
        />
      </StatGrid>

      {mandatoryGaps.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-medium text-destructive">
            {mandatoryGaps.length} mandatory framework
            {mandatoryGaps.length === 1 ? '' : 's'} below 80% coverage
          </p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {mandatoryGaps.map((row) => (
              <li key={row.framework_code}>
                <Link
                  href={`/dashboard/compliance/${row.framework_code}`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {row.framework_code}
                </Link>{' '}
                at {Number(row.coverage_percent ?? 0).toFixed(0)}% — {row.gaps} of{' '}
                {row.in_scope_controls} controls outstanding, enforced by {row.regulator}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-3">
        {rows.map((row) => (
          <Link
            key={row.framework_code}
            href={`/dashboard/compliance/${row.framework_code}`}
            className="block rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:ring-foreground/25"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {row.framework_code}
                  {row.mandatory && <Pill tone="warn">mandatory</Pill>}
                  <Pill>{countryName(row.jurisdiction)}</Pill>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {row.framework_name} · {row.regulator}
                </p>
              </div>
              <div className="w-full sm:w-56">
                <CoverageBar percent={Number(row.coverage_percent ?? 0)} />
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-5">
              <Metric label="In scope" value={row.in_scope_controls ?? 0} />
              <Metric label="Implemented" value={row.implemented ?? 0} />
              <Metric label="Partial" value={row.partially_implemented ?? 0} />
              <Metric label="Gaps" value={row.gaps ?? 0} />
              <Metric
                label="Avg maturity"
                value={
                  row.average_maturity != null
                    ? Number(row.average_maturity).toFixed(1)
                    : '—'
                }
              />
            </dl>
          </Link>
        ))}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
