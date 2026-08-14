import Link from 'next/link'
import { ScrollText, Sparkles } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'
import { Stat, StatGrid } from '@/components/dashboard/stat'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Pill, StatusPill } from '@/components/dashboard/pills'
import { formatDate, formatRelativeDays } from '@/lib/dashboard/format'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PoliciesPage() {
  const context = await requireOrganization()
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)

  const [policies, templates] = await Promise.all([
    supabase
      .from('policies')
      .select(
        'id, title, policy_type, status, version, framework_codes, next_review_at, updated_at, source'
      )
      .eq('organization_id', context.orgId)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase.from('policy_templates').select('code, title').order('code'),
  ])

  const rows = policies.data ?? []
  const countBy = (status: string) => rows.filter((p) => p.status === status).length
  const overdueReview = rows.filter(
    (p) => p.status === 'published' && p.next_review_at && p.next_review_at < today
  ).length

  // Templates with no corresponding policy. This is the gap an assessor finds
  // first, so it is surfaced rather than left to be inferred from an absence.
  const existingTypes = new Set(rows.map((p) => p.policy_type))
  const missingTemplates = (templates.data ?? []).filter(
    (t) => !existingTypes.has(t.title)
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Policies"
        description="The policy set, its version history, and the framework controls each policy demonstrably addresses."
        actions={
          context.canWrite ? (
            <Link
              href="/dashboard/policy-generator"
              className={cn(buttonVariants({ size: 'sm' }))}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              Draft a policy
            </Link>
          ) : undefined
        }
      />

      <StatGrid>
        <Stat label="Published" value={countBy('published')} tone="good" />
        <Stat label="In review" value={countBy('in_review')} hint="Awaiting approval" />
        <Stat label="Draft" value={countBy('draft')} hint="Not yet in force" />
        <Stat
          label="Review overdue"
          value={overdueReview}
          tone={overdueReview > 0 ? 'bad' : 'good'}
          hint="Published, past its review date"
        />
      </StatGrid>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No policies yet"
          description="Every framework in the catalogue expects a documented, approved policy set, and it is usually the first artefact an assessor asks for. The generator drafts one against the frameworks you are actually assessed against, with the control citations already in place."
          action={
            context.canWrite ? (
              <Link href="/dashboard/policy-generator" className={cn(buttonVariants())}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Draft your first policy
              </Link>
            ) : undefined
          }
        />
      ) : (
        <section className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full bg-card text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Policy</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Frameworks</th>
                <th className="px-4 py-3 font-medium">Next review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((policy) => {
                const reviewOverdue =
                  policy.status === 'published' &&
                  policy.next_review_at &&
                  policy.next_review_at < today

                return (
                  <tr key={policy.id} className="hover:bg-foreground/[0.02]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/policies/${policy.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {policy.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {policy.policy_type}
                        {policy.source === 'ai_generated' && ' · AI-drafted'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={policy.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">v{policy.version}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(policy.framework_codes ?? []).slice(0, 3).map((code) => (
                          <Pill key={code}>{code}</Pill>
                        ))}
                        {(policy.framework_codes ?? []).length > 3 && (
                          <Pill>+{(policy.framework_codes ?? []).length - 3}</Pill>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {policy.next_review_at ? (
                        <span
                          className={
                            reviewOverdue ? 'text-destructive' : 'text-muted-foreground'
                          }
                          title={formatDate(policy.next_review_at)}
                        >
                          {formatRelativeDays(policy.next_review_at)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {missingTemplates.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-medium">Policies you do not have yet</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            The catalogue holds templates for these, each with its required sections and
            the framework controls it should cite.
          </p>
          <div className="flex flex-wrap gap-2">
            {missingTemplates.map((template) => (
              <Link
                key={template.code}
                href={`/dashboard/policy-generator?template=${template.code}`}
                className="rounded-lg bg-card px-3 py-2 text-xs ring-1 ring-foreground/10 transition-colors hover:ring-foreground/25"
              >
                {template.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
