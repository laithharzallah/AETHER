import { cn } from '@/lib/utils'

type LogoMarkProps = {
  className?: string
  /** Use on dark (ink) backgrounds. */
  inverted?: boolean
}

/**
 * AETHER mark — an aperture: two nested arcs closing on a brass point.
 * Reads as a lens (oversight), a horizon (Risk Horizon), and the letter A.
 */
export function LogoMark({ className, inverted = false }: LogoMarkProps) {
  const stroke = inverted ? 'oklch(0.95 0.006 90)' : 'oklch(0.23 0.045 262)'
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn('h-7 w-7 shrink-0', className)}
      fill="none"
    >
      <path
        d="M4 24 L16 4 L28 24"
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 24 A6.5 6.5 0 0 1 22.5 24"
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="16" cy="24.5" r="2.6" fill="oklch(0.74 0.11 78)" />
    </svg>
  )
}

export function Wordmark({
  className,
  inverted = false,
  withMark = true,
}: LogoMarkProps & { withMark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {withMark && <LogoMark inverted={inverted} />}
      <span
        className={cn(
          'text-[17px] font-semibold tracking-[0.08em]',
          inverted ? 'text-ink-foreground' : 'text-foreground'
        )}
      >
        AETHER
      </span>
    </span>
  )
}
