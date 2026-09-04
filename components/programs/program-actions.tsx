'use client'

import { useState, useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { deleteProgram, updateProgramStatus } from '@/lib/actions/programs'
import { PROGRAM_STATUSES, type ProgramStatus } from '@/lib/programs/constants'

type ProgramActionsProps = {
  programId: string
  status: string
  canDelete: boolean
}

export function ProgramActions({
  programId,
  status,
  canDelete,
}: ProgramActionsProps) {
  const [pending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleStatus(next: ProgramStatus) {
    if (next === status) return
    startTransition(async () => {
      const result = await updateProgramStatus(programId, next)
      if (result.ok) {
        toast.success(
          `Program marked ${PROGRAM_STATUSES.find((s) => s.value === next)?.label.toLowerCase()}.`
        )
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
      try {
        await deleteProgram(programId)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not delete program.'
        )
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={status}
        onChange={(e) => handleStatus(e.target.value as ProgramStatus)}
        disabled={pending}
        aria-label="Program status"
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
      >
        {PROGRAM_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {canDelete && (
        <Button
          type="button"
          variant={confirmDelete ? 'destructive' : 'ghost'}
          size="sm"
          onClick={handleDelete}
          disabled={pending}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {confirmDelete ? 'Confirm delete' : 'Delete'}
        </Button>
      )}
    </div>
  )
}
