import { TriangleAlert } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Stat, StatGrid } from '@/components/dashboard/stat'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Pill, StatusPill } from '@/components/dashboard/pills'
import {
  AddRiskForm,
  type RiskCategoryOption,
} from '@/components/registers/add-risk-form'
import { RiskTreatment } from '@/components/registers/risk-treatment'
import { formatRelativeDays, humanize } from '@/lib/dashboard/format'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** 1-25 on the likelihood × impact grid. */
function scoreTone(score: number): string {
  if (score >= 15) return 'text-destructive'
  if (score >= 8) return 'text-amber-600 dark:text-amber-400'
  return 'text-muted-foreground'
}

export default async function RisksPage() {
  const context = await requireOrganization()
  const supabase = await createClient()

  const [risks, taxonomy] = await Promise.all([
    supabase
      .from('risks')
      .select(
        'id, title, description, category, status, treatment_strategy, inherent_likelihood, inherent_impact, inherent_score, residual_likelihood, residual_impact, residual_score, frameworks_affected, created_by_machine, accepted_rationale, identified_at'
      )
      .eq('organization_id', context.orgId)
      .order('residual_score', { ascending: false })
      .limit(200),
    supabase
      .from('risk_taxonomy')
      .select('code, name, category, default_likelihood, default_impact')
      .order('category')
      .order('name'),
  ])

  const rows = risks.data ?? []
  const categories = (taxonomy.data ?? []) as RiskCategoryOption[]
  const categoryNames = new Map(categories.map((c) => [c.code, c.name]))

  const open = rows.filter((r) => ['open', 'assessing', 'mitigating'].includes(r.status))
  const highResidual = rows.filter(
    (r) => (r.residual_score ?? 0) >= 15 && r.status !== 'closed'
  ).length
  const accepted = rows.filter((r) => r.status === 'accepted').length
  const unmitigated = open.filter((r) => r.residual_score === r.inherent_score).length

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Risk Register"
        description="Inherent and residual scoring on a 5×5 grid. Residual defaults to inherent until a treatment reduces it, so a risk nobody has worked on cannot look better than it is."
      />

      <StatGrid>
        <Stat label="Open" value={open.length} tone={open.length > 0 ? 'warn' : 'good'} />
        <Stat
          label="High residual"
          value={highResidual}
          tone={highResidual > 0 ? 'bad' : 'good'}
          hint="Residual score 15 or above"
        />
        <Stat
          label="Untreated"
          value={unmitigated}
          tone={unmitigated > 0 ? 'warn' : 'good'}
          hint="Residual still equals inherent"
        />
        <Stat label="Accepted" value={accepted} hint="Carried with a recorded rationale" />
      </StatGrid>

      {context.canWrite && <AddRiskForm categories={categories} />}

      {rows.length === 0 ? (
        <EmptyState
          icon={TriangleAlert}
          title="The register is empty"
          description="Every framework in the catalogue expects a documented risk management process, and the register is the evidence it runs. The autonomous engine also files risks here when it finds one it can substantiate."
        />
      ) : (
        <section className="space-y-3">
          {rows.map((risk) => {
            const residual = risk.residual_score ?? 0
            const treated = residual < (risk.inherent_score ?? 0)

            return (
              <article
                key={risk.id}
                className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={risk.status} />
                      <Pill>{categoryNames.get(risk.category) ?? risk.category}</Pill>
                      {risk.treatment_strategy && (
                        <Pill>{humanize(risk.treatment_strategy)}</Pill>
                      )}
                      {risk.created_by_machine && (
                        <Pill tone="info" title="Raised by the autonomous engine">
                          auto-raised
                        </Pill>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeDays(risk.identified_at)}
                      </span>
                    </div>

                    <h2 className="mt-2 text-sm font-medium">{risk.title}</h2>

                    {risk.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {risk.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                      <span className="text-muted-foreground">
                        Inherent{' '}
                        <span className="font-medium tabular-nums text-foreground">
                          {risk.inherent_likelihood}×{risk.inherent_impact} ={' '}
                          {risk.inherent_score}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Residual{' '}
                        <span
                          className={cn(
                            'font-medium tabular-nums',
                            scoreTone(residual)
                          )}
                        >
                          {risk.residual_likelihood ?? risk.inherent_likelihood}×
                          {risk.residual_impact ?? risk.inherent_impact} = {residual}
                        </span>
                        {!treated && (
                          <span className="ml-1 text-amber-600 dark:text-amber-400">
                            (untreated)
                          </span>
                        )}
                      </span>
                    </div>

                    {risk.accepted_rationale && (
                      <p className="mt-2 rounded-lg bg-foreground/[0.03] p-2.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Accepted: </span>
                        {risk.accepted_rationale}
                      </p>
                    )}
                  </div>

                  {context.canWrite && (
                    <RiskTreatment
                      riskId={risk.id}
                      status={risk.status}
                      residualLikelihood={risk.residual_likelihood}
                      residualImpact={risk.residual_impact}
                      treatmentStrategy={risk.treatment_strategy}
                    />
                  )}
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
