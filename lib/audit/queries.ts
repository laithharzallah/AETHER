import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/database.types'
import {
  CAPACITY_CONSUMING_STATUSES,
  COVERAGE_WINDOW_MONTHS,
  OPEN_ACTION_STATUSES,
  OPEN_OBSERVATION_STATUSES,
  ageingBucket,
  pct,
  riskBand,
  type AgeingBucket,
  type EngagementStatus,
  type ObservationRating,
  type RiskBand,
} from '@/lib/audit/constants'

export type UniverseEntry = Tables<'audit_universe'>
export type UniverseScored = Tables<'audit_universe_scored'>
export type AuditPlan = Tables<'audit_plans'>
export type AuditPlanItem = Tables<'audit_plan_items'>
export type Engagement = Tables<'audit_engagements'>
export type EngagementSummary = Tables<'audit_engagement_summary'>
export type Procedure = Tables<'audit_procedures'>
export type Workpaper = Tables<'audit_workpapers'>
export type Observation = Tables<'audit_observations'>
export type AuditAction = Tables<'audit_actions'>
export type ActionRegisterRow = Tables<'audit_action_register'>
export type ProgramTemplate = Tables<'audit_program_templates'>

export type Member = { id: string; name: string }

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Members and reference data
// ---------------------------------------------------------------------------

export async function listMembers(): Promise<Member[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name', { ascending: true })
  if (error) {
    console.error('[audit] listMembers', error)
    return []
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || p.email || 'Unknown',
  }))
}

export type TemplateSummary = ProgramTemplate & { step_count: number }

export async function listProgramTemplates(): Promise<TemplateSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_program_templates')
    .select('*, audit_program_template_steps ( id )')
    .order('sort_order')
  if (error) {
    console.error('[audit] listProgramTemplates', error)
    return []
  }
  return (data ?? []).map((t) => {
    const { audit_program_template_steps, ...rest } = t
    const steps = Array.isArray(audit_program_template_steps)
      ? audit_program_template_steps
      : []
    return { ...(rest as ProgramTemplate), step_count: steps.length }
  })
}

// ---------------------------------------------------------------------------
// Audit universe
// ---------------------------------------------------------------------------

export type UniverseRow = UniverseScored & {
  owner: Member | null
  band: RiskBand
  /** Whole months since the last audit, rounded down. Null when never audited. */
  months_since: number | null
  /** Months remaining until the entity falls due. Negative when overdue. */
  months_until_due: number | null
  coverage_state: 'never' | 'overdue' | 'due_soon' | 'current'
}

function coverageState(row: UniverseScored): UniverseRow['coverage_state'] {
  if (!row.last_audited_at) return 'never'
  const since = num(row.months_since_last_audit)
  const freq = num(row.effective_frequency_months) || 24
  if (since >= freq) return 'overdue'
  if (freq - since <= 3) return 'due_soon'
  return 'current'
}

export async function listUniverse(): Promise<UniverseRow[]> {
  const supabase = await createClient()
  const [scoredRes, members] = await Promise.all([
    supabase
      .from('audit_universe_scored')
      .select('*')
      .order('risk_score', { ascending: false, nullsFirst: false })
      .order('code', { ascending: true }),
    listMembers(),
  ])
  if (scoredRes.error) {
    console.error('[audit] listUniverse', scoredRes.error)
    return []
  }
  const byId = new Map(members.map((m) => [m.id, m]))
  return (scoredRes.data ?? []).map((row) => {
    const since = row.months_since_last_audit === null ? null : num(row.months_since_last_audit)
    const freq = num(row.effective_frequency_months) || 24
    return {
      ...row,
      owner: row.owner_id ? byId.get(row.owner_id) ?? null : null,
      band: riskBand(row.risk_score),
      months_since: since === null ? null : Math.floor(since),
      months_until_due: since === null ? null : Math.round(freq - since),
      coverage_state: coverageState(row),
    }
  })
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export type PlanSummary = AuditPlan & {
  item_count: number
  planned_days: number
  deferred_days: number
  deferred_count: number
  completed_count: number
  utilisation_pct: number
  completion_pct: number
}

function summarisePlan(plan: AuditPlan, items: AuditPlanItem[]): PlanSummary {
  const active = items.filter((i) =>
    (CAPACITY_CONSUMING_STATUSES as readonly string[]).includes(i.status)
  )
  const plannedDays = active.reduce((n, i) => n + num(i.planned_days), 0)
  const deferred = items.filter((i) => i.status === 'deferred')
  const completed = items.filter((i) => i.status === 'reported')
  const capacity = num(plan.total_capacity_days)
  return {
    ...plan,
    item_count: items.length,
    planned_days: Math.round(plannedDays * 10) / 10,
    deferred_days: Math.round(deferred.reduce((n, i) => n + num(i.planned_days), 0) * 10) / 10,
    deferred_count: deferred.length,
    completed_count: completed.length,
    utilisation_pct: capacity > 0 ? Math.round((plannedDays / capacity) * 100) : 0,
    completion_pct: active.length ? pct(completed.length, active.length) : 0,
  }
}

export async function listPlans(): Promise<PlanSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_plans')
    .select('*, audit_plan_items ( id, status, planned_days )')
    .order('period', { ascending: false })
  if (error) {
    console.error('[audit] listPlans', error)
    return []
  }
  return (data ?? []).map((p) => {
    const { audit_plan_items, ...rest } = p
    const items = (Array.isArray(audit_plan_items) ? audit_plan_items : []) as AuditPlanItem[]
    return summarisePlan(rest as AuditPlan, items)
  })
}

export type PlanItemRow = AuditPlanItem & {
  universe: {
    id: string
    code: string
    name: string
    type: string
    risk_score: number | null
    last_audited_at: string | null
  } | null
  engagement: { id: string; code: string; status: string } | null
  display_title: string
}

export type PlanDetail = {
  plan: PlanSummary
  items: PlanItemRow[]
  approver: Member | null
  byQuarter: Record<string, PlanItemRow[]>
  capacity: {
    total: number
    planned: number
    deferred: number
    remaining: number
    utilisationPct: number
    demandFromUniverse: number
  }
}

export async function getPlan(planId: string): Promise<PlanDetail | null> {
  const supabase = await createClient()

  const { data: plan, error } = await supabase
    .from('audit_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle()
  if (error) console.error('[audit] getPlan', error)
  if (!plan) return null

  const [itemsRes, members, universe] = await Promise.all([
    supabase
      .from('audit_plan_items')
      .select(
        '*, audit_universe ( id, code, name, type, risk_score, last_audited_at ), audit_engagements ( id, code, status )'
      )
      .eq('plan_id', planId)
      .order('quarter')
      .order('sort_order'),
    listMembers(),
    listUniverse(),
  ])
  if (itemsRes.error) console.error('[audit] getPlan items', itemsRes.error)

  const items: PlanItemRow[] = (itemsRes.data ?? []).map((raw) => {
    const { audit_universe, audit_engagements, ...rest } = raw
    const u = Array.isArray(audit_universe) ? audit_universe[0] : audit_universe
    const e = Array.isArray(audit_engagements) ? audit_engagements[0] : audit_engagements
    return {
      ...(rest as AuditPlanItem),
      universe: u
        ? {
            id: u.id,
            code: u.code,
            name: u.name,
            type: u.type,
            risk_score: u.risk_score === null ? null : num(u.risk_score),
            last_audited_at: u.last_audited_at,
          }
        : null,
      engagement: e ? { id: e.id, code: e.code, status: e.status } : null,
      display_title: rest.title || u?.name || 'Untitled engagement',
    }
  })

  const summary = summarisePlan(plan as AuditPlan, items)
  const byQuarter: Record<string, PlanItemRow[]> = { Q1: [], Q2: [], Q3: [], Q4: [] }
  for (const i of items) {
    if (!byQuarter[i.quarter]) byQuarter[i.quarter] = []
    byQuarter[i.quarter].push(i)
  }

  // Demand: days that would be required to cover every entity currently due.
  const plannedUniverseIds = new Set(items.map((i) => i.universe_id).filter(Boolean))
  const outstandingDue = universe.filter((u) => u.is_due && !plannedUniverseIds.has(u.id))
  const demandFromUniverse =
    summary.planned_days + summary.deferred_days + outstandingDue.length * 12

  return {
    plan: summary,
    items,
    approver: plan.approved_by ? members.find((m) => m.id === plan.approved_by) ?? null : null,
    byQuarter,
    capacity: {
      total: num(plan.total_capacity_days),
      planned: summary.planned_days,
      deferred: summary.deferred_days,
      remaining: Math.round((num(plan.total_capacity_days) - summary.planned_days) * 10) / 10,
      utilisationPct: summary.utilisation_pct,
      demandFromUniverse: Math.round(demandFromUniverse * 10) / 10,
    },
  }
}

// ---------------------------------------------------------------------------
// Engagements
// ---------------------------------------------------------------------------

export type EngagementRow = EngagementSummary & {
  lead_auditor: Member | null
  progress_pct: number
}

export async function listEngagements(): Promise<EngagementRow[]> {
  const supabase = await createClient()
  const [res, members] = await Promise.all([
    supabase
      .from('audit_engagement_summary')
      .select('*')
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('code', { ascending: false }),
    listMembers(),
  ])
  if (res.error) {
    console.error('[audit] listEngagements', res.error)
    return []
  }
  const byId = new Map(members.map((m) => [m.id, m]))
  return (res.data ?? []).map((e) => ({
    ...e,
    lead_auditor: e.lead_auditor_id ? byId.get(e.lead_auditor_id) ?? null : null,
    progress_pct: pct(num(e.procedures_complete), num(e.procedures_total)),
  }))
}

export type ProcedureRow = Procedure & {
  assignee: Member | null
  workpaper_refs: string[]
}

export type WorkpaperRow = Workpaper & {
  preparer: Member | null
  reviewer: Member | null
  procedure_ref: string | null
}

export type ObservationRow = Observation & {
  actions: (AuditAction & { owner: Member | null; is_overdue: boolean })[]
  open_action_count: number
  library_control: { id: string; control_ref: string; title_en: string } | null
}

export type EngagementDetail = {
  engagement: Engagement & {
    lead_auditor: Member | null
    auditee_owner: Member | null
    universe: { id: string; code: string; name: string } | null
    plan: { id: string; period: string } | null
  }
  summary: EngagementSummary | null
  procedures: ProcedureRow[]
  workpapers: WorkpaperRow[]
  observations: ObservationRow[]
  members: Member[]
  templates: TemplateSummary[]
}

export async function getEngagement(id: string): Promise<EngagementDetail | null> {
  const supabase = await createClient()

  const { data: engagement, error } = await supabase
    .from('audit_engagements')
    .select(
      '*, audit_universe ( id, code, name ), audit_plan_items ( id, audit_plans ( id, period ) )'
    )
    .eq('id', id)
    .maybeSingle()
  if (error) console.error('[audit] getEngagement', error)
  if (!engagement) return null

  const [summaryRes, procRes, wpRes, obsRes, members, templates] = await Promise.all([
    supabase.from('audit_engagement_summary').select('*').eq('id', id).maybeSingle(),
    supabase.from('audit_procedures').select('*').eq('engagement_id', id).order('sort_order').order('ref'),
    supabase.from('audit_workpapers').select('*').eq('engagement_id', id).order('ref'),
    supabase
      .from('audit_observations')
      .select('*, audit_actions ( * ), controls ( id, control_ref, title_en )')
      .eq('engagement_id', id)
      .order('ref'),
    listMembers(),
    listProgramTemplates(),
  ])

  if (procRes.error) console.error('[audit] getEngagement procedures', procRes.error)
  if (wpRes.error) console.error('[audit] getEngagement workpapers', wpRes.error)
  if (obsRes.error) console.error('[audit] getEngagement observations', obsRes.error)

  const byId = new Map(members.map((m) => [m.id, m]))
  const member = (uid: string | null) => (uid ? byId.get(uid) ?? null : null)
  const today = todayIso()

  const workpapers: WorkpaperRow[] = (wpRes.data ?? []).map((w) => ({
    ...(w as Workpaper),
    preparer: member(w.prepared_by),
    reviewer: member(w.reviewed_by),
    procedure_ref:
      (procRes.data ?? []).find((p) => p.id === w.procedure_id)?.ref ?? null,
  }))

  const procedures: ProcedureRow[] = (procRes.data ?? []).map((p) => ({
    ...(p as Procedure),
    assignee: member(p.assigned_to),
    workpaper_refs: workpapers.filter((w) => w.procedure_id === p.id).map((w) => w.ref),
  }))

  const observations: ObservationRow[] = (obsRes.data ?? []).map((raw) => {
    const { audit_actions, controls, ...rest } = raw
    const ctl = Array.isArray(controls) ? controls[0] : controls
    const actions = ((Array.isArray(audit_actions) ? audit_actions : []) as AuditAction[])
      .map((a) => {
        const due = a.revised_due_date ?? a.due_date
        return {
          ...a,
          owner: member(a.owner_id),
          is_overdue:
            (OPEN_ACTION_STATUSES as readonly string[]).includes(a.status) &&
            !!due &&
            due < today,
        }
      })
      .sort((a, b) => (a.due_date ?? '9999') .localeCompare(b.due_date ?? '9999'))
    return {
      ...(rest as Observation),
      actions,
      open_action_count: actions.filter((a) =>
        (OPEN_ACTION_STATUSES as readonly string[]).includes(a.status)
      ).length,
      library_control: ctl
        ? { id: ctl.id, control_ref: ctl.control_ref, title_en: ctl.title_en }
        : null,
    }
  })

  const { audit_universe, audit_plan_items, ...eRest } = engagement
  const u = Array.isArray(audit_universe) ? audit_universe[0] : audit_universe
  const pi = Array.isArray(audit_plan_items) ? audit_plan_items[0] : audit_plan_items
  const planRel = pi
    ? Array.isArray(pi.audit_plans)
      ? pi.audit_plans[0]
      : pi.audit_plans
    : null

  return {
    engagement: {
      ...(eRest as Engagement),
      lead_auditor: member(eRest.lead_auditor_id),
      auditee_owner: member(eRest.auditee_owner_id),
      universe: u ? { id: u.id, code: u.code, name: u.name } : null,
      plan: planRel ? { id: planRel.id, period: planRel.period } : null,
    },
    summary: (summaryRes.data as EngagementSummary | null) ?? null,
    procedures,
    workpapers,
    observations,
    members,
    templates,
  }
}

// ---------------------------------------------------------------------------
// Observation register (org-wide)
// ---------------------------------------------------------------------------

export type ObservationRegisterRow = Observation & {
  engagement: { id: string; code: string; title: string; status: string } | null
  action_count: number
  open_action_count: number
  overdue_action_count: number
  next_due_date: string | null
}

export async function listObservations(): Promise<ObservationRegisterRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_observations')
    .select('*, audit_engagements ( id, code, title, status ), audit_actions ( status, due_date, revised_due_date )')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[audit] listObservations', error)
    return []
  }
  const today = todayIso()
  return (data ?? []).map((raw) => {
    const { audit_engagements, audit_actions, ...rest } = raw
    const e = Array.isArray(audit_engagements) ? audit_engagements[0] : audit_engagements
    const actions = Array.isArray(audit_actions) ? audit_actions : []
    const open = actions.filter((a) =>
      (OPEN_ACTION_STATUSES as readonly string[]).includes(a.status)
    )
    const dues = open
      .map((a) => a.revised_due_date ?? a.due_date)
      .filter((d): d is string => !!d)
      .sort()
    return {
      ...(rest as Observation),
      engagement: e ? { id: e.id, code: e.code, title: e.title, status: e.status } : null,
      action_count: actions.length,
      open_action_count: open.length,
      overdue_action_count: dues.filter((d) => d < today).length,
      next_due_date: dues[0] ?? null,
    }
  })
}

// ---------------------------------------------------------------------------
// Action follow-up register
// ---------------------------------------------------------------------------

export type ActionRow = ActionRegisterRow & {
  owner: Member | null
  verifier: Member | null
  ageing_bucket: AgeingBucket
  days_overdue: number
}

export async function listActions(): Promise<ActionRow[]> {
  const supabase = await createClient()
  const [res, members] = await Promise.all([
    supabase
      .from('audit_action_register')
      .select('*')
      .order('effective_due_date', { ascending: true, nullsFirst: false }),
    listMembers(),
  ])
  if (res.error) {
    console.error('[audit] listActions', res.error)
    return []
  }
  const byId = new Map(members.map((m) => [m.id, m]))
  return (res.data ?? []).map((a) => {
    const overdueDays = a.is_overdue ? Math.max(num(a.days_past_due), 0) : 0
    return {
      ...a,
      owner: a.owner_id ? byId.get(a.owner_id) ?? null : null,
      verifier: a.verified_by ? byId.get(a.verified_by) ?? null : null,
      ageing_bucket: ageingBucket(a.is_overdue ? a.days_past_due : 0),
      days_overdue: overdueDays,
    }
  })
}

// ---------------------------------------------------------------------------
// Dashboard aggregate
// ---------------------------------------------------------------------------

export type CoverageEntry = {
  id: string
  code: string
  name: string
  risk_score: number
  band: RiskBand
  months_since: number | null
  covered: boolean
  coverage_state: UniverseRow['coverage_state']
}

export type AuditDashboard = {
  currentPlan: PlanSummary | null
  planCompletionPct: number
  planPlannedDays: number
  planCapacityDays: number
  planDeferredCount: number
  engagementsByStage: Record<EngagementStatus, number>
  engagementsActive: number
  observationsByRating: Record<ObservationRating, number>
  observationsOpen: number
  observationsCritical: number
  repeatFindings: number
  actionsOpen: number
  actionsOverdue: number
  actionsAwaitingVerification: number
  actionsByAgeing: Record<AgeingBucket, number>
  universeTotal: number
  universeDue: number
  coverage: CoverageEntry[]
  coveragePct: number
  highRiskCoveragePct: number
  workpapersAwaitingReview: number
}

export async function getAuditDashboard(): Promise<AuditDashboard> {
  const supabase = await createClient()
  const windowStart = new Date()
  windowStart.setMonth(windowStart.getMonth() - COVERAGE_WINDOW_MONTHS)
  const windowStartIso = windowStart.toISOString().slice(0, 10)

  const [plans, universe, engagements, actions, obsRes, wpRes, coveringRes] =
    await Promise.all([
      listPlans(),
      listUniverse(),
      listEngagements(),
      listActions(),
      supabase.from('audit_observations').select('rating, status, repeat_finding'),
      supabase.from('audit_workpapers').select('review_status'),
      supabase
        .from('audit_engagements')
        .select('universe_id, status, report_issued_at, start_date')
        .not('universe_id', 'is', null)
        .neq('status', 'cancelled'),
    ])

  if (obsRes.error) console.error('[audit] dashboard observations', obsRes.error)
  if (wpRes.error) console.error('[audit] dashboard workpapers', wpRes.error)
  if (coveringRes.error) console.error('[audit] dashboard coverage', coveringRes.error)

  const currentPlan =
    plans.find((p) => p.status === 'in_progress') ??
    plans.find((p) => p.status === 'approved') ??
    plans[0] ??
    null

  const engagementsByStage: Record<EngagementStatus, number> = {
    planning: 0,
    fieldwork: 0,
    reporting: 0,
    issued: 0,
    closed: 0,
    cancelled: 0,
  }
  for (const e of engagements) {
    const s = (e.status ?? 'planning') as EngagementStatus
    if (s in engagementsByStage) engagementsByStage[s] += 1
  }

  const observationsByRating: Record<ObservationRating, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }
  let observationsOpen = 0
  let repeatFindings = 0
  for (const o of obsRes.data ?? []) {
    const isOpen = (OPEN_OBSERVATION_STATUSES as readonly string[]).includes(o.status)
    if (isOpen) {
      observationsOpen += 1
      const r = o.rating as ObservationRating
      if (r in observationsByRating) observationsByRating[r] += 1
      if (o.repeat_finding) repeatFindings += 1
    }
  }

  const actionsByAgeing: Record<AgeingBucket, number> = {
    not_due: 0,
    due_1_30: 0,
    due_31_90: 0,
    due_91_180: 0,
    due_180_plus: 0,
  }
  let actionsOpen = 0
  let actionsOverdue = 0
  let actionsAwaitingVerification = 0
  for (const a of actions) {
    if ((OPEN_ACTION_STATUSES as readonly string[]).includes(a.status ?? '')) {
      actionsOpen += 1
      actionsByAgeing[a.ageing_bucket] += 1
      if (a.is_overdue) actionsOverdue += 1
    }
    if (a.status === 'implemented') actionsAwaitingVerification += 1
  }

  // Coverage over the rolling window: an entity is covered when an engagement
  // touching it started or was issued within the window, or it was recorded as
  // last audited within the window.
  const coveredIds = new Set<string>()
  for (const e of coveringRes.data ?? []) {
    const marker = e.report_issued_at?.slice(0, 10) ?? e.start_date
    if (e.universe_id && (!marker || marker >= windowStartIso)) coveredIds.add(e.universe_id)
  }
  const coverage: CoverageEntry[] = universe
    .filter((u) => u.status === 'active')
    .map((u) => ({
      id: u.id ?? '',
      code: u.code ?? '',
      name: u.name ?? '',
      risk_score: num(u.risk_score),
      band: u.band,
      months_since: u.months_since,
      covered:
        coveredIds.has(u.id ?? '') ||
        (!!u.last_audited_at && u.last_audited_at >= windowStartIso),
      coverage_state: u.coverage_state,
    }))

  const highRisk = coverage.filter((c) => c.band === 'critical' || c.band === 'high')

  return {
    currentPlan,
    planCompletionPct: currentPlan?.completion_pct ?? 0,
    planPlannedDays: currentPlan?.planned_days ?? 0,
    planCapacityDays: num(currentPlan?.total_capacity_days),
    planDeferredCount: currentPlan?.deferred_count ?? 0,
    engagementsByStage,
    engagementsActive:
      engagementsByStage.planning + engagementsByStage.fieldwork + engagementsByStage.reporting,
    observationsByRating,
    observationsOpen,
    observationsCritical: observationsByRating.critical,
    repeatFindings,
    actionsOpen,
    actionsOverdue,
    actionsAwaitingVerification,
    actionsByAgeing,
    universeTotal: universe.filter((u) => u.status === 'active').length,
    universeDue: universe.filter((u) => u.is_due).length,
    coverage,
    coveragePct: pct(coverage.filter((c) => c.covered).length, coverage.length),
    highRiskCoveragePct: pct(highRisk.filter((c) => c.covered).length, highRisk.length),
    workpapersAwaitingReview: (wpRes.data ?? []).filter(
      (w) => w.review_status === 'prepared' || w.review_status === 'reopened'
    ).length,
  }
}
