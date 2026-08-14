'use client'

import { useActionState, useState, type ReactNode } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Collapsible "add a record" form shared by the risk, AI and third-party
 * registers.
 *
 * Collapsed by default so the register itself is what the page opens on. The
 * three registers differ only in their fields, so sharing the shell keeps their
 * validation feedback and pending states behaving identically — a form that
 * reports errors differently per screen makes users distrust all of them.
 */
export function AddRecordForm<S extends { error?: string; success?: string }>({
  action,
  initialState,
  label,
  title,
  description,
  children,
  submitLabel,
}: {
  action: (state: Awaited<S>, formData: FormData) => Promise<S>
  initialState: Awaited<S>
  label: string
  title: string
  description?: string
  children: ReactNode
  submitLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(action, initialState)

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />
        {label}
      </Button>
    )
  }

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        {children}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {submitLabel}
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
      </form>
    </section>
  )
}

export const fieldClass =
  'flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export const textareaClass =
  'flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string
  label: string
  hint?: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-input p-2.5 transition-colors hover:bg-foreground/[0.02]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-foreground"
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </label>
  )
}
