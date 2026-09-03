'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getControlIndex } from '@/lib/regulatory-library/queries'
import { extractCitedControlIds } from '@/lib/regulatory-library/citations'

export type SavePolicyInput = {
  title: string
  policyType: string
  frameworks: string[] // framework codes
  orgContext?: string
  contentMd: string
  model?: string
}

export type SavePolicyResult =
  | { ok: true; policyId: string; mappedControls: number }
  | { ok: false; error: string }

export async function savePolicy(
  input: SavePolicyInput
): Promise<SavePolicyResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: 'Not signed in.' }

  const title = input.title?.trim()
  const policyType = input.policyType?.trim()
  const contentMd = input.contentMd?.trim()
  const frameworks = (input.frameworks ?? []).filter(
    (f): f is string => typeof f === 'string' && f.length > 0
  )

  if (!title) return { ok: false, error: 'Title is required.' }
  if (!policyType) return { ok: false, error: 'Policy type is required.' }
  if (!contentMd) return { ok: false, error: 'Policy content is empty.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { ok: false, error: 'Your profile is not linked to an organization.' }
  }

  const { data: policy, error: insertError } = await supabase
    .from('policies')
    .insert({
      organization_id: profile.organization_id,
      title,
      policy_type: policyType,
      frameworks,
      org_context: input.orgContext?.trim() || null,
      content_md: contentMd,
      model: input.model ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insertError || !policy) {
    console.error('[savePolicy] insert', insertError)
    return { ok: false, error: 'Could not save the policy. Please try again.' }
  }

  // Map any control refs the model cited to library rows.
  let mappedControls = 0
  if (frameworks.length > 0) {
    const index = await getControlIndex(frameworks)
    const cited = extractCitedControlIds(contentMd, index)
    if (cited.length > 0) {
      const { error: mapError } = await supabase
        .from('policy_control_mappings')
        .insert(
          cited.map((controlId) => ({
            policy_id: policy.id,
            control_id: controlId,
            coverage: 'references',
          }))
        )
      if (mapError) {
        console.error('[savePolicy] mappings', mapError)
      } else {
        mappedControls = cited.length
      }
    }
  }

  revalidatePath('/dashboard/policies')
  revalidatePath('/dashboard')
  return { ok: true, policyId: policy.id, mappedControls }
}

export async function updatePolicyStatus(
  policyId: string,
  status: 'draft' | 'in_review' | 'approved' | 'archived'
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('policies')
    .update({ status })
    .eq('id', policyId)

  if (error) {
    console.error('[updatePolicyStatus]', error)
    return { ok: false, error: 'Could not update status.' }
  }

  revalidatePath('/dashboard/policies')
  revalidatePath(`/dashboard/policies/${policyId}`)
  return { ok: true }
}

export async function deletePolicy(policyId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('policies').delete().eq('id', policyId)

  if (error) {
    console.error('[deletePolicy]', error)
    throw new Error('Could not delete policy.')
  }

  revalidatePath('/dashboard/policies')
  redirect('/dashboard/policies')
}
