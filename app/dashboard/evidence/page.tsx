import { FolderLock } from 'lucide-react'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  EvidenceTable,
  type EvidenceRow,
} from '@/components/evidence/evidence-table'
import { EvidenceUploader } from '@/components/evidence/evidence-uploader'
import { validityState } from '@/lib/evidence/constants'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function EvidencePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null }

  const organizationId = profile?.organization_id ?? null
  const canReview = !!profile && ['owner', 'admin'].includes(profile.role)

  const { data: evidence, error } = await supabase
    .from('evidence')
    .select(
      `id, name, description, source, file_name, mime_type, size_bytes, storage_path, external_url,
       valid_until, review_status, reviewed_at, created_at,
       uploader:profiles!evidence_uploaded_by_fkey ( full_name, email ),
       evidence_links ( control_implementations ( controls ( control_ref ) ) )`
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[evidence] list', error)
  }

  const rows: EvidenceRow[] = (evidence ?? []).map((e) => {
    const uploader = Array.isArray(e.uploader) ? e.uploader[0] : e.uploader
    const refs = (e.evidence_links ?? []).flatMap((l) => {
      const ci = Array.isArray(l.control_implementations)
        ? l.control_implementations[0]
        : l.control_implementations
      const c = ci
        ? Array.isArray(ci.controls)
          ? ci.controls[0]
          : ci.controls
        : null
      return c?.control_ref ? [c.control_ref] : []
    })
    return {
      id: e.id,
      name: e.name,
      description: e.description,
      source: e.source,
      file_name: e.file_name,
      mime_type: e.mime_type,
      size_bytes: e.size_bytes,
      storage_path: e.storage_path,
      external_url: e.external_url,
      valid_until: e.valid_until,
      review_status: e.review_status,
      reviewed_at: e.reviewed_at,
      created_at: e.created_at,
      uploaded_by_name: uploader?.full_name ?? uploader?.email ?? null,
      linked_count: (e.evidence_links ?? []).length,
      linked_refs: [...new Set(refs)],
    }
  })

  const pending = rows.filter((r) => r.review_status === 'pending').length
  const expiring = rows.filter((r) => {
    const v = validityState(r.valid_until)
    return v === 'expired' || v === 'expiring'
  }).length
  const unlinked = rows.filter((r) => r.linked_count === 0).length

  return (
    <div className="mx-auto max-w-6xl">
      <h1
        className="text-3xl tracking-tight md:text-4xl"
        style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
      >
        Evidence Vault
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every artefact that demonstrates a control is in place — policies,
        screenshots, reports, tickets — stored privately for your organization
        and linked to the controls it supports.
      </p>

      {rows.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <span>{rows.length} items</span>
          <span>{pending} pending review</span>
          <span>{expiring} expired or expiring</span>
          <span>{unlinked} not linked to a control</span>
        </div>
      )}

      <div className="mt-6">
        {organizationId ? (
          <EvidenceUploader organizationId={organizationId} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No organization</CardTitle>
              <CardDescription>
                Your profile is not linked to an organization, so evidence
                cannot be stored yet.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <div className="mt-8">
        {rows.length === 0 ? (
          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5">
                <FolderLock className="h-5 w-5" />
              </div>
              <CardTitle>The vault is empty</CardTitle>
              <CardDescription>
                Upload your first file above, or add evidence directly from a
                control in one of your compliance programs. Owners and admins
                review each item; accepted evidence strengthens the AI
                readiness review.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <EvidenceTable rows={rows} canReview={canReview} />
        )}
      </div>
    </div>
  )
}
