import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'

export type MachineDb = SupabaseClient<Database>

export type MachinePhase = 'ingest' | 'analyze' | 'correlate' | 'decide' | 'dispatch'

export type PhaseOutcome = {
  status: 'succeeded' | 'partial' | 'failed' | 'skipped'
  itemsIn: number
  itemsOut: number
  detail: Record<string, Json>
  error?: string
}

export type MachineContext = {
  db: MachineDb
  runId: string
  now: Date
  /** Dry runs read and score but never write tenant-visible records. */
  dryRun: boolean
  /** Set when a run is scoped to a single tenant, e.g. a manual "run now". */
  organizationId: string | null
  /**
   * Wall-clock budget. Serverless platforms kill a request mid-flight, which
   * would leave a run row stuck in `running` forever; each phase checks the
   * budget and stops cleanly instead.
   */
  deadline: number
  /** Cap on sources fetched and items analysed in one cycle. */
  limits: {
    maxSources: number
    maxItemsPerSource: number
    maxItemsToAnalyze: number
    maxOrganizations: number
  }
}

export function budgetRemaining(context: MachineContext): number {
  return context.deadline - Date.now()
}

export function outOfBudget(context: MachineContext, reserveMs = 2000): boolean {
  return budgetRemaining(context) < reserveMs
}

export const DEFAULT_LIMITS: MachineContext['limits'] = {
  maxSources: 12,
  maxItemsPerSource: 25,
  maxItemsToAnalyze: 30,
  maxOrganizations: 200,
}
