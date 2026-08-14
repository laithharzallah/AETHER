/**
 * Phase 3 — correlate.
 *
 * Scores every recent signal against every active tenant, and records the score
 * with its full breakdown in `signal_assessments`.
 *
 * The breakdown is the point. A compliance officer asked to act on a directive
 * will want to know why the platform thinks a Qatari circular concerns them, and
 * "the model said so" is not an answer that survives an audit committee. Storing
 * the component scores means the reasoning can be reconstructed months later,
 * even after the weights have changed.
 *
 * Assessments a human has already triaged are never overwritten.
 */

import {
  buildControlTopicCounts,
  scoreRelevance,
  type ScoredSignal,
  type SignalSeverity,
  type TenantProfile,
} from '../relevance'
import { normalizeTopics } from '../topics'
import { outOfBudget, type MachineContext, type PhaseOutcome } from '../types'

/** How far back to look for signals worth re-scoring. */
const SIGNAL_LOOKBACK_DAYS = 30

type SignalRow = {
  id: string
  category: string
  severity: string | null
  summary: string
  countries: string[] | null
  sectors: string[] | null
  frameworks_affected: string[] | null
  entity_types: string[]
  confidence: number
  deadline_date: string | null
  created_at: string | null
}

type OrgRow = {
  id: string
  name: string
  country: string | null
  industry: string | null
}

type SettingsRow = {
  organization_id: string
  enabled: boolean
  watch_countries: string[]
  watch_sectors: string[]
  watch_frameworks: string[]
}

export async function runCorrelatePhase(context: MachineContext): Promise<PhaseOutcome> {
  const { db, now } = context

  const since = new Date(now.getTime() - SIGNAL_LOOKBACK_DAYS * 86_400_000).toISOString()

  const { data: signals, error: signalsError } = await db
    .from('risk_signals')
    .select(
      'id, category, severity, summary, countries, sectors, frameworks_affected, entity_types, confidence, deadline_date, created_at'
    )
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  if (signalsError) {
    return {
      status: 'failed',
      itemsIn: 0,
      itemsOut: 0,
      detail: {},
      error: `could not load signals: ${signalsError.message}`,
    }
  }

  const signalRows = (signals ?? []) as SignalRow[]
  if (signalRows.length === 0) {
    return {
      status: 'skipped',
      itemsIn: 0,
      itemsOut: 0,
      detail: { reason: 'no signals in the lookback window' },
    }
  }

  // Tenant scope: a manual run targets one organisation, a cron run covers all.
  let orgQuery = db.from('organizations').select('id, name, country, industry')
  if (context.organizationId) {
    orgQuery = orgQuery.eq('id', context.organizationId)
  }
  const { data: orgs, error: orgsError } = await orgQuery.limit(
    context.limits.maxOrganizations
  )

  if (orgsError) {
    return {
      status: 'failed',
      itemsIn: signalRows.length,
      itemsOut: 0,
      detail: {},
      error: `could not load organizations: ${orgsError.message}`,
    }
  }

  const orgRows = (orgs ?? []) as OrgRow[]

  const { data: settings } = await db
    .from('machine_settings')
    .select('organization_id, enabled, watch_countries, watch_sectors, watch_frameworks')

  const settingsByOrg = new Map<string, SettingsRow>(
    (settings ?? []).map((s) => [s.organization_id, s as SettingsRow])
  )

  // Mandatory frameworks, so a change to one can be floored above the triage
  // threshold regardless of how mildly the source words it.
  const { data: frameworkRows } = await db
    .from('frameworks')
    .select('code, mandatory, name, regulator')
  const mandatoryCodes = new Set(
    (frameworkRows ?? []).filter((f) => f.mandatory).map((f) => f.code)
  )

  let assessed = 0
  let skippedExisting = 0
  let disabled = 0
  const bandCounts: Record<string, number> = {}
  const failures: Array<{ org: string; error: string }> = []
  let stoppedEarly = false

  for (const org of orgRows) {
    if (outOfBudget(context, 4000)) {
      stoppedEarly = true
      break
    }

    const orgSettings = settingsByOrg.get(org.id)
    if (orgSettings && !orgSettings.enabled) {
      disabled += 1
      continue
    }

    // The tenant's control library, joined to the catalogue for its topic tags.
    const { data: controls, error: controlsError } = await db
      .from('controls')
      .select('framework_code, framework_controls ( tags )')
      .eq('organization_id', org.id)
      .neq('applicability', 'not_applicable')

    if (controlsError) {
      failures.push({ org: org.name, error: controlsError.message })
      continue
    }

    const controlRows = controls ?? []
    const heldFrameworks = [...new Set(controlRows.map((c) => c.framework_code))]

    const controlTopicCounts = buildControlTopicCounts(
      controlRows.map((row) => {
        const related = row.framework_controls as { tags: string[] | null } | null
        return { tags: related?.tags ?? [] }
      })
    )

    const profile: TenantProfile = {
      country: org.country,
      industry: org.industry,
      frameworkCodes: heldFrameworks,
      mandatoryFrameworkCodes: heldFrameworks.filter((code) => mandatoryCodes.has(code)),
      controlTopicCounts,
      watchCountries: orgSettings?.watch_countries ?? [],
      watchSectors: orgSettings?.watch_sectors ?? [],
      watchFrameworks: orgSettings?.watch_frameworks ?? [],
    }

    // Existing assessments, so human triage is never clobbered by a re-score.
    const { data: existing } = await db
      .from('signal_assessments')
      .select('risk_signal_id, status')
      .eq('organization_id', org.id)
      .in(
        'risk_signal_id',
        signalRows.map((s) => s.id)
      )

    const triaged = new Set(
      (existing ?? [])
        .filter((row) => row.status !== 'new')
        .map((row) => row.risk_signal_id)
    )

    for (const signal of signalRows) {
      if (triaged.has(signal.id)) {
        skippedExisting += 1
        continue
      }

      const scored: ScoredSignal = {
        countries: signal.countries ?? [],
        sectors: signal.sectors ?? [],
        frameworkCodes: signal.frameworks_affected ?? [],
        topics: normalizeTopics(signal.entity_types ?? []),
        severity: (signal.severity ?? 'medium') as SignalSeverity,
        confidence: signal.confidence,
        deadlineDate: signal.deadline_date,
      }

      const result = scoreRelevance(scored, profile, now)
      bandCounts[result.band] = (bandCounts[result.band] ?? 0) + 1

      // Noise is scored but not stored. Persisting every global signal against
      // every tenant would grow without bound and bury the useful rows.
      if (result.band === 'noise') continue

      if (context.dryRun) {
        assessed += 1
        continue
      }

      const affectedControlCount = result.matchedTopics.reduce(
        (sum, topic) => sum + (controlTopicCounts[topic] ?? 0),
        0
      )

      const { error: upsertError } = await db.from('signal_assessments').upsert(
        {
          risk_signal_id: signal.id,
          organization_id: org.id,
          relevance_score: result.score,
          relevance_band: result.band,
          rationale: result.rationale,
          score_breakdown: {
            components: result.components,
            modifiers: result.modifiers,
            scoredAt: now.toISOString(),
            // Pinned so a stored score stays interpretable after the weights change.
            scorerVersion: 1,
          },
          matched_frameworks: result.matchedFrameworks,
          matched_sectors: result.matchedSectors,
          affected_control_count: affectedControlCount,
          status: 'new',
          created_by_run: context.runId,
        },
        { onConflict: 'risk_signal_id,organization_id' }
      )

      if (upsertError) {
        failures.push({ org: org.name, error: upsertError.message })
        continue
      }

      assessed += 1
    }
  }

  return {
    status: failures.length === 0 ? 'succeeded' : assessed > 0 ? 'partial' : 'failed',
    itemsIn: signalRows.length,
    itemsOut: assessed,
    detail: {
      signalsConsidered: signalRows.length,
      organizationsScored: orgRows.length - disabled,
      organizationsDisabled: disabled,
      assessmentsWritten: assessed,
      alreadyTriaged: skippedExisting,
      bandDistribution: bandCounts,
      failures: failures.slice(0, 20),
      stoppedEarly,
    },
  }
}
