import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * The per-request tenant context every dashboard page needs.
 *
 * Resolved once in the dashboard layout rather than re-queried per page. `orgId`
 * is the tenant key behind every RLS policy, so a page proceeding without one
 * would render an empty screen instead of an explicable error — which is why an
 * account with no organization is surfaced rather than tolerated.
 */

type OrganizationRow = {
  id: string
  name: string
  country: string | null
  industry: string | null
  type: string
}

type OrganizationRelation = OrganizationRow | OrganizationRow[] | null

function firstOrganization(relation: OrganizationRelation): OrganizationRow | null {
  if (!relation) return null
  return Array.isArray(relation) ? (relation[0] ?? null) : relation
}

export type DashboardContext = {
  userId: string
  email: string
  fullName: string | null
  role: string
  orgId: string | null
  orgName: string | null
  orgType: string | null
  orgCountry: string | null
  orgIndustry: string | null
  /** Module slugs the tenant has enabled. Drives the sidebar. */
  enabledModules: string[]
  unreadNotifications: number
  canWrite: boolean
  isAdmin: boolean
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
    .select(
      'full_name, email, role, organization_id, organizations ( id, name, country, industry, type )'
    )
    .eq('id', user.id)
    .single()

  const organization = firstOrganization(
    (profile?.organizations as OrganizationRelation) ?? null
  )

  const orgId = profile?.organization_id ?? null
  const role = profile?.role ?? 'member'

  // Both are tenant-scoped, cheap, and needed to render the shell.
  const [modulesResult, notificationsResult] = await Promise.all([
    orgId
      ? supabase
          .from('organization_modules')
          .select('modules ( slug )')
          .eq('organization_id', orgId)
          .eq('enabled', true)
      : Promise.resolve({ data: null }),
    orgId
      ? supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('profile_id', user.id)
          .is('read_at', null)
      : Promise.resolve({ count: 0 }),
  ])

  const enabledModules = (modulesResult.data ?? []).flatMap((row) => {
    const related = row.modules as { slug: string } | { slug: string }[] | null
    if (!related) return []
    return Array.isArray(related) ? related.map((m) => m.slug) : [related.slug]
  })

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? '',
    fullName: profile?.full_name ?? null,
    role,
    orgId,
    orgName: organization?.name ?? null,
    orgType: organization?.type ?? null,
    orgCountry: organization?.country ?? null,
    orgIndustry: organization?.industry ?? null,
    enabledModules,
    unreadNotifications:
      'count' in notificationsResult ? (notificationsResult.count ?? 0) : 0,
    canWrite: role !== 'auditor',
    isAdmin: role === 'owner' || role === 'admin',
  }
}

/**
 * Same context, but guarantees a tenant. Use in pages that cannot render anything
 * meaningful without one.
 */
export async function requireOrganization(): Promise<
  DashboardContext & { orgId: string }
> {
  const context = await getDashboardContext()
  if (!context.orgId) {
    redirect('/dashboard?error=no_organization')
  }
  return context as DashboardContext & { orgId: string }
}
