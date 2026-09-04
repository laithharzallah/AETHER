'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field, NativeSelect, Textarea } from '@/components/icfr/fields'
import { deleteProcess, updateProcess } from '@/lib/actions/icfr'
import type { IcfrProcess, Member } from '@/lib/icfr/queries'
import { PROCESS_STATUSES } from '@/lib/icfr/constants'

export function ProcessActions({
  process,
  members,
}: {
  process: IcfrProcess
  members: Member[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateProcess(process.id, {
        code: String(fd.get('code') ?? ''),
        name: String(fd.get('name') ?? ''),
        cycle: String(fd.get('cycle') ?? ''),
        description: String(fd.get('description') ?? ''),
        ownerId: String(fd.get('owner') ?? '') || null,
        status: String(fd.get('status') ?? 'active'),
      })
      if (result.ok) {
        toast.success('Process updated.')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 4000)
      return
    }
    startTransition(async () => {
      const result = await deleteProcess(process.id)
      if (result.ok) {
        toast.success('Process deleted.')
        router.push('/dashboard/icfr')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit process</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
              <Field label="Code" htmlFor="p-code">
                <Input id="p-code" name="code" defaultValue={process.code} required />
              </Field>
              <Field label="Name" htmlFor="p-name">
                <Input id="p-name" name="name" defaultValue={process.name} required />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cycle" htmlFor="p-cycle">
                <Input id="p-cycle" name="cycle" defaultValue={process.cycle ?? ''} />
              </Field>
              <Field label="Status" htmlFor="p-status">
                <NativeSelect id="p-status" name="status" defaultValue={process.status}>
                  {PROCESS_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Process owner" htmlFor="p-owner">
              <NativeSelect id="p-owner" name="owner" defaultValue={process.owner_id ?? ''}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Description" htmlFor="p-desc">
              <Textarea id="p-desc" name="description" defaultValue={process.description ?? ''} />
            </Field>
            <DialogFooter showCloseButton>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Button
        type="button"
        variant={confirmDelete ? 'destructive' : 'ghost'}
        size="sm"
        onClick={handleDelete}
        disabled={pending}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {confirmDelete ? 'Confirm delete' : 'Delete'}
      </Button>
    </div>
  )
}
