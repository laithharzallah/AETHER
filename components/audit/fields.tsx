'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

const controlClass =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30'

export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return <select className={cn(controlClass, className)} {...props} />
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(controlClass, 'h-auto min-h-20 resize-y py-1.5 leading-relaxed', className)}
      {...props}
    />
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Checkbox({
  label,
  className,
  ...props
}: React.ComponentProps<'input'> & { label: string }) {
  return (
    <label
      className={cn('inline-flex cursor-pointer items-center gap-2 text-sm select-none', className)}
    >
      <input type="checkbox" className="h-4 w-4 accent-primary" {...props} />
      {label}
    </label>
  )
}

export function optionsFrom<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return values.map((v) => (
    <option key={v} value={v}>
      {labels[v]}
    </option>
  ))
}

export function memberOptions(members: { id: string; name: string }[]) {
  return members.map((m) => (
    <option key={m.id} value={m.id}>
      {m.name}
    </option>
  ))
}

/** 1–5 risk-factor selector used for inline universe scoring. */
export function ScoreSelect({
  value,
  onChange,
  disabled,
  label,
  className,
}: {
  value: number
  onChange: (n: number) => void
  disabled?: boolean
  label: string
  className?: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        'h-6 w-11 rounded border border-input bg-transparent px-1 text-center text-xs tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 dark:bg-input/30',
        className
      )}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  )
}
