'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { updateObligationStatus, type GrcActionState } from '@/lib/actions/grc'
import { Button } from '@/components/ui/button'

export function ObligationActions({
  obligationId,
  status,
  isAdmin,
}: {
  obligationId: string
  status: string
  isAdmin: boolean
}) {
  const [state, action, pending] = useActionState<GrcActionState, FormData>(
    updateObligationStatus,
    {}
  )
  const [showWaive, setShowWaive] = useState(false)

  const settled = status === 'complete' || status === 'waived' || status === 'submitted'

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {!settled && (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {status === 'upcoming' && (
            <form action={action}>
              <input type="hidden" name="obligationId" value={obligationId} />
              <input type="hidden" name="status" value="in_progress" />
              <Button type="submit" size="sm" variant="ghost" disabled={pending}>
                Start
              </Button>
            </form>
          )}

          <form action={action}>
            <input type="hidden" name="obligationId" value={obligationId} />
            <input type="hidden" name="status" value="complete" />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Complete
            </Button>
          </form>

          {isAdmin && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowWaive((v) => !v)}
            >
              Waive
            </Button>
          )}
        </div>
      )}

      {showWaive && isAdmin && !settled && (
        <form action={action} className="w-full max-w-sm space-y-2">
          <input type="hidden" name="obligationId" value={obligationId} />
          <input type="hidden" name="status" value="waived" />
          <textarea
            name="note"
            rows={2}
            required
            minLength={10}
            placeholder="Why is this obligation not applicable? This is the first thing an assessor will ask about."
            className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Confirm waiver
          </Button>
        </form>
      )}

      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
          {state.success}
        </p>
      )}
    </div>
  )
}
