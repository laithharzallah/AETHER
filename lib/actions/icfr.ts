'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/lib/database.types'
import {
  ASSERTIONS,
  CONTROL_STATUSES,
  CONTROL_TYPES,
  COSO_COMPONENTS,
  DEFICIENCY_STATUSES,
  FREQUENCIES,
  LEVELS,
  NATURES,
  PROCESS_STATUSES,
  SEVERITIES,
  TEST_RESULTS,
  TEST_TYPES,
  isOneOf,
} from '@/lib/icfr/constants'

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

function revalidateProcess(processId?: string | null) {
  revalidatePath('/dashboard/icfr')
  revalidatePath('/dashboard/icfr/deficiencies')
  if (processId) revalidatePath(`/dashboard/icfr/${processId}`)
}

// ---------------------------------------------------------------------------
// Templates / processes
// ---------------------------------------------------------------------------

export async function importTemplate(
  code: string,
  workspaceId?: string | null
): Promise<ActionResult<{ processId: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const templateCode = str(code, 20)
  if (!templateCode) return { ok: false, error: 'Template code is required.' }

  const { data, error } = await ctx.supabase.rpc('import_icfr_template', {
    p_template_code: templateCode,
    p_client_workspace_id: optUuid(workspaceId),
  })
  if (error || !data) {
    console.error('[icfr] importTemplate', error)
    const msg = error?.message?.includes('already exists')
      ? `A process with code ${templateCode} already exists.`
      : 'Could not import the template.'
    return { ok: false, error: msg }
  }
  revalidateProcess(data)
  return { ok: true, data: { processId: data } }
}

export type ProcessInput = {
  code: string
  name: string
  cycle?: string | null
  description?: string | null
  ownerId?: string | null
  status?: string
  workspaceId?: string | null
}

type ProcessRow = Omit<TablesInsert<'icfr_processes'>, 'organization_id' | 'id'>

function validateProcess(input: ProcessInput): Validated<ProcessRow> {
  const code = str(input.code, 20).toUpperCase()
  const name = str(input.name, 200)
  if (!code) return { ok: false, error: 'Process code is required.' }
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    return { ok: false, error: 'Code may contain only letters, numbers, hyphen and underscore.' }
  }
  if (!name) return { ok: false, error: 'Process name is required.' }
  const status =
    input.status && isOneOf(PROCESS_STATUSES, input.status) ? input.status : 'active'
  return {
    ok: true,
    value: {
      code,
      name,
      cycle: optStr(input.cycle, 120),
      description: optStr(input.description),
      owner_id: optUuid(input.ownerId),
      status,
      client_workspace_id: optUuid(input.workspaceId),
    },
  }
}

export async function createProcess(
  input: ProcessInput
): Promise<ActionResult<{ processId: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const v = validateProcess(input)
  if (!v.ok) return v

  const { data, error } = await ctx.supabase
    .from('icfr_processes')
    .insert({ ...v.value, organization_id: ctx.orgId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[icfr] createProcess', error)
    return {
      ok: false,
      error:
        error?.code === '23505'
          ? `A process with code ${v.value.code} already exists.`
          : 'Could not create the process.',
    }
  }
  revalidateProcess(data.id)
  return { ok: true, data: { processId: data.id } }
}

export async function updateProcess(
  processId: string,
  input: ProcessInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(processId)) return { ok: false, error: 'Invalid process.' }
  const v = validateProcess(input)
  if (!v.ok) return v
  const { client_workspace_id: _ws, ...patch } = v.value
  void _ws
  const { error } = await ctx.supabase
    .from('icfr_processes')
    .update(patch)
    .eq('id', processId)
  if (error) {
    console.error('[icfr] updateProcess', error)
    return {
      ok: false,
      error:
        error.code === '23505'
          ? `A process with code ${v.value.code} already exists.`
          : 'Could not update the process.',
    }
  }
  revalidateProcess(processId)
  return { ok: true }
}

export async function deleteProcess(processId: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(processId)) return { ok: false, error: 'Invalid process.' }
  const { error, count } = await ctx.supabase
    .from('icfr_processes')
    .delete({ count: 'exact' })
    .eq('id', processId)
  if (error) {
    console.error('[icfr] deleteProcess', error)
    return { ok: false, error: 'Could not delete the process.' }
  }
  if (!count) return { ok: false, error: 'Only owners and admins can delete processes.' }
  revalidateProcess(processId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Risks
// ---------------------------------------------------------------------------

export type RiskInput = {
  ref: string
  description: string
  assertions: string[]
  likelihood?: number | null
  impact?: number | null
  fraudRisk?: boolean
}

type RiskRow = Omit<TablesInsert<'icfr_risks'>, 'organization_id' | 'id' | 'process_id'>

function validateRisk(input: RiskInput): Validated<RiskRow> {
  const ref = str(input.ref, 20)
  const description = str(input.description, 2000)
  if (!ref) return { ok: false, error: 'Risk reference is required.' }
  if (!description) return { ok: false, error: 'Risk description is required.' }
  const assertions = Array.isArray(input.assertions)
    ? input.assertions.filter((a): a is string => isOneOf(ASSERTIONS, a))
    : []
  return {
    ok: true,
    value: {
      ref,
      description,
      assertions,
      likelihood: optInt(input.likelihood, 1, 5),
      impact: optInt(input.impact, 1, 5),
      fraud_risk: Boolean(input.fraudRisk),
    },
  }
}

export async function createRisk(
  processId: string,
  input: RiskInput
): Promise<ActionResult<{ riskId: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(processId)) return { ok: false, error: 'Invalid process.' }
  const v = validateRisk(input)
  if (!v.ok) return v
  const { data, error } = await ctx.supabase
    .from('icfr_risks')
    .insert({ ...v.value, process_id: processId, organization_id: ctx.orgId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[icfr] createRisk', error)
    return {
      ok: false,
      error:
        error?.code === '23505'
          ? `Risk ${v.value.ref} already exists in this process.`
          : 'Could not create the risk.',
    }
  }
  revalidateProcess(processId)
  return { ok: true, data: { riskId: data.id } }
}

export async function updateRisk(
  riskId: string,
  processId: string,
  input: RiskInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(riskId)) return { ok: false, error: 'Invalid risk.' }
  const v = validateRisk(input)
  if (!v.ok) return v
  const { error } = await ctx.supabase.from('icfr_risks').update(v.value).eq('id', riskId)
  if (error) {
    console.error('[icfr] updateRisk', error)
    return {
      ok: false,
      error:
        error.code === '23505'
          ? `Risk ${v.value.ref} already exists in this process.`
          : 'Could not update the risk.',
    }
  }
  revalidateProcess(processId)
  return { ok: true }
}

export async function deleteRisk(riskId: string, processId: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(riskId)) return { ok: false, error: 'Invalid risk.' }
  const { error, count } = await ctx.supabase
    .from('icfr_risks')
    .delete({ count: 'exact' })
    .eq('id', riskId)
  if (error) {
    console.error('[icfr] deleteRisk', error)
    return { ok: false, error: 'Could not delete the risk.' }
  }
  if (!count) return { ok: false, error: 'Only owners and admins can delete risks.' }
  revalidateProcess(processId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export type ControlInput = {
  ref: string
  title: string
  description?: string | null
  controlType: string
  nature: string
  frequency: string
  isKey: boolean
  level: string
  cosoComponent: string
  ownerId?: string | null
  evidenceDescription?: string | null
  status?: string
  riskIds?: string[]
}

type ControlRow = Omit<TablesInsert<'icfr_controls'>, 'organization_id' | 'id' | 'process_id'>

function validateControl(input: ControlInput): Validated<ControlRow> {
  const ref = str(input.ref, 20)
  const title = str(input.title, 300)
  if (!ref) return { ok: false, error: 'Control reference is required.' }
  if (!title) return { ok: false, error: 'Control title is required.' }
  if (!isOneOf(CONTROL_TYPES, input.controlType)) return { ok: false, error: 'Invalid control type.' }
  if (!isOneOf(NATURES, input.nature)) return { ok: false, error: 'Invalid control nature.' }
  if (!isOneOf(FREQUENCIES, input.frequency)) return { ok: false, error: 'Invalid frequency.' }
  if (!isOneOf(LEVELS, input.level)) return { ok: false, error: 'Invalid control level.' }
  if (!isOneOf(COSO_COMPONENTS, input.cosoComponent)) {
    return { ok: false, error: 'Invalid COSO component.' }
  }
  const status =
    input.status && isOneOf(CONTROL_STATUSES, input.status) ? input.status : 'implemented'
  return {
    ok: true,
    value: {
      ref,
      title,
      description: optStr(input.description),
      control_type: input.controlType,
      nature: input.nature,
      frequency: input.frequency,
      is_key: Boolean(input.isKey),
      level: input.level,
      coso_component: input.cosoComponent,
      owner_id: optUuid(input.ownerId),
      evidence_description: optStr(input.evidenceDescription),
      status,
    },
  }
}

async function replaceLinks(
  ctx: Ctx,
  controlId: string,
  riskIds: string[]
): Promise<string | null> {
  const ids = [...new Set(riskIds.filter(isUuid))]
  const { error: delError } = await ctx.supabase
    .from('icfr_risk_controls')
    .delete()
    .eq('control_id', controlId)
  if (delError) {
    console.error('[icfr] replaceLinks delete', delError)
    return 'Could not update risk links.'
  }
  if (ids.length > 0) {
    const { error: insError } = await ctx.supabase
      .from('icfr_risk_controls')
      .insert(ids.map((risk_id) => ({ risk_id, control_id: controlId })))
    if (insError) {
      console.error('[icfr] replaceLinks insert', insError)
      return 'Could not update risk links.'
    }
  }
  return null
}

export async function createControl(
  processId: string,
  input: ControlInput
): Promise<ActionResult<{ controlId: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(processId)) return { ok: false, error: 'Invalid process.' }
  const v = validateControl(input)
  if (!v.ok) return v
  const { data, error } = await ctx.supabase
    .from('icfr_controls')
    .insert({ ...v.value, process_id: processId, organization_id: ctx.orgId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[icfr] createControl', error)
    return {
      ok: false,
      error:
        error?.code === '23505'
          ? `Control ${v.value.ref} already exists in this process.`
          : 'Could not create the control.',
    }
  }
  if (input.riskIds?.length) {
    const linkError = await replaceLinks(ctx, data.id, input.riskIds)
    if (linkError) return { ok: false, error: linkError }
  }
  revalidateProcess(processId)
  return { ok: true, data: { controlId: data.id } }
}

export async function updateControl(
  controlId: string,
  processId: string,
  input: ControlInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(controlId)) return { ok: false, error: 'Invalid control.' }
  const v = validateControl(input)
  if (!v.ok) return v
  const { error } = await ctx.supabase
    .from('icfr_controls')
    .update(v.value)
    .eq('id', controlId)
  if (error) {
    console.error('[icfr] updateControl', error)
    return {
      ok: false,
      error:
        error.code === '23505'
          ? `Control ${v.value.ref} already exists in this process.`
          : 'Could not update the control.',
    }
  }
  if (input.riskIds) {
    const linkError = await replaceLinks(ctx, controlId, input.riskIds)
    if (linkError) return { ok: false, error: linkError }
  }
  revalidateProcess(processId)
  return { ok: true }
}

export async function deleteControl(
  controlId: string,
  processId: string
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(controlId)) return { ok: false, error: 'Invalid control.' }
  const { error, count } = await ctx.supabase
    .from('icfr_controls')
    .delete({ count: 'exact' })
    .eq('id', controlId)
  if (error) {
    console.error('[icfr] deleteControl', error)
    return { ok: false, error: 'Could not delete the control.' }
  }
  if (!count) return { ok: false, error: 'Only owners and admins can delete controls.' }
  revalidateProcess(processId)
  return { ok: true }
}

export async function setRiskControlLinks(
  controlId: string,
  riskIds: string[],
  processId: string
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(controlId)) return { ok: false, error: 'Invalid control.' }
  const linkError = await replaceLinks(
    ctx,
    controlId,
    Array.isArray(riskIds) ? riskIds : []
  )
  if (linkError) return { ok: false, error: linkError }
  revalidateProcess(processId)
  return { ok: true }
}

export async function toggleRiskControlLink(
  riskId: string,
  controlId: string,
  linked: boolean,
  processId: string
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(riskId) || !isUuid(controlId)) return { ok: false, error: 'Invalid link.' }
  const { error } = linked
    ? await ctx.supabase
        .from('icfr_risk_controls')
        .upsert(
          { risk_id: riskId, control_id: controlId },
          { onConflict: 'risk_id,control_id', ignoreDuplicates: true }
        )
    : await ctx.supabase
        .from('icfr_risk_controls')
        .delete()
        .eq('risk_id', riskId)
        .eq('control_id', controlId)
  if (error) {
    console.error('[icfr] toggleRiskControlLink', error)
    return { ok: false, error: 'Could not update the link.' }
  }
  revalidateProcess(processId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export type TestInput = {
  period: string
  testType: string
  procedure?: string | null
  populationSize?: number | null
  sampleSize?: number | null
  exceptions?: number | null
  result: string
  testerId?: string | null
  testedAt?: string | null
  notes?: string | null
  workpaperRef?: string | null
}

type TestRow = Omit<TablesInsert<'icfr_tests'>, 'organization_id' | 'id' | 'control_id'>

function validateTest(input: TestInput): Validated<TestRow> {
  const period = str(input.period, 40)
  if (!period) return { ok: false, error: 'Test period is required (e.g. FY2026-Q3).' }
  if (!isOneOf(TEST_TYPES, input.testType)) return { ok: false, error: 'Invalid test type.' }
  if (!isOneOf(TEST_RESULTS, input.result)) return { ok: false, error: 'Invalid test result.' }
  const sample = optInt(input.sampleSize)
  const exceptions = optInt(input.exceptions) ?? 0
  if (sample !== null && exceptions > sample) {
    return { ok: false, error: 'Exceptions cannot exceed the sample size.' }
  }
  return {
    ok: true,
    value: {
      period,
      test_type: input.testType,
      procedure: optStr(input.procedure, 20000),
      population_size: optInt(input.populationSize),
      sample_size: sample,
      exceptions,
      result: input.result,
      tester_id: optUuid(input.testerId),
      tested_at: optDate(input.testedAt),
      notes: optStr(input.notes),
      workpaper_ref: optStr(input.workpaperRef, 100),
    },
  }
}

export async function createTest(
  controlId: string,
  processId: string,
  input: TestInput
): Promise<ActionResult<{ testId: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(controlId)) return { ok: false, error: 'Invalid control.' }
  const v = validateTest(input)
  if (!v.ok) return v
  const { data, error } = await ctx.supabase
    .from('icfr_tests')
    .insert({ ...v.value, control_id: controlId, organization_id: ctx.orgId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[icfr] createTest', error)
    return { ok: false, error: 'Could not record the test.' }
  }
  revalidateProcess(processId)
  return { ok: true, data: { testId: data.id } }
}

export async function updateTest(
  testId: string,
  processId: string,
  input: TestInput
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(testId)) return { ok: false, error: 'Invalid test.' }
  const v = validateTest(input)
  if (!v.ok) return v
  const { error } = await ctx.supabase.from('icfr_tests').update(v.value).eq('id', testId)
  if (error) {
    console.error('[icfr] updateTest', error)
    return { ok: false, error: 'Could not update the test.' }
  }
  revalidateProcess(processId)
  return { ok: true }
}

export async function deleteTest(testId: string, processId: string): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(testId)) return { ok: false, error: 'Invalid test.' }
  const { error, count } = await ctx.supabase
    .from('icfr_tests')
    .delete({ count: 'exact' })
    .eq('id', testId)
  if (error) {
    console.error('[icfr] deleteTest', error)
    return { ok: false, error: 'Could not delete the test.' }
  }
  if (!count) return { ok: false, error: 'Only owners and admins can delete tests.' }
  revalidateProcess(processId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Deficiencies
// ---------------------------------------------------------------------------

export type DeficiencyInput = {
  severity: string
  description: string
  rootCause?: string | null
  remediationPlan?: string | null
  ownerId?: string | null
  dueDate?: string | null
  status?: string
  retestResult?: string | null
  identifiedAt?: string | null
  testId?: string | null
}

type DeficiencyRow = Omit<
  TablesInsert<'icfr_deficiencies'>,
  'organization_id' | 'id' | 'control_id'
>

function validateDeficiency(input: DeficiencyInput): Validated<DeficiencyRow> {
  const description = str(input.description, 4000)
  if (!description) return { ok: false, error: 'Deficiency description is required.' }
  if (!isOneOf(SEVERITIES, input.severity)) return { ok: false, error: 'Invalid severity.' }
  const status =
    input.status && isOneOf(DEFICIENCY_STATUSES, input.status) ? input.status : 'open'
  const closed = status === 'closed' || status === 'remediated'
  return {
    ok: true,
    value: {
      severity: input.severity,
      description,
      root_cause: optStr(input.rootCause),
      remediation_plan: optStr(input.remediationPlan),
      owner_id: optUuid(input.ownerId),
      due_date: optDate(input.dueDate),
      status,
      retest_result: optStr(input.retestResult, 500),
      identified_at: optDate(input.identifiedAt) ?? today(),
      test_id: optUuid(input.testId),
      closed_at: closed ? today() : null,
    },
  }
}

export async function createDeficiency(
  controlId: string,
  processId: string,
  input: DeficiencyInput
): Promise<ActionResult<{ deficiencyId: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(controlId)) return { ok: false, error: 'Invalid control.' }
  const v = validateDeficiency(input)
  if (!v.ok) return v
  const { data, error } = await ctx.supabase
    .from('icfr_deficiencies')
    .insert({ ...v.value, control_id: controlId, organization_id: ctx.orgId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[icfr] createDeficiency', error)
    return { ok: false, error: 'Could not log the deficiency.' }
  }
  revalidateProcess(processId)
  return { ok: true, data: { deficiencyId: data.id } }
}

export async function updateDeficiency(
  deficiencyId: string,
  input: DeficiencyInput,
  processId?: string | null
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(deficiencyId)) return { ok: false, error: 'Invalid deficiency.' }
  const v = validateDeficiency(input)
  if (!v.ok) return v
  const { error } = await ctx.supabase
    .from('icfr_deficiencies')
    .update(v.value)
    .eq('id', deficiencyId)
  if (error) {
    console.error('[icfr] updateDeficiency', error)
    return { ok: false, error: 'Could not update the deficiency.' }
  }
  revalidateProcess(processId)
  return { ok: true }
}

export async function updateDeficiencyStatus(
  deficiencyId: string,
  status: string,
  processId?: string | null
): Promise<ActionResult> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  if (!isUuid(deficiencyId)) return { ok: false, error: 'Invalid deficiency.' }
  if (!isOneOf(DEFICIENCY_STATUSES, status)) return { ok: false, error: 'Invalid status.' }
  const closed = status === 'closed' || status === 'remediated'
  const { error } = await ctx.supabase
    .from('icfr_deficiencies')
    .update({ status, closed_at: closed ? today() : null })
    .eq('id', deficiencyId)
  if (error) {
    console.error('[icfr] updateDeficiencyStatus', error)
    return { ok: false, error: 'Could not update the status.' }
  }
  revalidateProcess(processId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// AI-generated RCM import
// ---------------------------------------------------------------------------

export type GeneratedRisk = {
  ref: string
  title: string
  assertions: string[]
  fraud_risk?: boolean
}

export type GeneratedControl = {
  ref: string
  title: string
  description: string
  control_type: string
  nature: string
  frequency: string
  is_key: boolean
  level: string
  coso_component: string
  linked_risk_refs: string[]
}

export async function importGeneratedRcm(
  processInput: ProcessInput,
  risks: GeneratedRisk[],
  controls: GeneratedControl[]
): Promise<ActionResult<{ processId: string }>> {
  const ctx = await getCtx()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const v = validateProcess(processInput)
  if (!v.ok) return v
  if (!Array.isArray(risks) || risks.length === 0) {
    return { ok: false, error: 'No risks to import.' }
  }
  if (!Array.isArray(controls) || controls.length === 0) {
    return { ok: false, error: 'No controls to import.' }
  }
  if (risks.length > 40 || controls.length > 80) {
    return { ok: false, error: 'Generated RCM is too large.' }
  }

  const riskRows: RiskRow[] = []
  for (const r of risks) {
    const rv = validateRisk({
      ref: r.ref,
      description: r.title,
      assertions: r.assertions,
      fraudRisk: r.fraud_risk,
    })
    if (!rv.ok) return rv
    riskRows.push(rv.value)
  }
  const controlRows: ControlRow[] = []
  for (const c of controls) {
    const cv = validateControl({
      ref: c.ref,
      title: c.title,
      description: c.description,
      controlType: c.control_type,
      nature: c.nature,
      frequency: c.frequency,
      isKey: c.is_key,
      level: c.level,
      cosoComponent: c.coso_component,
    })
    if (!cv.ok) return cv
    controlRows.push(cv.value)
  }

  const { data: process, error: pErr } = await ctx.supabase
    .from('icfr_processes')
    .insert({
      ...v.value,
      organization_id: ctx.orgId,
      owner_id: v.value.owner_id ?? ctx.userId,
    })
    .select('id')
    .single()
  if (pErr || !process) {
    console.error('[icfr] importGeneratedRcm process', pErr)
    return {
      ok: false,
      error:
        pErr?.code === '23505'
          ? `A process with code ${v.value.code} already exists.`
          : 'Could not create the process.',
    }
  }

  const fail = async (msg: string): Promise<ActionResult<{ processId: string }>> => {
    await ctx.supabase.from('icfr_processes').delete().eq('id', process.id)
    return { ok: false, error: msg }
  }

  const { data: insertedRisks, error: rErr } = await ctx.supabase
    .from('icfr_risks')
    .insert(
      riskRows.map((r) => ({ ...r, process_id: process.id, organization_id: ctx.orgId }))
    )
    .select('id, ref')
  if (rErr || !insertedRisks) {
    console.error('[icfr] importGeneratedRcm risks', rErr)
    return fail('Could not import the generated risks (duplicate references?).')
  }

  const { data: insertedControls, error: cErr } = await ctx.supabase
    .from('icfr_controls')
    .insert(
      controlRows.map((c) => ({ ...c, process_id: process.id, organization_id: ctx.orgId }))
    )
    .select('id, ref')
  if (cErr || !insertedControls) {
    console.error('[icfr] importGeneratedRcm controls', cErr)
    return fail('Could not import the generated controls (duplicate references?).')
  }

  const riskIdByRef = new Map(insertedRisks.map((r) => [r.ref, r.id]))
  const controlIdByRef = new Map(insertedControls.map((c) => [c.ref, c.id]))
  const links: { risk_id: string; control_id: string }[] = []
  for (const c of controls) {
    const controlId = controlIdByRef.get(str(c.ref, 20))
    if (!controlId) continue
    for (const ref of c.linked_risk_refs ?? []) {
      const riskId = riskIdByRef.get(str(ref, 20))
      if (riskId) links.push({ risk_id: riskId, control_id: controlId })
    }
  }
  if (links.length > 0) {
    const { error: lErr } = await ctx.supabase
      .from('icfr_risk_controls')
      .upsert(links, { onConflict: 'risk_id,control_id', ignoreDuplicates: true })
    if (lErr) console.error('[icfr] importGeneratedRcm links', lErr)
  }

  revalidateProcess(process.id)
  return { ok: true, data: { processId: process.id } }
}
