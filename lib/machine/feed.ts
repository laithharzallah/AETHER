/**
 * Feed and index-page parsing for the ingest phase.
 *
 * Written against the shapes regulators actually publish rather than a spec:
 * RSS 2.0, Atom, and — for most GCC regulators, which publish no feed at all —
 * an HTML listing whose links are extracted and diffed against what has already
 * been seen.
 *
 * No XML or HTML dependency. That is a deliberate trade: a real parser would be
 * more robust, but this runs in a Node route handler with a hard time budget, and
 * the failure mode here is a missed item on one source rather than a crash. Every
 * extractor is total — it returns what it could find and never throws.
 */

export type FeedItem = {
  title: string
  url: string | null
  summary: string | null
  content: string | null
  publishedAt: string | null
  externalId: string | null
}

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Ampersand last, so an already-encoded entity is not double-decoded.
    .replace(/&amp;/g, '&')
}

export function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    // Replacing an inline tag with a space leaves "2026 ." wherever markup
    // wrapped the word before punctuation. Left in, it corrupts sentence
    // splitting and the deadline patterns downstream.
    .replace(/\s+([.,;:!?)\]])/g, '$1')
    .replace(/([(\[])\s+/g, '$1')
    .trim()
}

function firstTag(xml: string, ...names: string[]): string | null {
  for (const name of names) {
    const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml)
    if (match) {
      const value = decodeEntities(match[1]).trim()
      if (value) return value
    }
  }
  return null
}

function attribute(xml: string, tag: string, attr: string): string | null {
  const match = new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*["']([^"']+)["']`, 'i').exec(xml)
  return match ? decodeEntities(match[1]).trim() : null
}

function toIsoDate(value: string | null): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function blocks(xml: string, tag: string): string[] {
  const matches = xml.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'))
  return matches ?? []
}

export function parseRss(xml: string): FeedItem[] {
  return blocks(xml, 'item').map((block) => {
    const description = firstTag(block, 'description')
    const encoded = firstTag(block, 'content:encoded')
    const body = encoded ?? description

    return {
      title: stripTags(firstTag(block, 'title') ?? '') || '(untitled)',
      url: firstTag(block, 'link'),
      summary: description ? stripTags(description).slice(0, 1000) : null,
      content: body ? stripTags(body) : null,
      publishedAt: toIsoDate(firstTag(block, 'pubDate', 'dc:date')),
      externalId: firstTag(block, 'guid'),
    }
  })
}

export function parseAtom(xml: string): FeedItem[] {
  return blocks(xml, 'entry').map((block) => {
    const summary = firstTag(block, 'summary')
    const content = firstTag(block, 'content')
    // Atom carries the URL in link/@href, not as element text.
    const url = attribute(block, 'link', 'href') ?? firstTag(block, 'link')

    return {
      title: stripTags(firstTag(block, 'title') ?? '') || '(untitled)',
      url,
      summary: summary ? stripTags(summary).slice(0, 1000) : null,
      content: content ? stripTags(content) : summary ? stripTags(summary) : null,
      publishedAt: toIsoDate(firstTag(block, 'updated', 'published')),
      externalId: firstTag(block, 'id'),
    }
  })
}

export function parseFeed(xml: string): FeedItem[] {
  if (/<\s*feed\b/i.test(xml)) return parseAtom(xml)
  if (/<\s*rss\b|<\s*rdf:RDF\b/i.test(xml)) return parseRss(xml)
  // Some endpoints omit the wrapper but still emit items.
  const rss = parseRss(xml)
  return rss.length > 0 ? rss : parseAtom(xml)
}

/**
 * JSON feeds, and JSON APIs shaped closely enough to guess at. Used for the NVD
 * style sources.
 */
export function parseJsonFeed(raw: string): FeedItem[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  const candidates: unknown[] = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed)
      ? ((parsed.items ?? parsed.vulnerabilities ?? parsed.results ?? parsed.data) as unknown[]) ??
        []
      : []

  if (!Array.isArray(candidates)) return []

  return candidates.flatMap((entry): FeedItem[] => {
    if (!isRecord(entry)) return []

    const title = pickString(entry, ['title', 'id', 'name', 'summary'])
    if (!title) return []

    return [
      {
        title: title.slice(0, 500),
        url: pickString(entry, ['url', 'link', 'html_url', 'external_url']),
        summary: pickString(entry, ['summary', 'description', 'content_text'])?.slice(0, 1000) ?? null,
        content: pickString(entry, ['content_text', 'content_html', 'description', 'summary']),
        publishedAt: toIsoDate(
          pickString(entry, ['date_published', 'published', 'publishedDate', 'lastModified'])
        ),
        externalId: pickString(entry, ['id', 'guid', 'cveID']),
      },
    ]
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/**
 * Extracts candidate document links from an HTML index page.
 *
 * Most GCC regulators publish circulars and framework revisions to a listing page
 * with no feed, so links are filtered down to plausible regulatory documents and
 * the listing is diffed against what has been seen before. Anchor text becomes
 * the title, which is why titles from these sources are noisier than from feeds.
 */
export function parseHtmlIndex(html: string, baseUrl: string): FeedItem[] {
  const anchors = html.match(/<a\b[^>]*href\s*=\s*["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi) ?? []
  const seen = new Set<string>()
  const items: FeedItem[] = []

  for (const anchor of anchors) {
    const href = attribute(anchor, 'a', 'href')
    if (!href) continue

    const text = stripTags(anchor)
    if (!isPlausibleDocumentLink(href, text)) continue

    const absolute = resolveUrl(href, baseUrl)
    if (!absolute || seen.has(absolute)) continue
    seen.add(absolute)

    items.push({
      title: text.slice(0, 500),
      url: absolute,
      summary: null,
      content: null,
      publishedAt: null,
      externalId: absolute,
    })
  }

  return items
}

const DOCUMENT_HINTS = [
  'circular',
  'regulation',
  'framework',
  'control',
  'guideline',
  'guidance',
  'standard',
  'directive',
  'instruction',
  'law',
  'decree',
  'policy',
  'rulebook',
  'advisory',
  'announcement',
  'news',
  'press',
  'publication',
  'consultation',
  'amendment',
  'notice',
  'bulletin',
  'requirement',
]

const NAVIGATION_NOISE = [
  'home',
  'about',
  'contact',
  'login',
  'sign in',
  'search',
  'menu',
  'privacy policy',
  'terms',
  'sitemap',
  'careers',
  'français',
  'english',
  'العربية',
  'share',
  'print',
  'back',
  'next',
  'previous',
]

function isPlausibleDocumentLink(href: string, text: string): boolean {
  if (!text || text.length < 12) return false
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false
  }
  if (href.startsWith('javascript:')) return false

  const lowerText = text.toLowerCase()
  if (NAVIGATION_NOISE.some((noise) => lowerText === noise)) return false

  const haystack = `${href} ${lowerText}`.toLowerCase()

  // A PDF on a regulator's site is almost always the instrument itself.
  if (/\.pdf($|\?)/i.test(href)) return true

  return DOCUMENT_HINTS.some((hint) => haystack.includes(hint))
}

export function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

/**
 * Stable identity for an ingested item.
 *
 * Keyed on the external id or URL when there is one, since a regulator that
 * edits a page should not produce a second item. Falls back to title plus a
 * content prefix so feeds without a guid still de-duplicate. Deliberately
 * excludes the full body: regulators routinely alter boilerplate around an
 * unchanged document.
 */
export function itemFingerprint(item: FeedItem): string {
  const basis = item.externalId ?? item.url
  if (basis) return normalizeForHash(basis)
  return normalizeForHash(`${item.title}|${(item.content ?? '').slice(0, 400)}`)
}

function normalizeForHash(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}
