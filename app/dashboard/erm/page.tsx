import Link from 'next/link'
import { ArrowRight, Gauge, ListTree, Radar } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { HeatMap } from '@/components/erm/heat-map'
import { CategoryDistributionChart, Stat } from '@/components/erm/charts'
import { BoardReportDialog } from '@/components/erm/board-report-dialog'
import { IdentifyRisksDialog } from '@/components/erm/identify-risks-dialog'
import { BandPill, MovementArrow, ScoreChip } from '@/components/erm/badges'
import { getErmDashboard, listCategories } from '@/lib/erm/queries'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ErmDashboardPage() {
  const [dashboard, categories] = await Promise.all([getErmDashboard(), listCategories()])
  const { board, inherent, residual } = dashboard
  const t = board.totals

  const categoryNames = Object.fromEntries(categories.map((c) => [c.code, c.name_en]))

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Enterprise Risk Management</h1>
          <p className="page-lede mt-3 max-w-2xl">
            The portfolio view of risk — inherent, residual and target exposure against the
            appetite the board has set, with the indicators and treatments that keep it there.
            Vocabulary follows ISO 31000:2018 and COSO ERM 2017.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/erm/risks"
            className={cn(buttonVariants({ variant: 'ghost' }))}
          >
            <ListTree className="h-4 w-4" />
            Register
          </Link>
          <IdentifyRisksDialog categoryNames={categoryNames} />
          <BoardReportDialog disabled={t.risks === 0} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Risks on the register" value={t.risks} hint={`${t.open} open`} />
        <Stat
          label="Outside appetite"
          value={t.outsideAppetite}
          hint="residual above tolerance"
          tone={t.outsideAppetite > 0 ? 'bad' : 'good'}
        />
        <Stat
          label="KRIs in breach"
          value={t.krisInBreach}
          hint={`${t.krisAmber} in early warning`}
          tone={t.krisInBreach > 0 ? 'bad' : t.krisAmber > 0 ? 'warn' : 'good'}
        />
        <Stat
          label="Overdue treatments"
          value={t.overdueTreatments}
          hint={`${t.openTreatments} open`}
          tone={t.overdueTreatments > 0 ? 'bad' : 'default'}
        />
        <Stat
          label="Extreme residual"
          value={board.byBand.extreme}
          hint={`${board.byBand.high} high`}
          tone={board.byBand.extreme > 0 ? 'bad' : 'default'}
        />
        <Stat
          label="Not yet assessed"
          value={t.unassessed}
          hint={`${t.withoutOwner} without an owner`}
          tone={t.unassessed > 0 || t.withoutOwner > 0 ? 'warn' : 'good'}
        />
      </div>

      {t.risks === 0 ? (
        <div className="surface mt-10 p-8 text-center">
          <div className="mx-auto mb-3 icon-tile">
            <Radar className="h-5 w-5" />
          </div>
          <p className="text-lg font-medium">The register is empty</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Import the GCC risk taxonomy, set the enterprise risk appetite, then run a risk
            identification workshop. Every risk is stated as source → event → consequence and
            scored inherent, residual and target on calibrated 5×5 scales.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/dashboard/erm/taxonomy"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              <ListTree className="h-4 w-4" />
              Import the taxonomy
            </Link>
            <Link
              href="/dashboard/erm/appetite"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              <Gauge className="h-4 w-4" />
              Set the appetite
            </Link>
            <IdentifyRisksDialog categoryNames={categoryNames} />
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <HeatMap inherent={inherent} residual={residual} />
            <CategoryDistributionChart rows={board.byCategory} />
          </div>

          <div className="surface mt-4 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="eyebrow">Principal risks</p>
                <h2 className="mt-1 text-base font-medium">Top 10 by residual score</h2>
              </div>
              <Link
                href="/dashboard/erm/risks"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Full register
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th className="w-24">Code</th>
                    <th>Risk</th>
                    <th className="w-32">Owner</th>
                    <th className="w-28">Inherent</th>
                    <th className="w-28">Residual</th>
                    <th className="w-24">Movement</th>
                    <th className="w-28">Band</th>
                  </tr>
                </thead>
                <tbody>
                  {board.topRisks.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link
                          href={`/dashboard/erm/risks/${r.id}`}
                          className="font-mono text-[11px] hover:underline"
                        >
                          {r.code}
                        </Link>
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/erm/risks/${r.id}`}
                          className="font-medium hover:underline"
                        >
                          {r.title}
                        </Link>
                        {r.appetite_breach && (
                          <span className="ml-2 pill pill-danger">Outside appetite</span>
                        )}
                      </td>
                      <td className="text-xs">
                        {r.owner_name ?? (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td>
                        <ScoreChip
                          likelihood={r.inherent_likelihood}
                          impact={r.inherent_impact}
                        />
                      </td>
                      <td>
                        <ScoreChip
                          likelihood={r.residual_likelihood}
                          impact={r.residual_impact}
                        />
                      </td>
                      <td>
                        <MovementArrow
                          delta={r.movement.delta}
                          direction={r.movement.direction}
                          previous={r.movement.previousResidual}
                        />
                      </td>
                      <td>
                        <BandPill band={r.residual_band} />
                      </td>
                    </tr>
                  ))}
                  {board.topRisks.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No risks have been scored yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
