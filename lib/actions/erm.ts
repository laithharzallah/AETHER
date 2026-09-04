'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/lib/database.types'
import {
  APPETITE_LEVELS,
  CONTROL_TYPES,
  KRI_DIRECTIONS,
  KRI_FREQUENCIES,
  LINK_KINDS,
  RISK_SOURCES,
  RISK_STATUSES,
  RISK_TRENDS,
  TREATMENT_STATUSES,
  TREATMENT_STRATEGIES,
  isOneOf,
} from '@/lib/erm/constants'

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

function str(v: unknown, max = 4000): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
function optStr(v: unknown, max = 4000): string | null {
  const s = str(v, max)
  return s.length ? s : null
}
function optInt(v: unknown, min = 0, max = 1_000_000): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  const i = Math.round(n)
  if (i < min || i > max) return null
  return i
}
function optScale(v: unknown): number | null {
  return optInt(v, 1, 5)
}
function optNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
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

function revalidateErm(riskId?: string | null) {
  revalidatePath('/dashboard/erm')
  revalidatePath('/dashboard/erm/risks')
  revalidatePath('/dashboard/erm/appetite')
  revalidatePath('/dashboard/erm/kris')
  revalidatePath('/dashboard/erm/taxonomy')
  if (riskId) revalidatePath(`/dashboard/erm/risks/${riskId}`)
}

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export async function importTaxonomy(): Promise<ActionResult<{ inserted: number }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }

  const { data, error } = await ctx.supabase.rpc('import_erm_taxonomy')
  if (error) {
    console.error('[erm] importTaxonomy', error)
    return { ok: false, error: 'Could not import the risk taxonomy.' }
  }
  revalidateErm()
  return { ok: true, data: { inserted: Number(data ?? 0) } }
}

export type CategoryInput = {
  code: string
  nameEn: string
  nameAr?: string | null
  parentId?: string | null
  description?: string | null
  sortOrder?: number | null
}

function validateCategory(
  input: CategoryInput
): Validated<Omit<TablesInsert<'erm_categories'>, 'organization_id' | 'id'>> {
  const code = str(input.code, 40).toUpperCase()
  const nameEn = str(input.nameEn, 200)
  if (!code) return { ok: false, error: 'A category code is required.' }
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    return {
      ok: false,
      error: 'Code may contain only letters, numbers, hyphen and underscore.',
    }
  }
  if (!nameEn) return { ok: false, error: 'An English category name is required.' }
  const parentId = optUuid(input.parentId)
  return {
    ok: true,
    value: {
      code,
      name_en: nameEn,
      name_ar: optStr(input.nameAr, 200),
      parent_id: parentId,
      level: parentId ? 2 : 1,
      description: optStr(input.description, 1000),
      sort_order: optInt(input.sortOrder, 0, 10_000) ?? 0,
    },
  }
}

export async function createCategory(
  input: CategoryInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const v = validateCategory(input)
  if (!v.ok) return v

  const { data, error } = await ctx.supabase
    .from('erm_categories')
    .insert({ ...v.value, organization_id: ctx.orgId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[erm] createCategory', error)
    return {
      ok: false,
      error: error?.code === '23505' ? 'That category code is already in use.' : 'Could not create the category.',
    }
  }
  revalidateErm()
  return { ok: true, data: { id: data.id } }
}

export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid category.' }
  const v = validateCategory(input)
  if (!v.ok) return v
  if (v.value.parent_id === id) {
    return { ok: false, error: 'A category cannot be its own parent.' }
  }

  const { error } = await ctx.supabase.from('erm_categories').update(v.value).eq('id', id)
  if (error) {
    console.error('[erm] updateCategory', error)
    return { ok: false, error: 'Could not update the category.' }
  }
  revalidateErm()
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid category.' }
  const { error } = await ctx.supabase.from('erm_categories').delete().eq('id', id)
  if (error) {
    console.error('[erm] deleteCategory', error)
    return { ok: false, error: 'Could not delete the category. Owner or admin role required.' }
  }
  revalidateErm()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Appetite
// ---------------------------------------------------------------------------

export type AppetiteInput = {
  categoryId?: string | null
  statementEn: string
  statementAr?: string | null
  appetiteLevel: string
  toleranceThreshold: number
  reviewDate?: string | null
  approve?: boolean
}

export async function saveAppetite(
  input: AppetiteInput,
  id?: string | null
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }

  const statement = str(input.statementEn, 4000)
  if (!statement) return { ok: false, error: 'An appetite statement is required.' }
  if (!isOneOf(APPETITE_LEVELS, input.appetiteLevel)) {
    return { ok: false, error: 'Select a valid appetite level.' }
  }
  const tolerance = optInt(input.toleranceThreshold, 1, 25)
  if (tolerance === null) {
    return { ok: false, error: 'Tolerance threshold must be a residual score between 1 and 25.' }
  }

  const row = {
    organization_id: ctx.orgId,
    category_id: optUuid(input.categoryId),
    statement_en: statement,
    statement_ar: optStr(input.statementAr, 4000),
    appetite_level: input.appetiteLevel,
    tolerance_threshold: tolerance,
    review_date: optDate(input.reviewDate),
    ...(input.approve
      ? { approved_by: ctx.userId, approved_at: new Date().toISOString() }
      : {}),
  }

  if (isUuid(id)) {
    const { error } = await ctx.supabase.from('erm_appetite').update(row).eq('id', id)
    if (error) {
      console.error('[erm] saveAppetite update', error)
      return { ok: false, error: 'Could not update the appetite statement. Owner or admin role required.' }
    }
    revalidateErm()
    return { ok: true, data: { id } }
  }

  const { data, error } = await ctx.supabase
    .from('erm_appetite')
    .insert(row)
    .select('id')
    .single()
  if (error || !data) {
    console.error('[erm] saveAppetite insert', error)
    return {
      ok: false,
      error:
        error?.code === '23505'
          ? 'An appetite statement already exists for that category.'
          : 'Could not save the appetite statement. Owner or admin role required.',
    }
  }
  revalidateErm()
  return { ok: true, data: { id: data.id } }
}

export async function deleteAppetite(id: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid appetite statement.' }
  const { error } = await ctx.supabase.from('erm_appetite').delete().eq('id', id)
  if (error) {
    console.error('[erm] deleteAppetite', error)
    return { ok: false, error: 'Could not delete the statement. Owner or admin role required.' }
  }
  revalidateErm()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Risks
// ---------------------------------------------------------------------------

export type RiskInput = {
  title: string
  description?: string | null
  causes?: string | null
  consequences?: string | null
  categoryId?: string | null
  ownerId?: string | null
  sponsorId?: string | null
  source?: string
  status?: string
  inherentLikelihood?: number | null
  inherentImpact?: number | null
  residualLikelihood?: number | null
  residualImpact?: number | null
  targetLikelihood?: number | null
  targetImpact?: number | null
  velocity?: number | null
  trend?: string
  emerging?: boolean
  nextReviewAt?: string | null
  impactDimensions?: Record<string, number> | null
  workspaceId?: string | null
}

type RiskRow = Omit<TablesInsert<'erm_risks'>, 'organization_id' | 'id' | 'code'>

function validateRisk(input: RiskInput): Validated<RiskRow> {
  const title = str(input.title, 300)
  if (!title) return { ok: false, error: 'A risk title is required.' }

  const source = isOneOf(RISK_SOURCES, input.source) ? input.source : 'workshop'
  const status = isOneOf(RISK_STATUSES, input.status) ? input.status : 'identified'
  const trend = isOneOf(RISK_TRENDS, input.trend) ? input.trend : 'stable'

  const inherentL = optScale(input.inherentLikelihood)
  const inherentI = optScale(input.inherentImpact)
  const residualL = optScale(input.residualLikelihood)
  const residualI = optScale(input.residualImpact)

  if (inherentL !== null && inherentI !== null && residualL !== null && residualI !== null) {
    if (residualL * residualI > inherentL * inherentI) {
      return {
        ok: false,
        error:
          'Residual risk cannot exceed inherent risk. Controls reduce exposure; if the residual is higher, revisit the inherent assessment.',
      }
    }
  }

  const dims: Record<string, number> = {}
  for (const [k, v] of Object.entries(input.impactDimensions ?? {})) {
    const n = optScale(v)
    if (n !== null) dims[k] = n
  }

  return {
    ok: true,
    value: {
      title,
      description: optStr(input.description),
      causes: optStr(input.causes),
      consequences: optStr(input.consequences),
      category_id: optUuid(input.categoryId),
      owner_id: optUuid(input.ownerId),
      sponsor_id: optUuid(input.sponsorId),
      source,
      status,
      inherent_likelihood: inherentL,
      inherent_impact: inherentI,
      residual_likelihood: residualL,
      residual_impact: residualI,
      target_likelihood: optScale(input.targetLikelihood),
      target_impact: optScale(input.targetImpact),
      velocity: optScale(input.velocity),
      trend,
      emerging: Boolean(input.emerging),
      next_review_at: optDate(input.nextReviewAt),
      impact_dimensions: dims,
      client_workspace_id: optUuid(input.workspaceId),
    },
  }
}

export async function createRisk(
  input: RiskInput
): Promise<ActionResult<{ id: string; code: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const v = validateRisk(input)
  if (!v.ok) return v

  const { data, error } = await ctx.supabase
    .from('erm_risks')
    .insert({ ...v.value, organization_id: ctx.orgId })
    .select('id, code')
    .single()
  if (error || !data) {
    console.error('[erm] createRisk', error)
    return { ok: false, error: 'Could not create the risk.' }
  }
  revalidateErm(data.id)
  return { ok: true, data: { id: data.id, code: data.code } }
}

export async function updateRisk(id: string, input: RiskInput): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid risk.' }
  const v = validateRisk(input)
  if (!v.ok) return v

  const { error } = await ctx.supabase.from('erm_risks').update(v.value).eq('id', id)
  if (error) {
    console.error('[erm] updateRisk', error)
    return { ok: false, error: 'Could not update the risk.' }
  }
  revalidateErm(id)
  return { ok: true }
}

export async function deleteRisk(id: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid risk.' }
  const { error } = await ctx.supabase.from('erm_risks').delete().eq('id', id)
  if (error) {
    console.error('[erm] deleteRisk', error)
    return { ok: false, error: 'Could not delete the risk. Owner or admin role required.' }
  }
  revalidateErm()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

export type AssessmentInput = {
  riskId: string
  inherentLikelihood: number
  inherentImpact: number
  residualLikelihood: number
  residualImpact: number
  rationale?: string | null
  velocity?: number | null
  trend?: string | null
  targetLikelihood?: number | null
  targetImpact?: number | null
  impactDimensions?: Record<string, number> | null
}

/**
 * Records a risk assessment. erm_assess_risk() updates the scores and writes an
 * immutable snapshot to erm_assessments in the same transaction, so the score
 * history and the register can never disagree.
 */
export async function assessRisk(input: AssessmentInput): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(input.riskId)) return { ok: false, error: 'Invalid risk.' }

  const il = optScale(input.inherentLikelihood)
  const ii = optScale(input.inherentImpact)
  const rl = optScale(input.residualLikelihood)
  const ri = optScale(input.residualImpact)
  if (il === null || ii === null || rl === null || ri === null) {
    return { ok: false, error: 'Inherent and residual likelihood and impact must each be 1–5.' }
  }
  if (rl * ri > il * ii) {
    return {
      ok: false,
      error: 'Residual risk cannot exceed inherent risk.',
    }
  }
  const trend = isOneOf(RISK_TRENDS, input.trend ?? undefined) ? input.trend : null

  const dims: Record<string, number> = {}
  for (const [k, v] of Object.entries(input.impactDimensions ?? {})) {
    const n = optScale(v)
    if (n !== null) dims[k] = n
  }

  const { error } = await ctx.supabase.rpc('erm_assess_risk', {
    p_risk_id: input.riskId,
    p_inherent_l: il,
    p_inherent_i: ii,
    p_residual_l: rl,
    p_residual_i: ri,
    p_rationale: optStr(input.rationale, 4000),
    p_velocity: optScale(input.velocity),
    p_trend: trend,
    p_target_l: optScale(input.targetLikelihood),
    p_target_i: optScale(input.targetImpact),
    p_impact_dimensions: Object.keys(dims).length ? dims : null,
  })
  if (error) {
    console.error('[erm] assessRisk', error)
    return { ok: false, error: 'Could not record the assessment.' }
  }
  revalidateErm(input.riskId)
  return { ok: true }
}

/**
 * Bulk re-assessment — used for a periodic review cycle where a set of risks is
 * re-affirmed or re-scored together. Each risk is written through
 * erm_assess_risk() so every one gets its own snapshot.
 */
export async function bulkReassess(
  items: AssessmentInput[],
  rationale?: string | null
): Promise<ActionResult<{ assessed: number; failed: number }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Select at least one risk to re-assess.' }
  }
  if (items.length > 200) {
    return { ok: false, error: 'Re-assess at most 200 risks at a time.' }
  }

  const shared = optStr(rationale, 4000)
  let assessed = 0
  let failed = 0

  for (const item of items) {
    const result = await assessRisk({
      ...item,
      rationale: item.rationale ?? shared,
    })
    if (result.ok) assessed += 1
    else failed += 1
  }

  revalidateErm()
  if (assessed === 0) {
    return { ok: false, error: 'No risks could be re-assessed. Check the scores entered.' }
  }
  return { ok: true, data: { assessed, failed } }
}

// ---------------------------------------------------------------------------
// Treatments
// ---------------------------------------------------------------------------

export type TreatmentInput = {
  riskId: string
  strategy: string
  title: string
  description?: string | null
  ownerId?: string | null
  dueDate?: string | null
  status?: string
  costEstimate?: number | null
  expectedResidualLikelihood?: number | null
  expectedResidualImpact?: number | null
}

function validateTreatment(
  input: TreatmentInput
): Validated<Omit<TablesInsert<'erm_treatments'>, 'organization_id' | 'id' | 'risk_id'>> {
  const title = str(input.title, 300)
  if (!title) return { ok: false, error: 'A treatment title is required.' }
  if (!isOneOf(TREATMENT_STRATEGIES, input.strategy)) {
    return { ok: false, error: 'Select a valid treatment strategy.' }
  }
  const status = isOneOf(TREATMENT_STATUSES, input.status) ? input.status : 'planned'
  const cost = optNum(input.costEstimate)
  if (cost !== null && cost < 0) {
    return { ok: false, error: 'Cost estimate cannot be negative.' }
  }
  return {
    ok: true,
    value: {
      strategy: input.strategy,
      title,
      description: optStr(input.description),
      owner_id: optUuid(input.ownerId),
      due_date: optDate(input.dueDate),
      status,
      cost_estimate: cost,
      expected_residual_likelihood: optScale(input.expectedResidualLikelihood),
      expected_residual_impact: optScale(input.expectedResidualImpact),
      completed_at: status === 'complete' ? new Date().toISOString() : null,
    },
  }
}

export async function createTreatment(
  input: TreatmentInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(input.riskId)) return { ok: false, error: 'Invalid risk.' }
  const v = validateTreatment(input)
  if (!v.ok) return v

  const { data, error } = await ctx.supabase
    .from('erm_treatments')
    .insert({ ...v.value, risk_id: input.riskId, organization_id: ctx.orgId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[erm] createTreatment', error)
    return { ok: false, error: 'Could not create the treatment plan.' }
  }
  revalidateErm(input.riskId)
  return { ok: true, data: { id: data.id } }
}

export async function updateTreatment(
  id: string,
  input: TreatmentInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid treatment.' }
  const v = validateTreatment(input)
  if (!v.ok) return v

  const { error } = await ctx.supabase.from('erm_treatments').update(v.value).eq('id', id)
  if (error) {
    console.error('[erm] updateTreatment', error)
    return { ok: false, error: 'Could not update the treatment plan.' }
  }
  revalidateErm(input.riskId)
  return { ok: true }
}

export async function deleteTreatment(
  id: string,
  riskId?: string
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid treatment.' }
  const { error } = await ctx.supabase.from('erm_treatments').delete().eq('id', id)
  if (error) {
    console.error('[erm] deleteTreatment', error)
    return { ok: false, error: 'Could not delete the treatment. Owner or admin role required.' }
  }
  revalidateErm(riskId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// KRIs
// ---------------------------------------------------------------------------

export type KriInput = {
  riskId: string
  name: string
  description?: string | null
  unit?: string | null
  direction: string
  greenThreshold?: number | null
  amberThreshold: number
  redThreshold: number
  frequency: string
  ownerId?: string | null
  dataSource?: string | null
}

function validateKri(
  input: KriInput
): Validated<Omit<TablesInsert<'erm_kris'>, 'organization_id' | 'id' | 'risk_id'>> {
  const name = str(input.name, 200)
  if (!name) return { ok: false, error: 'A KRI name is required.' }
  if (!isOneOf(KRI_DIRECTIONS, input.direction)) {
    return { ok: false, error: 'Select a valid KRI direction.' }
  }
  if (!isOneOf(KRI_FREQUENCIES, input.frequency)) {
    return { ok: false, error: 'Select a valid measurement frequency.' }
  }
  const amber = optNum(input.amberThreshold)
  const red = optNum(input.redThreshold)
  if (amber === null || red === null) {
    return { ok: false, error: 'Amber and red thresholds are required.' }
  }
  if (input.direction === 'higher_is_worse' && amber > red) {
    return {
      ok: false,
      error: 'When higher is worse, the amber threshold must be at or below the red threshold.',
    }
  }
  if (input.direction === 'lower_is_worse' && amber < red) {
    return {
      ok: false,
      error: 'When lower is worse, the amber threshold must be at or above the red threshold.',
    }
  }
  return {
    ok: true,
    value: {
      name,
      description: optStr(input.description, 1000),
      unit: optStr(input.unit, 40),
      direction: input.direction,
      green_threshold: optNum(input.greenThreshold),
      amber_threshold: amber,
      red_threshold: red,
      frequency: input.frequency,
      owner_id: optUuid(input.ownerId),
      data_source: optStr(input.dataSource, 300),
    },
  }
}

export async function createKri(input: KriInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(input.riskId)) return { ok: false, error: 'Invalid risk.' }
  const v = validateKri(input)
  if (!v.ok) return v

  const { data, error } = await ctx.supabase
    .from('erm_kris')
    .insert({ ...v.value, risk_id: input.riskId, organization_id: ctx.orgId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[erm] createKri', error)
    return { ok: false, error: 'Could not create the KRI.' }
  }
  revalidateErm(input.riskId)
  return { ok: true, data: { id: data.id } }
}

export async function updateKri(id: string, input: KriInput): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid KRI.' }
  const v = validateKri(input)
  if (!v.ok) return v

  const { error } = await ctx.supabase.from('erm_kris').update(v.value).eq('id', id)
  if (error) {
    console.error('[erm] updateKri', error)
    return { ok: false, error: 'Could not update the KRI.' }
  }
  revalidateErm(input.riskId)
  return { ok: true }
}

export async function deleteKri(id: string, riskId?: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid KRI.' }
  const { error } = await ctx.supabase.from('erm_kris').delete().eq('id', id)
  if (error) {
    console.error('[erm] deleteKri', error)
    return { ok: false, error: 'Could not delete the KRI. Owner or admin role required.' }
  }
  revalidateErm(riskId)
  return { ok: true }
}

export type KriReadingInput = {
  kriId: string
  periodDate: string
  value: number
  note?: string | null
}

export async function recordKriReading(
  input: KriReadingInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(input.kriId)) return { ok: false, error: 'Invalid KRI.' }
  const period = optDate(input.periodDate)
  if (!period) return { ok: false, error: 'A period date (YYYY-MM-DD) is required.' }
  const value = optNum(input.value)
  if (value === null) return { ok: false, error: 'A numeric reading is required.' }

  const { data, error } = await ctx.supabase
    .from('erm_kri_readings')
    .upsert(
      {
        organization_id: ctx.orgId,
        kri_id: input.kriId,
        period_date: period,
        value,
        note: optStr(input.note, 1000),
        recorded_by: ctx.userId,
      },
      { onConflict: 'kri_id,period_date' }
    )
    .select('id')
    .single()
  if (error || !data) {
    console.error('[erm] recordKriReading', error)
    return { ok: false, error: 'Could not record the reading.' }
  }
  revalidateErm()
  return { ok: true, data: { id: data.id } }
}

// ---------------------------------------------------------------------------
// Controls attached to a risk
// ---------------------------------------------------------------------------

export type RiskControlInput = {
  riskId: string
  controlId?: string | null
  icfrControlId?: string | null
  name?: string | null
  description?: string | null
  controlType?: string | null
  effectiveness?: number | null
}

export async function linkRiskControl(
  input: RiskControlInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(input.riskId)) return { ok: false, error: 'Invalid risk.' }

  const controlId = optUuid(input.controlId)
  const icfrControlId = optUuid(input.icfrControlId)
  const name = optStr(input.name, 300)
  if (!controlId && !icfrControlId && !name) {
    return {
      ok: false,
      error: 'Choose a library control, an ICFR control, or name a control.',
    }
  }
  const controlType =
    input.controlType && isOneOf(CONTROL_TYPES, input.controlType)
      ? input.controlType
      : null

  const { data, error } = await ctx.supabase
    .from('erm_risk_controls')
    .insert({
      organization_id: ctx.orgId,
      risk_id: input.riskId,
      control_id: controlId,
      icfr_control_id: icfrControlId,
      name,
      description: optStr(input.description, 2000),
      control_type: controlType,
      effectiveness: optScale(input.effectiveness),
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[erm] linkRiskControl', error)
    return {
      ok: false,
      error:
        error?.code === '23505'
          ? 'That control is already linked to this risk.'
          : 'Could not link the control.',
    }
  }
  revalidateErm(input.riskId)
  return { ok: true, data: { id: data.id } }
}

export async function updateRiskControl(
  id: string,
  patch: { effectiveness?: number | null; controlType?: string | null; description?: string | null },
  riskId?: string
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid control link.' }

  const { error } = await ctx.supabase
    .from('erm_risk_controls')
    .update({
      effectiveness: optScale(patch.effectiveness),
      control_type:
        patch.controlType && isOneOf(CONTROL_TYPES, patch.controlType)
          ? patch.controlType
          : null,
      description: optStr(patch.description, 2000),
    })
    .eq('id', id)
  if (error) {
    console.error('[erm] updateRiskControl', error)
    return { ok: false, error: 'Could not update the control.' }
  }
  revalidateErm(riskId)
  return { ok: true }
}

export async function unlinkRiskControl(
  id: string,
  riskId?: string
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid control link.' }
  const { error } = await ctx.supabase.from('erm_risk_controls').delete().eq('id', id)
  if (error) {
    console.error('[erm] unlinkRiskControl', error)
    return { ok: false, error: 'Could not remove the control. Owner or admin role required.' }
  }
  revalidateErm(riskId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Cross-module links
// ---------------------------------------------------------------------------

export async function linkRecord(input: {
  riskId: string
  kind: string
  targetId: string
  label?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(input.riskId)) return { ok: false, error: 'Invalid risk.' }
  if (!isUuid(input.targetId)) return { ok: false, error: 'Invalid target record.' }
  if (!isOneOf(LINK_KINDS, input.kind)) {
    return { ok: false, error: 'Unsupported link type.' }
  }

  const { data, error } = await ctx.supabase
    .from('erm_links')
    .insert({
      organization_id: ctx.orgId,
      risk_id: input.riskId,
      kind: input.kind,
      target_id: input.targetId,
      label: optStr(input.label, 300),
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[erm] linkRecord', error)
    return {
      ok: false,
      error: error?.code === '23505' ? 'That record is already linked.' : 'Could not create the link.',
    }
  }
  revalidateErm(input.riskId)
  return { ok: true, data: { id: data.id } }
}

export async function unlinkRecord(id: string, riskId?: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(id)) return { ok: false, error: 'Invalid link.' }
  const { error } = await ctx.supabase.from('erm_links').delete().eq('id', id)
  if (error) {
    console.error('[erm] unlinkRecord', error)
    return { ok: false, error: 'Could not remove the link. Owner or admin role required.' }
  }
  revalidateErm(riskId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Bulk import of AI-identified candidate risks
// ---------------------------------------------------------------------------

export type CandidateRisk = {
  title: string
  description: string
  category_code: string | null
  inherent_likelihood: number
  inherent_impact: number
  velocity: number
  causes?: string | null
  consequences?: string | null
  treatments: { strategy: string; title: string }[]
}

export async function importCandidateRisks(
  candidates: CandidateRisk[]
): Promise<ActionResult<{ created: number; skipped: number }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { ok: false, error: 'Select at least one candidate risk.' }
  }

  const { data: cats } = await ctx.supabase
    .from('erm_categories')
    .select('id, code')
  const catByCode = new Map((cats ?? []).map((c) => [c.code, c.id]))

  let created = 0
  let skipped = 0

  for (const c of candidates) {
    const result = await createRisk({
      title: c.title,
      description: c.description,
      causes: c.causes,
      consequences: c.consequences,
      categoryId: c.category_code ? (catByCode.get(c.category_code) ?? null) : null,
      inherentLikelihood: c.inherent_likelihood,
      inherentImpact: c.inherent_impact,
      velocity: c.velocity,
      source: 'workshop',
      status: 'identified',
    })
    if (!result.ok || !result.data) {
      skipped += 1
      continue
    }
    created += 1
    for (const t of c.treatments ?? []) {
      if (!isOneOf(TREATMENT_STRATEGIES, t.strategy)) continue
      await createTreatment({
        riskId: result.data.id,
        strategy: t.strategy,
        title: t.title,
      })
    }
  }

  revalidateErm()
  if (created === 0) return { ok: false, error: 'No candidate risks could be created.' }
  return { ok: true, data: { created, skipped } }
}
