/**
 * Cron entry point for the Machine.
 *
 * Authenticated by a shared secret rather than a session, because the caller is a
 * scheduler and not a person. If MACHINE_CRON_SECRET is unset the endpoint
 * refuses every request: defaulting to open would leave a route that can burn
 * model spend and write to every tenant exposed to the internet.
 */

import { timingSafeEqual } from 'node:crypto'
import { runMachineCycle } from '@/lib/machine/engine'
import { sha256Hex } from '@/lib/machine/hash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Compares hashes rather than raw bytes so the comparison is constant time
 * regardless of length — timingSafeEqual throws on a length mismatch, which would
 * itself leak the secret's length.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(sha256Hex(provided), 'hex')
  const b = Buffer.from(sha256Hex(expected), 'hex')
  return timingSafeEqual(a, b)
}

function extractSecret(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim()
  }
  return request.headers.get('x-machine-secret')?.trim() ?? null
}

async function handle(request: Request): Promise<Response> {
  const expected = process.env.MACHINE_CRON_SECRET?.trim()

  if (!expected) {
    return Response.json(
      {
        error:
          'MACHINE_CRON_SECRET is not configured. Set it in the environment before scheduling the Machine.',
      },
      { status: 503 }
    )
  }

  const provided = extractSecret(request)
  if (!provided || !secretMatches(provided, expected)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === 'true'

  // Finish inside the platform request timeout so the run is always closed out
  // properly rather than being left `running` for the stale sweeper to find.
  const budgetMs = Number(url.searchParams.get('budgetMs') ?? '240000')

  try {
    const result = await runMachineCycle({
      trigger: 'cron',
      dryRun,
      budgetMs: Number.isFinite(budgetMs) ? Math.min(budgetMs, 280_000) : 240_000,
    })

    return Response.json(
      {
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
      },
      // A partial run is a successful HTTP call reporting degraded work; only a
      // wholesale failure should make the scheduler retry.
      { status: result.status === 'failed' ? 500 : 200 }
    )
  } catch (error) {
    console.error('[machine/tick]', error)
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'The cycle failed to start.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return handle(request)
}

// GET is supported because several schedulers (including Render cron jobs
// invoking curl) default to it.
export async function GET(request: Request) {
  return handle(request)
}
