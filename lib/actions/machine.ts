'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDashboardContext } from '@/lib/dashboard/get-dashboard-context'

/**
 * Directive and signal triage.
 *
 * Server Functions are reachable by direct POST, not only through the UI, so each
 * one re-checks the session and the caller's role rather than trusting that the
 * button was rendered only for someone entitled to press it. RLS is the backstop;
 * these checks are what turn a denied write into an explicable message.
 */

export type ActionState = { error?: string; success?: string }

type Writer = { orgId: string; userId: string; isAdmin: boolean }

async function requireWriter(): Promise<Writer | { error: string }> {
  let context
  try {
    context = await getDashboardContext()
  } catch {
    return { error: 'Your session has expired. Please sign in again.' }
  }

  if (!context.orgId) return { error: 'Your account is not linked to an organization.' }
  if (!context.canWrite) return { error: 'Your role is read-only.' }

  return { orgId: context.orgId, userId: context.userId, isAdmin: context.isAdmin }
}

export async function acknowledgeDirective(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const directiveId = formData.get('directiveId')
  if (typeof directiveId !== 'string' || !directiveId) {
    return { error: 'Missing directive.' }
  }

  const supabase = await createClient()

  const { data: directive, error } = await supabase
    .from('machine_directives')
    .update({
      status: 'acknowledged',
      acknowledged_by: auth.userId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', directiveId)
    .eq('organization_id', auth.orgId)
    .select('title')
    .maybeSingle()

  if (error) {
    console.error('[machine] acknowledge failed', error)
    return { error: 'Could not acknowledge this directive.' }
  }
  if (!directive) return { error: 'Directive not found.' }

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: 'directive.acknowledged',
    p_entity_type: 'machine_directive',
    p_entity_id: directiveId,
    p_summary: `Acknowledged: ${directive.title}`,
  })

  revalidatePath('/dashboard/machine')
  revalidatePath('/dashboard')
  return { success: 'Acknowledged.' }
}

export async function dismissDirective(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const directiveId = formData.get('directiveId')
  const reason = formData.get('reason')

  if (typeof directiveId !== 'string' || !directiveId) {
    return { error: 'Missing directive.' }
  }
  // A dismissal with no reason is indistinguishable from an oversight when an
  // auditor reads the trail a year later, so it is required.
  if (typeof reason !== 'string' || reason.trim().length < 5) {
    return { error: 'Give a reason for dismissing this, so the decision is auditable.' }
  }

  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: directive, error } = await supabase
    .from('machine_directives')
    .update({
      status: 'dismissed',
      dismissal_reason: reason.trim(),
      acknowledged_by: auth.userId,
      acknowledged_at: now,
      resolved_at: now,
    })
    .eq('id', directiveId)
    .eq('organization_id', auth.orgId)
    .select('title')
    .maybeSingle()

  if (error) {
    console.error('[machine] dismiss failed', error)
    return { error: 'Could not dismiss this directive.' }
  }
  if (!directive) return { error: 'Directive not found.' }

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: 'directive.dismissed',
    p_entity_type: 'machine_directive',
    p_entity_id: directiveId,
    p_summary: `Dismissed: ${directive.title}`,
    p_metadata: { reason: reason.trim() },
  })

  revalidatePath('/dashboard/machine')
  revalidatePath('/dashboard')
  return { success: 'Dismissed.' }
}

/**
 * Turns a directive into a task, linking the two so the trail shows what the
 * Machine advised and what a human then did about it.
 */
export async function actOnDirective(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const directiveId = formData.get('directiveId')
  const actionIndex = Number(formData.get('actionIndex') ?? '0')

  if (typeof directiveId !== 'string' || !directiveId) {
    return { error: 'Missing directive.' }
  }

  const supabase = await createClient()

  const { data: directive } = await supabase
    .from('machine_directives')
    .select(
      'id, title, reasoning, priority, subject_type, subject_id, recommended_actions, resulting_task_id'
    )
    .eq('id', directiveId)
    .eq('organization_id', auth.orgId)
    .maybeSingle()

  if (!directive) return { error: 'Directive not found.' }
  if (directive.resulting_task_id) {
    return { error: 'A task has already been created for this directive.' }
  }

  const actions = Array.isArray(directive.recommended_actions)
    ? (directive.recommended_actions as Array<Record<string, unknown>>)
    : []

  const chosen = actions[actionIndex]
  if (!chosen || typeof chosen.label !== 'string') {
    return { error: 'That recommended action is no longer available.' }
  }

  const taskType = typeof chosen.taskType === 'string' ? chosen.taskType : 'remediation'
  const description = typeof chosen.description === 'string' ? chosen.description : ''

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      organization_id: auth.orgId,
      title: `${chosen.label}: ${directive.title}`.slice(0, 300),
      description: `${description}\n\nCreated from AETHER directive: ${directive.title}\n\nReasoning:\n${directive.reasoning}`,
      task_type: taskType,
      priority: directive.priority === 'urgent' ? 'urgent' : directive.priority,
      status: 'open',
      owner_id: auth.userId,
      created_by: auth.userId,
      control_id: directive.subject_type === 'control' ? directive.subject_id : null,
      policy_id: directive.subject_type === 'policy' ? directive.subject_id : null,
      obligation_id:
        directive.subject_type === 'obligation' ? directive.subject_id : null,
      risk_signal_id:
        directive.subject_type === 'risk_signal' ? directive.subject_id : null,
    })
    .select('id')
    .single()

  if (taskError || !task) {
    console.error('[machine] task creation failed', taskError)
    return { error: 'Could not create the task.' }
  }

  const now = new Date().toISOString()

  await supabase
    .from('machine_directives')
    .update({
      status: 'actioned',
      resulting_task_id: task.id,
      acknowledged_by: auth.userId,
      acknowledged_at: now,
      resolved_at: now,
    })
    .eq('id', directiveId)
    .eq('organization_id', auth.orgId)

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: 'directive.actioned',
    p_entity_type: 'machine_directive',
    p_entity_id: directiveId,
    p_summary: `Created task "${chosen.label}" from directive: ${directive.title}`,
    p_metadata: { taskId: task.id, taskType },
  })

  revalidatePath('/dashboard/machine')
  revalidatePath('/dashboard')
  return { success: `Task created: ${chosen.label}` }
}

/** Triage on the Risk Horizon feed. */
export async function triageSignal(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const assessmentId = formData.get('assessmentId')
  const status = formData.get('status')
  const reason = formData.get('reason')

  if (typeof assessmentId !== 'string' || !assessmentId) {
    return { error: 'Missing signal.' }
  }
  if (status !== 'triaged' && status !== 'dismissed' && status !== 'actioned') {
    return { error: 'Unsupported triage status.' }
  }
  if (
    status === 'dismissed' &&
    (typeof reason !== 'string' || reason.trim().length < 5)
  ) {
    return { error: 'Give a reason for dismissing this signal.' }
  }

  const supabase = await createClient()

  const { data: assessment, error } = await supabase
    .from('signal_assessments')
    .update({
      status,
      triaged_by: auth.userId,
      triaged_at: new Date().toISOString(),
      dismissal_reason:
        status === 'dismissed' && typeof reason === 'string' ? reason.trim() : null,
    })
    .eq('id', assessmentId)
    .eq('organization_id', auth.orgId)
    .select('risk_signal_id')
    .maybeSingle()

  if (error) {
    console.error('[machine] triage failed', error)
    return { error: 'Could not update this signal.' }
  }
  if (!assessment) return { error: 'Signal not found.' }

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: `signal.${status}`,
    p_entity_type: 'risk_signal',
    p_entity_id: assessment.risk_signal_id,
    p_summary: `Signal marked ${status}`,
    p_metadata:
      status === 'dismissed' && typeof reason === 'string'
        ? { reason: reason.trim() }
        : {},
  })

  revalidatePath('/dashboard/risk-horizon')
  revalidatePath('/dashboard/machine')
  return { success: `Marked ${status}.` }
}

/** Engine configuration. Admin only — autonomy_level governs unattended writes. */
export async function updateMachineSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let context
  try {
    context = await getDashboardContext()
  } catch {
    return { error: 'Your session has expired. Please sign in again.' }
  }

  if (!context.orgId) return { error: 'Your account is not linked to an organization.' }
  if (!context.isAdmin) {
    return { error: 'Only an owner or admin can change the engine configuration.' }
  }

  const autonomyLevel = String(formData.get('autonomyLevel') ?? '')
  const enabled = formData.get('enabled') === 'on'
  const digestCadence = String(formData.get('digestCadence') ?? 'weekly')
  const alertThreshold = Number(formData.get('minRelevanceToAlert') ?? '0.35')
  const actThreshold = Number(formData.get('minRelevanceToAct') ?? '0.75')

  if (!['observe', 'advise', 'act'].includes(autonomyLevel)) {
    return { error: 'Unsupported autonomy level.' }
  }
  if (!['off', 'daily', 'weekly', 'monthly'].includes(digestCadence)) {
    return { error: 'Unsupported digest cadence.' }
  }
  for (const [label, value] of [
    ['alert threshold', alertThreshold],
    ['action threshold', actThreshold],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      return { error: `The ${label} must be between 0 and 1.` }
    }
  }
  if (actThreshold < alertThreshold) {
    return {
      error:
        'The action threshold cannot be lower than the alert threshold — the engine would act on directives it never raised.',
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('machine_settings').upsert(
    {
      organization_id: context.orgId,
      enabled,
      autonomy_level: autonomyLevel,
      digest_cadence: digestCadence,
      min_relevance_to_alert: alertThreshold,
      min_relevance_to_act: actThreshold,
    },
    { onConflict: 'organization_id' }
  )

  if (error) {
    console.error('[machine] settings update failed', error)
    return { error: 'Could not save the configuration.' }
  }

  await supabase.rpc('record_audit_event', {
    p_organization_id: context.orgId,
    p_actor_id: context.userId,
    p_actor_type: 'user',
    p_action: 'machine.settings_updated',
    p_entity_type: 'machine_settings',
    p_entity_id: context.orgId,
    p_summary: `Engine set to ${enabled ? autonomyLevel : 'disabled'}`,
    p_metadata: {
      enabled,
      autonomyLevel,
      minRelevanceToAlert: alertThreshold,
      minRelevanceToAct: actThreshold,
    },
  })

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/machine')
  return { success: 'Configuration saved.' }
}

/** Marks the caller's unread notifications as read. */
export async function markNotificationsRead(): Promise<ActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('organization_id', auth.orgId)
    .eq('profile_id', auth.userId)
    .is('read_at', null)

  if (error) {
    console.error('[machine] mark read failed', error)
    return { error: 'Could not update your notifications.' }
  }

  revalidatePath('/dashboard/notifications')
  revalidatePath('/dashboard')
  return { success: 'Marked as read.' }
}
