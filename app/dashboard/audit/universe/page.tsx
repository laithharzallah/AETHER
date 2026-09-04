import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AddUniverseEntryDialog, UniverseTable } from '@/components/audit/universe-table'
import { Stat } from '@/components/audit/badges'
import { listMembers, listUniverse } from '@/lib/audit/queries'

export const dynamic = 'force-dynamic'

export default async function AuditUniversePage() {
  const [rows, members] = await Promise.all([listUniverse(), listMembers()])
  const active = rows.filter((r) => r.status === 'active')
  const due = active.filter((r) => r.is_due)
  const never = active.filter((r) => !r.last_audited_at)
  const critical = active.filter((r) => r.band === 'critical' || r.band === 'high')
  const criticalDue = critical.filter((r) => r.is_due)

  return (
    <div className="mx-auto max-w-[110rem]">
      <Link
        href="/dashboard/audit"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Internal Audit
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Audit universe</h1>
          <p className="page-lede">
            The complete population of auditable entities, each scored on six weighted
            factors. The score sets the audit cycle — entities at 60 or above are pulled to
            at least annual coverage — and drives the sequencing of the plan. Scores are
            editable inline; the weighted score recalculates in the database.
          </p>
        </div>
        <AddUniverseEntryDialog members={members} parents={rows} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Active entities" value={active.length} hint={`${rows.length - active.length} retired`} />
        <Stat
          label="Due for coverage"
          value={due.length}
          tone={due.length > 0 ? 'warn' : 'good'}
          hint="past the effective cycle"
        />
        <Stat
          label="Never audited"
          value={never.length}
          tone={never.length > 0 ? 'bad' : 'good'}
        />
        <Stat label="High or critical risk" value={critical.length} tone="brass" />
        <Stat
          label="High risk and due"
          value={criticalDue.length}
          tone={criticalDue.length > 0 ? 'bad' : 'good'}
          hint="prioritise in the next plan"
        />
      </div>

      <div className="mt-6">
        <UniverseTable rows={rows} members={members} />
      </div>
    </div>
  )
}
