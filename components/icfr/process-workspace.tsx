'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ControlDrawer } from '@/components/icfr/control-drawer'
import { AddControlDialog, ControlsTable } from '@/components/icfr/controls-table'
import { RcmMatrix } from '@/components/icfr/rcm-matrix'
import { RisksTable } from '@/components/icfr/risks-table'
import type { ProcessDetail } from '@/lib/icfr/queries'

type Tab = 'rcm' | 'controls' | 'risks'

const TABS: { value: Tab; label: string }[] = [
  { value: 'rcm', label: 'Risk & control matrix' },
  { value: 'controls', label: 'Controls' },
  { value: 'risks', label: 'Risks' },
]

export function ProcessWorkspace({ detail }: { detail: ProcessDetail }) {
  const { process, risks, controls, members } = detail
  const [tab, setTab] = useState<Tab>('rcm')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = selectedId ? controls.find((c) => c.id === selectedId) ?? null : null
  const close = useCallback(() => setSelectedId(null), [])
  const controlRefById = new Map(controls.map((c) => [c.id, c.ref]))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60">
        <div className="flex gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                tab === t.value
                  ? 'border-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {t.value === 'risks' ? risks.length : t.value === 'controls' ? controls.length : ''}
              </span>
            </button>
          ))}
        </div>
        <div className="pb-2">
          {tab !== 'risks' && (
            <AddControlDialog
              processId={process.id}
              controls={controls}
              risks={risks}
              members={members}
            />
          )}
          {tab === 'risks' && risks.length === 0 && controls.length === 0 && (
            <Button size="sm" variant="ghost" onClick={() => setTab('controls')}>
              Go to controls
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4">
        {tab === 'rcm' && (
          <RcmMatrix
            processId={process.id}
            risks={risks}
            controls={controls}
            onSelectControl={setSelectedId}
          />
        )}
        {tab === 'controls' && (
          <ControlsTable controls={controls} selectedId={selectedId} onSelect={setSelectedId} />
        )}
        {tab === 'risks' && (
          <RisksTable processId={process.id} risks={risks} controlRefById={controlRefById} />
        )}
      </div>

      {selected && (
        <ControlDrawer
          key={selected.id}
          control={selected}
          risks={risks}
          members={members}
          processId={process.id}
          onClose={close}
        />
      )}
    </div>
  )
}
