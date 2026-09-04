'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ControlAttrBadges, KeyStar, ResultBadge } from '@/components/icfr/badges'
import { ControlForm } from '@/components/icfr/control-form'
import type { ControlWithDetail, Member, RiskWithLinks } from '@/lib/icfr/queries'
import { COSO_LABEL, type CosoComponent } from '@/lib/icfr/constants'
import { cn } from '@/lib/utils'

function nextRef(controls: ControlWithDetail[]) {
  const nums = controls
    .map((c) => Number(c.ref.replace(/^[A-Za-z]+/, '')))
    .filter((n) => Number.isFinite(n))
  return `C${(nums.length ? Math.max(...nums) : 0) + 1}`
}

export function AddControlDialog({
  processId,
  controls,
  risks,
  members,
}: {
  processId: string
  controls: ControlWithDetail[]
  risks: RiskWithLinks[]
  members: Member[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-3.5 w-3.5" />
        Add control
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add control</DialogTitle>
        </DialogHeader>
        <ControlForm
          processId={processId}
          risks={risks}
          members={members}
          nextRef={nextRef(controls)}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

export function ControlsTable({
  controls,
  selectedId,
  onSelect,
}: {
  controls: ControlWithDetail[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (controls.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        No controls yet. Add a control or import a template.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2.5 font-medium">Control</th>
            <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Attributes</th>
            <th className="hidden px-3 py-2.5 font-medium xl:table-cell">COSO</th>
            <th className="hidden px-3 py-2.5 font-medium md:table-cell">Owner</th>
            <th className="px-3 py-2.5 font-medium">Design</th>
            <th className="px-3 py-2.5 font-medium">Operating</th>
            <th className="px-3 py-2.5 text-right font-medium">Open def.</th>
          </tr>
        </thead>
        <tbody>
          {controls.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                'cursor-pointer border-t border-border/60 transition-colors hover:bg-foreground/[0.03]',
                selectedId === c.id && 'bg-foreground/[0.04]',
                c.status === 'retired' && 'opacity-60'
              )}
            >
              <td className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <KeyStar isKey={c.is_key} className="mt-1" />
                  <div className="min-w-0">
                    <p className="font-medium">
                      <code className="mr-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                        {c.ref}
                      </code>
                      {c.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.risk_refs.length ? `Addresses ${c.risk_refs.join(', ')}` : 'No linked risks'}
                      {c.status !== 'implemented' && ` · ${c.status}`}
                    </p>
                  </div>
                </div>
              </td>
              <td className="hidden px-3 py-2.5 lg:table-cell">
                <ControlAttrBadges
                  controlType={c.control_type}
                  nature={c.nature}
                  frequency={c.frequency}
                />
              </td>
              <td className="hidden px-3 py-2.5 text-xs text-muted-foreground xl:table-cell">
                {COSO_LABEL[c.coso_component as CosoComponent] ?? c.coso_component}
              </td>
              <td className="hidden px-3 py-2.5 text-xs md:table-cell">
                {c.owner?.name ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-3 py-2.5">
                <ResultBadge result={c.latest_design?.result} />
              </td>
              <td className="px-3 py-2.5">
                <ResultBadge result={c.latest_operating?.result} />
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {c.open_deficiency_count > 0 ? (
                  <Badge variant="destructive">{c.open_deficiency_count}</Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
