'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProgram } from '@/lib/actions/programs'

export type FrameworkOption = {
  id: string
  code: string
  shortName: string
  name: string
  jurisdiction: string
  controlCount: number
}

type NewProgramDialogProps = {
  frameworks: FrameworkOption[]
  /** Framework ids that already have an org-level program. */
  existingFrameworkIds: string[]
  variant?: 'default' | 'outline'
}

export function NewProgramDialog({
  frameworks,
  existingFrameworkIds,
  variant = 'default',
}: NewProgramDialogProps) {
  const router = useRouter()
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [frameworkId, setFrameworkId] = useState('')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [targetDate, setTargetDate] = useState('')
  const [description, setDescription] = useState('')
  const [pending, startTransition] = useTransition()

  const selected = frameworks.find((f) => f.id === frameworkId)
  const effectiveName = nameTouched ? name : (selected?.name ?? '')
  const taken = new Set(existingFrameworkIds)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setFrameworkId('')
      setName('')
      setNameTouched(false)
      setTargetDate('')
      setDescription('')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!frameworkId) {
      toast.error('Select a framework.')
      return
    }
    startTransition(async () => {
      const result = await createProgram(
        frameworkId,
        effectiveName,
        targetDate || null,
        description || null
      )
      if (result.ok) {
        toast.success('Program created.')
        setOpen(false)
        router.push(`/dashboard/programs/${result.data.programId}`)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant={variant} />}>
        <Plus />
        New program
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New compliance program</DialogTitle>
            <DialogDescription>
              Pick a framework from the library. Every control is added to the
              program so you can track implementation and attach evidence.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-framework`}>Framework</Label>
            <select
              id={`${uid}-framework`}
              value={frameworkId}
              onChange={(e) => setFrameworkId(e.target.value)}
              required
              disabled={pending}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
            >
              <option value="">Select a framework…</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id} disabled={taken.has(f.id)}>
                  {f.shortName} · {f.jurisdiction} · {f.controlCount} controls
                  {taken.has(f.id) ? ' (already in a program)' : ''}
                </option>
              ))}
            </select>
            {selected && (
              <p className="text-xs text-muted-foreground">{selected.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-name`}>Program name</Label>
            <Input
              id={`${uid}-name`}
              value={effectiveName}
              onChange={(e) => {
                setNameTouched(true)
                setName(e.target.value)
              }}
              placeholder="e.g. NCA ECC compliance 2026"
              required
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-date`}>
              Target date{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`${uid}-date`}
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-desc`}>
              Description{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id={`${uid}-desc`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Scope, business units, audit context…"
              disabled={pending}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
            />
          </div>

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={pending || !frameworkId}>
              {pending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating…
                </>
              ) : (
                'Create program'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
