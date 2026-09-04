import {
  RISK_BAND_COLOR,
  RISK_BAND_LABEL,
  RISK_BANDS,
  type RiskBand,
} from '@/lib/erm/constants'
import type { CategoryDistribution } from '@/lib/erm/queries'
import { cn } from '@/lib/utils'

/**
 * Residual band distribution per level-1 category — a stacked bar per row,
 * shared 0→max scale so bar length compares across rows. Segments are separated
 * by a 2px surface gap; every segment carries a title, and the counts are
 * printed beside the bar so the reading never depends on the fill alone.
 */
export function CategoryDistributionChart({
  rows,
  className,
}: {
  rows: CategoryDistribution[]
  className?: string
}) {
  const populated = rows.filter((r) => r.total > 0)
  const max = Math.max(1, ...populated.map((r) => r.total))

  if (populated.length === 0) {
    return (
      <div className={cn('surface p-4', className)}>
        <p className="eyebrow">Portfolio</p>
        <h2 className="mt-1 text-base font-medium">Risks by category</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          No scored risks yet. Import the taxonomy and add risks to see the distribution.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('surface p-4', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h2 className="mt-1 text-base font-medium">Risks by category</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {RISK_BANDS.map((b: RiskBand) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-[2px] border border-border/60"
                style={{ background: RISK_BAND_COLOR[b].fill }}
              />
              {RISK_BAND_LABEL[b]}
            </span>
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {populated
          .slice()
          .sort((a, b) => b.total - a.total)
          .map((row) => (
            <li key={row.code}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate">
                  <code className="mr-1.5 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                    {row.code}
                  </code>
                  {row.name_en}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {row.total}
                </span>
              </div>
              <div
                className="mt-1 flex h-2.5 gap-[2px] overflow-hidden rounded-full"
                style={{ width: `${Math.max((row.total / max) * 100, 4)}%` }}
              >
                {RISK_BANDS.map((b) =>
                  row.byBand[b] > 0 ? (
                    <span
                      key={b}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      title={`${RISK_BAND_LABEL[b]}: ${row.byBand[b]} of ${row.total} in ${row.name_en}`}
                      style={{
                        width: `${(row.byBand[b] / row.total) * 100}%`,
                        background: RISK_BAND_COLOR[b].hex,
                      }}
                    />
                  ) : null
                )}
              </div>
            </li>
          ))}
      </ul>
    </div>
  )
}

/**
 * KRI reading trend. A 2px line with the latest point marked, plus dashed
 * amber and red threshold rules so the reading is judged against tolerance and
 * not against its own range.
 */
export function KriSparkline({
  readings,
  amber,
  red,
  width = 160,
  height = 40,
  className,
}: {
  readings: { period_date: string; value: number }[]
  amber: number | null
  red: number | null
  width?: number
  height?: number
  className?: string
}) {
  if (readings.length < 2) {
    return (
      <span className={cn('text-[11px] text-muted-foreground', className)}>
        {readings.length === 1 ? 'One reading' : 'No readings'}
      </span>
    )
  }

  const values = readings.map((r) => r.value)
  const candidates = [...values, ...(amber !== null ? [amber] : []), ...(red !== null ? [red] : [])]
  const min = Math.min(...candidates)
  const max = Math.max(...candidates)
  const span = max - min || 1
  const pad = 4

  const x = (i: number) => pad + (i / (readings.length - 1)) * (width - pad * 2)
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2)

  const path = readings.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(r.value)}`).join(' ')
  const last = readings[readings.length - 1]
  const first = readings[0]
  const rising = last.value > first.value

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      role="img"
      aria-label={`${readings.length} readings from ${first.period_date} to ${last.period_date}; latest ${last.value}, ${rising ? 'higher' : 'lower'} than the first reading${red !== null ? `; red threshold ${red}` : ''}`}
    >
      {amber !== null && (
        <line
          x1={0}
          x2={width}
          y1={y(amber)}
          y2={y(amber)}
          stroke={RISK_BAND_COLOR.moderate.hex}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.8}
        />
      )}
      {red !== null && (
        <line
          x1={0}
          x2={width}
          y1={y(red)}
          y2={y(red)}
          stroke={RISK_BAND_COLOR.extreme.hex}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.9}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-foreground/70"
      />
      <circle
        cx={x(readings.length - 1)}
        cy={y(last.value)}
        r={4}
        fill="currentColor"
        stroke="var(--card)"
        strokeWidth={2}
        className="text-foreground"
      >
        <title>{`${last.period_date}: ${last.value}`}</title>
      </circle>
    </svg>
  )
}

/** A single stat tile. The value is the hero; the hint carries the denominator. */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  const toneClass = {
    default: '',
    good: 'text-success',
    warn: 'text-warning-foreground',
    bad: 'text-danger',
  }[tone]
  return (
    <div className="surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-medium tabular-nums', toneClass)}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
