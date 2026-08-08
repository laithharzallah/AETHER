'use client'

import { useActionState, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { assessControl, type GrcActionState } from '@/lib/actions/grc'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Pill, StatusPill } from '@/components/dashboard/pills'
import { formatRelativeDays } from '@/lib/dashboard/format'

export type ControlRow = {
  id: string
  control_code: string
  title: string
  implementation_status: string
  effectiveness: string
  maturity: number | null
  last_assessed_at: string | null
  domain_title: string | null
}

const selectClass =
  'flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export function ControlAssessment({
  control,
  canWrite,
  maturityScale,
}: {
  control: ControlRow
  canWrite: boolean
  /** True when the framework defines its own 0-5 maturity scale. */
  maturityScale: boolean
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<GrcActionState, FormData>(
    assessControl,
    {}
  )

  return (
    <div className="bg-card">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-2 text-sm">
            <span className="font-medium tabular-nums">{control.control_code}</span>
            <span className="min-w-0">{control.title}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusPill status={control.implementation_status} />
            <StatusPill status={control.effectiveness} />
            {control.maturity != null && (
              <Pill title="Maturity level on the 0-5 scale">
                maturity {control.maturity}
              </Pill>
            )}
            {control.domain_title && (
              <span className="text-xs text-muted-foreground">
                {control.domain_title}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {control.last_assessed_at
                ? `assessed ${formatRelativeDays(control.last_assessed_at)}`
                : 'never assessed'}
            </span>
          </div>
        </div>

        {canWrite && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <>
                <ChevronUp className="mr-1.5 h-3.5 w-3.5" /> Close
              </>
            ) : (
              <>
                <ChevronDown className="mr-1.5 h-3.5 w-3.5" /> Assess
              </>
            )}
          </Button>
        )}
      </div>

      {open && canWrite && (
        <form action={action} className="border-t border-border/60 p-4">
          <input type="hidden" name="controlId" value={control.id} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor={`impl-${control.id}`}>Implementation</Label>
              <select
                id={`impl-${control.id}`}
                name="implementationStatus"
                defaultValue={control.implementation_status}
                className={selectClass}
              >
                <option value="not_assessed">Not assessed</option>
                <option value="not_implemented">Not implemented</option>
                <option value="planned">Planned</option>
                <option value="partially_implemented">Partially implemented</option>
                <option value="implemented">Implemented</option>
                <option value="not_applicable">Not applicable</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`eff-${control.id}`}>Effectiveness</Label>
              <select
                id={`eff-${control.id}`}
                name="effectiveness"
                defaultValue={control.effectiveness}
                className={selectClass}
              >
                <option value="untested">Untested</option>
                <option value="ineffective">Ineffective</option>
                <option value="needs_improvement">Needs improvement</option>
                <option value="effective">Effective</option>
              </select>
            </div>

            {maturityScale && (
              <div className="space-y-1.5">
                <Label htmlFor={`mat-${control.id}`}>Maturity</Label>
                <select
                  id={`mat-${control.id}`}
                  name="maturity"
                  defaultValue={control.maturity?.toString() ?? ''}
                  className={selectClass}
                >
                  <option value="">Not rated</option>
                  <option value="0">0 — Non-existent</option>
                  <option value="1">1 — Ad-hoc</option>
                  <option value="2">2 — Repeatable but informal</option>
                  <option value="3">3 — Structured and formalised</option>
                  <option value="4">4 — Managed and measurable</option>
                  <option value="5">5 — Adaptive</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor={`type-${control.id}`}>Assessment type</Label>
              <select
                id={`type-${control.id}`}
                name="assessmentType"
                defaultValue="self"
                className={selectClass}
              >
                <option value="self">Self-assessment</option>
                <option value="internal_audit">Internal audit</option>
                <option value="external_audit">External audit</option>
                <option value="regulator">Regulator review</option>
                <option value="automated">Automated check</option>
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor={`findings-${control.id}`}>
              Findings{' '}
              <span className="font-normal text-muted-foreground">
                (kept with this assessment, not overwritten by the next one)
              </span>
            </Label>
            <textarea
              id={`findings-${control.id}`}
              name="findings"
              rows={2}
              placeholder="What was tested, what the evidence showed, and anything outstanding."
              className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Record assessment
            </Button>
            {state.error && (
              <p role="alert" className="text-xs text-destructive">
                {state.error}
              </p>
            )}
            {state.success && (
              <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
                {state.success}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
