import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  itemFingerprint,
  parseAtom,
  parseFeed,
  parseHtmlIndex,
  parseJsonFeed,
  parseRss,
  resolveUrl,
  stripTags,
} from '../lib/machine/feed'

describe('stripTags', () => {
  test('removes markup and decodes entities', () => {
    assert.equal(
      stripTags('<p>Banks &amp; insurers must comply <b>by</b> 2026</p>'),
      'Banks & insurers must comply by 2026'
    )
  })

  test('drops script and style content entirely', () => {
    assert.equal(
      stripTags('<style>.a{color:red}</style>Body<script>alert(1)</script>'),
      'Body'
    )
  })

  test('does not double-decode an already-encoded entity', () => {
    assert.equal(stripTags('AT&amp;amp;T'), 'AT&amp;T')
  })

  test('collapses whitespace', () => {
    assert.equal(stripTags('a\n\n   b\t\tc'), 'a b c')
  })
})

describe('parseRss', () => {
  const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Regulator News</title>
    <item>
      <title>Circular 2026/4 on multi-factor authentication</title>
      <link>https://example.gov/circulars/2026-4</link>
      <description><![CDATA[<p>Member organisations must enforce MFA by <b>1 October 2026</b>.</p>]]></description>
      <pubDate>Mon, 15 Jun 2026 09:00:00 GMT</pubDate>
      <guid>circ-2026-4</guid>
    </item>
    <item>
      <title>Consultation on cloud controls</title>
      <link>https://example.gov/consultations/cloud</link>
      <description>Feedback invited until 30 September 2026.</description>
      <pubDate>Tue, 16 Jun 2026 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

  test('extracts every item', () => {
    const items = parseRss(xml)
    assert.equal(items.length, 2)
  })

  test('extracts title, link, guid and date', () => {
    const [first] = parseRss(xml)
    assert.equal(first.title, 'Circular 2026/4 on multi-factor authentication')
    assert.equal(first.url, 'https://example.gov/circulars/2026-4')
    assert.equal(first.externalId, 'circ-2026-4')
    assert.equal(first.publishedAt, '2026-06-15T09:00:00.000Z')
  })

  test('unwraps CDATA and strips markup from the body', () => {
    const [first] = parseRss(xml)
    assert.equal(
      first.content,
      'Member organisations must enforce MFA by 1 October 2026.'
    )
  })

  test('tolerates a missing guid', () => {
    const [, second] = parseRss(xml)
    assert.equal(second.externalId, null)
    assert.ok(second.title.length > 0)
  })
})

describe('parseAtom', () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Agency Advisories</title>
  <entry>
    <title>Advisory: actively exploited vulnerability in edge devices</title>
    <link rel="alternate" href="https://example.gov/advisories/ad-1"/>
    <id>urn:uuid:1234</id>
    <updated>2026-06-20T12:00:00Z</updated>
    <summary>Patch immediately.</summary>
    <content type="html">&lt;p&gt;CVE-2026-1234 is being exploited in the wild.&lt;/p&gt;</content>
  </entry>
</feed>`

  test('reads the URL from link/@href rather than element text', () => {
    const [entry] = parseAtom(xml)
    assert.equal(entry.url, 'https://example.gov/advisories/ad-1')
  })

  test('prefers content over summary for the body', () => {
    const [entry] = parseAtom(xml)
    assert.equal(entry.content, 'CVE-2026-1234 is being exploited in the wild.')
    assert.equal(entry.summary, 'Patch immediately.')
  })

  test('reads the updated timestamp', () => {
    const [entry] = parseAtom(xml)
    assert.equal(entry.publishedAt, '2026-06-20T12:00:00.000Z')
  })
})

describe('parseFeed dispatch', () => {
  test('detects Atom', () => {
    const items = parseFeed('<feed><entry><title>A</title></entry></feed>')
    assert.equal(items.length, 1)
  })

  test('detects RSS', () => {
    const items = parseFeed('<rss><channel><item><title>B</title></item></channel></rss>')
    assert.equal(items.length, 1)
  })

  test('returns nothing for input that is not a feed, rather than throwing', () => {
    assert.deepEqual(parseFeed('<html><body>hello</body></html>'), [])
    assert.deepEqual(parseFeed(''), [])
  })

  test('survives truncated XML', () => {
    // A response cut off mid-stream must not take the ingest phase down.
    assert.doesNotThrow(() =>
      parseFeed('<rss><channel><item><title>Truncated')
    )
  })
})

describe('parseJsonFeed', () => {
  test('reads a JSON Feed items array', () => {
    const items = parseJsonFeed(
      JSON.stringify({
        items: [
          {
            id: 'a1',
            title: 'New guidance published',
            url: 'https://example.gov/a1',
            summary: 'Applies to licensed institutions.',
            date_published: '2026-06-01T00:00:00Z',
          },
        ],
      })
    )
    assert.equal(items.length, 1)
    assert.equal(items[0].title, 'New guidance published')
    assert.equal(items[0].externalId, 'a1')
    assert.equal(items[0].publishedAt, '2026-06-01T00:00:00.000Z')
  })

  test('reads a bare array', () => {
    const items = parseJsonFeed(JSON.stringify([{ title: 'One' }, { title: 'Two' }]))
    assert.equal(items.length, 2)
  })

  test('skips entries with no usable title', () => {
    const items = parseJsonFeed(JSON.stringify({ items: [{ url: 'x' }, { title: 'Ok' }] }))
    assert.equal(items.length, 1)
  })

  test('returns nothing for malformed JSON rather than throwing', () => {
    assert.deepEqual(parseJsonFeed('{not json'), [])
  })
})

describe('parseHtmlIndex', () => {
  const html = `
    <nav>
      <a href="/">Home</a>
      <a href="/about-us">About</a>
      <a href="#top">Back to top</a>
    </nav>
    <main>
      <ul>
        <li><a href="/media/circular-2026-4.pdf">Circular 4 of 2026 regarding cyber security</a></li>
        <li><a href="/regulations/updated-controls">Updated Essential Cybersecurity Controls</a></li>
        <li><a href="https://other.gov/guidance/cloud">Guidance on cloud adoption for banks</a></li>
        <li><a href="/regulations/updated-controls">Updated Essential Cybersecurity Controls</a></li>
      </ul>
      <a href="mailto:info@example.gov">info@example.gov</a>
      <a href="javascript:void(0)">Print this page</a>
    </main>`

  const items = parseHtmlIndex(html, 'https://example.gov/news')

  test('finds the regulatory documents', () => {
    const urls = items.map((i) => i.url)
    assert.ok(urls.includes('https://example.gov/media/circular-2026-4.pdf'))
    assert.ok(urls.includes('https://example.gov/regulations/updated-controls'))
    assert.ok(urls.includes('https://other.gov/guidance/cloud'))
  })

  test('resolves relative URLs against the page', () => {
    const circular = items.find((i) => i.url?.endsWith('.pdf'))
    assert.equal(circular?.url, 'https://example.gov/media/circular-2026-4.pdf')
  })

  test('excludes navigation, anchors, mailto and javascript links', () => {
    const urls = items.map((i) => i.url ?? '')
    assert.ok(!urls.some((u) => u.endsWith('/about-us')))
    assert.ok(!urls.some((u) => u.includes('#top')))
    assert.ok(!urls.some((u) => u.startsWith('mailto:')))
    assert.ok(!urls.some((u) => u.startsWith('javascript:')))
  })

  test('de-duplicates repeated links on the same page', () => {
    const controlLinks = items.filter((i) =>
      i.url?.endsWith('/regulations/updated-controls')
    )
    assert.equal(controlLinks.length, 1)
  })

  test('uses anchor text as the title', () => {
    const item = items.find((i) => i.url?.endsWith('.pdf'))
    assert.equal(item?.title, 'Circular 4 of 2026 regarding cyber security')
  })

  test('returns nothing for a page with no document links', () => {
    assert.deepEqual(parseHtmlIndex('<p>Nothing here</p>', 'https://example.gov'), [])
  })
})

describe('resolveUrl', () => {
  test('resolves relative and absolute forms', () => {
    assert.equal(resolveUrl('/a', 'https://x.gov/b/c'), 'https://x.gov/a')
    assert.equal(resolveUrl('d', 'https://x.gov/b/c'), 'https://x.gov/b/d')
    assert.equal(resolveUrl('https://y.gov/e', 'https://x.gov'), 'https://y.gov/e')
  })

  test('returns null for something unresolvable', () => {
    assert.equal(resolveUrl('http://[', 'not a url'), null)
  })
})

describe('itemFingerprint', () => {
  const base = {
    title: 'Circular 4',
    url: 'https://example.gov/c4',
    summary: null,
    content: 'Body text',
    publishedAt: null,
    externalId: 'c4',
  }

  test('is stable across repeated reads of the same item', () => {
    assert.equal(itemFingerprint(base), itemFingerprint({ ...base }))
  })

  test('ignores body edits when there is a stable identifier', () => {
    // Regulators routinely reword boilerplate around an unchanged document; that
    // must not produce a second copy.
    assert.equal(
      itemFingerprint(base),
      itemFingerprint({ ...base, content: 'Body text, revised footer' })
    )
  })

  test('prefers the external id over the URL', () => {
    assert.equal(
      itemFingerprint(base),
      itemFingerprint({ ...base, url: 'https://example.gov/c4?utm_source=news' })
    )
  })

  test('falls back to title and content when there is no identifier', () => {
    const anonymous = { ...base, url: null, externalId: null }
    assert.equal(itemFingerprint(anonymous), itemFingerprint({ ...anonymous }))
    assert.notEqual(
      itemFingerprint(anonymous),
      itemFingerprint({ ...anonymous, title: 'Circular 5' })
    )
  })

  test('normalises case and whitespace', () => {
    assert.equal(
      itemFingerprint({ ...base, externalId: '  C4  ' }),
      itemFingerprint({ ...base, externalId: 'c4' })
    )
  })
})
