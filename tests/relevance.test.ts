import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  bandForScore,
  buildControlTopicCounts,
  scoreRelevance,
  type ScoredSignal,
  type TenantProfile,
} from '../lib/machine/relevance'

const NOW = new Date('2026-07-01T00:00:00Z')

/** A Saudi bank: NCA ECC and SAMA CSF mandatory, ISO 27001 voluntary. */
function saudiBank(overrides: Partial<TenantProfile> = {}): TenantProfile {
  return {
    country: 'SA',
    industry: 'banking',
    frameworkCodes: ['NCA-ECC', 'SAMA-CSF', 'ISO-27001'],
    mandatoryFrameworkCodes: ['NCA-ECC', 'SAMA-CSF'],
    controlTopicCounts: {
      access_control: 8,
      identity: 6,
      authentication: 5,
      logging: 4,
      monitoring: 4,
      cryptography: 3,
      incident_response: 5,
      cloud: 2,
    },
    watchCountries: [],
    watchSectors: [],
    watchFrameworks: [],
    ...overrides,
  }
}

/** A Jordanian logistics firm with no financial or Saudi exposure. */
function jordanLogistics(overrides: Partial<TenantProfile> = {}): TenantProfile {
  return {
    country: 'JO',
    industry: 'transport',
    frameworkCodes: ['JO-PDPL', 'ISO-27001'],
    mandatoryFrameworkCodes: ['JO-PDPL'],
    controlTopicCounts: { privacy: 6, access_control: 3 },
    watchCountries: [],
    watchSectors: [],
    watchFrameworks: [],
    ...overrides,
  }
}

function signal(overrides: Partial<ScoredSignal> = {}): ScoredSignal {
  return {
    countries: ['SA'],
    sectors: ['banking'],
    frameworkCodes: ['SAMA-CSF'],
    topics: ['access_control', 'identity'],
    severity: 'high',
    confidence: 0.9,
    deadlineDate: null,
    ...overrides,
  }
}

describe('bandForScore', () => {
  test('maps scores onto bands at the documented thresholds', () => {
    assert.equal(bandForScore(0.95), 'critical')
    assert.equal(bandForScore(0.85), 'critical')
    assert.equal(bandForScore(0.84), 'urgent')
    assert.equal(bandForScore(0.7), 'urgent')
    assert.equal(bandForScore(0.69), 'relevant')
    assert.equal(bandForScore(0.5), 'relevant')
    assert.equal(bandForScore(0.49), 'watch')
    assert.equal(bandForScore(0.3), 'watch')
    assert.equal(bandForScore(0.29), 'noise')
    assert.equal(bandForScore(0), 'noise')
  })
})

describe('scoreRelevance — the core discrimination', () => {
  test('a SAMA circular is urgent for a Saudi bank', () => {
    const result = scoreRelevance(signal(), saudiBank(), NOW)

    assert.ok(
      result.score >= 0.7,
      `expected an urgent-or-better score, got ${result.score}`
    )
    assert.ok(['urgent', 'critical'].includes(result.band))
    assert.deepEqual(result.matchedFrameworks, ['SAMA-CSF'])
  })

  test('the same circular is noise for a Jordanian logistics firm', () => {
    const result = scoreRelevance(signal(), jordanLogistics(), NOW)

    assert.equal(result.band, 'noise')
    assert.ok(result.score < 0.3, `expected noise, got ${result.score}`)
    assert.deepEqual(result.matchedFrameworks, [])
  })

  test('score is deterministic for the same inputs', () => {
    const a = scoreRelevance(signal(), saudiBank(), NOW)
    const b = scoreRelevance(signal(), saudiBank(), NOW)
    assert.equal(a.score, b.score)
    assert.equal(a.rationale, b.rationale)
  })

  test('every score carries a breakdown that sums to it before modifiers', () => {
    const result = scoreRelevance(
      signal({ confidence: 1, deadlineDate: null }),
      saudiBank(),
      NOW
    )

    const summed = result.components.reduce((sum, c) => sum + c.contribution, 0)
    const afterConfidence = result.modifiers.reduce(
      (acc, m) => acc * m.factor,
      summed
    )

    assert.ok(
      Math.abs(afterConfidence - result.score) < 0.01,
      `components (${summed}) with modifiers (${afterConfidence}) should reconcile to ${result.score}`
    )
  })

  test('component weights sum to 1', () => {
    const result = scoreRelevance(signal(), saudiBank(), NOW)
    const totalWeight = result.components.reduce((sum, c) => sum + c.weight, 0)
    assert.ok(Math.abs(totalWeight - 1) < 1e-9, `weights summed to ${totalWeight}`)
  })
})

describe('scoreRelevance — jurisdiction', () => {
  test('an EU instrument is near-noise for a GCC tenant with no EU exposure', () => {
    const result = scoreRelevance(
      signal({ countries: ['EU'], frameworkCodes: ['EU-AI-ACT'], sectors: ['all'] }),
      saudiBank(),
      NOW
    )
    assert.equal(result.band, 'noise')
  })

  test('the same instrument matters once the tenant tracks an EU regime', () => {
    const result = scoreRelevance(
      signal({ countries: ['EU'], frameworkCodes: ['EU-AI-ACT'], sectors: ['all'] }),
      saudiBank({
        frameworkCodes: ['NCA-ECC', 'SAMA-CSF', 'ISO-27001', 'EU-AI-ACT'],
      }),
      NOW
    )
    assert.notEqual(result.band, 'noise')
    assert.ok(result.score >= 0.5, `expected at least relevant, got ${result.score}`)
  })

  test('a watched jurisdiction scores below the home jurisdiction but well above nothing', () => {
    const watched = scoreRelevance(
      signal({ countries: ['QA'], frameworkCodes: ['ISO-27001'] }),
      saudiBank({ watchCountries: ['QA'] }),
      NOW
    )
    const unwatched = scoreRelevance(
      signal({ countries: ['QA'], frameworkCodes: ['ISO-27001'] }),
      saudiBank(),
      NOW
    )
    assert.ok(
      watched.score > unwatched.score,
      'watching a jurisdiction must raise relevance'
    )
  })

  test('an international standard update is relevant but not jurisdictionally urgent', () => {
    const result = scoreRelevance(
      signal({
        countries: ['GLOBAL'],
        frameworkCodes: ['ISO-27001'],
        sectors: ['all'],
        severity: 'medium',
      }),
      saudiBank(),
      NOW
    )
    const jurisdiction = result.components.find((c) => c.key === 'jurisdiction')
    assert.ok(jurisdiction)
    assert.ok(jurisdiction.raw < 1, 'GLOBAL must not score as a home-jurisdiction hit')
    assert.ok(jurisdiction.raw >= 0.4, 'GLOBAL still applies to everyone')
  })
})

describe('scoreRelevance — control library impact', () => {
  test('a signal hitting a well-built control area outscores one hitting nothing', () => {
    const covered = scoreRelevance(
      signal({ topics: ['access_control', 'identity'] }),
      saudiBank(),
      NOW
    )
    const uncovered = scoreRelevance(
      signal({ topics: ['ot_ics'] }),
      saudiBank(),
      NOW
    )

    assert.ok(
      covered.score > uncovered.score,
      'blast radius in the control library must matter'
    )
  })

  test('affected control areas are reported so the reasoning can be checked', () => {
    const result = scoreRelevance(
      signal({ topics: ['access_control', 'identity', 'ot_ics'] }),
      saudiBank(),
      NOW
    )
    assert.deepEqual(result.matchedTopics.sort(), ['access_control', 'identity'])
  })
})

describe('scoreRelevance — modifiers', () => {
  test('low confidence dampens but does not erase a highly relevant signal', () => {
    const confident = scoreRelevance(signal({ confidence: 1 }), saudiBank(), NOW)
    const unsure = scoreRelevance(signal({ confidence: 0.2 }), saudiBank(), NOW)

    assert.ok(unsure.score < confident.score)
    assert.ok(unsure.score > 0, 'a low-confidence reading must still surface')
    assert.ok(
      unsure.modifiers.some((m) => m.key === 'confidence'),
      'the dampening must be recorded'
    )
  })

  test('an imminent deadline raises urgency', () => {
    const distant = scoreRelevance(
      signal({ severity: 'medium', deadlineDate: '2027-06-01' }),
      saudiBank(),
      NOW
    )
    const imminent = scoreRelevance(
      signal({ severity: 'medium', deadlineDate: '2026-07-15' }),
      saudiBank(),
      NOW
    )
    assert.ok(imminent.score > distant.score)
    assert.ok(imminent.modifiers.some((m) => m.key === 'deadline'))
  })

  test('a passed deadline is escalated, not ignored', () => {
    const result = scoreRelevance(
      signal({ severity: 'medium', deadlineDate: '2026-05-01' }),
      saudiBank(),
      NOW
    )
    const deadline = result.modifiers.find((m) => m.key === 'deadline')
    assert.ok(deadline)
    assert.ok(deadline.factor > 1)
    assert.match(deadline.detail, /passed/)
  })

  test('a malformed deadline is ignored rather than throwing', () => {
    const result = scoreRelevance(
      signal({ deadlineDate: 'sometime next year' }),
      saudiBank(),
      NOW
    )
    assert.ok(Number.isFinite(result.score))
    assert.ok(!result.modifiers.some((m) => m.key === 'deadline'))
  })

  test('a mandatory framework change is floored above the triage threshold', () => {
    // Low severity, low confidence, no sector fit: everything pushing it down.
    const result = scoreRelevance(
      signal({
        severity: 'low',
        confidence: 0.3,
        sectors: ['healthcare'],
        topics: ['ot_ics'],
        frameworkCodes: ['NCA-ECC'],
      }),
      saudiBank(),
      NOW
    )

    assert.ok(
      result.score >= 0.5,
      `a mandatory framework must clear triage, got ${result.score}`
    )
    assert.ok(result.modifiers.some((m) => m.key === 'mandatoryFloor'))
    assert.match(result.rationale, /mandatory/i)
  })

  test('the floor does not apply to a voluntary framework', () => {
    const result = scoreRelevance(
      signal({
        severity: 'low',
        confidence: 0.3,
        sectors: ['healthcare'],
        topics: ['ot_ics'],
        frameworkCodes: ['ISO-27001'],
      }),
      saudiBank(),
      NOW
    )
    assert.ok(!result.modifiers.some((m) => m.key === 'mandatoryFloor'))
    assert.ok(result.score < 0.5)
  })
})

describe('scoreRelevance — degenerate inputs', () => {
  test('an empty signal scores low without throwing', () => {
    const result = scoreRelevance(
      {
        countries: [],
        sectors: [],
        frameworkCodes: [],
        topics: [],
        severity: 'info',
        confidence: 0.1,
      },
      saudiBank(),
      NOW
    )
    assert.ok(Number.isFinite(result.score))
    assert.equal(result.band, 'noise')
  })

  test('a tenant with no profile at all still scores without throwing', () => {
    const result = scoreRelevance(signal(), {
      country: null,
      industry: null,
      frameworkCodes: [],
      mandatoryFrameworkCodes: [],
      controlTopicCounts: {},
      watchCountries: [],
      watchSectors: [],
      watchFrameworks: [],
    }, NOW)

    assert.ok(Number.isFinite(result.score))
    assert.ok(result.score >= 0 && result.score <= 1)
  })

  test('scores are always within 0..1', () => {
    const extreme = scoreRelevance(
      signal({
        severity: 'critical',
        confidence: 1,
        deadlineDate: '2020-01-01',
        countries: ['SA'],
        topics: ['access_control', 'identity', 'authentication', 'logging'],
      }),
      saudiBank(),
      NOW
    )
    assert.ok(extreme.score <= 1, `score exceeded 1: ${extreme.score}`)
    assert.ok(extreme.score >= 0)
  })
})

describe('buildControlTopicCounts', () => {
  test('counts how many controls carry each topic', () => {
    const counts = buildControlTopicCounts([
      { tags: ['access_control', 'identity'] },
      { tags: ['access_control'] },
      { tags: null },
      { tags: [] },
    ])
    assert.deepEqual(counts, { access_control: 2, identity: 1 })
  })
})
