import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type OrganizationRelation = { id: string; name: string } | { id: string; name: string }[] | null

function extractOrgName(organizations: OrganizationRelation): string | null {
  if (!organizations) return null

  if (Array.isArray(organizations)) {
    return organizations[0]?.name ?? null
  }

  return organizations.name ?? null
}

export type DashboardContext = {
  userId: string
  email: string
  fullName: string | null
  role: string
  orgId: string | null
  orgName: string | null
}

export async function getDashboardContext(): Promise<DashboardContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role, organization_id, organizations ( id, name )')
    .eq('id', user.id)
    .single()

  const orgName = extractOrgName(
    (profile?.organizations as OrganizationRelation) ?? null
  )

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? '',
    fullName: profile?.full_name ?? null,
    role: profile?.role ?? 'member',
    orgId: profile?.organization_id ?? null,
    orgName,
  }
}
