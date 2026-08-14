/**
 * Phase 1 — ingest.
 *
 * Polls the sources that are due, parses whatever they return, and records new
 * documents. Everything here is defensive: regulator sites are slow, change
 * layout without warning, and go down. One bad source must not stop the cycle,
 * so failures are recorded against that source and the phase carries on.
 *
 * Conditional requests (ETag / If-Modified-Since) and exponential backoff mean a
 * healthy source is cheap to re-check and a dead one is not hammered.
 */

import { itemFingerprint, parseFeed, parseHtmlIndex, parseJsonFeed, stripTags, type FeedItem } from '../feed'
import { sha256Hex } from '../hash'
import { outOfBudget, type MachineContext, type PhaseOutcome } from '../types'

const USER_AGENT =
  'AETHER-GRC-Intelligence/1.0 (+regulatory change monitoring; contact your AETHER administrator)'

const FETCH_TIMEOUT_MS = 15_000
const MAX_BODY_BYTES = 4 * 1024 * 1024

type SourceRow = {
  id: string
  name: string
  type: string
  url: string | null
  feed_url: string | null
  country: string | null
  regulator: string | null
  fetch_strategy: string
  authority_tier: number
  frameworks: string[]
  sectors: string[]
  poll_interval_minutes: number
  last_checked_at: string | null
}

type StateRow = {
  source_id: string
  etag: string | null
  last_modified: string | null
  consecutive_failures: number
  next_attempt_after: string | null
}

/** Doubles per failure from 15 minutes, capped at 24 hours. */
function backoffMinutes(consecutiveFailures: number): number {
  return Math.min(24 * 60, 15 * 2 ** Math.min(consecutiveFailures, 7))
}

async function fetchSource(
  url: string,
  state: StateRow | undefined
): Promise<
  | { kind: 'ok'; body: string; etag: string | null; lastModified: string | null }
  | { kind: 'unchanged' }
  | { kind: 'error'; status: number | null; message: string }
> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept:
        'application/rss+xml, application/atom+xml, application/xml, application/json, text/html;q=0.9, */*;q=0.8',
      'Accept-Language': 'en, ar;q=0.8',
    }
    if (state?.etag) headers['If-None-Match'] = state.etag
    if (state?.last_modified) headers['If-Modified-Since'] = state.last_modified

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
    })

    if (response.status === 304) return { kind: 'unchanged' }

    if (!response.ok) {
      return {
        kind: 'error',
        status: response.status,
        message: `HTTP ${response.status} ${response.statusText}`,
      }
    }

    // Guard against a source that streams something enormous.
    const declaredLength = Number(response.headers.get('content-length') ?? '0')
    if (declaredLength > MAX_BODY_BYTES) {
      return {
        kind: 'error',
        status: response.status,
        message: `response too large (${declaredLength} bytes)`,
      }
    }

    const body = (await response.text()).slice(0, MAX_BODY_BYTES)

    return {
      kind: 'ok',
      body,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? `timed out after ${FETCH_TIMEOUT_MS}ms`
          : error.message
        : 'unknown fetch error'
    return { kind: 'error', status: null, message }
  } finally {
    clearTimeout(timeout)
  }
}

function parseByStrategy(
  strategy: string,
  body: string,
  baseUrl: string
): FeedItem[] {
  switch (strategy) {
    case 'rss':
    case 'atom':
      return parseFeed(body)
    case 'json':
      return parseJsonFeed(body)
    case 'html_index':
      return parseHtmlIndex(body, baseUrl)
    default:
      return []
  }
}

export async function runIngestPhase(context: MachineContext): Promise<PhaseOutcome> {
  const { db, now } = context

  const { data: sources, error: sourcesError } = await db
    .from('intelligence_sources')
    .select(
      'id, name, type, url, feed_url, country, regulator, fetch_strategy, authority_tier, frameworks, sectors, poll_interval_minutes, last_checked_at'
    )
    .eq('active', true)
    // `manual` sources are tracked for completeness but have nothing to poll;
    // pretending to fetch them would produce misleading health data.
    .neq('fetch_strategy', 'manual')

  if (sourcesError) {
    return {
      status: 'failed',
      itemsIn: 0,
      itemsOut: 0,
      detail: {},
      error: `could not load sources: ${sourcesError.message}`,
    }
  }

  const { data: states } = await db
    .from('intelligence_source_state')
    .select('source_id, etag, last_modified, consecutive_failures, next_attempt_after')

  const stateBySource = new Map<string, StateRow>(
    (states ?? []).map((s) => [s.source_id, s as StateRow])
  )

  // Poll the source that has waited longest first, so a large source list still
  // gets fair coverage across cycles rather than always draining the same head.
  const due = (sources as SourceRow[])
    .filter((source) => {
      const state = stateBySource.get(source.id)
      if (state?.next_attempt_after && new Date(state.next_attempt_after) > now) {
        return false
      }
      if (!source.last_checked_at) return true
      const elapsedMinutes =
        (now.getTime() - new Date(source.last_checked_at).getTime()) / 60_000
      return elapsedMinutes >= source.poll_interval_minutes
    })
    .sort((a, b) => {
      const aTime = a.last_checked_at ? new Date(a.last_checked_at).getTime() : 0
      const bTime = b.last_checked_at ? new Date(b.last_checked_at).getTime() : 0
      return aTime - bTime
    })
    .slice(0, context.limits.maxSources)

  let inserted = 0
  let duplicates = 0
  let fetched = 0
  const failures: Array<{ source: string; error: string }> = []
  const perSource: Record<string, number> = {}
  let stoppedEarly = false

  for (const source of due) {
    if (outOfBudget(context, 5000)) {
      stoppedEarly = true
      break
    }

    const target = source.feed_url ?? source.url
    if (!target) {
      failures.push({ source: source.name, error: 'no URL configured' })
      continue
    }

    const state = stateBySource.get(source.id)
    const result = await fetchSource(target, state)
    fetched += 1

    const attemptedAt = new Date().toISOString()

    if (result.kind === 'error') {
      const consecutive = (state?.consecutive_failures ?? 0) + 1
      failures.push({ source: source.name, error: result.message })

      if (!context.dryRun) {
        await db.from('intelligence_source_state').upsert(
          {
            source_id: source.id,
            last_attempt_at: attemptedAt,
            last_status: 'error',
            last_error: result.message.slice(0, 500),
            consecutive_failures: consecutive,
            next_attempt_after: new Date(
              Date.now() + backoffMinutes(consecutive) * 60_000
            ).toISOString(),
          },
          { onConflict: 'source_id' }
        )
        await db
          .from('intelligence_sources')
          .update({ last_checked_at: attemptedAt })
          .eq('id', source.id)
      }
      continue
    }

    if (result.kind === 'unchanged') {
      if (!context.dryRun) {
        await db.from('intelligence_source_state').upsert(
          {
            source_id: source.id,
            last_attempt_at: attemptedAt,
            last_success_at: attemptedAt,
            last_status: 'unchanged',
            last_error: null,
            consecutive_failures: 0,
            next_attempt_after: null,
          },
          { onConflict: 'source_id' }
        )
        await db
          .from('intelligence_sources')
          .update({ last_checked_at: attemptedAt })
          .eq('id', source.id)
      }
      perSource[source.name] = 0
      continue
    }

    const items = parseByStrategy(source.fetch_strategy, result.body, target).slice(
      0,
      context.limits.maxItemsPerSource
    )

    let sourceInserted = 0

    for (const item of items) {
      const contentHash = sha256Hex(`${source.id}:${itemFingerprint(item)}`)

      if (context.dryRun) {
        sourceInserted += 1
        continue
      }

      const { error: insertError } = await db.from('intelligence_items').insert({
        source_id: source.id,
        title: item.title.slice(0, 500),
        url: item.url,
        summary: item.summary,
        content: item.content ? stripTags(item.content).slice(0, 50_000) : null,
        published_at: item.publishedAt,
        external_id: item.externalId?.slice(0, 500) ?? null,
        content_hash: contentHash,
        language: source.country === 'SA' || source.country === 'QA' ? 'en' : 'en',
        status: 'new',
        analysis_status: 'pending',
        ingested_by_run: context.runId,
      })

      if (insertError) {
        // 23505 is the dedupe index doing its job: this document is already held.
        if (insertError.code === '23505') {
          duplicates += 1
        } else {
          failures.push({
            source: source.name,
            error: `insert failed: ${insertError.message}`,
          })
        }
        continue
      }

      sourceInserted += 1
    }

    inserted += sourceInserted
    perSource[source.name] = sourceInserted

    if (!context.dryRun) {
      await db.from('intelligence_source_state').upsert(
        {
          source_id: source.id,
          etag: result.etag,
          last_modified: result.lastModified,
          last_attempt_at: attemptedAt,
          last_success_at: attemptedAt,
          last_status: items.length > 0 ? 'ok' : 'no_items',
          last_error: null,
          consecutive_failures: 0,
          next_attempt_after: null,
          items_seen: items.length,
        },
        { onConflict: 'source_id' }
      )
      await db
        .from('intelligence_sources')
        .update({ last_checked_at: attemptedAt })
        .eq('id', source.id)
    }
  }

  const status: PhaseOutcome['status'] =
    failures.length === 0
      ? 'succeeded'
      : failures.length === fetched && fetched > 0
        ? 'failed'
        : 'partial'

  return {
    status,
    itemsIn: due.length,
    itemsOut: inserted,
    detail: {
      sourcesConsidered: sources?.length ?? 0,
      sourcesDue: due.length,
      sourcesFetched: fetched,
      newItems: inserted,
      duplicatesSkipped: duplicates,
      perSource,
      failures: failures.slice(0, 20),
      stoppedEarly,
    },
  }
}
