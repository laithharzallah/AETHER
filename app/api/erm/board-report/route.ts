import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODELS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { getBoardAggregate } from '@/lib/erm/queries'
import {
  APPETITE_LEVEL_LABEL,
  IMPACT_LABEL,
  LIKELIHOOD_LABEL,
  RISK_BAND_LABEL,
  RISK_STATUS_LABEL,
  TREATMENT_STRATEGY_LABEL,
  VELOCITY_LABEL,
  bandForScore,
  type AppetiteLevel,
  type RiskStatus,
  type TreatmentStrategy,
} from '@/lib/erm/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Render/nginx may buffer until ~4KB; pad early so tokens stream to the browser.
const STREAM_PAD = '<!-- stream-pad -->\n'.repeat(180)

const SYSTEM_PROMPT = `You are the head of enterprise risk management for a GCC group, drafting the risk section of a board pack. Your reader is the board risk committee and, through it, the full board — which under the CMA Corporate Governance Regulations is responsible for overseeing the risk management system and for approving the risk appetite. For a SAMA-supervised entity the same paper serves the supervisory expectation that the board sets and monitors risk appetite and receives regular risk reporting.

You write in ISO 31000:2018 and COSO ERM 2017 vocabulary, precisely and without inflation:
- Risk is the effect of uncertainty on objectives.
- You distinguish inherent, residual and target risk, and never use them loosely.
- Appetite is set by the board; tolerance is the acceptable variation around it, expressed here as a residual score threshold.
- Velocity is the speed to consequence, not the likelihood.
- You report the portfolio view, not a list of individual worries.

Style rules:
- Board register: short paragraphs, plain sentences, no consultant filler, no adjectives that do not carry information.
- Every number you state comes from the data supplied. You never invent a figure, a date, an owner or a risk that is not in the data.
- Where the data is thin or missing, you say so plainly and name it as a reporting gap rather than papering over it.
- Currency is Saudi riyals (SAR).
- Output is clean Markdown, starting at heading level 2. No preamble, no closing pleasantries.`

type ReportRequest = {
  periodLabel?: string
  entityName?: string
  notes?: string
}

function fmtScore(l: number | null, i: number | null, score: number | null): string {
  if (!l || !i || !score) return 'not assessed'
  const band = bandForScore(score)
  return `${l}×${i}=${score} (${band ? RISK_BAND_LABEL[band] : '—'})`
}

function buildDataBlock(board: Awaited<ReturnType<typeof getBoardAggregate>>): string {
  const t = board.totals
  const lines: string[] = []

  lines.push('## PORTFOLIO TOTALS')
  lines.push(
    `Total risks on the register: ${t.risks} (${t.open} open, ${t.risks - t.open} closed)`
  )
  lines.push(
    `Residual band distribution (open risks): Extreme ${board.byBand.extreme}, High ${board.byBand.high}, Moderate ${board.byBand.moderate}, Low ${board.byBand.low}`
  )
  lines.push(`Risks outside appetite: ${t.outsideAppetite}`)
  lines.push(`Risks flagged emerging: ${t.emerging}`)
  lines.push(`Risks not yet assessed: ${t.unassessed}`)
  lines.push(`Risks with no named owner: ${t.withoutOwner}`)
  lines.push(
    `Treatments: ${t.openTreatments} open, of which ${t.overdueTreatments} overdue`
  )
  lines.push(`KRIs: ${t.krisInBreach} red (in breach), ${t.krisAmber} amber (early warning)`)

  lines.push('')
  lines.push('## RISKS BY CATEGORY (open risks, residual band)')
  for (const c of board.byCategory) {
    lines.push(
      `${c.code} ${c.name_en}: ${c.total} risks — Extreme ${c.byBand.extreme}, High ${c.byBand.high}, Moderate ${c.byBand.moderate}, Low ${c.byBand.low}; highest residual score ${c.max_residual ?? 'n/a'}`
    )
  }

  lines.push('')
  lines.push('## TOP 10 RISKS BY RESIDUAL SCORE')
  if (board.topRisks.length === 0) lines.push('(none scored)')
  for (const r of board.topRisks) {
    const move =
      r.movement.direction === 'new'
        ? 'no prior assessment'
        : r.movement.delta === 0
          ? 'unchanged since last assessment'
          : `${r.movement.delta! > 0 ? 'up' : 'down'} ${Math.abs(r.movement.delta!)} points since last assessment (was ${r.movement.previousResidual})`
    lines.push(
      [
        `${r.code} — ${r.title}`,
        `  Category: ${r.parent_category_name_en ?? r.category_name_en ?? 'unclassified'}${r.category_name_en && r.parent_category_name_en ? ` / ${r.category_name_en}` : ''}`,
        `  Owner: ${r.owner_name ?? 'UNASSIGNED'}; status: ${RISK_STATUS_LABEL[(r.status ?? 'identified') as RiskStatus] ?? r.status}`,
        `  Inherent ${fmtScore(r.inherent_likelihood, r.inherent_impact, r.inherent_score)}; residual ${fmtScore(r.residual_likelihood, r.residual_impact, r.residual_score)}; target ${fmtScore(r.target_likelihood, r.target_impact, r.target_score)}`,
        `  Likelihood: ${r.residual_likelihood ? LIKELIHOOD_LABEL[r.residual_likelihood] : 'n/a'}; impact: ${r.residual_impact ? IMPACT_LABEL[r.residual_impact] : 'n/a'}; velocity: ${r.velocity ? VELOCITY_LABEL[r.velocity] : 'not rated'}; trend: ${r.trend}`,
        `  Movement: ${move}`,
        `  Tolerance threshold ${r.tolerance_threshold ?? 'not set'}; outside appetite: ${r.appetite_breach ? 'YES' : 'no'}`,
        `  Controls linked: ${r.control_count ?? 0}; open treatments: ${r.open_treatments ?? 0} (${r.overdue_treatments ?? 0} overdue); KRIs: ${r.kri_count ?? 0} (worst status ${r.kri_status ?? 'none'})`,
        r.description ? `  Statement: ${r.description}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  lines.push('')
  lines.push('## RISK APPETITE AND UTILISATION')
  if (board.appetite.length === 0) lines.push('(no appetite statements approved)')
  for (const a of board.appetite) {
    lines.push(
      `${a.category_code ? `${a.category_code} ${a.category_name_en}` : 'Enterprise-wide'}: appetite ${APPETITE_LEVEL_LABEL[a.appetite_level as AppetiteLevel] ?? a.appetite_level}, tolerance threshold ${a.tolerance_threshold}, ${a.risk_count} risks in scope, highest residual ${a.max_residual ?? 'n/a'} (${a.utilisation_pct}% of tolerance), ${a.breach_count} above tolerance${a.approved_at ? `, approved ${a.approved_at.slice(0, 10)}` : ', NOT FORMALLY APPROVED'}${a.review_date ? `, next review ${a.review_date}` : ''}`
    )
    lines.push(`  Statement: ${a.statement_en}`)
  }

  lines.push('')
  lines.push('## RISKS OUTSIDE APPETITE')
  if (board.outsideAppetite.length === 0) lines.push('(none)')
  for (const r of board.outsideAppetite) {
    lines.push(
      `${r.code} — ${r.title}: residual ${r.residual_score} against tolerance ${r.tolerance_threshold}, owner ${r.owner_name ?? 'UNASSIGNED'}, ${r.open_treatments ?? 0} open treatments (${r.overdue_treatments ?? 0} overdue)`
    )
  }

  lines.push('')
  lines.push('## OVERDUE TREATMENTS')
  if (board.overdueTreatments.length === 0) lines.push('(none)')
  for (const t2 of board.overdueTreatments) {
    lines.push(
      `${t2.risk_code} — ${t2.title} [${TREATMENT_STRATEGY_LABEL[(t2.strategy ?? 'mitigate') as TreatmentStrategy] ?? t2.strategy}]: owner ${t2.owner_name ?? 'UNASSIGNED'}, due ${t2.due_date ?? 'no date'}, ${t2.days_to_due !== null && t2.days_to_due !== undefined ? `${Math.abs(t2.days_to_due)} days overdue` : 'overdue'}, risk residual ${t2.risk_residual_score ?? 'n/a'}`
    )
  }

  lines.push('')
  lines.push('## KRIs IN BREACH (red)')
  if (board.krisInBreach.length === 0) lines.push('(none)')
  for (const k of board.krisInBreach) {
    lines.push(
      `${k.name} (risk ${k.risk_code ?? 'unlinked'}): latest ${k.latest_value}${k.unit ? ` ${k.unit}` : ''} as at ${k.latest_period ?? 'n/a'}, amber ${k.amber_threshold}, red ${k.red_threshold}, ${k.direction === 'lower_is_worse' ? 'lower is worse' : 'higher is worse'}, previous reading ${k.previous_value ?? 'n/a'}, ${k.breach_periods.length} breach periods on record`
    )
  }

  lines.push('')
  lines.push('## EMERGING RISKS')
  if (board.emergingRisks.length === 0) lines.push('(none flagged)')
  for (const r of board.emergingRisks) {
    lines.push(
      `${r.code} — ${r.title}: residual ${r.residual_score ?? 'not assessed'}, velocity ${r.velocity ? VELOCITY_LABEL[r.velocity] : 'not rated'}, trend ${r.trend}. ${r.description ?? ''}`
    )
  }

  return lines.join('\n')
}

function buildUserPrompt(board: Awaited<ReturnType<typeof getBoardAggregate>>, req: ReportRequest): string {
  const entity = req.entityName?.trim() || 'the Group'
  const period = req.periodLabel?.trim() || 'the current reporting period'
  const notes = req.notes?.trim()

  return `Draft the enterprise risk report for ${entity} covering ${period}.

Use these sections, in this order, at heading level 2:

1. Executive summary — five to eight sentences. State the shape of the portfolio, what has changed, and the single most important thing the board must decide or note.
2. Risk profile and movement — the portfolio view: distribution across residual bands and categories, and what moved since the last assessment and in which direction. Include one Markdown table of the band distribution by category.
3. Principal risks — the top risks by residual score. For each: the risk statement, owner, inherent → residual → target, velocity, and the status of its treatment. Use a Markdown table for the summary and prose only where a risk needs explanation.
4. Risks outside appetite — every risk whose residual score exceeds its tolerance threshold, with the treatment that is meant to bring it back inside and whether that treatment is on track. If there are none, say so and state the tolerance thresholds that are in force.
5. Key risk indicators — those in breach and those in early warning, with the latest reading against threshold and what the trend implies.
6. Emerging risks — risks flagged as emerging plus, where the data supports it, what the profile implies is building. Label clearly anything that is your inference rather than a recorded risk.
7. Asks of the board — a numbered list of specific decisions, approvals or escalations sought, each tied to a named risk or appetite statement. Where the data shows a governance gap (unapproved appetite, unowned risks, unassessed risks, overdue treatments), raise it here.

${notes ? `Additional context from management:\n${notes}\n\n` : ''}DATA — this is the complete risk management information available. Do not go beyond it:

${buildDataBlock(board)}`
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) return 'Anthropic API authentication failed. Check ANTHROPIC_API_KEY.'
    if (error.status === 429) return 'Rate limit exceeded. Please try again in a moment.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred while drafting the board report.'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: ReportRequest = {}
  try {
    body = (await request.json()) as ReportRequest
  } catch {
    body = {}
  }

  const board = await getBoardAggregate()
  if (board.totals.risks === 0) {
    return Response.json(
      { error: 'There are no risks on the register to report on.' },
      { status: 400 }
    )
  }

  const userPrompt = buildUserPrompt(board, body)

  try {
    const messageStream = anthropic.messages.stream({
      model: MODELS.SONNET,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(STREAM_PAD))

        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode('​'))
          } catch {
            clearInterval(heartbeat)
          }
        }, 3000)

        try {
          for await (const event of messageStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          controller.close()
        } catch (error) {
          console.error('[erm/board-report] stream', error)
          controller.enqueue(encoder.encode(`\n\n---\nError: ${getErrorMessage(error)}`))
          controller.close()
        } finally {
          clearInterval(heartbeat)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('[erm/board-report]', error)
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
