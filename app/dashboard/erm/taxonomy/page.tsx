import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ImportTaxonomyButton, TaxonomyPanel } from '@/components/erm/taxonomy-panel'
import { getTaxonomy, listCategories } from '@/lib/erm/queries'

export const dynamic = 'force-dynamic'

export default async function ErmTaxonomyPage() {
  const [{ tree, templateCount, imported }, categories] = await Promise.all([
    getTaxonomy(),
    listCategories(),
  ])

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    code: c.code,
    name_en: c.name_en,
    level: c.level,
    parent_id: c.parent_id,
  }))

  const level1 = tree.length
  const level2 = tree.reduce((n, t) => n + t.children.length, 0)

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/dashboard/erm"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Enterprise Risk
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Risk taxonomy</h1>
          <p className="page-lede mt-3 max-w-2xl">
            A common vocabulary is what lets a portfolio view exist at all. Level 1 is the
            risk domain the board reports against; level 2 is where risks are actually
            classified. The template is GCC-flavoured and bilingual.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {imported === 0
              ? 'Nothing imported yet.'
              : `${level1} domains, ${level2} sub-categories in use.`}
          </p>
        </div>
        <ImportTaxonomyButton templateCount={templateCount} />
      </div>

      <div className="mt-8">
        <TaxonomyPanel tree={tree} categories={categoryOptions} />
      </div>
    </div>
  )
}
