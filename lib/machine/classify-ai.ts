/**
 * AI system risk tiering against the EU AI Act and the SDAIA AI Ethics
 * Principles.
 *
 * The rules live in `ai_classification_rules` rather than in this file. That is
 * deliberate: an organisation being told its recruitment model is high-risk will
 * ask which provision says so, and a rule row carries the citation, the matching
 * criteria and the resulting obligations together. Updating a tier when the
 * Commission publishes guidance is then a data change, not a deploy.
 *
 * Pure and synchronous — the caller loads the rules and passes them in.
 */

export type AiRiskRule = {
  code: string
  regime: string
  risk_tier: string
  title: string
  description: string | null
  citation: string | null
  match_keywords: string[]
  required_flags: string[]
  obligations: string[]
  ordinal: number
}

/**
 * The subset of an `ai_systems` row the classifier reads. Flag names match
 * `ai_classification_rules.required_flags` exactly, so a rule can name any of
 * them without a translation layer.
 */
export type AiSystemFacts = {
  name: string
  purpose: string
  description?: string | null
  deployment_context?: string | null
  business_function?: string | null
  role?: string | null
  eu_market_exposure?: boolean | null

  is_generative?: boolean | null
  is_general_purpose?: boolean | null
  processes_personal_data?: boolean | null
  processes_special_category?: boolean | null
  processes_biometric_data?: boolean | null
  makes_automated_decisions?: boolean | null
  affects_legal_rights?: boolean | null
  human_in_the_loop?: boolean | null
  publicly_accessible?: boolean | null
  used_in_critical_infrastructure?: boolean | null
}

export type Classification = {
  regime: string
  tier: string | null
  ruleCode: string | null
  title: string | null
  citation: string | null
  obligations: string[]
  rationale: string
  matchedKeywords: string[]
  /** True when no rule matched and the regime's fallback tier was used. */
  fallback: boolean
}

export type ClassificationResult = {
  euAiAct: Classification
  sdaia: Classification
  /** Anything that materially changes the answer but is not recorded yet. */
  warnings: string[]
}

const FLAG_LABELS: Record<string, string> = {
  is_generative: 'generates content',
  is_general_purpose: 'is a general-purpose model',
  processes_personal_data: 'processes personal data',
  processes_special_category: 'processes special category data',
  processes_biometric_data: 'processes biometric data',
  makes_automated_decisions: 'makes automated decisions',
  affects_legal_rights: 'affects legal rights',
  publicly_accessible: 'is publicly accessible',
  used_in_critical_infrastructure: 'is used in critical infrastructure',
}

function searchText(system: AiSystemFacts): string {
  return [
    system.name,
    system.purpose,
    system.description,
    system.deployment_context,
    system.business_function,
  ]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join('\n')
    .toLowerCase()
}

function flagValue(system: AiSystemFacts, flag: string): boolean {
  return Boolean((system as unknown as Record<string, unknown>)[flag])
}

/**
 * A rule matches when every one of its `required_flags` is set, and — if it lists
 * keywords — at least one appears in the system's description. Rules with neither
 * keywords nor flags are fallbacks and never match here.
 */
function matchRule(
  rule: AiRiskRule,
  system: AiSystemFacts,
  haystack: string
): { matched: boolean; keywords: string[] } {
  const flagsSatisfied = rule.required_flags.every((flag) => flagValue(system, flag))
  if (!flagsSatisfied) return { matched: false, keywords: [] }

  if (rule.match_keywords.length === 0) {
    // No keywords: flags alone decide, but only if there was at least one flag.
    return { matched: rule.required_flags.length > 0, keywords: [] }
  }

  const keywords = rule.match_keywords.filter((keyword) =>
    haystack.includes(keyword.toLowerCase())
  )
  return { matched: keywords.length > 0, keywords }
}

function classifyRegime(
  regime: string,
  rules: readonly AiRiskRule[],
  system: AiSystemFacts,
  haystack: string,
  fallbackTier: string
): Classification {
  const candidates = rules
    .filter((rule) => rule.regime === regime)
    .sort((a, b) => a.ordinal - b.ordinal)

  for (const rule of candidates) {
    const { matched, keywords } = matchRule(rule, system, haystack)
    if (!matched) continue

    const reasons: string[] = []
    if (keywords.length > 0) {
      reasons.push(`the stated purpose mentions ${keywords.map((k) => `"${k}"`).join(', ')}`)
    }
    for (const flag of rule.required_flags) {
      reasons.push(`the system ${FLAG_LABELS[flag] ?? flag.replace(/_/g, ' ')}`)
    }

    return {
      regime,
      tier: rule.risk_tier,
      ruleCode: rule.code,
      title: rule.title,
      citation: rule.citation,
      obligations: rule.obligations,
      rationale: `Classified ${rule.risk_tier} under ${rule.title} because ${reasons.join(' and ')}.`,
      matchedKeywords: keywords,
      fallback: false,
    }
  }

  const fallback = candidates.find((rule) => rule.risk_tier === fallbackTier)

  return {
    regime,
    tier: fallbackTier,
    ruleCode: fallback?.code ?? null,
    title: fallback?.title ?? null,
    citation: fallback?.citation ?? null,
    obligations: fallback?.obligations ?? [],
    rationale: `No higher-tier rule matched, so the system falls to ${fallbackTier} risk. Re-classify if its purpose or deployment context changes.`,
    matchedKeywords: [],
    fallback: true,
  }
}

export function classifyAiSystem(
  system: AiSystemFacts,
  rules: readonly AiRiskRule[]
): ClassificationResult {
  const haystack = searchText(system)

  const euAiAct = classifyRegime('eu_ai_act', rules, system, haystack, 'minimal')
  const sdaia = classifyRegime('sdaia', rules, system, haystack, 'low')

  const warnings: string[] = []

  // The AI Act only bites where there is EU market exposure. Say so rather than
  // quietly reporting a tier the organisation may not actually be subject to.
  if (!system.eu_market_exposure && euAiAct.tier !== 'minimal') {
    warnings.push(
      `EU AI Act tier "${euAiAct.tier}" is recorded, but no EU market exposure is flagged for this system. Confirm whether it is placed on the EU market or its output is used in the EU before treating the obligations as binding.`
    )
  }

  if (euAiAct.tier === 'high' && system.human_in_the_loop === false) {
    warnings.push(
      'Article 14 requires effective human oversight of high-risk systems, but no human is in the loop for this one.'
    )
  }

  if (system.makes_automated_decisions && system.human_in_the_loop === false) {
    warnings.push(
      'Fully automated decisions with no human involvement engage GDPR Article 22 and the equivalent GCC provisions where personal data is involved.'
    )
  }

  if (system.processes_special_category && !system.processes_personal_data) {
    warnings.push(
      'Special category data is flagged but personal data is not. One of the two flags is wrong.'
    )
  }

  if (system.is_general_purpose && system.role === 'provider') {
    warnings.push(
      'As the provider of a general-purpose AI model, the Chapter V obligations apply directly rather than through a downstream deployer.'
    )
  }

  return { euAiAct, sdaia, warnings }
}

/**
 * The tier a directive should escalate on: prohibited beats high beats the rest.
 */
export function classificationPriority(tier: string | null): number {
  switch (tier) {
    case 'prohibited':
    case 'unacceptable':
      return 4
    case 'high':
      return 3
    case 'gpai_systemic':
      return 3
    case 'gpai':
      return 2
    case 'limited':
      return 1
    default:
      return 0
  }
}
