'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { deletePolicy, updatePolicyStatus } from '@/lib/actions/policies'

type Status = 'draft' | 'in_review' | 'approved' | 'archived'

const STATUSES: { value: Status; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'archived', label: 'Archived' },
]

type PolicyActionsProps = {
  policyId: string
  status: string
  contentMd: string
}

export function PolicyActions({ policyId, status, contentMd }: PolicyActionsProps) {
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleStatus(next: Status) {
    if (next === status) return
    startTransition(async () => {
      const result = await updatePolicyStatus(policyId, next)
      if (result.ok) {
        toast.success(`Status set to ${STATUSES.find((s) => s.value === next)?.label}.`)
      } else {
        toast.error(result.error ?? 'Could not update status.')
      }
    })
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(contentMd)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard.')
    }
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 4000)
      return
    }
    startTransition(async () => {
      try {
        await deletePolicy(policyId)
      } catch {
        toast.error('Could not delete policy.')
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={status}
        onChange={(e) => handleStatus(e.target.value as Status)}
        disabled={pending}
        aria-label="Policy status"
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {copied ? (
          <>
            <Check className="mr-1.5 h-4 w-4" />
            Copied
          </>
        ) : (
          <>
            <Copy className="mr-1.5 h-4 w-4" />
            Copy Markdown
          </>
        )}
      </Button>
      <Button
        type="button"
        variant={confirmDelete ? 'destructive' : 'ghost'}
        size="sm"
        onClick={handleDelete}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-1.5 h-4 w-4" />
        )}
        {confirmDelete ? 'Confirm delete' : 'Delete'}
      </Button>
    </div>
  )
}
