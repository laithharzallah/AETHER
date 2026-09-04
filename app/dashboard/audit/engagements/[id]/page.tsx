import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import {
  EngagementStatusBadge,
  OverallRatingBadge,
  Ref,
} from '@/components/audit/badges'
import {
  AdvanceStageButton,
  EngagementWorkbench,
} from '@/components/audit/engagement-workbench'
import {
  ENGAGEMENT_TYPE_LABEL,
  formatDate,
  formatDays,
  type EngagementType,
} from '@/lib/audit/constants'
import { getEngagement, listUniverse } from '@/lib/audit/queries'

export const dynamic = 'force-dynamic'

export default async function AuditEngagementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [detail, universe] = await Promise.all([getEngagement(id), listUniverse()])
  if (!detail) notFound()

  const { engagement } = detail

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/dashboard/audit"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Internal Audit
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Ref>{engagement.code}</Ref>
            <EngagementStatusBadge status={engagement.status} />
            <OverallRatingBadge rating={engagement.overall_rating} />
            <span className="pill pill-neutral">
              {ENGAGEMENT_TYPE_LABEL[engagement.type as EngagementType] ?? engagement.type}
            </span>
          </div>
          <h1 className="page-title mt-3">{engagement.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {engagement.universe ? `${engagement.universe.code} — ${engagement.universe.name} · ` : ''}
            Lead {engagement.lead_auditor?.name ?? 'unassigned'} · auditee{' '}
            {engagement.auditee_owner?.name ?? 'unassigned'}
            {engagement.plan ? ` · ${engagement.plan.period} plan` : ''}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Fieldwork {formatDate(engagement.fieldwork_start)} to{' '}
            {formatDate(engagement.fieldwork_end)} · report target{' '}
            {formatDate(engagement.report_target_date)} · budget{' '}
            {formatDays(engagement.budget_days)} days
            {engagement.actual_days ? `, actual ${formatDays(engagement.actual_days)}` : ''}
            {engagement.report_issued_at
              ? ` · issued ${formatDate(engagement.report_issued_at)}`
              : ''}
          </p>
        </div>
        <AdvanceStageButton engagementId={engagement.id} status={engagement.status} />
      </div>

      <div className="mt-8">
        <EngagementWorkbench detail={detail} universe={universe} />
      </div>
    </div>
  )
}
