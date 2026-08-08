import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Stat, StatGrid } from '@/components/dashboard/stat'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Pill } from '@/components/dashboard/pills'
import { VerifyChain } from '@/components/audit/verify-chain'
import { formatDateTime, humanize } from '@/lib/dashboard/format'

export const dynamic = 'force-dynamic'

const ACTOR_FILTERS = ['all', 'user', 'machine', 'system'] as const
type ActorFilter = (typeof ACTOR_FILTERS)[number]

const PAGE_SIZE = 60

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; before?: string }>
}) {
  const context = await requireOrganization()
  const params = await searchParams

  const actor: ActorFilter = ACTOR_FILTERS.includes(params.actor as ActorFilter)
    ? (params.actor as ActorFilter)
    : 'all'

  const supabase = await createClient()

  // Keyset pagination on seq rather than an offset: the chain is append-only and
  // strictly ordered, so a cursor is both cheaper and stable while new events are
  // being written underneath the reader.
  const before = Number(params.before)
  const hasCursor = Number.isFinite(before) && before > 0

  let query = supabase
    .from('audit_events')
    .select(
      'id, seq, occurred_at, actor_type, actor_label, actor_id, action, entity_type, entity_id, summary, metadata, hash, prev_hash'
    )
    .eq('organization_id', context.orgId)
    .order('seq', { ascending: false })
    .limit(PAGE_SIZE)

  if (actor !== 'all') query = query.eq('actor_type', actor)
  if (hasCursor) query = query.lt('seq', before)

  const [events, totals] = await Promise.all([
    query,
    supabase
      .from('audit_events')
      .select('actor_type', { count: 'exact' })
      .eq('organization_id', context.orgId)
      .limit(5000),
  ])

  const rows = events.data ?? []
  const totalEvents = totals.count ?? 0
  const actorCounts = (totals.data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.actor_type] = (acc[row.actor_type] ?? 0) + 1
    return acc
  }, {})

  const oldestOnPage = rows.length > 0 ? rows[rows.length - 1].seq : null
  const hasMore = rows.length === PAGE_SIZE

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Audit Trail"
        description="An append-only, hash-chained record of every action taken in this organization — by a person, by the autonomous engine, or by the system itself."
      />

      <StatGrid>
        <Stat label="Events recorded" value={totalEvents} />
        <Stat
          label="By people"
          value={actorCounts.user ?? 0}
          href="/dashboard/audit?actor=user"
        />
        <Stat
          label="By the Machine"
          value={actorCounts.machine ?? 0}
          href="/dashboard/audit?actor=machine"
        />
        <Stat
          label="By the system"
          value={actorCounts.system ?? 0}
          href="/dashboard/audit?actor=system"
        />
      </StatGrid>

      <VerifyChain eventCount={totalEvents} />

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Events</h2>
          <nav className="flex flex-wrap gap-1" aria-label="Filter by actor">
            {ACTOR_FILTERS.map((option) => (
              <Link
                key={option}
                href={`/dashboard/audit?actor=${option}`}
                aria-current={option === actor ? 'true' : undefined}
                className={
                  option === actor
                    ? 'rounded-lg bg-foreground/5 px-2.5 py-1 text-xs font-medium'
                    : 'rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-foreground/5'
                }
              >
                {option}
              </Link>
            ))}
          </nav>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No events recorded yet"
            description="The trail fills as work happens: provisioning frameworks, assessing controls, publishing policies, and every conclusion the engine acts on. Nothing can be written here except by appending."
          />
        ) : (
          <>
            <ol className="divide-y divide-border/60 overflow-hidden rounded-xl ring-1 ring-foreground/10">
              {rows.map((event) => (
                <li key={event.id} className="bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="font-mono text-xs text-muted-foreground tabular-nums"
                      title="Sequence number in this organization's chain"
                    >
                      #{event.seq}
                    </span>
                    <Pill
                      tone={
                        event.actor_type === 'machine'
                          ? 'info'
                          : event.actor_type === 'user'
                            ? 'neutral'
                            : 'warn'
                      }
                    >
                      {event.actor_label ?? event.actor_type}
                    </Pill>
                    <span className="font-mono text-xs">{event.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(event.occurred_at)}
                    </span>
                  </div>

                  {event.summary && <p className="mt-1.5 text-sm">{event.summary}</p>}

                  {event.entity_type && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {humanize(event.entity_type)}
                      {event.entity_id ? ` · ${event.entity_id.slice(0, 8)}` : ''}
                    </p>
                  )}

                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      Chain detail
                    </summary>
                    <dl className="mt-2 space-y-1 rounded-lg bg-foreground/[0.03] p-2.5 font-mono text-[10px] break-all">
                      <div>
                        <dt className="inline text-muted-foreground">hash: </dt>
                        <dd className="inline">{event.hash}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">prev: </dt>
                        <dd className="inline">{event.prev_hash}</dd>
                      </div>
                      {event.metadata != null &&
                        Object.keys(event.metadata as object).length > 0 && (
                          <div>
                            <dt className="inline text-muted-foreground">metadata: </dt>
                            <dd className="inline">{JSON.stringify(event.metadata)}</dd>
                          </div>
                        )}
                    </dl>
                  </details>
                </li>
              ))}
            </ol>

            {hasMore && oldestOnPage != null && (
              <div className="mt-4 flex justify-center">
                <Link
                  href={`/dashboard/audit?actor=${actor}&before=${oldestOnPage}`}
                  className="rounded-lg bg-card px-4 py-2 text-xs ring-1 ring-foreground/10 transition-colors hover:ring-foreground/25"
                >
                  Older events
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
