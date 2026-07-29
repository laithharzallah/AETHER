/**
 * The Machine — orchestration.
 *
 * One cycle: ingest, analyse, correlate, decide, dispatch. Each phase records a
 * `machine_run_steps` row with its counts and its failures, so a run is
 * reconstructable afterwards: what it read, what it concluded, what it created.
 *
 * Three properties this is built to hold:
 *
 *  - A phase failing does not fail the cycle. Regulator sites time out and models
 *    rate-limit; a run that gives up on the first error would rarely finish. Later
 *    phases still run on whatever earlier ones produced, and the run is marked
 *    `partial` so the degradation is visible rather than silent.
 *
 *  - Runs cannot overlap. A unique partial index allows one active global run, so
 *    a duplicate cron delivery is rejected by the database rather than
 *    double-ingesting.
 *
 *  - A run always terminates. Serverless platforms kill requests mid-flight,
 *    which would leave a row stuck in `running` and block every subsequent cycle,
 *    so there is a wall-clock budget and a sweeper for runs that died anyway.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/database.types'
import { hasAnthropicKey } from '@/lib/anthropic'
import { runIngestPhase } from './phases/ingest'
import { runAnalyzePhase } from './phases/analyze'
import { runCorrelatePhase } from './phases/correlate'
import { runDecidePhase } from './phases/decide'
import { runDispatchPhase } from './phases/dispatch'
import {
  DEFAULT_LIMITS,
  type MachineContext,
  type MachinePhase,
  type PhaseOutcome,
} from './types'

export type MachineRunOptions = {
  trigger?: 'cron' | 'manual' | 'webhook' | 'backfill'
  triggeredBy?: string | null
  organizationId?: string | null
  dryRun?: boolean
  /** Wall-clock budget in ms. Keep below the platform request timeout. */
  budgetMs?: number
  phases?: MachinePhase[]
  limits?: Partial<MachineContext['limits']>
}

export type MachineRunResult = {
  runId: string | null
  status: 'succeeded' | 'partial' | 'failed' | 'skipped'
  durationMs: number
  phases: Array<{ phase: MachinePhase } & PhaseOutcome>
  stats: Record<string, Json>
  error?: string
}

const ALL_PHASES: MachinePhase[] = ['ingest', 'analyze', 'correlate', 'decide', 'dispatch']

/** A run still `running` after this long is assumed dead and closed out. */
const STALE_RUN_MINUTES = 30

const PHASE_RUNNERS: Record<MachinePhase, (c: MachineContext) => Promise<PhaseOutcome>> = {
  ingest: runIngestPhase,
  analyze: runAnalyzePhase,
  correlate: runCorrelatePhase,
  decide: runDecidePhase,
  dispatch: runDispatchPhase,
}

export async function runMachineCycle(
  options: MachineRunOptions = {}
): Promise<MachineRunResult> {
  const startedAt = Date.now()
  const db = createAdminClient()

  const trigger = options.trigger ?? 'cron'
  const dryRun = options.dryRun ?? false
  const organizationId = options.organizationId ?? null
  const budgetMs = options.budgetMs ?? 240_000
  const phases = options.phases ?? ALL_PHASES

  await closeStaleRuns(db)

  const { data: run, error: runError } = await db
    .from('machine_runs')
    .insert({
      trigger,
      triggered_by: options.triggeredBy ?? null,
      organization_id: organizationId,
      status: 'running',
      phase: phases[0] ?? null,
      dry_run: dryRun,
    })
    .select('id')
    .single()

  if (runError || !run) {
    // 23505 means the single-active-run index rejected this: another cycle is in
    // flight. That is the intended outcome of a duplicate delivery, not an error.
    if (runError?.code === '23505') {
      return {
        runId: null,
        status: 'skipped',
        durationMs: Date.now() - startedAt,
        phases: [],
        stats: { reason: 'another cycle is already running' },
      }
    }
    return {
      runId: null,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      phases: [],
      stats: {},
      error: `could not start run: ${runError?.message ?? 'unknown error'}`,
    }
  }

  const context: MachineContext = {
    db,
    runId: run.id,
    now: new Date(),
    dryRun,
    organizationId,
    deadline: startedAt + budgetMs,
    limits: { ...DEFAULT_LIMITS, ...options.limits },
  }

  const outcomes: Array<{ phase: MachinePhase } & PhaseOutcome> = []

  for (const phase of phases) {
    const phaseStartedAt = Date.now()

    await db.from('machine_runs').update({ phase }).eq('id', run.id)

    const { data: step } = await db
      .from('machine_run_steps')
      .insert({ run_id: run.id, phase, status: 'running' })
      .select('id')
      .single()

    let outcome: PhaseOutcome

    if (Date.now() > context.deadline) {
      outcome = {
        status: 'skipped',
        itemsIn: 0,
        itemsOut: 0,
        detail: { reason: 'time budget exhausted before this phase started' },
      }
    } else {
      try {
        outcome = await PHASE_RUNNERS[phase](context)
      } catch (error) {
        outcome = {
          status: 'failed',
          itemsIn: 0,
          itemsOut: 0,
          detail: {},
          error: error instanceof Error ? error.message : 'unknown phase error',
        }
        console.error(`[machine/${phase}] threw`, error)
      }
    }

    const durationMs = Date.now() - phaseStartedAt

    if (step) {
      await db
        .from('machine_run_steps')
        .update({
          status: outcome.status,
          finished_at: new Date().toISOString(),
          duration_ms: durationMs,
          items_in: outcome.itemsIn,
          items_out: outcome.itemsOut,
          detail: outcome.detail,
          error: outcome.error ?? null,
        })
        .eq('id', step.id)
    }

    outcomes.push({ phase, ...outcome })
  }

  const failed = outcomes.filter((o) => o.status === 'failed')
  const partial = outcomes.filter((o) => o.status === 'partial')

  const status: MachineRunResult['status'] =
    failed.length === outcomes.length && outcomes.length > 0
      ? 'failed'
      : failed.length > 0 || partial.length > 0
        ? 'partial'
        : 'succeeded'

  const durationMs = Date.now() - startedAt

  // Deliberately aggregate-only: this row is visible to every tenant (see the
  // machine_runs RLS policy), so nothing tenant-identifying belongs here.
  const stats: Record<string, Json> = {
    documentsIngested: outcomes.find((o) => o.phase === 'ingest')?.itemsOut ?? 0,
    signalsCreated: outcomes.find((o) => o.phase === 'analyze')?.itemsOut ?? 0,
    assessmentsWritten: outcomes.find((o) => o.phase === 'correlate')?.itemsOut ?? 0,
    directivesRaised: outcomes.find((o) => o.phase === 'decide')?.itemsOut ?? 0,
    notificationsSent: outcomes.find((o) => o.phase === 'dispatch')?.itemsOut ?? 0,
    phasesFailed: failed.map((o) => o.phase),
    phasesPartial: partial.map((o) => o.phase),
    analysisMode: hasAnthropicKey() ? 'llm' : 'heuristic',
    dryRun,
  }

  await db
    .from('machine_runs')
    .update({
      status,
      phase: 'done',
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      stats: stats,
      error: failed.length > 0 ? failed.map((o) => `${o.phase}: ${o.error}`).join('; ') : null,
    })
    .eq('id', run.id)

  return { runId: run.id, status, durationMs, phases: outcomes, stats }
}

/**
 * Closes out runs that never reported back, so the single-active-run index does
 * not permanently block the pipeline after a platform-level kill.
 */
async function closeStaleRuns(db: ReturnType<typeof createAdminClient>): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_RUN_MINUTES * 60_000).toISOString()

  await db
    .from('machine_runs')
    .update({
      status: 'failed',
      phase: 'done',
      finished_at: new Date().toISOString(),
      error: `Run abandoned: no completion reported within ${STALE_RUN_MINUTES} minutes. The process was most likely terminated by the platform mid-cycle.`,
    })
    .eq('status', 'running')
    .lt('started_at', cutoff)
}
