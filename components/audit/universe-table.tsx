'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, ScoreSelect } from '@/components/audit/fields'
import { Ref, RiskScoreBadge } from '@/components/audit/badges'
import { AddUniverseEntryDialog, EditEntityDialog } from '@/components/audit/universe-form'
import {
  RISK_FACTORS,
  RISK_FACTOR_LABEL,
  UNIVERSE_TYPES,
  UNIVERSE_TYPE_LABEL,
  formatDate,
  type RiskFactor,
  type UniverseType,
} from '@/lib/audit/constants'
import { deleteUniverseEntry, updateUniverseFactors } from '@/lib/actions/audit'
import type { Member, UniverseRow } from '@/lib/audit/queries'
import { cn } from '@/lib/utils'

const COVERAGE_LABEL: Record<UniverseRow['coverage_state'], string> = {
  never: 'Never audited',
  overdue: 'Overdue',
  due_soon: 'Due within 3 months',
  current: 'Within cycle',
}
const COVERAGE_CLASS: Record<UniverseRow['coverage_state'], string> = {
  never: 'pill pill-danger',
  overdue: 'pill pill-warning',
  due_soon: 'pill pill-info',
  current: 'pill pill-success',
}

function FactorCell({ row, factor }: { row: UniverseRow; factor: RiskFactor }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const value = Number(row[factor]) || 3

  function handleChange(n: number) {
    if (!row.id || n === value) return
    startTransition(async () => {
      const result = await updateUniverseFactors(row.id as string, { [factor]: n })
      if (result.ok) router.refresh()
      else toast.error(result.error)
    })
  }

  return (
    <ScoreSelect
      label={`${RISK_FACTOR_LABEL[factor]} for ${row.code}`}
      value={value}
      disabled={pending}
      onChange={handleChange}
    />
  )
}

function DeleteEntityButton({ row }: { row: UniverseRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={`Delete ${row.code}`}
      disabled={pending}
      onClick={() => {
        if (!row.id) return
        startTransition(async () => {
          const result = await deleteUniverseEntry(row.id as string)
          if (result.ok) {
            toast.success('Entity removed from the universe.')
            router.refresh()
          } else {
            toast.error(result.error)
          }
        })
      }}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  )
}

type SortKey = 'risk' | 'code' | 'staleness'

export function UniverseTable({
  rows,
  members,
}: {
  rows: UniverseRow[]
  members: Member[]
}) {
  const [sort, setSort] = useState<SortKey>('risk')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dueOnly, setDueOnly] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      if (dueOnly && !r.is_due) return false
      if (q && !`${r.code} ${r.name} ${r.description ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
    return [...list].sort((a, b) => {
      if (sort === 'code') return (a.code ?? '').localeCompare(b.code ?? '')
      if (sort === 'staleness') {
        const av = a.months_since === null ? Number.POSITIVE_INFINITY : a.months_since
        const bv = b.months_since === null ? Number.POSITIVE_INFINITY : b.months_since
        return bv - av
      }
      return Number(b.risk_score ?? 0) - Number(a.risk_score ?? 0)
    })
  }, [rows, sort, typeFilter, dueOnly, query])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entities"
          className="h-8 w-56"
          aria-label="Search entities"
        />
        <NativeSelect
          aria-label="Filter by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 w-auto text-xs"
        >
          <option value="all">All types</option>
          {UNIVERSE_TYPES.map((t) => (
            <option key={t} value={t}>
              {UNIVERSE_TYPE_LABEL[t as UniverseType]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Sort by"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-8 w-auto text-xs"
        >
          <option value="risk">Sort: risk score</option>
          <option value="staleness">Sort: longest since audit</option>
          <option value="code">Sort: code</option>
        </NativeSelect>
        <Button
          size="xs"
          variant={dueOnly ? 'default' : 'outline'}
          onClick={() => setDueOnly((v) => !v)}
        >
          Due only
        </Button>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="surface mt-3 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Entity</th>
              <th>Type</th>
              {RISK_FACTORS.map((f) => (
                <th key={f} className="text-center" title={RISK_FACTOR_LABEL[f]}>
                  {RISK_FACTOR_LABEL[f].split(' ')[0].slice(0, 6)}
                </th>
              ))}
              <th>Score</th>
              <th>Coverage</th>
              <th>Open obs.</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="text-sm text-muted-foreground">
                  No auditable entities match the filters.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <Ref>{row.code}</Ref>
                    {row.status === 'retired' && <span className="pill pill-neutral">Retired</span>}
                  </div>
                  <p className="mt-1 font-medium">{row.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.owner?.name ?? 'No owner'}
                    {row.engagement_count ? ` · ${row.engagement_count} engagement(s)` : ''}
                  </p>
                </td>
                <td className="text-xs text-muted-foreground">
                  {UNIVERSE_TYPE_LABEL[row.type as UniverseType] ?? row.type}
                </td>
                {RISK_FACTORS.map((f) => (
                  <td key={f} className="text-center">
                    <FactorCell row={row} factor={f} />
                  </td>
                ))}
                <td>
                  <RiskScoreBadge score={row.risk_score} />
                </td>
                <td>
                  <span className={COVERAGE_CLASS[row.coverage_state]}>
                    {COVERAGE_LABEL[row.coverage_state]}
                  </span>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {row.last_audited_at
                      ? `${formatDate(row.last_audited_at)} · ${row.months_since} mo ago`
                      : 'No prior coverage'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Cycle {row.effective_frequency_months} mo
                  </p>
                </td>
                <td
                  className={cn(
                    'tabular-nums',
                    (row.open_observations ?? 0) > 0 && 'text-warning-foreground'
                  )}
                >
                  {row.open_observations ?? 0}
                </td>
                <td>
                  <div className="flex justify-end gap-0.5">
                    <EditEntityDialog entry={row} members={members} parents={rows} />
                    <DeleteEntityButton row={row} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export { AddUniverseEntryDialog }
