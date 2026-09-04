'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResultBadge, formatDate } from '@/components/icfr/badges'
import { Field, NativeSelect, Textarea, optionsFrom } from '@/components/icfr/fields'
import { PolicyMarkdown } from '@/components/policy-markdown'
import { createTest, deleteTest, updateTest } from '@/lib/actions/icfr'
import type { ControlWithDetail, Member } from '@/lib/icfr/queries'
import {
  FREQUENCY_LABEL,
  SAMPLE_SIZE_GUIDE,
  TEST_RESULTS,
  TEST_RESULT_LABEL,
  TEST_TYPES,
  TEST_TYPE_LABEL,
  type Frequency,
} from '@/lib/icfr/constants'

type TestRow = ControlWithDetail['tests'][number]

function defaultPeriod() {
  const d = new Date()
  return `FY${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
}

function TestForm({
  control,
  processId,
  test,
  members,
  initialProcedure,
  initialType,
  onDone,
}: {
  control: ControlWithDetail
  processId: string
  test?: TestRow
  members: Member[]
  initialProcedure?: string
  initialType?: string
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const guide = SAMPLE_SIZE_GUIDE[control.frequency as Frequency]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const num = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null)
    const input = {
      period: String(fd.get('period') ?? ''),
      testType: String(fd.get('testType') ?? ''),
      procedure: String(fd.get('procedure') ?? ''),
      populationSize: num('populationSize'),
      sampleSize: num('sampleSize'),
      exceptions: num('exceptions') ?? 0,
      result: String(fd.get('result') ?? 'not_tested'),
      testerId: String(fd.get('tester') ?? '') || null,
      testedAt: String(fd.get('testedAt') ?? '') || null,
      notes: String(fd.get('notes') ?? ''),
      workpaperRef: String(fd.get('workpaperRef') ?? ''),
    }
    startTransition(async () => {
      const result = test
        ? await updateTest(test.id, processId, input)
        : await createTest(control.id, processId, input)
      if (result.ok) {
        toast.success(test ? 'Test updated.' : 'Test recorded.')
        router.refresh()
        onDone()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Period" htmlFor="t-period">
          <Input id="t-period" name="period" defaultValue={test?.period ?? defaultPeriod()} required />
        </Field>
        <Field label="Test type" htmlFor="t-type">
          <NativeSelect id="t-type" name="testType" defaultValue={test?.test_type ?? initialType ?? 'operating'}>
            {optionsFrom(TEST_TYPES, TEST_TYPE_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="Result" htmlFor="t-result">
          <NativeSelect id="t-result" name="result" defaultValue={test?.result ?? 'not_tested'}>
            {optionsFrom(TEST_RESULTS, TEST_RESULT_LABEL)}
          </NativeSelect>
        </Field>
        <Field label="Tested on" htmlFor="t-date">
          <Input id="t-date" name="testedAt" type="date" defaultValue={test?.tested_at ?? ''} />
        </Field>
        <Field label="Population" htmlFor="t-pop">
          <Input id="t-pop" name="populationSize" type="number" min={0} defaultValue={test?.population_size ?? ''} />
        </Field>
        <Field
          label="Sample"
          htmlFor="t-sample"
          hint={guide ? `${FREQUENCY_LABEL[control.frequency as Frequency]}: ${guide.min === guide.max ? guide.min : `${guide.min}–${guide.max}`}` : undefined}
        >
          <Input id="t-sample" name="sampleSize" type="number" min={0} defaultValue={test?.sample_size ?? ''} />
        </Field>
        <Field label="Exceptions" htmlFor="t-exc">
          <Input id="t-exc" name="exceptions" type="number" min={0} defaultValue={test?.exceptions ?? 0} />
        </Field>
        <Field label="Tester" htmlFor="t-tester">
          <NativeSelect id="t-tester" name="tester" defaultValue={test?.tester_id ?? ''}>
            <option value="">—</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Workpaper ref" htmlFor="t-wp">
        <Input id="t-wp" name="workpaperRef" defaultValue={test?.workpaper_ref ?? ''} placeholder="WP-P2P-C4-Q3" />
      </Field>
      <Field label="Test procedure (Markdown)" htmlFor="t-proc">
        <Textarea
          id="t-proc"
          name="procedure"
          defaultValue={test?.procedure ?? initialProcedure ?? ''}
          className="min-h-24 font-mono text-xs"
        />
      </Field>
      <Field label="Notes / conclusion" htmlFor="t-notes">
        <Textarea id="t-notes" name="notes" defaultValue={test?.notes ?? ''} className="min-h-16" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {test ? 'Save test' : 'Record test'}
        </Button>
      </div>
    </form>
  )
}

export function TestsPanel({
  control,
  processId,
  members,
  draftProcedure,
  draftType,
  draftKey,
}: {
  control: ControlWithDetail
  processId: string
  members: Member[]
  draftProcedure?: string
  draftType?: string
  draftKey: number
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [dismissedDraftKey, setDismissedDraftKey] = useState(0)
  const [pending, startTransition] = useTransition()

  // A new AI draft opens the add form pre-filled (keyed so it remounts) until dismissed.
  const draftOpen = draftKey > dismissedDraftKey && Boolean(draftProcedure) && !editingId
  const showAdd = adding || draftOpen

  function closeAdd() {
    setAdding(false)
    setDismissedDraftKey(draftKey)
  }

  function handleDelete(id: string) {
    if (confirmId !== id) {
      setConfirmId(id)
      setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 4000)
      return
    }
    startTransition(async () => {
      const result = await deleteTest(id, processId)
      if (result.ok) {
        toast.success('Test deleted.')
        router.refresh()
      } else {
        toast.error(result.error)
      }
      setConfirmId(null)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Tests</h3>
        {!showAdd && (
          <Button size="xs" variant="outline" onClick={() => setAdding(true)}>
            <Plus />
            Record test
          </Button>
        )}
      </div>

      {showAdd && (
        <TestForm
          key={`add-${draftKey}`}
          control={control}
          processId={processId}
          members={members}
          initialProcedure={draftProcedure}
          initialType={draftType}
          onDone={closeAdd}
        />
      )}

      {control.tests.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground">No tests recorded for this control.</p>
      )}

      <ul className="space-y-1.5">
        {control.tests.map((t) =>
          editingId === t.id ? (
            <li key={t.id}>
              <TestForm
                control={control}
                processId={processId}
                test={t}
                members={members}
                onDone={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li key={t.id} className="rounded-lg border border-border/60 bg-card">
              <div className="flex items-center gap-2 px-3 py-2 text-xs">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                >
                  {expandedId === t.id ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium">{t.period}</span>
                  <span className="text-muted-foreground">
                    {TEST_TYPE_LABEL[t.test_type as 'design' | 'operating'] ?? t.test_type}
                  </span>
                  <ResultBadge result={t.result} />
                  {t.sample_size !== null && (
                    <span className="text-muted-foreground tabular-nums">
                      {t.exceptions}/{t.sample_size} exc.
                    </span>
                  )}
                  <span className="ml-auto hidden text-muted-foreground sm:inline">
                    {t.tester?.name ?? ''} {t.tested_at ? `· ${formatDate(t.tested_at)}` : ''}
                  </span>
                </button>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Edit test" onClick={() => setEditingId(t.id)}>
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant={confirmId === t.id ? 'destructive' : 'ghost'}
                  size={confirmId === t.id ? 'xs' : 'icon-xs'}
                  aria-label="Delete test"
                  disabled={pending}
                  onClick={() => handleDelete(t.id)}
                >
                  <Trash2 />
                  {confirmId === t.id && 'Confirm'}
                </Button>
              </div>
              {expandedId === t.id && (
                <div className="space-y-2 border-t border-border/60 px-3 py-2 text-xs">
                  {t.workpaper_ref && (
                    <p className="text-muted-foreground">Workpaper: {t.workpaper_ref}</p>
                  )}
                  {t.population_size !== null && (
                    <p className="text-muted-foreground">Population: {t.population_size}</p>
                  )}
                  {t.procedure ? (
                    <PolicyMarkdown markdown={t.procedure} className="p-3 text-xs" />
                  ) : (
                    <p className="text-muted-foreground">No procedure documented.</p>
                  )}
                  {t.notes && <p className="whitespace-pre-wrap">{t.notes}</p>}
                </div>
              )}
            </li>
          )
        )}
      </ul>
    </div>
  )
}
