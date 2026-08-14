import Link from 'next/link'
import { ExternalLink, Radar } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Stat, StatGrid } from '@/components/dashboard/stat'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Pill, RelevancePill, SeverityPill, StatusPill } from '@/components/dashboard/pills'
import { SignalTriage } from '@/components/machine/signal-triage'
import { formatDate, formatRelativeDays, humanize } from '@/lib/dashboard/format'

export const dynamic = 'force-dynamic'

const BANDS = ['all', 'critical', 'urgent', 'relevant', 'watch'] as const
type BandFilter = (typeof BANDS)[number]

const STATUSES = ['new', 'triaged', 'dismissed'] as const

type ScoreBreakdown = {
  components?: Array<{
    key: string
    label: string
    raw: number
    weight: number
    detail: string
  }>
  modifiers?: Array<{ key: string; factor: number; detail: string }>
}

type SignalRelation = {
  summary: string
  category: string
  severity: string | null
  impact_analysis: string | null
  recommended_action: string | null
  deadline_date: string | null
  effective_date: string | null
  analysis_method: string
  intelligence_items: {
    title: string
    url: string | null
    published_at: string | null
    intelligence_sources: {
      name: string
      regulator: string | null
      authority_tier: number
    } | null
  } | null
}

export default async function RiskHorizonPage({
  searchParams,
}: {
  searchParams: Promise<{ band?: string; status?: string }>
}) {
  const context = await requireOrganization()
  const params = await searchParams

  const band: BandFilter = BANDS.includes(params.band as BandFilter)
    ? (params.band as BandFilter)
    : 'all'
  const statusFilter = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : 'new'

  const supabase = await createClient()

  let query = supabase
    .from('signal_assessments')
    .select(
      `id, relevance_score, relevance_band, rationale, score_breakdown,
       matched_frameworks, affected_control_count, status, created_at,
       risk_signals (
         summary, category, severity, impact_analysis, recommended_action,
         deadline_date, effective_date, analysis_method,
         intelligence_items ( title, url, published_at,
           intelligence_sources ( name, regulator, authority_tier ) )
       )`
    )
    .eq('organization_id', context.orgId)
    .eq('status', statusFilter)
    .order('relevance_score', { ascending: false })
    .limit(40)

  if (band !== 'all') query = query.eq('relevance_band', band)

  const [assessments, allRows] = await Promise.all([
    query,
    supabase
      .from('signal_assessments')
      .select('relevance_band, status')
      .eq('organization_id', context.orgId),
  ])

  const newRows = (allRows.data ?? []).filter((r) => r.status === 'new')
  const countBand = (b: string) => newRows.filter((r) => r.relevance_band === b).length

  const rows = assessments.data ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Risk Horizon"
        description="Regulatory changes, advisories and enforcement actions, each scored for how much it actually matters to your organization. Expand any signal to see the reasoning behind its score."
      />

      <StatGrid>
        <Stat
          label="Critical"
          value={countBand('critical')}
          tone={countBand('critical') > 0 ? 'bad' : 'good'}
          hint="Mandatory framework, immediate exposure"
        />
        <Stat
          label="Urgent"
          value={countBand('urgent')}
          tone={countBand('urgent') > 0 ? 'warn' : 'good'}
          hint="Act on these next"
        />
        <Stat label="Relevant" value={countBand('relevant')} hint="Applies to you" />
        <Stat
          label="Watch"
          value={countBand('watch')}
          hint="Background — no obligation identified yet"
        />
      </StatGrid>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <nav className="flex flex-wrap gap-1" aria-label="Filter by relevance band">
          {BANDS.map((b) => (
            <Link
              key={b}
              href={`/dashboard/risk-horizon?band=${b}&status=${statusFilter}`}
              aria-current={b === band ? 'true' : undefined}
              className={
                b === band
                  ? 'rounded-lg bg-foreground/5 px-2.5 py-1 text-xs font-medium'
                  : 'rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-foreground/5'
              }
            >
              {b}
            </Link>
          ))}
        </nav>

        <span aria-hidden className="text-xs text-muted-foreground">
          ·
        </span>

        <nav className="flex flex-wrap gap-1" aria-label="Filter by triage status">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/dashboard/risk-horizon?band=${band}&status=${s}`}
              aria-current={s === statusFilter ? 'true' : undefined}
              className={
                s === statusFilter
                  ? 'rounded-lg bg-foreground/5 px-2.5 py-1 text-xs font-medium'
                  : 'rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-foreground/5'
              }
            >
              {s}
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Radar}
          title={
            statusFilter === 'new'
              ? 'No signals awaiting review'
              : `No ${statusFilter} signals`
          }
          description={
            statusFilter === 'new'
              ? 'Nothing in the last 30 days scored above the noise threshold for your organization. The engine polls regulator publications on a schedule; a signal appears here once it is judged relevant to the frameworks you hold and the jurisdictions you operate in.'
              : 'Nothing here yet.'
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const signal = row.risk_signals as SignalRelation | null
            if (!signal) return null

            const document = signal.intelligence_items
            const source = document?.intelligence_sources
            const breakdown = (row.score_breakdown ?? {}) as ScoreBreakdown

            return (
              <article
                key={row.id}
                className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <RelevancePill band={row.relevance_band} score={row.relevance_score} />
                  <SeverityPill severity={signal.severity} />
                  <Pill>{humanize(signal.category)}</Pill>
                  {row.status !== 'new' && <StatusPill status={row.status} />}
                  {signal.analysis_method === 'heuristic' && (
                    <Pill
                      title="Analysed by pattern matching rather than a language model, so severity is conservative and confidence is capped."
                    >
                      heuristic
                    </Pill>
                  )}
                  {source && (
                    <span className="text-xs text-muted-foreground">
                      {source.regulator ?? source.name}
                      {source.authority_tier === 1 && ' · binding'}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDays(document?.published_at ?? row.created_at)}
                  </span>
                </div>

                <h2 className="mt-2 text-sm font-medium">
                  {document?.url ? (
                    <a
                      href={document.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1 underline-offset-4 hover:underline"
                    >
                      {document.title}
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                    </a>
                  ) : (
                    (document?.title ?? signal.summary.slice(0, 120))
                  )}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">{signal.summary}</p>

                {signal.impact_analysis && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Impact: </span>
                    {signal.impact_analysis}
                  </p>
                )}

                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  {(row.matched_frameworks ?? []).length > 0 && (
                    <div>
                      <dt className="inline font-medium text-foreground">
                        Your frameworks affected:{' '}
                      </dt>
                      <dd className="inline">
                        {(row.matched_frameworks ?? []).join(', ')}
                      </dd>
                    </div>
                  )}
                  {row.affected_control_count > 0 && (
                    <div>
                      <dt className="inline font-medium text-foreground">Controls: </dt>
                      <dd className="inline">{row.affected_control_count} affected</dd>
                    </div>
                  )}
                  {signal.deadline_date && (
                    <div>
                      <dt className="inline font-medium text-foreground">Deadline: </dt>
                      <dd className="inline">
                        {formatDate(signal.deadline_date)} (
                        {formatRelativeDays(signal.deadline_date)})
                      </dd>
                    </div>
                  )}
                  {signal.effective_date && (
                    <div>
                      <dt className="inline font-medium text-foreground">Effective: </dt>
                      <dd className="inline">{formatDate(signal.effective_date)}</dd>
                    </div>
                  )}
                </dl>

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                    Why this score
                  </summary>
                  <div className="mt-2 rounded-lg bg-foreground/[0.03] p-3">
                    <p className="text-xs text-muted-foreground">{row.rationale}</p>

                    {(breakdown.components ?? []).length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="pb-1 font-medium">Factor</th>
                              <th className="pb-1 font-medium">Score</th>
                              <th className="pb-1 font-medium">Weight</th>
                              <th className="pb-1 font-medium">Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(breakdown.components ?? []).map((component) => (
                              <tr key={component.key} className="align-top">
                                <td className="py-1 pr-3 whitespace-nowrap">
                                  {component.label}
                                </td>
                                <td className="py-1 pr-3 tabular-nums">
                                  {(component.raw * 100).toFixed(0)}%
                                </td>
                                <td className="py-1 pr-3 tabular-nums text-muted-foreground">
                                  {(component.weight * 100).toFixed(0)}%
                                </td>
                                <td className="py-1 text-muted-foreground">
                                  {component.detail}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {(breakdown.modifiers ?? []).length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {(breakdown.modifiers ?? []).map((modifier) => (
                          <li key={modifier.key}>
                            <span className="font-medium text-foreground">
                              ×{modifier.factor.toFixed(2)}
                            </span>{' '}
                            {modifier.detail}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>

                {signal.recommended_action && (
                  <p className="mt-3 rounded-lg bg-foreground/[0.03] p-3 text-xs">
                    <span className="font-medium">Recommended: </span>
                    <span className="text-muted-foreground">
                      {signal.recommended_action}
                    </span>
                  </p>
                )}

                {context.canWrite && (
                  <div className="mt-3">
                    <SignalTriage assessmentId={row.id} status={row.status} />
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
