import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'org'
}

export async function uniqueOrgSlug(
  admin: SupabaseClient<Database>,
  name: string
): Promise<string> {
  const base = slugify(name)
  let slug = base
  let suffix = 2

  while (true) {
    const { data } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!data) return slug

    slug = `${base}-${suffix}`
    suffix++
  }
}
