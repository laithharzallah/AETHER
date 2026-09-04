import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ProcessActions } from '@/components/icfr/process-actions'
import { ProcessWorkspace } from '@/components/icfr/process-workspace'
import { getProcess } from '@/lib/icfr/queries'

export const dynamic = 'force-dynamic'

export default async function IcfrProcessPage({
  params,
}: {
  params: Promise<{ processId: string }>
}) {
  const { processId } = await params
  const detail = await getProcess(processId)
  if (!detail) notFound()

  const { process, risks, controls, members } = detail
  const keyControls = controls.filter((c) => c.is_key && c.status !== 'retired')
  const tested = keyControls.filter(
    (c) => c.latest_operating && c.latest_operating.result !== 'not_tested'
  ).length
  const effective = keyControls.filter((c) => c.latest_operating?.result === 'effective').length
  const openDefs = controls.reduce((n, c) => n + c.open_deficiency_count, 0)

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/dashboard/icfr"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        ICFR
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              {process.code}
            </code>
            {process.cycle && <Badge variant="outline">{process.cycle}</Badge>}
            <Badge variant={process.status === 'active' ? 'default' : 'ghost'}>
              {process.status}
            </Badge>
          </div>
          <h1 className="page-title mt-3">
            {process.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Owner: {process.owner?.name ?? 'Unassigned'} · {risks.length} risks ·{' '}
            {controls.length} controls ({keyControls.length} key) · {tested}/{keyControls.length}{' '}
            key controls tested, {effective} effective · {openDefs} open deficienc
            {openDefs === 1 ? 'y' : 'ies'}
          </p>
          {process.description && (
            <p className="mt-3 max-w-3xl text-sm text-foreground/80">{process.description}</p>
          )}
        </div>
        <ProcessActions process={process} members={members} />
      </div>

      <div className="mt-8">
        <ProcessWorkspace detail={detail} />
      </div>
    </div>
  )
}
