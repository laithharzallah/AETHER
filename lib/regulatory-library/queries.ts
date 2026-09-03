import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/database.types'

export type FrameworkSummary = Tables<'framework_summary'>
export type Framework = Tables<'frameworks'>
export type Control = Tables<'controls'>

export const JURISDICTION_LABELS: Record<string, string> = {
  SA: 'Saudi Arabia',
  AE: 'United Arab Emirates',
  QA: 'Qatar',
  JO: 'Jordan',
  BH: 'Bahrain',
  KW: 'Kuwait',
  OM: 'Oman',
  EU: 'European Union',
  INTL: 'International',
}

export const CATEGORY_LABELS: Record<string, string> = {
  cybersecurity: 'Cybersecurity',
  'data-protection': 'Data Protection',
  'ai-governance': 'AI Governance',
  'technology-risk': 'Technology Risk',
  'information-security': 'Information Security',
}

export async function listFrameworks(): Promise<FrameworkSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('framework_summary')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[regulatory-library] listFrameworks', error)
    return []
  }
  return data ?? []
}

export async function getFrameworkByCode(
  code: string
): Promise<{ framework: FrameworkSummary; controls: Control[] } | null> {
  const supabase = await createClient()

  const { data: framework, error: frameworkError } = await supabase
    .from('framework_summary')
    .select('*')
    .eq('code', code)
    .maybeSingle()

  if (frameworkError || !framework?.id) {
    if (frameworkError) {
      console.error('[regulatory-library] getFrameworkByCode', frameworkError)
    }
    return null
  }

  const { data: controls, error: controlsError } = await supabase
    .from('controls')
    .select('*')
    .eq('framework_id', framework.id)
    .order('sort_order', { ascending: true })

  if (controlsError) {
    console.error('[regulatory-library] controls', controlsError)
    return { framework, controls: [] }
  }

  return { framework, controls: controls ?? [] }
}

/**
 * Lightweight control index used to ground AI generation:
 * ref + title (+ short requirement) for each selected framework code.
 */
export type ControlIndexEntry = {
  frameworkCode: string
  frameworkName: string
  ref: string
  title: string
  requirement: string
  id: string
}

export async function getControlIndex(
  frameworkCodes: string[]
): Promise<ControlIndexEntry[]> {
  if (frameworkCodes.length === 0) return []
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('controls')
    .select(
      'id, control_ref, title_en, requirement_en, sort_order, frameworks!inner ( code, short_name )'
    )
    .in('frameworks.code', frameworkCodes)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[regulatory-library] getControlIndex', error)
    return []
  }

  return (data ?? []).map((row) => {
    const fw = Array.isArray(row.frameworks) ? row.frameworks[0] : row.frameworks
    return {
      id: row.id,
      frameworkCode: fw?.code ?? '',
      frameworkName: fw?.short_name ?? '',
      ref: row.control_ref,
      title: row.title_en,
      requirement: row.requirement_en,
    }
  })
}

export async function getLibraryStats(): Promise<{
  frameworks: number
  controls: number
  jurisdictions: number
}> {
  const frameworks = await listFrameworks()
  return {
    frameworks: frameworks.length,
    controls: frameworks.reduce((n, f) => n + (f.control_count ?? 0), 0),
    jurisdictions: new Set(frameworks.map((f) => f.jurisdiction)).size,
  }
}
