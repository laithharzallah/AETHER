import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  assessPolicyCompleteness,
  extractCitedControls,
  parseSections,
} from '../lib/policy/completeness'

const REQUIRED = [
  { heading: 'Document Control' },
  { heading: 'Purpose' },
  { heading: 'Scope' },
  { heading: 'Policy Statements' },
  { heading: 'Roles and Responsibilities' },
  { heading: 'Review Cycle' },
]

const COMPLETE_POLICY = `# Access Control Policy

## 1. Document Control

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Effective date | 1 July 2026 |
| Owner | Chief Information Security Officer |
| Classification | Internal |

## 2. Purpose

This policy establishes the requirements for controlling access to information
systems and data, so that access is granted only where there is a legitimate
business need and is removed promptly when that need ends.

## 3. Scope

This policy applies to all employees, contractors and third parties who access
organisational systems, including service accounts and machine identities across
on-premise and cloud environments.

## 4. Policy Statements

4.1 Access shall be granted on the principle of least privilege, in line with
ISO/IEC 27001 A.5.15 and ECC 2-2.

4.2 Multi-factor authentication shall be enforced for all remote and privileged
access, satisfying A.8.5 and SAMA CSF 3.3.5.

4.3 Privileged access shall be vaulted and session-recorded, per A.8.2 and
NIST CSF PR.AA-05.

## 5. Roles & Responsibilities

System owners approve access requests. The identity team provisions and revokes
access. Internal Audit tests compliance annually.

## 6. Review Cycle

This policy is reviewed annually, or sooner following a material change to the
regulatory requirements or a significant security incident.
`

describe('parseSections', () => {
  test('splits on ATX headings', () => {
    const sections = parseSections('# A\nbody a\n## B\nbody b')
    assert.deepEqual(
      sections.map((s) => s.heading),
      ['A', 'B']
    )
    assert.equal(sections[0].body, 'body a')
  })

  test('splits on Setext headings', () => {
    const sections = parseSections('Purpose\n=======\nbody\n\nScope\n-----\nmore')
    assert.deepEqual(
      sections.map((s) => s.heading),
      ['Purpose', 'Scope']
    )
  })

  test('does not mistake a Markdown table separator for a heading', () => {
    const sections = parseSections('## Table\n| a | b |\n| --- | --- |\n| 1 | 2 |')
    assert.deepEqual(
      sections.map((s) => s.heading),
      ['Table']
    )
  })

  test('accepts a bold line as a pseudo-heading', () => {
    // Models emit these often enough that penalising them would misreport a
    // perfectly serviceable document.
    const sections = parseSections('**Purpose**\nTo establish requirements.')
    assert.deepEqual(
      sections.map((s) => s.heading),
      ['Purpose']
    )
  })

  test('returns nothing for a document with no headings', () => {
    assert.deepEqual(parseSections('Just a paragraph.'), [])
  })
})

describe('assessPolicyCompleteness — heading matching', () => {
  const result = assessPolicyCompleteness(COMPLETE_POLICY, REQUIRED)

  test('scores a complete policy at 100', () => {
    assert.equal(result.score, 100)
    assert.deepEqual(result.missingSections, [])
    assert.deepEqual(result.thinSections, [])
  })

  test('matches through section numbering', () => {
    const purpose = result.sections.find((s) => s.heading === 'Purpose')
    assert.ok(purpose?.present)
    assert.equal(purpose?.matchedAs, '2. Purpose')
  })

  test('matches "Roles & Responsibilities" against "Roles and Responsibilities"', () => {
    const roles = result.sections.find((s) => s.heading === 'Roles and Responsibilities')
    assert.ok(roles?.present, 'an ampersand variant must not read as missing')
    assert.equal(roles?.matchedAs, '5. Roles & Responsibilities')
  })

  test('counts words under each heading', () => {
    const scope = result.sections.find((s) => s.heading === 'Scope')
    assert.ok((scope?.wordCount ?? 0) > 25)
  })
})

describe('assessPolicyCompleteness — gaps', () => {
  test('reports a missing section', () => {
    const withoutReview = COMPLETE_POLICY.split('## 6. Review Cycle')[0]
    const result = assessPolicyCompleteness(withoutReview, REQUIRED)

    assert.deepEqual(result.missingSections, ['Review Cycle'])
    assert.ok(result.score < 100)
    assert.ok(result.warnings.some((w) => w.includes('Review Cycle')))
  })

  test('a present-but-empty section earns half credit, not full', () => {
    const thin = `## Document Control
v1

## Purpose
x

## Scope
y

## Policy Statements
z

## Roles and Responsibilities
q

## Review Cycle
annual`
    const result = assessPolicyCompleteness(thin, REQUIRED)

    assert.equal(result.missingSections.length, 0)
    assert.equal(result.thinSections.length, 6)
    assert.equal(result.score, 50, 'six thin sections out of six should score 50')
    assert.ok(result.warnings.some((w) => w.includes('too brief')))
  })

  test('scores an empty document at zero', () => {
    const result = assessPolicyCompleteness('', REQUIRED)
    assert.equal(result.score, 0)
    assert.equal(result.missingSections.length, REQUIRED.length)
  })

  test('reports sections present but not required', () => {
    const result = assessPolicyCompleteness(
      COMPLETE_POLICY + '\n## Appendix A: Glossary\nTerms used in this policy.',
      REQUIRED
    )
    assert.ok(result.extraSections.some((s) => s.includes('Appendix A')))
    assert.equal(result.score, 100, 'extra sections must not reduce the score')
  })

  test('warns when a policy cites no controls', () => {
    const result = assessPolicyCompleteness(
      '## Purpose\n' + 'Establishes requirements for access. '.repeat(20),
      [{ heading: 'Purpose' }]
    )
    assert.ok(result.warnings.some((w) => w.includes('No framework control identifiers')))
  })

  test('warns when a policy is implausibly short', () => {
    const result = assessPolicyCompleteness('## Purpose\nShort policy.', [
      { heading: 'Purpose' },
    ])
    assert.ok(result.warnings.some((w) => w.includes('words')))
  })

  test('an empty requirement list scores 100 rather than dividing by zero', () => {
    const result = assessPolicyCompleteness(COMPLETE_POLICY, [])
    assert.equal(result.score, 100)
  })
})

describe('extractCitedControls', () => {
  test('finds ISO 27001 Annex A citations', () => {
    const cited = extractCitedControls('In line with A.5.15 and A.8.24.')
    const iso = cited.filter((c) => c.framework === 'ISO-27001').map((c) => c.code)
    assert.deepEqual(iso.sort(), ['A.5.15', 'A.8.24'])
  })

  test('finds NCA ECC citations at subdomain and control level', () => {
    const cited = extractCitedControls('Satisfies ECC 2-2 and ECC 2-12-1.')
    const ecc = cited.filter((c) => c.framework === 'NCA-ECC').map((c) => c.code)
    assert.ok(ecc.includes('2-2'))
    assert.ok(ecc.includes('2-12-1'))
  })

  test('finds SAMA CSF citations', () => {
    const cited = extractCitedControls('Per SAMA CSF 3.3.5 the control applies.')
    const sama = cited.filter((c) => c.framework === 'SAMA-CSF').map((c) => c.code)
    assert.ok(sama.includes('3.3.5'))
  })

  test('finds NIST CSF categories', () => {
    const cited = extractCitedControls('Maps to PR.AA-05 and DE.CM.')
    const nist = cited.filter((c) => c.framework === 'NIST-CSF').map((c) => c.code)
    assert.ok(nist.includes('PR.AA'))
    assert.ok(nist.includes('DE.CM'))
  })

  test('finds article references for the legal instruments', () => {
    const cited = extractCitedControls(
      'GDPR Article 32 and AI Act Article 14 both apply, as does PDPL Article 19.'
    )
    assert.ok(cited.some((c) => c.framework === 'EU-GDPR' && c.code === 'ART-32'))
    assert.ok(cited.some((c) => c.framework === 'EU-AI-ACT' && c.code === 'ART-14'))
    assert.ok(cited.some((c) => c.framework === 'SA-PDPL' && c.code === 'ART-19'))
  })

  test('de-duplicates repeated citations', () => {
    const cited = extractCitedControls('A.5.15 appears here, and A.5.15 again later.')
    assert.equal(cited.filter((c) => c.code === 'A.5.15').length, 1)
  })

  test('does not invent citations from ordinary prose', () => {
    // A false citation asserts coverage the policy does not provide, which is
    // worse than missing one.
    const cited = extractCitedControls(
      'The policy was approved on 1.1 and revised in version 2 of the document.'
    )
    assert.deepEqual(cited, [])
  })

  test('is repeatable across calls despite the global regex flag', () => {
    const text = 'A.5.15 and A.8.24'
    assert.deepEqual(extractCitedControls(text), extractCitedControls(text))
  })

  test('rolls citations up into the framework list', () => {
    const result = assessPolicyCompleteness(COMPLETE_POLICY, REQUIRED)
    assert.ok(result.citedFrameworks.includes('ISO-27001'))
    assert.ok(result.citedFrameworks.includes('NCA-ECC'))
    assert.ok(result.citedFrameworks.includes('SAMA-CSF'))
    assert.ok(result.citedControls.length >= 5)
  })
})
