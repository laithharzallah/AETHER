'use client'

import { useActionState, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { provisionFrameworks, type GrcActionState } from '@/lib/actions/grc'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/dashboard/pills'
import { cn } from '@/lib/utils'

export type FrameworkChoice = {
  code: string
  name: string
  shortName: string | null
  regulator: string
  jurisdiction: string
  category: string
  mandatory: boolean
  controlCount: number
  /** Already instantiated in this tenant's control library. */
  held: boolean
  /** Inferred as applicable from the organization's country and industry. */
  suggested: boolean
  suggestionReason: string | null
}

export function FrameworkPicker({
  frameworks,
  canEdit,
}: {
  frameworks: FrameworkChoice[]
  canEdit: boolean
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(frameworks.filter((f) => f.held || f.suggested).map((f) => f.code))
  )
  const [state, action, pending] = useActionState<GrcActionState, FormData>(
    provisionFrameworks,
    {}
  )

  function toggle(code: string, held: boolean) {
    // Removing a held framework would orphan its assessments and evidence, so the
    // picker only adds. Descoping is a deliberate act that belongs with the
    // control records themselves, not a checkbox here.
    if (held) return

    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const suggested = frameworks.filter((f) => f.suggested)
  const others = frameworks.filter((f) => !f.suggested)
  const newlySelected = [...selected].filter(
    (code) => !frameworks.find((f) => f.code === code)?.held
  )

  const totalControls = frameworks
    .filter((f) => selected.has(f.code))
    .reduce((sum, f) => sum + f.controlCount, 0)

  return (
    <form action={action} className="space-y-5">
      {selected.size > 0 &&
        [...selected].map((code) => (
          <input key={code} type="hidden" name="frameworkCodes" value={code} />
        ))}

      <div>
        <h3 className="text-xs font-medium">
          Applicable to you ({suggested.length})
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Inferred from your organization&rsquo;s country and industry. Selected by
          default.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {suggested.map((framework) => (
            <FrameworkOption
              key={framework.code}
              framework={framework}
              selected={selected.has(framework.code)}
              disabled={!canEdit}
              onToggle={() => toggle(framework.code, framework.held)}
            />
          ))}
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-xs font-medium hover:text-foreground">
          Other frameworks in the catalogue ({others.length})
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {others.map((framework) => (
            <FrameworkOption
              key={framework.code}
              framework={framework}
              selected={selected.has(framework.code)}
              disabled={!canEdit}
              onToggle={() => toggle(framework.code, framework.held)}
            />
          ))}
        </div>
      </details>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
          <Button type="submit" size="sm" disabled={pending || newlySelected.length === 0}>
            {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {newlySelected.length === 0
              ? 'No new frameworks selected'
              : `Instantiate ${newlySelected.length} framework(s)`}
          </Button>

          <p className="text-xs text-muted-foreground">
            {selected.size} selected · roughly {totalControls} controls
          </p>

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

function FrameworkOption({
  framework,
  selected,
  disabled,
  onToggle,
}: {
  framework: FrameworkChoice
  selected: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const locked = framework.held

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || locked}
      aria-pressed={selected}
      title={
        locked
          ? 'Already in your control library. Removing a framework here would orphan its assessments.'
          : framework.suggestionReason ?? framework.name
      }
      className={cn(
        'flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
        selected
          ? 'border-foreground/30 bg-foreground/5'
          : 'border-input hover:bg-foreground/[0.02]',
        (disabled || locked) && 'cursor-default opacity-90'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
          selected ? 'border-foreground bg-foreground text-background' : 'border-input'
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </span>

      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium">
            {framework.shortName ?? framework.code}
          </span>
          {framework.mandatory && <Pill tone="warn">mandatory</Pill>}
          {locked && <Pill tone="good">in library</Pill>}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
          {framework.name}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {framework.regulator} · {framework.controlCount} controls
        </span>
      </span>
    </button>
  )
}
