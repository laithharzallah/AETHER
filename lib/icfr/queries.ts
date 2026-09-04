import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/database.types'

export type ProcessSummary = Tables<'icfr_process_summary'>
export type IcfrProcess = Tables<'icfr_processes'>
export type IcfrRisk = Tables<'icfr_risks'>
export type IcfrControl = Tables<'icfr_controls'>
export type IcfrTest = Tables<'icfr_tests'>
export type IcfrDeficiency = Tables<'icfr_deficiencies'>
export type IcfrTemplate = Tables<'icfr_templates'>

export type Member = { id: string; name: string }

export type RiskWithLinks = IcfrRisk & { control_ids: string[] }

export type ControlWithDetail = IcfrControl & {
  owner: Member | null
  risk_ids: string[]
  risk_refs: string[]
  latest_design: IcfrTest | null
  latest_operating: IcfrTest | null
  tests: (IcfrTest & { tester: Member | null })[]
  deficiencies: (IcfrDeficiency & { owner: Member | null })[]
  open_deficiency_count: number
}

export type ProcessDetail = {
  process: IcfrProcess & { owner: Member | null }
  risks: RiskWithLinks[]
  controls: ControlWithDetail[]
  members: Member[]
}

type ProfileRel =
  | { id: string; full_name: string | null; email: string | null }
  | { id: string; full_name: string | null; email: string | null }[]
  | null

function toMember(rel: ProfileRel): Member | null {
  const p = Array.isArray(rel) ? rel[0] : rel
  if (!p) return null
  return { id: p.id, name: p.full_name || p.email || 'Unknown' }
}

function testSortKey(t: IcfrTest): string {
  return `${t.tested_at ?? '0000-00-00'}|${t.created_at}`
}

export async function listProcesses(): Promise<ProcessSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('icfr_process_summary')
    .select('*')
    .order('code', { ascending: true })
  if (error) {
    console.error('[icfr] listProcesses', error)
    return []
  }
  return data ?? []
}

export async function listMembers(): Promise<Member[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name', { ascending: true })
  if (error) {
    console.error('[icfr] listMembers', error)
    return []
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || p.email || 'Unknown',
  }))
}

export async function getProcess(id: string): Promise<ProcessDetail | null> {
  const supabase = await createClient()

  const { data: process, error } = await supabase
    .from('icfr_processes')
    .select('*, owner:profiles!icfr_processes_owner_id_fkey ( id, full_name, email )')
    .eq('id', id)
    .maybeSingle()

  if (error) console.error('[icfr] getProcess', error)
  if (!process) return null

  const [risksRes, controlsRes, linksRes, members] = await Promise.all([
    supabase.from('icfr_risks').select('*').eq('process_id', id).order('ref'),
    supabase
      .from('icfr_controls')
      .select('*, owner:profiles!icfr_controls_owner_id_fkey ( id, full_name, email )')
      .eq('process_id', id)
      .order('ref'),
    supabase
      .from('icfr_risk_controls')
      .select('risk_id, control_id, icfr_risks!inner ( process_id )')
      .eq('icfr_risks.process_id', id),
    listMembers(),
  ])

  if (risksRes.error) console.error('[icfr] getProcess risks', risksRes.error)
  if (controlsRes.error) console.error('[icfr] getProcess controls', controlsRes.error)
  if (linksRes.error) console.error('[icfr] getProcess links', linksRes.error)

  const risks = risksRes.data ?? []
  const rawControls = controlsRes.data ?? []
  const links = (linksRes.data ?? []).map((l) => ({
    risk_id: l.risk_id,
    control_id: l.control_id,
  }))
  const controlIds = rawControls.map((c) => c.id)

  const [testsRes, defsRes] =
    controlIds.length > 0
      ? await Promise.all([
          supabase
            .from('icfr_tests')
            .select('*, tester:profiles!icfr_tests_tester_id_fkey ( id, full_name, email )')
            .in('control_id', controlIds)
            .order('tested_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false }),
          supabase
            .from('icfr_deficiencies')
            .select('*, owner:profiles!icfr_deficiencies_owner_id_fkey ( id, full_name, email )')
            .in('control_id', controlIds)
            .order('identified_at', { ascending: false }),
        ])
      : [{ data: [], error: null }, { data: [], error: null }]

  if (testsRes.error) console.error('[icfr] getProcess tests', testsRes.error)
  if (defsRes.error) console.error('[icfr] getProcess deficiencies', defsRes.error)

  const riskRefById = new Map(risks.map((r) => [r.id, r.ref]))

  const risksWithLinks: RiskWithLinks[] = risks.map((r) => ({
    ...r,
    control_ids: links.filter((l) => l.risk_id === r.id).map((l) => l.control_id),
  }))

  const controls: ControlWithDetail[] = rawControls.map((c) => {
    const { owner, ...rest } = c
    const riskIds = links.filter((l) => l.control_id === c.id).map((l) => l.risk_id)
    const tests = (testsRes.data ?? [])
      .filter((t) => t.control_id === c.id)
      .map((t) => {
        const { tester, ...tRest } = t
        return { ...(tRest as IcfrTest), tester: toMember(tester as ProfileRel) }
      })
      .sort((a, b) => (testSortKey(a) < testSortKey(b) ? 1 : -1))
    const deficiencies = (defsRes.data ?? [])
      .filter((d) => d.control_id === c.id)
      .map((d) => {
        const { owner: dOwner, ...dRest } = d
        return { ...(dRest as IcfrDeficiency), owner: toMember(dOwner as ProfileRel) }
      })
    const latest = (type: 'design' | 'operating') =>
      tests.find((t) => t.test_type === type && t.result !== 'not_tested') ??
      tests.find((t) => t.test_type === type) ??
      null
    return {
      ...(rest as IcfrControl),
      owner: toMember(owner as ProfileRel),
      risk_ids: riskIds,
      risk_refs: riskIds
        .map((rid) => riskRefById.get(rid) ?? '')
        .filter(Boolean)
        .sort(),
      latest_design: latest('design'),
      latest_operating: latest('operating'),
      tests,
      deficiencies,
      open_deficiency_count: deficiencies.filter(
        (d) => d.status === 'open' || d.status === 'in_remediation'
      ).length,
    }
  })

  const { owner: pOwner, ...pRest } = process
  return {
    process: { ...(pRest as IcfrProcess), owner: toMember(pOwner as ProfileRel) },
    risks: risksWithLinks,
    controls,
    members,
  }
}

export type DeficiencyRow = IcfrDeficiency & {
  owner: Member | null
  control: { id: string; ref: string; title: string; is_key: boolean } | null
  process: { id: string; code: string; name: string } | null
}

export async function listDeficiencies(): Promise<DeficiencyRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('icfr_deficiencies')
    .select(
      '*, owner:profiles!icfr_deficiencies_owner_id_fkey ( id, full_name, email ), icfr_controls ( id, ref, title, is_key, icfr_processes ( id, code, name ) )'
    )
    .order('identified_at', { ascending: false })

  if (error) {
    console.error('[icfr] listDeficiencies', error)
    return []
  }

  return (data ?? []).map((d) => {
    const { owner, icfr_controls, ...rest } = d
    const c = Array.isArray(icfr_controls) ? icfr_controls[0] : icfr_controls
    const p = c
      ? Array.isArray(c.icfr_processes)
        ? c.icfr_processes[0]
        : c.icfr_processes
      : null
    return {
      ...(rest as IcfrDeficiency),
      owner: toMember(owner as ProfileRel),
      control: c ? { id: c.id, ref: c.ref, title: c.title, is_key: c.is_key } : null,
      process: p ? { id: p.id, code: p.code, name: p.name } : null,
    }
  })
}

export async function listTemplates(): Promise<
  (IcfrTemplate & { risk_count: number; control_count: number })[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('icfr_templates')
    .select('*, icfr_template_items ( kind )')
    .order('sort_order')
  if (error) {
    console.error('[icfr] listTemplates', error)
    return []
  }
  return (data ?? []).map((t) => {
    const { icfr_template_items, ...rest } = t
    const items = Array.isArray(icfr_template_items) ? icfr_template_items : []
    return {
      ...(rest as IcfrTemplate),
      risk_count: items.filter((i) => i.kind === 'risk').length,
      control_count: items.filter((i) => i.kind === 'control').length,
    }
  })
}

export type IcfrDashboard = {
  processes: number
  controls: number
  keyControls: number
  keyTested: number
  keyTestedPct: number
  keyEffective: number
  keyEffectivePct: number
  openDeficiencies: number
  bySeverity: Record<'deficiency' | 'significant_deficiency' | 'material_weakness', number>
  overdueRemediations: number
}

export async function getIcfrDashboard(): Promise<IcfrDashboard> {
  const supabase = await createClient()
  const [summaryRes, defsRes] = await Promise.all([
    supabase.from('icfr_process_summary').select('*'),
    supabase
      .from('icfr_deficiencies')
      .select('severity, status, due_date')
      .in('status', ['open', 'in_remediation']),
  ])

  if (summaryRes.error) console.error('[icfr] dashboard summary', summaryRes.error)
  if (defsRes.error) console.error('[icfr] dashboard deficiencies', defsRes.error)

  const rows = summaryRes.data ?? []
  const defs = defsRes.data ?? []
  const sum = (key: keyof ProcessSummary) =>
    rows.reduce((n, r) => n + (Number(r[key]) || 0), 0)

  const keyControls = sum('key_control_count')
  const keyTested = sum('tested_key_controls')
  const keyEffective = sum('effective_key_controls')
  const today = new Date().toISOString().slice(0, 10)

  const bySeverity = {
    deficiency: 0,
    significant_deficiency: 0,
    material_weakness: 0,
  }
  let overdue = 0
  for (const d of defs) {
    if (d.severity in bySeverity) {
      bySeverity[d.severity as keyof typeof bySeverity] += 1
    }
    if (d.due_date && d.due_date < today) overdue += 1
  }

  return {
    processes: rows.length,
    controls: sum('control_count'),
    keyControls,
    keyTested,
    keyTestedPct: keyControls ? Math.round((keyTested / keyControls) * 100) : 0,
    keyEffective,
    keyEffectivePct: keyTested ? Math.round((keyEffective / keyTested) * 100) : 0,
    openDeficiencies: defs.length,
    bySeverity,
    overdueRemediations: overdue,
  }
}
