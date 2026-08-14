'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { transitionPolicy, type PolicyActionState } from '@/lib/actions/policies'
import { Button } from '@/components/ui/button'

const LABELS: Record<string, string> = {
  in_review: 'Submit for review',
  approved: 'Approve',
  published: 'Publish',
  retired: 'Retire',
  draft: 'Return to draft',
}

const TRANSITIONS: Record<string, string[]> = {
  draft: ['in_review'],
  in_review: ['approved', 'draft'],
  approved: ['published', 'draft'],
  published: ['retired', 'draft'],
  retired: ['draft'],
}

export function PolicyLifecycle({
  policyId,
  status,
  isAdmin,
}: {
  policyId: string
  status: string
  isAdmin: boolean
}) {
  const [state, action, pending] = useActionState<PolicyActionState, FormData>(
    transitionPolicy,
    {}
  )

  const targets = TRANSITIONS[status] ?? []
  // Everything past submission needs an admin, so a member is told why the
  // buttons are absent rather than pressing one and being refused.
  const adminRequired = status !== 'draft'

  return (
    <div className="space-y-2">
      {targets.length > 0 && (!adminRequired || isAdmin) ? (
        <div className="flex flex-wrap gap-2">
          {targets.map((target, index) => (
            <form key={target} action={action}>
              <input type="hidden" name="policyId" value={policyId} />
              <input type="hidden" name="targetStatus" value={target} />
              <Button
                type="submit"
                size="sm"
                variant={index === 0 ? 'default' : 'outline'}
                disabled={pending}
              >
                {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {LABELS[target] ?? target}
              </Button>
            </form>
          ))}
        </div>
      ) : targets.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Only an owner or admin can approve, publish or retire a policy.
        </p>
      ) : null}

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
