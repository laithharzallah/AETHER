'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
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
import { Field, Textarea } from '@/components/icfr/fields'
import {
  importGeneratedRcm,
  type GeneratedControl,
  type GeneratedRisk,
} from '@/lib/actions/icfr'

type Generated = { risks: GeneratedRisk[]; controls: GeneratedControl[] }

export function GenerateRcmDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [cycle, setCycle] = useState('')
  const [industry, setIndustry] = useState('')
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState<Generated | null>(null)
  const [importing, startImport] = useTransition()

  async function handleGenerate() {
    if (!name.trim()) {
      toast.error('Enter a process name.')
      return
    }
    setGenerating(true)
    setPreview(null)
    try {
      const res = await fetch('/api/icfr/generate-rcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processName: name.trim(),
          cycle: cycle.trim() || undefined,
          description: description.trim() || undefined,
          industry: industry.trim() || undefined,
        }),
      })
      const data = (await res.json()) as Partial<Generated> & { error?: string }
      if (!res.ok || data.error || !data.risks || !data.controls) {
        toast.error(data.error ?? 'Generation failed.')
        return
      }
      setPreview({ risks: data.risks, controls: data.controls })
    } catch {
      toast.error('Network error while generating the RCM.')
    } finally {
      setGenerating(false)
    }
  }

  function handleImport() {
    if (!preview) return
    const processCode = (code.trim() || name.trim().slice(0, 6)).toUpperCase()
    startImport(async () => {
      const result = await importGeneratedRcm(
        {
          code: processCode,
          name: name.trim(),
          cycle: cycle.trim() || null,
          description: description.trim() || null,
        },
        preview.risks,
        preview.controls
      )
      if (result.ok && result.data) {
        toast.success('RCM created.')
        setOpen(false)
        router.push(`/dashboard/icfr/${result.data.processId}`)
      } else if (!result.ok) {
        toast.error(result.error)
      }
    })
  }

  const keyCount = preview?.controls.filter((c) => c.is_key).length ?? 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Sparkles className="h-4 w-4" />
        Generate with AI
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Generate a risk & control matrix</DialogTitle>
          <DialogDescription>
            Describe the process. AETHER drafts risks with assertions and
            controls with type, nature, frequency and COSO mapping — review
            before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
          <Field label="Code" htmlFor="rcm-code">
            <Input
              id="rcm-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="INV"
              maxLength={20}
            />
          </Field>
          <Field label="Process name" htmlFor="rcm-name">
            <Input
              id="rcm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Inventory & Cost of Sales"
            />
          </Field>
          <Field label="Cycle" htmlFor="rcm-cycle">
            <Input
              id="rcm-cycle"
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              placeholder="Plan-to-Produce"
            />
          </Field>
          <Field label="Industry / context" htmlFor="rcm-industry">
            <Input
              id="rcm-industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="CMA-listed manufacturing group, SAP S/4HANA"
            />
          </Field>
        </div>
        <Field label="Process description" htmlFor="rcm-desc">
          <Textarea
            id="rcm-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Key sub-processes, systems, volumes, known pain points…"
          />
        </Field>

        {preview && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">
              {preview.risks.length} risks · {preview.controls.length} controls ({keyCount} key)
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {preview.controls.map((c) => (
                <li key={c.ref}>
                  <code className="mr-1 font-mono">{c.ref}</code>
                  {c.title}
                  <span className="ml-1 opacity-70">→ {c.linked_risk_refs.join(', ')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter showCloseButton>
          <Button
            type="button"
            variant={preview ? 'outline' : 'default'}
            onClick={handleGenerate}
            disabled={generating || importing}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {preview ? 'Regenerate' : 'Generate'}
          </Button>
          {preview && (
            <Button type="button" onClick={handleImport} disabled={importing || generating}>
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Import into ICFR
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
