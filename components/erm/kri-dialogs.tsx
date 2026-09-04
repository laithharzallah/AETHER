'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
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
  KRI_DIRECTIONS,
  KRI_DIRECTION_LABEL,
  KRI_FREQUENCIES,
  KRI_FREQUENCY_LABEL,
  KRI_STATUS_LABEL,
  kriRag,
} from '@/lib/erm/constants'
import { createKri, recordKriReading, updateKri, type KriInput } from '@/lib/actions/erm'

function emptyKri(riskId: string): KriInput {
  return {
    riskId,
    name: '',
    description: '',
    unit: '',
    direction: 'higher_is_worse',
    greenThreshold: null,
    amberThreshold: 0,
    redThreshold: 0,
    frequency: 'monthly',
    ownerId: '',
    dataSource: '',
  }
}

export function KriFormDialog({
  riskId,
  members,
  initial,
  kriId,
  trigger,
}: {
  riskId: string
  members: { id: string; name: string }[]
  initial?: KriInput
  kriId?: string
  trigger: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<KriInput>(initial ?? emptyKri(riskId))

  function set<K extends keyof KriInput>(key: K, value: KriInput[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  const ordering =
    values.direction === 'higher_is_worse'
      ? 'Amber must be at or below red — the indicator worsens as it rises.'
      : 'Amber must be at or above red — the indicator worsens as it falls.'

  function submit() {
    startTransition(async () => {
      const result = kriId ? await updateKri(kriId, values) : await createKri(values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(kriId ? 'KRI updated.' : 'KRI added.')
      setOpen(false)
      if (!kriId) setValues(emptyKri(riskId))
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{kriId ? 'Edit key risk indicator' : 'Add a key risk indicator'}</DialogTitle>
          <DialogDescription>
            A KRI is a forward-looking measure of exposure, not a performance measure. Set
            the amber threshold where you want early warning and the red threshold where the
            risk has moved outside tolerance.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Indicator name" htmlFor="erm-kri-name">
            <TextInput
              id="erm-kri-name"
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Unpatched critical vulnerabilities older than 30 days"
            />
          </Field>

          <Field label="What it measures and why" htmlFor="erm-kri-description">
            <Textarea
              id="erm-kri-description"
              value={values.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Unit">
              <TextInput
                value={values.unit ?? ''}
                onChange={(e) => set('unit', e.target.value)}
                placeholder="count, %, days, SAR m"
              />
            </Field>
            <Field label="Direction">
              <NativeSelect
                value={values.direction}
                onChange={(e) => set('direction', e.target.value)}
              >
                {optionsFrom(KRI_DIRECTIONS, KRI_DIRECTION_LABEL)}
              </NativeSelect>
            </Field>
            <Field label="Frequency">
              <NativeSelect
                value={values.frequency}
                onChange={(e) => set('frequency', e.target.value)}
              >
                {optionsFrom(KRI_FREQUENCIES, KRI_FREQUENCY_LABEL)}
              </NativeSelect>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Green target (optional)">
              <TextInput
                type="number"
                step="any"
                value={values.greenThreshold ?? ''}
                onChange={(e) =>
                  set('greenThreshold', e.target.value === '' ? null : Number(e.target.value))
                }
              />
            </Field>
            <Field label="Amber threshold">
              <TextInput
                type="number"
                step="any"
                value={values.amberThreshold}
                onChange={(e) => set('amberThreshold', Number(e.target.value))}
              />
            </Field>
            <Field label="Red threshold" hint={ordering}>
              <TextInput
                type="number"
                step="any"
                value={values.redThreshold}
                onChange={(e) => set('redThreshold', Number(e.target.value))}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Indicator owner">
              <NativeSelect
                value={values.ownerId ?? ''}
                onChange={(e) => set('ownerId', e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Data source" hint="Where the number comes from, and who produces it.">
              <TextInput
                value={values.dataSource ?? ''}
                onChange={(e) => set('dataSource', e.target.value)}
              />
            </Field>
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button type="button" onClick={submit} disabled={pending || !values.name.trim()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {kriId ? 'Save changes' : 'Add KRI'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RecordReadingDialog({
  kriId,
  kriName,
  unit,
  direction,
  amber,
  red,
  trigger,
}: {
  kriId: string
  kriName: string
  unit: string | null
  direction: string | null
  amber: number | null
  red: number | null
  trigger: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [periodDate, setPeriodDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')

  const numeric = value === '' ? null : Number(value)
  const projected = kriRag(direction, numeric, amber, red)

  function submit() {
    if (numeric === null || !Number.isFinite(numeric)) return
    startTransition(async () => {
      const result = await recordKriReading({ kriId, periodDate, value: numeric, note })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Reading recorded.')
      setValue('')
      setNote('')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a reading</DialogTitle>
          <DialogDescription>{kriName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Period" htmlFor="erm-reading-period">
            <TextInput
              id="erm-reading-period"
              type="date"
              value={periodDate}
              onChange={(e) => setPeriodDate(e.target.value)}
            />
          </Field>
          <Field
            label={unit ? `Value (${unit})` : 'Value'}
            htmlFor="erm-reading-value"
            hint={
              numeric === null
                ? `Amber at ${amber ?? '—'}, red at ${red ?? '—'}.`
                : `This reading grades as ${KRI_STATUS_LABEL[projected]}.`
            }
          >
            <TextInput
              id="erm-reading-value"
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <Field label="Note" htmlFor="erm-reading-note">
            <Textarea
              id="erm-reading-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </Field>
        </div>

        <DialogFooter showCloseButton>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || numeric === null || !Number.isFinite(numeric)}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
