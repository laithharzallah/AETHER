/**
 * Phase 4 — decide.
 *
 * Produces `machine_directives`: the ranked list of things that need a human's
 * attention, each with the reasoning that produced it.
 *
 * Two sources feed this. External signals are the obvious one. The less obvious
 * and more consistently valuable one is the internal sweep: policies past their
 * review date, obligations coming due, controls that have never been assessed, AI
 * systems that were never classified, critical vendors nobody has looked at in a
 * year. A tenant with no regulatory change at all this week still has work the
 * Machine can find, which is what makes it useful on day one rather than only
 * once a regulator happens to publish something.
 *
 * Directives are advisory by default. A tenant on `autonomy_level = 'act'` also
 * gets tasks and obligations created automatically, but only above its own
 * `min_relevance_to_act` threshold, and every one of them is attributed to the
 * Machine in the audit trail.
 */

import type { Json } from '@/lib/database.types'
import { outOfBudget, type MachineContext, type PhaseOutcome } from '../types'
import { shortHash } from '../hash'

type Priority = 'low' | 'medium' | 'high' | 'urgent'

type RecommendedAction = {
  label: string
  description: string
  /** What acting on this would create, when autonomy allows it. */
  creates?: 'task' | 'obligation' | 'risk' | 'assessment'
  taskType?: string
}

export type DirectiveDraft = {
  organizationId: string
  clientWorkspaceId?: string | null
  subjectType: string
  subjectId: string | null
  subjectLabel: string
  directiveType: string
  priority: Priority
  urgencyScore: number
  confidence: number
  title: string
  reasoning: string
  evidence: Json[]
  recommendedActions: RecommendedAction[]
  dedupeKey: string
  expiresAt?: string | null
}

type OrgContext = {
  id: string
  name: string
  country: string | null
  industry: string | null
  autonomyLevel: 'observe' | 'advise' | 'act'
  minRelevanceToAlert: number
  minRelevanceToAct: number
}

function priorityFromScore(score: number): Priority {
  if (score >= 0.85) return 'urgent'
  if (score >= 0.7) return 'high'
  if (score >= 0.45) return 'medium'
  return 'low'
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function isoDaysFromNow(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString()
}

// -----------------------------------------------------------------------------
// Detector: regulatory signals the tenant has not triaged
// -----------------------------------------------------------------------------

async function detectSignalDirectives(
  context: MachineContext,
  org: OrgContext
): Promise<DirectiveDraft[]> {
  const { data, error } = await context.db
    .from('signal_assessments')
    .select(
      `id, relevance_score, relevance_band, rationale, matched_frameworks,
       affected_control_count, risk_signal_id,
       risk_signals ( summary, category, severity, recommended_action,
                      impact_analysis, deadline_date, frameworks_affected,
                      intelligence_items ( title, url ) )`
    )
    .eq('organization_id', org.id)
    .eq('status', 'new')
    .gte('relevance_score', org.minRelevanceToAlert)
    .order('relevance_score', { ascending: false })
    .limit(50)

  if (error || !data) return []

  return data.flatMap((row): DirectiveDraft[] => {
    const signal = row.risk_signals as {
      summary: string
      category: string
      severity: string | null
      recommended_action: string | null
      impact_analysis: string | null
      deadline_date: string | null
      frameworks_affected: string[] | null
      intelligence_items: { title: string; url: string | null } | null
    } | null

    if (!signal) return []

    const document = signal.intelligence_items
    const frameworks = row.matched_frameworks ?? []

    const actions: RecommendedAction[] = [
      {
        label: 'Review the source document',
        description: document?.url
          ? `Read the published instrument at ${document.url} and confirm what, if anything, changes.`
          : 'Read the published instrument and confirm what, if anything, changes.',
      },
      {
        label: 'Assess affected controls',
        description:
          row.affected_control_count > 0
            ? `Re-assess the ${row.affected_control_count} control(s) in your library touching this area.`
            : 'Confirm whether any control in your library needs to change.',
        creates: 'task',
        taskType: 'assessment',
      },
    ]

    if (signal.recommended_action) {
      actions.push({
        label: 'Act on the analyst recommendation',
        description: signal.recommended_action,
        creates: 'task',
        taskType: 'remediation',
      })
    }

    if (signal.deadline_date) {
      actions.push({
        label: 'Diarise the compliance deadline',
        description: `Create a dated obligation for ${signal.deadline_date} so the deadline is tracked with an owner.`,
        creates: 'obligation',
      })
    }

    return [
      {
        organizationId: org.id,
        subjectType: 'risk_signal',
        subjectId: row.risk_signal_id,
        subjectLabel: document?.title ?? signal.summary.slice(0, 120),
        directiveType: 'regulatory_change',
        priority: priorityFromScore(row.relevance_score),
        urgencyScore: row.relevance_score,
        confidence: 0.8,
        title: document?.title
          ? document.title.slice(0, 300)
          : signal.summary.slice(0, 300),
        reasoning: [
          signal.summary,
          signal.impact_analysis,
          row.rationale,
          frameworks.length > 0
            ? `Frameworks in scope for you: ${frameworks.join(', ')}.`
            : null,
        ]
          .filter(Boolean)
          .join('\n\n'),
        evidence: [
          {
            kind: 'intelligence_item',
            title: document?.title ?? null,
            url: document?.url ?? null,
            category: signal.category,
            severity: signal.severity,
            deadline: signal.deadline_date,
          },
        ],
        recommendedActions: actions,
        dedupeKey: `signal:${row.risk_signal_id}`,
        // Regulatory change stays open for a quarter; if nobody has looked in
        // three months it needs re-raising with a fresh score, not silent ageing.
        expiresAt: isoDaysFromNow(context.now, 90),
      },
    ]
  })
}

// -----------------------------------------------------------------------------
// Detector: obligations due or overdue
// -----------------------------------------------------------------------------

async function detectObligationDirectives(
  context: MachineContext,
  org: OrgContext
): Promise<DirectiveDraft[]> {
  const horizon = new Date(context.now.getTime() + 45 * 86_400_000)
    .toISOString()
    .slice(0, 10)

  const { data, error } = await context.db
    .from('obligations')
    .select('id, title, framework_code, due_date, severity, status, owner_id, evidence_required')
    .eq('organization_id', org.id)
    .not('due_date', 'is', null)
    .lte('due_date', horizon)
    .not('status', 'in', '("complete","submitted","waived")')
    .order('due_date', { ascending: true })
    .limit(60)

  if (error || !data) return []

  return data.map((obligation): DirectiveDraft => {
    const due = new Date(`${obligation.due_date}T00:00:00Z`)
    const days = daysBetween(context.now, due)
    const overdue = days < 0

    // Overdue and unowned are the two things that turn a calendar entry into a
    // finding, so both push the score up.
    let urgency = overdue ? 0.9 : days <= 7 ? 0.8 : days <= 21 ? 0.65 : 0.5
    if (obligation.severity === 'critical') urgency = Math.min(1, urgency + 0.1)
    if (!obligation.owner_id) urgency = Math.min(1, urgency + 0.05)

    return {
      organizationId: org.id,
      subjectType: 'obligation',
      subjectId: obligation.id,
      subjectLabel: obligation.title,
      directiveType: overdue ? 'obligation_overdue' : 'obligation_due',
      priority: priorityFromScore(urgency),
      urgencyScore: Number(urgency.toFixed(3)),
      confidence: 1,
      title: overdue
        ? `Overdue: ${obligation.title}`
        : `Due in ${days} day(s): ${obligation.title}`,
      reasoning: [
        overdue
          ? `This ${obligation.framework_code ?? 'regulatory'} obligation was due on ${obligation.due_date}, ${Math.abs(days)} day(s) ago, and is still ${obligation.status}.`
          : `This ${obligation.framework_code ?? 'regulatory'} obligation is due on ${obligation.due_date}, in ${days} day(s), and is still ${obligation.status}.`,
        obligation.owner_id
          ? null
          : 'No owner is assigned, so nobody is currently accountable for it.',
        (obligation.evidence_required ?? []).length > 0
          ? `Evidence required: ${(obligation.evidence_required ?? []).join('; ')}.`
          : null,
      ]
        .filter(Boolean)
        .join(' '),
      evidence: [
        {
          kind: 'obligation',
          id: obligation.id,
          dueDate: obligation.due_date,
          status: obligation.status,
          severity: obligation.severity,
          daysUntilDue: days,
        },
      ],
      recommendedActions: [
        ...(obligation.owner_id
          ? []
          : [
              {
                label: 'Assign an owner',
                description:
                  'Nominate the accountable role before the deadline so the obligation has a named owner.',
              } satisfies RecommendedAction,
            ]),
        {
          label: 'Collect the required evidence',
          description:
            (obligation.evidence_required ?? []).length > 0
              ? `Gather: ${(obligation.evidence_required ?? []).join('; ')}.`
              : 'Gather the evidence needed to demonstrate completion.',
          creates: 'task',
          taskType: 'evidence_collection',
        },
        {
          label: 'Complete and record the submission',
          description: 'Mark the obligation complete once the filing or activity is done.',
          creates: 'task',
          taskType: 'filing',
        },
      ],
      dedupeKey: `obligation:${obligation.id}:${overdue ? 'overdue' : 'due'}`,
      expiresAt: null,
    }
  })
}

// -----------------------------------------------------------------------------
// Detector: policies past their review date
// -----------------------------------------------------------------------------

async function detectPolicyDirectives(
  context: MachineContext,
  org: OrgContext
): Promise<DirectiveDraft[]> {
  const horizon = new Date(context.now.getTime() + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10)

  const { data, error } = await context.db
    .from('policies')
    .select('id, title, policy_type, status, next_review_at, version, owner_id, framework_codes')
    .eq('organization_id', org.id)
    .eq('status', 'published')
    .not('next_review_at', 'is', null)
    .lte('next_review_at', horizon)
    .limit(40)

  if (error || !data) return []

  return data.map((policy): DirectiveDraft => {
    const due = new Date(`${policy.next_review_at}T00:00:00Z`)
    const days = daysBetween(context.now, due)
    const overdue = days < 0

    // A policy months out of date is a standing audit finding, so the score keeps
    // climbing with the overrun rather than plateauing on day one.
    const urgency = overdue
      ? Math.min(0.95, 0.7 + Math.abs(days) / 365)
      : 0.45

    return {
      organizationId: org.id,
      subjectType: 'policy',
      subjectId: policy.id,
      subjectLabel: policy.title,
      directiveType: 'policy_stale',
      priority: priorityFromScore(urgency),
      urgencyScore: Number(urgency.toFixed(3)),
      confidence: 1,
      title: overdue
        ? `Review overdue: ${policy.title}`
        : `Review due: ${policy.title}`,
      reasoning: [
        overdue
          ? `Version ${policy.version} of this published policy was due for review on ${policy.next_review_at}, ${Math.abs(days)} day(s) ago.`
          : `Version ${policy.version} of this published policy is due for review on ${policy.next_review_at}.`,
        'An out-of-date policy is a finding in its own right under the ISO 27001 A.5.1, NCA ECC 1-3 and SAMA CSF 3.1.3 review requirements, independent of whether its content is still correct.',
        (policy.framework_codes ?? []).length > 0
          ? `Cited frameworks: ${(policy.framework_codes ?? []).join(', ')}.`
          : null,
      ]
        .filter(Boolean)
        .join(' '),
      evidence: [
        {
          kind: 'policy',
          id: policy.id,
          version: policy.version,
          nextReviewAt: policy.next_review_at,
          daysOverdue: overdue ? Math.abs(days) : 0,
        },
      ],
      recommendedActions: [
        {
          label: 'Review the policy content',
          description:
            'Confirm the content still reflects current practice and current regulatory requirements.',
          creates: 'task',
          taskType: 'review',
        },
        {
          label: 'Re-approve and republish',
          description:
            'Record the review, publish a new version, and set the next review date.',
          creates: 'task',
          taskType: 'policy_update',
        },
      ],
      dedupeKey: `policy-review:${policy.id}`,
      expiresAt: null,
    }
  })
}

// -----------------------------------------------------------------------------
// Detector: control gaps in mandatory frameworks
// -----------------------------------------------------------------------------

async function detectControlDirectives(
  context: MachineContext,
  org: OrgContext
): Promise<DirectiveDraft[]> {
  const { data, error } = await context.db
    .from('compliance_posture')
    .select(
      'framework_code, framework_name, regulator, mandatory, in_scope_controls, gaps, never_assessed, coverage_percent'
    )
    .eq('organization_id', org.id)

  if (error || !data) return []

  const drafts: DirectiveDraft[] = []

  for (const row of data) {
    if (!row.in_scope_controls || row.in_scope_controls === 0) continue

    const coverage = Number(row.coverage_percent ?? 0)
    const neverAssessed = Number(row.never_assessed ?? 0)
    const gaps = Number(row.gaps ?? 0)
    const neverAssessedRatio = neverAssessed / row.in_scope_controls

    // A mandatory framework sitting under 60% coverage is the finding a regulator
    // opens with, so it is reported separately from a merely incomplete
    // voluntary standard.
    if (row.mandatory && coverage < 60) {
      const urgency = Math.min(0.95, 0.6 + (60 - coverage) / 150)
      drafts.push({
        organizationId: org.id,
        subjectType: 'organization',
        subjectId: org.id,
        subjectLabel: row.framework_code ?? 'framework',
        directiveType: 'coverage_gap',
        priority: priorityFromScore(urgency),
        urgencyScore: Number(urgency.toFixed(3)),
        confidence: 1,
        title: `${row.framework_code}: coverage at ${coverage}% of a mandatory framework`,
        reasoning: [
          `${row.framework_name} is mandatory for this organisation and is being enforced by ${row.regulator}.`,
          `Of ${row.in_scope_controls} in-scope controls, ${gaps} are not implemented or not assessed, giving ${coverage}% coverage.`,
          'Partially implemented controls count for half, and controls that have never been assessed count for nothing — an unverified control is not evidence of compliance.',
        ].join(' '),
        evidence: [
          {
            kind: 'compliance_posture',
            framework: row.framework_code,
            coveragePercent: coverage,
            inScopeControls: row.in_scope_controls,
            gaps,
            neverAssessed,
          },
        ],
        recommendedActions: [
          {
            label: 'Prioritise the gap closure plan',
            description: `Produce a remediation plan for the ${gaps} outstanding ${row.framework_code} control(s), sequenced by regulatory exposure.`,
            creates: 'task',
            taskType: 'remediation',
          },
          {
            label: 'Assess the unassessed controls',
            description: `${neverAssessed} control(s) have never been assessed. Assess them before reporting any coverage figure externally.`,
            creates: 'task',
            taskType: 'assessment',
          },
        ],
        dedupeKey: `coverage:${row.framework_code}`,
        expiresAt: null,
      })
      continue
    }

    // Never-assessed controls are a distinct problem from unimplemented ones:
    // the organisation does not know where it stands.
    if (neverAssessedRatio > 0.5 && neverAssessed >= 10) {
      const urgency = row.mandatory ? 0.7 : 0.5
      drafts.push({
        organizationId: org.id,
        subjectType: 'organization',
        subjectId: org.id,
        subjectLabel: row.framework_code ?? 'framework',
        directiveType: 'assessment_overdue',
        priority: priorityFromScore(urgency),
        urgencyScore: urgency,
        confidence: 1,
        title: `${row.framework_code}: ${neverAssessed} controls have never been assessed`,
        reasoning: `${neverAssessed} of ${row.in_scope_controls} in-scope ${row.framework_code} controls have no assessment on record, so the reported ${coverage}% coverage cannot be evidenced. Until they are assessed, this framework's posture is unknown rather than good or bad.`,
        evidence: [
          {
            kind: 'compliance_posture',
            framework: row.framework_code,
            neverAssessed,
            inScopeControls: row.in_scope_controls,
          },
        ],
        recommendedActions: [
          {
            label: 'Run a baseline assessment',
            description: `Assess the ${neverAssessed} unassessed ${row.framework_code} control(s) to establish a defensible baseline.`,
            creates: 'task',
            taskType: 'assessment',
          },
        ],
        dedupeKey: `unassessed:${row.framework_code}`,
        expiresAt: null,
      })
    }
  }

  return drafts
}

// -----------------------------------------------------------------------------
// Detector: AI systems needing classification or oversight
// -----------------------------------------------------------------------------

async function detectAiDirectives(
  context: MachineContext,
  org: OrgContext
): Promise<DirectiveDraft[]> {
  const { data, error } = await context.db
    .from('ai_systems')
    .select(
      'id, name, purpose, lifecycle_stage, eu_ai_act_class, sdaia_risk_tier, classification_at, human_in_the_loop, makes_automated_decisions, eu_market_exposure, last_risk_assessment_at'
    )
    .eq('organization_id', org.id)
    .neq('lifecycle_stage', 'retired')
    .limit(100)

  if (error || !data) return []

  const drafts: DirectiveDraft[] = []

  for (const system of data) {
    if (!system.eu_ai_act_class && !system.sdaia_risk_tier) {
      const inProduction = system.lifecycle_stage === 'production'
      const urgency = inProduction ? 0.75 : 0.5

      drafts.push({
        organizationId: org.id,
        subjectType: 'ai_system',
        subjectId: system.id,
        subjectLabel: system.name,
        directiveType: 'ai_classification_required',
        priority: priorityFromScore(urgency),
        urgencyScore: urgency,
        confidence: 1,
        title: `Unclassified AI system: ${system.name}`,
        reasoning: [
          `This AI system has no risk classification recorded and is at the "${system.lifecycle_stage}" stage.`,
          inProduction
            ? 'It is already in production, so any obligation attaching to its tier is live and unmet.'
            : 'Classifying it before production is considerably cheaper than retrofitting the controls afterwards.',
          'Both the SDAIA AI Ethics Principles and, where there is EU exposure, the EU AI Act make the obligation set depend entirely on the tier — so nothing else can be planned until it is known.',
        ].join(' '),
        evidence: [
          {
            kind: 'ai_system',
            id: system.id,
            lifecycleStage: system.lifecycle_stage,
            euMarketExposure: system.eu_market_exposure,
          },
        ],
        recommendedActions: [
          {
            label: 'Run the risk classification',
            description:
              'Classify the system against the EU AI Act and SDAIA tiers so its obligations are known.',
            creates: 'task',
            taskType: 'assessment',
          },
        ],
        dedupeKey: `ai-classify:${system.id}`,
        expiresAt: null,
      })
      continue
    }

    // A high-risk system with no human in the loop contradicts Article 14 on its
    // face, which is worth raising urgently even before anyone assesses it.
    if (
      (system.eu_ai_act_class === 'high' || system.sdaia_risk_tier === 'high') &&
      system.human_in_the_loop === false
    ) {
      drafts.push({
        organizationId: org.id,
        subjectType: 'ai_system',
        subjectId: system.id,
        subjectLabel: system.name,
        directiveType: 'ai_classification_required',
        priority: 'urgent',
        urgencyScore: 0.92,
        confidence: 0.95,
        title: `High-risk AI system with no human oversight: ${system.name}`,
        reasoning:
          'This system is classified high-risk but records no human in the loop. EU AI Act Article 14 requires high-risk systems to be designed so a natural person can effectively oversee them, and SDAIA Principle 3 (Humanity) requires meaningful human control over consequential decisions. As recorded, the system does not meet either.',
        evidence: [
          {
            kind: 'ai_system',
            id: system.id,
            euAiActClass: system.eu_ai_act_class,
            sdaiaRiskTier: system.sdaia_risk_tier,
            humanInTheLoop: false,
          },
        ],
        recommendedActions: [
          {
            label: 'Introduce human oversight',
            description:
              'Design and document the oversight mechanism, including who can intervene and how the system can be stopped.',
            creates: 'task',
            taskType: 'remediation',
          },
          {
            label: 'Record the risk',
            description:
              'Add this to the risk register until oversight is in place, so the exposure is visible and owned.',
            creates: 'risk',
          },
        ],
        dedupeKey: `ai-oversight:${system.id}`,
        expiresAt: null,
      })
    }

    if (
      (system.eu_ai_act_class === 'high' || system.sdaia_risk_tier === 'high') &&
      system.lifecycle_stage === 'production'
    ) {
      const lastAssessed = system.last_risk_assessment_at
        ? new Date(system.last_risk_assessment_at)
        : null
      const staleDays = lastAssessed ? daysBetween(lastAssessed, context.now) : null

      if (staleDays === null || staleDays > 365) {
        drafts.push({
          organizationId: org.id,
          subjectType: 'ai_system',
          subjectId: system.id,
          subjectLabel: system.name,
          directiveType: 'assessment_overdue',
          priority: 'high',
          urgencyScore: 0.72,
          confidence: 1,
          title: `High-risk AI risk assessment overdue: ${system.name}`,
          reasoning:
            staleDays === null
              ? 'This high-risk AI system is in production with no risk assessment on record. EU AI Act Article 9 requires a risk management system running across the whole lifecycle, not a one-off pre-deployment check.'
              : `The last risk assessment for this production high-risk AI system was ${staleDays} days ago. Article 9 requires the risk management system to be continuous and iterative.`,
          evidence: [
            {
              kind: 'ai_system',
              id: system.id,
              lastRiskAssessmentAt: system.last_risk_assessment_at,
              daysSinceAssessment: staleDays,
            },
          ],
          recommendedActions: [
            {
              label: 'Refresh the risk assessment',
              description:
                'Re-run the risk assessment, including accuracy, robustness and bias testing against current production data.',
              creates: 'task',
              taskType: 'assessment',
            },
          ],
          dedupeKey: `ai-assessment:${system.id}`,
          expiresAt: null,
        })
      }
    }
  }

  return drafts
}

// -----------------------------------------------------------------------------
// Detector: third parties overdue for review
// -----------------------------------------------------------------------------

async function detectVendorDirectives(
  context: MachineContext,
  org: OrgContext
): Promise<DirectiveDraft[]> {
  const { data, error } = await context.db
    .from('vendors')
    .select(
      'id, name, criticality, assessment_status, last_reviewed_at, next_review_at, contract_end, is_cloud_provider'
    )
    .eq('organization_id', org.id)
    .in('criticality', ['high', 'critical'])
    .limit(100)

  if (error || !data) return []

  const drafts: DirectiveDraft[] = []

  for (const vendor of data) {
    const lastReviewed = vendor.last_reviewed_at ? new Date(vendor.last_reviewed_at) : null
    const staleDays = lastReviewed ? daysBetween(lastReviewed, context.now) : null
    const neverAssessed = vendor.assessment_status === 'not_started'
    const overdue = staleDays === null || staleDays > 365

    if (!neverAssessed && !overdue) continue

    const urgency = vendor.criticality === 'critical' ? 0.78 : 0.6

    drafts.push({
      organizationId: org.id,
      subjectType: 'vendor',
      subjectId: vendor.id,
      subjectLabel: vendor.name,
      directiveType: 'vendor_review_due',
      priority: priorityFromScore(urgency),
      urgencyScore: urgency,
      confidence: 1,
      title: neverAssessed
        ? `${vendor.criticality === 'critical' ? 'Critical' : 'High-criticality'} vendor never assessed: ${vendor.name}`
        : `Vendor review overdue: ${vendor.name}`,
      reasoning: [
        neverAssessed
          ? `This vendor is rated ${vendor.criticality} but has no assessment on record.`
          : `This ${vendor.criticality}-criticality vendor was last reviewed ${staleDays} days ago.`,
        'ISO 27001 A.5.22 and NCA ECC 4-1 both require ongoing monitoring and review of supplier services, not a one-off check at onboarding.',
        vendor.is_cloud_provider
          ? 'As a cloud provider it also engages the shared-responsibility obligations in NCA CCC and ISO 27001 A.5.23.'
          : null,
      ]
        .filter(Boolean)
        .join(' '),
      evidence: [
        {
          kind: 'vendor',
          id: vendor.id,
          criticality: vendor.criticality,
          assessmentStatus: vendor.assessment_status,
          lastReviewedAt: vendor.last_reviewed_at,
          daysSinceReview: staleDays,
        },
      ],
      recommendedActions: [
        {
          label: 'Run the vendor assessment',
          description:
            'Reassess against the contractual security requirements and refresh any certifications relied on.',
          creates: 'task',
          taskType: 'assessment',
        },
      ],
      dedupeKey: `vendor-review:${vendor.id}`,
      expiresAt: null,
    })
  }

  return drafts
}

// -----------------------------------------------------------------------------
// Detector: controls no policy claims to cover
// -----------------------------------------------------------------------------

async function detectPolicyGapDirectives(
  context: MachineContext,
  org: OrgContext
): Promise<DirectiveDraft[]> {
  const { count: policyCount } = await context.db
    .from('policies')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)
    .in('status', ['approved', 'published'])

  const { count: controlCount } = await context.db
    .from('controls')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)
    .neq('applicability', 'not_applicable')

  // Only worth raising once the tenant has a control library at all.
  if (!controlCount || controlCount < 10) return []

  if ((policyCount ?? 0) === 0) {
    return [
      {
        organizationId: org.id,
        subjectType: 'organization',
        subjectId: org.id,
        subjectLabel: org.name,
        directiveType: 'policy_missing',
        priority: 'high',
        urgencyScore: 0.8,
        confidence: 1,
        title: 'No approved policies exist',
        reasoning: `This organisation holds ${controlCount} in-scope controls but has no approved or published policy. Every framework in the catalogue expects a documented, approved policy set — it is usually the first artefact an assessor asks for, and its absence undermines the evidence for every control beneath it.`,
        evidence: [{ kind: 'policy_gap', controlCount, approvedPolicyCount: 0 }],
        recommendedActions: [
          {
            label: 'Generate the core policy set',
            description:
              'Start with the Information Security Policy, then Access Control and Incident Response. The Policy Generator drafts these against the frameworks you are assessed on.',
            creates: 'task',
            taskType: 'policy_update',
          },
        ],
        dedupeKey: 'policy-set-missing',
        expiresAt: null,
      },
    ]
  }

  return []
}

// -----------------------------------------------------------------------------
// Detector: evidence approaching expiry
// -----------------------------------------------------------------------------

async function detectEvidenceDirectives(
  context: MachineContext,
  org: OrgContext
): Promise<DirectiveDraft[]> {
  const horizon = new Date(context.now.getTime() + 45 * 86_400_000)
    .toISOString()
    .slice(0, 10)

  const { data, error } = await context.db
    .from('evidence')
    .select('id, title, valid_until, control_id, evidence_type')
    .eq('organization_id', org.id)
    .not('valid_until', 'is', null)
    .lte('valid_until', horizon)
    .limit(50)

  if (error || !data || data.length === 0) return []

  const expired = data.filter(
    (e) => new Date(`${e.valid_until}T00:00:00Z`) < context.now
  )

  // Grouped into one directive: fifty individual notifications about expiring
  // certificates is how a useful signal becomes noise nobody reads.
  return [
    {
      organizationId: org.id,
      subjectType: 'organization',
      subjectId: org.id,
      subjectLabel: org.name,
      directiveType: 'evidence_expiring',
      priority: expired.length > 0 ? 'high' : 'medium',
      urgencyScore: expired.length > 0 ? 0.7 : 0.5,
      confidence: 1,
      title:
        expired.length > 0
          ? `${expired.length} evidence artefact(s) have expired, ${data.length - expired.length} expiring soon`
          : `${data.length} evidence artefact(s) expiring within 45 days`,
      reasoning: [
        expired.length > 0
          ? `${expired.length} artefact(s) relied on as control evidence are past their validity date and no longer demonstrate anything.`
          : `${data.length} artefact(s) relied on as control evidence will expire within 45 days.`,
        'Controls backed only by expired evidence will be treated as unevidenced in an assessment, regardless of whether the control itself is still operating.',
      ].join(' '),
      evidence: data.slice(0, 20).map((e) => ({
        kind: 'evidence',
        id: e.id,
        title: e.title,
        validUntil: e.valid_until,
        type: e.evidence_type,
        expired: new Date(`${e.valid_until}T00:00:00Z`) < context.now,
      })),
      recommendedActions: [
        {
          label: 'Refresh the expiring evidence',
          description:
            'Collect current artefacts for the affected controls and update the evidence records.',
          creates: 'task',
          taskType: 'evidence_collection',
        },
      ],
      dedupeKey: `evidence-expiry:${shortHash(data.map((e) => e.id).sort().join(','), 12)}`,
      expiresAt: isoDaysFromNow(context.now, 60),
    },
  ]
}

// -----------------------------------------------------------------------------
// Autonomous action
// -----------------------------------------------------------------------------

/**
 * Creates the work a directive recommends, for tenants that have opted into
 * `autonomy_level = 'act'`.
 *
 * Only the first task-creating action is taken. The Machine's job is to make sure
 * something is on someone's list, not to generate five tickets a human then has
 * to close as duplicates.
 */
async function actOnDirective(
  context: MachineContext,
  org: OrgContext,
  draft: DirectiveDraft,
  directiveId: string
): Promise<'task' | null> {
  const action = draft.recommendedActions.find((a) => a.creates === 'task')
  if (!action) return null

  const { data: existing } = await context.db
    .from('tasks')
    .select('id')
    .eq('organization_id', org.id)
    .eq('title', action.label)
    .eq('status', 'open')
    .limit(1)

  if (existing && existing.length > 0) return null

  const { data: task, error } = await context.db
    .from('tasks')
    .insert({
      organization_id: org.id,
      title: `${action.label}: ${draft.subjectLabel}`.slice(0, 300),
      description: `${action.description}\n\nRaised automatically by AETHER's autonomous engine from directive "${draft.title}".\n\nReasoning:\n${draft.reasoning}`,
      task_type: action.taskType ?? 'remediation',
      priority: draft.priority === 'urgent' ? 'urgent' : draft.priority,
      status: 'open',
      created_by_machine: true,
      control_id: draft.subjectType === 'control' ? draft.subjectId : null,
      policy_id: draft.subjectType === 'policy' ? draft.subjectId : null,
      obligation_id: draft.subjectType === 'obligation' ? draft.subjectId : null,
      risk_signal_id: draft.subjectType === 'risk_signal' ? draft.subjectId : null,
    })
    .select('id')
    .single()

  if (error || !task) return null

  await context.db
    .from('machine_directives')
    .update({ resulting_task_id: task.id, status: 'actioned' })
    .eq('id', directiveId)

  await context.db.rpc('record_audit_event', {
    p_organization_id: org.id,
    p_actor_id: undefined,
    p_actor_type: 'machine',
    p_action: 'task.created_autonomously',
    p_entity_type: 'task',
    p_entity_id: task.id,
    p_summary: `The Machine created "${action.label}" from directive: ${draft.title}`,
    p_metadata: {
      directiveId,
      directiveType: draft.directiveType,
      urgencyScore: draft.urgencyScore,
      runId: context.runId,
    },
    p_actor_label: 'AETHER autonomous engine',
  })

  return 'task'
}

// -----------------------------------------------------------------------------
// Phase entry point
// -----------------------------------------------------------------------------

export async function runDecidePhase(context: MachineContext): Promise<PhaseOutcome> {
  const { db } = context

  let orgQuery = db.from('organizations').select('id, name, country, industry')
  if (context.organizationId) orgQuery = orgQuery.eq('id', context.organizationId)

  const { data: orgs, error: orgsError } = await orgQuery.limit(
    context.limits.maxOrganizations
  )

  if (orgsError) {
    return {
      status: 'failed',
      itemsIn: 0,
      itemsOut: 0,
      detail: {},
      error: `could not load organizations: ${orgsError.message}`,
    }
  }

  const { data: settings } = await db
    .from('machine_settings')
    .select('organization_id, enabled, autonomy_level, min_relevance_to_alert, min_relevance_to_act')

  const settingsByOrg = new Map(
    (settings ?? []).map((s) => [s.organization_id, s])
  )

  let written = 0
  let refreshed = 0
  let actioned = 0
  let skippedDisabled = 0
  const byType: Record<string, number> = {}
  const failures: Array<{ org: string; error: string }> = []
  let stoppedEarly = false

  for (const orgRow of orgs ?? []) {
    if (outOfBudget(context, 5000)) {
      stoppedEarly = true
      break
    }

    const raw = settingsByOrg.get(orgRow.id)
    if (raw && !raw.enabled) {
      skippedDisabled += 1
      continue
    }

    const org: OrgContext = {
      id: orgRow.id,
      name: orgRow.name,
      country: orgRow.country,
      industry: orgRow.industry,
      autonomyLevel: (raw?.autonomy_level ?? 'advise') as OrgContext['autonomyLevel'],
      minRelevanceToAlert: raw?.min_relevance_to_alert ?? 0.35,
      minRelevanceToAct: raw?.min_relevance_to_act ?? 0.75,
    }

    let drafts: DirectiveDraft[]
    try {
      const results = await Promise.all([
        detectSignalDirectives(context, org),
        detectObligationDirectives(context, org),
        detectPolicyDirectives(context, org),
        detectControlDirectives(context, org),
        detectAiDirectives(context, org),
        detectVendorDirectives(context, org),
        detectPolicyGapDirectives(context, org),
        detectEvidenceDirectives(context, org),
      ])
      drafts = results.flat()
    } catch (error) {
      failures.push({
        org: org.name,
        error: error instanceof Error ? error.message : 'detector failure',
      })
      continue
    }

    // `observe` tenants get the analysis recorded but no directives raised.
    if (org.autonomyLevel === 'observe') {
      skippedDisabled += 1
      continue
    }

    for (const draft of drafts) {
      byType[draft.directiveType] = (byType[draft.directiveType] ?? 0) + 1

      if (context.dryRun) {
        written += 1
        continue
      }

      // Upsert on dedupe_key so a recurring conclusion is refreshed rather than
      // duplicated, and so a human's acknowledgement is not undone.
      const { data: existing } = await db
        .from('machine_directives')
        .select('id, status')
        .eq('organization_id', org.id)
        .eq('dedupe_key', draft.dedupeKey)
        .maybeSingle()

      if (existing) {
        if (existing.status === 'dismissed' || existing.status === 'actioned') {
          continue
        }
        const { error: updateError } = await db
          .from('machine_directives')
          .update({
            run_id: context.runId,
            priority: draft.priority,
            urgency_score: draft.urgencyScore,
            title: draft.title,
            reasoning: draft.reasoning,
            evidence: draft.evidence,
            recommended_actions: draft.recommendedActions,
            expires_at: draft.expiresAt,
          })
          .eq('id', existing.id)

        if (updateError) {
          failures.push({ org: org.name, error: updateError.message })
        } else {
          refreshed += 1
        }
        continue
      }

      const { data: inserted, error: insertError } = await db
        .from('machine_directives')
        .insert({
          organization_id: org.id,
          client_workspace_id: draft.clientWorkspaceId ?? null,
          run_id: context.runId,
          subject_type: draft.subjectType,
          subject_id: draft.subjectId,
          subject_label: draft.subjectLabel.slice(0, 300),
          directive_type: draft.directiveType,
          priority: draft.priority,
          urgency_score: draft.urgencyScore,
          confidence: draft.confidence,
          title: draft.title.slice(0, 300),
          reasoning: draft.reasoning,
          evidence: draft.evidence,
          recommended_actions: draft.recommendedActions,
          status: 'open',
          dedupe_key: draft.dedupeKey,
          expires_at: draft.expiresAt,
        })
        .select('id')
        .single()

      if (insertError || !inserted) {
        failures.push({
          org: org.name,
          error: insertError?.message ?? 'directive insert returned nothing',
        })
        continue
      }

      written += 1

      if (
        org.autonomyLevel === 'act' &&
        draft.urgencyScore >= org.minRelevanceToAct
      ) {
        const result = await actOnDirective(context, org, draft, inserted.id)
        if (result) actioned += 1
      }
    }
  }

  return {
    status: failures.length === 0 ? 'succeeded' : written > 0 ? 'partial' : 'failed',
    itemsIn: (orgs ?? []).length,
    itemsOut: written,
    detail: {
      organizationsEvaluated: (orgs ?? []).length - skippedDisabled,
      organizationsSkipped: skippedDisabled,
      directivesCreated: written,
      directivesRefreshed: refreshed,
      tasksCreatedAutonomously: actioned,
      byType,
      failures: failures.slice(0, 20),
      stoppedEarly,
    },
  }
}
