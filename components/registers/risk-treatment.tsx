'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { updateRiskTreatment, type GrcActionState } from '@/lib/actions/grc'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const fieldClass =
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

const SCALE = [1, 2, 3, 4, 5]

export function RiskTreatment({
  riskId,
  status,
  residualLikelihood,
  residualImpact,
  treatmentStrategy,
}: {
  riskId: string
  status: string
  residualLikelihood: number | null
  residualImpact: number | null
  treatmentStrategy: string | null
}) {
  const [open, setOpen] = useState(false)
  const [accepting, setAccepting] = useState(status === 'accepted')
  const [state, action, pending] = useActionState<GrcActionState, FormData>(
    updateRiskTreatment,
    {}
  )

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Update treatment
        </Button>
        {state.success && (
          <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
            {state.success}
          </p>
        )}
      </div>
    )
  }

  return (
    <form action={action} className="w-full space-y-3 sm:max-w-md">
      <input type="hidden" name="riskId" value={riskId} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`status-${riskId}`} className="text-xs">
            Status
          </Label>
          <select
            id={`status-${riskId}`}
            name="status"
            defaultValue={status}
            onChange={(event) => setAccepting(event.target.value === 'accepted')}
            className={fieldClass}
          >
            <option value="open">Open</option>
            <option value="assessing">Assessing</option>
            <option value="mitigating">Mitigating</option>
            <option value="accepted">Accepted</option>
            <option value="transferred">Transferred</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`strategy-${riskId}`} className="text-xs">
            Strategy
          </Label>
          <select
            id={`strategy-${riskId}`}
            name="treatmentStrategy"
            defaultValue={treatmentStrategy ?? ''}
            className={fieldClass}
          >
            <option value="">Not set</option>
            <option value="mitigate">Mitigate</option>
            <option value="accept">Accept</option>
            <option value="transfer">Transfer</option>
            <option value="avoid">Avoid</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`rl-${riskId}`} className="text-xs">
            Residual likelihood
          </Label>
          <select
            id={`rl-${riskId}`}
            name="residualLikelihood"
            defaultValue={residualLikelihood?.toString() ?? ''}
            className={fieldClass}
          >
            <option value="">Not scored</option>
            {SCALE.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`ri-${riskId}`} className="text-xs">
            Residual impact
          </Label>
          <select
            id={`ri-${riskId}`}
            name="residualImpact"
            defaultValue={residualImpact?.toString() ?? ''}
            className={fieldClass}
          >
            <option value="">Not scored</option>
            {SCALE.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {accepting && (
        <div className="space-y-1">
          <Label htmlFor={`rationale-${riskId}`} className="text-xs">
            Acceptance rationale
          </Label>
          <textarea
            id={`rationale-${riskId}`}
            name="rationale"
            rows={2}
            required
            minLength={10}
            placeholder="Why is carrying this risk the right decision, and who agreed to it?"
            className="flex w-full rounded-lg border border-input bg-transparent px-2 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {state.error && (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        )}
      </div>
    </form>
  )
}
