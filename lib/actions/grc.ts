'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TablesUpdate } from '@/lib/database.types'
import { getDashboardContext } from '@/lib/dashboard/get-dashboard-context'
import {
  classifyAiSystem,
  type AiRiskRule,
  type AiSystemFacts,
} from '@/lib/machine/classify-ai'

export type GrcActionState = { error?: string; success?: string }

async function requireWriter() {
  let context
  try {
    context = await getDashboardContext()
  } catch {
    return { error: 'Your session has expired. Please sign in again.' } as const
  }
  if (!context.orgId) {
    return { error: 'Your account is not linked to an organization.' } as const
  }
  if (!context.canWrite) return { error: 'Your role is read-only.' } as const

  return {
    orgId: context.orgId,
    userId: context.userId,
    isAdmin: context.isAdmin,
  } as const
}

// -----------------------------------------------------------------------------
// Control assessment
// -----------------------------------------------------------------------------

const IMPLEMENTATION_STATUSES = [
  'not_assessed',
  'not_implemented',
  'planned',
  'partially_implemented',
  'implemented',
  'not_applicable',
]
const EFFECTIVENESS = ['untested', 'ineffective', 'needs_improvement', 'effective']
const ASSESSMENT_TYPES = [
  'self',
  'internal_audit',
  'external_audit',
  'regulator',
  'automated',
]

export async function assessControl(
  _prev: GrcActionState,
  formData: FormData
): Promise<GrcActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const controlId = formData.get('controlId')
  const implementationStatus = String(formData.get('implementationStatus') ?? '')
  const effectiveness = String(formData.get('effectiveness') ?? 'untested')
  const maturityRaw = formData.get('maturity')
  const findings = formData.get('findings')
  const assessmentType = String(formData.get('assessmentType') ?? 'self')

  if (typeof controlId !== 'string' || !controlId) return { error: 'Missing control.' }
  if (!IMPLEMENTATION_STATUSES.includes(implementationStatus)) {
    return { error: 'Unsupported implementation status.' }
  }
  if (!EFFECTIVENESS.includes(effectiveness)) {
    return { error: 'Unsupported effectiveness rating.' }
  }

  const maturity =
    typeof maturityRaw === 'string' && maturityRaw !== '' ? Number(maturityRaw) : null
  if (maturity !== null && (!Number.isInteger(maturity) || maturity < 0 || maturity > 5)) {
    return { error: 'Maturity must be a whole number from 0 to 5.' }
  }

  // Recording a control as implemented but untested is the most common way a
  // posture report overstates itself, so it is refused rather than accepted.
  if (implementationStatus === 'implemented' && effectiveness === 'untested') {
    return {
      error:
        'A control cannot be implemented while its effectiveness is untested. Test it, or record it as partially implemented.',
    }
  }

  const supabase = await createClient()
  const now = new Date()

  const { data: control } = await supabase
    .from('controls')
    .select('id, framework_code, control_code')
    .eq('id', controlId)
    .eq('organization_id', auth.orgId)
    .maybeSingle()

  if (!control) return { error: 'Control not found.' }

  const { error: assessmentError } = await supabase.from('control_assessments').insert({
    control_id: controlId,
    organization_id: auth.orgId,
    assessed_by: auth.userId,
    assessed_at: now.toISOString(),
    implementation_status: implementationStatus,
    effectiveness,
    maturity,
    findings: typeof findings === 'string' && findings.trim() ? findings.trim() : null,
    assessment_type: ASSESSMENT_TYPES.includes(assessmentType) ? assessmentType : 'self',
  })

  if (assessmentError) {
    console.error('[grc] assessment insert failed', assessmentError)
    return { error: 'Could not record the assessment.' }
  }

  const nextAssessment = new Date(now)
  nextAssessment.setUTCFullYear(nextAssessment.getUTCFullYear() + 1)

  const { error: controlError } = await supabase
    .from('controls')
    .update({
      implementation_status: implementationStatus,
      effectiveness,
      maturity,
      applicability:
        implementationStatus === 'not_applicable' ? 'not_applicable' : 'applicable',
      last_assessed_at: now.toISOString(),
      next_assessment_at: nextAssessment.toISOString().slice(0, 10),
    })
    .eq('id', controlId)
    .eq('organization_id', auth.orgId)

  if (controlError) {
    console.error('[grc] control update failed', controlError)
    return { error: 'Assessment recorded, but the control could not be updated.' }
  }

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: 'control.assessed',
    p_entity_type: 'control',
    p_entity_id: controlId,
    p_summary: `${control.framework_code} ${control.control_code} assessed as ${implementationStatus.replace(/_/g, ' ')}`,
    p_metadata: { implementationStatus, effectiveness, maturity, assessmentType },
  })

  revalidatePath(`/dashboard/compliance/${control.framework_code}`)
  revalidatePath('/dashboard/compliance')
  revalidatePath('/dashboard')
  return { success: 'Assessment recorded.' }
}

// -----------------------------------------------------------------------------
// Obligations
// -----------------------------------------------------------------------------

const OBLIGATION_STATUSES = ['upcoming', 'in_progress', 'submitted', 'complete', 'waived']

export async function updateObligationStatus(
  _prev: GrcActionState,
  formData: FormData
): Promise<GrcActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const obligationId = formData.get('obligationId')
  const status = String(formData.get('status') ?? '')
  const note = formData.get('note')

  if (typeof obligationId !== 'string' || !obligationId) {
    return { error: 'Missing obligation.' }
  }
  if (!OBLIGATION_STATUSES.includes(status)) return { error: 'Unsupported status.' }

  // Waiving a regulatory duty is a decision someone has to answer for, so it needs
  // a rationale on the record and an admin to make it.
  if (status === 'waived') {
    if (!auth.isAdmin) {
      return { error: 'Only an owner or admin can waive a regulatory obligation.' }
    }
    if (typeof note !== 'string' || note.trim().length < 10) {
      return {
        error:
          'Waiving an obligation needs a written rationale — it is the first thing an assessor will ask about.',
      }
    }
  }

  const supabase = await createClient()

  const patch: TablesUpdate<'obligations'> = { status }
  if (status === 'complete' || status === 'submitted') {
    patch.completed_at = new Date().toISOString()
  }
  if (status === 'waived' && typeof note === 'string') {
    patch.waived_rationale = note.trim()
  }

  const { data: obligation, error } = await supabase
    .from('obligations')
    .update(patch)
    .eq('id', obligationId)
    .eq('organization_id', auth.orgId)
    .select('title, framework_code, due_date')
    .maybeSingle()

  if (error) {
    console.error('[grc] obligation update failed', error)
    return { error: 'Could not update the obligation.' }
  }
  if (!obligation) return { error: 'Obligation not found.' }

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: `obligation.${status}`,
    p_entity_type: 'obligation',
    p_entity_id: obligationId,
    p_summary: `"${obligation.title}" marked ${status}`,
    p_metadata: {
      framework: obligation.framework_code,
      dueDate: obligation.due_date,
      rationale: typeof note === 'string' && note.trim() ? note.trim() : null,
    },
  })

  revalidatePath('/dashboard/obligations')
  revalidatePath('/dashboard')
  return { success: `Marked ${status}.` }
}

// -----------------------------------------------------------------------------
// Risk register
// -----------------------------------------------------------------------------

export async function createRisk(
  _prev: GrcActionState,
  formData: FormData
): Promise<GrcActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const title = formData.get('title')
  const category = formData.get('category')
  const description = formData.get('description')
  const likelihood = Number(formData.get('inherentLikelihood') ?? '3')
  const impact = Number(formData.get('inherentImpact') ?? '3')

  if (typeof title !== 'string' || title.trim().length < 3) {
    return { error: 'Give the risk a title.' }
  }
  if (typeof category !== 'string' || !category) {
    return { error: 'Choose a risk category.' }
  }
  for (const [label, value] of [
    ['Likelihood', likelihood],
    ['Impact', impact],
  ] as const) {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return { error: `${label} must be a whole number from 1 to 5.` }
    }
  }

  const supabase = await createClient()

  const { data: risk, error } = await supabase
    .from('risks')
    .insert({
      organization_id: auth.orgId,
      title: title.trim().slice(0, 300),
      description:
        typeof description === 'string' && description.trim()
          ? description.trim()
          : null,
      category,
      inherent_likelihood: likelihood,
      inherent_impact: impact,
      status: 'open',
      owner_id: auth.userId,
      created_by: auth.userId,
    })
    .select('id, inherent_score')
    .single()

  if (error || !risk) {
    console.error('[grc] risk insert failed', error)
    return { error: 'Could not create the risk.' }
  }

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: 'risk.created',
    p_entity_type: 'risk',
    p_entity_id: risk.id,
    p_summary: `Risk logged: ${title.trim()}`,
    p_metadata: { category, inherentScore: risk.inherent_score },
  })

  revalidatePath('/dashboard/risks')
  return { success: 'Risk added to the register.' }
}

export async function updateRiskTreatment(
  _prev: GrcActionState,
  formData: FormData
): Promise<GrcActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const riskId = formData.get('riskId')
  const status = String(formData.get('status') ?? '')
  const strategy = formData.get('treatmentStrategy')
  const residualLikelihood = formData.get('residualLikelihood')
  const residualImpact = formData.get('residualImpact')
  const rationale = formData.get('rationale')

  if (typeof riskId !== 'string' || !riskId) return { error: 'Missing risk.' }
  if (
    !['open', 'assessing', 'mitigating', 'accepted', 'transferred', 'closed'].includes(
      status
    )
  ) {
    return { error: 'Unsupported status.' }
  }
  // Accepting a risk without recording why leaves a board nothing to review.
  if (
    status === 'accepted' &&
    (typeof rationale !== 'string' || rationale.trim().length < 10)
  ) {
    return { error: 'Accepting a risk needs a written rationale.' }
  }

  const patch: TablesUpdate<'risks'> = { status }

  if (
    typeof strategy === 'string' &&
    ['mitigate', 'accept', 'transfer', 'avoid'].includes(strategy)
  ) {
    patch.treatment_strategy = strategy
  }

  if (typeof residualLikelihood === 'string' && residualLikelihood !== '') {
    const value = Number(residualLikelihood)
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return { error: 'Residual likelihood must be a whole number from 1 to 5.' }
    }
    patch.residual_likelihood = value
  }

  if (typeof residualImpact === 'string' && residualImpact !== '') {
    const value = Number(residualImpact)
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return { error: 'Residual impact must be a whole number from 1 to 5.' }
    }
    patch.residual_impact = value
  }

  if (status === 'accepted' && typeof rationale === 'string') {
    patch.accepted_rationale = rationale.trim()
  }
  if (status === 'closed') {
    patch.closed_at = new Date().toISOString()
  }

  const supabase = await createClient()

  const { data: risk, error } = await supabase
    .from('risks')
    .update(patch)
    .eq('id', riskId)
    .eq('organization_id', auth.orgId)
    .select('title, residual_score')
    .maybeSingle()

  if (error) {
    console.error('[grc] risk update failed', error)
    return { error: 'Could not update the risk.' }
  }
  if (!risk) return { error: 'Risk not found.' }

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: `risk.${status}`,
    p_entity_type: 'risk',
    p_entity_id: riskId,
    p_summary: `"${risk.title}" marked ${status}`,
    p_metadata: {
      residualScore: risk.residual_score,
      rationale:
        typeof rationale === 'string' && rationale.trim() ? rationale.trim() : null,
    },
  })

  revalidatePath('/dashboard/risks')
  return { success: `Marked ${status}.` }
}

// -----------------------------------------------------------------------------
// AI systems
// -----------------------------------------------------------------------------

const BOOLEAN_FLAGS = [
  'is_generative',
  'is_general_purpose',
  'processes_personal_data',
  'processes_special_category',
  'processes_biometric_data',
  'makes_automated_decisions',
  'affects_legal_rights',
  'publicly_accessible',
  'used_in_critical_infrastructure',
  'eu_market_exposure',
] as const

const LIFECYCLE_STAGES = [
  'design',
  'development',
  'testing',
  'pilot',
  'production',
  'monitoring',
  'retired',
]
const AI_ROLES = [
  'provider',
  'deployer',
  'importer',
  'distributor',
  'authorised_representative',
]

export async function createAiSystem(
  _prev: GrcActionState,
  formData: FormData
): Promise<GrcActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const name = formData.get('name')
  const purpose = formData.get('purpose')
  const lifecycleStage = String(formData.get('lifecycleStage') ?? 'design')
  const role = String(formData.get('role') ?? 'deployer')
  const deploymentContext = formData.get('deploymentContext')
  const modelProvider = formData.get('modelProvider')

  if (typeof name !== 'string' || name.trim().length < 2) {
    return { error: 'Give the system a name.' }
  }
  if (typeof purpose !== 'string' || purpose.trim().length < 10) {
    return {
      error:
        'Describe what the system is for in a sentence or two. The classification depends on its purpose, so a vague description produces the wrong tier.',
    }
  }

  const flags = Object.fromEntries(
    BOOLEAN_FLAGS.map((flag) => [flag, formData.get(flag) === 'on'])
  ) as Record<(typeof BOOLEAN_FLAGS)[number], boolean>

  const supabase = await createClient()

  const { data: system, error } = await supabase
    .from('ai_systems')
    .insert({
      organization_id: auth.orgId,
      name: name.trim().slice(0, 300),
      purpose: purpose.trim(),
      lifecycle_stage: LIFECYCLE_STAGES.includes(lifecycleStage)
        ? lifecycleStage
        : 'design',
      role: AI_ROLES.includes(role) ? role : 'deployer',
      deployment_context:
        typeof deploymentContext === 'string' && deploymentContext.trim()
          ? deploymentContext.trim()
          : null,
      model_provider:
        typeof modelProvider === 'string' && modelProvider.trim()
          ? modelProvider.trim()
          : null,
      human_in_the_loop: formData.get('human_in_the_loop') === 'on',
      owner_id: auth.userId,
      ...flags,
    })
    .select('id')
    .single()

  if (error || !system) {
    console.error('[grc] ai system insert failed', error)
    return { error: 'Could not add the system.' }
  }

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: 'ai_system.created',
    p_entity_type: 'ai_system',
    p_entity_id: system.id,
    p_summary: `AI system added to the inventory: ${name.trim()}`,
    p_metadata: { lifecycleStage, role },
  })

  // Classify immediately: an unclassified system in production is exactly the gap
  // the inventory exists to close, so deferring it defeats the point.
  await classifyAndStore(supabase, auth.orgId, auth.userId, system.id)

  revalidatePath('/dashboard/ai-governance')
  return { success: 'System added and classified.' }
}

export async function reclassifyAiSystem(
  _prev: GrcActionState,
  formData: FormData
): Promise<GrcActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const systemId = formData.get('systemId')
  if (typeof systemId !== 'string' || !systemId) return { error: 'Missing system.' }

  const supabase = await createClient()
  const result = await classifyAndStore(supabase, auth.orgId, auth.userId, systemId)
  if ('error' in result) return result

  revalidatePath('/dashboard/ai-governance')
  return { success: `EU AI Act: ${result.euTier}. SDAIA: ${result.sdaiaTier}.` }
}

async function classifyAndStore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string,
  systemId: string
): Promise<{ euTier: string; sdaiaTier: string } | { error: string }> {
  const [{ data: system }, { data: rules }] = await Promise.all([
    supabase
      .from('ai_systems')
      .select(
        'id, name, purpose, description, deployment_context, business_function, role, eu_market_exposure, is_generative, is_general_purpose, processes_personal_data, processes_special_category, processes_biometric_data, makes_automated_decisions, affects_legal_rights, human_in_the_loop, publicly_accessible, used_in_critical_infrastructure'
      )
      .eq('id', systemId)
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('ai_classification_rules')
      .select(
        'code, regime, risk_tier, title, description, citation, match_keywords, required_flags, obligations, ordinal'
      )
      .order('ordinal'),
  ])

  if (!system) return { error: 'System not found.' }

  const result = classifyAiSystem(system as AiSystemFacts, (rules ?? []) as AiRiskRule[])

  const rationale = [
    result.euAiAct.rationale,
    result.euAiAct.citation ? `Citation: ${result.euAiAct.citation}` : null,
    result.sdaia.rationale,
    result.warnings.length > 0 ? `Warnings: ${result.warnings.join(' ')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  const { error } = await supabase
    .from('ai_systems')
    .update({
      eu_ai_act_class: result.euAiAct.tier,
      eu_ai_act_rationale: rationale,
      sdaia_risk_tier: result.sdaia.tier,
      classification_at: new Date().toISOString(),
      classified_by_machine: true,
    })
    .eq('id', systemId)
    .eq('organization_id', orgId)

  if (error) {
    console.error('[grc] classification store failed', error)
    return { error: 'Could not store the classification.' }
  }

  await supabase.rpc('record_audit_event', {
    p_organization_id: orgId,
    p_actor_id: userId,
    p_actor_type: 'user',
    p_action: 'ai_system.classified',
    p_entity_type: 'ai_system',
    p_entity_id: systemId,
    p_summary: `${system.name} classified: EU AI Act ${result.euAiAct.tier}, SDAIA ${result.sdaia.tier}`,
    p_metadata: {
      euAiActTier: result.euAiAct.tier,
      euAiActRule: result.euAiAct.ruleCode,
      sdaiaTier: result.sdaia.tier,
      warnings: result.warnings,
    },
  })

  return {
    euTier: result.euAiAct.tier ?? 'unknown',
    sdaiaTier: result.sdaia.tier ?? 'unknown',
  }
}

// -----------------------------------------------------------------------------
// Third parties
// -----------------------------------------------------------------------------

const ASSESSMENT_STATUSES = [
  'not_started',
  'questionnaire_sent',
  'under_review',
  'approved',
  'approved_with_conditions',
  'rejected',
  'expired',
]

export async function createVendor(
  _prev: GrcActionState,
  formData: FormData
): Promise<GrcActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const name = formData.get('name')
  const category = formData.get('category')
  const country = formData.get('country')
  const criticality = String(formData.get('criticality') ?? 'medium')
  const dataResidency = formData.get('dataResidency')

  if (typeof name !== 'string' || name.trim().length < 2) {
    return { error: 'Give the third party a name.' }
  }
  if (!['low', 'medium', 'high', 'critical'].includes(criticality)) {
    return { error: 'Unsupported criticality.' }
  }

  const supabase = await createClient()

  const { data: vendor, error } = await supabase
    .from('vendors')
    .insert({
      organization_id: auth.orgId,
      name: name.trim().slice(0, 300),
      category: typeof category === 'string' && category.trim() ? category.trim() : null,
      country: typeof country === 'string' && country.trim() ? country.trim() : null,
      criticality,
      is_cloud_provider: formData.get('isCloudProvider') === 'on',
      data_residency:
        typeof dataResidency === 'string' && dataResidency.trim()
          ? dataResidency.trim()
          : null,
      assessment_status: 'not_started',
      owner_id: auth.userId,
    })
    .select('id')
    .single()

  if (error || !vendor) {
    console.error('[grc] vendor insert failed', error)
    return { error: 'Could not add the third party.' }
  }

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: 'vendor.created',
    p_entity_type: 'vendor',
    p_entity_id: vendor.id,
    p_summary: `Third party added: ${name.trim()}`,
    p_metadata: { criticality },
  })

  revalidatePath('/dashboard/vendors')
  return { success: 'Third party added.' }
}

export async function updateVendorAssessment(
  _prev: GrcActionState,
  formData: FormData
): Promise<GrcActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const vendorId = formData.get('vendorId')
  const status = String(formData.get('assessmentStatus') ?? '')
  const residualRisk = formData.get('residualRisk')

  if (typeof vendorId !== 'string' || !vendorId) return { error: 'Missing third party.' }
  if (!ASSESSMENT_STATUSES.includes(status)) {
    return { error: 'Unsupported assessment status.' }
  }

  const supabase = await createClient()
  const now = new Date()
  const nextReview = new Date(now)
  nextReview.setUTCFullYear(nextReview.getUTCFullYear() + 1)

  const { data: vendor, error } = await supabase
    .from('vendors')
    .update({
      assessment_status: status,
      residual_risk: typeof residualRisk === 'string' && residualRisk ? residualRisk : null,
      last_reviewed_at: now.toISOString(),
      next_review_at: nextReview.toISOString().slice(0, 10),
    })
    .eq('id', vendorId)
    .eq('organization_id', auth.orgId)
    .select('name')
    .maybeSingle()

  if (error) {
    console.error('[grc] vendor update failed', error)
    return { error: 'Could not update the third party.' }
  }
  if (!vendor) return { error: 'Third party not found.' }

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: 'vendor.assessed',
    p_entity_type: 'vendor',
    p_entity_id: vendorId,
    p_summary: `${vendor.name} assessment set to ${status.replace(/_/g, ' ')}`,
    p_metadata: { assessmentStatus: status },
  })

  revalidatePath('/dashboard/vendors')
  return { success: 'Assessment updated.' }
}

// -----------------------------------------------------------------------------
// Framework provisioning
// -----------------------------------------------------------------------------

/** Mirrors public.next_obligation_due_date: event-driven duties have no date. */
function nextDueDate(cadence: string): string | null {
  if (cadence === 'continuous' || cadence === 'event_driven') return null

  const months: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    semiannual: 6,
    annual: 12,
    biennial: 24,
    triennial: 36,
  }

  const date = new Date()
  if (cadence === 'one_time') {
    date.setUTCDate(date.getUTCDate() + 30)
  } else {
    date.setUTCMonth(date.getUTCMonth() + (months[cadence] ?? 12))
  }
  return date.toISOString().slice(0, 10)
}

export async function provisionFrameworks(
  _prev: GrcActionState,
  formData: FormData
): Promise<GrcActionState> {
  let context
  try {
    context = await getDashboardContext()
  } catch {
    return { error: 'Your session has expired. Please sign in again.' }
  }
  if (!context.orgId) return { error: 'Your account is not linked to an organization.' }
  if (!context.isAdmin) {
    return { error: 'Only an owner or admin can change the framework set.' }
  }

  const orgId = context.orgId
  const codes = formData
    .getAll('frameworkCodes')
    .filter((v): v is string => typeof v === 'string' && v.length > 0)

  if (codes.length === 0) return { error: 'Select at least one framework.' }

  const supabase = await createClient()

  // provision_organization() is SECURITY DEFINER and granted to service_role only,
  // so it cannot run on the caller's session client. Instantiate directly instead
  // — RLS still confines every write to the caller's own tenant.
  const { data: catalogue, error: catalogueError } = await supabase
    .from('framework_controls_expanded')
    .select('id, framework_code, control_code, control_title')
    .in('framework_code', codes)
    .limit(2000)

  if (catalogueError) {
    console.error('[grc] catalogue read failed', catalogueError)
    return { error: 'Could not read the framework catalogue.' }
  }

  const controlRows = (catalogue ?? []).flatMap((row) =>
    row.id && row.framework_code && row.control_code && row.control_title
      ? [
          {
            organization_id: orgId,
            framework_control_id: row.id,
            framework_code: row.framework_code,
            control_code: row.control_code,
            title: row.control_title,
          },
        ]
      : []
  )

  if (controlRows.length > 0) {
    const { error: controlError } = await supabase.from('controls').upsert(controlRows, {
      onConflict: 'organization_id,framework_code,control_code',
      ignoreDuplicates: true,
    })

    if (controlError) {
      console.error('[grc] control provisioning failed', controlError)
      return { error: 'Could not instantiate the control library.' }
    }
  }

  const { data: templates } = await supabase
    .from('obligation_templates')
    .select(
      'id, title, description, cadence, severity, evidence_required, frameworks ( code )'
    )
    .limit(500)

  const codeSet = new Set(codes)

  const obligationRows = (templates ?? []).flatMap((template) => {
    const framework = Array.isArray(template.frameworks)
      ? template.frameworks[0]
      : template.frameworks
    if (!framework || !codeSet.has(framework.code)) return []

    return [
      {
        organization_id: orgId,
        template_id: template.id,
        framework_code: framework.code,
        title: template.title,
        description: template.description,
        cadence: template.cadence,
        due_date: nextDueDate(template.cadence),
        severity: template.severity,
        evidence_required: template.evidence_required,
        source: 'template',
        status: 'upcoming',
      },
    ]
  })

  if (obligationRows.length > 0) {
    const { error: obligationError } = await supabase
      .from('obligations')
      .upsert(obligationRows, { ignoreDuplicates: true })

    if (obligationError) {
      console.error('[grc] obligation provisioning failed', obligationError)
      return {
        error:
          'Controls were instantiated, but the obligation calendar could not be built.',
      }
    }
  }

  await supabase
    .from('machine_settings')
    .upsert(
      { organization_id: orgId, watch_frameworks: codes },
      { onConflict: 'organization_id' }
    )

  await supabase.rpc('record_audit_event', {
    p_organization_id: orgId,
    p_actor_id: context.userId,
    p_actor_type: 'user',
    p_action: 'organization.frameworks_provisioned',
    p_entity_type: 'organization',
    p_entity_id: orgId,
    p_summary: `Provisioned ${codes.length} framework(s): ${codes.join(', ')}`,
    p_metadata: {
      frameworks: codes,
      controlsInstantiated: controlRows.length,
      obligationsCreated: obligationRows.length,
    },
  })

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/compliance')
  revalidatePath('/dashboard/obligations')
  revalidatePath('/dashboard')

  return {
    success: `${controlRows.length} control(s) and ${obligationRows.length} obligation(s) are now in place.`,
  }
}
