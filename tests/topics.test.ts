import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  TOPICS,
  extractCountries,
  extractFrameworkCodes,
  extractTopics,
  isTopic,
  normalizeTopics,
} from '../lib/machine/topics'

describe('topic vocabulary', () => {
  test('has no duplicates', () => {
    assert.equal(new Set(TOPICS).size, TOPICS.length)
  })

  test('membership check is exact', () => {
    assert.ok(isTopic('access_control'))
    assert.ok(!isTopic('access control'))
    assert.ok(!isTopic('made_up_topic'))
  })
})

describe('normalizeTopics', () => {
  test('normalises separators and casing', () => {
    assert.deepEqual(normalizeTopics(['Access Control', 'ACCESS-CONTROL']), [
      'access_control',
    ])
  })

  test('drops anything outside the vocabulary', () => {
    // This is the guard that stops a model inventing a label that would then
    // never match a control tag.
    assert.deepEqual(normalizeTopics(['access_control', 'cyber_stuff', '']), [
      'access_control',
    ])
  })
})

describe('extractTopics', () => {
  test('recognises multi-factor authentication', () => {
    const topics = extractTopics(
      'Circular requiring multi-factor authentication for all privileged access'
    )
    assert.ok(topics.includes('authentication'))
    assert.ok(topics.includes('privileged_access'))
  })

  test('recognises breach notification clocks', () => {
    const topics = extractTopics(
      'Controllers must notify the supervisory authority within 72 hours of becoming aware of a personal data breach.'
    )
    assert.ok(topics.includes('breach_notification'))
    assert.ok(topics.includes('privacy'))
  })

  test('recognises AI governance language', () => {
    const topics = extractTopics(
      'Guidance on human oversight and explainability for high-risk AI systems, including deepfake disclosure.'
    )
    assert.ok(topics.includes('human_oversight'))
    assert.ok(topics.includes('explainability'))
    assert.ok(topics.includes('deepfake'))
    assert.ok(topics.includes('ai_risk_assessment'))
  })

  test('recognises cloud and data residency', () => {
    const topics = extractTopics(
      'Updated cloud computing controls covering data residency for regulated workloads.'
    )
    assert.ok(topics.includes('cloud'))
  })

  test('does not fire on the bare word "access"', () => {
    // "access" alone appears in nearly every regulatory document; tagging on it
    // would make every signal look like an access-control change.
    const topics = extractTopics('Members of the public may access the register.')
    assert.ok(!topics.includes('access_control'))
  })

  test('returns nothing for empty input rather than throwing', () => {
    assert.deepEqual(extractTopics(), [])
    assert.deepEqual(extractTopics(null, undefined, ''), [])
  })

  test('only ever returns vocabulary members', () => {
    const topics = extractTopics(
      'Encryption, backup, penetration testing, ransomware, SCADA, cardholder data, DMARC, BYOD.'
    )
    assert.ok(topics.length > 0)
    for (const topic of topics) {
      assert.ok(isTopic(topic), `${topic} is not in the vocabulary`)
    }
  })
})

describe('extractFrameworkCodes', () => {
  test('identifies GCC regulators by name', () => {
    assert.ok(
      extractFrameworkCodes('The Saudi Central Bank (SAMA) issued a circular').includes(
        'SAMA-CSF'
      )
    )
    assert.ok(
      extractFrameworkCodes('NCA published an update to the Essential Cybersecurity Controls').includes(
        'NCA-ECC'
      )
    )
    assert.ok(
      extractFrameworkCodes('Qatar Central Bank technology risk circular').includes(
        'QCB-TRC'
      )
    )
  })

  test('identifies international frameworks', () => {
    const codes = extractFrameworkCodes(
      'Alignment between ISO/IEC 27001 and the NIST Cybersecurity Framework, plus PCI DSS v4.'
    )
    assert.ok(codes.includes('ISO-27001'))
    assert.ok(codes.includes('NIST-CSF'))
    assert.ok(codes.includes('PCI-DSS'))
  })

  test('identifies EU instruments', () => {
    const codes = extractFrameworkCodes(
      'Regulation (EU) 2024/1689 (the AI Act) and DORA both apply from 2025.'
    )
    assert.ok(codes.includes('EU-AI-ACT'))
    assert.ok(codes.includes('EU-DORA'))
  })

  test('returns nothing for unrelated text', () => {
    assert.deepEqual(extractFrameworkCodes('The weather in Riyadh is hot.'), [])
  })
})

describe('extractCountries', () => {
  test('maps regulators to their jurisdictions', () => {
    assert.ok(extractCountries('SAMA circular').includes('SA'))
    assert.ok(extractCountries('NCSA advisory in Doha, Qatar').includes('QA'))
    assert.ok(extractCountries('CBUAE notice for banks in Dubai').includes('AE'))
    assert.ok(extractCountries('Central Bank of Jordan instruction').includes('JO'))
  })

  test('recognises the EU and international scope', () => {
    assert.ok(extractCountries('European Commission guidance').includes('EU'))
    assert.ok(extractCountries('ISO/IEC 27001 revision').includes('GLOBAL'))
  })
})
