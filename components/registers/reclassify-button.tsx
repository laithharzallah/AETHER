'use client'

import { useActionState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { reclassifyAiSystem, type GrcActionState } from '@/lib/actions/grc'
import { Button } from '@/components/ui/button'

export function ReclassifyButton({
  systemId,
  icon,
}: {
  systemId: string
  icon?: ReactNode
}) {
  const [state, action, pending] = useActionState<GrcActionState, FormData>(
    reclassifyAiSystem,
    {}
  )

  return (
    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
      <form action={action}>
        <input type="hidden" name="systemId" value={systemId} />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <span className="mr-1.5 inline-flex h-3.5 w-3.5 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
              {icon}
            </span>
          )}
          Re-classify
        </Button>
      </form>

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
