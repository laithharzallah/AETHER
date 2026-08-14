'use client'

import { useActionState, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { triageSignal, type ActionState } from '@/lib/actions/machine'
import { Button } from '@/components/ui/button'

export function SignalTriage({
  assessmentId,
  status,
}: {
  assessmentId: string
  status: string
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(triageSignal, {})
  const [showDismiss, setShowDismiss] = useState(false)

  if (status !== 'new') {
    return state.error ? (
      <p role="alert" className="text-xs text-destructive">
        {state.error}
      </p>
    ) : null
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <input type="hidden" name="status" value="triaged" />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            Mark reviewed
          </Button>
        </form>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShowDismiss((v) => !v)}
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          Not applicable
        </Button>
      </div>

      {showDismiss && (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <input type="hidden" name="status" value="dismissed" />
          <textarea
            name="reason"
            rows={2}
            required
            minLength={5}
            placeholder="Why does this not apply to your organization? Recorded in the audit trail."
            className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Confirm
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
