'use client'

import {
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
} from 'react'
import Link from 'next/link'
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link2,
  Loader2,
  Paperclip,
  Search,
  Square,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EvidenceUploader } from '@/components/evidence/evidence-uploader'
import {
  bulkUpdateStatus,
  updateImplementation,
  type ImplementationPatch,
} from '@/lib/actions/programs'
import { linkEvidence, unlinkEvidence } from '@/lib/actions/evidence'
import { IMPLEMENTATION_STATUSES, type ImplementationStatus } from '@/lib/programs/constants'
import type {
  EvidenceOption,
  Implementation,
  LinkedEvidence,
  OrgMember,
} from '@/lib/programs/queries'
import { validityState } from '@/lib/evidence/constants'
import { cn } from '@/lib/utils'

type ControlMatrixProps = {
  programId: string
  frameworkCode: string
  organizationId: string
  implementations: Implementation[]
  members: OrgMember[]
  evidenceOptions: EvidenceOption[]
}

type Override = Partial<
  Pick<
    Implementation,
    | 'status'
    | 'owner_id'
    | 'owner'
    | 'due_date'
    | 'notes'
    | 'na_justification'
    | 'evidence'
  >
>

const STATUS_CLASS: Record<ImplementationStatus, string> = {
  not_started: 'text-muted-foreground',
  in_progress: 'text-amber-600 dark:text-amber-400',
  implemented: 'text-green-600 dark:text-green-500',
  not_applicable: 'text-muted-foreground/70',
}

const CRITICALITY_CLASS: Record<string, string> = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-muted-foreground',
}

const selectClass =
  'h-7 max-w-full rounded-md border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30'

function memberLabel(m: OrgMember) {
  return m.full_name || m.email || 'Member'
}

export function ControlMatrix({
  programId,
  frameworkCode,
  organizationId,
  implementations,
  members,
  evidenceOptions,
}: ControlMatrixProps) {
  const [overrides, setOverrides] = useState<Map<string, Override>>(
    () => new Map()
  )
  const [extraEvidence, setExtraEvidence] = useState<EvidenceOption[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ImplementationStatus>(
    'all'
  )
  const [domainFilter, setDomainFilter] = useState('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] =
    useState<ImplementationStatus>('implemented')
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [bulkPending, startBulk] = useTransition()
  const deferredQuery = useDeferredValue(query)

  const rows = useMemo(
    () =>
      implementations.map((impl) => {
        const o = overrides.get(impl.id)
        return o ? { ...impl, ...o } : impl
      }),
    [implementations, overrides]
  )

  const domains = useMemo(() => {
    const seen = new Map<string, string | null>()
    for (const r of rows) {
      const key = r.control.domain_en ?? 'General'
      if (!seen.has(key)) seen.set(key, r.control.domain_ar)
    }
    return [...seen.entries()].map(([en, ar]) => ({ en, ar }))
  }, [rows])

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (
        domainFilter !== 'all' &&
        (r.control.domain_en ?? 'General') !== domainFilter
      ) {
        return false
      }
      if (!q) return true
      const hay = [
        r.control.control_ref,
        r.control.title_en,
        r.control.title_ar,
        r.control.subdomain_en,
        r.control.requirement_en,
        r.notes,
        r.owner ? memberLabel(r.owner) : null,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, deferredQuery, statusFilter, domainFilter])

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>()
    for (const r of filtered) {
      const key = r.control.domain_en ?? 'General'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    return groups
  }, [filtered])

  const allEvidenceOptions = useMemo(() => {
    const seen = new Set(evidenceOptions.map((e) => e.id))
    return [
      ...extraEvidence.filter((e) => !seen.has(e.id)),
      ...evidenceOptions,
    ]
  }, [evidenceOptions, extraEvidence])

  const setOverride = useCallback((id: string, patch: Override) => {
    setOverrides((prev) => {
      const next = new Map(prev)
      next.set(id, { ...(prev.get(id) ?? {}), ...patch })
      return next
    })
  }, [])

  const markSaving = useCallback((id: string, on: boolean) => {
    setSaving((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  async function save(
    impl: Implementation,
    patch: ImplementationPatch,
    optimistic: Override,
    successMessage?: string
  ) {
    const previous: Override = {
      status: impl.status,
      owner_id: impl.owner_id,
      due_date: impl.due_date,
      notes: impl.notes,
      na_justification: impl.na_justification,
    }
    setOverride(impl.id, optimistic)
    markSaving(impl.id, true)
    const result = await updateImplementation(impl.id, patch)
    markSaving(impl.id, false)
    if (!result.ok) {
      setOverride(impl.id, previous)
      toast.error(result.error)
    } else if (successMessage) {
      toast.success(successMessage)
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      const allIn = ids.every((id) => next.has(id))
      for (const id of ids) {
        if (allIn) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  function applyBulk() {
    const ids = [...selected]
    if (ids.length === 0) return
    startBulk(async () => {
      const previous = new Map<string, Override>()
      for (const id of ids) {
        const r = rows.find((x) => x.id === id)
        if (r) previous.set(id, { status: r.status })
        setOverride(id, { status: bulkStatus })
      }
      const result = await bulkUpdateStatus(programId, ids, bulkStatus)
      if (result.ok) {
        toast.success(
          `${result.data.updated} control${result.data.updated === 1 ? '' : 's'} set to ${IMPLEMENTATION_STATUSES.find((s) => s.value === bulkStatus)?.label.toLowerCase()}.`
        )
        setSelected(new Set())
      } else {
        for (const [id, o] of previous) setOverride(id, o)
        toast.error(result.error)
      }
    })
  }

  async function handleLink(impl: Implementation, evidenceId: string) {
    const option = allEvidenceOptions.find((e) => e.id === evidenceId)
    if (!option) return
    if (impl.evidence.some((e) => e.id === evidenceId)) return
    const optimistic: LinkedEvidence = {
      id: option.id,
      name: option.name,
      review_status: option.review_status,
      file_name: null,
      valid_until: null,
    }
    setOverride(impl.id, { evidence: [...impl.evidence, optimistic] })
    const result = await linkEvidence(evidenceId, impl.id)
    if (!result.ok) {
      setOverride(impl.id, { evidence: impl.evidence })
      toast.error(result.error)
    } else {
      toast.success('Evidence linked.')
    }
  }

  async function handleUnlink(impl: Implementation, evidenceId: string) {
    setOverride(impl.id, {
      evidence: impl.evidence.filter((e) => e.id !== evidenceId),
    })
    const result = await unlinkEvidence(evidenceId, impl.id)
    if (!result.ok) {
      setOverride(impl.id, { evidence: impl.evidence })
      toast.error(result.error)
    }
  }

  const visibleIds = filtered.map((r) => r.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search controls, notes, owners…"
            className="pl-8"
            aria-label="Search controls"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | ImplementationStatus)
            }
            aria-label="Filter by status"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="all">All statuses</option>
            {IMPLEMENTATION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            aria-label="Filter by domain"
            className="h-8 max-w-56 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="all">All domains</option>
            {domains.map((d) => (
              <option key={d.en} value={d.en}>
                {d.en}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {filtered.length} of {rows.length} controls
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggleGroup(visibleIds)}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            {allVisibleSelected ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {allVisibleSelected ? 'Clear selection' : 'Select visible'}
          </button>
          {selected.size > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2 py-1">
              <span className="tabular-nums">{selected.size} selected →</span>
              <select
                value={bulkStatus}
                onChange={(e) =>
                  setBulkStatus(e.target.value as ImplementationStatus)
                }
                aria-label="Bulk status"
                className={selectClass}
                disabled={bulkPending}
              >
                {IMPLEMENTATION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="xs"
                onClick={applyBulk}
                disabled={bulkPending}
              >
                {bulkPending && <Loader2 className="animate-spin" />}
                Apply
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => setSelected(new Set())}
                disabled={bulkPending}
                aria-label="Clear selection"
              >
                <X />
              </Button>
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No controls match your filters.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {[...grouped.entries()].map(([domainKey, items]) => {
            const domainAr = items[0]?.control.domain_ar
            const ids = items.map((i) => i.id)
            const groupSelected = ids.every((id) => selected.has(id))
            const implementedCount = items.filter(
              (i) => i.status === 'implemented'
            ).length
            return (
              <section key={domainKey}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-medium tracking-wide uppercase">
                    <button
                      type="button"
                      onClick={() => toggleGroup(ids)}
                      className="mr-2 inline-flex align-middle text-muted-foreground hover:text-foreground"
                      aria-label={
                        groupSelected
                          ? `Deselect ${domainKey}`
                          : `Select all in ${domainKey}`
                      }
                    >
                      {groupSelected ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                    {domainKey}
                    {domainAr && (
                      <span
                        dir="rtl"
                        lang="ar"
                        className="ml-2 font-normal normal-case text-muted-foreground"
                      >
                        {domainAr}
                      </span>
                    )}
                  </h2>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {implementedCount} / {items.length} implemented
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full min-w-[880px] text-sm">
                    <thead className="bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="w-8 px-2 py-2" />
                        <th className="w-28 px-2 py-2 font-medium">Ref</th>
                        <th className="px-2 py-2 font-medium">Control</th>
                        <th className="w-36 px-2 py-2 font-medium">Status</th>
                        <th className="w-40 px-2 py-2 font-medium">Owner</th>
                        <th className="w-36 px-2 py-2 font-medium">Due</th>
                        <th className="w-20 px-2 py-2 text-center font-medium">
                          Evidence
                        </th>
                        <th className="w-8 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((impl) => {
                        const open = expanded.has(impl.id)
                        const isSaving = saving.has(impl.id)
                        const isSelected = selected.has(impl.id)
                        const linkable = allEvidenceOptions.filter(
                          (e) => !impl.evidence.some((x) => x.id === e.id)
                        )
                        return (
                          <MatrixRowGroup
                            key={impl.id}
                            impl={impl}
                            open={open}
                            isSaving={isSaving}
                            isSelected={isSelected}
                            members={members}
                            frameworkCode={frameworkCode}
                            organizationId={organizationId}
                            linkable={linkable}
                            onToggleExpanded={() => toggleExpanded(impl.id)}
                            onToggleSelected={() => toggleSelected(impl.id)}
                            onStatus={(status) =>
                              save(
                                impl,
                                { status },
                                { status },
                                `${impl.control.control_ref} marked ${IMPLEMENTATION_STATUSES.find((s) => s.value === status)?.label.toLowerCase()}.`
                              )
                            }
                            onOwner={(ownerId) =>
                              save(
                                impl,
                                { ownerId },
                                {
                                  owner_id: ownerId,
                                  owner:
                                    members.find((m) => m.id === ownerId) ?? null,
                                }
                              )
                            }
                            onDueDate={(dueDate) =>
                              save(impl, { dueDate }, { due_date: dueDate })
                            }
                            onNotes={(notes) =>
                              save(impl, { notes }, { notes }, 'Notes saved.')
                            }
                            onNaJustification={(naJustification) =>
                              save(
                                impl,
                                { naJustification },
                                { na_justification: naJustification },
                                'Justification saved.'
                              )
                            }
                            onLink={(evidenceId) => handleLink(impl, evidenceId)}
                            onUnlink={(evidenceId) =>
                              handleUnlink(impl, evidenceId)
                            }
                            onCreatedEvidence={(created) => {
                              setExtraEvidence((prev) => [
                                {
                                  id: created.id,
                                  name: created.name,
                                  review_status: created.review_status,
                                },
                                ...prev,
                              ])
                              setOverride(impl.id, {
                                evidence: [
                                  ...impl.evidence,
                                  {
                                    id: created.id,
                                    name: created.name,
                                    review_status: created.review_status,
                                    file_name: created.file_name,
                                    valid_until: created.valid_until,
                                  },
                                ],
                              })
                            }}
                          />
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

type MatrixRowGroupProps = {
  impl: Implementation
  open: boolean
  isSaving: boolean
  isSelected: boolean
  members: OrgMember[]
  frameworkCode: string
  organizationId: string
  linkable: EvidenceOption[]
  onToggleExpanded: () => void
  onToggleSelected: () => void
  onStatus: (status: ImplementationStatus) => void
  onOwner: (ownerId: string | null) => void
  onDueDate: (dueDate: string | null) => void
  onNotes: (notes: string) => void
  onNaJustification: (value: string) => void
  onLink: (evidenceId: string) => void
  onUnlink: (evidenceId: string) => void
  onCreatedEvidence: (created: {
    id: string
    name: string
    review_status: string
    file_name: string | null
    valid_until: string | null
  }) => void
}

function MatrixRowGroup({
  impl,
  open,
  isSaving,
  isSelected,
  members,
  frameworkCode,
  organizationId,
  linkable,
  onToggleExpanded,
  onToggleSelected,
  onStatus,
  onOwner,
  onDueDate,
  onNotes,
  onNaJustification,
  onLink,
  onUnlink,
  onCreatedEvidence,
}: MatrixRowGroupProps) {
  const c = impl.control
  const isNa = impl.status === 'not_applicable'
  const ownerKnown = !impl.owner_id || members.some((m) => m.id === impl.owner_id)

  return (
    <>
      <tr
        className={cn(
          'border-t border-border/60 bg-card align-top transition-colors',
          isSelected ? 'bg-foreground/[0.04]' : 'hover:bg-foreground/[0.02]',
          isNa && 'opacity-70'
        )}
      >
        <td className="px-2 py-2.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelected}
            aria-label={`Select ${c.control_ref}`}
            className="mt-1 h-3.5 w-3.5 accent-foreground"
          />
        </td>
        <td className="px-2 py-2.5">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
            {c.control_ref}
          </code>
          {c.criticality && (
            <p
              className={cn(
                'mt-1 text-[10px] font-medium uppercase',
                CRITICALITY_CLASS[c.criticality]
              )}
            >
              {c.criticality}
            </p>
          )}
        </td>
        <td className="px-2 py-2.5">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="block w-full text-left"
            aria-expanded={open}
          >
            <p className="font-medium leading-snug">{c.title_en}</p>
            {c.title_ar && (
              <p
                dir="rtl"
                lang="ar"
                className="mt-0.5 text-right text-xs text-muted-foreground"
              >
                {c.title_ar}
              </p>
            )}
            {c.subdomain_en && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {c.subdomain_en}
              </p>
            )}
          </button>
        </td>
        <td className="px-2 py-2.5">
          <select
            value={impl.status}
            onChange={(e) => onStatus(e.target.value as ImplementationStatus)}
            disabled={isSaving}
            aria-label={`Status for ${c.control_ref}`}
            className={cn(selectClass, 'w-full font-medium', STATUS_CLASS[impl.status])}
          >
            {IMPLEMENTATION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-2.5">
          <select
            value={impl.owner_id ?? ''}
            onChange={(e) => onOwner(e.target.value || null)}
            disabled={isSaving}
            aria-label={`Owner for ${c.control_ref}`}
            className={cn(selectClass, 'w-full')}
          >
            <option value="">Unassigned</option>
            {!ownerKnown && impl.owner_id && (
              <option value={impl.owner_id}>
                {impl.owner ? memberLabel(impl.owner) : 'Former member'}
              </option>
            )}
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(m)}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-2.5">
          <input
            type="date"
            value={impl.due_date ?? ''}
            onChange={(e) => onDueDate(e.target.value || null)}
            disabled={isSaving}
            aria-label={`Due date for ${c.control_ref}`}
            className={cn(selectClass, 'w-full')}
          />
        </td>
        <td className="px-2 py-2.5 text-center">
          <button
            type="button"
            onClick={onToggleExpanded}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs tabular-nums hover:bg-muted',
              impl.evidence.length === 0 && 'text-muted-foreground'
            )}
            aria-label={`${impl.evidence.length} evidence items`}
          >
            <Paperclip className="h-3 w-3" />
            {impl.evidence.length}
          </button>
        </td>
        <td className="px-2 py-2.5">
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={open}
            aria-label={open ? 'Collapse' : 'Expand'}
            className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-border/40 bg-muted/20">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Requirement
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                    {c.requirement_en}
                  </p>
                  <Link
                    href={`/dashboard/regulations/${encodeURIComponent(frameworkCode)}`}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View in Regulatory Library
                  </Link>
                </div>

                <div>
                  <label
                    htmlFor={`notes-${impl.id}`}
                    className="text-xs font-medium text-muted-foreground uppercase"
                  >
                    Implementation notes
                  </label>
                  <textarea
                    id={`notes-${impl.id}`}
                    key={`notes-${impl.id}-${impl.notes ?? ''}`}
                    defaultValue={impl.notes ?? ''}
                    rows={3}
                    placeholder="How is this control implemented? Systems, procedures, owners…"
                    onBlur={(e) => {
                      const v = e.target.value
                      if ((v.trim() || null) !== (impl.notes ?? null)) onNotes(v)
                    }}
                    className="mt-1 w-full rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Saved when you leave the field.
                    {impl.last_reviewed_at &&
                      ` Last reviewed ${new Date(impl.last_reviewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`}
                  </p>
                </div>

                {isNa && (
                  <div>
                    <label
                      htmlFor={`na-${impl.id}`}
                      className="text-xs font-medium text-amber-700 uppercase dark:text-amber-400"
                    >
                      Not-applicable justification
                    </label>
                    <textarea
                      id={`na-${impl.id}`}
                      key={`na-${impl.id}-${impl.na_justification ?? ''}`}
                      defaultValue={impl.na_justification ?? ''}
                      rows={2}
                      placeholder="Why does this control not apply? Assessors will expect a documented rationale."
                      onBlur={(e) => {
                        const v = e.target.value
                        if (
                          (v.trim() || null) !== (impl.na_justification ?? null)
                        ) {
                          onNaJustification(v)
                        }
                      }}
                      className="mt-1 w-full rounded-lg border border-amber-500/40 bg-card px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Evidence ({impl.evidence.length})
                  </p>
                  {linkable.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) onLink(e.target.value)
                      }}
                      aria-label="Link existing evidence"
                      className={cn(selectClass, 'max-w-48')}
                    >
                      <option value="">Link existing…</option>
                      {linkable.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {impl.evidence.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No evidence linked yet. Upload a file below or link an
                    item from the vault.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
                    {impl.evidence.map((e) => {
                      const validity = validityState(e.valid_until)
                      return (
                        <li
                          key={e.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <Link
                              href="/dashboard/evidence"
                              className="inline-flex items-center gap-1.5 truncate hover:underline"
                            >
                              <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="truncate">{e.name}</span>
                            </Link>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              <Badge
                                variant={
                                  e.review_status === 'accepted'
                                    ? 'default'
                                    : e.review_status === 'rejected'
                                      ? 'destructive'
                                      : 'outline'
                                }
                                className="h-4 px-1.5 text-[10px] capitalize"
                              >
                                {e.review_status}
                              </Badge>
                              {validity === 'expired' && (
                                <Badge
                                  variant="destructive"
                                  className="h-4 px-1.5 text-[10px]"
                                >
                                  Expired
                                </Badge>
                              )}
                              {validity === 'expiring' && (
                                <Badge
                                  variant="secondary"
                                  className="h-4 px-1.5 text-[10px]"
                                >
                                  Expiring soon
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => onUnlink(e.id)}
                            aria-label={`Unlink ${e.name}`}
                          >
                            <X />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <EvidenceUploader
                  organizationId={organizationId}
                  implementationId={impl.id}
                  compact
                  onCreated={onCreatedEvidence}
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
