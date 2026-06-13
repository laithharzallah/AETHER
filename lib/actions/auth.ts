'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { uniqueOrgSlug } from '@/lib/utils/slug'

export type AuthState = {
  error?: string
}

function logSupabaseError(step: string, error: unknown) {
  console.error(step, JSON.stringify(error, null, 2))

  if (error && typeof error === 'object') {
    const err = error as {
      message?: string
      code?: string
      details?: string
      hint?: string
    }
    console.error(`${step} message:`, err.message ?? '(none)')
    console.error(`${step} code:`, err.code ?? '(none)')
    console.error(`${step} details:`, err.details ?? '(none)')
    console.error(`${step} hint:`, err.hint ?? '(none)')
    return
  }

  console.error(step, error)
}

export async function signup(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const organizationName = formData.get('organizationName') as string

  console.error('[signup][formData]', {
    fullName,
    orgName: organizationName,
    email,
    hasPassword: !!password,
  })
  console.error('[signup][formData keys]', [...formData.keys()])

  if (!email?.trim() || !password || !fullName?.trim() || !organizationName?.trim()) {
    return { error: 'All fields are required.' }
  }

  const admin = createAdminClient()
  let userId: string | null = null
  let orgId: string | null = null

  try {
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName.trim() },
    })

    if (userError) {
      logSupabaseError('[signup][createUser]', userError)
      if (
        userError.message.toLowerCase().includes('already') ||
        userError.status === 422
      ) {
        return { error: 'An account with this email already exists.' }
      }
      return { error: userError.message }
    }

    if (!userData.user) {
      return { error: 'Failed to create user account.' }
    }

    userId = userData.user.id

    const slug = await uniqueOrgSlug(admin, organizationName.trim())

    const orgPayload = {
      name: organizationName.trim(),
      slug,
      type: 'consulting_firm',
    }

    console.error('[signup][org insert] payload before call', orgPayload)

    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert(orgPayload)
      .select('id')
      .single()

    if (orgError || !org) {
      console.error('[signup][org insert] payload', orgPayload)
      logSupabaseError('[signup][org insert]', orgError)
      throw new Error('ORG_CREATE_FAILED')
    }

    orgId = org.id

    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      organization_id: orgId,
      email: email.trim(),
      full_name: fullName.trim(),
      role: 'owner',
    })

    if (profileError) {
      logSupabaseError('[signup][profile insert]', profileError)
      throw new Error('PROFILE_CREATE_FAILED')
    }
  } catch (error) {
    if (!(error instanceof Error && (error.message === 'ORG_CREATE_FAILED' || error.message === 'PROFILE_CREATE_FAILED'))) {
      console.error('[signup][unexpected]', error)
    }
    if (orgId) {
      await admin.from('organizations').delete().eq('id', orgId)
    }
    if (userId) {
      await admin.auth.admin.deleteUser(userId)
    }

    if (error instanceof Error && error.message === 'ORG_CREATE_FAILED') {
      return { error: 'Could not create your organization. Please try again.' }
    }
    if (error instanceof Error && error.message === 'PROFILE_CREATE_FAILED') {
      return { error: 'Account setup incomplete. Please contact support.' }
    }

    return { error: 'Something went wrong. Please try again.' }
  }

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (signInError) {
    logSupabaseError('[signup][signInWithPassword]', signInError)
    return {
      error: 'Account created but sign-in failed. Try logging in.',
    }
  }

  redirect('/dashboard')
}

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email?.trim() || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    return { error: 'Invalid email or password.' }
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
