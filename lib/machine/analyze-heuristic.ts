/**
 * Deterministic document analysis.
 *
 * Pattern matching only: no network, no model, no clock beyond the one passed in.
 * This is the floor the pipeline always has. When no ANTHROPIC_API_KEY is
 * configured it is the whole of analysis, and when one is it still sets the
 * baseline that model output is reconciled against — so a model omitting
 * something the patterns found does not lose it.
 *
 * Kept free of framework and alias imports so it can be unit tested directly.
 * See tests/analyze-heuristic.test.ts.
 */

import { extractCountries, extractFrameworkCodes, extractTopics, type Topic } from './topics'
import type { SignalSeverity } from './relevance'

export type SignalCategory =
  | 'regulatory_change'
  | 'new_regulation'
  | 'guidance'
  | 'consultation'
  | 'enforcement'
  | 'threat'
  | 'vulnerability'
  | 'incident'
  | 'standard_update'

export type AnalysisInput = {
  title: string
  content: string | null
  summary: string | null
  url: string | null
  publishedAt: string | null
  source: {
    name: string
    regulator: string | null
    country: string | null
    authorityTier: number
    frameworks: string[]
    sectors: string[]
    type: string
  }
}

export type AnalyzedSignal = {
  category: SignalCategory
  severity: SignalSeverity
  summary: string
  impactAnalysis: string | null
  recommendedAction: string | null
  countries: string[]
  sectors: string[]
  frameworkCodes: string[]
  controlCodes: string[]
  topics: Topic[]
  effectiveDate: string | null
  deadlineDate: string | null
  confidence: number
  method: 'heuristic' | 'llm'
  model: string | null
}

export const VALID_CATEGORIES: ReadonlySet<string> = new Set<SignalCategory>([
  'regulatory_change',
  'new_regulation',
  'guidance',
  'consultation',
  'enforcement',
  'threat',
  'vulnerability',
  'incident',
  'standard_update',
])

export const VALID_SEVERITIES: ReadonlySet<string> = new Set<SignalSeverity>([
  'info',
  'low',
  'medium',
  'high',
  'critical',
])

/**
 * Ordered most specific first: the first pattern to match wins, so an enforcement
 * notice is not filed as generic guidance merely because it also uses the word
 * "guidance".
 */
const CATEGORY_PATTERNS: ReadonlyArray<readonly [SignalCategory, RegExp]> = [
  ['enforcement', /\b(fine[sd]?|penalt(?:y|ies)|sanction(?:ed|s)?|enforcement action|reprimand|infringement)\b/i],
  ['vulnerability', /\b(cve-\d{4}-\d+|vulnerabilit(?:y|ies)|zero[- ]day|exploited in the wild|cvss)\b/i],
  ['threat', /\b(threat actor|threat campaign|ransomware group|security advisory|indicators? of compromise|malware family|apt\d+)\b/i],
  ['incident', /\b(data breach|security incident|has been compromised|outage affecting)\b/i],
  ['consultation', /\b(consultation|request for comment|draft for comment|feedback period|public comment)\b/i],
  ['new_regulation', /\b(new (?:law|regulation|decree|framework)|issued a new|promulgat|comes into force|enters into force)\b/i],
  ['standard_update', /\b(iso\/?iec ?\d{4,5}|revision of the standard|new edition|amendment \d+ to)\b/i],
  ['regulatory_change', /\b(circular|amend(?:ed|ment)|updated? (?:framework|controls?|requirements?)|revised|version \d)\b/i],
  ['guidance', /\b(guidance|guideline|best practice|explanatory note|\bfaq\b|clarif)\b/i],
]

const SEVERITY_PATTERNS: ReadonlyArray<readonly [SignalSeverity, RegExp]> = [
  ['critical', /\b(immediate(?:ly)? (?:effect|action)|actively exploited|critical vulnerability|must comply by|mandatory with immediate|cease and desist|licence (?:revoked|suspended))\b/i],
  ['high', /\b(mandatory|shall comply|are required to|deadline|no later than|within \d+ (?:days?|hours?)|binding|enforcement)\b/i],
  ['medium', /\b(should|recommended|expected to|encouraged to|updated? (?:framework|controls?))\b/i],
  ['low', /\b(informational|for awareness|may consider|optional)\b/i],
]

/**
 * Dates that carry a compliance obligation.
 *
 * Only dates introduced by deadline language count. A document's own publication
 * date is not a deadline, and treating it as one would fill every tenant's
 * calendar with entries nobody owes.
 */
const DEADLINE_PATTERNS: readonly RegExp[] = [
  /(?:by|before|no later than|not later than|deadline of|due by|comply by|effective from|with effect from|shall apply from|applicable from)\s+(\d{1,2}\s+\w+\s+\d{4})/i,
  /(?:by|before|no later than|not later than|deadline of|due by|comply by|effective from|with effect from|shall apply from|applicable from)\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
  /(?:by|before|no later than|not later than|deadline of|due by|comply by|effective from|with effect from|shall apply from|applicable from)\s+(\d{4}-\d{2}-\d{2})/i,
]

const RELATIVE_DEADLINE = /within\s+(\d{1,3})\s+(day|week|month)s?(?!\s+of\s+becoming\s+aware)/i

export function parseDeadline(text: string, from: Date): string | null {
  for (const pattern of DEADLINE_PATTERNS) {
    const match = pattern.exec(text)
    if (!match) continue
    const parsed = new Date(match[1])
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }

  const relative = RELATIVE_DEADLINE.exec(text)
  if (relative) {
    const amount = Number(relative[1])
    const unit = relative[2].toLowerCase()
    const days = unit === 'day' ? amount : unit === 'week' ? amount * 7 : amount * 30
    if (days <= 3650) {
      return new Date(from.getTime() + days * 86_400_000).toISOString().slice(0, 10)
    }
  }

  return null
}

function firstMatch<T>(
  patterns: ReadonlyArray<readonly [T, RegExp]>,
  text: string,
  fallback: T
): T {
  for (const [value, pattern] of patterns) {
    if (pattern.test(text)) return value
  }
  return fallback
}

function buildSummary(input: AnalysisInput): string {
  if (input.summary && input.summary.length > 40) {
    return input.summary.slice(0, 600)
  }

  const body = (input.content ?? '').trim()
  if (body.length > 40) {
    // Two sentences read better than a hard character cut mid-word.
    const sentences = body.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
    return (sentences.length > 40 ? sentences : body).slice(0, 600)
  }

  const publisher = input.source.regulator ?? input.source.name
  return `${publisher} published "${input.title}".`
}

export function analyzeHeuristic(
  input: AnalysisInput,
  now: Date = new Date()
): AnalyzedSignal {
  const haystack = [input.title, input.summary, input.content]
    .filter((v): v is string => typeof v === 'string')
    .join('\n')

  const category = firstMatch(CATEGORY_PATTERNS, haystack, 'guidance')
  let severity = firstMatch(SEVERITY_PATTERNS, haystack, 'medium')

  // The publisher matters as much as the wording. A mandatory-sounding statement
  // from the regulator itself binds; the same words from a commentator do not.
  if (input.source.authorityTier === 1 && severity === 'medium') {
    severity = 'high'
  }
  if (input.source.authorityTier === 3 && severity === 'high') {
    severity = 'medium'
  }

  const topics = extractTopics(input.title, input.summary, input.content)

  // The source's configured frameworks are authoritative — we set them — and
  // anything found in the text is additive.
  const frameworkCodes = [
    ...new Set([...input.source.frameworks, ...extractFrameworkCodes(haystack)]),
  ]

  const countries = [
    ...new Set(
      [input.source.country, ...extractCountries(haystack)].filter(
        (c): c is string => typeof c === 'string' && c.length > 0
      )
    ),
  ]

  // Capped at 0.7: pattern matching can establish that a document concerns
  // logging, never that it changes a logging obligation. Overstating that would
  // put unverified conclusions in front of a compliance officer.
  let confidence = 0.45
  if (input.source.authorityTier === 1) confidence += 0.15
  if (frameworkCodes.length > 0) confidence += 0.1
  if (topics.length >= 2) confidence += 0.05
  if (!input.content || input.content.length < 200) confidence -= 0.15
  confidence = Math.min(0.7, Math.max(0.15, confidence))

  return {
    category,
    severity,
    summary: buildSummary(input),
    impactAnalysis: null,
    recommendedAction:
      input.source.authorityTier === 1
        ? 'Review the source document and confirm whether any control or obligation needs to change.'
        : 'Review for awareness and corroborate against the issuing authority before acting.',
    countries,
    sectors: input.source.sectors,
    frameworkCodes,
    controlCodes: [],
    topics,
    effectiveDate: null,
    deadlineDate: parseDeadline(haystack, now),
    confidence: Number(confidence.toFixed(2)),
    method: 'heuristic',
    model: null,
  }
}
