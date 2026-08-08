'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type RunResult = {
  status?: string
  stats?: Record<string, unknown>
  error?: string
}

/**
 * Triggers a tenant-scoped re-score and internal sweep.
 *
 * Deliberately excludes the ingest phase: fetching every regulator is slow,
 * shared across all tenants, and not something one tenant should trigger on
 * demand. The label says "re-run analysis" rather than "run now" because a
 * button that quietly does something narrower than it claims is worse than an
 * honest one.
 */
export function RunNowButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)

  async function run() {
    setRunning(true)
    setResult(null)
    try {
      const response = await fetch('/api/machine/run', { method: 'POST' })
      const data = (await response.json()) as RunResult
      if (!response.ok) {
        setResult({ error: data.error ?? 'The run failed.' })
        return
      }
      setResult(data)
      startTransition(() => router.refresh())
    } catch {
      setResult({ error: 'Network error while starting the run.' })
    } finally {
      setRunning(false)
    }
  }

  const busy = running || isPending

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" onClick={run} disabled={busy}>
        {busy ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-1.5 h-4 w-4" />
        )}
        Re-run analysis
      </Button>

      {result?.error && (
        <p role="alert" className="text-xs text-destructive">
          {result.error}
        </p>
      )}

      {result && !result.error && (
        <p role="status" className="text-xs text-muted-foreground">
          {result.status === 'succeeded' ? 'Complete' : `Finished (${result.status})`}
          {typeof result.stats?.directivesRaised === 'number' && (
            <> · {String(result.stats.directivesRaised)} directive(s)</>
          )}
        </p>
      )}
    </div>
  )
}
