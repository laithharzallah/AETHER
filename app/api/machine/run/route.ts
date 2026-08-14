/**
 * Manual, tenant-scoped Machine run — the "Run now" button in the console.
 *
 * Session-authenticated and restricted to admins, and scoped to the caller's own
 * organisation so a manual run can never touch another tenant. The ingest phase
 * is deliberately excluded: fetching every regulator on demand is slow, shared
 * across all tenants, and not something one tenant should be able to trigger at
 * will. This re-scores existing signals and re-runs the internal sweep, which is
 * what a user pressing the button actually wants.
 */

import { runMachineCycle } from '@/lib/machine/engine'
import { getDashboardContext } from '@/lib/dashboard/get-dashboard-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST() {
  let context
  try {
    context = await getDashboardContext()
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!context.orgId) {
    return Response.json(
      { error: 'Your account is not linked to an organization.' },
      { status: 400 }
    )
  }

  if (!['owner', 'admin'].includes(context.role)) {
    return Response.json(
      { error: 'Only an owner or admin can trigger a run.' },
      { status: 403 }
    )
  }

  try {
    const result = await runMachineCycle({
      trigger: 'manual',
      triggeredBy: context.userId,
      organizationId: context.orgId,
      phases: ['correlate', 'decide', 'dispatch'],
      budgetMs: 90_000,
    })

    return Response.json({
      runId: result.runId,
      status: result.status,
      durationMs: result.durationMs,
      stats: result.stats,
      phases: result.phases.map((phase) => ({
        phase: phase.phase,
        status: phase.status,
        itemsIn: phase.itemsIn,
        itemsOut: phase.itemsOut,
        error: phase.error,
      })),
    })
  } catch (error) {
    console.error('[machine/run]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'The run failed to start.' },
      { status: 500 }
    )
  }
}
