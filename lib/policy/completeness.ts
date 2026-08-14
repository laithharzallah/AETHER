/**
 * Scores a policy document against the sections its template requires, and
 * extracts the framework controls it cites.
 *
 * A generated policy that reads well but omits Document Control or never cites a
 * control identifier will fail an assessment, and the person who generated it has
 * no way to know that by reading it. This turns "looks thorough" into a
 * checkable claim, and produces the control list that
 * `policy_control_coverage` needs so a policy can be tied back to the
 * obligations it actually discharges.
 *
 * Pure and dependency-free. Tested in tests/policy-completeness.test.ts.
 */

export type RequiredSection = {
  heading: string
  guidance?: string
}

export type SectionAssessment = {
  heading: string
  present: boolean
  /** Heading text as it actually appears in the document, when found. */
  matchedAs: string | null
  /** Words of body text under the heading. */
  wordCount: number
  /** Present but too thin to be meaningful. */
  thin: boolean
}

export type PolicyCompleteness = {
  /** 0-100. Thin sections count for half. */
  score: number
  sections: SectionAssessment[]
  missingSections: string[]
  thinSections: string[]
  extraSections: string[]
  citedControls: CitedControl[]
  citedFrameworks: string[]
  wordCount: number
  warnings: string[]
}

export type CitedControl = {
  /** Framework code where it could be determined, e.g. `ISO-27001`. */
  framework: string | null
  /** Control identifier as written, e.g. `A.8.15`. */
  code: string
  raw: string
}

/**
 * Fewer words than this under a heading is a placeholder rather than a section.
 *
 * Set low on purpose. Some legitimate sections are genuinely terse — a Document
 * Control block is a short table, and a Review Cycle clause can be one sentence —
 * so a higher bar flags well-formed policies as incomplete and trains people to
 * ignore the score. This catches "TBD" and "annual", not brevity.
 */
const THIN_SECTION_WORDS = 15

type ParsedSection = {
  heading: string
  normalized: string
  body: string
}

function normalizeHeading(text: string): string {
  return text
    .toLowerCase()
    // Drop leading numbering: "4.", "4.1", "IV.", "(a)".
    .replace(/^[\s]*(?:\(?[ivxlcdm]+\)?[.)]|\d+(?:\.\d+)*[.)]?|\(?[a-z]\)) */i, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Splits Markdown into sections at ATX (`##`) and Setext (`===`) headings. */
export function parseSections(markdown: string): ParsedSection[] {
  const lines = markdown.split(/\r?\n/)
  const sections: ParsedSection[] = []

  let currentHeading: string | null = null
  let buffer: string[] = []

  const flush = () => {
    if (currentHeading === null) return
    sections.push({
      heading: currentHeading,
      normalized: normalizeHeading(currentHeading),
      body: buffer.join('\n').trim(),
    })
    buffer = []
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]

    const atx = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (atx) {
      flush()
      currentHeading = atx[2].trim()
      continue
    }

    // Setext: a line of text underlined by === or ---.
    const next = lines[i + 1]
    if (
      next !== undefined &&
      line.trim().length > 0 &&
      /^\s{0,3}(={2,}|-{2,})\s*$/.test(next) &&
      // A table separator row also matches ---; a heading candidate must not
      // look like table markup.
      !line.includes('|')
    ) {
      flush()
      currentHeading = line.trim()
      i += 1
      continue
    }

    // Bold-only line used as a pseudo-heading, which models produce often enough
    // to be worth recognising rather than penalising.
    const bold = /^\s*\*\*(.+?)\*\*\s*:?\s*$/.exec(line)
    if (bold && bold[1].length < 80) {
      flush()
      currentHeading = bold[1].trim()
      continue
    }

    if (currentHeading !== null) buffer.push(line)
  }

  flush()
  return sections
}

function countWords(text: string): number {
  const stripped = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[|:\-*#>_]/g, ' ')
    .trim()
  if (!stripped) return 0
  return stripped.split(/\s+/).filter(Boolean).length
}

/**
 * Matches a required heading against what the document actually contains.
 *
 * Exact normalised equality first, then containment either way, then a token
 * overlap threshold. Models rarely reproduce a heading verbatim — "Roles and
 * Responsibilities" comes back as "5. Roles & Responsibilities" — and marking
 * that missing would make the score useless.
 */
function findSection(
  required: string,
  sections: ParsedSection[]
): ParsedSection | null {
  const target = normalizeHeading(required)
  if (!target) return null

  const exact = sections.find((s) => s.normalized === target)
  if (exact) return exact

  const contained = sections.find(
    (s) => s.normalized.includes(target) || target.includes(s.normalized)
  )
  if (contained) return contained

  const targetTokens = target.split(' ').filter((t) => t.length > 3)
  if (targetTokens.length === 0) return null

  let best: { section: ParsedSection; overlap: number } | null = null
  for (const section of sections) {
    const tokens = new Set(section.normalized.split(' '))
    const overlap =
      targetTokens.filter((token) => tokens.has(token)).length / targetTokens.length
    if (overlap >= 0.6 && (!best || overlap > best.overlap)) {
      best = { section, overlap }
    }
  }

  return best?.section ?? null
}

/**
 * Control citations.
 *
 * Recognises the shapes that actually appear in GCC policy documents: ISO Annex A
 * (`A.8.15`), NCA ECC (`2-12` / `ECC 2-12`), SAMA CSF (`3.3.5`), NIST CSF
 * (`PR.AA`), PCI DSS (`Requirement 10`), and article references. Deliberately
 * conservative: a false citation is worse than a missed one, because it would
 * assert coverage the policy does not provide.
 */
const CITATION_PATTERNS: ReadonlyArray<{
  framework: string | null
  pattern: RegExp
  normalize?: (match: RegExpExecArray) => string
}> = [
  {
    framework: 'ISO-27001',
    pattern: /\bA\.(\d{1,2})\.(\d{1,2})\b/g,
    normalize: (m) => `A.${m[1]}.${m[2]}`,
  },
  {
    framework: 'NCA-ECC',
    pattern: /\bECC[\s-]*(\d)-(\d{1,2})(?:-(\d{1,2}))?\b/gi,
    normalize: (m) => (m[3] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}`),
  },
  {
    framework: 'SAMA-CSF',
    pattern: /\bSAMA[^.\n]{0,20}?(\d\.\d(?:\.\d{1,2})?)\b/gi,
    normalize: (m) => m[1],
  },
  {
    framework: 'NIST-CSF',
    pattern: /\b(GV|ID|PR|DE|RS|RC)\.([A-Z]{2})(?:-(\d{1,2}))?\b/g,
    normalize: (m) => `${m[1]}.${m[2]}`,
  },
  {
    framework: 'PCI-DSS',
    pattern: /\bPCI[\s-]*DSS[^.\n]{0,20}?Requirement\s+(\d{1,2})\b/gi,
    normalize: (m) => `R${m[1]}`,
  },
  {
    framework: 'EU-GDPR',
    pattern: /\bGDPR[^.\n]{0,20}?Article\s+(\d{1,2})\b/gi,
    normalize: (m) => `ART-${m[1]}`,
  },
  {
    framework: 'EU-AI-ACT',
    pattern: /\bAI Act[^.\n]{0,20}?Article\s+(\d{1,2})\b/gi,
    normalize: (m) => `ART-${m[1]}`,
  },
  {
    framework: 'SA-PDPL',
    pattern: /\bPDPL[^.\n]{0,20}?Article\s+(\d{1,2})\b/gi,
    normalize: (m) => `ART-${m[1]}`,
  },
]

export function extractCitedControls(markdown: string): CitedControl[] {
  const found = new Map<string, CitedControl>()

  for (const { framework, pattern, normalize } of CITATION_PATTERNS) {
    // Fresh regex per call: the shared `g` flag carries lastIndex between runs.
    const regex = new RegExp(pattern.source, pattern.flags)
    let match: RegExpExecArray | null

    while ((match = regex.exec(markdown)) !== null) {
      const code = normalize ? normalize(match) : match[0]
      const key = `${framework ?? '?'}:${code}`
      if (!found.has(key)) {
        found.set(key, { framework, code, raw: match[0].trim() })
      }
    }
  }

  return [...found.values()]
}

export function assessPolicyCompleteness(
  markdown: string,
  requiredSections: readonly RequiredSection[]
): PolicyCompleteness {
  const sections = parseSections(markdown)
  const wordCount = countWords(markdown)

  const assessments: SectionAssessment[] = []
  const consumed = new Set<ParsedSection>()

  for (const required of requiredSections) {
    const found = findSection(required.heading, sections)
    if (found) consumed.add(found)

    const bodyWords = found ? countWords(found.body) : 0

    assessments.push({
      heading: required.heading,
      present: Boolean(found),
      matchedAs: found?.heading ?? null,
      wordCount: bodyWords,
      thin: Boolean(found) && bodyWords < THIN_SECTION_WORDS,
    })
  }

  const missingSections = assessments.filter((a) => !a.present).map((a) => a.heading)
  const thinSections = assessments.filter((a) => a.thin).map((a) => a.heading)
  // Only headings that actually carry content count as extra sections. This keeps
  // the document's own H1 title, which has no body of its own, out of the list.
  const extraSections = sections
    .filter((s) => !consumed.has(s) && s.normalized.length > 0 && countWords(s.body) > 0)
    .map((s) => s.heading)

  // A present-but-empty section is not compliance, so it earns half credit.
  const earned = assessments.reduce(
    (sum, a) => sum + (a.present ? (a.thin ? 0.5 : 1) : 0),
    0
  )
  const score =
    requiredSections.length === 0
      ? 100
      : Math.round((earned / requiredSections.length) * 100)

  const citedControls = extractCitedControls(markdown)
  const citedFrameworks = [
    ...new Set(
      citedControls
        .map((c) => c.framework)
        .filter((f): f is string => typeof f === 'string')
    ),
  ]

  const warnings: string[] = []
  if (missingSections.length > 0) {
    warnings.push(
      `Missing required section(s): ${missingSections.join(', ')}. An assessor will treat each as a gap.`
    )
  }
  if (thinSections.length > 0) {
    warnings.push(
      `Present but too brief to be auditable: ${thinSections.join(', ')}.`
    )
  }
  if (citedControls.length === 0) {
    warnings.push(
      'No framework control identifiers are cited. Without them the policy cannot be mapped to the obligations it is meant to discharge.'
    )
  }
  if (wordCount < 400) {
    warnings.push(
      `The document is only ${wordCount} words. Board-grade policies are rarely defensible at that length.`
    )
  }

  return {
    score,
    sections: assessments,
    missingSections,
    thinSections,
    extraSections,
    citedControls,
    citedFrameworks,
    wordCount,
    warnings,
  }
}
