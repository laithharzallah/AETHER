import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import {
  APPETITE_LEVEL_LABEL,
  IMPACT_LABEL,
  KRI_STATUS_LABEL,
  KRI_STATUS_PILL,
  LIKELIHOOD_LABEL,
  RISK_BAND_COLOR,
  RISK_BAND_LABEL,
  RISK_STATUS_LABEL,
  RISK_STATUS_PILL,
  TREATMENT_STATUS_LABEL,
  TREATMENT_STATUS_PILL,
  TREATMENT_STRATEGY_LABEL,
  VELOCITY_LABEL,
  bandForScore,
  type AppetiteLevel,
  type KriStatus,
  type RiskBand,
  type RiskStatus,
  type TreatmentStatus,
  type TreatmentStrategy,
} from '@/lib/erm/constants'
import { cn } from '@/lib/utils'

export function BandPill({ band }: { band: RiskBand | null }) {
  if (!band) return <span className="pill pill-neutral">Not assessed</span>
  return <span className={RISK_BAND_COLOR[band].pill}>{RISK_BAND_LABEL[band]}</span>
}

/**
 * Score chip: L×I with the product, washed in the band colour. The number is
 * always visible so the band never depends on colour alone.
 */
export function ScoreChip({
  likelihood,
  impact,
  label,
  className,
}: {
  likelihood: number | null
  impact: number | null
  label?: string
  className?: string
}) {
  if (!likelihood || !impact) {
    return (
      <span className={cn('inline-flex items-baseline gap-1 text-xs text-muted-foreground', className)}>
        {label && <span className="text-[10px] uppercase tracking-wide">{label}</span>}—
      </span>
    )
  }
  const score = likelihood * impact
  const band = bandForScore(score) as RiskBand
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 rounded-md border border-border/60 px-1.5 py-0.5 text-xs tabular-nums',
        className
      )}
      style={{ background: RISK_BAND_COLOR[band].fill }}
      title={`${label ? `${label}: ` : ''}${LIKELIHOOD_LABEL[likelihood]} likelihood × ${IMPACT_LABEL[impact]} impact = ${score} (${RISK_BAND_LABEL[band]})`}
    >
      {label && <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>}
      <span className="text-muted-foreground">
        {likelihood}×{impact}
      </span>
      <span className="font-medium">{score}</span>
    </span>
  )
}

export function RiskStatusPill({ status }: { status: string | null }) {
  const s = (status ?? 'identified') as RiskStatus
  const cls = RISK_STATUS_PILL[s] ?? 'pill pill-neutral'
  return <span className={cls}>{RISK_STATUS_LABEL[s] ?? status}</span>
}

export function TreatmentStatusPill({ status }: { status: string | null }) {
  const s = (status ?? 'planned') as TreatmentStatus
  return (
    <span className={TREATMENT_STATUS_PILL[s] ?? 'pill pill-neutral'}>
      {TREATMENT_STATUS_LABEL[s] ?? status}
    </span>
  )
}

export function StrategyPill({ strategy }: { strategy: string | null }) {
  const s = (strategy ?? 'mitigate') as TreatmentStrategy
  return <span className="pill pill-info">{TREATMENT_STRATEGY_LABEL[s] ?? strategy}</span>
}

export function KriPill({ status }: { status: string | null }) {
  const s = (status ?? 'none') as KriStatus
  return (
    <span className={KRI_STATUS_PILL[s] ?? 'pill pill-neutral'}>
      {KRI_STATUS_LABEL[s] ?? status}
    </span>
  )
}

export function AppetitePill({ level }: { level: string | null }) {
  const l = (level ?? 'cautious') as AppetiteLevel
  const tone =
    l === 'averse' || l === 'minimal'
      ? 'pill pill-info'
      : l === 'hungry'
        ? 'pill pill-brass'
        : 'pill pill-neutral'
  return <span className={tone}>{APPETITE_LEVEL_LABEL[l] ?? level}</span>
}

export function VelocityLabel({ velocity }: { velocity: number | null }) {
  if (!velocity) return <span className="text-muted-foreground">Not rated</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs tabular-nums text-muted-foreground">V{velocity}</span>
      {VELOCITY_LABEL[velocity]}
    </span>
  )
}

/**
 * Movement since the previous assessment snapshot. Up in residual score is
 * adverse, so it wears the danger token; the arrow and the signed number both
 * carry the direction, never the colour alone.
 */
export function MovementArrow({
  delta,
  direction,
  previous,
}: {
  delta: number | null
  direction: 'up' | 'down' | 'flat' | 'new'
  previous?: number | null
}) {
  if (direction === 'new' || delta === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="No prior assessment to compare against">
        <ArrowRight className="h-3.5 w-3.5" />
        New
      </span>
    )
  }
  if (direction === 'flat') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Unchanged since the previous assessment">
        <Minus className="h-3.5 w-3.5" />
        0
      </span>
    )
  }
  const up = direction === 'up'
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs tabular-nums',
        up ? 'text-danger' : 'text-success'
      )}
      title={`Residual score ${up ? 'increased' : 'decreased'} by ${Math.abs(delta)}${
        previous !== null && previous !== undefined ? ` from ${previous}` : ''
      } since the previous assessment`}
    >
      <Icon className="h-3.5 w-3.5" />
      {up ? '+' : ''}
      {delta}
    </span>
  )
}

export function TrendPill({ trend }: { trend: string | null }) {
  if (trend === 'increasing') return <span className="pill pill-warning">Increasing</span>
  if (trend === 'decreasing') return <span className="pill pill-success">Decreasing</span>
  return <span className="pill pill-neutral">Stable</span>
}

/** Labelled legend for the four risk bands — required wherever band fills appear. */
export function BandLegend({ className }: { className?: string }) {
  const bands: RiskBand[] = ['low', 'moderate', 'high', 'extreme']
  return (
    <div className={cn('flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground', className)}>
      {bands.map((b) => (
        <span key={b} className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-[3px] border border-border/60"
            style={{ background: RISK_BAND_COLOR[b].fill }}
          />
          {RISK_BAND_LABEL[b]}
        </span>
      ))}
    </div>
  )
}
