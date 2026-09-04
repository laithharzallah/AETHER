import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DeficiencyLog } from '@/components/icfr/deficiency-log'
import { listDeficiencies } from '@/lib/icfr/queries'

export const dynamic = 'force-dynamic'

export default async function IcfrDeficienciesPage() {
  const rows = await listDeficiencies()
  const active = rows.filter((r) => r.status === 'open' || r.status === 'in_remediation')
  const mw = active.filter((r) => r.severity === 'material_weakness').length
  const sd = active.filter((r) => r.severity === 'significant_deficiency').length

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/dashboard/icfr"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        ICFR
      </Link>
      <div className="mt-4">
        <h1
          className="text-3xl tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
        >
          Deficiency log
        </h1>
        <p className="mt-3 text-muted-foreground">
          {active.length} open · {mw} material weakness{mw === 1 ? '' : 'es'} · {sd} significant
          deficienc{sd === 1 ? 'y' : 'ies'}. Aggregate by severity when concluding on ICFR
          effectiveness for the board report.
        </p>
      </div>
      <div className="mt-8">
        <DeficiencyLog rows={rows} />
      </div>
    </div>
  )
}
