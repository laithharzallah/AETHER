import { Cpu, RefreshCw } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Stat, StatGrid } from '@/components/dashboard/stat'
import { EmptyState } from '@/components/dashboard/empty-state'
import { AiTierPill, Pill } from '@/components/dashboard/pills'
import { AddAiSystemForm } from '@/components/registers/add-ai-system-form'
import { ReclassifyButton } from '@/components/registers/reclassify-button'
import { formatRelativeDays, humanize } from '@/lib/dashboard/format'

export const dynamic = 'force-dynamic'

export default async function AiGovernancePage() {
  const context = await requireOrganization()
  const supabase = await createClient()

  const { data: systems } = await supabase
    .from('ai_systems')
    .select(
      'id, name, purpose, lifecycle_stage, role, model_provider, eu_ai_act_class, eu_ai_act_rationale, sdaia_risk_tier, classification_at, human_in_the_loop, makes_automated_decisions, processes_personal_data, eu_market_exposure, last_risk_assessment_at'
    )
    .eq('organization_id', context.orgId)
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = systems ?? []
  const unclassified = rows.filter((s) => !s.eu_ai_act_class && !s.sdaia_risk_tier).length
  const highRisk = rows.filter(
    (s) => s.eu_ai_act_class === 'high' || s.sdaia_risk_tier === 'high'
  ).length
  const prohibited = rows.filter(
    (s) => s.eu_ai_act_class === 'prohibited' || s.sdaia_risk_tier === 'unacceptable'
  ).length
  const inProduction = rows.filter((s) => s.lifecycle_stage === 'production').length

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="AI Governance"
        description="The AI system inventory both the SDAIA AI Ethics Principles and the EU AI Act require. Each system is tiered against both regimes from rules held as data, so every classification carries its citation."
      />

      <StatGrid>
        <Stat label="Systems" value={rows.length} hint={`${inProduction} in production`} />
        <Stat
          label="Unclassified"
          value={unclassified}
          tone={unclassified > 0 ? 'warn' : 'good'}
          hint="Obligations unknown until tiered"
        />
        <Stat
          label="High risk"
          value={highRisk}
          tone={highRisk > 0 ? 'bad' : 'good'}
          hint="Carry the heaviest obligation set"
        />
        <Stat
          label="Prohibited"
          value={prohibited}
          tone={prohibited > 0 ? 'bad' : 'good'}
          hint={prohibited > 0 ? 'Must not be placed on the market' : 'None'}
        />
      </StatGrid>

      {prohibited > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-medium text-destructive">
            {prohibited} system(s) classified as a prohibited practice
          </p>
          <p className="mt-1 text-muted-foreground">
            EU AI Act Article 5 bans these outright, and the SDAIA principles treat the
            equivalent uses as unacceptable. A prohibited system cannot be brought into
            compliance by adding controls — the use itself has to stop.
          </p>
        </div>
      )}

      {context.canWrite && <AddAiSystemForm />}

      {rows.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No AI systems recorded"
          description="Both the EU AI Act and the SDAIA principles start from an inventory: you cannot demonstrate an obligation is met for a system nobody has written down. Add the models and AI-enabled features in use, including procured and embedded ones."
        />
      ) : (
        <section className="space-y-3">
          {rows.map((system) => (
            <article
              key={system.id}
              className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AiTierPill tier={system.eu_ai_act_class} label="EU AI Act" />
                    <AiTierPill tier={system.sdaia_risk_tier} label="SDAIA" />
                    <Pill>{humanize(system.lifecycle_stage)}</Pill>
                    <Pill>{humanize(system.role)}</Pill>
                    {system.eu_market_exposure && <Pill tone="info">EU exposure</Pill>}
                  </div>

                  <h2 className="mt-2 text-sm font-medium">{system.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{system.purpose}</p>

                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    {system.model_provider && <span>Provider: {system.model_provider}</span>}
                    <span>
                      {system.human_in_the_loop
                        ? 'Human in the loop'
                        : 'No human in the loop'}
                    </span>
                    {system.makes_automated_decisions && <span>Automated decisions</span>}
                    {system.processes_personal_data && <span>Processes personal data</span>}
                    <span>
                      {system.classification_at
                        ? `classified ${formatRelativeDays(system.classification_at)}`
                        : 'never classified'}
                    </span>
                  </div>

                  {system.eu_ai_act_rationale && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                        Why this classification
                      </summary>
                      <p className="mt-2 rounded-lg bg-foreground/[0.03] p-3 text-xs whitespace-pre-line text-muted-foreground">
                        {system.eu_ai_act_rationale}
                      </p>
                    </details>
                  )}
                </div>

                {context.canWrite && (
                  <ReclassifyButton systemId={system.id} icon={<RefreshCw />} />
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
