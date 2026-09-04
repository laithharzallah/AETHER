'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KriPill } from '@/components/erm/badges'
import { KriSparkline } from '@/components/erm/charts'
import { RecordReadingDialog } from '@/components/erm/kri-dialogs'
import { NativeSelect } from '@/components/erm/fields'
import {
  KRI_DIRECTION_LABEL,
  KRI_FREQUENCY_LABEL,
  KRI_STATUSES,
  KRI_STATUS_LABEL,
  type KriDirection,
  type KriFrequency,
} from '@/lib/erm/constants'
import type { KriDashboardRow } from '@/lib/erm/queries'

function Delta({ latest, previous }: { latest: number | null; previous: number | null }) {
  if (latest === null || previous === null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const delta = latest - previous
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3.5 w-3.5" />0
      </span>
    )
  }
  const Icon = delta > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {delta > 0 ? '+' : ''}
      {Math.round(delta * 100) / 100}
    </span>
  )
}

export function KriDashboard({ rows }: { rows: KriDashboardRow[] }) {
  const [status, setStatus] = useState('')

  const filtered = useMemo(
    () => (status ? rows.filter((r) => r.status_rag === status) : rows),
    [rows, status]
  )

  if (rows.length === 0) {
    return (
      <div className="surface p-6 text-center">
        <div className="mx-auto mb-3 icon-tile">
          <Activity className="h-5 w-5" />
        </div>
        <p className="font-medium">No key risk indicators defined</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          KRIs are added against a risk. Open a risk in the register and define an indicator
          with an amber early-warning threshold and a red tolerance threshold.
        </p>
        <Link
          href="/dashboard/erm/risks"
          className="mt-4 inline-block text-sm underline underline-offset-4"
        >
          Go to the risk register
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by RAG status"
          className="w-auto min-w-[160px]"
        >
          <option value="">All statuses</option>
          {KRI_STATUSES.map((s) => (
            <option key={s} value={s}>
              {KRI_STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {rows.length} indicators
        </p>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="data-table min-w-[960px]">
          <thead>
            <tr>
              <th>Indicator</th>
              <th className="w-28">Risk</th>
              <th className="w-32">Latest</th>
              <th className="w-20">Change</th>
              <th className="w-36">Thresholds</th>
              <th className="w-44">Trend</th>
              <th className="w-32">Status</th>
              <th className="w-24">Breaches</th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((k) => (
              <tr key={k.id}>
                <td>
                  <p className="font-medium">{k.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {k.frequency && KRI_FREQUENCY_LABEL[k.frequency as KriFrequency]}
                    {k.direction && (
                      <> · {KRI_DIRECTION_LABEL[k.direction as KriDirection]}</>
                    )}
                    {k.owner_name && <> · {k.owner_name}</>}
                    {k.data_source && <> · {k.data_source}</>}
                  </p>
                </td>
                <td className="text-xs">
                  {k.risk_id ? (
                    <Link
                      href={`/dashboard/erm/risks/${k.risk_id}`}
                      className="font-mono text-[11px] hover:underline"
                      title={k.risk_title ?? undefined}
                    >
                      {k.risk_code ?? 'View'}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="tabular-nums">
                  {k.latest_value === null ? (
                    <span className="text-muted-foreground">No reading</span>
                  ) : (
                    <>
                      <span className="font-medium">{Number(k.latest_value)}</span>
                      {k.unit && <span className="text-muted-foreground"> {k.unit}</span>}
                      <span className="block text-[11px] text-muted-foreground">
                        {k.latest_period}
                      </span>
                    </>
                  )}
                </td>
                <td>
                  <Delta
                    latest={k.latest_value === null ? null : Number(k.latest_value)}
                    previous={k.previous_value}
                  />
                </td>
                <td className="text-xs tabular-nums text-muted-foreground">
                  Amber {Number(k.amber_threshold)} · Red {Number(k.red_threshold)}
                </td>
                <td>
                  <KriSparkline
                    readings={k.readings}
                    amber={k.amber_threshold === null ? null : Number(k.amber_threshold)}
                    red={k.red_threshold === null ? null : Number(k.red_threshold)}
                    width={140}
                    height={36}
                  />
                </td>
                <td>
                  <KriPill status={k.status_rag} />
                </td>
                <td className="tabular-nums">
                  {k.breach_periods.length > 0 ? (
                    <span
                      className="text-danger"
                      title={`Breached in: ${k.breach_periods.join(', ')}`}
                    >
                      {k.breach_periods.length}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="text-right">
                  {k.id && (
                    <RecordReadingDialog
                      kriId={k.id}
                      kriName={k.name ?? 'Indicator'}
                      unit={k.unit}
                      direction={k.direction}
                      amber={k.amber_threshold === null ? null : Number(k.amber_threshold)}
                      red={k.red_threshold === null ? null : Number(k.red_threshold)}
                      trigger={
                        <Button variant="outline" size="xs">
                          Record
                        </Button>
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  No indicators with that status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
