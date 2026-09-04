import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/database.types'
import {
  bandForScore,
  type RiskBand,
  type KriStatus,
  RISK_BANDS,
} from '@/lib/erm/constants'

export type RiskSummary = Tables<'erm_risk_summary'>
export type ErmRisk = Tables<'erm_risks'>
export type ErmCategory = Tables<'erm_categories'>
export type ErmAppetite = Tables<'erm_appetite'>
export type ErmTreatment = Tables<'erm_treatments'>
export type TreatmentSummary = Tables<'erm_treatment_summary'>
export type ErmKri = Tables<'erm_kris'>
export type KriStatusRow = Tables<'erm_kri_status'>
export type ErmKriReading = Tables<'erm_kri_readings'>
export type ErmAssessment = Tables<'erm_assessments'>
export type ErmRiskControl = Tables<'erm_risk_controls'>
export type ErmLink = Tables<'erm_links'>
export type TaxonomyTemplate = Tables<'erm_taxonomy_templates'>

export type Member = { id: string; name: string }

type ProfileRel =
  | { id: string; full_name: string | null; email: string | null }
  | { id: string; full_name: string | null; email: string | null }[]
  | null

function toMember(rel: ProfileRel): Member | null {
  const p = Array.isArray(rel) ? rel[0] : rel
  if (!p) return null
  return { id: p.id, name: p.full_name || p.email || 'Unknown' }
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

/** Movement in residual score since the previous assessment snapshot. */
export type RiskMovement = {
  previousResidual: number | null
  delta: number | null
  direction: 'up' | 'down' | 'flat' | 'new'
  previousAssessedAt: string | null
}

export type RegisterRow = RiskSummary & {
  inherent_band: RiskBand | null
  residual_band: RiskBand | null
  target_band: RiskBand | null
  movement: RiskMovement
}

/**
 * Residual movement per risk: compares the latest assessment snapshot with the
 * one before it. A risk with a single snapshot is 'new' rather than 'flat', so
 * the register does not claim stability it cannot evidence.
 */
async function getMovementIndex(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Map<string, RiskMovement>> {
  const { data, error } = await supabase
    .from('erm_assessments')
    .select('risk_id, assessed_at, residual_l, residual_i')
    .order('risk_id', { ascending: true })
    .order('assessed_at', { ascending: false })
    .limit(4000)

  const index = new Map<string, RiskMovement>()
  if (error) {
    console.error('[erm] getMovementIndex', error)
    return index
  }

  const byRisk = new Map<string, typeof data>()
  for (const a of data ?? []) {
    const list = byRisk.get(a.risk_id) ?? []
    list.push(a)
    byRisk.set(a.risk_id, list)
  }

  for (const [riskId, rows] of byRisk) {
    const scored = rows
      .map((r) => ({
        at: r.assessed_at,
        score: r.residual_l && r.residual_i ? r.residual_l * r.residual_i : null,
      }))
      .filter((r) => r.score !== null)
    if (scored.length < 2) {
      index.set(riskId, {
        previousResidual: null,
        delta: null,
        direction: 'new',
        previousAssessedAt: scored[0]?.at ?? null,
      })
      continue
    }
    const current = scored[0].score as number
    const previous = scored[1].score as number
    const delta = current - previous
    index.set(riskId, {
      previousResidual: previous,
      delta,
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      previousAssessedAt: scored[1].at,
    })
  }
  return index
}

function decorate(row: RiskSummary, movement: RiskMovement): RegisterRow {
  return {
    ...row,
    inherent_band: bandForScore(row.inherent_score),
    residual_band: bandForScore(row.residual_score),
    target_band: bandForScore(row.target_score),
    movement,
  }
}

const NO_MOVEMENT: RiskMovement = {
  previousResidual: null,
  delta: null,
  direction: 'new',
  previousAssessedAt: null,
}

/** The enterprise risk register with inherent, residual and target scores. */
export async function getRiskRegister(): Promise<RegisterRow[]> {
  const supabase = await createClient()
  const [{ data, error }, movements] = await Promise.all([
    supabase
      .from('erm_risk_summary')
      .select('*')
      .order('residual_score', { ascending: false, nullsFirst: false })
      .order('code', { ascending: true }),
    getMovementIndex(supabase),
  ])
  if (error) {
    console.error('[erm] getRiskRegister', error)
    return []
  }
  return (data ?? []).map((r) => decorate(r, movements.get(r.id ?? '') ?? NO_MOVEMENT))
}

export async function listMembers(): Promise<Member[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name', { ascending: true })
  if (error) {
    console.error('[erm] listMembers', error)
    return []
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || p.email || 'Unknown',
  }))
}

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export type CategoryNode = ErmCategory & {
  children: ErmCategory[]
  risk_count: number
}

export async function listCategories(): Promise<ErmCategory[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('erm_categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true })
  if (error) {
    console.error('[erm] listCategories', error)
    return []
  }
  return data ?? []
}

export async function getTaxonomy(): Promise<{
  tree: CategoryNode[]
  templateCount: number
  imported: number
}> {
  const supabase = await createClient()
  const [catsRes, risksRes, templatesRes] = await Promise.all([
    supabase
      .from('erm_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('code', { ascending: true }),
    supabase.from('erm_risks').select('category_id'),
    supabase.from('erm_taxonomy_templates').select('code', { count: 'exact', head: true }),
  ])
  if (catsRes.error) console.error('[erm] getTaxonomy categories', catsRes.error)
  if (risksRes.error) console.error('[erm] getTaxonomy risks', risksRes.error)

  const cats = catsRes.data ?? []
  const counts = new Map<string, number>()
  for (const r of risksRes.data ?? []) {
    if (!r.category_id) continue
    counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1)
  }

  const level2 = cats.filter((c) => c.level === 2)
  const tree: CategoryNode[] = cats
    .filter((c) => c.level === 1)
    .map((c) => {
      const children = level2.filter((k) => k.parent_id === c.id)
      const own = counts.get(c.id) ?? 0
      return {
        ...c,
        children,
        risk_count: own + children.reduce((n, k) => n + (counts.get(k.id) ?? 0), 0),
      }
    })

  return {
    tree,
    templateCount: templatesRes.count ?? 0,
    imported: cats.length,
  }
}

export async function listTaxonomyTemplates(): Promise<TaxonomyTemplate[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('erm_taxonomy_templates')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('[erm] listTaxonomyTemplates', error)
    return []
  }
  return data ?? []
}

// ---------------------------------------------------------------------------
// Single risk
// ---------------------------------------------------------------------------

export type RiskControlRow = ErmRiskControl & {
  library_control: { id: string; code: string | null; title: string | null } | null
  icfr_control: { id: string; ref: string | null; title: string | null } | null
}

export type TreatmentRow = ErmTreatment & { owner: Member | null; is_overdue: boolean }

export type KriRow = KriStatusRow & {
  readings: { period_date: string; value: number; note: string | null }[]
  breaches: number
  status_rag: KriStatus
}

export type RiskDetail = {
  risk: RegisterRow
  raw: ErmRisk
  owner: Member | null
  sponsor: Member | null
  controls: RiskControlRow[]
  treatments: TreatmentRow[]
  kris: KriRow[]
  assessments: (ErmAssessment & { assessor: Member | null })[]
  links: ErmLink[]
  members: Member[]
  categories: ErmCategory[]
}

export async function getRisk(id: string): Promise<RiskDetail | null> {
  const supabase = await createClient()

  const [summaryRes, rawRes] = await Promise.all([
    supabase.from('erm_risk_summary').select('*').eq('id', id).maybeSingle(),
    supabase.from('erm_risks').select('*').eq('id', id).maybeSingle(),
  ])
  if (summaryRes.error) console.error('[erm] getRisk summary', summaryRes.error)
  if (!summaryRes.data || !rawRes.data) return null

  const [controlsRes, treatmentsRes, kriRes, assessRes, linksRes, members, categories] =
    await Promise.all([
      supabase
        .from('erm_risk_controls')
        .select(
          '*, controls ( id, control_ref, title_en ), icfr_controls ( id, ref, title )'
        )
        .eq('risk_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('erm_treatments')
        .select('*, owner:profiles!erm_treatments_owner_id_fkey ( id, full_name, email )')
        .eq('risk_id', id)
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('erm_kri_status').select('*').eq('risk_id', id).order('name'),
      supabase
        .from('erm_assessments')
        .select(
          '*, assessor:profiles!erm_assessments_assessed_by_fkey ( id, full_name, email )'
        )
        .eq('risk_id', id)
        .order('assessed_at', { ascending: false })
        .limit(50),
      supabase.from('erm_links').select('*').eq('risk_id', id),
      listMembers(),
      listCategories(),
    ])

  if (controlsRes.error) console.error('[erm] getRisk controls', controlsRes.error)
  if (treatmentsRes.error) console.error('[erm] getRisk treatments', treatmentsRes.error)
  if (kriRes.error) console.error('[erm] getRisk kris', kriRes.error)

  const kriIds = (kriRes.data ?? []).map((k) => k.id).filter((k): k is string => !!k)
  const readingsRes = kriIds.length
    ? await supabase
        .from('erm_kri_readings')
        .select('kri_id, period_date, value, note')
        .in('kri_id', kriIds)
        .order('period_date', { ascending: true })
    : { data: [], error: null }
  if (readingsRes.error) console.error('[erm] getRisk readings', readingsRes.error)

  const today = new Date().toISOString().slice(0, 10)

  const controls: RiskControlRow[] = (controlsRes.data ?? []).map((c) => {
    const { controls: lib, icfr_controls: icfr, ...rest } = c
    const l = Array.isArray(lib) ? lib[0] : lib
    const i = Array.isArray(icfr) ? icfr[0] : icfr
    return {
      ...(rest as ErmRiskControl),
      library_control: l ? { id: l.id, code: l.control_ref, title: l.title_en } : null,
      icfr_control: i ? { id: i.id, ref: i.ref, title: i.title } : null,
    }
  })

  const treatments: TreatmentRow[] = (treatmentsRes.data ?? []).map((t) => {
    const { owner, ...rest } = t
    const row = rest as ErmTreatment
    return {
      ...row,
      owner: toMember(owner as ProfileRel),
      is_overdue:
        row.status === 'overdue' ||
        (['planned', 'in_progress'].includes(row.status) &&
          !!row.due_date &&
          row.due_date < today),
    }
  })

  const kris: KriRow[] = (kriRes.data ?? []).map((k) => {
    const readings = (readingsRes.data ?? [])
      .filter((r) => r.kri_id === k.id)
      .map((r) => ({ period_date: r.period_date, value: Number(r.value), note: r.note }))
    const red = Number(k.red_threshold)
    const breaches = readings.filter((r) =>
      k.direction === 'lower_is_worse' ? r.value <= red : r.value >= red
    ).length
    return {
      ...k,
      readings,
      breaches,
      status_rag: (k.status ?? 'none') as KriStatus,
    }
  })

  const assessments = (assessRes.data ?? []).map((a) => {
    const { assessor, ...rest } = a
    return { ...(rest as ErmAssessment), assessor: toMember(assessor as ProfileRel) }
  })

  const movements = await getMovementIndex(supabase)

  return {
    risk: decorate(summaryRes.data, movements.get(id) ?? NO_MOVEMENT),
    raw: rawRes.data,
    owner: summaryRes.data.owner_id
      ? { id: summaryRes.data.owner_id, name: summaryRes.data.owner_name ?? 'Unknown' }
      : null,
    sponsor: summaryRes.data.sponsor_id
      ? { id: summaryRes.data.sponsor_id, name: summaryRes.data.sponsor_name ?? 'Unknown' }
      : null,
    controls,
    treatments,
    kris,
    assessments,
    links: linksRes.data ?? [],
    members,
    categories,
  }
}

// ---------------------------------------------------------------------------
// Heat map — a full 5×5 matrix, every cell present, risks carried per cell
// ---------------------------------------------------------------------------

export type HeatCellRisk = {
  id: string
  code: string
  title: string
  owner_name: string | null
  category: string | null
}

export type HeatCell = {
  likelihood: number
  impact: number
  score: number
  band: RiskBand
  count: number
  risks: HeatCellRisk[]
}

export type HeatMatrix = {
  basis: 'inherent' | 'residual'
  /** cells[impactIndex][likelihoodIndex] — impact descends 5→1 for display. */
  cells: HeatCell[][]
  unplotted: number
  total: number
}

export function buildHeatMatrix(
  rows: RegisterRow[],
  basis: 'inherent' | 'residual'
): HeatMatrix {
  const cells: HeatCell[][] = []
  for (let impact = 5; impact >= 1; impact--) {
    const row: HeatCell[] = []
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const score = likelihood * impact
      row.push({
        likelihood,
        impact,
        score,
        band: bandForScore(score) as RiskBand,
        count: 0,
        risks: [],
      })
    }
    cells.push(row)
  }

  let unplotted = 0
  const open = rows.filter((r) => r.status !== 'closed')
  for (const r of open) {
    const l = basis === 'inherent' ? r.inherent_likelihood : r.residual_likelihood
    const i = basis === 'inherent' ? r.inherent_impact : r.residual_impact
    if (!l || !i) {
      unplotted += 1
      continue
    }
    const cell = cells[5 - i]?.[l - 1]
    if (!cell) {
      unplotted += 1
      continue
    }
    cell.count += 1
    cell.risks.push({
      id: r.id ?? '',
      code: r.code ?? '',
      title: r.title ?? '',
      owner_name: r.owner_name,
      category: r.parent_category_name_en ?? r.category_name_en,
    })
  }

  return { basis, cells, unplotted, total: open.length }
}

// ---------------------------------------------------------------------------
// Appetite
// ---------------------------------------------------------------------------

export type AppetiteRow = ErmAppetite & {
  category_code: string | null
  category_name_en: string | null
  category_name_ar: string | null
  approver_name: string | null
  /** Risks in scope of this statement (a category and its level-2 children). */
  risk_count: number
  breach_count: number
  max_residual: number | null
  avg_residual: number | null
  /** Highest residual score as a percentage of the tolerance threshold. */
  utilisation_pct: number
}

export async function getAppetite(): Promise<AppetiteRow[]> {
  const supabase = await createClient()
  const [appetiteRes, categories, register] = await Promise.all([
    supabase
      .from('erm_appetite')
      .select(
        '*, erm_categories ( code, name_en, name_ar, level ), approver:profiles!erm_appetite_approved_by_fkey ( id, full_name, email )'
      ),
    listCategories(),
    getRiskRegister(),
  ])
  if (appetiteRes.error) {
    console.error('[erm] getAppetite', appetiteRes.error)
    return []
  }

  const childrenOf = new Map<string, string[]>()
  for (const c of categories) {
    if (c.parent_id) {
      childrenOf.set(c.parent_id, [...(childrenOf.get(c.parent_id) ?? []), c.id])
    }
  }

  const open = register.filter((r) => r.status !== 'closed')

  const rows = (appetiteRes.data ?? []).map((a) => {
    const { erm_categories: cat, approver, ...rest } = a
    const c = Array.isArray(cat) ? cat[0] : cat
    const row = rest as ErmAppetite

    const scope = row.category_id
      ? new Set([row.category_id, ...(childrenOf.get(row.category_id) ?? [])])
      : null
    const inScope = scope
      ? open.filter((r) => r.category_id && scope.has(r.category_id))
      : open

    const scores = inScope
      .map((r) => r.residual_score)
      .filter((s): s is number => typeof s === 'number')
    const max = scores.length ? Math.max(...scores) : null
    const avg = scores.length
      ? Math.round((scores.reduce((n, s) => n + s, 0) / scores.length) * 10) / 10
      : null

    return {
      ...row,
      category_code: c?.code ?? null,
      category_name_en: c?.name_en ?? null,
      category_name_ar: c?.name_ar ?? null,
      approver_name: toMember(approver as ProfileRel)?.name ?? null,
      risk_count: inScope.length,
      breach_count: scores.filter((s) => s > row.tolerance_threshold).length,
      max_residual: max,
      avg_residual: avg,
      utilisation_pct: max
        ? Math.round((max / row.tolerance_threshold) * 100)
        : 0,
    }
  })

  // Enterprise-wide statement first, then by category code.
  return rows.sort((a, b) => {
    if (!a.category_id) return -1
    if (!b.category_id) return 1
    return (a.category_code ?? '').localeCompare(b.category_code ?? '')
  })
}

// ---------------------------------------------------------------------------
// KRI dashboard
// ---------------------------------------------------------------------------

export type KriDashboardRow = KriStatusRow & {
  risk_code: string | null
  risk_title: string | null
  owner_name: string | null
  readings: { period_date: string; value: number }[]
  previous_value: number | null
  breach_periods: string[]
  status_rag: KriStatus
}

export async function getKriDashboard(): Promise<KriDashboardRow[]> {
  const supabase = await createClient()
  const [statusRes, krisRes, readingsRes] = await Promise.all([
    supabase.from('erm_kri_status').select('*').order('name', { ascending: true }),
    supabase
      .from('erm_kris')
      .select(
        'id, risk_id, owner_id, erm_risks ( code, title ), owner:profiles!erm_kris_owner_id_fkey ( id, full_name, email )'
      ),
    supabase
      .from('erm_kri_readings')
      .select('kri_id, period_date, value')
      .order('period_date', { ascending: true })
      .limit(5000),
  ])
  if (statusRes.error) {
    console.error('[erm] getKriDashboard', statusRes.error)
    return []
  }

  const meta = new Map<
    string,
    { risk_code: string | null; risk_title: string | null; owner_name: string | null }
  >()
  for (const k of krisRes.data ?? []) {
    const r = Array.isArray(k.erm_risks) ? k.erm_risks[0] : k.erm_risks
    meta.set(k.id, {
      risk_code: r?.code ?? null,
      risk_title: r?.title ?? null,
      owner_name: toMember(k.owner as ProfileRel)?.name ?? null,
    })
  }

  const rank: Record<string, number> = { red: 0, amber: 1, none: 2, green: 3 }

  return (statusRes.data ?? [])
    .map((k) => {
      const readings = (readingsRes.data ?? [])
        .filter((r) => r.kri_id === k.id)
        .map((r) => ({ period_date: r.period_date, value: Number(r.value) }))
      const red = Number(k.red_threshold)
      const breached = readings.filter((r) =>
        k.direction === 'lower_is_worse' ? r.value <= red : r.value >= red
      )
      const m = k.id ? meta.get(k.id) : undefined
      return {
        ...k,
        risk_code: m?.risk_code ?? null,
        risk_title: m?.risk_title ?? null,
        owner_name: m?.owner_name ?? null,
        readings,
        previous_value: readings.length >= 2 ? readings[readings.length - 2].value : null,
        breach_periods: breached.map((r) => r.period_date),
        status_rag: (k.status ?? 'none') as KriStatus,
      }
    })
    .sort(
      (a, b) =>
        (rank[a.status_rag] ?? 4) - (rank[b.status_rag] ?? 4) ||
        (a.name ?? '').localeCompare(b.name ?? '')
    )
}

// ---------------------------------------------------------------------------
// Board-level portfolio view
// ---------------------------------------------------------------------------

export type CategoryDistribution = {
  category_id: string | null
  code: string
  name_en: string
  name_ar: string | null
  total: number
  byBand: Record<RiskBand, number>
  max_residual: number | null
}

export type BoardAggregate = {
  totals: {
    risks: number
    open: number
    emerging: number
    outsideAppetite: number
    krisInBreach: number
    krisAmber: number
    overdueTreatments: number
    openTreatments: number
    unassessed: number
    withoutOwner: number
  }
  byBand: Record<RiskBand, number>
  byCategory: CategoryDistribution[]
  topRisks: RegisterRow[]
  outsideAppetite: RegisterRow[]
  overdueTreatments: TreatmentSummary[]
  krisInBreach: KriDashboardRow[]
  emergingRisks: RegisterRow[]
  appetite: AppetiteRow[]
}

export async function getBoardAggregate(): Promise<BoardAggregate> {
  const supabase = await createClient()

  // Cheap, idempotent roll-forward so 'overdue' is truthful at read time.
  const { error: overdueError } = await supabase.rpc('erm_mark_overdue_treatments')
  if (overdueError) console.error('[erm] mark overdue', overdueError)

  const [register, kris, appetite, treatmentsRes, categories] = await Promise.all([
    getRiskRegister(),
    getKriDashboard(),
    getAppetite(),
    supabase
      .from('erm_treatment_summary')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false }),
    listCategories(),
  ])
  if (treatmentsRes.error) console.error('[erm] board treatments', treatmentsRes.error)

  const open = register.filter((r) => r.status !== 'closed')
  const byBand: Record<RiskBand, number> = { low: 0, moderate: 0, high: 0, extreme: 0 }
  for (const r of open) {
    if (r.residual_band) byBand[r.residual_band] += 1
  }

  const parentOf = new Map<string, string>()
  for (const c of categories) if (c.parent_id) parentOf.set(c.id, c.parent_id)
  const catById = new Map(categories.map((c) => [c.id, c]))

  const distribution = new Map<string, CategoryDistribution>()
  const emptyBands = (): Record<RiskBand, number> => ({
    low: 0,
    moderate: 0,
    high: 0,
    extreme: 0,
  })
  for (const c of categories.filter((c) => c.level === 1)) {
    distribution.set(c.id, {
      category_id: c.id,
      code: c.code,
      name_en: c.name_en,
      name_ar: c.name_ar,
      total: 0,
      byBand: emptyBands(),
      max_residual: null,
    })
  }
  const unclassified: CategoryDistribution = {
    category_id: null,
    code: '—',
    name_en: 'Unclassified',
    name_ar: null,
    total: 0,
    byBand: emptyBands(),
    max_residual: null,
  }

  for (const r of open) {
    const level1 = r.category_id
      ? catById.get(r.category_id)?.level === 1
        ? r.category_id
        : (parentOf.get(r.category_id) ?? null)
      : null
    const bucket = (level1 && distribution.get(level1)) || unclassified
    bucket.total += 1
    if (r.residual_band) bucket.byBand[r.residual_band] += 1
    if (typeof r.residual_score === 'number') {
      bucket.max_residual = Math.max(bucket.max_residual ?? 0, r.residual_score)
    }
  }

  const byCategory = [...distribution.values()]
  if (unclassified.total > 0) byCategory.push(unclassified)

  const treatments = treatmentsRes.data ?? []
  const overdueTreatments = treatments.filter((t) => t.is_overdue === true)

  return {
    totals: {
      risks: register.length,
      open: open.length,
      emerging: open.filter((r) => r.emerging).length,
      outsideAppetite: open.filter((r) => r.appetite_breach).length,
      krisInBreach: kris.filter((k) => k.status_rag === 'red').length,
      krisAmber: kris.filter((k) => k.status_rag === 'amber').length,
      overdueTreatments: overdueTreatments.length,
      openTreatments: treatments.filter((t) =>
        ['planned', 'in_progress', 'overdue'].includes(t.status ?? '')
      ).length,
      unassessed: open.filter((r) => r.residual_score === null).length,
      withoutOwner: open.filter((r) => !r.owner_id).length,
    },
    byBand,
    byCategory,
    topRisks: [...open]
      .filter((r) => typeof r.residual_score === 'number')
      .sort((a, b) => (b.residual_score ?? 0) - (a.residual_score ?? 0))
      .slice(0, 10),
    outsideAppetite: open
      .filter((r) => r.appetite_breach)
      .sort((a, b) => (b.residual_score ?? 0) - (a.residual_score ?? 0)),
    overdueTreatments,
    krisInBreach: kris.filter((k) => k.status_rag === 'red'),
    emergingRisks: open.filter((r) => r.emerging),
    appetite,
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type ErmDashboard = {
  board: BoardAggregate
  register: RegisterRow[]
  inherent: HeatMatrix
  residual: HeatMatrix
  bands: readonly RiskBand[]
}

export async function getErmDashboard(): Promise<ErmDashboard> {
  const board = await getBoardAggregate()
  const register = await getRiskRegister()
  return {
    board,
    register,
    inherent: buildHeatMatrix(register, 'inherent'),
    residual: buildHeatMatrix(register, 'residual'),
    bands: RISK_BANDS,
  }
}

// ---------------------------------------------------------------------------
// Pickers for the link dialogs
// ---------------------------------------------------------------------------

export type LibraryControlOption = {
  id: string
  code: string | null
  title: string | null
  framework: string | null
}

export async function listLibraryControls(
  search?: string
): Promise<LibraryControlOption[]> {
  const supabase = await createClient()
  let query = supabase
    .from('controls')
    .select('id, control_ref, title_en, frameworks ( short_name )')
    .order('control_ref', { ascending: true })
    .limit(50)
  if (search?.trim()) {
    const term = search.trim().replace(/[%,]/g, ' ')
    query = query.or(`control_ref.ilike.%${term}%,title_en.ilike.%${term}%`)
  }
  const { data, error } = await query
  if (error) {
    console.error('[erm] listLibraryControls', error)
    return []
  }
  return (data ?? []).map((c) => {
    const f = Array.isArray(c.frameworks) ? c.frameworks[0] : c.frameworks
    return {
      id: c.id,
      code: c.control_ref,
      title: c.title_en,
      framework: f?.short_name ?? null,
    }
  })
}

export type IcfrControlOption = {
  id: string
  ref: string
  title: string
  process: string | null
}

export async function listIcfrControls(): Promise<IcfrControlOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('icfr_controls')
    .select('id, ref, title, icfr_processes ( code, name )')
    .order('ref', { ascending: true })
    .limit(300)
  if (error) {
    console.error('[erm] listIcfrControls', error)
    return []
  }
  return (data ?? []).map((c) => {
    const p = Array.isArray(c.icfr_processes) ? c.icfr_processes[0] : c.icfr_processes
    return {
      id: c.id,
      ref: c.ref,
      title: c.title,
      process: p ? `${p.code} — ${p.name}` : null,
    }
  })
}
