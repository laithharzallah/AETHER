import type { ControlIndexEntry } from '@/lib/regulatory-library/queries'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find library controls that a generated document cites.
 *
 * Matching is intentionally conservative: a control ref must appear as a
 * whole token (bounded by non-alphanumerics), and short refs (e.g. "1-1")
 * additionally require the framework's short name to appear somewhere in
 * the document so that stray numbers in unrelated frameworks don't match.
 */
export function extractCitedControlIds(
  markdown: string,
  index: ControlIndexEntry[]
): string[] {
  if (!markdown || index.length === 0) return []

  const lower = markdown.toLowerCase()
  const cited = new Set<string>()

  const frameworkMentioned = new Map<string, boolean>()
  for (const entry of index) {
    if (!frameworkMentioned.has(entry.frameworkCode)) {
      const nameHit =
        entry.frameworkName.length > 0 &&
        lower.includes(entry.frameworkName.toLowerCase())
      const codeHit = lower.includes(entry.frameworkCode.toLowerCase())
      frameworkMentioned.set(entry.frameworkCode, nameHit || codeHit)
    }
  }

  for (const entry of index) {
    const ref = entry.ref.trim()
    if (ref.length === 0) continue

    const isShort = ref.length <= 4
    if (isShort && !frameworkMentioned.get(entry.frameworkCode)) continue

    const pattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(ref)}(?![A-Za-z0-9.-])`)
    if (pattern.test(markdown)) {
      cited.add(entry.id)
    }
  }

  return [...cited]
}

/**
 * Build the compact control index block injected into the generation prompt.
 * Keeps the prompt bounded even for large frameworks.
 */
export function buildControlIndexBlock(
  index: ControlIndexEntry[],
  maxPerFramework = 120
): string {
  if (index.length === 0) return ''

  const byFramework = new Map<string, ControlIndexEntry[]>()
  for (const entry of index) {
    if (!byFramework.has(entry.frameworkCode)) byFramework.set(entry.frameworkCode, [])
    byFramework.get(entry.frameworkCode)!.push(entry)
  }

  const sections: string[] = []
  for (const [code, entries] of byFramework) {
    const name = entries[0]?.frameworkName ?? code
    const lines = entries
      .slice(0, maxPerFramework)
      .map((e) => `- ${e.ref}: ${e.title}`)
    const overflow =
      entries.length > maxPerFramework
        ? `- … and ${entries.length - maxPerFramework} further controls in this framework`
        : ''
    sections.push(
      [`### ${name} (${code})`, ...lines, overflow].filter(Boolean).join('\n')
    )
  }

  return sections.join('\n\n')
}
