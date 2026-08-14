import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { hasAnthropicKey } from '@/lib/anthropic'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/dashboard/empty-state'
import {
  PolicyGeneratorForm,
  type FrameworkOption,
  type TemplateOption,
} from '@/components/policies/policy-generator-form'

export const dynamic = 'force-dynamic'

function parseSections(value: unknown): TemplateOption['required_sections'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const record = entry as Record<string, unknown>
    if (typeof record.heading !== 'string') return []
    return [
      {
        heading: record.heading,
        guidance: typeof record.guidance === 'string' ? record.guidance : undefined,
      },
    ]
  })
}

export default async function PolicyGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>
}) {
  const context = await requireOrganization()
  const { template: initialTemplate } = await searchParams

  if (!context.canWrite) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Policy Generator" />
        <EmptyState
          className="mt-8"
          icon={Sparkles}
          title="Read-only access"
          description="Your role can read the policy set but not draft new policies."
          action={
            <Link href="/dashboard/policies" className="text-sm underline underline-offset-4">
              View existing policies
            </Link>
          }
        />
      </div>
    )
  }

  const supabase = await createClient()

  const [templates, frameworks, heldFrameworks] = await Promise.all([
    supabase
      .from('policy_templates')
      .select('code, title, description, framework_codes, required_sections')
      .order('code'),
    supabase
      .from('frameworks')
      .select('code, name, short_name, regulator, mandatory')
      .order('code'),
    supabase
      .from('controls')
      .select('framework_code')
      .eq('organization_id', context.orgId)
      .neq('applicability', 'not_applicable'),
  ])

  const held = new Set((heldFrameworks.data ?? []).map((row) => row.framework_code))

  const templateOptions: TemplateOption[] = (templates.data ?? []).map((row) => ({
    code: row.code,
    title: row.title,
    description: row.description,
    framework_codes: row.framework_codes ?? [],
    required_sections: parseSections(row.required_sections),
  }))

  // Frameworks the tenant holds come first: those are the ones whose controls can
  // actually be cited.
  const frameworkOptions: FrameworkOption[] = (frameworks.data ?? [])
    .map((row) => ({
      code: row.code,
      name: row.name,
      short_name: row.short_name,
      regulator: row.regulator,
      mandatory: row.mandatory,
      held: held.has(row.code),
    }))
    .sort((a, b) => {
      if (a.held !== b.held) return a.held ? -1 : 1
      if (a.mandatory !== b.mandatory) return a.mandatory ? -1 : 1
      return a.code.localeCompare(b.code)
    })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Policy Generator"
        description="Drafts a board-grade policy against the real control identifiers in the frameworks you hold, then scores the result against the template's required sections. Review it before saving — the draft is a starting point, not an approved document."
      />

      {!hasAnthropicKey() && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
        >
          <p className="font-medium">Generation is unavailable</p>
          <p className="mt-1 text-muted-foreground">
            No <code className="text-xs">ANTHROPIC_API_KEY</code> is configured, so the
            model cannot be called. The templates below still show which sections each
            policy needs and which controls it should cite, so one can be written
            manually against them.
          </p>
        </div>
      )}

      <PolicyGeneratorForm
        templates={templateOptions}
        frameworks={frameworkOptions}
        initialTemplate={initialTemplate}
      />
    </div>
  )
}
