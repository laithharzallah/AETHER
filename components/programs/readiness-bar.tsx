import { cn } from '@/lib/utils'

type ReadinessBarProps = {
  pct: number | null | undefined
  className?: string
  size?: 'sm' | 'md'
}

export function readinessColor(pct: number): string {
  if (pct >= 80) return 'bg-green-600 dark:bg-green-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

export function ReadinessBar({ pct, className, size = 'sm' }: ReadinessBarProps) {
  const value = Math.max(0, Math.min(100, pct ?? 0))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn(
        'w-full overflow-hidden rounded-full bg-foreground/10',
        size === 'sm' ? 'h-1.5' : 'h-2.5',
        className
      )}
    >
      <div
        className={cn('h-full rounded-full transition-all', readinessColor(value))}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
