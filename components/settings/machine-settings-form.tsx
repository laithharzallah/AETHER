'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { updateMachineSettings, type ActionState } from '@/lib/actions/machine'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type MachineSettingsValues = {
  enabled: boolean
  autonomyLevel: string
  digestCadence: string
  minRelevanceToAlert: number
  minRelevanceToAct: number
}

const AUTONOMY = [
  {
    value: 'observe',
    label: 'Observe',
    description:
      'Scores signals and records what it finds, but raises no directives. Useful while you calibrate the thresholds.',
  },
  {
    value: 'advise',
    label: 'Advise',
    description:
      'Raises directives for a person to action. Nothing is created on your behalf.',
  },
  {
    value: 'act',
    label: 'Act',
    description:
      'Also creates tasks automatically above the action threshold. Every one is attributed to the engine in the audit trail.',
  },
]

const fieldClass =
  'flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export function MachineSettingsForm({
  values,
  canEdit,
}: {
  values: MachineSettingsValues
  canEdit: boolean
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateMachineSettings,
    {}
  )
  const [autonomy, setAutonomy] = useState(values.autonomyLevel)

  return (
    <form action={action} className="space-y-5">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={values.enabled}
          disabled={!canEdit}
          className="mt-0.5 h-4 w-4 accent-foreground"
        />
        <span>
          <span className="block text-sm font-medium">Engine enabled</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            When off, no signals are scored and no directives are raised for this
            organization. Existing directives stay where they are.
          </span>
        </span>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Autonomy</legend>
        <div className="space-y-2">
          {AUTONOMY.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors',
                autonomy === option.value
                  ? 'border-foreground/30 bg-foreground/5'
                  : 'border-input hover:bg-foreground/[0.02]'
              )}
            >
              <input
                type="radio"
                name="autonomyLevel"
                value={option.value}
                defaultChecked={values.autonomyLevel === option.value}
                onChange={() => setAutonomy(option.value)}
                disabled={!canEdit}
                className="mt-0.5 h-3.5 w-3.5 accent-foreground"
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium">{option.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="alert-threshold">Alert threshold</Label>
          <input
            id="alert-threshold"
            name="minRelevanceToAlert"
            type="number"
            step="0.05"
            min="0"
            max="1"
            defaultValue={values.minRelevanceToAlert}
            disabled={!canEdit}
            className={fieldClass}
          />
          <p className="text-[11px] text-muted-foreground">
            Minimum relevance before a signal becomes a directive.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="act-threshold">Action threshold</Label>
          <input
            id="act-threshold"
            name="minRelevanceToAct"
            type="number"
            step="0.05"
            min="0"
            max="1"
            defaultValue={values.minRelevanceToAct}
            disabled={!canEdit || autonomy !== 'act'}
            className={fieldClass}
          />
          <p className="text-[11px] text-muted-foreground">
            {autonomy === 'act'
              ? 'Urgency above which a task is created without being asked.'
              : 'Only applies at the Act autonomy level.'}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="digest">Digest</Label>
          <select
            id="digest"
            name="digestCadence"
            defaultValue={values.digestCadence}
            disabled={!canEdit}
            className={fieldClass}
          >
            <option value="off">Off</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <p className="text-[11px] text-muted-foreground">
            How often a summary is assembled.
          </p>
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save configuration
          </Button>
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
      )}
    </form>
  )
}
