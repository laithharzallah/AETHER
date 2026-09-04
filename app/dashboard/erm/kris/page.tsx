import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { KriDashboard } from '@/components/erm/kri-dashboard'
import { Stat } from '@/components/erm/charts'
import { getKriDashboard } from '@/lib/erm/queries'

export const dynamic = 'force-dynamic'

export default async function ErmKrisPage() {
  const rows = await getKriDashboard()

  const red = rows.filter((r) => r.status_rag === 'red').length
  const amber = rows.filter((r) => r.status_rag === 'amber').length
  const green = rows.filter((r) => r.status_rag === 'green').length
  const noReading = rows.filter((r) => r.status_rag === 'none').length

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/dashboard/erm"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Enterprise Risk
      </Link>

      <div className="mt-4">
        <h1 className="page-title">Key risk indicators</h1>
        <p className="page-lede mt-3 max-w-3xl">
          KRIs are forward-looking measures of exposure. Amber marks early warning; red marks
          a reading outside tolerance, which is the point at which the risk should be
          re-assessed and, where it breaches appetite, escalated.
        </p>
      </div>

      {rows.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="In breach" value={red} hint="red" tone={red > 0 ? 'bad' : 'good'} />
          <Stat
            label="Early warning"
            value={amber}
            hint="amber"
            tone={amber > 0 ? 'warn' : 'default'}
          />
          <Stat label="Within tolerance" value={green} hint="green" tone="good" />
          <Stat
            label="No reading"
            value={noReading}
            hint="never measured"
            tone={noReading > 0 ? 'warn' : 'default'}
          />
        </div>
      )}

      <div className="mt-8">
        <KriDashboard rows={rows} />
      </div>
    </div>
  )
}
