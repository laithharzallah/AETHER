import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import {
  AssessmentDialog,
} from '@/components/erm/assessment-dialog'
import { RiskFormDialog } from '@/components/erm/risk-form-dialog'
import { TreatmentsPanel } from '@/components/erm/treatments-panel'
import { RiskKrisPanel } from '@/components/erm/risk-kris-panel'
import { RiskControlsPanel } from '@/components/erm/risk-controls-panel'
import {
  BandPill,
  MovementArrow,
  RiskStatusPill,
  ScoreChip,
  TrendPill,
  VelocityLabel,
} from '@/components/erm/badges'
import {
  IMPACT_DIMENSIONS,
  IMPACT_DIMENSION_LABEL,
  IMPACT_LABEL,
  LIKELIHOOD_LABEL,
  RISK_BAND_ACTION,
  RISK_SOURCE_LABEL,
  type RiskSource,
} from '@/lib/erm/constants'
import {
  getRisk,
  listIcfrControls,
  listLibraryControls,
} from '@/lib/erm/queries'

export const dynamic = 'force-dynamic'

function DimensionBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{value}/5</span>
      </div>
      <div className="meter mt-1">
        <span style={{ width: `${(value / 5) * 100}%` }} />
      </div>
    </div>
  )
}

export default async function ErmRiskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getRisk(id)
  if (!detail) notFound()

  const [libraryControls, icfrControls] = await Promise.all([
    listLibraryControls(),
    listIcfrControls(),
  ])

  const { risk, raw, controls, treatments, kris, assessments, links, members, categories } =
    detail

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    code: c.code,
    name_en: c.name_en,
    level: c.level,
    parent_id: c.parent_id,
  }))

  const dimensions =
    raw.impact_dimensions && typeof raw.impact_dimensions === 'object'
      ? (raw.impact_dimensions as Record<string, unknown>)
      : {}

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/dashboard/erm/risks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Risk register
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              {risk.code}
            </code>
            <RiskStatusPill status={risk.status} />
            <BandPill band={risk.residual_band} />
            {risk.appetite_breach && (
              <span className="pill pill-danger">
                Outside appetite — tolerance {risk.tolerance_threshold}
              </span>
            )}
            {risk.emerging && <span className="pill pill-brass">Emerging</span>}
          </div>
          <h1 className="page-title mt-3">{risk.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Owner: {risk.owner_name ?? 'Unassigned'}
            {risk.sponsor_name && <> · Sponsor: {risk.sponsor_name}</>}
            {' · '}
            {risk.parent_category_name_en ?? 'Unclassified'}
            {risk.category_name_en && risk.category_name_en !== risk.parent_category_name_en && (
              <> / {risk.category_name_en}</>
            )}
            {' · '}Identified through{' '}
            {RISK_SOURCE_LABEL[(risk.source ?? 'workshop') as RiskSource] ?? risk.source}
            {risk.last_assessed_at && (
              <> · Last assessed {risk.last_assessed_at.slice(0, 10)}</>
            )}
            {risk.next_review_at && <> · Next review {risk.next_review_at}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AssessmentDialog
            riskId={risk.id ?? id}
            riskCode={risk.code ?? ''}
            current={{
              inherentLikelihood: risk.inherent_likelihood,
              inherentImpact: risk.inherent_impact,
              residualLikelihood: risk.residual_likelihood,
              residualImpact: risk.residual_impact,
              targetLikelihood: risk.target_likelihood,
              targetImpact: risk.target_impact,
              velocity: risk.velocity,
              trend: risk.trend,
            }}
          />
          <RiskFormDialog
            categories={categoryOptions}
            members={members}
            variant="outline"
            initial={{
              id: risk.id ?? id,
              title: risk.title ?? '',
              description: risk.description ?? '',
              causes: raw.causes ?? '',
              consequences: raw.consequences ?? '',
              categoryId: risk.category_id ?? '',
              ownerId: risk.owner_id ?? '',
              sponsorId: risk.sponsor_id ?? '',
              source: risk.source ?? 'workshop',
              status: risk.status ?? 'identified',
              inherentLikelihood: risk.inherent_likelihood,
              inherentImpact: risk.inherent_impact,
              residualLikelihood: risk.residual_likelihood,
              residualImpact: risk.residual_impact,
              targetLikelihood: risk.target_likelihood,
              targetImpact: risk.target_impact,
              velocity: risk.velocity,
              trend: risk.trend ?? 'stable',
              emerging: Boolean(risk.emerging),
              nextReviewAt: risk.next_review_at ?? '',
              impactDimensions: Object.fromEntries(
                Object.entries(dimensions).filter(
                  (entry): entry is [string, number] => typeof entry[1] === 'number'
                )
              ),
            }}
          />
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="surface p-4">
            <p className="eyebrow">Risk statement</p>
            <p className="mt-2 leading-relaxed">
              {risk.description ?? (
                <span className="text-muted-foreground">
                  No risk statement recorded. State the risk as source → event → consequence,
                  anchored to the objective it threatens.
                </span>
              )}
            </p>
            {(raw.causes || raw.consequences) && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {raw.causes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Risk sources / causes
                    </p>
                    <p className="mt-1 text-sm">{raw.causes}</p>
                  </div>
                )}
                {raw.consequences && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Consequences</p>
                    <p className="mt-1 text-sm">{raw.consequences}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <RiskControlsPanel
            riskId={risk.id ?? id}
            controls={controls}
            links={links}
            libraryControls={libraryControls}
            icfrControls={icfrControls}
          />

          <TreatmentsPanel
            riskId={risk.id ?? id}
            treatments={treatments}
            members={members}
          />

          <RiskKrisPanel riskId={risk.id ?? id} kris={kris} members={members} />

          <div className="surface p-4">
            <p className="eyebrow">Review and revision</p>
            <h2 className="mt-1 text-base font-medium">Assessment history</h2>
            {assessments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No assessment has been recorded yet.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="data-table min-w-[620px]">
                  <thead>
                    <tr>
                      <th className="w-32">Assessed</th>
                      <th className="w-32">By</th>
                      <th className="w-28">Inherent</th>
                      <th className="w-28">Residual</th>
                      <th>Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map((a) => (
                      <tr key={a.id}>
                        <td className="tabular-nums text-xs">
                          {a.assessed_at.slice(0, 10)}
                        </td>
                        <td className="text-xs">
                          {a.assessor?.name ?? (
                            <span className="text-muted-foreground">System</span>
                          )}
                        </td>
                        <td>
                          <ScoreChip likelihood={a.inherent_l} impact={a.inherent_i} />
                        </td>
                        <td>
                          <ScoreChip likelihood={a.residual_l} impact={a.residual_i} />
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {a.rationale ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface p-4">
            <p className="eyebrow">Scoring</p>
            <h2 className="mt-1 text-base font-medium">Inherent, residual and target</h2>

            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-xs text-muted-foreground">Inherent — before controls</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <ScoreChip
                    likelihood={risk.inherent_likelihood}
                    impact={risk.inherent_impact}
                  />
                  <BandPill band={risk.inherent_band} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Residual — after controls</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <ScoreChip
                    likelihood={risk.residual_likelihood}
                    impact={risk.residual_impact}
                  />
                  <BandPill band={risk.residual_band} />
                  <MovementArrow
                    delta={risk.movement.delta}
                    direction={risk.movement.direction}
                    previous={risk.movement.previousResidual}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Target — after treatment</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <ScoreChip
                    likelihood={risk.target_likelihood}
                    impact={risk.target_impact}
                  />
                  <BandPill band={risk.target_band} />
                </dd>
              </div>
            </dl>

            {risk.residual_likelihood && risk.residual_impact && (
              <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Residual likelihood is {LIKELIHOOD_LABEL[risk.residual_likelihood]} and the
                impact is {IMPACT_LABEL[risk.residual_impact]}.{' '}
                {risk.residual_band && RISK_BAND_ACTION[risk.residual_band]}
              </p>
            )}

            {assessments[0]?.rationale && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Rationale for the current scores
                </p>
                <p className="mt-1 text-sm">{assessments[0].rationale}</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Velocity</p>
                <VelocityLabel velocity={risk.velocity} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Trend</p>
                <TrendPill trend={risk.trend} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Appetite</p>
                <p>{risk.appetite_level ?? 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tolerance</p>
                <p className="tabular-nums">{risk.tolerance_threshold ?? '—'}</p>
              </div>
            </div>
          </div>

          {IMPACT_DIMENSIONS.some((d) => typeof dimensions[d] === 'number') && (
            <div className="surface p-4">
              <p className="eyebrow">Impact profile</p>
              <h2 className="mt-1 text-base font-medium">Consequence by dimension</h2>
              <div className="mt-3 space-y-2.5">
                {IMPACT_DIMENSIONS.filter((d) => typeof dimensions[d] === 'number').map((d) => (
                  <DimensionBar
                    key={d}
                    label={IMPACT_DIMENSION_LABEL[d]}
                    value={dimensions[d] as number}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="surface p-4">
            <p className="eyebrow">At a glance</p>
            <dl className="mt-2 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Controls linked</dt>
                <dd className="tabular-nums">{controls.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Open treatments</dt>
                <dd className="tabular-nums">
                  {treatments.filter((t) => t.status !== 'complete' && t.status !== 'cancelled').length}
                  {treatments.some((t) => t.is_overdue) && (
                    <span className="ml-1.5 text-danger">
                      ({treatments.filter((t) => t.is_overdue).length} overdue)
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">KRIs</dt>
                <dd className="tabular-nums">
                  {kris.length}
                  {kris.some((k) => k.status_rag === 'red') && (
                    <span className="ml-1.5 text-danger">
                      ({kris.filter((k) => k.status_rag === 'red').length} in breach)
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Linked records</dt>
                <dd className="tabular-nums">{links.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Assessments</dt>
                <dd className="tabular-nums">{assessments.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
