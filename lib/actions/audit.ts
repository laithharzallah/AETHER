'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert, TablesUpdate } from '@/lib/database.types'
import {
  ACTION_STATUSES,
  ENGAGEMENT_STATUSES,
  ENGAGEMENT_TYPES,
  OBSERVATION_CATEGORIES,
  OBSERVATION_RATINGS,
  OBSERVATION_RATING_TARGET_DAYS,
  OBSERVATION_STATUSES,
  OVERALL_RATINGS,
  PLAN_ITEM_STATUSES,
  PLAN_STATUSES,
  PRIORITIES,
  PROCEDURE_STATUSES,
  QUARTERS,
  RISK_FACTORS,
  UNIVERSE_STATUSES,
  UNIVERSE_TYPES,
  WORKPAPER_KINDS,
  isOneOf,
  nextEngagementStage,
  type ObservationRating,
  type RiskFactor,
} from '@/lib/audit/constants'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

type Validated<T> = { ok: false; error: string } | { ok: true; value: T }

type Ctx = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  orgId: string
}

async function getCtx(): Promise<Ctx | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) {
    return { error: 'Your profile is not linked to an organization.' }
  }
  return { supabase, userId: user.id, orgId: profile.organization_id }
}

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

function str(v: unknown, max = 8000): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
function optStr(v: unknown, max = 8000): string | null {
  const s = str(v, max)
  return s.length ? s : null
}
function optNum(v: unknown, min = 0, max = 100000): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < min || n > max) return null
  return Math.round(n * 10) / 10
}
function intInRange(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  const i = Math.round(n)
  return i < min || i > max ? fallback : i
}
function optDate(v: unknown): string | null {
  const s = str(v, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}
function isUuid(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  )
}
function optUuid(v: unknown): string | null {
  return isUuid(v) ? v : null
}
function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function nextRef(existing: string[], prefix: string): string {
  const rx = new RegExp(`^${prefix}-(\\d+)$`)
  const max = existing.reduce((n, r) => {
    const m = rx.exec(r)
    return m ? Math.max(n, Number(m[1])) : n
  }, 0)
  return `${prefix}-${String(max + 1).padStart(2, '0')}`
}

function revalidateAudit(engagementId?: string | null, planId?: string | null) {
  revalidatePath('/dashboard/audit')
  revalidatePath('/dashboard/audit/universe')
  revalidatePath('/dashboard/audit/plans')
  revalidatePath('/dashboard/audit/observations')
  revalidatePath('/dashboard/audit/actions')
  if (engagementId) revalidatePath(`/dashboard/audit/engagements/${engagementId}`)
  if (planId) revalidatePath(`/dashboard/audit/plans/${planId}`)
}

// ---------------------------------------------------------------------------
// Audit universe
// ---------------------------------------------------------------------------

export type UniverseInput = {
  code: string
  name: string
  type?: string
  description?: string | null
  ownerId?: string | null
  parentId?: string | null
  lastAuditedAt?: string | null
  auditFrequencyMonths?: number | null
  status?: string
} & Partial<Record<RiskFactor, number>>

type UniverseRow = Omit<TablesInsert<'audit_universe'>, 'organization_id' | 'id'>

function validateUniverse(input: UniverseInput): Validated<UniverseRow> {
  const code = str(input.code, 20).toUpperCase()
  const name = str(input.name, 200)
  if (!code) return { ok: false, error: 'An entity code is required.' }
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    return { ok: false, error: 'Code may contain only letters, numbers, hyphen and underscore.' }
  }
  if (!name) return { ok: false, error: 'An entity name is required.' }
  const factors = Object.fromEntries(
    RISK_FACTORS.map((f) => [f, intInRange(input[f], 1, 5, 3)])
  ) as Record<RiskFactor, number>
  return {
    ok: true,
    value: {
      code,
      name,
      type: isOneOf(UNIVERSE_TYPES, input.type) ? input.type : 'process',
      description: optStr(input.description),
      owner_id: optUuid(input.ownerId),
      parent_id: optUuid(input.parentId),
      last_audited_at: optDate(input.lastAuditedAt),
      audit_frequency_months: intInRange(input.auditFrequencyMonths, 1, 120, 24),
      status: isOneOf(UNIVERSE_STATUSES, input.status) ? input.status : 'active',
      ...factors,
    },
  }
}

export async function createUniverseEntry(
  input: UniverseInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const v = validateUniverse(input)
  if (!v.ok) return v

  const { data, error } = await ctx.supabase
    .from('audit_universe')
    .insert({ ...v.value, organization_id: ctx.orgId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[audit] createUniverseEntry', error)
    return {
      ok: false,
      error:
        error?.code === '23505'
          ? `An auditable entity with code ${v.value.code} already exists.`
          : 'Could not create the auditable entity.',
    }
  }
  revalidateAudit()
  return { ok: true, data: { id: data.id } }
}

export async function updateUniverseEntry(
  id: string,
  input: UniverseInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid auditable entity.' }
  const v = validateUniverse(input)
  if (!v.ok) return v
  const { error } = await ctx.supabase.from('audit_universe').update(v.value).eq('id', id)
  if (error) {
    console.error('[audit] updateUniverseEntry', error)
    return {
      ok: false,
      error:
        error.code === '23505'
          ? `An auditable entity with code ${v.value.code} already exists.`
          : 'Could not update the auditable entity.',
    }
  }
  revalidateAudit()
  return { ok: true }
}

/** Inline risk-factor scoring from the universe table. */
export async function updateUniverseFactors(
  id: string,
  factors: Partial<Record<RiskFactor, number>>
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid auditable entity.' }

  const patch: TablesUpdate<'audit_universe'> = {}
  for (const f of RISK_FACTORS) {
    const raw = factors[f]
    if (raw === undefined || raw === null) continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      return { ok: false, error: 'Risk factors must be scored between 1 and 5.' }
    }
    patch[f] = Math.round(n)
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'Nothing to update.' }

  const { error } = await ctx.supabase.from('audit_universe').update(patch).eq('id', id)
  if (error) {
    console.error('[audit] updateUniverseFactors', error)
    return { ok: false, error: 'Could not update the risk factors.' }
  }
  revalidateAudit()
  return { ok: true }
}

export async function deleteUniverseEntry(id: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid auditable entity.' }
  const { error } = await ctx.supabase.from('audit_universe').delete().eq('id', id)
  if (error) {
    console.error('[audit] deleteUniverseEntry', error)
    return { ok: false, error: 'Could not delete the entity. Owner or admin role is required.' }
  }
  revalidateAudit()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export type PlanInput = {
  period: string
  totalCapacityDays?: number | null
  status?: string
  notes?: string | null
}

export async function createPlan(input: PlanInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const period = str(input.period, 40)
  if (!period) return { ok: false, error: 'A plan period is required (for example FY2026).' }

  const { data, error } = await ctx.supabase
    .from('audit_plans')
    .insert({
      organization_id: ctx.orgId,
      period,
      total_capacity_days: optNum(input.totalCapacityDays) ?? 0,
      status: isOneOf(PLAN_STATUSES, input.status) ? input.status : 'draft',
      notes: optStr(input.notes),
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[audit] createPlan', error)
    return {
      ok: false,
      error:
        error?.code === '23505'
          ? `A plan already exists for ${period}.`
          : 'Could not create the plan.',
    }
  }
  revalidateAudit(null, data.id)
  return { ok: true, data: { id: data.id } }
}

export async function updatePlan(planId: string, input: PlanInput): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(planId)) return { ok: false, error: 'Invalid plan.' }
  const period = str(input.period, 40)
  if (!period) return { ok: false, error: 'A plan period is required.' }

  const patch: TablesUpdate<'audit_plans'> = {
    period,
    total_capacity_days: optNum(input.totalCapacityDays) ?? 0,
    notes: optStr(input.notes),
  }
  if (isOneOf(PLAN_STATUSES, input.status)) {
    patch.status = input.status
    if (input.status === 'approved') {
      patch.approved_by = ctx.userId
      patch.approved_at = new Date().toISOString()
    }
  }
  const { error } = await ctx.supabase.from('audit_plans').update(patch).eq('id', planId)
  if (error) {
    console.error('[audit] updatePlan', error)
    return { ok: false, error: 'Could not update the plan.' }
  }
  revalidateAudit(null, planId)
  return { ok: true }
}

/**
 * Records audit committee approval of the plan (CMA Corporate Governance
 * Regulations: the audit committee approves the internal audit plan).
 */
export async function approvePlan(planId: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(planId)) return { ok: false, error: 'Invalid plan.' }

  const { data: items, error: itemsError } = await ctx.supabase
    .from('audit_plan_items')
    .select('id')
    .eq('plan_id', planId)
    .neq('status', 'cancelled')
  if (itemsError) console.error('[audit] approvePlan items', itemsError)
  if (!items || items.length === 0) {
    return { ok: false, error: 'Add at least one engagement to the plan before approving it.' }
  }

  const { error } = await ctx.supabase
    .from('audit_plans')
    .update({
      status: 'approved',
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', planId)
  if (error) {
    console.error('[audit] approvePlan', error)
    return { ok: false, error: 'Could not approve the plan.' }
  }
  revalidateAudit(null, planId)
  return { ok: true }
}

export async function deletePlan(planId: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(planId)) return { ok: false, error: 'Invalid plan.' }
  const { error } = await ctx.supabase.from('audit_plans').delete().eq('id', planId)
  if (error) {
    console.error('[audit] deletePlan', error)
    return { ok: false, error: 'Could not delete the plan. Owner or admin role is required.' }
  }
  revalidateAudit()
  return { ok: true }
}

/** Risk-based plan generation from the audit universe (IIA Standard 9.4). */
export async function generatePlanFromUniverse(
  period: string,
  capacityDays: number
): Promise<ActionResult<{ planId: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const p = str(period, 40)
  if (!p) return { ok: false, error: 'A plan period is required (for example FY2026).' }
  const capacity = optNum(capacityDays, 0, 100000)
  if (capacity === null) return { ok: false, error: 'Enter the available capacity in days.' }

  const { data, error } = await ctx.supabase.rpc('create_audit_plan_from_universe', {
    p_period: p,
    p_capacity_days: capacity,
  })
  if (error || !data) {
    console.error('[audit] generatePlanFromUniverse', error)
    return {
      ok: false,
      error: error?.message?.replace(/^.*ERROR:\s*/, '') || 'Could not generate the plan.',
    }
  }
  revalidateAudit(null, data)
  return { ok: true, data: { planId: data } }
}

export type PlanItemInput = {
  universeId?: string | null
  title?: string | null
  quarter?: string
  plannedDays?: number | null
  priority?: string
  rationale?: string | null
  status?: string
}

function validatePlanItem(input: PlanItemInput): Validated<{
  universe_id: string | null
  title: string | null
  quarter: string
  planned_days: number
  priority: string
  rationale: string | null
  status: string
}> {
  const universeId = optUuid(input.universeId)
  const title = optStr(input.title, 200)
  if (!universeId && !title) {
    return { ok: false, error: 'Select an auditable entity or give the engagement a title.' }
  }
  return {
    ok: true,
    value: {
      universe_id: universeId,
      title,
      quarter: isOneOf(QUARTERS, input.quarter) ? input.quarter : 'Q1',
      planned_days: optNum(input.plannedDays, 0, 1000) ?? 10,
      priority: isOneOf(PRIORITIES, input.priority) ? input.priority : 'medium',
      rationale: optStr(input.rationale, 2000),
      status: isOneOf(PLAN_ITEM_STATUSES, input.status) ? input.status : 'planned',
    },
  }
}

export async function createPlanItem(
  planId: string,
  input: PlanItemInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(planId)) return { ok: false, error: 'Invalid plan.' }
  const v = validatePlanItem(input)
  if (!v.ok) return v

  const { data: existing } = await ctx.supabase
    .from('audit_plan_items')
    .select('sort_order')
    .eq('plan_id', planId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const { data, error } = await ctx.supabase
    .from('audit_plan_items')
    .insert({
      ...v.value,
      organization_id: ctx.orgId,
      plan_id: planId,
      sort_order: (existing?.[0]?.sort_order ?? 0) + 10,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[audit] createPlanItem', error)
    return { ok: false, error: 'Could not add the plan item.' }
  }
  revalidateAudit(null, planId)
  return { ok: true, data: { id: data.id } }
}

export async function updatePlanItem(
  itemId: string,
  planId: string,
  input: PlanItemInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(itemId)) return { ok: false, error: 'Invalid plan item.' }
  const v = validatePlanItem(input)
  if (!v.ok) return v
  const { error } = await ctx.supabase.from('audit_plan_items').update(v.value).eq('id', itemId)
  if (error) {
    console.error('[audit] updatePlanItem', error)
    return { ok: false, error: 'Could not update the plan item.' }
  }
  revalidateAudit(null, planId)
  return { ok: true }
}

export async function deletePlanItem(itemId: string, planId: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(itemId)) return { ok: false, error: 'Invalid plan item.' }
  const { error } = await ctx.supabase.from('audit_plan_items').delete().eq('id', itemId)
  if (error) {
    console.error('[audit] deletePlanItem', error)
    return { ok: false, error: 'Could not remove the plan item. Owner or admin role is required.' }
  }
  revalidateAudit(null, planId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Engagements
// ---------------------------------------------------------------------------

export type EngagementInput = {
  code?: string
  title: string
  universeId?: string | null
  planItemId?: string | null
  type?: string
  objective?: string | null
  scope?: string | null
  outOfScope?: string | null
  criteria?: string | null
  leadAuditorId?: string | null
  auditeeOwnerId?: string | null
  startDate?: string | null
  fieldworkStart?: string | null
  fieldworkEnd?: string | null
  reportTargetDate?: string | null
  budgetDays?: number | null
  actualDays?: number | null
  overallRating?: string | null
  executiveSummary?: string | null
  opinion?: string | null
}

function engagementPatch(input: EngagementInput) {
  return {
    title: str(input.title, 200),
    universe_id: optUuid(input.universeId),
    plan_item_id: optUuid(input.planItemId),
    type: isOneOf(ENGAGEMENT_TYPES, input.type) ? input.type : 'assurance',
    objective: optStr(input.objective),
    scope: optStr(input.scope),
    out_of_scope: optStr(input.outOfScope),
    criteria: optStr(input.criteria),
    lead_auditor_id: optUuid(input.leadAuditorId),
    auditee_owner_id: optUuid(input.auditeeOwnerId),
    start_date: optDate(input.startDate),
    fieldwork_start: optDate(input.fieldworkStart),
    fieldwork_end: optDate(input.fieldworkEnd),
    report_target_date: optDate(input.reportTargetDate),
    budget_days: optNum(input.budgetDays, 0, 10000),
    actual_days: optNum(input.actualDays, 0, 10000),
    overall_rating: isOneOf(OVERALL_RATINGS, input.overallRating) ? input.overallRating : null,
    executive_summary: optStr(input.executiveSummary, 20000),
    opinion: optStr(input.opinion, 20000),
  }
}

export async function createEngagement(
  input: EngagementInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const patch = engagementPatch(input)
  if (!patch.title) return { ok: false, error: 'An engagement title is required.' }

  let code = str(input.code, 30).toUpperCase()
  if (!code) {
    const year = new Date().getFullYear()
    const { data: existing } = await ctx.supabase
      .from('audit_engagements')
      .select('code')
      .like('code', `IA-${year}-%`)
    const n =
      (existing ?? []).reduce((max, r) => {
        const m = /-(\d+)$/.exec(r.code)
        return m ? Math.max(max, Number(m[1])) : max
      }, 0) + 1
    code = `IA-${year}-${String(n).padStart(2, '0')}`
  }

  const { data, error } = await ctx.supabase
    .from('audit_engagements')
    .insert({ ...patch, code, organization_id: ctx.orgId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[audit] createEngagement', error)
    return {
      ok: false,
      error:
        error?.code === '23505'
          ? `An engagement with code ${code} already exists.`
          : 'Could not create the engagement.',
    }
  }

  if (patch.plan_item_id) {
    await ctx.supabase
      .from('audit_plan_items')
      .update({ engagement_id: data.id, status: 'scheduled' })
      .eq('id', patch.plan_item_id)
  }

  revalidateAudit(data.id)
  return { ok: true, data: { id: data.id } }
}

export async function updateEngagement(
  engagementId: string,
  input: EngagementInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(engagementId)) return { ok: false, error: 'Invalid engagement.' }
  const patch = engagementPatch(input)
  if (!patch.title) return { ok: false, error: 'An engagement title is required.' }

  const { error } = await ctx.supabase
    .from('audit_engagements')
    .update(patch)
    .eq('id', engagementId)
  if (error) {
    console.error('[audit] updateEngagement', error)
    return { ok: false, error: 'Could not update the engagement.' }
  }
  revalidateAudit(engagementId)
  return { ok: true }
}

export async function deleteEngagement(engagementId: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(engagementId)) return { ok: false, error: 'Invalid engagement.' }
  const { error } = await ctx.supabase
    .from('audit_engagements')
    .delete()
    .eq('id', engagementId)
  if (error) {
    console.error('[audit] deleteEngagement', error)
    return {
      ok: false,
      error: 'Could not delete the engagement. Owner or admin role is required.',
    }
  }
  revalidateAudit()
  return { ok: true }
}

/**
 * Moves an engagement to the next lifecycle stage, enforcing the supervision
 * and reporting gates of the IIA Standards. Returns the blocking reasons rather
 * than advancing when a gate is not met.
 */
export async function advanceEngagementStage(
  engagementId: string,
  targetStatus?: string
): Promise<ActionResult<{ status: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(engagementId)) return { ok: false, error: 'Invalid engagement.' }

  const { data: engagement, error } = await ctx.supabase
    .from('audit_engagements')
    .select('*')
    .eq('id', engagementId)
    .maybeSingle()
  if (error) console.error('[audit] advanceEngagementStage load', error)
  if (!engagement) return { ok: false, error: 'Engagement not found.' }

  const target =
    isOneOf(ENGAGEMENT_STATUSES, targetStatus) && targetStatus !== engagement.status
      ? targetStatus
      : nextEngagementStage(engagement.status)
  if (!target) {
    return { ok: false, error: 'This engagement is already at the final stage.' }
  }
  if (target === 'cancelled') {
    const { error: cancelError } = await ctx.supabase
      .from('audit_engagements')
      .update({ status: 'cancelled' })
      .eq('id', engagementId)
    if (cancelError) return { ok: false, error: 'Could not cancel the engagement.' }
    revalidateAudit(engagementId)
    return { ok: true, data: { status: 'cancelled' } }
  }

  const [procRes, wpRes, obsRes] = await Promise.all([
    ctx.supabase.from('audit_procedures').select('ref, status').eq('engagement_id', engagementId),
    ctx.supabase
      .from('audit_workpapers')
      .select('ref, review_status')
      .eq('engagement_id', engagementId),
    ctx.supabase
      .from('audit_observations')
      .select('id, ref, status, rating, condition, criteria, cause, effect, recommendation, management_response, audit_actions ( id, status )')
      .eq('engagement_id', engagementId),
  ])
  const procedures = procRes.data ?? []
  const workpapers = wpRes.data ?? []
  const observations = obsRes.data ?? []
  const blockers: string[] = []

  if (target === 'fieldwork') {
    if (!engagement.objective) blockers.push('the engagement objective is not documented')
    if (!engagement.scope) blockers.push('the engagement scope is not documented')
    if (procedures.length === 0) blockers.push('the work program has no procedures')
  }

  if (target === 'reporting') {
    const openProcedures = procedures.filter(
      (p) => p.status !== 'complete' && p.status !== 'not_applicable'
    )
    if (procedures.length === 0) blockers.push('the work program has no procedures')
    if (openProcedures.length > 0) {
      blockers.push(
        `${openProcedures.length} procedure(s) are not complete (${openProcedures
          .slice(0, 5)
          .map((p) => p.ref)
          .join(', ')})`
      )
    }
    const unreviewed = workpapers.filter((w) => w.review_status !== 'reviewed')
    if (unreviewed.length > 0) {
      blockers.push(
        `${unreviewed.length} workpaper(s) have not been reviewed (${unreviewed
          .slice(0, 5)
          .map((w) => w.ref)
          .join(', ')})`
      )
    }
  }

  if (target === 'issued') {
    if (!engagement.overall_rating) blockers.push('no overall rating has been concluded')
    if (!engagement.executive_summary) blockers.push('the executive summary is empty')
    if (observations.length === 0) {
      // An engagement with no findings may still be issued.
    }
    for (const o of observations) {
      const actions = Array.isArray(o.audit_actions) ? o.audit_actions : []
      const live = actions.filter((a) => a.status !== 'cancelled')
      if (!o.condition || !o.criteria || !o.cause || !o.effect) {
        blockers.push(`${o.ref} is not fully written up as condition, criteria, cause and effect`)
      }
      if (!o.recommendation) blockers.push(`${o.ref} has no recommendation`)
      if (!o.management_response) blockers.push(`${o.ref} has no management response`)
      if (live.length === 0 && o.status !== 'risk_accepted') {
        blockers.push(`${o.ref} has no agreed management action`)
      }
    }
  }

  if (target === 'closed') {
    const openActions = observations.flatMap((o) =>
      (Array.isArray(o.audit_actions) ? o.audit_actions : []).filter(
        (a) => a.status === 'open' || a.status === 'in_progress' || a.status === 'overdue'
      )
    )
    if (openActions.length > 0) {
      blockers.push(
        `${openActions.length} management action(s) are still outstanding and must be verified, cancelled or formally risk-accepted`
      )
    }
    const unverified = observations.flatMap((o) =>
      (Array.isArray(o.audit_actions) ? o.audit_actions : []).filter(
        (a) => a.status === 'implemented'
      )
    )
    if (unverified.length > 0) {
      blockers.push(`${unverified.length} implemented action(s) await internal audit verification`)
    }
  }

  if (blockers.length > 0) {
    return {
      ok: false,
      error: `Cannot move to ${target.replace('_', ' ')}: ${blockers.join('; ')}.`,
    }
  }

  const patch: TablesUpdate<'audit_engagements'> = { status: target }
  const nowIso = new Date().toISOString()
  if (target === 'issued') {
    patch.report_issued_at = nowIso
  }
  if (target === 'closed') {
    patch.closed_at = nowIso
  }

  const { error: updateError } = await ctx.supabase
    .from('audit_engagements')
    .update(patch)
    .eq('id', engagementId)
  if (updateError) {
    console.error('[audit] advanceEngagementStage update', updateError)
    return { ok: false, error: 'Could not update the engagement stage.' }
  }

  if (target === 'issued') {
    // Findings become live for follow-up; the universe records the coverage.
    await ctx.supabase
      .from('audit_observations')
      .update({ status: 'open', issued_at: nowIso })
      .eq('engagement_id', engagementId)
      .in('status', ['draft', 'issued'])
    if (engagement.universe_id) {
      await ctx.supabase
        .from('audit_universe')
        .update({ last_audited_at: today() })
        .eq('id', engagement.universe_id)
    }
    if (engagement.plan_item_id) {
      await ctx.supabase
        .from('audit_plan_items')
        .update({ status: 'reported' })
        .eq('id', engagement.plan_item_id)
    }
  }
  if (target === 'fieldwork' && engagement.plan_item_id) {
    await ctx.supabase
      .from('audit_plan_items')
      .update({ status: 'in_progress' })
      .eq('id', engagement.plan_item_id)
  }

  revalidateAudit(engagementId)
  return { ok: true, data: { status: target } }
}

/** Appends a global standard work program to the engagement. */
export async function applyProgramTemplate(
  engagementId: string,
  templateCode: string
): Promise<ActionResult<{ inserted: number }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(engagementId)) return { ok: false, error: 'Invalid engagement.' }
  const code = str(templateCode, 30)
  if (!code) return { ok: false, error: 'Select a work program template.' }

  const { data, error } = await ctx.supabase.rpc('create_engagement_from_template', {
    p_engagement_id: engagementId,
    p_template_code: code,
  })
  if (error) {
    console.error('[audit] applyProgramTemplate', error)
    return {
      ok: false,
      error: error.message?.replace(/^.*ERROR:\s*/, '') || 'Could not apply the template.',
    }
  }
  revalidateAudit(engagementId)
  return { ok: true, data: { inserted: Number(data) || 0 } }
}

// ---------------------------------------------------------------------------
// Procedures (work program)
// ---------------------------------------------------------------------------

export type ProcedureInput = {
  ref?: string
  area?: string | null
  objective?: string | null
  procedure: string
  controlRef?: string | null
  assignedTo?: string | null
  status?: string
  conclusion?: string | null
  hours?: number | null
}

export async function createProcedure(
  engagementId: string,
  input: ProcedureInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(engagementId)) return { ok: false, error: 'Invalid engagement.' }
  const procedure = str(input.procedure, 20000)
  if (!procedure) return { ok: false, error: 'Describe the procedure to be performed.' }

  const { data: existing } = await ctx.supabase
    .from('audit_procedures')
    .select('ref, sort_order')
    .eq('engagement_id', engagementId)

  const refs = (existing ?? []).map((p) => p.ref)
  const ref = str(input.ref, 20) || nextRef(refs, 'P')
  if (refs.includes(ref)) return { ok: false, error: `Procedure ${ref} already exists.` }
  const sortOrder = (existing ?? []).reduce((n, p) => Math.max(n, p.sort_order), 0) + 10

  const { data, error } = await ctx.supabase
    .from('audit_procedures')
    .insert({
      organization_id: ctx.orgId,
      engagement_id: engagementId,
      ref,
      area: optStr(input.area, 120),
      objective: optStr(input.objective, 4000),
      procedure,
      control_ref: optStr(input.controlRef, 200),
      assigned_to: optUuid(input.assignedTo),
      status: isOneOf(PROCEDURE_STATUSES, input.status) ? input.status : 'not_started',
      conclusion: optStr(input.conclusion, 8000),
      hours: optNum(input.hours, 0, 10000),
      sort_order: sortOrder,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[audit] createProcedure', error)
    return { ok: false, error: 'Could not add the procedure.' }
  }
  revalidateAudit(engagementId)
  return { ok: true, data: { id: data.id } }
}

export async function updateProcedure(
  procedureId: string,
  engagementId: string,
  input: ProcedureInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(procedureId)) return { ok: false, error: 'Invalid procedure.' }
  const procedure = str(input.procedure, 20000)
  if (!procedure) return { ok: false, error: 'Describe the procedure to be performed.' }

  const patch: TablesUpdate<'audit_procedures'> = {
    area: optStr(input.area, 120),
    objective: optStr(input.objective, 4000),
    procedure,
    control_ref: optStr(input.controlRef, 200),
    assigned_to: optUuid(input.assignedTo),
    status: isOneOf(PROCEDURE_STATUSES, input.status) ? input.status : 'not_started',
    conclusion: optStr(input.conclusion, 8000),
    hours: optNum(input.hours, 0, 10000),
  }
  const ref = str(input.ref, 20)
  if (ref) patch.ref = ref

  const { error } = await ctx.supabase
    .from('audit_procedures')
    .update(patch)
    .eq('id', procedureId)
  if (error) {
    console.error('[audit] updateProcedure', error)
    return {
      ok: false,
      error: error.code === '23505' ? 'That procedure reference is already in use.' : 'Could not update the procedure.',
    }
  }
  revalidateAudit(engagementId)
  return { ok: true }
}

export async function deleteProcedure(
  procedureId: string,
  engagementId: string
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(procedureId)) return { ok: false, error: 'Invalid procedure.' }
  const { error } = await ctx.supabase.from('audit_procedures').delete().eq('id', procedureId)
  if (error) {
    console.error('[audit] deleteProcedure', error)
    return { ok: false, error: 'Could not delete the procedure. Owner or admin role is required.' }
  }
  revalidateAudit(engagementId)
  return { ok: true }
}

/** Bulk insert used by the AI work-program drafter. */
export async function addProceduresFromDraft(
  engagementId: string,
  steps: { area?: string | null; objective?: string | null; procedure: string; controlRef?: string | null }[]
): Promise<ActionResult<{ inserted: number }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(engagementId)) return { ok: false, error: 'Invalid engagement.' }
  if (!Array.isArray(steps) || steps.length === 0) {
    return { ok: false, error: 'No procedures to add.' }
  }

  const { data: existing } = await ctx.supabase
    .from('audit_procedures')
    .select('ref, sort_order')
    .eq('engagement_id', engagementId)
  const refs = (existing ?? []).map((p) => p.ref)
  let sortOrder = (existing ?? []).reduce((n, p) => Math.max(n, p.sort_order), 0)

  const rows = steps
    .filter((s) => str(s.procedure, 20000).length > 0)
    .slice(0, 60)
    .map((s) => {
      const ref = nextRef(refs, 'P')
      refs.push(ref)
      sortOrder += 10
      return {
        organization_id: ctx.orgId,
        engagement_id: engagementId,
        ref,
        area: optStr(s.area, 120),
        objective: optStr(s.objective, 4000),
        procedure: str(s.procedure, 20000),
        control_ref: optStr(s.controlRef, 200),
        sort_order: sortOrder,
      }
    })
  if (rows.length === 0) return { ok: false, error: 'No procedures to add.' }

  const { error } = await ctx.supabase.from('audit_procedures').insert(rows)
  if (error) {
    console.error('[audit] addProceduresFromDraft', error)
    return { ok: false, error: 'Could not add the drafted procedures.' }
  }
  revalidateAudit(engagementId)
  return { ok: true, data: { inserted: rows.length } }
}

// ---------------------------------------------------------------------------
// Workpapers
// ---------------------------------------------------------------------------

export type WorkpaperInput = {
  ref?: string
  title: string
  description?: string | null
  kind?: string
  procedureId?: string | null
  evidenceId?: string | null
  reviewNotes?: string | null
}

export async function createWorkpaper(
  engagementId: string,
  input: WorkpaperInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(engagementId)) return { ok: false, error: 'Invalid engagement.' }
  const title = str(input.title, 200)
  if (!title) return { ok: false, error: 'A workpaper title is required.' }

  const { data: existing } = await ctx.supabase
    .from('audit_workpapers')
    .select('ref')
    .eq('engagement_id', engagementId)
  const refs = (existing ?? []).map((w) => w.ref)
  const ref = str(input.ref, 20) || nextRef(refs, 'WP')
  if (refs.includes(ref)) return { ok: false, error: `Workpaper ${ref} already exists.` }

  const { data, error } = await ctx.supabase
    .from('audit_workpapers')
    .insert({
      organization_id: ctx.orgId,
      engagement_id: engagementId,
      procedure_id: optUuid(input.procedureId),
      ref,
      title,
      description: optStr(input.description, 20000),
      kind: isOneOf(WORKPAPER_KINDS, input.kind) ? input.kind : 'document',
      evidence_id: optUuid(input.evidenceId),
      review_notes: optStr(input.reviewNotes, 8000),
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[audit] createWorkpaper', error)
    return { ok: false, error: 'Could not add the workpaper.' }
  }
  revalidateAudit(engagementId)
  return { ok: true, data: { id: data.id } }
}

export async function updateWorkpaper(
  workpaperId: string,
  engagementId: string,
  input: WorkpaperInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(workpaperId)) return { ok: false, error: 'Invalid workpaper.' }
  const title = str(input.title, 200)
  if (!title) return { ok: false, error: 'A workpaper title is required.' }

  const patch: TablesUpdate<'audit_workpapers'> = {
    title,
    description: optStr(input.description, 20000),
    kind: isOneOf(WORKPAPER_KINDS, input.kind) ? input.kind : 'document',
    procedure_id: optUuid(input.procedureId),
    evidence_id: optUuid(input.evidenceId),
    review_notes: optStr(input.reviewNotes, 8000),
  }
  const ref = str(input.ref, 20)
  if (ref) patch.ref = ref

  const { error } = await ctx.supabase
    .from('audit_workpapers')
    .update(patch)
    .eq('id', workpaperId)
  if (error) {
    console.error('[audit] updateWorkpaper', error)
    return {
      ok: false,
      error: error.code === '23505' ? 'That workpaper reference is already in use.' : 'Could not update the workpaper.',
    }
  }
  revalidateAudit(engagementId)
  return { ok: true }
}

export async function deleteWorkpaper(
  workpaperId: string,
  engagementId: string
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(workpaperId)) return { ok: false, error: 'Invalid workpaper.' }
  const { error } = await ctx.supabase.from('audit_workpapers').delete().eq('id', workpaperId)
  if (error) {
    console.error('[audit] deleteWorkpaper', error)
    return { ok: false, error: 'Could not delete the workpaper. Owner or admin role is required.' }
  }
  revalidateAudit(engagementId)
  return { ok: true }
}

/**
 * Preparer and reviewer sign-off (IIA Standards 12.3 and 13.6). The reviewer
 * must be a different person from the preparer, and review can only follow
 * preparation.
 */
export async function signOffWorkpaper(
  workpaperId: string,
  engagementId: string,
  role: 'prepare' | 'review' | 'reopen',
  notes?: string | null
): Promise<ActionResult<{ reviewStatus: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(workpaperId)) return { ok: false, error: 'Invalid workpaper.' }
  if (role !== 'prepare' && role !== 'review' && role !== 'reopen') {
    return { ok: false, error: 'Invalid sign-off action.' }
  }

  const { data: wp, error: loadError } = await ctx.supabase
    .from('audit_workpapers')
    .select('id, prepared_by, review_status')
    .eq('id', workpaperId)
    .maybeSingle()
  if (loadError) console.error('[audit] signOffWorkpaper load', loadError)
  if (!wp) return { ok: false, error: 'Workpaper not found.' }

  const nowIso = new Date().toISOString()
  let patch: TablesUpdate<'audit_workpapers'>

  if (role === 'prepare') {
    patch = {
      prepared_by: ctx.userId,
      prepared_at: nowIso,
      review_status: 'prepared',
      reviewed_by: null,
      reviewed_at: null,
    }
  } else if (role === 'review') {
    if (wp.review_status !== 'prepared' && wp.review_status !== 'reopened') {
      return {
        ok: false,
        error: 'The workpaper must be signed off by the preparer before it can be reviewed.',
      }
    }
    if (wp.prepared_by && wp.prepared_by === ctx.userId) {
      return {
        ok: false,
        error: 'The reviewer must be independent of the preparer. Ask another team member to review.',
      }
    }
    patch = {
      reviewed_by: ctx.userId,
      reviewed_at: nowIso,
      review_status: 'reviewed',
      review_notes: optStr(notes, 8000),
    }
  } else {
    patch = {
      review_status: 'reopened',
      reviewed_by: null,
      reviewed_at: null,
      review_notes: optStr(notes, 8000),
    }
  }

  const { error } = await ctx.supabase
    .from('audit_workpapers')
    .update(patch)
    .eq('id', workpaperId)
  if (error) {
    console.error('[audit] signOffWorkpaper', error)
    return { ok: false, error: 'Could not record the sign-off.' }
  }
  revalidateAudit(engagementId)
  return { ok: true, data: { reviewStatus: String(patch.review_status) } }
}

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------

export type ObservationInput = {
  ref?: string
  title: string
  condition?: string | null
  criteria?: string | null
  cause?: string | null
  effect?: string | null
  recommendation?: string | null
  rating?: string
  category?: string
  repeatFinding?: boolean
  managementResponse?: string | null
  agreed?: boolean | null
  status?: string
  libraryControlId?: string | null
  icfrControlId?: string | null
}

function observationPatch(input: ObservationInput) {
  return {
    title: str(input.title, 300),
    condition: optStr(input.condition, 20000),
    criteria: optStr(input.criteria, 20000),
    cause: optStr(input.cause, 20000),
    effect: optStr(input.effect, 20000),
    recommendation: optStr(input.recommendation, 20000),
    rating: isOneOf(OBSERVATION_RATINGS, input.rating) ? input.rating : 'medium',
    category: isOneOf(OBSERVATION_CATEGORIES, input.category) ? input.category : 'control_operation',
    repeat_finding: Boolean(input.repeatFinding),
    management_response: optStr(input.managementResponse, 20000),
    agreed: typeof input.agreed === 'boolean' ? input.agreed : null,
    library_control_id: optUuid(input.libraryControlId),
    icfr_control_id: optUuid(input.icfrControlId),
  }
}

export async function createObservation(
  engagementId: string,
  input: ObservationInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(engagementId)) return { ok: false, error: 'Invalid engagement.' }
  const patch = observationPatch(input)
  if (!patch.title) return { ok: false, error: 'An observation title is required.' }
  if (!patch.condition) return { ok: false, error: 'The condition (what was found) is required.' }

  const { data: existing } = await ctx.supabase
    .from('audit_observations')
    .select('ref')
    .eq('engagement_id', engagementId)
  const refs = (existing ?? []).map((o) => o.ref)
  const ref = str(input.ref, 20) || nextRef(refs, 'OBS')
  if (refs.includes(ref)) return { ok: false, error: `Observation ${ref} already exists.` }

  const { data, error } = await ctx.supabase
    .from('audit_observations')
    .insert({
      ...patch,
      organization_id: ctx.orgId,
      engagement_id: engagementId,
      ref,
      status: isOneOf(OBSERVATION_STATUSES, input.status) ? input.status : 'draft',
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[audit] createObservation', error)
    return { ok: false, error: 'Could not add the observation.' }
  }
  revalidateAudit(engagementId)
  return { ok: true, data: { id: data.id } }
}

export async function updateObservation(
  observationId: string,
  engagementId: string,
  input: ObservationInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(observationId)) return { ok: false, error: 'Invalid observation.' }
  const patch: TablesUpdate<'audit_observations'> = { ...observationPatch(input) }
  if (!patch.title) return { ok: false, error: 'An observation title is required.' }
  if (!patch.condition) return { ok: false, error: 'The condition (what was found) is required.' }

  const ref = str(input.ref, 20)
  if (ref) patch.ref = ref
  if (isOneOf(OBSERVATION_STATUSES, input.status)) {
    patch.status = input.status
    if (input.status === 'closed') patch.closed_at = new Date().toISOString()
  }

  const { error } = await ctx.supabase
    .from('audit_observations')
    .update(patch)
    .eq('id', observationId)
  if (error) {
    console.error('[audit] updateObservation', error)
    return {
      ok: false,
      error: error.code === '23505' ? 'That observation reference is already in use.' : 'Could not update the observation.',
    }
  }
  revalidateAudit(engagementId)
  return { ok: true }
}

export async function deleteObservation(
  observationId: string,
  engagementId: string
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(observationId)) return { ok: false, error: 'Invalid observation.' }
  const { error } = await ctx.supabase
    .from('audit_observations')
    .delete()
    .eq('id', observationId)
  if (error) {
    console.error('[audit] deleteObservation', error)
    return {
      ok: false,
      error: 'Could not delete the observation. Owner or admin role is required.',
    }
  }
  revalidateAudit(engagementId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Management actions
// ---------------------------------------------------------------------------

export type AuditActionInput = {
  description: string
  ownerId?: string | null
  dueDate?: string | null
  revisedDueDate?: string | null
  status?: string
  implementedAt?: string | null
  verificationNotes?: string | null
  evidenceId?: string | null
}

export async function createAuditAction(
  observationId: string,
  engagementId: string,
  input: AuditActionInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(observationId)) return { ok: false, error: 'Invalid observation.' }
  const description = str(input.description, 20000)
  if (!description) return { ok: false, error: 'Describe the management action.' }

  let dueDate = optDate(input.dueDate)
  if (!dueDate) {
    const { data: obs } = await ctx.supabase
      .from('audit_observations')
      .select('rating')
      .eq('id', observationId)
      .maybeSingle()
    const rating = (obs?.rating ?? 'medium') as ObservationRating
    dueDate = addDays(OBSERVATION_RATING_TARGET_DAYS[rating] ?? 90)
  }

  const { data, error } = await ctx.supabase
    .from('audit_actions')
    .insert({
      organization_id: ctx.orgId,
      observation_id: observationId,
      description,
      owner_id: optUuid(input.ownerId),
      due_date: dueDate,
      status: isOneOf(ACTION_STATUSES, input.status) ? input.status : 'open',
      evidence_id: optUuid(input.evidenceId),
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[audit] createAuditAction', error)
    return { ok: false, error: 'Could not add the management action.' }
  }
  revalidateAudit(engagementId)
  return { ok: true, data: { id: data.id } }
}

export async function updateAuditAction(
  actionId: string,
  engagementId: string | null,
  input: AuditActionInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(actionId)) return { ok: false, error: 'Invalid management action.' }
  const description = str(input.description, 20000)
  if (!description) return { ok: false, error: 'Describe the management action.' }

  const { data: current } = await ctx.supabase
    .from('audit_actions')
    .select('revised_due_date, due_date, extension_count')
    .eq('id', actionId)
    .maybeSingle()

  const revised = optDate(input.revisedDueDate)
  const patch: TablesUpdate<'audit_actions'> = {
    description,
    owner_id: optUuid(input.ownerId),
    due_date: optDate(input.dueDate),
    revised_due_date: revised,
    implemented_at: optDate(input.implementedAt),
    verification_notes: optStr(input.verificationNotes, 8000),
    evidence_id: optUuid(input.evidenceId),
  }
  if (isOneOf(ACTION_STATUSES, input.status)) patch.status = input.status

  // Every revised due date is a tracked extension — the audit committee needs
  // visibility of repeatedly deferred actions.
  if (current && revised && revised !== current.revised_due_date) {
    patch.extension_count = (current.extension_count ?? 0) + 1
  }

  const { error } = await ctx.supabase.from('audit_actions').update(patch).eq('id', actionId)
  if (error) {
    console.error('[audit] updateAuditAction', error)
    return { ok: false, error: 'Could not update the management action.' }
  }
  revalidateAudit(engagementId)
  return { ok: true }
}

export async function deleteAuditAction(
  actionId: string,
  engagementId: string | null
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(actionId)) return { ok: false, error: 'Invalid management action.' }
  const { error } = await ctx.supabase.from('audit_actions').delete().eq('id', actionId)
  if (error) {
    console.error('[audit] deleteAuditAction', error)
    return { ok: false, error: 'Could not delete the action. Owner or admin role is required.' }
  }
  revalidateAudit(engagementId)
  return { ok: true }
}

/** Management asserts the action is implemented and awaits audit verification. */
export async function markActionImplemented(
  actionId: string,
  engagementId: string | null,
  implementedAt?: string | null
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(actionId)) return { ok: false, error: 'Invalid management action.' }
  const { error } = await ctx.supabase
    .from('audit_actions')
    .update({ status: 'implemented', implemented_at: optDate(implementedAt) ?? today() })
    .eq('id', actionId)
  if (error) {
    console.error('[audit] markActionImplemented', error)
    return { ok: false, error: 'Could not record implementation.' }
  }
  revalidateAudit(engagementId)
  return { ok: true }
}

/**
 * Internal audit verifies the implemented action and closes it. Closing the
 * last open action on an observation closes the observation as well
 * (IIA Standard 15.2 — monitoring management action plans).
 */
export async function verifyAndCloseAction(
  actionId: string,
  engagementId: string | null,
  verificationNotes: string
): Promise<ActionResult<{ observationClosed: boolean }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(actionId)) return { ok: false, error: 'Invalid management action.' }
  const notes = str(verificationNotes, 8000)
  if (!notes) {
    return {
      ok: false,
      error: 'Record what was tested to verify the action before closing it.',
    }
  }

  const { data: action, error: loadError } = await ctx.supabase
    .from('audit_actions')
    .select('id, observation_id, status, implemented_at')
    .eq('id', actionId)
    .maybeSingle()
  if (loadError) console.error('[audit] verifyAndCloseAction load', loadError)
  if (!action) return { ok: false, error: 'Management action not found.' }
  if (action.status === 'verified') {
    return { ok: false, error: 'This action has already been verified.' }
  }
  if (action.status === 'cancelled') {
    return { ok: false, error: 'A cancelled action cannot be verified.' }
  }

  const nowIso = new Date().toISOString()
  const { error } = await ctx.supabase
    .from('audit_actions')
    .update({
      status: 'verified',
      implemented_at: action.implemented_at ?? today(),
      verified_by: ctx.userId,
      verified_at: nowIso,
      verification_notes: notes,
    })
    .eq('id', actionId)
  if (error) {
    console.error('[audit] verifyAndCloseAction', error)
    return { ok: false, error: 'Could not verify the action.' }
  }

  const { data: siblings } = await ctx.supabase
    .from('audit_actions')
    .select('id, status')
    .eq('observation_id', action.observation_id)
  const stillOpen = (siblings ?? []).filter(
    (a) => a.status !== 'verified' && a.status !== 'cancelled'
  )
  let observationClosed = false
  if (stillOpen.length === 0) {
    const { error: obsError } = await ctx.supabase
      .from('audit_observations')
      .update({ status: 'closed', closed_at: nowIso })
      .eq('id', action.observation_id)
    if (obsError) console.error('[audit] verifyAndCloseAction observation', obsError)
    else observationClosed = true
  }

  revalidateAudit(engagementId)
  return { ok: true, data: { observationClosed } }
}

/** Recomputes overdue status across the org — used by the follow-up register. */
export async function refreshOverdueActions(): Promise<ActionResult<{ updated: number }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const t = today()

  const { data: rows, error } = await ctx.supabase
    .from('audit_actions')
    .select('id, status, due_date, revised_due_date')
    .in('status', ['open', 'in_progress', 'overdue'])
  if (error) {
    console.error('[audit] refreshOverdueActions', error)
    return { ok: false, error: 'Could not refresh the follow-up register.' }
  }

  const nowOverdue = (rows ?? []).filter((a) => {
    const due = a.revised_due_date ?? a.due_date
    return a.status !== 'overdue' && !!due && due < t
  })
  const noLongerOverdue = (rows ?? []).filter((a) => {
    const due = a.revised_due_date ?? a.due_date
    return a.status === 'overdue' && (!due || due >= t)
  })

  if (nowOverdue.length > 0) {
    await ctx.supabase
      .from('audit_actions')
      .update({ status: 'overdue' })
      .in(
        'id',
        nowOverdue.map((a) => a.id)
      )
  }
  if (noLongerOverdue.length > 0) {
    await ctx.supabase
      .from('audit_actions')
      .update({ status: 'in_progress' })
      .in(
        'id',
        noLongerOverdue.map((a) => a.id)
      )
  }

  revalidateAudit()
  return { ok: true, data: { updated: nowOverdue.length + noLongerOverdue.length } }
}
