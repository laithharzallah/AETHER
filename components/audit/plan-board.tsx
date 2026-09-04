'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Loader2, Play, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/audit/fields'
import { PlanItemStatusBadge, Ref, RiskScoreBadge } from '@/components/audit/badges'
import {
  PLAN_ITEM_STATUSES,
  PLAN_ITEM_STATUS_LABEL,
  PRIORITY_LABEL,
  QUARTERS,
  formatDays,
  type PlanItemStatus,
  type Priority,
} from '@/lib/audit/constants'
import { createEngagement, deletePlanItem, updatePlanItem } from '@/lib/actions/audit'
import type { PlanDetail, PlanItemRow } from '@/lib/audit/queries'
import { cn } from '@/lib/utils'

function StatusSelect({ item, planId }: { item: PlanItemRow; planId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <NativeSelect
      aria-label={`Status for ${item.display_title}`}
      className="h-6 w-auto text-[11px]"
      value={item.status}
      disabled={pending}
      onChange={(e) => {
        const status = e.target.value
        startTransition(async () => {
          const result = await updatePlanItem(item.id, planId, {
            universeId: item.universe_id,
            title: item.title,
            quarter: item.quarter,
            plannedDays: Number(item.planned_days),
            priority: item.priority,
            rationale: item.rationale,
            status,
          })
          if (result.ok) router.refresh()
          else toast.error(result.error)
        })
      }}
    >
      {PLAN_ITEM_STATUSES.map((s) => (
        <option key={s} value={s}>
          {PLAN_ITEM_STATUS_LABEL[s as PlanItemStatus]}
        </option>
      ))}
    </NativeSelect>
  )
}

function StartEngagementButton({ item }: { item: PlanItemRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  if (item.engagement) {
    return (
      <Link
        href={`/dashboard/audit/engagements/${item.engagement.id}`}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        {item.engagement.code}
        <ArrowUpRight className="h-3 w-3" />
      </Link>
    )
  }
  return (
    <Button
      size="xs"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createEngagement({
            title: item.display_title,
            universeId: item.universe_id,
            planItemId: item.id,
            budgetDays: Number(item.planned_days),
            objective: item.rationale
              ? `Provide assurance over ${item.display_title}. Plan rationale: ${item.rationale}`
              : null,
          })
          if (result.ok && result.data) {
            toast.success('Engagement opened.')
            router.push(`/dashboard/audit/engagements/${result.data.id}`)
          } else if (!result.ok) {
            toast.error(result.error)
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Play />}
      Open engagement
    </Button>
  )
}

function DeleteItemButton({ item, planId }: { item: PlanItemRow; planId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={`Remove ${item.display_title}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deletePlanItem(item.id, planId)
          if (result.ok) {
            toast.success('Removed from the plan.')
            router.refresh()
          } else {
            toast.error(result.error)
          }
        })
      }
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  )
}

export function CapacityBar({ capacity }: { capacity: PlanDetail['capacity'] }) {
  const total = Math.max(capacity.total, capacity.planned, 1)
  const plannedPct = Math.min(100, Math.round((capacity.planned / total) * 100))
  const deferredPct = Math.min(100 - plannedPct, Math.round((capacity.deferred / total) * 100))
  const over = capacity.planned > capacity.total && capacity.total > 0

  return (
    <div className="surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Capacity versus demand</p>
          <p className="mt-1 text-2xl font-medium tabular-nums">
            {formatDays(capacity.planned)}
            <span className="text-base font-normal text-muted-foreground">
              {' '}
              of {formatDays(capacity.total)} days planned
            </span>
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p className={cn(over && 'text-danger')}>
            {over
              ? `Over capacity by ${formatDays(capacity.planned - capacity.total)} days`
              : `${formatDays(capacity.remaining)} days unallocated`}
          </p>
          <p>
            Deferred {formatDays(capacity.deferred)} days · unmet universe demand{' '}
            {formatDays(Math.max(capacity.demandFromUniverse - capacity.planned, 0))} days
          </p>
        </div>
      </div>
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${plannedPct}%` }} />
        <div className="h-full bg-warning" style={{ width: `${deferredPct}%` }} />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Planned days consume capacity; deferred items are entities the universe says are due
        but that no capacity remains for. Report the deferred column to the audit committee
        as the residual assurance gap.
      </p>
    </div>
  )
}

export function PlanBoard({ detail }: { detail: PlanDetail }) {
  const { plan, byQuarter } = detail
  const [quarter, setQuarter] = useState<string>('all')
  const quarters = quarter === 'all' ? QUARTERS : QUARTERS.filter((q) => q === quarter)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Filter by quarter"
          value={quarter}
          onChange={(e) => setQuarter(e.target.value)}
          className="h-8 w-auto text-xs"
        >
          <option value="all">All quarters</option>
          {QUARTERS.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </NativeSelect>
        <span className="text-xs text-muted-foreground tabular-nums">
          {detail.items.length} engagement(s) · {plan.completed_count} reported
        </span>
      </div>

      <div className="mt-4 space-y-6">
        {quarters.map((q) => {
          const items = byQuarter[q] ?? []
          const days = items
            .filter((i) => i.status !== 'deferred' && i.status !== 'cancelled')
            .reduce((n, i) => n + Number(i.planned_days), 0)
          return (
            <section key={q}>
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <h3 className="text-sm font-medium">{q}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {items.length} engagement(s) · {formatDays(days)} days
                </span>
              </div>
              {items.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Nothing planned in {q}.</p>
              ) : (
                <div className="surface mt-2 overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Engagement</th>
                        <th>Risk</th>
                        <th>Days</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Rationale</th>
                        <th className="w-32"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className={cn(item.status === 'deferred' && 'opacity-70')}>
                          <td>
                            <div className="flex items-center gap-2">
                              {item.universe && <Ref>{item.universe.code}</Ref>}
                              <span className="font-medium">{item.display_title}</span>
                            </div>
                            <div className="mt-1">
                              <PlanItemStatusBadge status={item.status} />
                            </div>
                          </td>
                          <td>
                            {item.universe ? (
                              <RiskScoreBadge score={item.universe.risk_score} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="tabular-nums">{formatDays(item.planned_days)}</td>
                          <td className="text-xs">{PRIORITY_LABEL[item.priority as Priority]}</td>
                          <td>
                            <StatusSelect item={item} planId={plan.id} />
                          </td>
                          <td className="max-w-sm text-[11px] leading-snug text-muted-foreground">
                            {item.rationale ?? '—'}
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              <StartEngagementButton item={item} />
                              <DeleteItemButton item={item} planId={plan.id} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
