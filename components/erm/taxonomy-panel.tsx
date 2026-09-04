'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, NativeSelect, TextInput, Textarea } from '@/components/erm/fields'
import {
  createCategory,
  deleteCategory,
  importTaxonomy,
  updateCategory,
  type CategoryInput,
} from '@/lib/actions/erm'
import type { CategoryNode } from '@/lib/erm/queries'
import type { CategoryOption } from '@/components/erm/risk-register-table'

function CategoryDialog({
  categories,
  initial,
  categoryId,
  trigger,
}: {
  categories: CategoryOption[]
  initial?: CategoryInput
  categoryId?: string
  trigger: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<CategoryInput>(
    initial ?? {
      code: '',
      nameEn: '',
      nameAr: '',
      parentId: '',
      description: '',
      sortOrder: 0,
    }
  )

  function set<K extends keyof CategoryInput>(key: K, value: CategoryInput[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function submit() {
    startTransition(async () => {
      const result = categoryId
        ? await updateCategory(categoryId, values)
        : await createCategory(values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(categoryId ? 'Category updated.' : 'Category added.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{categoryId ? 'Edit category' : 'Add a risk category'}</DialogTitle>
          <DialogDescription>
            Level 1 is a risk domain; level 2 is a sub-category within it. A category with a
            parent is created at level 2 automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" hint="Letters, numbers, hyphen, underscore.">
              <TextInput
                value={values.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="TEC-06"
              />
            </Field>
            <Field label="Parent">
              <NativeSelect
                value={values.parentId ?? ''}
                onChange={(e) => set('parentId', e.target.value)}
              >
                <option value="">None — level 1 domain</option>
                {categories
                  .filter((c) => c.level === 1 && c.id !== categoryId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name_en}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Name (English)">
            <TextInput value={values.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
          </Field>
          <Field label="Name (Arabic)">
            <TextInput
              dir="rtl"
              value={values.nameAr ?? ''}
              onChange={(e) => set('nameAr', e.target.value)}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={values.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
            />
          </Field>
          <Field label="Sort order" className="w-32">
            <TextInput
              type="number"
              value={values.sortOrder ?? 0}
              onChange={(e) => set('sortOrder', Number(e.target.value))}
            />
          </Field>
        </div>

        <DialogFooter showCloseButton>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || !values.code.trim() || !values.nameEn.trim()}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ImportTaxonomyButton({ templateCount }: { templateCount: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run() {
    startTransition(async () => {
      const result = await importTaxonomy()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const n = result.data?.inserted ?? 0
      toast.success(
        n === 0
          ? 'Taxonomy already imported — no new categories added.'
          : `${n} categories imported.`
      )
      router.refresh()
    })
  }

  return (
    <Button variant="outline" onClick={run} disabled={pending || templateCount === 0}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Import from template ({templateCount})
    </Button>
  )
}

export function TaxonomyPanel({
  tree,
  categories,
}: {
  tree: CategoryNode[]
  categories: CategoryOption[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteCategory(id)
      if (!result.ok) toast.error(result.error)
      else {
        toast.success('Category removed.')
        router.refresh()
      }
    })
  }

  if (tree.length === 0) {
    return (
      <div className="surface p-6 text-center">
        <p className="font-medium">No taxonomy imported</p>
        <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
          Import the global GCC risk taxonomy to start with eight risk domains and their
          sub-categories in English and Arabic, then tailor them to the organisation.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tree.map((node) => (
        <div key={node.id} className="surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                  {node.code}
                </code>
                <h3 className="font-medium">{node.name_en}</h3>
                {node.name_ar && (
                  <span className="text-sm text-muted-foreground" dir="rtl" lang="ar">
                    {node.name_ar}
                  </span>
                )}
                <span className="pill pill-neutral">
                  {node.risk_count} {node.risk_count === 1 ? 'risk' : 'risks'}
                </span>
              </div>
              {node.description && (
                <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
                  {node.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <CategoryDialog
                categories={categories}
                categoryId={node.id}
                initial={{
                  code: node.code,
                  nameEn: node.name_en,
                  nameAr: node.name_ar ?? '',
                  parentId: node.parent_id ?? '',
                  description: node.description ?? '',
                  sortOrder: node.sort_order,
                }}
                trigger={
                  <Button variant="ghost" size="xs">
                    Edit
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => remove(node.id)}
                aria-label={`Remove ${node.name_en}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {node.children.length > 0 && (
            <ul className="mt-3 divide-y divide-border/60 border-t border-border/60">
              {node.children.map((child) => (
                <li key={child.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {child.code}
                      </code>
                      <span>{child.name_en}</span>
                      {child.name_ar && (
                        <span className="text-muted-foreground" dir="rtl" lang="ar">
                          {child.name_ar}
                        </span>
                      )}
                    </div>
                    {child.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {child.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <CategoryDialog
                      categories={categories}
                      categoryId={child.id}
                      initial={{
                        code: child.code,
                        nameEn: child.name_en,
                        nameAr: child.name_ar ?? '',
                        parentId: child.parent_id ?? '',
                        description: child.description ?? '',
                        sortOrder: child.sort_order,
                      }}
                      trigger={
                        <Button variant="ghost" size="xs">
                          Edit
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      onClick={() => remove(child.id)}
                      aria-label={`Remove ${child.name_en}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3">
            <CategoryDialog
              categories={categories}
              initial={{
                code: '',
                nameEn: '',
                nameAr: '',
                parentId: node.id,
                description: '',
                sortOrder: node.sort_order + 1,
              }}
              trigger={
                <Button variant="ghost" size="xs">
                  <Plus className="h-3.5 w-3.5" />
                  Add sub-category
                </Button>
              }
            />
          </div>
        </div>
      ))}

      <CategoryDialog
        categories={categories}
        trigger={
          <Button variant="outline" size="sm">
            <Plus className="h-3.5 w-3.5" />
            Add risk domain
          </Button>
        }
      />
    </div>
  )
}
