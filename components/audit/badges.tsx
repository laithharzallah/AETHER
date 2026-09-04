import {
  ACTION_STATUS_LABEL,
  ACTION_STATUS_PILL,
  ENGAGEMENT_STATUS_LABEL,
  ENGAGEMENT_STATUS_PILL,
  OBSERVATION_RATING_DEFINITION,
  OBSERVATION_RATING_LABEL,
  OBSERVATION_RATING_PILL,
  OBSERVATION_STATUS_LABEL,
  OBSERVATION_STATUS_PILL,
  OVERALL_RATING_DEFINITION,
  OVERALL_RATING_LABEL,
  OVERALL_RATING_PILL,
  PLAN_ITEM_STATUS_LABEL,
  PLAN_ITEM_STATUS_PILL,
  PLAN_STATUS_LABEL,
  PLAN_STATUS_PILL,
  PROCEDURE_STATUS_LABEL,
  PROCEDURE_STATUS_PILL,
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_PILL,
  RISK_BAND_LABEL,
  RISK_BAND_PILL,
  riskBand,
  type ActionStatus,
  type EngagementStatus,
  type ObservationRating,
  type ObservationStatus,
  type OverallRating,
  type PlanItemStatus,
  type PlanStatus,
  type ProcedureStatus,
  type ReviewStatus,
} from '@/lib/audit/constants'
import { cn } from '@/lib/utils'

function Pill({
  className,
  title,
  children,
}: {
  className: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <span className={className} title={title}>
      {children}
    </span>
  )
}

export function RiskScoreBadge({
  score,
  showScore = true,
}: {
  score: number | null | undefined
  showScore?: boolean
}) {
  const band = riskBand(score)
  const n = Number(score)
  return (
    <Pill className={RISK_BAND_PILL[band]}>
      {showScore && Number.isFinite(n) ? `${n.toFixed(0)} · ` : ''}
      {RISK_BAND_LABEL[band]}
    </Pill>
  )
}

export function EngagementStatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? 'planning') as EngagementStatus
  return (
    <Pill className={ENGAGEMENT_STATUS_PILL[s] ?? 'pill pill-neutral'}>
      {ENGAGEMENT_STATUS_LABEL[s] ?? status}
    </Pill>
  )
}

export function PlanStatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? 'draft') as PlanStatus
  return (
    <Pill className={PLAN_STATUS_PILL[s] ?? 'pill pill-neutral'}>
      {PLAN_STATUS_LABEL[s] ?? status}
    </Pill>
  )
}

export function PlanItemStatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? 'planned') as PlanItemStatus
  return (
    <Pill className={PLAN_ITEM_STATUS_PILL[s] ?? 'pill pill-neutral'}>
      {PLAN_ITEM_STATUS_LABEL[s] ?? status}
    </Pill>
  )
}

export function ProcedureStatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? 'not_started') as ProcedureStatus
  return (
    <Pill className={PROCEDURE_STATUS_PILL[s] ?? 'pill pill-neutral'}>
      {PROCEDURE_STATUS_LABEL[s] ?? status}
    </Pill>
  )
}

export function ReviewStatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? 'draft') as ReviewStatus
  return (
    <Pill className={REVIEW_STATUS_PILL[s] ?? 'pill pill-neutral'}>
      {REVIEW_STATUS_LABEL[s] ?? status}
    </Pill>
  )
}

export function ObservationRatingBadge({ rating }: { rating: string | null | undefined }) {
  const r = (rating ?? 'medium') as ObservationRating
  return (
    <Pill
      className={OBSERVATION_RATING_PILL[r] ?? 'pill pill-neutral'}
      title={OBSERVATION_RATING_DEFINITION[r]}
    >
      {OBSERVATION_RATING_LABEL[r] ?? rating}
    </Pill>
  )
}

export function ObservationStatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? 'draft') as ObservationStatus
  return (
    <Pill className={OBSERVATION_STATUS_PILL[s] ?? 'pill pill-neutral'}>
      {OBSERVATION_STATUS_LABEL[s] ?? status}
    </Pill>
  )
}

export function ActionStatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? 'open') as ActionStatus
  return (
    <Pill className={ACTION_STATUS_PILL[s] ?? 'pill pill-neutral'}>
      {ACTION_STATUS_LABEL[s] ?? status}
    </Pill>
  )
}

export function OverallRatingBadge({ rating }: { rating: string | null | undefined }) {
  if (!rating) return <span className="pill pill-neutral">Not concluded</span>
  const r = rating as OverallRating
  return (
    <Pill
      className={OVERALL_RATING_PILL[r] ?? 'pill pill-neutral'}
      title={OVERALL_RATING_DEFINITION[r]}
    >
      {OVERALL_RATING_LABEL[r] ?? rating}
    </Pill>
  )
}

export function Ref({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code className={cn('rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]', className)}>
      {children}
    </code>
  )
}

export function Meter({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className={cn('meter', className)}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'brass'
}) {
  const toneClass = {
    default: '',
    good: 'text-success',
    warn: 'text-warning-foreground',
    bad: 'text-danger',
    brass: 'text-brass',
  }[tone]
  return (
    <div className="surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-medium tabular-nums', toneClass)}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
