/** Accept only local absolute paths; never interpret user input as an authority. */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard'
  }
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return '/dashboard'
  const base = 'https://aether.invalid'
  try {
    const url = new URL(value, base)
    if (url.origin !== base) return '/dashboard'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/dashboard'
  }
}

/** Links are opened in the browser, never fetched by the server. */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || /[\\\u0000-\u0020\u007f]/.test(trimmed)) return null
  try {
    const url = new URL(trimmed)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}
