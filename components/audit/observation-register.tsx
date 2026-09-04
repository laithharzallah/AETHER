'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/audit/fields'
import {
  ObservationRatingBadge,
  ObservationStatusBadge,
  Ref,
} from '@/components/audit/badges'
import {
  FOUR_CS,
  OBSERVATION_CATEGORIES,
  OBSERVATION_CATEGORY_LABEL,
  OBSERVATION_RATINGS,
  OBSERVATION_RATING_LABEL,
  OBSERVATION_STATUSES,
  OBSERVATION_STATUS_LABEL,
  OPEN_OBSERVATION_STATUSES,
  formatDate,
  type ObservationCategory,
  type ObservationRating,
  type ObservationStatus,
} from '@/lib/audit/constants'
import type { ObservationRegisterRow } from '@/lib/audit/queries'
import { cn } from '@/lib/utils'

const RATING_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function ObservationDetail({ row }: { row: ObservationRegisterRow }) {
  return (
    <tr className="bg-muted/20">
      <td colSpan={8}>
        <div className="grid gap-3 sm:grid-cols-2">
          {FOUR_CS.map((c) => (
            <div key={c.key}>
              <p className="eyebrow">{c.label}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed">
                {row[c.key] ?? <span className="text-muted-foreground">Not documented.</span>}
              </p>
            </div>
          ))}
          <div>
            <p className="eyebrow">Recommendation</p>
            <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed">
              {row.recommendation ?? 'Not documented.'}
            </p>
          </div>
          <div>
            <p className="eyebrow">Management response</p>
            <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed">
              {row.management_response ?? 'Not yet received.'}
            </p>
          </div>
        </div>
      </td>
    </tr>
  )
}

export function ObservationRegister({ rows }: { rows: ObservationRegisterRow[] }) {
  const [query, setQuery] = useState('')
  const [rating, setRating] = useState('all')
  const [status, setStatus] = useState('open')
  const [category, setCategory] = useState('all')
  const [repeatOnly, setRepeatOnly] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter((r) => {
      if (rating !== 'all' && r.rating !== rating) return false
      if (status === 'open' && !(OPEN_OBSERVATION_STATUSES as readonly string[]).includes(r.status))
        return false
      if (status !== 'all' && status !== 'open' && r.status !== status) return false
      if (category !== 'all' && r.category !== category) return false
      if (repeatOnly && !r.repeat_finding) return false
      if (
        q &&
        !`${r.ref} ${r.title} ${r.condition ?? ''} ${r.engagement?.code ?? ''} ${r.engagement?.title ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      return true
    })
    return [...list].sort(
      (a, b) => (RATING_ORDER[a.rating] ?? 9) - (RATING_ORDER[b.rating] ?? 9)
    )
  }, [rows, query, rating, status, category, repeatOnly])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search observations"
          className="h-8 w-56"
          aria-label="Search observations"
        />
        <NativeSelect
          aria-label="Filter by rating"
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          className="h-8 w-auto text-xs"
        >
          <option value="all">All ratings</option>
          {OBSERVATION_RATINGS.map((r) => (
            <option key={r} value={r}>
              {OBSERVATION_RATING_LABEL[r as ObservationRating]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 w-auto text-xs"
        >
          <option value="open">Open only</option>
          <option value="all">All statuses</option>
          {OBSERVATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {OBSERVATION_STATUS_LABEL[s as ObservationStatus]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-8 w-auto text-xs"
        >
          <option value="all">All categories</option>
          {OBSERVATION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {OBSERVATION_CATEGORY_LABEL[c as ObservationCategory]}
            </option>
          ))}
        </NativeSelect>
        <Button
          size="xs"
          variant={repeatOnly ? 'default' : 'outline'}
          onClick={() => setRepeatOnly((v) => !v)}
        >
          Repeat findings
        </Button>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="surface mt-3 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th>Observation</th>
              <th>Rating</th>
              <th>Engagement</th>
              <th>Category</th>
              <th>Status</th>
              <th>Actions</th>
              <th>Next due</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-sm text-muted-foreground">
                  No observations match the filters.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <Fragment key={row.id}>
                <tr>
                  <td>
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                      aria-label={expanded === row.id ? 'Collapse' : 'Expand'}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {expanded === row.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <Ref>{row.ref}</Ref>
                      {row.repeat_finding && <span className="pill pill-danger">Repeat</span>}
                    </div>
                    <p className="mt-1 max-w-md font-medium">{row.title}</p>
                  </td>
                  <td>
                    <ObservationRatingBadge rating={row.rating} />
                  </td>
                  <td className="text-xs">
                    {row.engagement ? (
                      <Link
                        href={`/dashboard/audit/engagements/${row.engagement.id}`}
                        className="text-primary hover:underline"
                      >
                        {row.engagement.code}
                      </Link>
                    ) : (
                      '—'
                    )}
                    <p className="mt-0.5 max-w-40 truncate text-[11px] text-muted-foreground">
                      {row.engagement?.title}
                    </p>
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {OBSERVATION_CATEGORY_LABEL[row.category as ObservationCategory] ??
                      row.category}
                  </td>
                  <td>
                    <ObservationStatusBadge status={row.status} />
                  </td>
                  <td className="text-xs tabular-nums">
                    {row.open_action_count}/{row.action_count} open
                    {row.overdue_action_count > 0 && (
                      <span className="ml-1 text-danger">
                        ({row.overdue_action_count} overdue)
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      'text-xs tabular-nums',
                      row.overdue_action_count > 0 && 'text-danger'
                    )}
                  >
                    {formatDate(row.next_due_date)}
                  </td>
                </tr>
                {expanded === row.id && <ObservationDetail row={row} />}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
