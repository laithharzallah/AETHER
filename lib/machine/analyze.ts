/**
 * Model-assisted document analysis.
 *
 * Wraps the deterministic analysis in ./analyze-heuristic with an Anthropic
 * tool-use call. Two properties matter more than the extraction quality itself:
 *
 *  - The model never picks its own labels. Framework codes are intersected with
 *    the real catalogue and topics with the closed vocabulary, so a
 *    plausible-looking invention cannot enter the correlation graph and silently
 *    misdirect a tenant's attention.
 *
 *  - The heuristic result is a floor, not a fallback of last resort. Where the
 *    model omits something the patterns found, the pattern result is kept, and if
 *    the call fails the pipeline degrades to heuristics rather than stopping.
 *
 * `risk_signals.analysis_method` records which path produced each signal, so
 * nothing downstream has to take the provenance on trust.
 */

import Anthropic from '@anthropic-ai/sdk'
import { anthropic, hasAnthropicKey, MODELS } from '@/lib/anthropic'
import { normalizeTopics, type Topic } from './topics'
import {
  analyzeHeuristic,
  VALID_CATEGORIES,
  VALID_SEVERITIES,
  type AnalysisInput,
  type AnalyzedSignal,
  type SignalCategory,
} from './analyze-heuristic'
import type { SignalSeverity } from './relevance'

export { analyzeHeuristic }
export type { AnalysisInput, AnalyzedSignal, SignalCategory }

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'record_signal',
  description:
    'Record the structured assessment of a regulatory or security document for a GRC platform serving GCC enterprises.',
  input_schema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: [...VALID_CATEGORIES],
        description: 'What kind of document this is.',
      },
      severity: {
        type: 'string',
        enum: [...VALID_SEVERITIES],
        description:
          'How consequential this is for an affected organisation. Reserve critical for immediate mandatory action or active exploitation.',
      },
      summary: {
        type: 'string',
        description:
          'Two or three sentences stating what changed and who it applies to. No preamble.',
      },
      impact_analysis: {
        type: 'string',
        description:
          'What an affected organisation must actually do differently as a result. Be concrete.',
      },
      recommended_action: {
        type: 'string',
        description: 'The single most useful next step for a compliance team.',
      },
      countries: {
        type: 'array',
        items: { type: 'string' },
        description:
          'ISO 3166-1 alpha-2 codes for affected jurisdictions. Use EU for European Union instruments and GLOBAL for international standards.',
      },
      sectors: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Affected sectors in snake_case, e.g. banking, insurance, healthcare, telecom, energy. Use ["all"] if not sector-specific.',
      },
      framework_codes: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Codes of the frameworks this affects, from the list given in the prompt. Omit any you are not confident about.',
      },
      control_codes: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Specific control identifiers the document actually names, e.g. "ISO-27001:A.8.15" or "NCA-ECC:2-12".',
      },
      topics: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Control areas affected, from the topic vocabulary given in the prompt. Nothing outside that list.',
      },
      effective_date: {
        type: 'string',
        description: 'ISO date (YYYY-MM-DD) the change takes effect, if stated. Omit otherwise.',
      },
      deadline_date: {
        type: 'string',
        description:
          'ISO date (YYYY-MM-DD) by which affected organisations must comply, if stated. Omit if the duty is triggered by an event rather than a date.',
      },
      confidence: {
        type: 'number',
        description:
          'Your confidence in this assessment, 0 to 1. Be honest: a short news blurb warrants a low value.',
      },
    },
    required: ['category', 'severity', 'summary', 'countries', 'sectors', 'topics', 'confidence'],
  },
}

function buildAnalysisPrompt(
  input: AnalysisInput,
  knownFrameworks: readonly string[],
  vocabulary: readonly string[]
): string {
  const body = (input.content ?? input.summary ?? '').slice(0, 24_000)

  return `Assess the following document.

Source: ${input.source.name}${input.source.regulator ? ` (${input.source.regulator})` : ''}
Source type: ${input.source.type}
Source jurisdiction: ${input.source.country ?? 'unspecified'}
Authority tier: ${input.source.authorityTier} (1 = the regulator itself and binding, 2 = national agency guidance, 3 = commentary)
Published: ${input.publishedAt ?? 'unknown'}
URL: ${input.url ?? 'unknown'}

Title: ${input.title}

Body:
${body || '(no body text was retrieved; assess from the title and source alone, and set confidence low)'}

---

Framework codes you may use (these exact strings, and only these):
${knownFrameworks.join(', ')}

Topic vocabulary you may use (these exact strings, and only these):
${vocabulary.join(', ')}

Guidance:
- If the document does not actually change an obligation, say so in the summary and choose the category that fits (guidance, consultation).
- Do not infer a compliance deadline that is not stated. A duty triggered by an event, for example "within 72 hours of becoming aware", has no deadline date.
- Prefer omitting a framework code to guessing one.
- Set confidence low when the body text is thin.

Call record_signal exactly once.`
}

function normalizeSeverity(value: unknown, fallback: SignalSeverity): SignalSeverity {
  return typeof value === 'string' && VALID_SEVERITIES.has(value)
    ? (value as SignalSeverity)
    : fallback
}

function normalizeCategory(value: unknown, fallback: SignalCategory): SignalCategory {
  return typeof value === 'string' && VALID_CATEGORIES.has(value)
    ? (value as SignalCategory)
    : fallback
}

function normalizeStringArray(value: unknown, limit = 32): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter(Boolean)
    ),
  ].slice(0, limit)
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim())
  if (!match) return null
  const parsed = new Date(`${match[1]}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : match[1]
}

function unionPreferring<T>(preferred: readonly T[], fallback: readonly T[]): T[] {
  return [...new Set([...preferred, ...fallback])]
}

/**
 * Reconciles model output against the heuristic reading and the closed
 * vocabularies. Exported for tests: this is where a hallucinated framework code
 * has to be dropped, and that behaviour is worth pinning.
 */
export function mergeAnalyses(
  llm: Record<string, unknown>,
  heuristic: AnalyzedSignal,
  knownFrameworks: ReadonlySet<string>,
  model: string
): AnalyzedSignal {
  const llmFrameworks = normalizeStringArray(llm.framework_codes).filter((code) =>
    knownFrameworks.has(code)
  )
  const llmTopics = normalizeTopics(normalizeStringArray(llm.topics))

  const summary =
    typeof llm.summary === 'string' && llm.summary.trim().length > 20
      ? llm.summary.trim().slice(0, 2000)
      : heuristic.summary

  const rawConfidence = typeof llm.confidence === 'number' ? llm.confidence : 0.6

  return {
    category: normalizeCategory(llm.category, heuristic.category),
    severity: normalizeSeverity(llm.severity, heuristic.severity),
    summary,
    impactAnalysis:
      typeof llm.impact_analysis === 'string' && llm.impact_analysis.trim()
        ? llm.impact_analysis.trim().slice(0, 4000)
        : null,
    recommendedAction:
      typeof llm.recommended_action === 'string' && llm.recommended_action.trim()
        ? llm.recommended_action.trim().slice(0, 2000)
        : heuristic.recommendedAction,
    countries: unionPreferring(normalizeStringArray(llm.countries), heuristic.countries),
    sectors: unionPreferring(normalizeStringArray(llm.sectors), heuristic.sectors),
    frameworkCodes: unionPreferring(llmFrameworks, heuristic.frameworkCodes),
    controlCodes: normalizeStringArray(llm.control_codes),
    topics: unionPreferring(llmTopics, heuristic.topics) as Topic[],
    effectiveDate: normalizeIsoDate(llm.effective_date),
    deadlineDate: normalizeIsoDate(llm.deadline_date) ?? heuristic.deadlineDate,
    confidence: Number(Math.min(0.98, Math.max(0.1, rawConfidence)).toFixed(2)),
    method: 'llm',
    model,
  }
}

export async function analyzeWithModel(
  input: AnalysisInput,
  knownFrameworkCodes: readonly string[],
  vocabulary: readonly string[]
): Promise<AnalyzedSignal> {
  const heuristic = analyzeHeuristic(input)

  if (!hasAnthropicKey()) return heuristic

  try {
    const response = await anthropic.messages.create({
      model: MODELS.HAIKU,
      max_tokens: 2048,
      system:
        'You are a GRC analyst covering GCC regulators (NCA, SAMA, SDAIA, QCB, NCSA, CBUAE, TDRA, CBJ, CITRA, CBB) and the international frameworks GCC enterprises are mapped against. You are precise about what a document does and does not require, and you never invent a citation or a deadline.',
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: 'record_signal' },
      messages: [
        {
          role: 'user',
          content: buildAnalysisPrompt(input, knownFrameworkCodes, vocabulary),
        },
      ],
    })

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )

    if (!toolUse || typeof toolUse.input !== 'object' || toolUse.input === null) {
      return heuristic
    }

    return mergeAnalyses(
      toolUse.input as Record<string, unknown>,
      heuristic,
      new Set(knownFrameworkCodes),
      MODELS.HAIKU
    )
  } catch (error) {
    // Degrading to heuristics is not a pipeline failure: a signal with a
    // conservative severity beats no signal at all.
    console.error('[machine/analyze] model call failed, using heuristics', error)
    return heuristic
  }
}
