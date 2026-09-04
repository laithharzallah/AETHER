import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PlanStatusBadge } from '@/components/audit/badges'
import { CapacityBar, PlanBoard } from '@/components/audit/plan-board'
import { AddPlanItemDialog, ApprovePlanButton } from '@/components/audit/plan-dialogs'
import { formatDate } from '@/lib/audit/constants'
import { getPlan, listUniverse } from '@/lib/audit/queries'

export const dynamic = 'force-dynamic'

export default async function AuditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [detail, universe] = await Promise.all([getPlan(id), listUniverse()])
  if (!detail) notFound()

  const { plan } = detail

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/dashboard/audit/plans"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Audit plans
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <PlanStatusBadge status={plan.status} />
            {detail.approver && (
              <span className="text-xs text-muted-foreground">
                Approved by {detail.approver.name}
                {plan.approved_at ? ` on ${formatDate(plan.approved_at)}` : ''}
              </span>
            )}
          </div>
          <h1 className="page-title mt-2">{plan.period} internal audit plan</h1>
          {plan.notes && <p className="page-lede">{plan.notes}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddPlanItemDialog planId={plan.id} universe={universe} existing={detail.items} />
          <ApprovePlanButton planId={plan.id} status={plan.status} />
        </div>
      </div>

      <div className="mt-6">
        <CapacityBar capacity={detail.capacity} />
      </div>

      <div className="mt-8">
        <PlanBoard detail={detail} />
      </div>
    </div>
  )
}
