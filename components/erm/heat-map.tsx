'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import {
  IMPACT_LABEL,
  LIKELIHOOD_LABEL,
  RISK_BAND_ACTION,
  RISK_BAND_COLOR,
  RISK_BAND_LABEL,
  RISK_BAND_RANGE,
  RISK_BANDS,
  type RiskBand,
} from '@/lib/erm/constants'
import type { HeatCell, HeatMatrix } from '@/lib/erm/queries'
import { cn } from '@/lib/utils'

type Basis = 'inherent' | 'residual'

/**
 * A 5×5 likelihood × impact matrix. Every cell is rendered whether or not it
 * holds risks, the count is always visible as text, and the band legend is
 * labelled — so the colour escalation is reinforcement, never the only channel.
 * Clicking a cell filters the list beneath it.
 */
export function HeatMap({
  inherent,
  residual,
  initialBasis = 'residual',
  className,
}: {
  inherent: HeatMatrix
  residual: HeatMatrix
  initialBasis?: Basis
  className?: string
}) {
  const [basis, setBasis] = useState<Basis>(initialBasis)
  const [selected, setSelected] = useState<{ l: number; i: number } | null>(null)
  const [hovered, setHovered] = useState<HeatCell | null>(null)

  const matrix = basis === 'inherent' ? inherent : residual

  const selectedCell = useMemo(() => {
    if (!selected) return null
    return (
      matrix.cells.flat().find((c) => c.likelihood === selected.l && c.impact === selected.i) ??
      null
    )
  }, [matrix, selected])

  const maxCount = useMemo(
    () => Math.max(1, ...matrix.cells.flat().map((c) => c.count)),
    [matrix]
  )

  function toggleBasis(next: Basis) {
    setBasis(next)
    setSelected(null)
    setHovered(null)
  }

  return (
    <div className={cn('surface p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Portfolio view</p>
          <h2 className="mt-1 text-base font-medium">
            {basis === 'inherent' ? 'Inherent' : 'Residual'} risk heat map
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {matrix.total} open {matrix.total === 1 ? 'risk' : 'risks'}
            {matrix.unplotted > 0 && (
              <> · {matrix.unplotted} not plotted (no {basis} score)</>
            )}
          </p>
        </div>
        <div
          className="inline-flex rounded-lg border border-border p-0.5"
          role="group"
          aria-label="Scoring basis"
        >
          {(['inherent', 'residual'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => toggleBasis(b)}
              aria-pressed={basis === b}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs capitalize transition-colors',
                basis === b
                  ? 'bg-foreground/[0.06] font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="flex min-w-[520px] gap-2">
          {/* Impact axis title */}
          <div className="flex w-5 shrink-0 items-center justify-center">
            <span className="rotate-180 text-[10px] font-medium uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]">
              Impact
            </span>
          </div>

          <div className="flex-1">
            <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
              {matrix.cells.map((row) => {
                const impact = row[0].impact
                return [
                  <div
                    key={`label-${impact}`}
                    className="flex w-24 items-center justify-end pr-1 text-right"
                  >
                    <span className="text-[11px] leading-tight text-muted-foreground">
                      <span className="tabular-nums">{impact}</span>{' '}
                      <span className="hidden sm:inline">{IMPACT_LABEL[impact]}</span>
                    </span>
                  </div>,
                  ...row.map((cell) => {
                    const isSelected =
                      selected?.l === cell.likelihood && selected?.i === cell.impact
                    const intensity = cell.count === 0 ? 0 : cell.count / maxCount
                    return (
                      <button
                        key={`${cell.likelihood}-${cell.impact}`}
                        type="button"
                        onMouseEnter={() => setHovered(cell)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered(cell)}
                        onBlur={() => setHovered(null)}
                        onClick={() =>
                          setSelected(
                            isSelected ? null : { l: cell.likelihood, i: cell.impact }
                          )
                        }
                        aria-pressed={isSelected}
                        title={`Likelihood ${cell.likelihood} (${LIKELIHOOD_LABEL[cell.likelihood]}) × impact ${cell.impact} (${IMPACT_LABEL[cell.impact]}) = ${cell.score}, ${RISK_BAND_LABEL[cell.band]} band — ${cell.count} ${cell.count === 1 ? 'risk' : 'risks'}`}
                        className={cn(
                          'relative flex aspect-[4/3] min-h-[52px] flex-col items-center justify-center rounded-md border transition-shadow',
                          isSelected
                            ? 'border-foreground/60 shadow-[0_0_0_2px_var(--card)]'
                            : 'border-border/50 hover:border-foreground/40',
                          cell.count === 0 && 'opacity-55'
                        )}
                        style={{
                          background:
                            intensity > 0.66
                              ? RISK_BAND_COLOR[cell.band].strongFill
                              : RISK_BAND_COLOR[cell.band].fill,
                        }}
                      >
                        <span className="text-lg leading-none font-medium tabular-nums">
                          {cell.count > 0 ? cell.count : ''}
                        </span>
                        <span className="mt-1 text-[10px] leading-none tabular-nums opacity-60">
                          {cell.score}
                        </span>
                      </button>
                    )
                  }),
                ]
              })}

              {/* Likelihood axis labels */}
              <div />
              {[1, 2, 3, 4, 5].map((l) => (
                <div key={`lx-${l}`} className="pt-1 text-center">
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    <span className="tabular-nums">{l}</span>{' '}
                    <span className="hidden sm:inline">{LIKELIHOOD_LABEL[l]}</span>
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-1.5 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Likelihood
            </p>
          </div>
        </div>
      </div>

      {/* Legend — labelled, with the score range each band covers */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3">
        {RISK_BANDS.map((b: RiskBand) => (
          <span
            key={b}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            title={RISK_BAND_ACTION[b]}
          >
            <span
              className="h-3 w-3 rounded-[3px] border border-border/60"
              style={{ background: RISK_BAND_COLOR[b].fill }}
            />
            {RISK_BAND_LABEL[b]}
            <span className="tabular-nums opacity-70">
              {RISK_BAND_RANGE[b].min}–{RISK_BAND_RANGE[b].max}
            </span>
          </span>
        ))}
      </div>

      {/* Hover read-out — replaces a floating tooltip so it never clips */}
      <div className="mt-3 min-h-[2.5rem] rounded-lg bg-muted/40 px-3 py-2 text-xs">
        {hovered ? (
          <span>
            <span className="font-medium">
              {LIKELIHOOD_LABEL[hovered.likelihood]} × {IMPACT_LABEL[hovered.impact]}
            </span>{' '}
            <span className="text-muted-foreground">
              = {hovered.score}, {RISK_BAND_LABEL[hovered.band]} band ·{' '}
              {hovered.count} {hovered.count === 1 ? 'risk' : 'risks'}
              {hovered.count > 0 && (
                <>
                  {' '}
                  · {hovered.risks.slice(0, 4).map((r) => r.code).join(', ')}
                  {hovered.risks.length > 4 && ` +${hovered.risks.length - 4} more`}
                </>
              )}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            Hover a cell to read it; click to list the risks it holds.
          </span>
        )}
      </div>

      {selectedCell && (
        <div className="mt-3 rounded-lg border border-border p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                {selectedCell.count} {selectedCell.count === 1 ? 'risk' : 'risks'} at{' '}
                {LIKELIHOOD_LABEL[selectedCell.likelihood]} ×{' '}
                {IMPACT_LABEL[selectedCell.impact]}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {basis === 'inherent' ? 'Inherent' : 'Residual'} score {selectedCell.score} ·{' '}
                {RISK_BAND_ACTION[selectedCell.band]}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear cell selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {selectedCell.risks.length > 0 ? (
            <ul className="mt-2 divide-y divide-border/60">
              {selectedCell.risks.map((r) => (
                <li key={r.id} className="py-1.5">
                  <Link
                    href={`/dashboard/erm/risks/${r.id}`}
                    className="group flex items-baseline gap-2 text-sm"
                  >
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      {r.code}
                    </code>
                    <span className="min-w-0 flex-1 truncate group-hover:underline">
                      {r.title}
                    </span>
                    <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
                      {r.owner_name ?? 'Unassigned'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No risks are scored in this cell.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
