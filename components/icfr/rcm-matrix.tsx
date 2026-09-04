'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Grid3X3, List, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AssertionChips, KeyStar } from '@/components/icfr/badges'
import { toggleRiskControlLink } from '@/lib/actions/icfr'
import type { ControlWithDetail, RiskWithLinks } from '@/lib/icfr/queries'
import { cn } from '@/lib/utils'

type Link = { riskId: string; controlId: string }

export function RcmMatrix({
  processId,
  risks,
  controls,
  onSelectControl,
}: {
  processId: string
  risks: RiskWithLinks[]
  controls: ControlWithDetail[]
  onSelectControl: (controlId: string) => void
}) {
  const router = useRouter()
  const [view, setView] = useState<'matrix' | 'list'>('matrix')
  const [, startTransition] = useTransition()

  const serverLinks: Link[] = risks.flatMap((r) =>
    r.control_ids.map((controlId) => ({ riskId: r.id, controlId }))
  )
  const [links, applyOptimistic] = useOptimistic(
    serverLinks,
    (state: Link[], change: Link & { linked: boolean }) =>
      change.linked
        ? [...state, { riskId: change.riskId, controlId: change.controlId }]
        : state.filter((l) => !(l.riskId === change.riskId && l.controlId === change.controlId))
  )

  const isLinked = (riskId: string, controlId: string) =>
    links.some((l) => l.riskId === riskId && l.controlId === controlId)

  function toggle(riskId: string, controlId: string) {
    const next = !isLinked(riskId, controlId)
    startTransition(async () => {
      applyOptimistic({ riskId, controlId, linked: next })
      const result = await toggleRiskControlLink(riskId, controlId, next, processId)
      if (!result.ok) toast.error(result.error)
      router.refresh()
    })
  }

  const uncovered = risks.filter((r) => !links.some((l) => l.riskId === r.id))

  if (risks.length === 0 && controls.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        Add risks and controls to build the matrix.
      </p>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {risks.length} risks × {controls.length} controls · {links.length} links
          {uncovered.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-3 w-3" />
              {uncovered.length} risk{uncovered.length === 1 ? '' : 's'} without a control
            </span>
          )}
        </div>
        <div className="inline-flex rounded-lg border border-border/60 p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === 'matrix' ? 'secondary' : 'ghost'}
            className="h-7 px-2.5"
            onClick={() => setView('matrix')}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            Matrix
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === 'list' ? 'secondary' : 'ghost'}
            className="h-7 px-2.5"
            onClick={() => setView('list')}
          >
            <List className="h-3.5 w-3.5" />
            List
          </Button>
        </div>
      </div>

      {view === 'matrix' ? (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40">
                <th className="sticky left-0 z-10 min-w-[260px] bg-muted/40 px-3 py-2 text-left font-medium text-muted-foreground backdrop-blur">
                  Risk
                </th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">
                  Assertions
                </th>
                {controls.map((c) => (
                  <th
                    key={c.id}
                    className="h-28 w-10 px-1 py-2 align-bottom font-medium"
                    title={`${c.ref} — ${c.title}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectControl(c.id)}
                      className="mx-auto flex flex-col items-center gap-1 hover:underline"
                    >
                      <KeyStar isKey={c.is_key} />
                      <span
                        className="font-mono"
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                      >
                        {c.ref}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => {
                const covered = links.some((l) => l.riskId === r.id)
                return (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-foreground/[0.02]">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top">
                      <div className="flex items-start gap-2">
                        <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                          {r.ref}
                        </code>
                        <span className={cn('line-clamp-3', !covered && 'text-amber-700 dark:text-amber-400')}>
                          {r.description}
                        </span>
                        {r.fraud_risk && (
                          <Badge variant="destructive" className="shrink-0 text-[10px]">
                            Fraud
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <AssertionChips assertions={r.assertions} />
                    </td>
                    {controls.map((c) => {
                      const linked = isLinked(r.id, c.id)
                      return (
                        <td key={c.id} className="px-1 py-2 text-center align-middle">
                          <button
                            type="button"
                            aria-pressed={linked}
                            aria-label={`${linked ? 'Unlink' : 'Link'} ${c.ref} to ${r.ref}`}
                            onClick={() => toggle(r.id, c.id)}
                            className={cn(
                              'mx-auto flex h-6 w-6 items-center justify-center rounded-md border transition-colors',
                              linked
                                ? c.is_key
                                  ? 'border-emerald-600 bg-emerald-500 text-white'
                                  : 'border-emerald-500/60 bg-emerald-500/30 text-emerald-900 dark:text-emerald-100'
                                : 'border-border/60 hover:border-foreground/40'
                            )}
                          >
                            {linked ? '●' : ''}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {risks.map((r) => {
            const linkedControls = controls.filter((c) => isLinked(r.id, c.id))
            return (
              <div key={r.id} className="rounded-lg border border-border/60 bg-card p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                    {r.ref}
                  </code>
                  <p className="min-w-0 flex-1 text-sm">{r.description}</p>
                  {r.fraud_risk && <Badge variant="destructive">Fraud risk</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <AssertionChips assertions={r.assertions} />
                </div>
                <div className="mt-3 border-t border-border/60 pt-2">
                  {linkedControls.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      No control addresses this risk.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {linkedControls.map((c) => (
                        <li key={c.id} className="text-xs">
                          <button
                            type="button"
                            onClick={() => onSelectControl(c.id)}
                            className="inline-flex items-center gap-2 text-left hover:underline"
                          >
                            <KeyStar isKey={c.is_key} />
                            <code className="font-mono">{c.ref}</code>
                            <span>{c.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
