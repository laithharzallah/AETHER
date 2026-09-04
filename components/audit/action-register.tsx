'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/audit/fields'
import {
  ActionStatusBadge,
  ObservationRatingBadge,
  Ref,
} from '@/components/audit/badges'
import { VerifyActionDialog } from '@/components/audit/action-panel'
import {
  ACTION_STATUSES,
  ACTION_STATUS_LABEL,
  AGEING_BUCKETS,
  OPEN_ACTION_STATUSES,
  formatDate,
  type ActionStatus,
} from '@/lib/audit/constants'
import { markActionImplemented, refreshOverdueActions } from '@/lib/actions/audit'
import type { ActionRow, Member } from '@/lib/audit/queries'
import { cn } from '@/lib/utils'

export function RefreshOverdueButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await refreshOverdueActions()
          if (result.ok) {
            toast.success(`${result.data?.updated ?? 0} action status(es) recalculated.`)
            router.refresh()
          } else {
            toast.error(result.error)
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Recalculate overdue
    </Button>
  )
}

function ImplementedButton({ row }: { row: ActionRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  if (!row.id) return null
  return (
    <Button
      size="xs"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markActionImplemented(row.id as string, row.engagement_id)
          if (result.ok) {
            toast.success('Recorded as implemented, awaiting verification.')
            router.refresh()
          } else {
            toast.error(result.error)
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
      Implemented
    </Button>
  )
}

export function ActionRegister({
  rows,
  members,
}: {
  rows: ActionRow[]
  members: Member[]
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('open')
  const [owner, setOwner] = useState('all')
  const [bucket, setBucket] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (status === 'open' && !(OPEN_ACTION_STATUSES as readonly string[]).includes(r.status ?? ''))
        return false
      if (status === 'overdue' && !r.is_overdue) return false
      if (status !== 'all' && status !== 'open' && status !== 'overdue' && r.status !== status)
        return false
      if (owner === 'unassigned' && r.owner_id) return false
      if (owner !== 'all' && owner !== 'unassigned' && r.owner_id !== owner) return false
      if (bucket !== 'all' && r.ageing_bucket !== bucket) return false
      if (
        q &&
        !`${r.description ?? ''} ${r.observation_ref ?? ''} ${r.observation_title ?? ''} ${r.engagement_code ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      return true
    })
  }, [rows, query, status, owner, bucket])

  const openRows = rows.filter((r) =>
    (OPEN_ACTION_STATUSES as readonly string[]).includes(r.status ?? '')
  )
  const bucketCounts = AGEING_BUCKETS.map((b) => ({
    ...b,
    count: openRows.filter((r) => r.ageing_bucket === b.key).length,
  }))

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {bucketCounts.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setBucket(bucket === b.key ? 'all' : b.key)}
            className={cn(
              'surface p-3 text-left transition-colors hover:border-foreground/30',
              bucket === b.key && 'border-foreground/40'
            )}
          >
            <p className="text-[11px] text-muted-foreground">{b.label}</p>
            <p
              className={cn(
                'mt-1 text-xl font-medium tabular-nums',
                b.key !== 'not_due' && b.count > 0 && 'text-danger'
              )}
            >
              {b.count}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search actions"
          className="h-8 w-56"
          aria-label="Search actions"
        />
        <NativeSelect
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 w-auto text-xs"
        >
          <option value="open">Open only</option>
          <option value="overdue">Overdue only</option>
          <option value="all">All statuses</option>
          {ACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ACTION_STATUS_LABEL[s as ActionStatus]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Filter by owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="h-8 w-auto text-xs"
        >
          <option value="all">All owners</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>
        {bucket !== 'all' && (
          <Button size="xs" variant="ghost" onClick={() => setBucket('all')}>
            Clear ageing filter
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="surface mt-3 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Observation</th>
              <th>Owner</th>
              <th>Due</th>
              <th>Ageing</th>
              <th>Status</th>
              <th className="w-48"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-sm text-muted-foreground">
                  No management actions match the filters.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id} className={cn(row.is_overdue && 'bg-danger/5')}>
                <td className="max-w-md">
                  <p className="text-xs leading-relaxed">{row.description}</p>
                  {row.verification_notes && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Verified by {row.verifier?.name ?? 'internal audit'}
                      {row.verified_at ? ` on ${formatDate(row.verified_at)}` : ''}:{' '}
                      {row.verification_notes}
                    </p>
                  )}
                </td>
                <td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Ref>{row.observation_ref}</Ref>
                    <ObservationRatingBadge rating={row.observation_rating} />
                    {row.observation_repeat && <span className="pill pill-danger">Repeat</span>}
                  </div>
                  <p className="mt-1 max-w-56 truncate text-[11px] text-muted-foreground">
                    {row.observation_title}
                  </p>
                  {row.engagement_id && (
                    <Link
                      href={`/dashboard/audit/engagements/${row.engagement_id}`}
                      className="text-[11px] text-primary hover:underline"
                    >
                      {row.engagement_code}
                    </Link>
                  )}
                </td>
                <td className="text-xs">{row.owner?.name ?? 'Unassigned'}</td>
                <td className="text-xs tabular-nums">
                  {formatDate(row.effective_due_date)}
                  {(row.extension_count ?? 0) > 0 && (
                    <p className="text-[11px] text-warning-foreground">
                      {row.extension_count} extension(s)
                    </p>
                  )}
                </td>
                <td
                  className={cn('text-xs tabular-nums', row.is_overdue && 'font-medium text-danger')}
                >
                  {row.is_overdue ? `${row.days_overdue} days overdue` : 'Within date'}
                  <p className="text-[11px] text-muted-foreground">
                    open {row.age_days ?? 0} days
                  </p>
                </td>
                <td>
                  <ActionStatusBadge status={row.is_overdue ? 'overdue' : row.status} />
                </td>
                <td>
                  {row.status !== 'verified' && row.status !== 'cancelled' && row.id && (
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {row.status !== 'implemented' && <ImplementedButton row={row} />}
                      <VerifyActionDialog
                        actionId={row.id}
                        engagementId={row.engagement_id}
                        label="Verify"
                      />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
