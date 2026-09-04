'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DeficiencyStatusBadge, KeyStar, SeverityBadge, formatDate } from '@/components/icfr/badges'
import { NativeSelect } from '@/components/icfr/fields'
import { updateDeficiencyStatus } from '@/lib/actions/icfr'
import type { DeficiencyRow } from '@/lib/icfr/queries'
import {
  DEFICIENCY_STATUSES,
  DEFICIENCY_STATUS_LABEL,
  SEVERITIES,
  SEVERITY_LABEL,
} from '@/lib/icfr/constants'
import { cn } from '@/lib/utils'

export function DeficiencyLog({ rows }: { rows: DeficiencyRow[] }) {
  const router = useRouter()
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('open')
  const [processId, setProcessId] = useState('all')
  const [pending, startTransition] = useTransition()
  const today = new Date().toISOString().slice(0, 10)

  const processes = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) if (r.process) map.set(r.process.id, `${r.process.code} — ${r.process.name}`)
    return [...map.entries()]
  }, [rows])

  const filtered = rows.filter((r) => {
    if (severity !== 'all' && r.severity !== severity) return false
    if (status === 'open' && !(r.status === 'open' || r.status === 'in_remediation')) return false
    if (status !== 'all' && status !== 'open' && r.status !== status) return false
    if (processId !== 'all' && r.process?.id !== processId) return false
    return true
  })

  function handleStatus(id: string, next: string, pid: string | undefined) {
    startTransition(async () => {
      const result = await updateDeficiencyStatus(id, next, pid)
      if (result.ok) {
        toast.success('Status updated.')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-auto">
          <option value="all">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="open">Open & in remediation</option>
          <option value="all">All statuses</option>
          {DEFICIENCY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DEFICIENCY_STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Process" value={processId} onChange={(e) => setProcessId(e.target.value)} className="w-auto">
          <option value="all">All processes</option>
          {processes.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No deficiencies match the current filters.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-[11px] tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2.5 font-medium">Deficiency</th>
                <th className="px-3 py-2.5 font-medium">Severity</th>
                <th className="hidden px-3 py-2.5 font-medium md:table-cell">Control</th>
                <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Owner</th>
                <th className="px-3 py-2.5 font-medium">Due</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const active = d.status === 'open' || d.status === 'in_remediation'
                const overdue = active && d.due_date !== null && d.due_date < today
                return (
                  <tr key={d.id} className={cn('border-t border-border', overdue && 'bg-red-500/[0.04]')}>
                    <td className="max-w-md px-3 py-2.5">
                      <p className="line-clamp-2">{d.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Identified {formatDate(d.identified_at)}
                        {d.closed_at && ` · Closed ${formatDate(d.closed_at)}`}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <SeverityBadge severity={d.severity} />
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs md:table-cell">
                      {d.control && d.process ? (
                        <Link href={`/dashboard/icfr/${d.process.id}`} className="inline-flex items-start gap-1.5 hover:underline">
                          <KeyStar isKey={d.control.is_key} className="mt-0.5" />
                          <span>
                            <code className="mr-1 font-mono">{d.process.code} {d.control.ref}</code>
                            {d.control.title}
                          </span>
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs lg:table-cell">{d.owner?.name ?? '—'}</td>
                    <td className={cn('px-3 py-2.5 text-xs whitespace-nowrap', overdue && 'font-medium text-danger')}>
                      {formatDate(d.due_date)}
                      {overdue && <span className="ml-1">(overdue)</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <DeficiencyStatusBadge status={d.status} />
                        <NativeSelect
                          aria-label="Update status"
                          value={d.status}
                          disabled={pending}
                          onChange={(e) => handleStatus(d.id, e.target.value, d.process?.id)}
                          className="h-6 w-auto text-xs"
                        >
                          {DEFICIENCY_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {DEFICIENCY_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
