/**
 * Enterprise Risk Management vocabulary.
 *
 * ISO 31000:2018 — risk is the effect of uncertainty on objectives; a risk is
 * expressed as risk source → event → consequence; treatment selects from a
 * defined set of options (§6.5.2). COSO ERM 2017 — inherent, residual and
 * target risk, appetite and tolerance, risk velocity, the portfolio view.
 *
 * Shared between server queries, server actions, API routes and client
 * components — this file must stay free of server-only imports.
 */

// ---------------------------------------------------------------------------
// Likelihood — 5-point scale
// ---------------------------------------------------------------------------

export type Score = 1 | 2 | 3 | 4 | 5
export const SCORES: readonly Score[] = [1, 2, 3, 4, 5] as const

export type ScaleLevel = {
  value: Score
  label: string
  short: string
  descriptor: string
}

/** Likelihood anchored to a 12-month assessment horizon. */
export const LIKELIHOOD_SCALE: readonly ScaleLevel[] = [
  {
    value: 1,
    label: 'Rare',
    short: 'L1',
    descriptor: 'Below 5% in the next 12 months. No occurrence in the sector in recent memory.',
  },
  {
    value: 2,
    label: 'Unlikely',
    short: 'L2',
    descriptor: '5–25%. Has occurred elsewhere in the sector but not in this organisation.',
  },
  {
    value: 3,
    label: 'Possible',
    short: 'L3',
    descriptor: '25–50%. Has occurred in this organisation within the last three to five years.',
  },
  {
    value: 4,
    label: 'Likely',
    short: 'L4',
    descriptor: '50–80%. Occurs most years, or conditions that caused it previously are present.',
  },
  {
    value: 5,
    label: 'Almost certain',
    short: 'L5',
    descriptor: 'Above 80%, or occurring already. Expected within the assessment horizon.',
  },
] as const

/**
 * Impact anchored to the worst credible single consequence across dimensions.
 * Financial bands are indicative SAR and are re-based per entity during
 * calibration; they exist so workshops score on a common yardstick.
 */
export const IMPACT_SCALE: readonly ScaleLevel[] = [
  {
    value: 1,
    label: 'Insignificant',
    short: 'I1',
    descriptor:
      'Below SAR 1m. Absorbed within business-as-usual; no regulatory interest, no external visibility.',
  },
  {
    value: 2,
    label: 'Minor',
    short: 'I2',
    descriptor:
      'SAR 1–10m. Localised disruption resolved within days; internal management attention only.',
  },
  {
    value: 3,
    label: 'Moderate',
    short: 'I3',
    descriptor:
      'SAR 10–50m. Material service disruption, a reportable regulatory matter, or local media coverage.',
  },
  {
    value: 4,
    label: 'Major',
    short: 'I4',
    descriptor:
      'SAR 50–250m. Regulatory enforcement or supervisory action, serious injury, or sustained national coverage.',
  },
  {
    value: 5,
    label: 'Catastrophic',
    short: 'I5',
    descriptor:
      'Above SAR 250m. Threatens solvency, licence to operate, or life; board and regulator escalation is immediate.',
  },
] as const

export const LIKELIHOOD_LABEL: Record<number, string> = Object.fromEntries(
  LIKELIHOOD_SCALE.map((l) => [l.value, l.label])
)
export const IMPACT_LABEL: Record<number, string> = Object.fromEntries(
  IMPACT_SCALE.map((l) => [l.value, l.label])
)

/** Impact dimensions carried on erm_risks.impact_dimensions (each 1–5). */
export const IMPACT_DIMENSIONS = [
  'financial',
  'operational',
  'regulatory',
  'reputational',
  'safety',
] as const
export type ImpactDimension = (typeof IMPACT_DIMENSIONS)[number]
export const IMPACT_DIMENSION_LABEL: Record<ImpactDimension, string> = {
  financial: 'Financial',
  operational: 'Operational',
  regulatory: 'Regulatory',
  reputational: 'Reputational',
  safety: 'Safety & people',
}

// ---------------------------------------------------------------------------
// Risk velocity — how quickly the consequence lands once the event occurs
// ---------------------------------------------------------------------------

export const VELOCITY_SCALE: readonly ScaleLevel[] = [
  { value: 1, label: 'Very slow', short: 'V1', descriptor: 'Consequence develops over more than a year — ample time to intervene.' },
  { value: 2, label: 'Slow', short: 'V2', descriptor: 'Consequence develops over six to twelve months.' },
  { value: 3, label: 'Moderate', short: 'V3', descriptor: 'Consequence develops over one to six months.' },
  { value: 4, label: 'Fast', short: 'V4', descriptor: 'Consequence lands within days to weeks — limited time to respond.' },
  { value: 5, label: 'Very fast', short: 'V5', descriptor: 'Consequence is immediate; crisis response is the only available lever.' },
] as const

export const VELOCITY_LABEL: Record<number, string> = Object.fromEntries(
  VELOCITY_SCALE.map((v) => [v.value, v.label])
)

// ---------------------------------------------------------------------------
// Risk bands (residual / inherent score → band)
// ---------------------------------------------------------------------------

export const RISK_BANDS = ['low', 'moderate', 'high', 'extreme'] as const
export type RiskBand = (typeof RISK_BANDS)[number]

export const RISK_BAND_LABEL: Record<RiskBand, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  extreme: 'Extreme',
}

export const RISK_BAND_RANGE: Record<RiskBand, { min: number; max: number }> = {
  low: { min: 1, max: 4 },
  moderate: { min: 5, max: 9 },
  high: { min: 10, max: 15 },
  extreme: { min: 16, max: 25 },
}

export const RISK_BAND_ACTION: Record<RiskBand, string> = {
  low: 'Retain and monitor through business-as-usual reporting.',
  moderate: 'Manage by specific monitoring; treatment where cost-effective.',
  high: 'Executive attention required; documented treatment plan with an owner and date.',
  extreme: 'Immediate escalation to the executive committee and the board risk committee.',
}

export function bandForScore(score: number | null | undefined): RiskBand | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null
  if (score <= 0) return null
  if (score <= 4) return 'low'
  if (score <= 9) return 'moderate'
  if (score <= 15) return 'high'
  return 'extreme'
}

/**
 * Heat-map / band colours.
 *
 * These are the reserved four-state status colours, not a categorical series
 * palette: they escalate low → extreme and are never reused for a data series.
 * Cells always carry the numeric count and the legend is labelled, so hue never
 * carries the meaning alone (the CVD mitigation for a green/amber/red ramp).
 * `fill` is a wash mixed with the card surface so the ink token stays readable
 * in both light and dark themes.
 */
export const RISK_BAND_COLOR: Record<
  RiskBand,
  { hex: string; fill: string; strongFill: string; pill: string }
> = {
  low: {
    hex: '#0ca30c',
    fill: 'color-mix(in oklab, #0ca30c 16%, var(--card))',
    strongFill: 'color-mix(in oklab, #0ca30c 30%, var(--card))',
    pill: 'pill pill-success',
  },
  moderate: {
    hex: '#fab219',
    fill: 'color-mix(in oklab, #fab219 26%, var(--card))',
    strongFill: 'color-mix(in oklab, #fab219 44%, var(--card))',
    pill: 'pill pill-warning',
  },
  high: {
    hex: '#ec835a',
    fill: 'color-mix(in oklab, #ec835a 40%, var(--card))',
    strongFill: 'color-mix(in oklab, #ec835a 60%, var(--card))',
    pill: 'pill pill-warning',
  },
  extreme: {
    hex: '#d03b3b',
    fill: 'color-mix(in oklab, #d03b3b 52%, var(--card))',
    strongFill: 'color-mix(in oklab, #d03b3b 72%, var(--card))',
    pill: 'pill pill-danger',
  },
}

// ---------------------------------------------------------------------------
// Treatment strategy
//
// erm_treatments.strategy is constrained to four values. ISO 31000 §6.5.2
// lists seven treatment options; each maps onto one of the four stored
// strategies, and the option text is what a reviewer expects to read.
// ---------------------------------------------------------------------------

export const TREATMENT_STRATEGIES = ['mitigate', 'transfer', 'avoid', 'accept'] as const
export type TreatmentStrategy = (typeof TREATMENT_STRATEGIES)[number]

export const TREATMENT_STRATEGY_LABEL: Record<TreatmentStrategy, string> = {
  mitigate: 'Mitigate',
  transfer: 'Share / transfer',
  avoid: 'Avoid',
  accept: 'Retain',
}

export const TREATMENT_STRATEGY_HINT: Record<TreatmentStrategy, string> = {
  mitigate:
    'Change the likelihood or change the consequence — strengthen or add controls (ISO 31000 §6.5.2 d, e).',
  transfer:
    'Share the risk with another party by contract, insurance or risk financing (§6.5.2 f).',
  avoid:
    'Avoid the risk by deciding not to start or continue the activity, or remove the risk source (§6.5.2 a, c).',
  accept:
    'Retain the risk by informed decision — or take/increase it to pursue an opportunity (§6.5.2 b, g).',
}

/** The seven ISO 31000 §6.5.2 options, shown when selecting a strategy. */
export const ISO_TREATMENT_OPTIONS: readonly {
  option: string
  strategy: TreatmentStrategy
}[] = [
  { option: 'Avoid the risk by deciding not to start or continue the activity that gives rise to it', strategy: 'avoid' },
  { option: 'Take or increase the risk in order to pursue an opportunity', strategy: 'accept' },
  { option: 'Remove the risk source', strategy: 'avoid' },
  { option: 'Change the likelihood', strategy: 'mitigate' },
  { option: 'Change the consequences', strategy: 'mitigate' },
  { option: 'Share the risk with another party or parties', strategy: 'transfer' },
  { option: 'Retain the risk by informed decision', strategy: 'accept' },
] as const

export const TREATMENT_STATUSES = [
  'planned',
  'in_progress',
  'complete',
  'overdue',
  'cancelled',
] as const
export type TreatmentStatus = (typeof TREATMENT_STATUSES)[number]
export const TREATMENT_STATUS_LABEL: Record<TreatmentStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  complete: 'Complete',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}
export const TREATMENT_STATUS_PILL: Record<TreatmentStatus, string> = {
  planned: 'pill pill-neutral',
  in_progress: 'pill pill-info',
  complete: 'pill pill-success',
  overdue: 'pill pill-danger',
  cancelled: 'pill pill-neutral',
}

// ---------------------------------------------------------------------------
// Risk status, source, trend
// ---------------------------------------------------------------------------

export const RISK_STATUSES = [
  'identified',
  'assessed',
  'treating',
  'monitoring',
  'closed',
  'accepted',
] as const
export type RiskStatus = (typeof RISK_STATUSES)[number]

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  identified: 'Identified',
  assessed: 'Assessed',
  treating: 'Under treatment',
  monitoring: 'Monitoring',
  closed: 'Closed',
  accepted: 'Accepted',
}

export const RISK_STATUS_PILL: Record<RiskStatus, string> = {
  identified: 'pill pill-neutral',
  assessed: 'pill pill-info',
  treating: 'pill pill-brass',
  monitoring: 'pill pill-info',
  closed: 'pill pill-neutral',
  accepted: 'pill pill-success',
}

export const RISK_SOURCES = [
  'workshop',
  'audit',
  'incident',
  'regulatory',
  'strategic_review',
  'kri',
] as const
export type RiskSource = (typeof RISK_SOURCES)[number]
export const RISK_SOURCE_LABEL: Record<RiskSource, string> = {
  workshop: 'Risk workshop',
  audit: 'Internal audit',
  incident: 'Incident / loss event',
  regulatory: 'Regulatory change',
  strategic_review: 'Strategic review',
  kri: 'KRI breach',
}

export const RISK_TRENDS = ['increasing', 'stable', 'decreasing'] as const
export type RiskTrend = (typeof RISK_TRENDS)[number]
export const RISK_TREND_LABEL: Record<RiskTrend, string> = {
  increasing: 'Increasing',
  stable: 'Stable',
  decreasing: 'Decreasing',
}

// ---------------------------------------------------------------------------
// Risk appetite (COSO ERM 2017 — appetite is set by the board; tolerance is
// the acceptable variation around it, expressed here as a residual score)
// ---------------------------------------------------------------------------

export const APPETITE_LEVELS = ['averse', 'minimal', 'cautious', 'open', 'hungry'] as const
export type AppetiteLevel = (typeof APPETITE_LEVELS)[number]

export const APPETITE_LEVEL_LABEL: Record<AppetiteLevel, string> = {
  averse: 'Averse',
  minimal: 'Minimal',
  cautious: 'Cautious',
  open: 'Open',
  hungry: 'Hungry',
}

export const APPETITE_LEVEL_HINT: Record<AppetiteLevel, string> = {
  averse: 'Avoidance of risk and uncertainty is a core objective. No tolerance for exposure in this domain.',
  minimal: 'Preference for very safe options. Exposure accepted only where it is unavoidable and tightly controlled.',
  cautious: 'Preference for safe options with limited reward potential; exposure accepted where the return is clear.',
  open: 'Willing to consider all options and choose the one most likely to deliver the objective, with controls in place.',
  hungry: 'Actively seeking exposure in this domain where the potential return justifies it.',
}

/** Suggested tolerance threshold (residual L×I) for each appetite level. */
export const APPETITE_SUGGESTED_TOLERANCE: Record<AppetiteLevel, number> = {
  averse: 4,
  minimal: 6,
  cautious: 12,
  open: 15,
  hungry: 20,
}

// ---------------------------------------------------------------------------
// KRIs
// ---------------------------------------------------------------------------

export const KRI_DIRECTIONS = ['higher_is_worse', 'lower_is_worse'] as const
export type KriDirection = (typeof KRI_DIRECTIONS)[number]
export const KRI_DIRECTION_LABEL: Record<KriDirection, string> = {
  higher_is_worse: 'Higher is worse',
  lower_is_worse: 'Lower is worse',
}

export const KRI_FREQUENCIES = ['weekly', 'monthly', 'quarterly'] as const
export type KriFrequency = (typeof KRI_FREQUENCIES)[number]
export const KRI_FREQUENCY_LABEL: Record<KriFrequency, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

export const KRI_STATUSES = ['green', 'amber', 'red', 'none'] as const
export type KriStatus = (typeof KRI_STATUSES)[number]
export const KRI_STATUS_LABEL: Record<KriStatus, string> = {
  green: 'Within tolerance',
  amber: 'Early warning',
  red: 'In breach',
  none: 'No reading',
}
export const KRI_STATUS_PILL: Record<KriStatus, string> = {
  green: 'pill pill-success',
  amber: 'pill pill-warning',
  red: 'pill pill-danger',
  none: 'pill pill-neutral',
}

/**
 * Mirrors public.erm_kri_rag(). Kept in TypeScript so a reading can be graded
 * client-side before it is written, and so the view and the UI cannot drift.
 */
export function kriRag(
  direction: string | null | undefined,
  value: number | null | undefined,
  amber: number | null | undefined,
  red: number | null | undefined
): KriStatus {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'none'
  if (amber === null || amber === undefined || red === null || red === undefined) return 'none'
  if (direction === 'lower_is_worse') {
    if (value <= red) return 'red'
    if (value <= amber) return 'amber'
    return 'green'
  }
  if (value >= red) return 'red'
  if (value >= amber) return 'amber'
  return 'green'
}

// ---------------------------------------------------------------------------
// Links to other modules
// ---------------------------------------------------------------------------

export const LINK_KINDS = [
  'audit_observation',
  'icfr_deficiency',
  'program_control_implementation',
] as const
export type LinkKind = (typeof LINK_KINDS)[number]
export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  audit_observation: 'Audit observation',
  icfr_deficiency: 'ICFR deficiency',
  program_control_implementation: 'Compliance programme control',
}

export const CONTROL_TYPES = ['preventive', 'detective', 'directive', 'corrective'] as const
export type ErmControlType = (typeof CONTROL_TYPES)[number]
export const CONTROL_TYPE_LABEL: Record<ErmControlType, string> = {
  preventive: 'Preventive',
  detective: 'Detective',
  directive: 'Directive',
  corrective: 'Corrective',
}

/** Control effectiveness on a 1–5 scale (the input to residual scoring). */
export const EFFECTIVENESS_LABEL: Record<number, string> = {
  1: 'Ineffective',
  2: 'Weak',
  3: 'Partially effective',
  4: 'Largely effective',
  5: 'Fully effective',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isOneOf<T extends readonly string[]>(
  list: T,
  value: unknown
): value is T[number] {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

export function scoreOf(
  likelihood: number | null | undefined,
  impact: number | null | undefined
): number | null {
  if (!likelihood || !impact) return null
  return likelihood * impact
}

/** Movement in residual score: negative is an improvement. */
export type Movement = {
  delta: number
  direction: 'up' | 'down' | 'flat'
}

export function movement(current: number | null, previous: number | null): Movement | null {
  if (current === null || previous === null) return null
  const delta = current - previous
  return { delta, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' }
}

export function formatScore(
  likelihood: number | null | undefined,
  impact: number | null | undefined
): string {
  if (!likelihood || !impact) return '—'
  return `${likelihood} × ${impact} = ${likelihood * impact}`
}
