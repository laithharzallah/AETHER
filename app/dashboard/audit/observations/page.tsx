import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Stat } from '@/components/audit/badges'
import { ObservationRegister } from '@/components/audit/observation-register'
import { OPEN_OBSERVATION_STATUSES } from '@/lib/audit/constants'
import { listObservations } from '@/lib/audit/queries'

export const dynamic = 'force-dynamic'

export default async function AuditObservationsPage() {
  const rows = await listObservations()
  const open = rows.filter((r) =>
    (OPEN_OBSERVATION_STATUSES as readonly string[]).includes(r.status)
  )
  const critical = open.filter((r) => r.rating === 'critical').length
  const high = open.filter((r) => r.rating === 'high').length
  const repeat = open.filter((r) => r.repeat_finding).length
  const noAction = open.filter((r) => r.action_count === 0).length

  return (
    <div className="mx-auto max-w-[100rem]">
      <Link
        href="/dashboard/audit"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Internal Audit
      </Link>

      <div className="mt-4">
        <h1 className="page-title">Observation register</h1>
        <p className="page-lede">
          Every finding across all engagements, documented as condition, criteria, cause and
          effect with a recommendation. Aggregate the critical and high ratings and the
          repeat findings when reporting the state of the control environment to the audit
          committee.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total raised" value={rows.length} hint={`${open.length} unresolved`} />
        <Stat label="Critical" value={critical} tone={critical > 0 ? 'bad' : 'good'} />
        <Stat label="High" value={high} tone={high > 0 ? 'warn' : 'good'} />
        <Stat
          label="Repeat findings"
          value={repeat}
          tone={repeat > 0 ? 'bad' : 'good'}
          hint="raised in a prior engagement"
        />
        <Stat
          label="No agreed action"
          value={noAction}
          tone={noAction > 0 ? 'warn' : 'good'}
          hint="blocks report issue"
        />
      </div>

      <div className="mt-6">
        <ObservationRegister rows={rows} />
      </div>
    </div>
  )
}
