import Link from 'next/link'
import { Activity, BrainCircuit, CircleAlert, Radio } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Stat, StatGrid } from '@/components/dashboard/stat'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Pill, StatusPill } from '@/components/dashboard/pills'
import { DirectiveCard, type DirectiveView } from '@/components/machine/directive-card'
import { RunNowButton } from '@/components/machine/run-now-button'
import {
  formatDateTime,
  formatDuration,
  formatRelativeDays,
} from '@/lib/dashboard/format'

export const dynamic = 'force-dynamic'

const STATUS_FILTERS = ['open', 'acknowledged', 'actioned', 'dismissed'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

export default async function MachinePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const context = await requireOrganization()
  const { status } = await searchParams

  const activeFilter: StatusFilter = STATUS_FILTERS.includes(status as StatusFilter)
    ? (status as StatusFilter)
    : 'open'

  const supabase = await createClient()
  const orgId = context.orgId

  const [directives, counts, settings, runs, failingSources] = await Promise.all([
    supabase
      .from('machine_directives')
      .select(
        'id, title, reasoning, directive_type, priority, urgency_score, confidence, status, subject_type, subject_label, evidence, recommended_actions, created_at, resulting_task_id, dismissal_reason'
      )
      .eq('organization_id', orgId)
      .eq('status', activeFilter)
      .order('urgency_score', { ascending: false })
      .limit(50),
    supabase
      .from('machine_directives')
      .select('status, priority')
      .eq('organization_id', orgId),
    supabase
      .from('machine_settings')
      .select('enabled, autonomy_level, min_relevance_to_alert, min_relevance_to_act')
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('machine_run_summary')
      .select(
        'id, trigger, status, started_at, finished_at, duration_ms, stats, error, organization_id, total_items_in, total_items_out, failed_steps'
      )
      .order('started_at', { ascending: false })
      .limit(8),
    supabase
      .from('intelligence_source_state')
      .select('source_id, consecutive_failures')
      .gt('consecutive_failures', 0)
      .limit(20),
  ])

  const allCounts = counts.data ?? []
  const countFor = (s: string) => allCounts.filter((d) => d.status === s).length
  const urgentOpen = allCounts.filter(
    (d) => d.status === 'open' && d.priority === 'urgent'
  ).length

  const runRows = runs.data ?? []
  const lastGlobalRun = runRows.find((r) => r.organization_id === null)
  const machineSettings = settings.data

  const analysisMode =
    lastGlobalRun && typeof lastGlobalRun.stats === 'object' && lastGlobalRun.stats
      ? ((lastGlobalRun.stats as Record<string, unknown>).analysisMode as
          | string
          | undefined)
      : undefined

  const isEnabled = machineSettings?.enabled ?? true
  const autonomy = machineSettings?.autonomy_level ?? 'advise'
  const failingCount = (failingSources.data ?? []).length

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="The Machine"
        description="The autonomous engine reads the regulatory landscape and your own state on every cycle, then ranks what needs attention. Every directive carries the reasoning that produced it."
        actions={context.isAdmin ? <RunNowButton /> : undefined}
      />

      {!isEnabled && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium">The engine is disabled for this organization</p>
            <p className="mt-1 text-muted-foreground">
              No new directives will be raised and no signals scored while it is off.
              Existing directives remain below.{' '}
              {context.isAdmin && (
                <Link
                  href="/dashboard/settings"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Enable it in Settings
                </Link>
              )}
            </p>
          </div>
        </div>
      )}

      <StatGrid>
        <Stat
          label="Open directives"
          value={countFor('open')}
          tone={urgentOpen > 0 ? 'bad' : countFor('open') > 0 ? 'warn' : 'good'}
          hint={urgentOpen > 0 ? `${urgentOpen} urgent` : 'Nothing urgent'}
        />
        <Stat
          label="Acknowledged"
          value={countFor('acknowledged')}
          hint="Seen, not yet actioned"
        />
        <Stat
          label="Actioned"
          value={countFor('actioned')}
          tone="good"
          hint="Turned into tracked work"
        />
        <Stat
          label="Autonomy"
          value={<span className="text-xl">{autonomy}</span>}
          hint={
            autonomy === 'observe'
              ? 'Recording only — no directives raised'
              : autonomy === 'act'
                ? `Creates tasks automatically above ${((machineSettings?.min_relevance_to_act ?? 0.75) * 100).toFixed(0)}% urgency`
                : 'Raises directives for a human to action'
          }
          href={context.isAdmin ? '/dashboard/settings' : undefined}
        />
      </StatGrid>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio
              className={
                lastGlobalRun?.status === 'running'
                  ? 'h-4 w-4 animate-pulse text-emerald-500'
                  : 'h-4 w-4 text-muted-foreground'
              }
            />
            <h2 className="text-sm font-medium">Engine status</h2>
          </div>
          {analysisMode && (
            <Pill
              tone={analysisMode === 'llm' ? 'good' : 'warn'}
              title={
                analysisMode === 'llm'
                  ? 'Documents are analysed with a language model and reconciled against the closed vocabulary.'
                  : 'No ANTHROPIC_API_KEY is configured, so analysis runs on pattern matching alone. Signals are still produced, with conservative severity and capped confidence.'
              }
            >
              {analysisMode === 'llm' ? 'model-assisted analysis' : 'heuristic analysis'}
            </Pill>
          )}
        </div>

        {runRows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            The engine has not run yet. Cycles are triggered by a scheduled call to{' '}
            <code className="rounded bg-foreground/5 px-1 py-0.5 text-xs">
              /api/machine/tick
            </code>
            , authenticated with{' '}
            <code className="rounded bg-foreground/5 px-1 py-0.5 text-xs">
              MACHINE_CRON_SECRET
            </code>
            .
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Started</th>
                  <th className="pb-2 font-medium">Trigger</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Duration</th>
                  <th className="pb-2 font-medium">Read</th>
                  <th className="pb-2 font-medium">Produced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {runRows.map((run) => (
                  <tr key={run.id}>
                    <td
                      className="py-2 pr-4 whitespace-nowrap"
                      title={formatDateTime(run.started_at)}
                    >
                      {formatRelativeDays(run.started_at)}
                    </td>
                    <td className="py-2 pr-4">
                      <Pill>{run.trigger}</Pill>
                    </td>
                    <td className="py-2 pr-4">
                      <StatusPill status={run.status} />
                      {(run.failed_steps ?? 0) > 0 && (
                        <span
                          className="ml-2 text-xs text-muted-foreground"
                          title={run.error ?? undefined}
                        >
                          {run.failed_steps} phase(s) failed
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {formatDuration(run.duration_ms)}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{run.total_items_in ?? 0}</td>
                    <td className="py-2 tabular-nums">{run.total_items_out ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {failingCount > 0 && (
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs font-medium">
              {failingCount} intelligence source(s) failing
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              These are being retried with exponential backoff. A regulator site being
              unreachable does not stop the cycle, but anything published there is not
              being seen.
            </p>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4" />
            Directives
          </h2>
          <nav className="flex flex-wrap gap-1" aria-label="Filter directives by status">
            {STATUS_FILTERS.map((filter) => (
              <Link
                key={filter}
                href={`/dashboard/machine?status=${filter}`}
                aria-current={filter === activeFilter ? 'true' : undefined}
                className={
                  filter === activeFilter
                    ? 'rounded-lg bg-foreground/5 px-2.5 py-1 text-xs font-medium'
                    : 'rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-foreground/5'
                }
              >
                {filter} ({countFor(filter)})
              </Link>
            ))}
          </nav>
        </div>

        {(directives.data ?? []).length === 0 ? (
          <EmptyState
            icon={BrainCircuit}
            title={
              activeFilter === 'open' ? 'No open directives' : `No ${activeFilter} directives`
            }
            description={
              activeFilter === 'open'
                ? 'The engine has not found anything needing attention in your current state. It re-checks your policies, obligations, controls, AI systems and third parties on every cycle, so this populates as things fall due.'
                : 'Nothing here yet.'
            }
          />
        ) : (
          <div className="space-y-3">
            {(directives.data ?? []).map((directive) => (
              <DirectiveCard
                key={directive.id}
                directive={directive as DirectiveView}
                canWrite={context.canWrite}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
