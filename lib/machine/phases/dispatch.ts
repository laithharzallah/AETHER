/**
 * Phase 5 — dispatch.
 *
 * Turns directives into notifications for the people who can act on them.
 *
 * The restraint here is the feature. A tool that emails about everything gets
 * filtered into a folder nobody opens, and then the one notification that
 * mattered is lost with the rest. So: only high and urgent directives notify,
 * only roles the tenant nominated are told, each directive notifies once, and
 * anything below that bar waits to be found in the console.
 */

import { outOfBudget, type MachineContext, type PhaseOutcome } from '../types'

const NOTIFIABLE_PRIORITIES = ['high', 'urgent'] as const

type SettingsRow = {
  organization_id: string
  enabled: boolean
  notify_roles: string[]
}

export async function runDispatchPhase(context: MachineContext): Promise<PhaseOutcome> {
  const { db } = context

  // Only directives raised by this run, so a re-run does not re-notify.
  let query = db
    .from('machine_directives')
    .select('id, organization_id, title, reasoning, priority, directive_type, subject_label')
    .eq('run_id', context.runId)
    .eq('status', 'open')
    .in('priority', [...NOTIFIABLE_PRIORITIES])

  if (context.organizationId) {
    query = query.eq('organization_id', context.organizationId)
  }

  const { data: directives, error } = await query.limit(500)

  if (error) {
    return {
      status: 'failed',
      itemsIn: 0,
      itemsOut: 0,
      detail: {},
      error: `could not load directives: ${error.message}`,
    }
  }

  if (!directives || directives.length === 0) {
    return {
      status: 'skipped',
      itemsIn: 0,
      itemsOut: 0,
      detail: { reason: 'no high-priority directives were raised by this run' },
    }
  }

  const orgIds = [...new Set(directives.map((d) => d.organization_id))]

  const { data: settings } = await db
    .from('machine_settings')
    .select('organization_id, enabled, notify_roles')
    .in('organization_id', orgIds)

  const settingsByOrg = new Map<string, SettingsRow>(
    (settings ?? []).map((s) => [s.organization_id, s as SettingsRow])
  )

  const { data: profiles } = await db
    .from('profiles')
    .select('id, organization_id, role')
    .in('organization_id', orgIds)

  const recipientsByOrg = new Map<string, string[]>()
  for (const orgId of orgIds) {
    const roles = settingsByOrg.get(orgId)?.notify_roles ?? ['owner', 'admin']
    const recipients = (profiles ?? [])
      .filter((p) => p.organization_id === orgId && roles.includes(p.role))
      .map((p) => p.id)

    // If nobody holds a nominated role, fall back to owners rather than
    // silently dropping the notification.
    if (recipients.length === 0) {
      const owners = (profiles ?? [])
        .filter((p) => p.organization_id === orgId && p.role === 'owner')
        .map((p) => p.id)
      recipientsByOrg.set(orgId, owners)
    } else {
      recipientsByOrg.set(orgId, recipients)
    }
  }

  let notificationsCreated = 0
  let orgsWithoutRecipients = 0
  const failures: Array<{ directive: string; error: string }> = []
  let stoppedEarly = false

  for (const directive of directives) {
    if (outOfBudget(context, 2000)) {
      stoppedEarly = true
      break
    }

    const recipients = recipientsByOrg.get(directive.organization_id) ?? []
    if (recipients.length === 0) {
      orgsWithoutRecipients += 1
      continue
    }

    if (context.dryRun) {
      notificationsCreated += recipients.length
      continue
    }

    const rows = recipients.map((profileId) => ({
      organization_id: directive.organization_id,
      profile_id: profileId,
      kind: directive.directive_type,
      severity: directive.priority === 'urgent' ? ('critical' as const) : ('high' as const),
      title: directive.title.slice(0, 300),
      // First paragraph only. The console holds the full reasoning.
      body: directive.reasoning.split('\n\n')[0]?.slice(0, 1000) ?? null,
      link: '/dashboard/machine',
      entity_type: 'machine_directive',
      entity_id: directive.id,
    }))

    const { error: insertError } = await db.from('notifications').insert(rows)

    if (insertError) {
      failures.push({ directive: directive.title.slice(0, 80), error: insertError.message })
      continue
    }

    notificationsCreated += rows.length
  }

  // One audit event per tenant per run, recording that it was told.
  if (!context.dryRun) {
    for (const orgId of orgIds) {
      const count = directives.filter((d) => d.organization_id === orgId).length
      await db.rpc('record_audit_event', {
        p_organization_id: orgId,
        p_actor_type: 'machine',
        p_action: 'machine.directives_dispatched',
        p_entity_type: 'machine_run',
        p_summary: `${count} high-priority directive(s) raised and dispatched`,
        p_metadata: { runId: context.runId, directiveCount: count },
        p_actor_label: 'AETHER autonomous engine',
      })
    }
  }

  return {
    status: failures.length === 0 ? 'succeeded' : notificationsCreated > 0 ? 'partial' : 'failed',
    itemsIn: directives.length,
    itemsOut: notificationsCreated,
    detail: {
      directivesConsidered: directives.length,
      notificationsCreated,
      organizationsNotified: orgIds.length - orgsWithoutRecipients,
      organizationsWithoutRecipients: orgsWithoutRecipients,
      failures: failures.slice(0, 20),
      stoppedEarly,
    },
  }
}
