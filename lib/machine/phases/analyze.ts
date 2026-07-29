/**
 * Phase 2 — analyse.
 *
 * Reads pending documents and turns each into a `risk_signals` row. Signals are
 * global: they describe what a document says, not what it means for any
 * particular tenant. Tenant-specific judgement is the correlate phase's job.
 *
 * A document that produces no signal is marked `skipped` rather than left
 * pending, so the queue drains and the same unparseable page is not retried
 * forever.
 */

import { analyzeWithModel, type AnalysisInput } from '../analyze'
import { TOPICS } from '../topics'
import { outOfBudget, type MachineContext, type PhaseOutcome } from '../types'

type PendingItem = {
  id: string
  title: string
  content: string | null
  summary: string | null
  url: string | null
  published_at: string | null
  source_id: string | null
}

type SourceMeta = {
  id: string
  name: string
  type: string
  regulator: string | null
  country: string | null
  authority_tier: number
  frameworks: string[]
  sectors: string[]
}

export async function runAnalyzePhase(context: MachineContext): Promise<PhaseOutcome> {
  const { db } = context

  const { data: pending, error: pendingError } = await db
    .from('intelligence_items')
    .select('id, title, content, summary, url, published_at, source_id')
    .eq('analysis_status', 'pending')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(context.limits.maxItemsToAnalyze)

  if (pendingError) {
    return {
      status: 'failed',
      itemsIn: 0,
      itemsOut: 0,
      detail: {},
      error: `could not load pending items: ${pendingError.message}`,
    }
  }

  const items = (pending ?? []) as PendingItem[]
  if (items.length === 0) {
    return {
      status: 'skipped',
      itemsIn: 0,
      itemsOut: 0,
      detail: { reason: 'no documents awaiting analysis' },
    }
  }

  const sourceIds = [...new Set(items.map((i) => i.source_id).filter((id): id is string => !!id))]

  const { data: sources } = await db
    .from('intelligence_sources')
    .select('id, name, type, regulator, country, authority_tier, frameworks, sectors')
    .in('id', sourceIds.length > 0 ? sourceIds : ['00000000-0000-0000-0000-000000000000'])

  const sourceById = new Map<string, SourceMeta>(
    (sources ?? []).map((s) => [s.id, s as SourceMeta])
  )

  const { data: frameworks } = await db.from('frameworks').select('code')
  const knownFrameworkCodes = (frameworks ?? []).map((f) => f.code)

  let created = 0
  let skipped = 0
  const failures: Array<{ item: string; error: string }> = []
  const byMethod: Record<string, number> = { heuristic: 0, llm: 0 }
  let stoppedEarly = false

  for (const item of items) {
    if (outOfBudget(context, 5000)) {
      stoppedEarly = true
      break
    }

    const source = item.source_id ? sourceById.get(item.source_id) : undefined

    const input: AnalysisInput = {
      title: item.title,
      content: item.content,
      summary: item.summary,
      url: item.url,
      publishedAt: item.published_at,
      source: {
        name: source?.name ?? 'Unknown source',
        regulator: source?.regulator ?? null,
        country: source?.country ?? null,
        authorityTier: source?.authority_tier ?? 3,
        frameworks: source?.frameworks ?? [],
        sectors: source?.sectors ?? [],
        type: source?.type ?? 'unknown',
      },
    }

    try {
      const analysis = await analyzeWithModel(input, knownFrameworkCodes, TOPICS)

      // Nothing identifiable and nothing to say: park it rather than emit a
      // contentless signal that will only dilute every tenant's feed.
      const uninformative =
        analysis.topics.length === 0 &&
        analysis.frameworkCodes.length === 0 &&
        analysis.confidence < 0.35

      if (uninformative) {
        if (!context.dryRun) {
          await db
            .from('intelligence_items')
            .update({ analysis_status: 'skipped', status: 'reviewed' })
            .eq('id', item.id)
        }
        skipped += 1
        continue
      }

      if (context.dryRun) {
        created += 1
        byMethod[analysis.method] = (byMethod[analysis.method] ?? 0) + 1
        continue
      }

      const { error: signalError } = await db.from('risk_signals').insert({
        intelligence_item_id: item.id,
        category: analysis.category,
        severity: analysis.severity,
        summary: analysis.summary,
        impact_analysis: analysis.impactAnalysis,
        recommended_action: analysis.recommendedAction,
        countries: analysis.countries,
        sectors: analysis.sectors,
        frameworks_affected: analysis.frameworkCodes,
        control_codes: analysis.controlCodes,
        entity_types: analysis.topics,
        effective_date: analysis.effectiveDate,
        deadline_date: analysis.deadlineDate,
        confidence: analysis.confidence,
        analysis_method: analysis.method,
        analysis_model: analysis.model,
        created_by_run: context.runId,
      })

      if (signalError) {
        failures.push({ item: item.title.slice(0, 80), error: signalError.message })
        await db
          .from('intelligence_items')
          .update({ analysis_status: 'failed' })
          .eq('id', item.id)
        continue
      }

      await db
        .from('intelligence_items')
        .update({ analysis_status: 'analyzed', status: 'analyzed' })
        .eq('id', item.id)

      created += 1
      byMethod[analysis.method] = (byMethod[analysis.method] ?? 0) + 1
    } catch (error) {
      failures.push({
        item: item.title.slice(0, 80),
        error: error instanceof Error ? error.message : 'unknown analysis error',
      })
      if (!context.dryRun) {
        await db
          .from('intelligence_items')
          .update({ analysis_status: 'failed' })
          .eq('id', item.id)
      }
    }
  }

  return {
    status: failures.length === 0 ? 'succeeded' : created > 0 ? 'partial' : 'failed',
    itemsIn: items.length,
    itemsOut: created,
    detail: {
      documentsRead: items.length,
      signalsCreated: created,
      documentsSkipped: skipped,
      byMethod,
      failures: failures.slice(0, 20),
      stoppedEarly,
    },
  }
}
