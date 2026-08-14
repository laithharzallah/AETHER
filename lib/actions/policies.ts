'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TablesUpdate } from '@/lib/database.types'
import { getDashboardContext } from '@/lib/dashboard/get-dashboard-context'
import { extractCitedControls } from '@/lib/policy/completeness'

export type PolicyActionState = { error?: string; success?: string }

const REVIEW_MONTHS: Record<string, number> = {
  quarterly: 3,
  semiannual: 6,
  annual: 12,
  biennial: 24,
}

function nextReviewDate(cadence: string, from: Date): string {
  const date = new Date(from)
  date.setUTCMonth(date.getUTCMonth() + (REVIEW_MONTHS[cadence] ?? 12))
  return date.toISOString().slice(0, 10)
}

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

/**
 * Maps the control identifiers a policy cites onto the real catalogue.
 *
 * This is what makes a policy more than a document: it turns "we have an access
 * control policy" into "NCA ECC 2-2, SAMA CSF 3.3.5 and ISO 27001 A.5.15 are
 * demonstrably addressed". Citations that do not resolve to a catalogue control
 * are skipped — asserting coverage against a control that does not exist would be
 * worse than asserting none.
 */
async function syncPolicyCoverage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  policyId: string,
  contentMd: string,
  userId: string
): Promise<number> {
  const cited = extractCitedControls(contentMd)
  if (cited.length === 0) return 0

  const byFramework = new Map<string, string[]>()
  for (const citation of cited) {
    if (!citation.framework) continue
    const list = byFramework.get(citation.framework) ?? []
    list.push(citation.code)
    byFramework.set(citation.framework, list)
  }

  const resolved: string[] = []

  for (const [frameworkCode, codes] of byFramework) {
    const { data } = await supabase
      .from('framework_controls_expanded')
      .select('id')
      .eq('framework_code', frameworkCode)
      .in('control_code', codes)

    for (const row of data ?? []) {
      if (row.id) resolved.push(row.id)
    }
  }

  if (resolved.length === 0) return 0

  const { error } = await supabase.from('policy_control_coverage').upsert(
    resolved.map((controlId) => ({
      policy_id: policyId,
      organization_id: orgId,
      framework_control_id: controlId,
      // Citing a control is not the same as an assessor agreeing it is fully
      // addressed, so it is recorded as `referenced` until a human upgrades it.
      coverage: 'referenced',
      asserted_by: userId,
    })),
    { onConflict: 'policy_id,framework_control_id', ignoreDuplicates: true }
  )

  if (error) {
    console.error('[policies] coverage sync failed', error)
    return 0
  }

  return resolved.length
}

export async function createPolicy(
  _prev: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const title = formData.get('title')
  const policyType = formData.get('policyType')
  const contentMd = formData.get('contentMd')
  const templateCode = formData.get('templateCode')
  const source = formData.get('source')
  const frameworkCodes = formData
    .getAll('frameworkCodes')
    .filter((v): v is string => typeof v === 'string')

  if (typeof title !== 'string' || title.trim().length < 3) {
    return { error: 'Give the policy a title.' }
  }
  if (typeof policyType !== 'string' || !policyType.trim()) {
    return { error: 'Choose a policy type.' }
  }
  if (typeof contentMd !== 'string' || contentMd.trim().length < 50) {
    return { error: 'The policy content is too short to save.' }
  }

  const supabase = await createClient()

  let templateId: string | null = null
  let reviewCadence = 'annual'

  if (typeof templateCode === 'string' && templateCode) {
    const { data: template } = await supabase
      .from('policy_templates')
      .select('id, review_cadence')
      .eq('code', templateCode)
      .maybeSingle()
    templateId = template?.id ?? null
    reviewCadence = template?.review_cadence ?? 'annual'
  }

  const { data: policy, error } = await supabase
    .from('policies')
    .insert({
      organization_id: auth.orgId,
      template_id: templateId,
      title: title.trim().slice(0, 300),
      policy_type: policyType.trim(),
      content_md: contentMd,
      framework_codes: frameworkCodes,
      status: 'draft',
      review_cadence: reviewCadence,
      source: source === 'ai_generated' ? 'ai_generated' : 'manual',
      owner_id: auth.userId,
      created_by: auth.userId,
      generation_meta:
        source === 'ai_generated'
          ? { generatedAt: new Date().toISOString(), frameworks: frameworkCodes }
          : null,
    })
    .select('id')
    .single()

  if (error || !policy) {
    console.error('[policies] create failed', error)
    return { error: 'Could not save the policy.' }
  }

  const coverageCount = await syncPolicyCoverage(
    supabase,
    auth.orgId,
    policy.id,
    contentMd,
    auth.userId
  )

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: 'policy.created',
    p_entity_type: 'policy',
    p_entity_id: policy.id,
    p_summary: `Created policy "${title.trim()}"`,
    p_metadata: {
      source: source === 'ai_generated' ? 'ai_generated' : 'manual',
      frameworks: frameworkCodes,
      controlsReferenced: coverageCount,
    },
  })

  revalidatePath('/dashboard/policies')
  redirect(`/dashboard/policies/${policy.id}`)
}

export async function updatePolicyContent(
  _prev: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const policyId = formData.get('policyId')
  const contentMd = formData.get('contentMd')
  const changeSummary = formData.get('changeSummary')

  if (typeof policyId !== 'string' || !policyId) return { error: 'Missing policy.' }
  if (typeof contentMd !== 'string' || contentMd.trim().length < 50) {
    return { error: 'The policy content is too short to save.' }
  }

  const supabase = await createClient()

  // The database bumps the version and snapshots the previous content on any
  // content change, so this only writes the new body.
  const { data: policy, error } = await supabase
    .from('policies')
    .update({ content_md: contentMd, created_by: auth.userId })
    .eq('id', policyId)
    .eq('organization_id', auth.orgId)
    .select('id, title, version')
    .maybeSingle()

  if (error) {
    console.error('[policies] update failed', error)
    return { error: 'Could not save the changes.' }
  }
  if (!policy) return { error: 'Policy not found.' }

  if (typeof changeSummary === 'string' && changeSummary.trim()) {
    await supabase
      .from('policy_versions')
      .update({ change_summary: changeSummary.trim().slice(0, 1000) })
      .eq('policy_id', policyId)
      .eq('version', policy.version)
  }

  await syncPolicyCoverage(supabase, auth.orgId, policyId, contentMd, auth.userId)

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: 'policy.updated',
    p_entity_type: 'policy',
    p_entity_id: policyId,
    p_summary: `Updated "${policy.title}" to version ${policy.version}`,
    p_metadata: { version: policy.version },
  })

  revalidatePath(`/dashboard/policies/${policyId}`)
  return { success: `Saved as version ${policy.version}.` }
}

/**
 * Lifecycle transitions are enumerated rather than free-form: a policy that can
 * jump from draft straight to published has no approval trail, which is the first
 * thing an assessor looks for.
 */
const TRANSITIONS: Record<string, { to: string[]; requiresAdmin: boolean }> = {
  draft: { to: ['in_review'], requiresAdmin: false },
  in_review: { to: ['approved', 'draft'], requiresAdmin: true },
  approved: { to: ['published', 'draft'], requiresAdmin: true },
  published: { to: ['retired', 'draft'], requiresAdmin: true },
  retired: { to: ['draft'], requiresAdmin: true },
}

export async function transitionPolicy(
  _prev: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const auth = await requireWriter()
  if ('error' in auth) return auth

  const policyId = formData.get('policyId')
  const target = formData.get('targetStatus')
  const comment = formData.get('comment')

  if (typeof policyId !== 'string' || !policyId) return { error: 'Missing policy.' }
  if (typeof target !== 'string' || !target) return { error: 'Missing target status.' }

  const supabase = await createClient()

  const { data: policy } = await supabase
    .from('policies')
    .select('id, title, status, version, review_cadence, effective_date')
    .eq('id', policyId)
    .eq('organization_id', auth.orgId)
    .maybeSingle()

  if (!policy) return { error: 'Policy not found.' }

  const rule = TRANSITIONS[policy.status]
  if (!rule || !rule.to.includes(target)) {
    return {
      error: `A ${policy.status.replace(/_/g, ' ')} policy cannot move to ${target.replace(/_/g, ' ')}.`,
    }
  }
  if (rule.requiresAdmin && !auth.isAdmin) {
    return { error: 'Only an owner or admin can make this transition.' }
  }

  const now = new Date()
  const patch: TablesUpdate<'policies'> = { status: target }

  if (target === 'approved') {
    patch.approved_at = now.toISOString()
    patch.approver_id = auth.userId
  }
  if (target === 'published') {
    patch.published_at = now.toISOString()
    patch.effective_date = policy.effective_date ?? now.toISOString().slice(0, 10)
    // Set on publication, not creation: a draft has no review clock, and the
    // Machine's policy_stale detector keys on this date.
    patch.next_review_at = nextReviewDate(policy.review_cadence, now)
  }
  if (target === 'retired') {
    patch.retired_at = now.toISOString()
    patch.next_review_at = null
  }
  if (target === 'draft') {
    patch.approved_at = null
    patch.published_at = null
    patch.next_review_at = null
  }

  const { error } = await supabase
    .from('policies')
    .update(patch)
    .eq('id', policyId)
    .eq('organization_id', auth.orgId)

  if (error) {
    console.error('[policies] transition failed', error)
    return { error: 'Could not change the status.' }
  }

  if (target === 'approved' || target === 'draft') {
    await supabase.from('policy_approvals').insert({
      policy_id: policyId,
      organization_id: auth.orgId,
      version: policy.version,
      approver_id: auth.userId,
      decision: target === 'approved' ? 'approved' : 'changes_requested',
      comment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
    })
  }

  await supabase.rpc('record_audit_event', {
    p_organization_id: auth.orgId,
    p_actor_id: auth.userId,
    p_actor_type: 'user',
    p_action: `policy.${target}`,
    p_entity_type: 'policy',
    p_entity_id: policyId,
    p_summary: `"${policy.title}" moved from ${policy.status} to ${target}`,
    p_metadata: { from: policy.status, to: target, version: policy.version },
  })

  revalidatePath(`/dashboard/policies/${policyId}`)
  revalidatePath('/dashboard/policies')
  return { success: `Status changed to ${target.replace(/_/g, ' ')}.` }
}
