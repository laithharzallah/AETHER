import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/database.types'

export type ProgramSummary = Tables<'program_summary'>

import type { ImplementationStatus, ProgramStatus } from '@/lib/programs/constants'
export type { ImplementationStatus, ProgramStatus }
export { IMPLEMENTATION_STATUSES, PROGRAM_STATUSES } from '@/lib/programs/constants'

export type OrgMember = {
  id: string
  full_name: string | null
  email: string | null
}

export type LinkedEvidence = {
  id: string
  name: string
  review_status: string
  file_name: string | null
  valid_until: string | null
}

export type ImplementationControl = {
  id: string
  control_ref: string
  title_en: string
  title_ar: string | null
  domain_en: string | null
  domain_ar: string | null
  subdomain_en: string | null
  requirement_en: string
  criticality: string | null
  sort_order: number
}

export type Implementation = {
  id: string
  status: ImplementationStatus
  owner_id: string | null
  due_date: string | null
  notes: string | null
  na_justification: string | null
  last_reviewed_at: string | null
  control: ImplementationControl
  owner: OrgMember | null
  evidence: LinkedEvidence[]
}

export type EvidenceOption = {
  id: string
  name: string
  review_status: string
}

export type ProgramDetail = {
  program: ProgramSummary
  implementations: Implementation[]
  members: OrgMember[]
  evidenceOptions: EvidenceOption[]
  organizationId: string
}

export async function listPrograms(): Promise<ProgramSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('program_summary')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[programs] listPrograms', error)
    return []
  }
  return data ?? []
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function getProgram(id: string): Promise<ProgramDetail | null> {
  const supabase = await createClient()

  const { data: program, error: programError } = await supabase
    .from('program_summary')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (programError) {
    console.error('[programs] getProgram', programError)
  }
  if (!program?.id || !program.organization_id) return null

  const [implRes, membersRes, evidenceRes] = await Promise.all([
    supabase
      .from('control_implementations')
      .select(
        `id, status, owner_id, due_date, notes, na_justification, last_reviewed_at,
         controls ( id, control_ref, title_en, title_ar, domain_en, domain_ar, subdomain_en, requirement_en, criticality, sort_order ),
         owner:profiles!control_implementations_owner_id_fkey ( id, full_name, email ),
         evidence_links ( evidence ( id, name, review_status, file_name, valid_until ) )`
      )
      .eq('program_id', id),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', program.organization_id)
      .order('full_name', { ascending: true }),
    supabase
      .from('evidence')
      .select('id, name, review_status')
      .eq('organization_id', program.organization_id)
      .order('created_at', { ascending: false }),
  ])

  if (implRes.error) {
    console.error('[programs] implementations', implRes.error)
  }
  if (membersRes.error) {
    console.error('[programs] members', membersRes.error)
  }
  if (evidenceRes.error) {
    console.error('[programs] evidence options', evidenceRes.error)
  }

  const implementations: Implementation[] = (implRes.data ?? []).flatMap(
    (row) => {
      const control = one(row.controls)
      if (!control) return []
      const owner = one(row.owner)
      const evidence: LinkedEvidence[] = (row.evidence_links ?? []).flatMap(
        (link) => {
          const e = one(link.evidence)
          return e ? [e] : []
        }
      )
      return [
        {
          id: row.id,
          status: row.status as ImplementationStatus,
          owner_id: row.owner_id,
          due_date: row.due_date,
          notes: row.notes,
          na_justification: row.na_justification,
          last_reviewed_at: row.last_reviewed_at,
          control,
          owner,
          evidence,
        },
      ]
    }
  )

  implementations.sort(
    (a, b) =>
      a.control.sort_order - b.control.sort_order ||
      a.control.control_ref.localeCompare(b.control.control_ref, undefined, {
        numeric: true,
      })
  )

  return {
    program,
    implementations,
    members: membersRes.data ?? [],
    evidenceOptions: evidenceRes.data ?? [],
    organizationId: program.organization_id,
  }
}
