'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, NativeSelect, TextInput, Textarea, optionsFrom } from '@/components/erm/fields'
import {
  CONTROL_TYPES,
  CONTROL_TYPE_LABEL,
  EFFECTIVENESS_LABEL,
  LINK_KINDS,
  LINK_KIND_LABEL,
  type ErmControlType,
  type LinkKind,
} from '@/lib/erm/constants'
import { linkRecord, linkRiskControl, unlinkRecord, unlinkRiskControl } from '@/lib/actions/erm'
import type {
  ErmLink,
  IcfrControlOption,
  LibraryControlOption,
  RiskControlRow,
} from '@/lib/erm/queries'

type Source = 'library' | 'icfr' | 'custom'

function AddControlDialog({
  riskId,
  libraryControls,
  icfrControls,
}: {
  riskId: string
  libraryControls: LibraryControlOption[]
  icfrControls: IcfrControlOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [source, setSource] = useState<Source>('library')
  const [controlId, setControlId] = useState('')
  const [icfrControlId, setIcfrControlId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [controlType, setControlType] = useState<string>('preventive')
  const [effectiveness, setEffectiveness] = useState('3')

  const ready =
    (source === 'library' && controlId) ||
    (source === 'icfr' && icfrControlId) ||
    (source === 'custom' && name.trim())

  function submit() {
    startTransition(async () => {
      const result = await linkRiskControl({
        riskId,
        controlId: source === 'library' ? controlId : null,
        icfrControlId: source === 'icfr' ? icfrControlId : null,
        name: source === 'custom' ? name : null,
        description,
        controlType,
        effectiveness: Number(effectiveness),
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Control linked to the risk.')
      setControlId('')
      setIcfrControlId('')
      setName('')
      setDescription('')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus className="h-3.5 w-3.5" />
            Link control
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Link a mitigating control</DialogTitle>
          <DialogDescription>
            Controls are what move a risk from inherent to residual. Link the control that
            actually operates — from the regulatory library, from the ICFR risk and control
            matrix, or as a named control specific to this risk.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Source">
            <NativeSelect value={source} onChange={(e) => setSource(e.target.value as Source)}>
              <option value="library">Regulatory control library</option>
              <option value="icfr">ICFR control</option>
              <option value="custom">Named control</option>
            </NativeSelect>
          </Field>

          {source === 'library' && (
            <Field label="Library control">
              <NativeSelect value={controlId} onChange={(e) => setControlId(e.target.value)}>
                <option value="">Select a control…</option>
                {libraryControls.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.framework, c.code].filter(Boolean).join(' ')} — {c.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}

          {source === 'icfr' && (
            <Field label="ICFR control">
              <NativeSelect
                value={icfrControlId}
                onChange={(e) => setIcfrControlId(e.target.value)}
              >
                <option value="">Select a control…</option>
                {icfrControls.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ref} — {c.title}
                    {c.process ? ` (${c.process})` : ''}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}

          {source === 'custom' && (
            <Field label="Control name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          )}

          <Field label="Notes on how this control operates">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Control type">
              <NativeSelect
                value={controlType}
                onChange={(e) => setControlType(e.target.value)}
              >
                {optionsFrom(CONTROL_TYPES, CONTROL_TYPE_LABEL)}
              </NativeSelect>
            </Field>
            <Field label="Assessed effectiveness">
              <NativeSelect
                value={effectiveness}
                onChange={(e) => setEffectiveness(e.target.value)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} — {EFFECTIVENESS_LABEL[n]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button type="button" onClick={submit} disabled={pending || !ready}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Link control
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddLinkDialog({ riskId }: { riskId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [kind, setKind] = useState<string>('audit_observation')
  const [targetId, setTargetId] = useState('')
  const [label, setLabel] = useState('')

  function submit() {
    startTransition(async () => {
      const result = await linkRecord({ riskId, kind, targetId, label })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Record linked.')
      setTargetId('')
      setLabel('')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <Link2 className="h-3.5 w-3.5" />
            Link record
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link a record from another module</DialogTitle>
          <DialogDescription>
            Links are held by identifier and kind, so an audit observation or an ICFR
            deficiency can point at this risk without coupling the two registers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Record type">
            <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)}>
              {optionsFrom(LINK_KINDS, LINK_KIND_LABEL)}
            </NativeSelect>
          </Field>
          <Field
            label="Record identifier"
            hint="The UUID of the record in the other module."
          >
            <TextInput
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </Field>
          <Field label="Label" hint="How the record should read on this page.">
            <TextInput value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
        </div>

        <DialogFooter showCloseButton>
          <Button type="button" onClick={submit} disabled={pending || !targetId.trim()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Link record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RiskControlsPanel({
  riskId,
  controls,
  links,
  libraryControls,
  icfrControls,
}: {
  riskId: string
  controls: RiskControlRow[]
  links: ErmLink[]
  libraryControls: LibraryControlOption[]
  icfrControls: IcfrControlOption[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function removeControl(id: string) {
    startTransition(async () => {
      const result = await unlinkRiskControl(id, riskId)
      if (!result.ok) toast.error(result.error)
      else {
        toast.success('Control unlinked.')
        router.refresh()
      }
    })
  }

  function removeLink(id: string) {
    startTransition(async () => {
      const result = await unlinkRecord(id, riskId)
      if (!result.ok) toast.error(result.error)
      else {
        toast.success('Link removed.')
        router.refresh()
      }
    })
  }

  return (
    <div className="surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow">Control environment</p>
          <h2 className="mt-1 text-base font-medium">Controls and linked records</h2>
        </div>
        <div className="flex items-center gap-1">
          <AddLinkDialog riskId={riskId} />
          <AddControlDialog
            riskId={riskId}
            libraryControls={libraryControls}
            icfrControls={icfrControls}
          />
        </div>
      </div>

      {controls.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No controls linked. A residual score below the inherent score should be explained
          by controls that are actually operating.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/60">
          {controls.map((c) => {
            const title =
              c.library_control?.title ?? c.icfr_control?.title ?? c.name ?? 'Control'
            const ref = c.library_control?.code ?? c.icfr_control?.ref ?? null
            const originLabel = c.library_control
              ? 'Regulatory library'
              : c.icfr_control
                ? 'ICFR'
                : 'Named control'
            return (
              <li key={c.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {ref && (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                        {ref}
                      </code>
                    )}
                    <span className="font-medium">{title}</span>
                    <span className="pill pill-neutral">{originLabel}</span>
                    {c.control_type && (
                      <span className="pill pill-info">
                        {CONTROL_TYPE_LABEL[c.control_type as ErmControlType] ?? c.control_type}
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                  )}
                  {c.effectiveness && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Effectiveness {c.effectiveness}/5 — {EFFECTIVENESS_LABEL[c.effectiveness]}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() => removeControl(c.id)}
                  aria-label={`Unlink ${title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {links.length > 0 && (
        <div className="mt-4 border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-muted-foreground">Linked records</p>
          <ul className="mt-2 space-y-1.5">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="pill pill-neutral">
                    {LINK_KIND_LABEL[l.kind as LinkKind] ?? l.kind}
                  </span>
                  <span className="truncate">{l.label ?? l.target_id}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() => removeLink(l.id)}
                  aria-label="Remove link"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
