import { cn } from '@/lib/utils'

/**
 * Coverage as a bar plus the number.
 *
 * The number is always shown. A bar alone invites reading "mostly full" as
 * "mostly compliant", and the gap between 78% and 92% coverage of a mandatory
 * framework is the gap between a finding and a clean report.
 */
export function CoverageBar({
  percent,
  label,
  className,
}: {
  percent: number
  label?: string
  className?: string
}) {
  const clamped = Math.min(100, Math.max(0, percent))

  const tone =
    clamped >= 90
      ? 'bg-emerald-500'
      : clamped >= 70
        ? 'bg-amber-500'
        : clamped >= 40
          ? 'bg-orange-500'
          : 'bg-destructive'

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        {label && (
          <span className="truncate text-xs text-muted-foreground">{label}</span>
        )}
        <span className="text-xs font-medium tabular-nums">{clamped.toFixed(0)}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Coverage'}
      >
        <div
          className={cn('h-full rounded-full transition-all', tone)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
