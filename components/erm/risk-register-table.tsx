'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import {
  RISK_BANDS,
  RISK_BAND_LABEL,
  RISK_STATUSES,
  RISK_STATUS_LABEL,
  type RiskBand,
} from '@/lib/erm/constants'
import type { RegisterRow } from '@/lib/erm/queries'
import {
  BandPill,
  MovementArrow,
  RiskStatusPill,
  ScoreChip,
  TrendPill,
} from '@/components/erm/badges'
import { NativeSelect, TextInput } from '@/components/erm/fields'
import { Button } from '@/components/ui/button'

export type CategoryOption = {
  id: string
  code: string
  name_en: string
  level: number
  parent_id: string | null
}

export function RiskRegisterTable({
  rows,
  categories,
  owners,
}: {
  rows: RegisterRow[]
  categories: CategoryOption[]
  owners: { id: string; name: string }[]
}) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [band, setBand] = useState('')
  const [status, setStatus] = useState('')
  const [breachOnly, setBreachOnly] = useState(false)

  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const c of categories) {
      if (c.parent_id) map.set(c.parent_id, [...(map.get(c.parent_id) ?? []), c.id])
    }
    return map
  }, [categories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const scope = categoryId
      ? new Set([categoryId, ...(childrenOf.get(categoryId) ?? [])])
      : null
    return rows.filter((r) => {
      if (scope && !(r.category_id && scope.has(r.category_id))) return false
      if (ownerId && r.owner_id !== ownerId) return false
      if (band && r.residual_band !== band) return false
      if (status && r.status !== status) return false
      if (breachOnly && !r.appetite_breach) return false
      if (q) {
        const haystack = `${r.code ?? ''} ${r.title ?? ''} ${r.description ?? ''} ${r.owner_name ?? ''} ${r.category_name_en ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [rows, query, categoryId, ownerId, band, status, breachOnly, childrenOf])

  const active = Boolean(query || categoryId || ownerId || band || status || breachOnly)

  function reset() {
    setQuery('')
    setCategoryId('')
    setOwnerId('')
    setBand('')
    setStatus('')
    setBreachOnly(false)
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code, title, owner…"
            className="pl-8"
            aria-label="Search the register"
          />
        </div>

        <NativeSelect
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filter by category"
          className="w-auto min-w-[150px]"
        >
          <option value="">All categories</option>
          {categories
            .filter((c) => c.level === 1)
            .map((c) => (
              <optgroup key={c.id} label={`${c.code} — ${c.name_en}`}>
                <option value={c.id}>All {c.name_en}</option>
                {categories
                  .filter((k) => k.parent_id === c.id)
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.code} — {k.name_en}
                    </option>
                  ))}
              </optgroup>
            ))}
        </NativeSelect>

        <NativeSelect
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          aria-label="Filter by owner"
          className="w-auto min-w-[130px]"
        >
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          value={band}
          onChange={(e) => setBand(e.target.value)}
          aria-label="Filter by residual band"
          className="w-auto min-w-[120px]"
        >
          <option value="">All bands</option>
          {RISK_BANDS.map((b: RiskBand) => (
            <option key={b} value={b}>
              {RISK_BAND_LABEL[b]} residual
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="w-auto min-w-[120px]"
        >
          <option value="">All statuses</option>
          {RISK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {RISK_STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>

        <Button
          type="button"
          size="sm"
          variant={breachOnly ? 'secondary' : 'outline'}
          onClick={() => setBreachOnly((v) => !v)}
          aria-pressed={breachOnly}
        >
          Outside appetite
        </Button>

        {active && (
          <Button type="button" size="sm" variant="ghost" onClick={reset}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {filtered.length} of {rows.length} risks
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="data-table min-w-[900px]">
          <thead>
            <tr>
              <th className="w-24">Code</th>
              <th>Risk</th>
              <th className="w-40">Category</th>
              <th className="w-32">Owner</th>
              <th className="w-28">Inherent</th>
              <th className="w-28">Residual</th>
              <th className="w-24">Movement</th>
              <th className="w-24">Target</th>
              <th className="w-28">Band</th>
              <th className="w-28">Status</th>
              <th className="w-24">Trend</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link
                    href={`/dashboard/erm/risks/${r.id}`}
                    className="font-mono text-[11px] hover:underline"
                  >
                    {r.code}
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/dashboard/erm/risks/${r.id}`}
                    className="font-medium hover:underline"
                  >
                    {r.title}
                  </Link>
                  {r.appetite_breach && (
                    <span
                      className="ml-2 pill pill-danger"
                      title={`Residual ${r.residual_score} exceeds the tolerance threshold of ${r.tolerance_threshold}`}
                    >
                      Outside appetite
                    </span>
                  )}
                  {r.emerging && <span className="ml-2 pill pill-brass">Emerging</span>}
                </td>
                <td className="text-xs text-muted-foreground">
                  {r.category_name_en ?? '—'}
                  {r.parent_category_name_en && (
                    <span className="block text-[10px] opacity-70">
                      {r.parent_category_name_en}
                    </span>
                  )}
                </td>
                <td className="text-xs">{r.owner_name ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                <td>
                  <ScoreChip likelihood={r.inherent_likelihood} impact={r.inherent_impact} />
                </td>
                <td>
                  <ScoreChip likelihood={r.residual_likelihood} impact={r.residual_impact} />
                </td>
                <td>
                  <MovementArrow
                    delta={r.movement.delta}
                    direction={r.movement.direction}
                    previous={r.movement.previousResidual}
                  />
                </td>
                <td>
                  <ScoreChip likelihood={r.target_likelihood} impact={r.target_impact} />
                </td>
                <td>
                  <BandPill band={r.residual_band} />
                </td>
                <td>
                  <RiskStatusPill status={r.status} />
                </td>
                <td>
                  <TrendPill trend={r.trend} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                  No risks match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
