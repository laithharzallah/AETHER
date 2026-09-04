/**
 * Internal Audit vocabulary — IIA Global Internal Audit Standards (2024).
 *
 * Domain IV (Managing the Internal Audit Function) for risk-based planning,
 * Domain V (Performing Internal Audit Services) for engagement planning,
 * work programs, supervision, findings and communication of results.
 * Audit committee oversight follows the CMA Corporate Governance Regulations;
 * SAMA-regulated entities carry additional expectations.
 *
 * Shared between server queries, server actions, API routes and client
 * components — this file must never import server-only modules.
 */

// ---------------------------------------------------------------------------
// Audit universe
// ---------------------------------------------------------------------------

export const UNIVERSE_TYPES = [
  'process',
  'entity',
  'system',
  'project',
  'function',
  'third_party',
  'regulation',
] as const
export type UniverseType = (typeof UNIVERSE_TYPES)[number]
export const UNIVERSE_TYPE_LABEL: Record<UniverseType, string> = {
  process: 'Business process',
  entity: 'Legal entity / location',
  system: 'System / application',
  project: 'Project / programme',
  function: 'Function / department',
  third_party: 'Third party',
  regulation: 'Regulatory obligation',
}

export const UNIVERSE_STATUSES = ['active', 'retired'] as const
export type UniverseStatus = (typeof UNIVERSE_STATUSES)[number]
export const UNIVERSE_STATUS_LABEL: Record<UniverseStatus, string> = {
  active: 'Active',
  retired: 'Retired',
}

/**
 * The six risk factors scored 1–5. The weights match the generated
 * `audit_universe.risk_score` column and must not drift from the migration.
 */
export const RISK_FACTORS = [
  'inherent_risk',
  'control_environment',
  'regulatory_exposure',
  'financial_materiality',
  'change_velocity',
  'prior_findings',
] as const
export type RiskFactor = (typeof RISK_FACTORS)[number]

export const RISK_FACTOR_LABEL: Record<RiskFactor, string> = {
  inherent_risk: 'Inherent risk',
  control_environment: 'Control environment',
  regulatory_exposure: 'Regulatory exposure',
  financial_materiality: 'Financial materiality',
  change_velocity: 'Change velocity',
  prior_findings: 'Prior findings',
}

export const RISK_FACTOR_WEIGHT: Record<RiskFactor, number> = {
  inherent_risk: 0.25,
  control_environment: 0.2,
  regulatory_exposure: 0.2,
  financial_materiality: 0.15,
  change_velocity: 0.1,
  prior_findings: 0.1,
}

export const RISK_FACTOR_HINT: Record<RiskFactor, string> = {
  inherent_risk: 'Risk before considering controls — complexity, volume, judgement and fraud exposure.',
  control_environment: 'Weakness of the control environment — 5 means immature or previously ineffective.',
  regulatory_exposure: 'Exposure to CMA, SAMA, ZATCA, NCA, SDAIA or sector regulators and the consequence of breach.',
  financial_materiality: 'Size of the balances, transaction flows or spend within scope.',
  change_velocity: 'Recent or planned change — system implementation, restructuring, new products, new leadership.',
  prior_findings: 'History of audit findings, incidents, losses or overdue management actions.',
}

/** Weighted risk score on the 0–100 scale, mirroring the generated column. */
export function computeRiskScore(factors: Record<RiskFactor, number>): number {
  const raw = RISK_FACTORS.reduce(
    (sum, f) => sum + (Number(factors[f]) || 0) * RISK_FACTOR_WEIGHT[f],
    0
  )
  return Math.round(raw * 20 * 10) / 10
}

export const RISK_BANDS = ['critical', 'high', 'moderate', 'low'] as const
export type RiskBand = (typeof RISK_BANDS)[number]
export const RISK_BAND_LABEL: Record<RiskBand, string> = {
  critical: 'Critical',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
}

/** Bands used across the universe, plan generation and the coverage heat map. */
export function riskBand(score: number | null | undefined): RiskBand {
  const n = Number(score) || 0
  if (n >= 80) return 'critical'
  if (n >= 60) return 'high'
  if (n >= 40) return 'moderate'
  return 'low'
}

export const RISK_BAND_PILL: Record<RiskBand, string> = {
  critical: 'pill pill-danger',
  high: 'pill pill-warning',
  moderate: 'pill pill-info',
  low: 'pill pill-neutral',
}

/** Background swatch for the coverage heat map. */
export const RISK_BAND_SWATCH: Record<RiskBand, string> = {
  critical: 'bg-danger/70',
  high: 'bg-warning/70',
  moderate: 'bg-info/50',
  low: 'bg-muted-foreground/25',
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export const PLAN_STATUSES = ['draft', 'approved', 'in_progress', 'closed'] as const
export type PlanStatus = (typeof PLAN_STATUSES)[number]
export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  draft: 'Draft',
  approved: 'Approved by audit committee',
  in_progress: 'In progress',
  closed: 'Closed',
}
export const PLAN_STATUS_PILL: Record<PlanStatus, string> = {
  draft: 'pill pill-neutral',
  approved: 'pill pill-info',
  in_progress: 'pill pill-brass',
  closed: 'pill pill-success',
}

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const
export type Quarter = (typeof QUARTERS)[number]

export const PLAN_ITEM_STATUSES = [
  'planned',
  'scheduled',
  'in_progress',
  'reported',
  'cancelled',
  'deferred',
] as const
export type PlanItemStatus = (typeof PLAN_ITEM_STATUSES)[number]
export const PLAN_ITEM_STATUS_LABEL: Record<PlanItemStatus, string> = {
  planned: 'Planned',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  reported: 'Reported',
  cancelled: 'Cancelled',
  deferred: 'Deferred — no capacity',
}
export const PLAN_ITEM_STATUS_PILL: Record<PlanItemStatus, string> = {
  planned: 'pill pill-neutral',
  scheduled: 'pill pill-info',
  in_progress: 'pill pill-brass',
  reported: 'pill pill-success',
  cancelled: 'pill pill-neutral',
  deferred: 'pill pill-warning',
}

export const PRIORITIES = ['high', 'medium', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]
export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

/** Plan item statuses that consume plan capacity. */
export const CAPACITY_CONSUMING_STATUSES: readonly PlanItemStatus[] = [
  'planned',
  'scheduled',
  'in_progress',
  'reported',
]

// ---------------------------------------------------------------------------
// Engagements
// ---------------------------------------------------------------------------

export const ENGAGEMENT_TYPES = [
  'assurance',
  'advisory',
  'follow_up',
  'investigation',
  'compliance_review',
] as const
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number]
export const ENGAGEMENT_TYPE_LABEL: Record<EngagementType, string> = {
  assurance: 'Assurance',
  advisory: 'Advisory',
  follow_up: 'Follow-up',
  investigation: 'Investigation',
  compliance_review: 'Compliance review',
}

export const ENGAGEMENT_STATUSES = [
  'planning',
  'fieldwork',
  'reporting',
  'issued',
  'closed',
  'cancelled',
] as const
export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number]
export const ENGAGEMENT_STATUS_LABEL: Record<EngagementStatus, string> = {
  planning: 'Planning',
  fieldwork: 'Fieldwork',
  reporting: 'Reporting',
  issued: 'Report issued',
  closed: 'Closed',
  cancelled: 'Cancelled',
}
export const ENGAGEMENT_STATUS_PILL: Record<EngagementStatus, string> = {
  planning: 'pill pill-neutral',
  fieldwork: 'pill pill-info',
  reporting: 'pill pill-brass',
  issued: 'pill pill-success',
  closed: 'pill pill-success',
  cancelled: 'pill pill-neutral',
}

/** The linear lifecycle used by advanceEngagementStage. */
export const ENGAGEMENT_STAGE_ORDER: readonly EngagementStatus[] = [
  'planning',
  'fieldwork',
  'reporting',
  'issued',
  'closed',
]

export function nextEngagementStage(
  status: string
): EngagementStatus | null {
  const i = ENGAGEMENT_STAGE_ORDER.indexOf(status as EngagementStatus)
  if (i < 0 || i >= ENGAGEMENT_STAGE_ORDER.length - 1) return null
  return ENGAGEMENT_STAGE_ORDER[i + 1]
}

export const OVERALL_RATINGS = [
  'satisfactory',
  'needs_improvement',
  'unsatisfactory',
] as const
export type OverallRating = (typeof OVERALL_RATINGS)[number]
export const OVERALL_RATING_LABEL: Record<OverallRating, string> = {
  satisfactory: 'Satisfactory',
  needs_improvement: 'Needs improvement',
  unsatisfactory: 'Unsatisfactory',
}
export const OVERALL_RATING_PILL: Record<OverallRating, string> = {
  satisfactory: 'pill pill-success',
  needs_improvement: 'pill pill-warning',
  unsatisfactory: 'pill pill-danger',
}
export const OVERALL_RATING_DEFINITION: Record<OverallRating, string> = {
  satisfactory:
    'Controls are adequately designed and operating effectively. Any observations are isolated and do not threaten the objectives of the area.',
  needs_improvement:
    'Controls are generally adequate but one or more significant weaknesses require management attention within an agreed timeframe.',
  unsatisfactory:
    'Controls are inadequate or ineffective. Material exposure exists and immediate remedial action and audit committee attention are required.',
}

// ---------------------------------------------------------------------------
// Procedures and workpapers
// ---------------------------------------------------------------------------

export const PROCEDURE_STATUSES = [
  'not_started',
  'in_progress',
  'complete',
  'not_applicable',
] as const
export type ProcedureStatus = (typeof PROCEDURE_STATUSES)[number]
export const PROCEDURE_STATUS_LABEL: Record<ProcedureStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
  not_applicable: 'Not applicable',
}
export const PROCEDURE_STATUS_PILL: Record<ProcedureStatus, string> = {
  not_started: 'pill pill-neutral',
  in_progress: 'pill pill-info',
  complete: 'pill pill-success',
  not_applicable: 'pill pill-neutral',
}

export const WORKPAPER_KINDS = [
  'document',
  'interview',
  'walkthrough',
  'sample_test',
  'analytics',
  'reperformance',
  'observation',
  'other',
] as const
export type WorkpaperKind = (typeof WORKPAPER_KINDS)[number]
export const WORKPAPER_KIND_LABEL: Record<WorkpaperKind, string> = {
  document: 'Document inspection',
  interview: 'Interview / inquiry',
  walkthrough: 'Walkthrough',
  sample_test: 'Sample test',
  analytics: 'Data analytics',
  reperformance: 'Re-performance',
  observation: 'Observation',
  other: 'Other',
}

export const REVIEW_STATUSES = ['draft', 'prepared', 'reviewed', 'reopened'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]
export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: 'Draft',
  prepared: 'Prepared — awaiting review',
  reviewed: 'Reviewed and signed off',
  reopened: 'Reopened by reviewer',
}
export const REVIEW_STATUS_PILL: Record<ReviewStatus, string> = {
  draft: 'pill pill-neutral',
  prepared: 'pill pill-info',
  reviewed: 'pill pill-success',
  reopened: 'pill pill-danger',
}

// ---------------------------------------------------------------------------
// Observations (the 4 Cs)
// ---------------------------------------------------------------------------

export const OBSERVATION_RATINGS = ['critical', 'high', 'medium', 'low'] as const
export type ObservationRating = (typeof OBSERVATION_RATINGS)[number]
export const OBSERVATION_RATING_LABEL: Record<ObservationRating, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}
export const OBSERVATION_RATING_PILL: Record<ObservationRating, string> = {
  critical: 'pill pill-danger',
  high: 'pill pill-warning',
  medium: 'pill pill-info',
  low: 'pill pill-neutral',
}
export const OBSERVATION_RATING_DEFINITION: Record<ObservationRating, string> = {
  critical:
    'Control failure with immediate and material exposure — financial loss, regulatory breach, fraud or a threat to a strategic objective. Requires escalation to the audit committee and remediation within 30 days.',
  high: 'Significant control weakness that could result in material misstatement, regulatory non-compliance or substantial loss if not corrected. Remediation expected within 90 days.',
  medium:
    'Control weakness or inefficiency with limited exposure that should be corrected in the normal course of business, typically within 180 days.',
  low: 'Minor improvement opportunity or housekeeping matter with negligible exposure.',
}
/** Target remediation window used to default management action due dates. */
export const OBSERVATION_RATING_TARGET_DAYS: Record<ObservationRating, number> = {
  critical: 30,
  high: 90,
  medium: 180,
  low: 270,
}

export const OBSERVATION_CATEGORIES = [
  'control_design',
  'control_operation',
  'compliance',
  'efficiency',
  'governance',
  'it',
  'fraud_indicator',
] as const
export type ObservationCategory = (typeof OBSERVATION_CATEGORIES)[number]
export const OBSERVATION_CATEGORY_LABEL: Record<ObservationCategory, string> = {
  control_design: 'Control design',
  control_operation: 'Control operation',
  compliance: 'Compliance',
  efficiency: 'Efficiency / effectiveness',
  governance: 'Governance',
  it: 'IT and information security',
  fraud_indicator: 'Fraud indicator',
}

export const OBSERVATION_STATUSES = [
  'draft',
  'issued',
  'open',
  'in_progress',
  'closed',
  'risk_accepted',
  'overdue',
] as const
export type ObservationStatus = (typeof OBSERVATION_STATUSES)[number]
export const OBSERVATION_STATUS_LABEL: Record<ObservationStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  open: 'Open',
  in_progress: 'In progress',
  closed: 'Closed',
  risk_accepted: 'Risk accepted',
  overdue: 'Overdue',
}
export const OBSERVATION_STATUS_PILL: Record<ObservationStatus, string> = {
  draft: 'pill pill-neutral',
  issued: 'pill pill-info',
  open: 'pill pill-warning',
  in_progress: 'pill pill-brass',
  closed: 'pill pill-success',
  risk_accepted: 'pill pill-neutral',
  overdue: 'pill pill-danger',
}

/** Observation statuses that count as unresolved for the register and dashboard. */
export const OPEN_OBSERVATION_STATUSES: readonly ObservationStatus[] = [
  'issued',
  'open',
  'in_progress',
  'overdue',
]

/** The four elements of a finding, in the order they are written up. */
export const FOUR_CS = [
  {
    key: 'condition' as const,
    label: 'Condition',
    hint: 'What was found — the factual result of the testing, quantified with the population and exception counts.',
  },
  {
    key: 'criteria' as const,
    label: 'Criteria',
    hint: 'What should be — the policy, regulation, contract or control standard the condition is measured against.',
  },
  {
    key: 'cause' as const,
    label: 'Cause',
    hint: 'Why the condition arose — the underlying reason, not a restatement of the condition.',
  },
  {
    key: 'effect' as const,
    label: 'Effect',
    hint: 'The consequence or potential consequence — quantified in riyals, volumes or regulatory exposure where possible.',
  },
]

// ---------------------------------------------------------------------------
// Management actions
// ---------------------------------------------------------------------------

export const ACTION_STATUSES = [
  'open',
  'in_progress',
  'implemented',
  'verified',
  'overdue',
  'cancelled',
] as const
export type ActionStatus = (typeof ACTION_STATUSES)[number]
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  implemented: 'Implemented — awaiting verification',
  verified: 'Verified and closed',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}
export const ACTION_STATUS_PILL: Record<ActionStatus, string> = {
  open: 'pill pill-neutral',
  in_progress: 'pill pill-info',
  implemented: 'pill pill-brass',
  verified: 'pill pill-success',
  overdue: 'pill pill-danger',
  cancelled: 'pill pill-neutral',
}

/** Action statuses still requiring follow-up by internal audit. */
export const OPEN_ACTION_STATUSES: readonly ActionStatus[] = [
  'open',
  'in_progress',
  'overdue',
]

export const AGEING_BUCKETS = [
  { key: 'not_due', label: 'Not yet due', max: 0 },
  { key: 'due_1_30', label: '1–30 days overdue', max: 30 },
  { key: 'due_31_90', label: '31–90 days overdue', max: 90 },
  { key: 'due_91_180', label: '91–180 days overdue', max: 180 },
  { key: 'due_180_plus', label: 'Over 180 days overdue', max: Number.POSITIVE_INFINITY },
] as const
export type AgeingBucket = (typeof AGEING_BUCKETS)[number]['key']

export function ageingBucket(daysPastDue: number | null | undefined): AgeingBucket {
  const d = Number(daysPastDue)
  if (!Number.isFinite(d) || d <= 0) return 'not_due'
  if (d <= 30) return 'due_1_30'
  if (d <= 90) return 'due_31_90'
  if (d <= 180) return 'due_91_180'
  return 'due_180_plus'
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function isOneOf<T extends readonly string[]>(
  list: T,
  value: unknown
): value is T[number] {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDays(n: number | string | null | undefined): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 100)
}

/** Rolling coverage window used by the dashboard, in months. */
export const COVERAGE_WINDOW_MONTHS = 36
