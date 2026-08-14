/**
 * Display formatting shared by the dashboard modules.
 *
 * Dates render in UTC throughout. A compliance deadline that shows as a different
 * day depending on the reader's timezone is worse than useless, and every date
 * here originates from a regulator's published date rather than from a moment in
 * the reader's day.
 */

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

function toDate(value: string): Date {
  // Bare dates are anchored to UTC midnight so they do not shift a day.
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = toDate(value)
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMAT.format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : `${DATE_TIME_FORMAT.format(date)} UTC`
}

/** "in 12 days" / "3 days ago" / "today". */
export function formatRelativeDays(
  value: string | null | undefined,
  now: Date = new Date()
): string {
  if (!value) return '—'
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return '—'

  const days = Math.round((date.getTime() - now.getTime()) / 86_400_000)

  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'

  if (days > 0) {
    if (days < 30) return `in ${days} days`
    if (days < 365) return `in ${Math.round(days / 30)} months`
    return `in ${(days / 365).toFixed(1)} years`
  }

  const overdue = Math.abs(days)
  if (overdue < 30) return `${overdue} days ago`
  if (overdue < 365) return `${Math.round(overdue / 30)} months ago`
  return `${(overdue / 365).toFixed(1)} years ago`
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

/** snake_case or kebab-case to sentence case. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  const spaced = value.replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`
}

/** Jurisdiction codes used in the catalogue, rendered as names. */
const COUNTRY_NAMES: Record<string, string> = {
  SA: 'Saudi Arabia',
  QA: 'Qatar',
  AE: 'United Arab Emirates',
  'AE-DIFC': 'DIFC',
  'AE-ADGM': 'ADGM',
  JO: 'Jordan',
  KW: 'Kuwait',
  BH: 'Bahrain',
  OM: 'Oman',
  EU: 'European Union',
  US: 'United States',
  GLOBAL: 'International',
}

export function countryName(code: string | null | undefined): string {
  if (!code) return '—'
  return COUNTRY_NAMES[code] ?? code
}
