import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ControlsExplorer } from '@/components/regulations/controls-explorer'
import {
  CATEGORY_LABELS,
  JURISDICTION_LABELS,
  getFrameworkByCode,
} from '@/lib/regulatory-library/queries'

export const dynamic = 'force-dynamic'

export default async function FrameworkPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const result = await getFrameworkByCode(decodeURIComponent(code))

  if (!result) {
    notFound()
  }

  const { framework, controls } = result

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/dashboard/regulations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Regulatory Library
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {JURISDICTION_LABELS[framework.jurisdiction ?? ''] ??
            framework.jurisdiction}
        </Badge>
        <Badge variant="outline">
          {CATEGORY_LABELS[framework.category ?? ''] ?? framework.category}
        </Badge>
        {framework.mandatory ? (
          <Badge variant="secondary">Mandatory</Badge>
        ) : (
          <Badge variant="ghost">Voluntary</Badge>
        )}
        {framework.version && (
          <span className="text-xs text-muted-foreground">
            Version {framework.version}
          </span>
        )}
        {framework.effective_date && (
          <span className="text-xs text-muted-foreground">
            Effective {framework.effective_date}
          </span>
        )}
      </div>

      <h1
        className="mt-3 text-3xl tracking-tight md:text-4xl"
        style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
      >
        {framework.name_en}
      </h1>
      {framework.name_ar && (
        <p dir="rtl" lang="ar" className="mt-1 text-lg text-muted-foreground">
          {framework.name_ar}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{framework.regulator_en}</span>
        {framework.regulator_ar && (
          <span dir="rtl" lang="ar">
            {framework.regulator_ar}
          </span>
        )}
        {framework.source_url && (
          <a
            href={framework.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            Primary source
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {framework.description_en && (
        <p className="mt-5 max-w-3xl leading-relaxed text-foreground/90">
          {framework.description_en}
        </p>
      )}

      <div className="mt-8">
        <ControlsExplorer
          frameworkCode={framework.code ?? ''}
          frameworkName={framework.short_name ?? ''}
          controls={controls}
        />
      </div>
    </div>
  )
}
