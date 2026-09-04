export const EVIDENCE_BUCKET = 'evidence'
export const EVIDENCE_MAX_BYTES = 25 * 1024 * 1024

export const EVIDENCE_ALLOWED_EXTENSIONS = [
  'pdf',
  'docx',
  'xlsx',
  'png',
  'jpg',
  'jpeg',
  'csv',
  'txt',
  'zip',
] as const

export const EVIDENCE_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'text/csv',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
] as const

export const EVIDENCE_ACCEPT = EVIDENCE_ALLOWED_EXTENSIONS.map(
  (ext) => `.${ext}`
).join(',')

export type EvidenceSource = 'upload' | 'link' | 'note'
export type EvidenceReviewStatus = 'pending' | 'accepted' | 'rejected'

export function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

export function isAllowedEvidenceFile(file: {
  name: string
  type: string
  size: number
}): { ok: true } | { ok: false; error: string } {
  if (file.size > EVIDENCE_MAX_BYTES) {
    return { ok: false, error: 'File exceeds the 25 MB limit.' }
  }
  const ext = fileExtension(file.name)
  const extOk = (EVIDENCE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
  const mimeOk =
    !file.type ||
    (EVIDENCE_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)
  if (!extOk || !mimeOk) {
    return {
      ok: false,
      error: 'Allowed types: PDF, DOCX, XLSX, PNG, JPG, CSV, TXT, ZIP.',
    }
  }
  return { ok: true }
}

export function safeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return cleaned.slice(0, 120) || 'file'
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`
}

/** Returns 'expired' | 'expiring' | 'valid' | null (no validity date). */
export function validityState(
  validUntil: string | null | undefined,
  now = new Date()
): 'expired' | 'expiring' | 'valid' | null {
  if (!validUntil) return null
  const until = new Date(`${validUntil}T23:59:59`)
  if (Number.isNaN(until.getTime())) return null
  const diffDays = (until.getTime() - now.getTime()) / 86_400_000
  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'expiring'
  return 'valid'
}
