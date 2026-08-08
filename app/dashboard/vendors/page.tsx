import { Boxes } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Stat, StatGrid } from '@/components/dashboard/stat'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Pill, SeverityPill, StatusPill } from '@/components/dashboard/pills'
import { AddVendorForm, VendorAssessment } from '@/components/registers/vendor-forms'
import { countryName, formatRelativeDays } from '@/lib/dashboard/format'

export const dynamic = 'force-dynamic'

export default async function VendorsPage() {
  const context = await requireOrganization()
  const supabase = await createClient()

  const { data: vendors } = await supabase
    .from('vendors')
    .select(
      'id, name, category, country, criticality, is_cloud_provider, data_residency, assessment_status, residual_risk, last_reviewed_at, next_review_at, contract_end'
    )
    .eq('organization_id', context.orgId)
    .order('criticality', { ascending: false })
    .order('name')
    .limit(300)

  const rows = vendors ?? []
  const critical = rows.filter((v) => v.criticality === 'critical').length
  const unassessed = rows.filter(
    (v) =>
      v.assessment_status === 'not_started' &&
      ['high', 'critical'].includes(v.criticality)
  ).length

  const now = new Date()
  const overdueReview = rows.filter((v) => {
    if (!['high', 'critical'].includes(v.criticality)) return false
    if (!v.last_reviewed_at) return v.assessment_status !== 'not_started'
    const days = (now.getTime() - new Date(v.last_reviewed_at).getTime()) / 86_400_000
    return days > 365
  }).length

  const cloudProviders = rows.filter((v) => v.is_cloud_provider).length

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Third Parties"
        description="Suppliers, outsourcing arrangements and cloud services. ISO 27001 A.5.22 and NCA ECC 4-1 both require ongoing monitoring, not a one-off check at onboarding."
      />

      <StatGrid>
        <Stat label="Third parties" value={rows.length} hint={`${critical} critical`} />
        <Stat
          label="Never assessed"
          value={unassessed}
          tone={unassessed > 0 ? 'bad' : 'good'}
          hint="High or critical, no assessment on record"
        />
        <Stat
          label="Review overdue"
          value={overdueReview}
          tone={overdueReview > 0 ? 'warn' : 'good'}
          hint="Last reviewed more than a year ago"
        />
        <Stat
          label="Cloud providers"
          value={cloudProviders}
          hint="Shared-responsibility obligations apply"
        />
      </StatGrid>

      {context.canWrite && <AddVendorForm />}

      {rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No third parties recorded"
          description="Supply chain compromise reaches an organization through suppliers it has not assessed. Start with anything holding your data, anything with privileged access, and any service you could not operate without for a week."
        />
      ) : (
        <section className="space-y-3">
          {rows.map((vendor) => (
            <article
              key={vendor.id}
              className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityPill severity={vendor.criticality} />
                    <StatusPill status={vendor.assessment_status} />
                    {vendor.is_cloud_provider && <Pill tone="info">cloud</Pill>}
                    {vendor.country && <Pill>{countryName(vendor.country)}</Pill>}
                  </div>

                  <h2 className="mt-2 text-sm font-medium">{vendor.name}</h2>

                  <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    {vendor.category && <span>{vendor.category}</span>}
                    {vendor.data_residency && <span>Data: {vendor.data_residency}</span>}
                    <span>
                      {vendor.last_reviewed_at
                        ? `reviewed ${formatRelativeDays(vendor.last_reviewed_at)}`
                        : 'never reviewed'}
                    </span>
                    {vendor.residual_risk && (
                      <span>Residual risk: {vendor.residual_risk}</span>
                    )}
                  </div>
                </div>

                {context.canWrite && (
                  <VendorAssessment
                    vendorId={vendor.id}
                    assessmentStatus={vendor.assessment_status}
                    residualRisk={vendor.residual_risk}
                  />
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
