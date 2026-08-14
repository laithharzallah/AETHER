/**
 * Per-tenant relevance scoring.
 *
 * The same regulatory change is urgent for a Saudi bank and irrelevant for a
 * Jordanian logistics firm. This module decides which, and — more importantly —
 * records why, because a score a compliance officer cannot interrogate is a score
 * they will not act on.
 *
 * Deliberately pure and dependency-free: no database, no network, no clock except
 * the one passed in. Every weighting decision here is testable, and
 * tests/relevance.test.mjs pins the behaviour that matters.
 */

import type { Topic } from './topics'

export type RelevanceBand = 'noise' | 'watch' | 'relevant' | 'urgent' | 'critical'

export type SignalSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export type ScoredSignal = {
  /** Jurisdictions the signal applies to: ISO 3166-1 alpha-2, `EU`, or `GLOBAL`. */
  countries: readonly string[]
  sectors: readonly string[]
  frameworkCodes: readonly string[]
  topics: readonly Topic[]
  severity: SignalSeverity
  /** Analysis confidence, 0..1. Scales the whole score rather than any one part. */
  confidence: number
  /** Compliance deadline, if the source states one. */
  deadlineDate?: string | null
}

export type TenantProfile = {
  country: string | null
  industry: string | null
  /** Frameworks the tenant actually holds controls for. */
  frameworkCodes: readonly string[]
  /** Of those, the ones that are legally mandatory for this tenant. */
  mandatoryFrameworkCodes: readonly string[]
  /** Topics covered by the tenant's control library, with how many controls each. */
  controlTopicCounts: Readonly<Record<string, number>>
  /** Extra jurisdictions to watch, e.g. EU exposure for a GCC entity. */
  watchCountries: readonly string[]
  watchSectors: readonly string[]
  watchFrameworks: readonly string[]
}

export type ScoreComponent = {
  key: string
  label: string
  weight: number
  /** 0..1 before weighting. */
  raw: number
  /** raw * weight. */
  contribution: number
  detail: string
}

export type RelevanceResult = {
  score: number
  band: RelevanceBand
  components: ScoreComponent[]
  modifiers: Array<{ key: string; factor: number; detail: string }>
  rationale: string
  matchedFrameworks: string[]
  matchedTopics: Topic[]
  matchedSectors: string[]
}

/**
 * Weights sum to 1.0. Jurisdiction and framework overlap dominate because they
 * are the two questions that decide whether an obligation exists at all — the
 * rest only modulate how urgently it matters.
 */
const WEIGHTS = {
  jurisdiction: 0.3,
  framework: 0.3,
  controlImpact: 0.18,
  sector: 0.12,
  severity: 0.1,
} as const

const BAND_THRESHOLDS: ReadonlyArray<readonly [RelevanceBand, number]> = [
  ['critical', 0.85],
  ['urgent', 0.7],
  ['relevant', 0.5],
  ['watch', 0.3],
  ['noise', 0],
]

const SEVERITY_SCORES: Readonly<Record<SignalSeverity, number>> = {
  info: 0.1,
  low: 0.3,
  medium: 0.55,
  high: 0.8,
  critical: 1,
}

export function bandForScore(score: number): RelevanceBand {
  for (const [band, threshold] of BAND_THRESHOLDS) {
    if (score >= threshold) return band
  }
  return 'noise'
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function intersect<T>(a: readonly T[], b: readonly T[]): T[] {
  const bSet = new Set(b)
  return unique(a.filter((item) => bSet.has(item)))
}

/**
 * Jurisdiction fit.
 *
 * `GLOBAL` signals (an ISO revision, a CVE) apply to everyone but are not
 * jurisdiction-specific, so they score moderately rather than fully — otherwise
 * every standards-body announcement would outrank a circular from the tenant's
 * own regulator.
 */
function scoreJurisdiction(
  signal: ScoredSignal,
  tenant: TenantProfile
): { raw: number; detail: string } {
  if (signal.countries.length === 0) {
    return { raw: 0.35, detail: 'No jurisdiction stated; treated as possibly relevant' }
  }

  const tenantJurisdictions = unique(
    [tenant.country, ...tenant.watchCountries].filter(
      (c): c is string => typeof c === 'string' && c.length > 0
    )
  )

  if (tenant.country && signal.countries.includes(tenant.country)) {
    return {
      raw: 1,
      detail: `Applies to ${tenant.country}, the organisation's own jurisdiction`,
    }
  }

  const watched = intersect(signal.countries, tenantJurisdictions)
  if (watched.length > 0) {
    return {
      raw: 0.8,
      detail: `Applies to ${watched.join(', ')}, a jurisdiction on the watch list`,
    }
  }

  if (signal.countries.includes('GLOBAL')) {
    return {
      raw: 0.5,
      detail: 'International standard or advisory with no jurisdictional limit',
    }
  }

  if (signal.countries.includes('EU')) {
    // Reaches a GCC entity only through extraterritorial provisions, and only if
    // the tenant already tracks an EU regime.
    const tracksEu = tenant.frameworkCodes.some((code) => code.startsWith('EU-'))
    return tracksEu
      ? { raw: 0.7, detail: 'EU instrument, and the organisation already tracks EU regimes' }
      : { raw: 0.15, detail: 'EU instrument with no EU exposure recorded for this organisation' }
  }

  return {
    raw: 0.05,
    detail: `Applies to ${signal.countries.join(', ')} only`,
  }
}

/**
 * Framework overlap, measured against the frameworks the tenant holds rather
 * than against the full catalogue.
 */
function scoreFramework(
  signal: ScoredSignal,
  tenant: TenantProfile
): { raw: number; detail: string; matched: string[] } {
  if (signal.frameworkCodes.length === 0) {
    return {
      raw: 0.25,
      detail: 'No framework identified in the source document',
      matched: [],
    }
  }

  const held = unique([...tenant.frameworkCodes, ...tenant.watchFrameworks])
  const matched = intersect(signal.frameworkCodes, held)

  if (matched.length === 0) {
    return {
      raw: 0,
      detail: `Touches ${signal.frameworkCodes.join(', ')}, none of which this organisation is assessed against`,
      matched: [],
    }
  }

  // Proportion of the signal's frameworks that land on this tenant. A circular
  // naming one framework the tenant holds is a full hit, not a fraction.
  const coverage = matched.length / signal.frameworkCodes.length
  const mandatoryHit = intersect(matched, tenant.mandatoryFrameworkCodes)

  const raw = clamp01(0.6 + 0.4 * coverage)

  return {
    raw,
    detail:
      mandatoryHit.length > 0
        ? `Affects ${matched.join(', ')}, including the mandatory ${mandatoryHit.join(', ')}`
        : `Affects ${matched.join(', ')}`,
    matched,
  }
}

/**
 * Whether the signal lands on control areas the tenant has actually built out.
 * A change to logging requirements matters more when the tenant holds 40 logging
 * controls than when it holds none.
 */
function scoreControlImpact(
  signal: ScoredSignal,
  tenant: TenantProfile
): { raw: number; detail: string; matched: Topic[] } {
  if (signal.topics.length === 0) {
    return { raw: 0.2, detail: 'No control area identified', matched: [] }
  }

  const matched = signal.topics.filter((topic) => (tenant.controlTopicCounts[topic] ?? 0) > 0)

  if (matched.length === 0) {
    return {
      raw: 0.1,
      detail: `Concerns ${signal.topics.slice(0, 4).join(', ')}, which this control library does not cover`,
      matched: [],
    }
  }

  const affectedControls = matched.reduce(
    (sum, topic) => sum + (tenant.controlTopicCounts[topic] ?? 0),
    0
  )
  const coverage = matched.length / signal.topics.length

  // Saturating on volume: 25 affected controls is already a large blast radius,
  // and beyond that the score should not keep climbing.
  const volume = clamp01(affectedControls / 25)
  const raw = clamp01(0.5 * coverage + 0.5 * volume)

  return {
    raw,
    detail: `Touches ${matched.length} control area(s) covering ${affectedControls} control(s) in the library: ${matched.slice(0, 5).join(', ')}`,
    matched,
  }
}

function scoreSector(
  signal: ScoredSignal,
  tenant: TenantProfile
): { raw: number; detail: string; matched: string[] } {
  if (signal.sectors.length === 0 || signal.sectors.includes('all')) {
    return { raw: 0.6, detail: 'Applies across sectors', matched: [] }
  }

  const tenantSectors = unique(
    [tenant.industry, ...tenant.watchSectors].filter(
      (s): s is string => typeof s === 'string' && s.length > 0
    )
  )

  if (tenantSectors.length === 0) {
    return { raw: 0.4, detail: 'No industry recorded for this organisation', matched: [] }
  }

  const matched = intersect(signal.sectors, tenantSectors)
  if (matched.length > 0) {
    return { raw: 1, detail: `Sector-specific to ${matched.join(', ')}`, matched }
  }

  return {
    raw: 0.05,
    detail: `Sector-specific to ${signal.sectors.join(', ')}, which does not include this organisation`,
    matched: [],
  }
}

/**
 * Deadline proximity. A requirement due in a fortnight outranks the same
 * requirement due in a year, and one already past due outranks both.
 */
function deadlineModifier(
  signal: ScoredSignal,
  now: Date
): { factor: number; detail: string } | null {
  if (!signal.deadlineDate) return null

  const deadline = new Date(`${signal.deadlineDate}T00:00:00Z`)
  if (Number.isNaN(deadline.getTime())) return null

  const days = Math.round((deadline.getTime() - now.getTime()) / 86_400_000)

  if (days < 0) {
    return { factor: 1.3, detail: `Compliance deadline passed ${Math.abs(days)} day(s) ago` }
  }
  if (days <= 30) {
    return { factor: 1.25, detail: `Compliance deadline in ${days} day(s)` }
  }
  if (days <= 90) {
    return { factor: 1.12, detail: `Compliance deadline in ${days} day(s)` }
  }
  if (days <= 365) {
    return { factor: 1.04, detail: `Compliance deadline in ${days} day(s)` }
  }
  return null
}

export function scoreRelevance(
  signal: ScoredSignal,
  tenant: TenantProfile,
  now: Date = new Date()
): RelevanceResult {
  const jurisdiction = scoreJurisdiction(signal, tenant)
  const framework = scoreFramework(signal, tenant)
  const controlImpact = scoreControlImpact(signal, tenant)
  const sector = scoreSector(signal, tenant)
  const severityRaw = SEVERITY_SCORES[signal.severity] ?? 0.5

  const components: ScoreComponent[] = [
    {
      key: 'jurisdiction',
      label: 'Jurisdiction',
      weight: WEIGHTS.jurisdiction,
      raw: jurisdiction.raw,
      contribution: jurisdiction.raw * WEIGHTS.jurisdiction,
      detail: jurisdiction.detail,
    },
    {
      key: 'framework',
      label: 'Framework overlap',
      weight: WEIGHTS.framework,
      raw: framework.raw,
      contribution: framework.raw * WEIGHTS.framework,
      detail: framework.detail,
    },
    {
      key: 'controlImpact',
      label: 'Control library impact',
      weight: WEIGHTS.controlImpact,
      raw: controlImpact.raw,
      contribution: controlImpact.raw * WEIGHTS.controlImpact,
      detail: controlImpact.detail,
    },
    {
      key: 'sector',
      label: 'Sector fit',
      weight: WEIGHTS.sector,
      raw: sector.raw,
      contribution: sector.raw * WEIGHTS.sector,
      detail: sector.detail,
    },
    {
      key: 'severity',
      label: 'Severity',
      weight: WEIGHTS.severity,
      raw: severityRaw,
      contribution: severityRaw * WEIGHTS.severity,
      detail: `Assessed severity: ${signal.severity}`,
    },
  ]

  let score = components.reduce((sum, c) => sum + c.contribution, 0)

  const modifiers: RelevanceResult['modifiers'] = []

  // Confidence scales the result rather than adding to it: a low-confidence
  // reading of a highly relevant change should surface, but muted.
  const confidence = clamp01(signal.confidence)
  const confidenceFactor = 0.55 + 0.45 * confidence
  if (confidenceFactor !== 1) {
    modifiers.push({
      key: 'confidence',
      factor: confidenceFactor,
      detail: `Analysis confidence ${(confidence * 100).toFixed(0)}%`,
    })
    score *= confidenceFactor
  }

  const deadline = deadlineModifier(signal, now)
  if (deadline) {
    modifiers.push({ key: 'deadline', ...deadline })
    score *= deadline.factor
  }

  // No applicable framework and no jurisdictional nexus means no obligation, so
  // the remaining components should not be able to carry it into triage on their
  // own. Without this, any signal touching a well-built control area scores as
  // `watch` for every tenant on earth — which is how a relevance feed becomes a
  // list nobody reads.
  const hasFrameworkNexus =
    signal.frameworkCodes.length === 0 || framework.matched.length > 0
  const hasJurisdictionNexus = jurisdiction.raw >= 0.5

  if (!hasFrameworkNexus && !hasJurisdictionNexus) {
    const factor = 0.4
    modifiers.push({
      key: 'noNexus',
      factor,
      detail:
        'Neither the framework nor the jurisdiction connects this to the organisation, so it is treated as background.',
    })
    score *= factor
  }

  // A mandatory framework is not optional to act on, so it gets a floor rather
  // than a multiplier: even a low-severity change to a mandatory obligation must
  // clear triage.
  const mandatoryMatch = intersect(framework.matched, tenant.mandatoryFrameworkCodes)
  if (mandatoryMatch.length > 0 && score < 0.5) {
    modifiers.push({
      key: 'mandatoryFloor',
      factor: 0.5 / Math.max(score, 0.0001),
      detail: `Floored to 0.50: ${mandatoryMatch.join(', ')} is mandatory for this organisation`,
    })
    score = 0.5
  }

  score = clamp01(score)
  const band = bandForScore(score)

  const rationale = buildRationale(band, score, components, modifiers)

  return {
    score: Number(score.toFixed(3)),
    band,
    components,
    modifiers,
    rationale,
    matchedFrameworks: framework.matched,
    matchedTopics: controlImpact.matched,
    matchedSectors: sector.matched,
  }
}

function buildRationale(
  band: RelevanceBand,
  score: number,
  components: ScoreComponent[],
  modifiers: RelevanceResult['modifiers']
): string {
  const ranked = [...components].sort((a, b) => b.contribution - a.contribution)
  const drivers = ranked.slice(0, 3).map((c) => c.detail)

  const parts = [
    `Scored ${(score * 100).toFixed(0)}% (${band}).`,
    ...drivers.map((d) => `${d}.`),
  ]

  const weakest = ranked[ranked.length - 1]
  if (weakest && weakest.raw < 0.2) {
    parts.push(`Score held down by: ${weakest.detail.toLowerCase()}.`)
  }

  for (const modifier of modifiers) {
    if (modifier.key === 'deadline' || modifier.key === 'mandatoryFloor') {
      parts.push(`${modifier.detail}.`)
    }
  }

  return parts.join(' ').replace(/\.\./g, '.')
}

/**
 * Turns a tenant's control rows into the topic histogram the scorer needs.
 */
export function buildControlTopicCounts(
  controls: ReadonlyArray<{ tags: readonly string[] | null }>
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const control of controls) {
    for (const tag of control.tags ?? []) {
      counts[tag] = (counts[tag] ?? 0) + 1
    }
  }
  return counts
}
