import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Scale,
  ShieldCheck,
  Star,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ImportTemplateDialog } from '@/components/icfr/import-template-dialog'
import { GenerateRcmDialog } from '@/components/icfr/generate-rcm-dialog'
import { getIcfrDashboard, listProcesses, listTemplates } from '@/lib/icfr/queries'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  const toneClass = {
    default: '',
    good: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-warning-foreground',
    bad: 'text-danger',
  }[tone]
  return (
    <div className="surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-medium tabular-nums', toneClass)}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default async function IcfrPage() {
  const [dashboard, processes, templates] = await Promise.all([
    getIcfrDashboard(),
    listProcesses(),
    listTemplates(),
  ])
  const existingCodes = processes.map((p) => p.code ?? '').filter(Boolean)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">
            Internal Control over Financial Reporting
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Risk and control matrices by business cycle, design and operating
            effectiveness testing, and deficiency remediation — aligned to COSO
            2013 for CMA-listed and SOX-style programs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/icfr/deficiencies"
            className={cn(buttonVariants({ variant: 'ghost' }))}
          >
            <AlertTriangle className="h-4 w-4" />
            Deficiency log
          </Link>
          <ImportTemplateDialog templates={templates} existingCodes={existingCodes} />
          <GenerateRcmDialog />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Stat label="Processes" value={dashboard.processes} />
        <Stat label="Controls" value={dashboard.controls} hint={`${dashboard.keyControls} key`} />
        <Stat
          label="Key controls tested"
          value={`${dashboard.keyTestedPct}%`}
          hint={`${dashboard.keyTested} of ${dashboard.keyControls}`}
          tone={dashboard.keyControls === 0 ? 'default' : dashboard.keyTestedPct >= 80 ? 'good' : 'warn'}
        />
        <Stat
          label="Operating effectively"
          value={`${dashboard.keyEffectivePct}%`}
          hint="of tested key controls"
          tone={dashboard.keyTested === 0 ? 'default' : dashboard.keyEffectivePct >= 90 ? 'good' : 'warn'}
        />
        <Stat
          label="Open deficiencies"
          value={dashboard.openDeficiencies}
          hint={`${dashboard.bySeverity.significant_deficiency} significant`}
          tone={dashboard.openDeficiencies > 0 ? 'warn' : 'default'}
        />
        <Stat
          label="Material weaknesses"
          value={dashboard.bySeverity.material_weakness}
          tone={dashboard.bySeverity.material_weakness > 0 ? 'bad' : 'good'}
        />
        <Stat
          label="Overdue remediations"
          value={dashboard.overdueRemediations}
          tone={dashboard.overdueRemediations > 0 ? 'bad' : 'default'}
        />
      </div>

      {processes.length === 0 ? (
        <Card className="mt-10">
          <CardHeader>
            <div className="mb-2 icon-tile">
              <Scale className="h-5 w-5" />
            </div>
            <CardTitle>No processes in scope yet</CardTitle>
            <CardDescription>
              Import a template for a standard cycle (Procure-to-Pay,
              Order-to-Cash, Record-to-Report, Payroll, Fixed Assets, Treasury,
              ITGC) or describe a process and let AETHER draft the RCM.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <ImportTemplateDialog templates={templates} existingCodes={existingCodes} />
            <GenerateRcmDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {processes.map((p) => {
            const keyCount = p.key_control_count ?? 0
            const tested = p.tested_key_controls ?? 0
            const effective = p.effective_key_controls ?? 0
            const testedPct = keyCount ? Math.round((tested / keyCount) * 100) : 0
            const effectivePct = keyCount ? Math.round((effective / keyCount) * 100) : 0
            const mw = p.material_weaknesses ?? 0
            const openDefs = p.open_deficiencies ?? 0
            return (
              <Link
                key={p.id}
                href={`/dashboard/icfr/${p.id}`}
                className="group surface p-4 transition-colors hover:border-foreground/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                        {p.code}
                      </code>
                      {p.status !== 'active' && (
                        <Badge variant="ghost">{p.status}</Badge>
                      )}
                    </div>
                    <p className="mt-2 truncate font-medium group-hover:underline">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.cycle}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Risks</p>
                    <p className="font-medium tabular-nums">{p.risk_count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Controls</p>
                    <p className="font-medium tabular-nums">
                      {p.control_count}
                      <span className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                        {keyCount}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Deficiencies</p>
                    <p
                      className={cn(
                        'font-medium tabular-nums',
                        mw > 0 && 'text-danger',
                        mw === 0 && openDefs > 0 && 'text-warning-foreground'
                      )}
                    >
                      {openDefs}
                      {mw > 0 && <span className="ml-1 text-[10px]">MW</span>}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <ClipboardCheck className="h-3 w-3" />
                      Key controls tested {testedPct}%
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Effective {effectivePct}%
                    </span>
                  </div>
                  <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${effectivePct}%` }}
                    />
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${Math.max(testedPct - effectivePct, 0)}%` }}
                    />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
