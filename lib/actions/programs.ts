'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type {
  ImplementationStatus,
  ProgramStatus,
} from '@/lib/programs/queries'

const IMPLEMENTATION_STATUSES: ImplementationStatus[] = [
  'not_started',
  'in_progress',
  'implemented',
  'not_applicable',
]

const PROGRAM_STATUSES: ProgramStatus[] = [
  'active',
  'paused',
  'completed',
  'archived',
]

export type ActionResult = { ok: true } | { ok: false; error: string }
export type ActionResultWith<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function revalidateProgram(programId?: string) {
  revalidatePath('/dashboard/programs')
  revalidatePath('/dashboard')
  if (programId) revalidatePath(`/dashboard/programs/${programId}`)
}

export async function createProgram(
  frameworkId: string,
  name: string,
  targetDate?: string | null,
  description?: string | null
): Promise<ActionResultWith<{ programId: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const trimmed = name?.trim()
  if (!frameworkId) return { ok: false, error: 'Select a framework.' }
  if (!trimmed) return { ok: false, error: 'Program name is required.' }

  const { data, error } = await supabase.rpc('create_program', {
    p_framework_id: frameworkId,
    p_name: trimmed,
    p_target_date: targetDate?.trim() || null,
    p_description: description?.trim() || null,
  })

  if (error || !data) {
    console.error('[createProgram]', error)
    if (error?.code === '23505') {
      return {
        ok: false,
        error: 'A program for this framework already exists.',
      }
    }
    return { ok: false, error: 'Could not create the program.' }
  }

  revalidateProgram(data)
  return { ok: true, data: { programId: data } }
}

export type ImplementationPatch = {
  status?: ImplementationStatus
  ownerId?: string | null
  dueDate?: string | null
  notes?: string | null
  naJustification?: string | null
}

export async function updateImplementation(
  id: string,
  patch: ImplementationPatch
): Promise<ActionResult> {
  const supabase = await createClient()

  const update: {
    status?: ImplementationStatus
    owner_id?: string | null
    due_date?: string | null
    notes?: string | null
    na_justification?: string | null
    last_reviewed_at: string
  } = { last_reviewed_at: new Date().toISOString() }

  if (patch.status !== undefined) {
    if (!IMPLEMENTATION_STATUSES.includes(patch.status)) {
      return { ok: false, error: 'Invalid status.' }
    }
    update.status = patch.status
  }
  if (patch.ownerId !== undefined) update.owner_id = patch.ownerId || null
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate || null
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null
  if (patch.naJustification !== undefined) {
    update.na_justification = patch.naJustification?.trim() || null
  }

  const { data, error } = await supabase
    .from('control_implementations')
    .update(update)
    .eq('id', id)
    .select('program_id')
    .maybeSingle()

  if (error || !data) {
    console.error('[updateImplementation]', error)
    return { ok: false, error: 'Could not save the control.' }
  }

  revalidateProgram(data.program_id)
  return { ok: true }
}

export async function bulkUpdateStatus(
  programId: string,
  implementationIds: string[],
  status: ImplementationStatus
): Promise<ActionResultWith<{ updated: number }>> {
  if (!IMPLEMENTATION_STATUSES.includes(status)) {
    return { ok: false, error: 'Invalid status.' }
  }
  if (implementationIds.length === 0) {
    return { ok: false, error: 'No controls selected.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('control_implementations')
    .update({ status, last_reviewed_at: new Date().toISOString() })
    .eq('program_id', programId)
    .in('id', implementationIds)
    .select('id')

  if (error) {
    console.error('[bulkUpdateStatus]', error)
    return { ok: false, error: 'Could not update the selected controls.' }
  }

  revalidateProgram(programId)
  return { ok: true, data: { updated: data?.length ?? 0 } }
}

export async function updateProgramStatus(
  programId: string,
  status: ProgramStatus
): Promise<ActionResult> {
  if (!PROGRAM_STATUSES.includes(status)) {
    return { ok: false, error: 'Invalid status.' }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('programs')
    .update({ status })
    .eq('id', programId)

  if (error) {
    console.error('[updateProgramStatus]', error)
    return { ok: false, error: 'Could not update program status.' }
  }

  revalidateProgram(programId)
  return { ok: true }
}

export async function deleteProgram(programId: string): Promise<void> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('programs')
    .delete()
    .eq('id', programId)
    .select('id')

  if (error) {
    console.error('[deleteProgram]', error)
    throw new Error('Could not delete program.')
  }
  if (!data || data.length === 0) {
    throw new Error('Only owners and admins can delete programs.')
  }

  revalidateProgram()
  redirect('/dashboard/programs')
}
