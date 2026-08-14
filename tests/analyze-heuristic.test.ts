import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  analyzeHeuristic,
  parseDeadline,
  type AnalysisInput,
} from '../lib/machine/analyze-heuristic'

const NOW = new Date('2026-07-01T00:00:00Z')

function input(overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    title: 'Untitled',
    content: null,
    summary: null,
    url: null,
    publishedAt: null,
    source: {
      name: 'Saudi Central Bank (SAMA)',
      regulator: 'SAMA',
      country: 'SA',
      authorityTier: 1,
      frameworks: ['SAMA-CSF'],
      sectors: ['banking'],
      type: 'regulator',
    },
    ...overrides,
  }
}

describe('analyzeHeuristic — categorisation', () => {
  test('recognises an enforcement action', () => {
    const result = analyzeHeuristic(
      input({
        title: 'Authority imposes a fine on a licensed institution',
        content: 'A penalty was issued following an infringement of the security requirements.',
      }),
      NOW
    )
    assert.equal(result.category, 'enforcement')
  })

  test('recognises a vulnerability advisory', () => {
    const result = analyzeHeuristic(
      input({
        title: 'Advisory regarding CVE-2026-1234',
        content: 'The vulnerability is being actively exploited in the wild. CVSS 9.8.',
      }),
      NOW
    )
    assert.equal(result.category, 'vulnerability')
    assert.equal(result.severity, 'critical')
  })

  test('recognises a consultation', () => {
    const result = analyzeHeuristic(
      input({
        title: 'Consultation on proposed cloud controls',
        content: 'Feedback is invited during the public comment period.',
      }),
      NOW
    )
    assert.equal(result.category, 'consultation')
  })

  test('recognises a circular as a regulatory change', () => {
    const result = analyzeHeuristic(
      input({
        title: 'Circular 4 of 2026',
        content: 'This circular amends the existing requirements for member organisations.',
      }),
      NOW
    )
    assert.equal(result.category, 'regulatory_change')
  })

  test('defaults to guidance rather than inventing a stronger category', () => {
    const result = analyzeHeuristic(
      input({ title: 'Annual report published', content: 'An overview of activities.' }),
      NOW
    )
    assert.equal(result.category, 'guidance')
  })
})

describe('analyzeHeuristic — severity and the authority tier', () => {
  test('mandatory language reads as high severity', () => {
    const result = analyzeHeuristic(
      input({
        title: 'New requirement',
        content: 'Member organisations shall comply with this mandatory requirement.',
      }),
      NOW
    )
    assert.equal(result.severity, 'high')
  })

  test('the regulator itself lifts an otherwise middling document', () => {
    const result = analyzeHeuristic(
      input({
        title: 'Updated framework',
        content: 'Organisations should review the updated controls.',
        source: { ...input().source, authorityTier: 1 },
      }),
      NOW
    )
    assert.equal(result.severity, 'high')
  })

  test('the same wording from a commentator does not', () => {
    const result = analyzeHeuristic(
      input({
        title: 'Analysis: what the new deadline means',
        content: 'Firms are required to act before the deadline.',
        source: {
          name: 'Industry Weekly',
          regulator: null,
          country: 'SA',
          authorityTier: 3,
          frameworks: [],
          sectors: [],
          type: 'commentary',
        },
      }),
      NOW
    )
    assert.equal(result.severity, 'medium')
  })
})

describe('analyzeHeuristic — deadlines', () => {
  test('reads a deadline stated with day-month-year', () => {
    assert.equal(
      parseDeadline('Institutions must comply by 1 October 2026.', NOW),
      '2026-10-01'
    )
  })

  test('reads a deadline stated with month-day-year', () => {
    assert.equal(
      parseDeadline('No later than October 15, 2026 the controls must be in place.', NOW),
      '2026-10-15'
    )
  })

  test('reads an ISO deadline', () => {
    assert.equal(parseDeadline('effective from 2026-12-31', NOW), '2026-12-31')
  })

  test('resolves a relative deadline against the reference date', () => {
    assert.equal(parseDeadline('Firms must respond within 30 days.', NOW), '2026-07-31')
  })

  test('does not treat an event-triggered duty as a diary date', () => {
    // "within 72 hours of becoming aware" is triggered by an incident, not a
    // date, and inventing a deadline for it would corrupt the calendar.
    assert.equal(
      parseDeadline(
        'Notify the authority within 72 hours of becoming aware of the breach.',
        NOW
      ),
      null
    )
  })

  test('does not treat a publication date as a deadline', () => {
    assert.equal(parseDeadline('Published on 15 June 2026.', NOW), null)
  })

  test('returns null when there is no deadline at all', () => {
    assert.equal(parseDeadline('General guidance for practitioners.', NOW), null)
  })

  test('surfaces the deadline on the analysed signal', () => {
    const result = analyzeHeuristic(
      input({
        title: 'Circular on authentication',
        content: 'Multi-factor authentication must be enforced by 1 October 2026.',
      }),
      NOW
    )
    assert.equal(result.deadlineDate, '2026-10-01')
  })
})

describe('analyzeHeuristic — extraction', () => {
  test('keeps the source frameworks and adds any found in the text', () => {
    const result = analyzeHeuristic(
      input({
        title: 'Alignment with ISO/IEC 27001',
        content: 'The updated framework maps to ISO/IEC 27001 and the NIST Cybersecurity Framework.',
      }),
      NOW
    )
    assert.ok(result.frameworkCodes.includes('SAMA-CSF'), 'configured source framework')
    assert.ok(result.frameworkCodes.includes('ISO-27001'))
    assert.ok(result.frameworkCodes.includes('NIST-CSF'))
  })

  test('derives topics from the body', () => {
    const result = analyzeHeuristic(
      input({
        title: 'Requirements update',
        content:
          'Institutions must implement multi-factor authentication, maintain audit logs and perform penetration testing annually.',
      }),
      NOW
    )
    assert.ok(result.topics.includes('authentication'))
    assert.ok(result.topics.includes('logging'))
    assert.ok(result.topics.includes('pentest'))
  })

  test('includes the source jurisdiction', () => {
    const result = analyzeHeuristic(input({ title: 'Notice' }), NOW)
    assert.ok(result.countries.includes('SA'))
  })
})

describe('analyzeHeuristic — confidence', () => {
  test('never exceeds the heuristic ceiling', () => {
    const result = analyzeHeuristic(
      input({
        title: 'Mandatory circular on authentication, logging and encryption',
        content: 'x'.repeat(5000),
      }),
      NOW
    )
    assert.ok(
      result.confidence <= 0.7,
      `pattern matching must not claim more than 0.7, got ${result.confidence}`
    )
  })

  test('a thin document scores lower than a substantial one', () => {
    const thin = analyzeHeuristic(input({ title: 'Notice', content: 'Short.' }), NOW)
    const full = analyzeHeuristic(
      input({
        title: 'Notice',
        content:
          'Institutions must implement multi-factor authentication and maintain audit logs. '.repeat(
            10
          ),
      }),
      NOW
    )
    assert.ok(full.confidence > thin.confidence)
  })

  test('always reports the heuristic method and no model', () => {
    const result = analyzeHeuristic(input(), NOW)
    assert.equal(result.method, 'heuristic')
    assert.equal(result.model, null)
  })
})

describe('analyzeHeuristic — summary', () => {
  test('prefers the provided summary', () => {
    const result = analyzeHeuristic(
      input({
        summary:
          'The Bank has issued Circular 4 of 2026 requiring multi-factor authentication for all remote access.',
        content: 'Longer body text that should not be used.',
      }),
      NOW
    )
    assert.match(result.summary, /^The Bank has issued Circular 4/)
  })

  test('falls back to the opening sentences of the body', () => {
    const result = analyzeHeuristic(
      input({
        content:
          'This circular sets out new requirements. It applies to all member organisations. A third sentence follows.',
      }),
      NOW
    )
    assert.match(result.summary, /new requirements/)
    assert.ok(!result.summary.includes('A third sentence'))
  })

  test('falls back to naming the publisher when there is no body at all', () => {
    const result = analyzeHeuristic(input({ title: 'Circular 4 of 2026' }), NOW)
    assert.equal(result.summary, 'SAMA published "Circular 4 of 2026".')
  })
})
