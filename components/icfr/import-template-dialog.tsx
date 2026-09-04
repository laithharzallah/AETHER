'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2 } from 'lucide-react'
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
import { importTemplate } from '@/lib/actions/icfr'
import { cn } from '@/lib/utils'

export type TemplateOption = {
  code: string
  name: string
  cycle: string
  description: string | null
  risk_count: number
  control_count: number
}

export function ImportTemplateDialog({
  templates,
  existingCodes,
}: {
  templates: TemplateOption[]
  existingCodes: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleImport() {
    if (!selected) return
    startTransition(async () => {
      const result = await importTemplate(selected)
      if (result.ok && result.data) {
        toast.success('Template imported.')
        setOpen(false)
        router.push(`/dashboard/icfr/${result.data.processId}`)
      } else if (!result.ok) {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Download className="h-4 w-4" />
        Import template
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import an RCM template</DialogTitle>
          <DialogDescription>
            Start from a Big-Four-style risk and control matrix for a standard
            business cycle, then tailor it to your organization.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No templates available. Run the ICFR template seed migration.
            </p>
          )}
          {templates.map((t) => {
            const exists = existingCodes.includes(t.code)
            const active = selected === t.code
            return (
              <button
                key={t.code}
                type="button"
                disabled={exists}
                onClick={() => setSelected(t.code)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                  active
                    ? 'border-foreground/40 bg-foreground/[0.04]'
                    : 'border-border/60 hover:bg-foreground/[0.03]',
                  exists && 'cursor-not-allowed opacity-50'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    <code className="mr-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      {t.code}
                    </code>
                    {t.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {t.risk_count} risks · {t.control_count} controls
                  </span>
                </div>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {t.description}
                  </p>
                )}
                {exists && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Already imported.
                  </p>
                )}
              </button>
            )
          })}
        </div>
        <DialogFooter showCloseButton>
          <Button type="button" onClick={handleImport} disabled={!selected || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
