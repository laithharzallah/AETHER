import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Stat } from '@/components/audit/badges'
import { ActionRegister, RefreshOverdueButton } from '@/components/audit/action-register'
import { OPEN_ACTION_STATUSES } from '@/lib/audit/constants'
import { listActions, listMembers } from '@/lib/audit/queries'

export const dynamic = 'force-dynamic'

export default async function AuditActionsPage() {
  const [rows, members] = await Promise.all([listActions(), listMembers()])
  const open = rows.filter((r) =>
    (OPEN_ACTION_STATUSES as readonly string[]).includes(r.status ?? '')
  )
  const overdue = open.filter((r) => r.is_overdue)
  const awaiting = rows.filter((r) => r.status === 'implemented')
  const extended = open.filter((r) => (r.extension_count ?? 0) > 0)
  const criticalOverdue = overdue.filter(
    (r) => r.observation_rating === 'critical' || r.observation_rating === 'high'
  )

  return (
    <div className="mx-auto max-w-[100rem]">
      <Link
        href="/dashboard/audit"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Internal Audit
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Management action follow-up</h1>
          <p className="page-lede">
            Internal audit monitors the disposition of results until management has taken
            action or senior management has accepted the risk of not doing so. An action is
            closed only once internal audit has verified that it was implemented and is
            operating.
          </p>
        </div>
        <RefreshOverdueButton />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Open actions" value={open.length} hint={`${rows.length} total`} />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length > 0 ? 'bad' : 'good'} />
        <Stat
          label="Overdue on high/critical"
          value={criticalOverdue.length}
          tone={criticalOverdue.length > 0 ? 'bad' : 'good'}
          hint="escalate to the audit committee"
        />
        <Stat
          label="Awaiting verification"
          value={awaiting.length}
          tone={awaiting.length > 0 ? 'warn' : 'default'}
          hint="management says implemented"
        />
        <Stat
          label="Extended at least once"
          value={extended.length}
          tone={extended.length > 0 ? 'warn' : 'good'}
        />
      </div>

      <div className="mt-6">
        <ActionRegister rows={rows} members={members} />
      </div>
    </div>
  )
}
