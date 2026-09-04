'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
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
import { Checkbox, Field, NativeSelect, TextInput, Textarea } from '@/components/erm/fields'
import { AppetitePill } from '@/components/erm/badges'
import {
  APPETITE_LEVELS,
  APPETITE_LEVEL_HINT,
  APPETITE_LEVEL_LABEL,
  APPETITE_SUGGESTED_TOLERANCE,
  RISK_BAND_COLOR,
  RISK_BAND_LABEL,
  bandForScore,
  type AppetiteLevel,
} from '@/lib/erm/constants'
import { deleteAppetite, saveAppetite, type AppetiteInput } from '@/lib/actions/erm'
import type { AppetiteRow } from '@/lib/erm/queries'
import type { CategoryOption } from '@/components/erm/risk-register-table'
import { cn } from '@/lib/utils'

function AppetiteDialog({
  categories,
  initial,
  appetiteId,
  trigger,
}: {
  categories: CategoryOption[]
  initial?: AppetiteInput
  appetiteId?: string
  trigger: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<AppetiteInput>(
    initial ?? {
      categoryId: '',
      statementEn: '',
      statementAr: '',
      appetiteLevel: 'cautious',
      toleranceThreshold: APPETITE_SUGGESTED_TOLERANCE.cautious,
      reviewDate: '',
      approve: false,
    }
  )

  function set<K extends keyof AppetiteInput>(key: K, value: AppetiteInput[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function changeLevel(level: string) {
    setValues((v) => ({
      ...v,
      appetiteLevel: level,
      toleranceThreshold:
        APPETITE_SUGGESTED_TOLERANCE[level as AppetiteLevel] ?? v.toleranceThreshold,
    }))
  }

  function submit() {
    startTransition(async () => {
      const result = await saveAppetite(values, appetiteId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(appetiteId ? 'Appetite statement updated.' : 'Appetite statement saved.')
      setOpen(false)
      router.refresh()
    })
  }

  const band = bandForScore(values.toleranceThreshold)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {appetiteId ? 'Edit appetite statement' : 'Set a risk appetite statement'}
          </DialogTitle>
          <DialogDescription>
            Appetite is the amount of risk the board is willing to accept in pursuit of the
            objectives; tolerance is the acceptable variation around it, set here as the
            residual score above which a risk must be escalated. Under the CMA Corporate
            Governance Regulations, setting and overseeing this sits with the board.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Scope">
            <NativeSelect
              value={values.categoryId ?? ''}
              onChange={(e) => set('categoryId', e.target.value)}
              disabled={Boolean(appetiteId)}
            >
              <option value="">Enterprise-wide</option>
              {categories
                .filter((c) => c.level === 1)
                .map((c) => (
                  <optgroup key={c.id} label={`${c.code} — ${c.name_en}`}>
                    <option value={c.id}>{c.name_en}</option>
                    {categories
                      .filter((k) => k.parent_id === c.id)
                      .map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.code} — {k.name_en}
                        </option>
                      ))}
                  </optgroup>
                ))}
            </NativeSelect>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Appetite level"
              hint={APPETITE_LEVEL_HINT[values.appetiteLevel as AppetiteLevel]}
            >
              <NativeSelect
                value={values.appetiteLevel}
                onChange={(e) => changeLevel(e.target.value)}
              >
                {APPETITE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {APPETITE_LEVEL_LABEL[l]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Tolerance threshold (residual score 1–25)"
              hint={
                band
                  ? `A residual score above ${values.toleranceThreshold} breaches appetite — that is the top of the ${RISK_BAND_LABEL[band]} band.`
                  : undefined
              }
            >
              <TextInput
                type="number"
                min={1}
                max={25}
                value={values.toleranceThreshold}
                onChange={(e) => set('toleranceThreshold', Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label="Statement (English)" htmlFor="erm-appetite-en">
            <Textarea
              id="erm-appetite-en"
              value={values.statementEn}
              onChange={(e) => set('statementEn', e.target.value)}
              rows={4}
            />
          </Field>

          <Field label="Statement (Arabic)" htmlFor="erm-appetite-ar">
            <Textarea
              id="erm-appetite-ar"
              dir="rtl"
              value={values.statementAr ?? ''}
              onChange={(e) => set('statementAr', e.target.value)}
              rows={4}
            />
          </Field>

          <div className="flex flex-wrap items-end gap-6">
            <Field label="Next review date" className="w-48">
              <TextInput
                type="date"
                value={values.reviewDate ?? ''}
                onChange={(e) => set('reviewDate', e.target.value)}
              />
            </Field>
            <Checkbox
              label="Record my approval"
              checked={Boolean(values.approve)}
              onChange={(e) => set('approve', e.target.checked)}
              className="pb-2"
            />
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || !values.statementEn.trim()}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save statement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UtilisationMeter({ row }: { row: AppetiteRow }) {
  const pct = Math.min(row.utilisation_pct, 130)
  const over = row.utilisation_pct > 100
  const band = bandForScore(row.max_residual)
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">
          Highest residual {row.max_residual ?? '—'} of tolerance {row.tolerance_threshold}
        </span>
        <span
          className={cn('tabular-nums', over ? 'text-danger' : 'text-muted-foreground')}
        >
          {row.utilisation_pct}%
        </span>
      </div>
      <div className="meter mt-1.5">
        <span
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: band ? RISK_BAND_COLOR[band].hex : undefined,
          }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {row.risk_count} {row.risk_count === 1 ? 'risk' : 'risks'} in scope · average residual{' '}
        {row.avg_residual ?? '—'} ·{' '}
        {row.breach_count > 0 ? (
          <span className="text-danger">
            {row.breach_count} above tolerance
          </span>
        ) : (
          'none above tolerance'
        )}
      </p>
    </div>
  )
}

export function AppetitePanel({
  rows,
  categories,
}: {
  rows: AppetiteRow[]
  categories: CategoryOption[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteAppetite(id)
      if (!result.ok) toast.error(result.error)
      else {
        toast.success('Statement removed.')
        router.refresh()
      }
    })
  }

  return (
    <div>
      <div className="flex justify-end">
        <AppetiteDialog
          categories={categories}
          trigger={
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Add statement
            </Button>
          }
        />
      </div>

      {rows.length === 0 ? (
        <div className="surface mt-4 p-6 text-center">
          <p className="font-medium">No appetite statements yet</p>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
            Importing the taxonomy creates a default enterprise-wide statement. Add
            category-level statements where the board is willing to accept more exposure in
            some domains than others.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <div key={row.id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="eyebrow">
                    {row.category_code ? row.category_code : 'Enterprise-wide'}
                  </p>
                  <h3 className="mt-1 font-medium">
                    {row.category_name_en ?? 'All risk domains'}
                  </h3>
                  {row.category_name_ar && (
                    <p className="text-xs text-muted-foreground" dir="rtl">
                      {row.category_name_ar}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <AppetitePill level={row.appetite_level} />
                  <AppetiteDialog
                    categories={categories}
                    appetiteId={row.id}
                    initial={{
                      categoryId: row.category_id ?? '',
                      statementEn: row.statement_en,
                      statementAr: row.statement_ar ?? '',
                      appetiteLevel: row.appetite_level,
                      toleranceThreshold: row.tolerance_threshold,
                      reviewDate: row.review_date ?? '',
                      approve: false,
                    }}
                    trigger={
                      <Button variant="ghost" size="xs">
                        Edit
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => remove(row.id)}
                    aria-label="Remove appetite statement"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed">{row.statement_en}</p>
              {row.statement_ar && (
                <p
                  className="mt-2 text-sm leading-relaxed text-muted-foreground"
                  dir="rtl"
                  lang="ar"
                >
                  {row.statement_ar}
                </p>
              )}

              <div className="mt-4">
                <UtilisationMeter row={row} />
              </div>

              <p className="mt-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                {row.approved_at ? (
                  <>
                    Approved {row.approved_at.slice(0, 10)}
                    {row.approver_name && <> by {row.approver_name}</>}
                  </>
                ) : (
                  <span className="text-warning-foreground">Not formally approved</span>
                )}
                {row.review_date && <> · Next review {row.review_date}</>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
