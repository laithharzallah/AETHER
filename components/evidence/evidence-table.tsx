'use client'

import { useDeferredValue, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  deleteEvidence,
  getEvidenceDownloadUrl,
  reviewEvidence,
} from '@/lib/actions/evidence'
import {
  fileExtension,
  formatBytes,
  validityState,
  type EvidenceReviewStatus,
} from '@/lib/evidence/constants'
import { cn } from '@/lib/utils'

export type EvidenceRow = {
  id: string
  name: string
  description: string | null
  source: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  storage_path: string | null
  external_url: string | null
  valid_until: string | null
  review_status: string
  reviewed_at: string | null
  created_at: string
  uploaded_by_name: string | null
  linked_count: number
  linked_refs: string[]
}

type EvidenceTableProps = {
  rows: EvidenceRow[]
  canReview: boolean
}

const REVIEW_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
> = {
  pending: 'outline',
  accepted: 'default',
  rejected: 'destructive',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function typeLabel(row: EvidenceRow): string {
  if (row.source === 'link') return 'Link'
  if (row.source === 'note') return 'Note'
  const ext = row.file_name ? fileExtension(row.file_name) : ''
  return ext ? ext.toUpperCase() : 'File'
}

export function EvidenceTable({ rows, canReview }: EvidenceTableProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | EvidenceReviewStatus>('all')
  const [validity, setValidity] = useState<'all' | 'expired' | 'expiring'>(
    'all'
  )
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [localStatus, setLocalStatus] = useState<Map<string, string>>(
    () => new Map()
  )
  const [, startTransition] = useTransition()
  const deferredQuery = useDeferredValue(query)

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return rows.filter((r) => {
      if (hidden.has(r.id)) return false
      const rs = localStatus.get(r.id) ?? r.review_status
      if (status !== 'all' && rs !== status) return false
      if (validity !== 'all' && validityState(r.valid_until) !== validity) {
        return false
      }
      if (!q) return true
      const hay = [
        r.name,
        r.description,
        r.file_name,
        r.uploaded_by_name,
        ...r.linked_refs,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, hidden, localStatus, status, validity, deferredQuery])

  async function download(row: EvidenceRow) {
    setBusyId(row.id)
    try {
      const result = await getEvidenceDownloadUrl(row.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } finally {
      setBusyId(null)
    }
  }

  function review(row: EvidenceRow, decision: 'accepted' | 'rejected') {
    const previous = localStatus.get(row.id) ?? row.review_status
    setLocalStatus((prev) => new Map(prev).set(row.id, decision))
    startTransition(async () => {
      const result = await reviewEvidence(row.id, decision)
      if (result.ok) {
        toast.success(`Evidence ${decision}.`)
      } else {
        setLocalStatus((prev) => new Map(prev).set(row.id, previous))
        toast.error(result.error)
      }
    })
  }

  function remove(row: EvidenceRow) {
    if (confirmId !== row.id) {
      setConfirmId(row.id)
      setTimeout(() => setConfirmId((c) => (c === row.id ? null : c)), 4000)
      return
    }
    setConfirmId(null)
    setBusyId(row.id)
    startTransition(async () => {
      const result = await deleteEvidence(row.id)
      setBusyId(null)
      if (result.ok) {
        setHidden((prev) => new Set(prev).add(row.id))
        toast.success('Evidence deleted.')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search evidence…"
            className="pl-8"
            aria-label="Search evidence"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as 'all' | EvidenceReviewStatus)
            }
            aria-label="Filter by review status"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="all">All review states</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={validity}
            onChange={(e) =>
              setValidity(e.target.value as 'all' | 'expired' | 'expiring')
            }
            aria-label="Filter by validity"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="all">Any validity</option>
            <option value="expiring">Expiring soon</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground tabular-nums">
        {visible.length} of {rows.length - hidden.size} items
      </p>

      {visible.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No evidence matches your filters.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Evidence</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Size</th>
                <th className="px-3 py-2.5 font-medium">Valid until</th>
                <th className="px-3 py-2.5 font-medium">Review</th>
                <th className="px-3 py-2.5 text-center font-medium">Controls</th>
                <th className="px-3 py-2.5 font-medium">Uploaded</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const rs = localStatus.get(r.id) ?? r.review_status
                const v = validityState(r.valid_until)
                const busy = busyId === r.id
                const Icon =
                  r.source === 'link'
                    ? Link2
                    : r.source === 'note'
                      ? StickyNote
                      : FileText
                return (
                  <tr
                    key={r.id}
                    className="border-t border-border/60 align-top transition-colors hover:bg-foreground/[0.03]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="font-medium">{r.name}</p>
                          {r.file_name && r.file_name !== r.name && (
                            <p className="truncate text-xs text-muted-foreground">
                              {r.file_name}
                            </p>
                          )}
                          {r.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {r.description}
                            </p>
                          )}
                          {r.linked_refs.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {r.linked_refs.slice(0, 6).map((ref) => (
                                <code
                                  key={ref}
                                  className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]"
                                >
                                  {ref}
                                </code>
                              ))}
                              {r.linked_refs.length > 6 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{r.linked_refs.length - 6}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline">{typeLabel(r)}</Badge>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground tabular-nums">
                      {r.source === 'upload' ? formatBytes(r.size_bytes) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {r.valid_until ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="tabular-nums">
                            {formatDate(r.valid_until)}
                          </span>
                          {v === 'expired' && (
                            <Badge variant="destructive">Expired</Badge>
                          )}
                          {v === 'expiring' && (
                            <Badge variant="secondary">Expiring soon</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={REVIEW_VARIANT[rs] ?? 'outline'}
                          className="capitalize"
                        >
                          {rs}
                        </Badge>
                        {canReview && rs !== 'accepted' && (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => review(r, 'accepted')}
                            aria-label="Accept evidence"
                            title="Accept"
                          >
                            <Check className="text-green-600 dark:text-green-500" />
                          </Button>
                        )}
                        {canReview && rs !== 'rejected' && (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => review(r, 'rejected')}
                            aria-label="Reject evidence"
                            title="Reject"
                          >
                            <X className="text-red-600 dark:text-red-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums">
                      {r.linked_count > 0 ? (
                        <Link
                          href="/dashboard/programs"
                          className="hover:underline"
                        >
                          {r.linked_count}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      <p>{r.uploaded_by_name ?? '—'}</p>
                      <p className="tabular-nums">{formatDate(r.created_at)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {(r.storage_path || r.external_url) && (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => download(r)}
                            disabled={busy}
                            aria-label={
                              r.storage_path ? 'Download file' : 'Open link'
                            }
                            title={r.storage_path ? 'Download' : 'Open link'}
                          >
                            {busy ? (
                              <Loader2 className="animate-spin" />
                            ) : r.storage_path ? (
                              <Download />
                            ) : (
                              <ExternalLink />
                            )}
                          </Button>
                        )}
                        {canReview && (
                          <Button
                            type="button"
                            size={confirmId === r.id ? 'xs' : 'icon-xs'}
                            variant={confirmId === r.id ? 'destructive' : 'ghost'}
                            onClick={() => remove(r)}
                            disabled={busy}
                            aria-label="Delete evidence"
                            className={cn(confirmId === r.id && 'px-2')}
                          >
                            <Trash2 />
                            {confirmId === r.id && 'Confirm'}
                          </Button>
                        )}
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
