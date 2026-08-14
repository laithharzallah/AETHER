import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export type StatTone = 'neutral' | 'good' | 'warn' | 'bad'

const TONE_CLASSES: Record<StatTone, string> = {
  neutral: 'text-foreground',
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-destructive',
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  href,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: StatTone
  href?: string
  className?: string
}) {
  const body = (
    <>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          'mt-2 text-3xl leading-none font-semibold tabular-nums',
          TONE_CLASSES[tone]
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </>
  )

  const shell = cn(
    'rounded-xl bg-card p-4 ring-1 ring-foreground/10',
    href && 'transition-colors hover:ring-foreground/25',
    className
  )

  if (href) {
    return (
      <Link href={href} className={cn(shell, 'block')}>
        {body}
      </Link>
    )
  }

  return <div className={shell}>{body}</div>
}

export function StatGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}
    >
      {children}
    </div>
  )
}
