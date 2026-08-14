import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Stat, StatGrid } from '@/components/dashboard/stat'
import { EmptyState } from '@/components/dashboard/empty-state'
import { CoverageBar } from '@/components/dashboard/coverage-bar'
import { Pill } from '@/components/dashboard/pills'
import {
  ControlAssessment,
  type ControlRow,
} from '@/components/compliance/control-assessment'
import { countryName, formatDate } from '@/lib/dashboard/format'

export const dynamic = 'force-dynamic'

const FILTERS = ['all', 'gaps', 'unassessed', 'implemented'] as const
type Filter = (typeof FILTERS)[number]

export default async function FrameworkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ framework: string }>
  searchParams: Promise<{ filter?: string }>
}) {
  const { framework: frameworkCode } = await params
  const { filter: rawFilter } = await searchParams
  const filter: Filter = FILTERS.includes(rawFilter as Filter)
    ? (rawFilter as Filter)
    : 'all'

  const context = await requireOrganization()
  const supabase = await createClient()

  const [{ data: framework }, { data: posture }] = await Promise.all([
    supabase
      .from('frameworks')
      .select(
        'code, name, regulator, jurisdiction, version, mandatory, description, authority_url, citation, catalogue_depth, control_count, effective_date, maturity_model, applies_to_entities'
      )
      .eq('code', frameworkCode)
      .maybeSingle(),
    supabase
      .from('compliance_posture')
      .select(
        'in_scope_controls, implemented, gaps, effective, never_assessed, average_maturity, coverage_percent'
      )
      .eq('organization_id', context.orgId)
      .eq('framework_code', frameworkCode)
      .maybeSingle(),
  ])

  if (!framework) notFound()

  let query = supabase
    .from('controls')
    .select(
      `id, control_code, title, implementation_status, effectiveness, maturity,
       last_assessed_at, framework_controls ( framework_domains ( title ) )`
    )
    .eq('organization_id', context.orgId)
    .eq('framework_code', frameworkCode)
    .order('control_code')
    .limit(500)

  if (filter === 'gaps') {
    query = query.in('implementation_status', [
      'not_implemented',
      'not_assessed',
      'planned',
      'partially_implemented',
    ])
  } else if (filter === 'unassessed') {
    query = query.is('last_assessed_at', null)
  } else if (filter === 'implemented') {
    query = query.eq('implementation_status', 'implemented')
  }

  const { data: controls } = await query

  const controlRows: ControlRow[] = (controls ?? []).map((row) => {
    const related = row.framework_controls as {
      framework_domains: { title: string } | { title: string }[] | null
    } | null
    const domain = Array.isArray(related?.framework_domains)
      ? related?.framework_domains[0]
      : related?.framework_domains

    return {
      id: row.id,
      control_code: row.control_code,
      title: row.title,
      implementation_status: row.implementation_status,
      effectiveness: row.effectiveness,
      maturity: row.maturity,
      last_assessed_at: row.last_assessed_at,
      domain_title: domain?.title ?? null,
    }
  })

  const hasMaturityScale = framework.maturity_model !== null
  const coverage = Number(posture?.coverage_percent ?? 0)

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link
        href="/dashboard/compliance"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All frameworks
      </Link>

      <PageHeader
        title={framework.code}
        description={
          <span className="block space-y-2">
            <span className="block">{framework.name}</span>
            <span className="flex flex-wrap items-center gap-2">
              {framework.mandatory && <Pill tone="warn">mandatory</Pill>}
              <Pill>{countryName(framework.jurisdiction)}</Pill>
              <Pill>{framework.regulator}</Pill>
              {framework.version && <Pill>{framework.version}</Pill>}
              {framework.effective_date && (
                <span className="text-xs">
                  effective {formatDate(framework.effective_date)}
                </span>
              )}
            </span>
          </span>
        }
        actions={
          framework.authority_url ? (
            <a
              href={framework.authority_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {framework.regulator}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : undefined
        }
      />

      {framework.description && (
        <p className="max-w-3xl text-sm text-muted-foreground">{framework.description}</p>
      )}

      <div className="rounded-xl bg-card p-4 text-xs ring-1 ring-foreground/10">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {framework.applies_to_entities && (
            <div>
              <dt className="text-muted-foreground">Applies to</dt>
              <dd className="mt-0.5">{framework.applies_to_entities}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Citation</dt>
            <dd className="mt-0.5">{framework.citation ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Catalogue depth held</dt>
            <dd className="mt-0.5">
              {framework.catalogue_depth === 'full'
                ? 'Full control text'
                : framework.catalogue_depth === 'control'
                  ? 'Individual controls enumerated'
                  : 'Domain and subdomain outline, used as crosswalk anchors'}
              {framework.control_count
                ? ` · published control count: ${framework.control_count}`
                : ''}
            </dd>
          </div>
        </dl>
      </div>

      {posture ? (
        <>
          <StatGrid>
            <Stat
              label="Coverage"
              value={`${coverage.toFixed(0)}%`}
              tone={coverage >= 80 ? 'good' : coverage >= 50 ? 'warn' : 'bad'}
              hint={`${posture.implemented} of ${posture.in_scope_controls} in scope`}
            />
            <Stat
              label="Gaps"
              value={posture.gaps ?? 0}
              tone={(posture.gaps ?? 0) > 0 ? 'bad' : 'good'}
              hint="Not implemented or not assessed"
            />
            <Stat
              label="Never assessed"
              value={posture.never_assessed ?? 0}
              tone={(posture.never_assessed ?? 0) > 0 ? 'warn' : 'good'}
            />
            <Stat
              label={hasMaturityScale ? 'Average maturity' : 'Tested effective'}
              value={
                hasMaturityScale
                  ? posture.average_maturity != null
                    ? Number(posture.average_maturity).toFixed(1)
                    : '—'
                  : (posture.effective ?? 0)
              }
              hint={
                hasMaturityScale
                  ? 'On the 0-5 scale; level 3 is the usual regulatory expectation'
                  : 'Implemented and verified'
              }
            />
          </StatGrid>

          <CoverageBar percent={coverage} label="Overall coverage" />
        </>
      ) : (
        <EmptyState
          title="This framework is not in your control library"
          description="Add it in Settings to instantiate its controls and start tracking coverage."
        />
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Controls</h2>
          <nav className="flex flex-wrap gap-1" aria-label="Filter controls">
            {FILTERS.map((option) => (
              <Link
                key={option}
                href={`/dashboard/compliance/${frameworkCode}?filter=${option}`}
                aria-current={option === filter ? 'true' : undefined}
                className={
                  option === filter
                    ? 'rounded-lg bg-foreground/5 px-2.5 py-1 text-xs font-medium'
                    : 'rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-foreground/5'
                }
              >
                {option}
              </Link>
            ))}
          </nav>
        </div>

        {controlRows.length === 0 ? (
          <EmptyState
            title={
              filter === 'all'
                ? 'No controls instantiated for this framework'
                : `No controls match the "${filter}" filter`
            }
            description={
              filter === 'all'
                ? 'Add this framework in Settings to instantiate its controls.'
                : undefined
            }
          />
        ) : (
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl ring-1 ring-foreground/10">
            {controlRows.map((control) => (
              <ControlAssessment
                key={control.id}
                control={control}
                canWrite={context.canWrite}
                maturityScale={hasMaturityScale}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
