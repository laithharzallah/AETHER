import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PolicyMarkdown } from '@/components/policy-markdown'
import { PolicyActions } from '@/components/policies/policy-actions'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: policy, error } = await supabase
    .from('policies')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[policy detail]', error)
  }
  if (!policy) {
    notFound()
  }

  const { data: mappings } = await supabase
    .from('policy_control_mappings')
    .select(
      'coverage, controls ( id, control_ref, title_en, title_ar, domain_en, frameworks ( code, short_name ) )'
    )
    .eq('policy_id', policy.id)

  type MappedControl = {
    coverage: string
    id: string
    ref: string
    title: string
    titleAr: string | null
    domain: string | null
    frameworkCode: string
    frameworkName: string
  }

  const mapped: MappedControl[] = (mappings ?? []).flatMap((m) => {
    const c = Array.isArray(m.controls) ? m.controls[0] : m.controls
    if (!c) return []
    const fw = Array.isArray(c.frameworks) ? c.frameworks[0] : c.frameworks
    return [
      {
        coverage: m.coverage,
        id: c.id,
        ref: c.control_ref,
        title: c.title_en,
        titleAr: c.title_ar,
        domain: c.domain_en,
        frameworkCode: fw?.code ?? '',
        frameworkName: fw?.short_name ?? '',
      },
    ]
  })

  const byFramework = new Map<string, MappedControl[]>()
  for (const m of mapped) {
    const key = m.frameworkName || m.frameworkCode
    if (!byFramework.has(key)) byFramework.set(key, [])
    byFramework.get(key)!.push(m)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/dashboard/policies"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Policies
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{policy.policy_type}</Badge>
            {(policy.frameworks ?? []).map((f) => (
              <Badge key={f} variant="ghost">
                {f}
              </Badge>
            ))}
          </div>
          <h1
            className="mt-3 text-3xl tracking-tight md:text-4xl"
            style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
          >
            {policy.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Version {policy.version} · Created {formatDate(policy.created_at)}
            {policy.updated_at !== policy.created_at &&
              ` · Updated ${formatDate(policy.updated_at)}`}
            {policy.model && ` · ${policy.model}`}
          </p>
        </div>
        <PolicyActions
          policyId={policy.id}
          status={policy.status}
          contentMd={policy.content_md}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <PolicyMarkdown markdown={policy.content_md} />

        <aside className="space-y-6">
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <h2 className="text-sm font-medium">Control mappings</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {mapped.length === 0
                ? 'No library controls were cited in this policy.'
                : `${mapped.length} library control${mapped.length === 1 ? '' : 's'} cited.`}
            </p>
            {[...byFramework.entries()].map(([name, items]) => (
              <div key={name} className="mt-4">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {name}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {items.map((m) => (
                    <li key={m.id} className="text-sm">
                      <Link
                        href={`/dashboard/regulations/${encodeURIComponent(m.frameworkCode)}`}
                        className="inline-flex items-start gap-2 hover:underline"
                      >
                        <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                          {m.ref}
                        </code>
                        <span className="text-foreground/90">{m.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {policy.org_context && (
            <div className="rounded-lg border border-border/60 bg-card p-4">
              <h2 className="text-sm font-medium">Organization context</h2>
              <p className="mt-2 text-sm whitespace-pre-wrap text-foreground/80">
                {policy.org_context}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
