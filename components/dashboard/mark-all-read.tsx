'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { markNotificationsRead } from '@/lib/actions/machine'
import { Button } from '@/components/ui/button'

export function MarkAllRead() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function markRead() {
    setWorking(true)
    setError(null)
    const result = await markNotificationsRead()
    setWorking(false)

    if (result.error) {
      setError(result.error)
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={markRead}
        disabled={working || isPending}
      >
        {working || isPending ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Check className="mr-1.5 h-4 w-4" />
        )}
        Mark all read
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
