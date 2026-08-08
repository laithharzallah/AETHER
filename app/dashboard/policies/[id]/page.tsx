import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CircleAlert, CircleCheck } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Pill, StatusPill } from '@/components/dashboard/pills'
import { PolicyLifecycle } from '@/components/policies/policy-lifecycle'
import { PolicyMarkdown } from '@/components/policies/policy-markdown'
import {
  assessPolicyCompleteness,
  type RequiredSection,
} from '@/lib/policy/completeness'
import { formatDate, formatDateTime, formatRelativeDays } from '@/lib/dashboard/format'

export const dynamic = 'force-dynamic'

function parseRequiredSections(value: unknown): RequiredSection[] {
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

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const context = await requireOrganization()
  const supabase = await createClient()

  const { data: policy } = await supabase
    .from('policies')
    .select(
      `id, title, policy_type, status, version, classification, content_md, content_hash,
       framework_codes, source, effective_date, next_review_at, review_cadence,
       approved_at, published_at, updated_at,
       policy_templates ( code, title, required_sections )`
    )
    .eq('id', id)
    .eq('organization_id', context.orgId)
    .maybeSingle()

  if (!policy) notFound()

  const [versions, approvals, coverage] = await Promise.all([
    supabase
      .from('policy_versions')
      .select('version, change_summary, status_at_snapshot, created_at')
      .eq('policy_id', id)
      .order('version', { ascending: false })
      .limit(20),
    supabase
      .from('policy_approvals')
      .select('version, decision, comment, decided_at')
      .eq('policy_id', id)
      .order('decided_at', { ascending: false })
      .limit(10),
    supabase
      .from('policy_control_coverage')
      .select('coverage, framework_controls ( code, title, frameworks ( code ) )')
      .eq('policy_id', id)
      .limit(300),
  ])

  const templateRelation = policy.policy_templates as
    | { code: string; title: string; required_sections: unknown }
    | { code: string; title: string; required_sections: unknown }[]
    | null

  const template = Array.isArray(templateRelation)
    ? templateRelation[0]
    : templateRelation

  const requiredSections = parseRequiredSections(template?.required_sections)

  const completeness =
    requiredSections.length > 0
      ? assessPolicyCompleteness(policy.content_md, requiredSections)
      : null

  const coverageRows = (coverage.data ?? []).flatMap((row) => {
    const control = row.framework_controls as {
      code: string
      title: string
      frameworks: { code: string } | { code: string }[] | null
    } | null
    if (!control) return []
    const framework = Array.isArray(control.frameworks)
      ? control.frameworks[0]
      : control.frameworks
    return [
      { code: control.code, title: control.title, frameworkCode: framework?.code ?? '—' },
    ]
  })

  const coverageByFramework = coverageRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.frameworkCode] = (acc[row.frameworkCode] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link
        href="/dashboard/policies"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All policies
      </Link>

      <PageHeader
        title={policy.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={policy.status} />
            <Pill>v{policy.version}</Pill>
            <Pill>{policy.classification}</Pill>
            {policy.source === 'ai_generated' && <Pill tone="info">AI-drafted</Pill>}
            <span className="text-xs">{policy.policy_type}</span>
          </span>
        }
        actions={
          context.canWrite ? (
            <PolicyLifecycle
              policyId={policy.id}
              status={policy.status}
              isAdmin={context.isAdmin}
            />
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {completeness && (
            <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-medium">Completeness</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Against the {template?.title} template&rsquo;s{' '}
                    {requiredSections.length} required sections.
                  </p>
                </div>
                <p
                  className={
                    completeness.score >= 90
                      ? 'text-2xl font-semibold text-emerald-600 tabular-nums dark:text-emerald-400'
                      : completeness.score >= 60
                        ? 'text-2xl font-semibold text-amber-600 tabular-nums dark:text-amber-400'
                        : 'text-2xl font-semibold text-destructive tabular-nums'
                  }
                >
                  {completeness.score}%
                </p>
              </div>

              <ul className="mt-4 space-y-1.5">
                {completeness.sections.map((section) => (
                  <li key={section.heading} className="flex items-start gap-2 text-xs">
                    {section.present && !section.thin ? (
                      <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <CircleAlert
                        className={
                          section.present
                            ? 'mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400'
                            : 'mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive'
                        }
                      />
                    )}
                    <span className={section.present ? '' : 'text-muted-foreground'}>
                      {section.heading}
                      {section.present && section.thin && (
                        <span className="text-muted-foreground">
                          {' '}
                          — only {section.wordCount} words
                        </span>
                      )}
                      {!section.present && (
                        <span className="text-muted-foreground"> — missing</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {completeness.warnings.length > 0 && (
                <ul className="mt-4 space-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  {completeness.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-medium">Document</h2>
            <div className="prose-policy rounded-xl border border-border/60 bg-card p-6">
              <PolicyMarkdown>{policy.content_md}</PolicyMarkdown>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="text-sm font-medium">Details</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <Detail label="Effective" value={formatDate(policy.effective_date)} />
              <Detail
                label="Next review"
                value={
                  policy.next_review_at
                    ? `${formatDate(policy.next_review_at)} (${formatRelativeDays(policy.next_review_at)})`
                    : 'Not set until published'
                }
              />
              <Detail label="Review cadence" value={policy.review_cadence} />
              <Detail label="Approved" value={formatDateTime(policy.approved_at)} />
              <Detail label="Published" value={formatDateTime(policy.published_at)} />
              <Detail label="Last updated" value={formatDateTime(policy.updated_at)} />
              <Detail
                label="Content hash"
                value={
                  policy.content_hash ? (
                    <code
                      className="text-[10px] break-all"
                      title="SHA-256 of the current content. Matches the snapshot in the version history."
                    >
                      {policy.content_hash.slice(0, 24)}…
                    </code>
                  ) : (
                    '—'
                  )
                }
              />
            </dl>
          </section>

          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="text-sm font-medium">Control coverage</h2>
            {coverageRows.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No framework controls are cited. Without citations this policy cannot be
                mapped to the obligations it is meant to discharge, and an assessor has
                nothing to trace.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  {coverageRows.length} control(s) referenced across{' '}
                  {Object.keys(coverageByFramework).length} framework(s).
                </p>
                <div className="mt-3 space-y-2">
                  {Object.entries(coverageByFramework).map(([code, count]) => (
                    <div key={code} className="flex items-center justify-between text-xs">
                      <span>{code}</span>
                      <span className="text-muted-foreground tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Show all controls
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {coverageRows.map((row) => (
                      <li key={`${row.frameworkCode}-${row.code}`}>
                        <span className="font-medium text-foreground">
                          {row.frameworkCode} {row.code}
                        </span>{' '}
                        {row.title}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            )}
          </section>

          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="text-sm font-medium">Version history</h2>
            <ol className="mt-3 space-y-3">
              {(versions.data ?? []).map((version) => (
                <li key={version.version} className="text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">v{version.version}</span>
                    {version.status_at_snapshot && (
                      <StatusPill status={version.status_at_snapshot} />
                    )}
                    <span className="text-muted-foreground">
                      {formatRelativeDays(version.created_at)}
                    </span>
                  </div>
                  {version.change_summary && (
                    <p className="mt-0.5 text-muted-foreground">
                      {version.change_summary}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          {(approvals.data ?? []).length > 0 && (
            <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="text-sm font-medium">Approval trail</h2>
              <ol className="mt-3 space-y-3">
                {(approvals.data ?? []).map((approval, index) => (
                  <li key={index} className="text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill
                        status={approval.decision === 'approved' ? 'approved' : 'draft'}
                      />
                      <span className="tabular-nums">v{approval.version}</span>
                      <span className="text-muted-foreground">
                        {formatRelativeDays(approval.decided_at)}
                      </span>
                    </div>
                    {approval.comment && (
                      <p className="mt-0.5 text-muted-foreground">{approval.comment}</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}
