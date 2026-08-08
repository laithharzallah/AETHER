import { cn } from '@/lib/utils'

/**
 * Status pills shared across the modules.
 *
 * Colour is assigned from one place per vocabulary so severity means the same
 * thing on the Risk Horizon feed as it does on a directive or an obligation.
 * Divergent scales across screens are how a reader learns to stop trusting them.
 */

const TONE = {
  neutral: 'bg-foreground/5 text-muted-foreground ring-foreground/10',
  info: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
  good: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
  warn: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
  bad: 'bg-orange-500/10 text-orange-700 ring-orange-500/20 dark:text-orange-300',
  critical: 'bg-destructive/10 text-destructive ring-destructive/20',
} as const

export type PillTone = keyof typeof TONE

export function Pill({
  children,
  tone = 'neutral',
  className,
  title,
}: {
  children: React.ReactNode
  tone?: PillTone
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

const SEVERITY_TONE: Record<string, PillTone> = {
  info: 'info',
  low: 'neutral',
  medium: 'warn',
  high: 'bad',
  critical: 'critical',
}

export function SeverityPill({ severity }: { severity: string | null }) {
  if (!severity) return <Pill>unknown</Pill>
  return <Pill tone={SEVERITY_TONE[severity] ?? 'neutral'}>{severity}</Pill>
}

const BAND_TONE: Record<string, PillTone> = {
  noise: 'neutral',
  watch: 'info',
  relevant: 'warn',
  urgent: 'bad',
  critical: 'critical',
}

export function RelevancePill({
  band,
  score,
}: {
  band: string
  score?: number | null
}) {
  return (
    <Pill
      tone={BAND_TONE[band] ?? 'neutral'}
      title={score != null ? `Relevance score ${(score * 100).toFixed(0)}%` : undefined}
    >
      {band}
      {score != null && (
        <span className="tabular-nums opacity-70">{(score * 100).toFixed(0)}%</span>
      )}
    </Pill>
  )
}

const PRIORITY_TONE: Record<string, PillTone> = {
  low: 'neutral',
  medium: 'warn',
  high: 'bad',
  urgent: 'critical',
}

export function PriorityPill({ priority }: { priority: string }) {
  return <Pill tone={PRIORITY_TONE[priority] ?? 'neutral'}>{priority}</Pill>
}

const STATUS_TONE: Record<string, PillTone> = {
  // Policy lifecycle
  draft: 'neutral',
  in_review: 'info',
  approved: 'good',
  published: 'good',
  retired: 'neutral',
  // Work
  open: 'warn',
  in_progress: 'info',
  blocked: 'critical',
  complete: 'good',
  cancelled: 'neutral',
  // Obligations
  upcoming: 'info',
  submitted: 'good',
  overdue: 'critical',
  waived: 'neutral',
  // Control implementation
  implemented: 'good',
  partially_implemented: 'warn',
  planned: 'info',
  not_implemented: 'bad',
  not_assessed: 'neutral',
  not_applicable: 'neutral',
  // Effectiveness
  effective: 'good',
  needs_improvement: 'warn',
  ineffective: 'critical',
  untested: 'neutral',
  // Machine
  succeeded: 'good',
  partial: 'warn',
  failed: 'critical',
  running: 'info',
  skipped: 'neutral',
  acknowledged: 'info',
  actioned: 'good',
  dismissed: 'neutral',
  new: 'warn',
  triaged: 'info',
  // Risk
  assessing: 'info',
  mitigating: 'info',
  accepted: 'warn',
  transferred: 'warn',
  closed: 'good',
  // Vendors
  approved_with_conditions: 'warn',
  rejected: 'critical',
  expired: 'critical',
  under_review: 'info',
  questionnaire_sent: 'info',
  not_started: 'bad',
}

export function StatusPill({ status }: { status: string | null }) {
  if (!status) return <Pill>unknown</Pill>
  return (
    <Pill tone={STATUS_TONE[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Pill>
  )
}

const AI_TIER_TONE: Record<string, PillTone> = {
  prohibited: 'critical',
  unacceptable: 'critical',
  high: 'bad',
  gpai_systemic: 'bad',
  gpai: 'warn',
  limited: 'warn',
  minimal: 'good',
  low: 'good',
}

export function AiTierPill({
  tier,
  label,
}: {
  tier: string | null
  label?: string
}) {
  if (!tier) return <Pill tone="warn">unclassified</Pill>
  return (
    <Pill tone={AI_TIER_TONE[tier] ?? 'neutral'}>
      {label ? `${label}: ` : ''}
      {tier.replace(/_/g, ' ')}
    </Pill>
  )
}
