'use server'

import { createClient } from '@/lib/supabase/server'
import { getDashboardContext } from '@/lib/dashboard/get-dashboard-context'

export type VerifyResult = {
  valid: boolean
  eventsChecked: number
  firstBadSeq?: number | null
  headHash?: string | null
  detail: string
}

/**
 * Recomputes the tenant's audit hash chain end to end.
 *
 * The work happens in `public.verify_audit_chain`, in the database, deliberately:
 * verifying in application code would mean shipping every event over the wire and
 * trusting the same layer that wrote them. Doing it in SQL means the check reads
 * the stored bytes directly.
 *
 * Read-only, so an auditor can run it — this is exactly the role that most needs
 * to.
 */
export async function verifyAuditChain(): Promise<VerifyResult> {
  let context
  try {
    context = await getDashboardContext()
  } catch {
    return {
      valid: false,
      eventsChecked: 0,
      detail: 'Your session has expired. Please sign in again.',
    }
  }

  if (!context.orgId) {
    return {
      valid: false,
      eventsChecked: 0,
      detail: 'Your account is not linked to an organization.',
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('verify_audit_chain', {
    p_organization_id: context.orgId,
  })

  if (error) {
    console.error('[audit] verification failed', error)
    return {
      valid: false,
      eventsChecked: 0,
      detail: `Verification could not be run: ${error.message}`,
    }
  }

  // The function is set-returning, so PostgREST hands back an array of one row.
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        valid: boolean
        events_checked: number
        first_bad_seq: number | null
        head_hash: string | null
        detail: string
      }
    | undefined

  if (!row) {
    return {
      valid: false,
      eventsChecked: 0,
      detail: 'Verification returned no result.',
    }
  }

  return {
    valid: row.valid,
    eventsChecked: Number(row.events_checked ?? 0),
    firstBadSeq: row.first_bad_seq,
    headHash: row.head_hash,
    detail: row.detail,
  }
}
