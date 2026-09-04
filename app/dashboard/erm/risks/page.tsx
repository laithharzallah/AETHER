import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { RiskRegisterTable } from '@/components/erm/risk-register-table'
import { RiskFormDialog } from '@/components/erm/risk-form-dialog'
import { IdentifyRisksDialog } from '@/components/erm/identify-risks-dialog'
import { getRiskRegister, listCategories, listMembers } from '@/lib/erm/queries'

export const dynamic = 'force-dynamic'

export default async function ErmRegisterPage() {
  const [rows, categories, members] = await Promise.all([
    getRiskRegister(),
    listCategories(),
    listMembers(),
  ])

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    code: c.code,
    name_en: c.name_en,
    level: c.level,
    parent_id: c.parent_id,
  }))
  const categoryNames = Object.fromEntries(categories.map((c) => [c.code, c.name_en]))

  const open = rows.filter((r) => r.status !== 'closed')
  const breaches = open.filter((r) => r.appetite_breach).length

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/dashboard/erm"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Enterprise Risk
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Risk register</h1>
          <p className="page-lede mt-3 max-w-2xl">
            {rows.length} risks recorded, {open.length} open, {breaches} outside appetite.
            Movement compares the latest assessment snapshot with the one before it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IdentifyRisksDialog categoryNames={categoryNames} />
          <RiskFormDialog categories={categoryOptions} members={members} />
        </div>
      </div>

      <div className="mt-8">
        <RiskRegisterTable rows={rows} categories={categoryOptions} owners={members} />
      </div>
    </div>
  )
}
