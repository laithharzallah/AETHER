'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ControlAttrBadges, KeyStar, ResultBadge } from '@/components/icfr/badges'
import { ControlForm } from '@/components/icfr/control-form'
import { DeficienciesPanel } from '@/components/icfr/deficiencies-panel'
import { TestProcedureDraft } from '@/components/icfr/test-procedure-draft'
import { TestsPanel } from '@/components/icfr/tests-panel'
import { deleteControl, setRiskControlLinks } from '@/lib/actions/icfr'
import type { ControlWithDetail, Member, RiskWithLinks } from '@/lib/icfr/queries'
import {
  COSO_LABEL,
  CONTROL_STATUS_LABEL,
  LEVEL_LABEL,
  type ControlStatus,
  type CosoComponent,
  type Level,
} from '@/lib/icfr/constants'
import { cn } from '@/lib/utils'

function RiskLinks({
  control,
  risks,
  processId,
}: {
  control: ControlWithDetail
  risks: RiskWithLinks[]
  processId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function toggle(riskId: string) {
    const next = control.risk_ids.includes(riskId)
      ? control.risk_ids.filter((id) => id !== riskId)
      : [...control.risk_ids, riskId]
    startTransition(async () => {
      const result = await setRiskControlLinks(control.id, next, processId)
      if (!result.ok) toast.error(result.error)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Risks addressed</h3>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {risks.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">No risks defined in this process.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {risks.map((r) => {
            const linked = control.risk_ids.includes(r.id)
            return (
              <li key={r.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-foreground/[0.03]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 accent-primary"
                    checked={linked}
                    disabled={pending}
                    onChange={() => toggle(r.id)}
                  />
                  <code className="shrink-0 font-mono">{r.ref}</code>
                  <span className={cn(!linked && 'text-muted-foreground')}>{r.description}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function ControlDrawer({
  control,
  risks,
  members,
  processId,
  onClose,
}: {
  control: ControlWithDetail
  risks: RiskWithLinks[]
  members: Member[]
  processId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<{ md: string; type: string; key: number }>({
    md: '',
    type: 'operating',
    key: 0,
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 4000)
      return
    }
    startTransition(async () => {
      const result = await deleteControl(control.id, processId)
      if (result.ok) {
        toast.success('Control deleted.')
        onClose()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
      />
      <aside
        role="dialog"
        aria-label={`Control ${control.ref}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-border/60 bg-background shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <KeyStar isKey={control.is_key} />
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                {control.ref}
              </code>
              <Badge variant="outline">{LEVEL_LABEL[control.level as Level] ?? control.level}</Badge>
              {control.status !== 'implemented' && (
                <Badge variant="ghost">
                  {CONTROL_STATUS_LABEL[control.status as ControlStatus] ?? control.status}
                </Badge>
              )}
            </div>
            <h2 className="mt-2 text-lg font-medium leading-snug">{control.title}</h2>
            <div className="mt-2">
              <ControlAttrBadges
                controlType={control.control_type}
                nature={control.nature}
                frequency={control.frequency}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!editing && (
              <Button variant="ghost" size="icon-sm" aria-label="Edit control" onClick={() => setEditing(true)}>
                <Pencil />
              </Button>
            )}
            <Button
              variant={confirmDelete ? 'destructive' : 'ghost'}
              size={confirmDelete ? 'sm' : 'icon-sm'}
              aria-label="Delete control"
              disabled={pending}
              onClick={handleDelete}
            >
              <Trash2 />
              {confirmDelete && 'Confirm'}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
              <X />
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {editing ? (
            <ControlForm
              key={control.updated_at}
              processId={processId}
              control={control}
              risks={risks}
              members={members}
              onDone={() => setEditing(false)}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Control description</h3>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/85">
                      {control.description || (
                        <span className="text-muted-foreground">Not documented.</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Evidence retained</h3>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/85">
                      {control.evidence_description || (
                        <span className="text-muted-foreground">Not documented.</span>
                      )}
                    </p>
                  </div>
                </div>
                <dl className="space-y-2 rounded-lg border border-border/60 p-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Owner</dt>
                    <dd>{control.owner?.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">COSO component</dt>
                    <dd>{COSO_LABEL[control.coso_component as CosoComponent] ?? control.coso_component}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Latest design</dt>
                    <dd className="mt-0.5">
                      <ResultBadge result={control.latest_design?.result} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Latest operating</dt>
                    <dd className="mt-0.5">
                      <ResultBadge result={control.latest_operating?.result} />
                    </dd>
                  </div>
                </dl>
              </div>

              <RiskLinks control={control} risks={risks} processId={processId} />

              <TestProcedureDraft
                controlId={control.id}
                onUse={(md, type) => setDraft((d) => ({ md, type, key: d.key + 1 }))}
              />

              <TestsPanel
                control={control}
                processId={processId}
                members={members}
                draftProcedure={draft.md || undefined}
                draftType={draft.type}
                draftKey={draft.key}
              />

              <DeficienciesPanel control={control} processId={processId} members={members} />
            </>
          )}
        </div>
      </aside>
    </>
  )
}
