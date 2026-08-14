import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  classificationPriority,
  classifyAiSystem,
  type AiRiskRule,
  type AiSystemFacts,
} from '../lib/machine/classify-ai'

/**
 * A trimmed version of the rules seeded in
 * supabase/migrations/20260701001000_seed_templates_and_taxonomy.sql, keeping the
 * ordinals so first-match-wins precedence is exercised the same way.
 */
const RULES: AiRiskRule[] = [
  {
    code: 'EUAIA-P-SOCIAL-SCORING',
    regime: 'eu_ai_act',
    risk_tier: 'prohibited',
    title: 'Social scoring of natural persons',
    description: null,
    citation: 'Regulation (EU) 2024/1689, Article 5(1)(c)',
    match_keywords: ['social scoring', 'social credit'],
    required_flags: [],
    obligations: ['Do not place on the market or put into service'],
    ordinal: 10,
  },
  {
    code: 'EUAIA-P-EMOTION-WORK',
    regime: 'eu_ai_act',
    risk_tier: 'prohibited',
    title: 'Emotion inference in the workplace or education',
    description: null,
    citation: 'Regulation (EU) 2024/1689, Article 5(1)(f)',
    match_keywords: ['emotion recognition', 'emotion detection'],
    required_flags: [],
    obligations: ['Do not deploy in employment or education contexts'],
    ordinal: 11,
  },
  {
    code: 'EUAIA-H-BIOMETRICS',
    regime: 'eu_ai_act',
    risk_tier: 'high',
    title: 'Annex III(1) — Biometric identification and categorisation',
    description: null,
    citation: 'Regulation (EU) 2024/1689, Annex III(1)',
    match_keywords: ['biometric identification', 'facial recognition'],
    required_flags: ['processes_biometric_data'],
    obligations: ['Register in the EU database before putting into service'],
    ordinal: 20,
  },
  {
    code: 'EUAIA-H-EMPLOYMENT',
    regime: 'eu_ai_act',
    risk_tier: 'high',
    title: 'Annex III(4) — Employment and worker management',
    description: null,
    citation: 'Regulation (EU) 2024/1689, Annex III(4)',
    match_keywords: ['cv screening', 'candidate ranking', 'recruitment'],
    required_flags: [],
    obligations: [
      'Complete a fundamental rights impact assessment where Article 27 applies',
      'Inform workers and their representatives before putting into service',
    ],
    ordinal: 23,
  },
  {
    code: 'EUAIA-H-ESSENTIAL-SERVICES',
    regime: 'eu_ai_act',
    risk_tier: 'high',
    title: 'Annex III(5) — Access to essential services',
    description: null,
    citation: 'Regulation (EU) 2024/1689, Annex III(5)',
    match_keywords: ['credit scoring', 'creditworthiness', 'insurance pricing'],
    required_flags: [],
    obligations: ['Provide an explanation of the decision to the affected person'],
    ordinal: 24,
  },
  {
    code: 'EUAIA-GPAI',
    regime: 'eu_ai_act',
    risk_tier: 'gpai',
    title: 'Chapter V — General-purpose AI model',
    description: null,
    citation: 'Regulation (EU) 2024/1689, Article 53',
    match_keywords: [],
    required_flags: ['is_general_purpose'],
    obligations: ['Draw up technical documentation'],
    ordinal: 31,
  },
  {
    code: 'EUAIA-L-INTERACTION',
    regime: 'eu_ai_act',
    risk_tier: 'limited',
    title: 'Article 50 — Direct interaction with a natural person',
    description: null,
    citation: 'Regulation (EU) 2024/1689, Article 50(1)',
    match_keywords: ['chatbot', 'virtual assistant', 'conversational agent'],
    required_flags: [],
    obligations: ['Disclose AI interaction at the start of the exchange'],
    ordinal: 40,
  },
  {
    code: 'EUAIA-L-SYNTHETIC',
    regime: 'eu_ai_act',
    risk_tier: 'limited',
    title: 'Article 50 — Synthetic content and deepfakes',
    description: null,
    citation: 'Regulation (EU) 2024/1689, Article 50(2) and 50(4)',
    match_keywords: ['generative', 'image generation', 'deepfake'],
    required_flags: ['is_generative'],
    obligations: ['Mark output in a machine-readable format'],
    ordinal: 41,
  },
  {
    code: 'EUAIA-MINIMAL',
    regime: 'eu_ai_act',
    risk_tier: 'minimal',
    title: 'Minimal risk',
    description: null,
    citation: 'Regulation (EU) 2024/1689',
    match_keywords: [],
    required_flags: [],
    obligations: ['Maintain the system in the AI inventory'],
    ordinal: 99,
  },
  {
    code: 'SDAIA-HIGH',
    regime: 'sdaia',
    risk_tier: 'high',
    title: 'High risk under the SDAIA AI Ethics Principles',
    description: null,
    citation: 'SDAIA AI Ethics Principles v1.0',
    match_keywords: ['credit decision', 'recruitment', 'medical diagnosis'],
    required_flags: [],
    obligations: ['Maintain human oversight of consequential decisions'],
    ordinal: 20,
  },
  {
    code: 'SDAIA-LIMITED',
    regime: 'sdaia',
    risk_tier: 'limited',
    title: 'Limited risk under the SDAIA AI Ethics Principles',
    description: null,
    citation: 'SDAIA AI Ethics Principles v1.0',
    match_keywords: ['chatbot', 'content generation'],
    required_flags: [],
    obligations: ['Disclose AI use'],
    ordinal: 40,
  },
  {
    code: 'SDAIA-LOW',
    regime: 'sdaia',
    risk_tier: 'low',
    title: 'Low risk under the SDAIA AI Ethics Principles',
    description: null,
    citation: 'SDAIA AI Ethics Principles v1.0',
    match_keywords: [],
    required_flags: [],
    obligations: ['Record the system in the AI inventory'],
    ordinal: 99,
  },
]

function system(overrides: Partial<AiSystemFacts> = {}): AiSystemFacts {
  return {
    name: 'Test System',
    purpose: 'Internal document summarisation',
    eu_market_exposure: true,
    human_in_the_loop: true,
    ...overrides,
  }
}

describe('classifyAiSystem — tier selection', () => {
  test('a recruitment screening model is high-risk under Annex III(4)', () => {
    const result = classifyAiSystem(
      system({
        name: 'Talent Screener',
        purpose: 'CV screening and candidate ranking for open vacancies',
      }),
      RULES
    )

    assert.equal(result.euAiAct.tier, 'high')
    assert.equal(result.euAiAct.ruleCode, 'EUAIA-H-EMPLOYMENT')
    assert.match(result.euAiAct.citation ?? '', /Annex III\(4\)/)
    assert.ok(result.euAiAct.obligations.length > 0)
    assert.ok(!result.euAiAct.fallback)
  })

  test('the rationale names what triggered the classification', () => {
    const result = classifyAiSystem(
      system({ purpose: 'Credit scoring for retail lending decisions' }),
      RULES
    )
    assert.match(result.euAiAct.rationale, /credit scoring/)
    assert.deepEqual(result.euAiAct.matchedKeywords, ['credit scoring'])
  })

  test('a prohibited practice outranks a high-risk match', () => {
    // Mentions both social scoring (prohibited, ordinal 10) and credit scoring
    // (high, ordinal 24). Ordering must put the ban first.
    const result = classifyAiSystem(
      system({
        purpose: 'Social scoring of customers to inform credit scoring decisions',
      }),
      RULES
    )
    assert.equal(result.euAiAct.tier, 'prohibited')
  })

  test('a chatbot is transparency-only, not high-risk', () => {
    const result = classifyAiSystem(
      system({
        name: 'Support Assistant',
        purpose: 'Customer support chatbot for account queries',
        is_generative: true,
      }),
      RULES
    )
    assert.equal(result.euAiAct.tier, 'limited')
    assert.equal(result.sdaia.tier, 'limited')
  })

  test('flags alone can decide a tier when a rule declares no keywords', () => {
    const result = classifyAiSystem(
      system({ purpose: 'In-house foundation model', is_general_purpose: true }),
      RULES
    )
    assert.equal(result.euAiAct.tier, 'gpai')
  })

  test('a required flag that is unset blocks the match', () => {
    // Biometric wording, but the biometric data flag is false.
    const result = classifyAiSystem(
      system({
        purpose: 'Facial recognition research prototype',
        processes_biometric_data: false,
      }),
      RULES
    )
    assert.notEqual(result.euAiAct.ruleCode, 'EUAIA-H-BIOMETRICS')
  })

  test('the flag being set does allow the match', () => {
    const result = classifyAiSystem(
      system({
        purpose: 'Facial recognition for building entry',
        processes_biometric_data: true,
      }),
      RULES
    )
    assert.equal(result.euAiAct.tier, 'high')
    assert.equal(result.euAiAct.ruleCode, 'EUAIA-H-BIOMETRICS')
  })

  test('an unremarkable system falls back to the lowest tier of each regime', () => {
    const result = classifyAiSystem(
      system({ purpose: 'Forecasting warehouse stock levels' }),
      RULES
    )
    assert.equal(result.euAiAct.tier, 'minimal')
    assert.equal(result.sdaia.tier, 'low')
    assert.ok(result.euAiAct.fallback)
    assert.match(result.euAiAct.rationale, /Re-classify/)
  })

  test('the two regimes are classified independently', () => {
    const result = classifyAiSystem(
      system({ purpose: 'Medical diagnosis support for radiology' }),
      RULES
    )
    // SDAIA lists medical diagnosis; the trimmed EU rule set does not.
    assert.equal(result.sdaia.tier, 'high')
    assert.equal(result.euAiAct.tier, 'minimal')
  })
})

describe('classifyAiSystem — warnings', () => {
  test('warns when a high tier is recorded without EU market exposure', () => {
    const result = classifyAiSystem(
      system({ purpose: 'CV screening', eu_market_exposure: false }),
      RULES
    )
    assert.ok(
      result.warnings.some((w) => w.includes('no EU market exposure')),
      'must not present EU obligations as binding without exposure'
    )
  })

  test('warns when a high-risk system has no human in the loop', () => {
    const result = classifyAiSystem(
      system({ purpose: 'CV screening', human_in_the_loop: false }),
      RULES
    )
    assert.ok(result.warnings.some((w) => w.includes('Article 14')))
  })

  test('warns on fully automated decisions with no human involvement', () => {
    const result = classifyAiSystem(
      system({
        purpose: 'Automated benefit eligibility',
        makes_automated_decisions: true,
        human_in_the_loop: false,
      }),
      RULES
    )
    assert.ok(result.warnings.some((w) => w.includes('Article 22')))
  })

  test('warns on contradictory data flags', () => {
    const result = classifyAiSystem(
      system({
        processes_special_category: true,
        processes_personal_data: false,
      }),
      RULES
    )
    assert.ok(result.warnings.some((w) => w.includes('One of the two flags is wrong')))
  })

  test('a clean minimal-risk system produces no warnings', () => {
    const result = classifyAiSystem(
      system({ purpose: 'Forecasting warehouse stock levels' }),
      RULES
    )
    assert.deepEqual(result.warnings, [])
  })
})

describe('classifyAiSystem — robustness', () => {
  test('an empty rule set falls back without throwing', () => {
    const result = classifyAiSystem(system(), [])
    assert.equal(result.euAiAct.tier, 'minimal')
    assert.equal(result.euAiAct.ruleCode, null)
  })

  test('matching is case insensitive', () => {
    const result = classifyAiSystem(
      system({ purpose: 'CREDIT SCORING for SME lending' }),
      RULES
    )
    assert.equal(result.euAiAct.tier, 'high')
  })
})

describe('classificationPriority', () => {
  test('orders tiers so prohibited escalates above everything', () => {
    assert.ok(classificationPriority('prohibited') > classificationPriority('high'))
    assert.ok(classificationPriority('unacceptable') > classificationPriority('high'))
    assert.ok(classificationPriority('high') > classificationPriority('gpai'))
    assert.ok(classificationPriority('gpai') > classificationPriority('limited'))
    assert.ok(classificationPriority('limited') > classificationPriority('minimal'))
    assert.equal(classificationPriority(null), 0)
  })
})
