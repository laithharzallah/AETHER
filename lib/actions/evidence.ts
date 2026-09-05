'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { safeExternalUrl } from '@/lib/security/urls'
import {
  EVIDENCE_BUCKET,
  type EvidenceSource,
} from '@/lib/evidence/constants'

export type EvidenceActionResult =
  | { ok: true }
  | { ok: false; error: string }

export type CreateEvidenceInput = {
  name: string
  description?: string | null
  storagePath?: string | null
  fileName?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  source: EvidenceSource
  externalUrl?: string | null
  validUntil?: string | null
  /** Optionally link the new record to a control implementation right away. */
  implementationId?: string | null
}

export type CreatedEvidence = {
  id: string
  name: string
  review_status: string
  file_name: string | null
  valid_until: string | null
}

function revalidateEvidence(programId?: string | null) {
  revalidatePath('/dashboard/evidence')
  revalidatePath('/dashboard/programs')
  if (programId) revalidatePath(`/dashboard/programs/${programId}`)
}

export async function createEvidenceRecord(
  input: CreateEvidenceInput
): Promise<{ ok: true; data: CreatedEvidence } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const name = input.name?.trim()
  if (!name) return { ok: false, error: 'Evidence name is required.' }
  if (!['upload', 'link', 'note'].includes(input.source)) {
    return { ok: false, error: 'Invalid evidence source.' }
  }
  if (input.source === 'link' && !input.externalUrl?.trim()) {
    return { ok: false, error: 'A URL is required for linked evidence.' }
  }
  if (input.source === 'upload' && !input.storagePath) {
    return { ok: false, error: 'Upload path is missing.' }
  }
  const externalUrl = safeExternalUrl(input.externalUrl)
  if ((input.source === 'link' || input.externalUrl) && !externalUrl) {
    return { ok: false, error: 'Enter a valid HTTP or HTTPS evidence URL.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { ok: false, error: 'Your profile is not linked to an organization.' }
  }

  // The storage object must live under this tenant's folder.
  if (
    input.storagePath &&
    !input.storagePath.startsWith(`${profile.organization_id}/`)
  ) {
    return { ok: false, error: 'Invalid storage path.' }
  }

  const { data, error } = await supabase
    .from('evidence')
    .insert({
      organization_id: profile.organization_id,
      name,
      description: input.description?.trim() || null,
      storage_path: input.storagePath || null,
      file_name: input.fileName || null,
      mime_type: input.mimeType || null,
      size_bytes: input.sizeBytes ?? null,
      source: input.source,
      external_url: externalUrl,
      valid_until: input.validUntil?.trim() || null,
      uploaded_by: user.id,
    })
    .select('id, name, review_status, file_name, valid_until')
    .single()

  if (error || !data) {
    console.error('[createEvidenceRecord]', error)
    return { ok: false, error: 'Could not save the evidence record.' }
  }

  let programId: string | null = null
  if (input.implementationId) {
    const { error: linkError } = await supabase
      .from('evidence_links')
      .insert({
        evidence_id: data.id,
        control_implementation_id: input.implementationId,
      })
    if (linkError) {
      console.error('[createEvidenceRecord] link', linkError)
    } else {
      const { data: impl } = await supabase
        .from('control_implementations')
        .select('program_id')
        .eq('id', input.implementationId)
        .maybeSingle()
      programId = impl?.program_id ?? null
    }
  }

  revalidateEvidence(programId)
  return { ok: true, data }
}

async function programIdForImplementation(
  implementationId: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('control_implementations')
    .select('program_id')
    .eq('id', implementationId)
    .maybeSingle()
  return data?.program_id ?? null
}

export async function linkEvidence(
  evidenceId: string,
  implementationId: string
): Promise<EvidenceActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('evidence_links').insert({
    evidence_id: evidenceId,
    control_implementation_id: implementationId,
  })

  if (error && error.code !== '23505') {
    console.error('[linkEvidence]', error)
    return { ok: false, error: 'Could not link evidence.' }
  }

  revalidateEvidence(await programIdForImplementation(implementationId))
  return { ok: true }
}

export async function unlinkEvidence(
  evidenceId: string,
  implementationId: string
): Promise<EvidenceActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('evidence_links')
    .delete()
    .eq('evidence_id', evidenceId)
    .eq('control_implementation_id', implementationId)

  if (error) {
    console.error('[unlinkEvidence]', error)
    return { ok: false, error: 'Could not unlink evidence.' }
  }

  revalidateEvidence(await programIdForImplementation(implementationId))
  return { ok: true }
}

export async function reviewEvidence(
  id: string,
  decision: 'accepted' | 'rejected'
): Promise<EvidenceActionResult> {
  if (decision !== 'accepted' && decision !== 'rejected') {
    return { ok: false, error: 'Invalid decision.' }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return { ok: false, error: 'Only owners and admins can review evidence.' }
  }

  const { error } = await supabase
    .from('evidence')
    .update({
      review_status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[reviewEvidence]', error)
    return { ok: false, error: 'Could not update review status.' }
  }

  revalidateEvidence()
  return { ok: true }
}

export async function deleteEvidence(id: string): Promise<EvidenceActionResult> {
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('evidence')
    .select('id, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Evidence not found.' }

  const { data: deleted, error } = await supabase
    .from('evidence')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('[deleteEvidence]', error)
    return { ok: false, error: 'Could not delete evidence.' }
  }
  if (!deleted || deleted.length === 0) {
    return { ok: false, error: 'Only owners and admins can delete evidence.' }
  }

  if (row.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .remove([row.storage_path])
    if (storageError) {
      console.error('[deleteEvidence] storage', storageError)
    }
  }

  revalidateEvidence()
  return { ok: true }
}

export async function getEvidenceDownloadUrl(
  id: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: row } = await supabase
    .from('evidence')
    .select('storage_path, external_url, file_name')
    .eq('id', id)
    .maybeSingle()

  if (!row) return { ok: false, error: 'Evidence not found.' }
  if (!row.storage_path) {
    if (row.external_url) {
      const url = safeExternalUrl(row.external_url)
      return url
        ? { ok: true, url }
        : { ok: false, error: 'This evidence link is not a valid HTTP or HTTPS URL.' }
    }
    return { ok: false, error: 'This evidence has no file attached.' }
  }

  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(row.storage_path, 60, {
      download: row.file_name ?? undefined,
    })

  if (error || !data?.signedUrl) {
    console.error('[getEvidenceDownloadUrl]', error)
    return { ok: false, error: 'Could not create a download link.' }
  }
  return { ok: true, url: data.signedUrl }
}
