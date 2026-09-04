import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppetitePanel } from '@/components/erm/appetite-panel'
import { getAppetite, listCategories } from '@/lib/erm/queries'

export const dynamic = 'force-dynamic'

export default async function ErmAppetitePage() {
  const [rows, categories] = await Promise.all([getAppetite(), listCategories()])

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    code: c.code,
    name_en: c.name_en,
    level: c.level,
    parent_id: c.parent_id,
  }))

  const breaches = rows.reduce((n, r) => n + r.breach_count, 0)
  const unapproved = rows.filter((r) => !r.approved_at).length

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/dashboard/erm"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Enterprise Risk
      </Link>

      <div className="mt-4">
        <h1 className="page-title">Risk appetite</h1>
        <p className="page-lede mt-3 max-w-3xl">
          Appetite is the amount and type of risk the organisation is willing to accept in
          pursuit of its objectives; tolerance is the acceptable variation around it,
          expressed here as the residual score above which a risk must be escalated. The CMA
          Corporate Governance Regulations place responsibility for setting and overseeing
          this with the board, and SAMA expects supervised entities to evidence the same.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {rows.length} statements in force · {breaches} risks currently above tolerance
          {unapproved > 0 && (
            <span className="text-warning-foreground">
              {' '}
              · {unapproved} not formally approved
            </span>
          )}
        </p>
      </div>

      <div className="mt-8">
        <AppetitePanel rows={rows} categories={categoryOptions} />
      </div>
    </div>
  )
}
