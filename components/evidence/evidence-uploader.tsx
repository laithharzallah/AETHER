'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { FileUp, Link2, Loader2, StickyNote, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import {
  createEvidenceRecord,
  type CreatedEvidence,
} from '@/lib/actions/evidence'
import {
  EVIDENCE_ACCEPT,
  EVIDENCE_BUCKET,
  isAllowedEvidenceFile,
  safeFileName,
  type EvidenceSource,
} from '@/lib/evidence/constants'
import { cn } from '@/lib/utils'

type EvidenceUploaderProps = {
  organizationId: string
  /** When set, the created evidence is linked to this control implementation. */
  implementationId?: string
  compact?: boolean
  onCreated?: (evidence: CreatedEvidence) => void
  className?: string
}

const MODES: { value: EvidenceSource; label: string; icon: typeof FileUp }[] = [
  { value: 'upload', label: 'File', icon: FileUp },
  { value: 'link', label: 'Link', icon: Link2 },
  { value: 'note', label: 'Note', icon: StickyNote },
]

export function EvidenceUploader({
  organizationId,
  implementationId,
  compact = false,
  onCreated,
  className,
}: EvidenceUploaderProps) {
  const uid = useId()
  const [mode, setMode] = useState<EvidenceSource>('upload')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const busy = uploading || pending

  function reset() {
    setName('')
    setDescription('')
    setExternalUrl('')
    setValidUntil('')
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function pickFile(next: File | null) {
    if (!next) {
      setFile(null)
      return
    }
    const check = isAllowedEvidenceFile(next)
    if (!check.ok) {
      toast.error(check.error)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setFile(next)
    if (!name.trim()) setName(next.name.replace(/\.[^.]+$/, ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('Give the evidence a name.')
      return
    }
    if (mode === 'upload' && !file) {
      toast.error('Choose a file to upload.')
      return
    }
    if (mode === 'link' && !externalUrl.trim()) {
      toast.error('Enter the URL of the evidence.')
      return
    }

    let storagePath: string | null = null
    if (mode === 'upload' && file) {
      setUploading(true)
      try {
        const supabase = createClient()
        const path = `${organizationId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
        const { error } = await supabase.storage
          .from(EVIDENCE_BUCKET)
          .upload(path, file, {
            contentType: file.type || undefined,
            upsert: false,
          })
        if (error) {
          console.error('[evidence upload]', error)
          toast.error(error.message || 'Upload failed. Please try again.')
          return
        }
        storagePath = path
      } catch (err) {
        console.error('[evidence upload]', err)
        toast.error('Upload failed. Please try again.')
        return
      } finally {
        setUploading(false)
      }
    }

    startTransition(async () => {
      const result = await createEvidenceRecord({
        name: trimmedName,
        description: description || null,
        storagePath,
        fileName: file?.name ?? null,
        mimeType: file?.type ?? null,
        sizeBytes: file?.size ?? null,
        source: mode,
        externalUrl: mode === 'link' ? externalUrl : null,
        validUntil: validUntil || null,
        implementationId: implementationId ?? null,
      })
      if (result.ok) {
        toast.success(
          implementationId ? 'Evidence added and linked.' : 'Evidence added.'
        )
        onCreated?.(result.data)
        reset()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'rounded-lg border border-border/60 bg-card',
        compact ? 'p-3' : 'p-4',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}>
          Add evidence
        </p>
        <div className="inline-flex rounded-lg border border-border/60 p-0.5">
          {MODES.map((m) => (
            <Button
              key={m.value}
              type="button"
              size="xs"
              variant={mode === m.value ? 'secondary' : 'ghost'}
              onClick={() => setMode(m.value)}
              disabled={busy}
            >
              <m.icon />
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      {mode === 'upload' && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            pickFile(e.dataTransfer.files?.[0] ?? null)
          }}
          className={cn(
            'mt-3 flex flex-col items-center justify-center rounded-lg border border-dashed text-center transition-colors',
            compact ? 'px-3 py-4' : 'px-4 py-8',
            dragging
              ? 'border-ring bg-muted/50'
              : 'border-border/70 bg-muted/20 hover:bg-muted/40'
          )}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm">
            {file ? (
              <span className="font-medium">{file.name}</span>
            ) : (
              <>
                Drag a file here, or{' '}
                <button
                  type="button"
                  className="font-medium underline underline-offset-4"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  browse
                </button>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, DOCX, XLSX, PNG, JPG, CSV, TXT or ZIP · up to 25 MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={EVIDENCE_ACCEPT}
            className="sr-only"
            aria-label="Choose evidence file"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          {file && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="mt-2"
              onClick={() => pickFile(null)}
              disabled={busy}
            >
              Choose a different file
            </Button>
          )}
        </div>
      )}

      <div
        className={cn(
          'mt-3 grid gap-3',
          compact ? 'sm:grid-cols-2' : 'sm:grid-cols-[1fr_180px]'
        )}
      >
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-name`}>Name</Label>
          <Input
            id={`${uid}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              mode === 'note' ? 'e.g. Access review walkthrough' : 'e.g. Q3 access review report'
            }
            disabled={busy}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-valid`}>Valid until</Label>
          <Input
            id={`${uid}-valid`}
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      {mode === 'link' && (
        <div className="mt-3 space-y-1.5">
          <Label htmlFor={`${uid}-url`}>URL</Label>
          <Input
            id={`${uid}-url`}
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://…"
            disabled={busy}
            required
          />
        </div>
      )}

      {(mode === 'note' || !compact) && (
        <div className="mt-3 space-y-1.5">
          <Label htmlFor={`${uid}-desc`}>
            {mode === 'note' ? 'Note' : 'Description'}
            {mode !== 'note' && (
              <span className="font-normal text-muted-foreground">(optional)</span>
            )}
          </Label>
          <textarea
            id={`${uid}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={mode === 'note' ? 4 : 2}
            placeholder={
              mode === 'note'
                ? 'Describe what was observed, by whom and when.'
                : 'What does this evidence demonstrate?'
            }
            disabled={busy}
            required={mode === 'note'}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button type="submit" size={compact ? 'sm' : 'default'} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="animate-spin" />
              {uploading ? 'Uploading…' : 'Saving…'}
            </>
          ) : (
            <>
              <Upload />
              {mode === 'upload' ? 'Upload' : 'Save'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
