import Link from 'next/link'
import { ArrowRight, FileText, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  archived: 'Archived',
}

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
> = {
  draft: 'outline',
  in_review: 'secondary',
  approved: 'default',
  archived: 'ghost',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function PoliciesPage() {
  const supabase = await createClient()
  const { data: policies, error } = await supabase
    .from('policies')
    .select(
      'id, title, policy_type, frameworks, status, version, created_at, updated_at, policy_control_mappings ( control_id )'
    )
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[policies] list', error)
  }

  const rows = policies ?? []

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">
            Policies
          </h1>
          <p className="mt-3 text-muted-foreground">
            Your organization&apos;s policy library. Generated policies are
            saved here with their framework and control mappings.
          </p>
        </div>
        <Link
          href="/dashboard/policy-generator"
          className={cn(buttonVariants({ variant: 'default' }))}
        >
          <Plus className="mr-1 h-4 w-4" />
          New policy
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card className="mt-10">
          <CardHeader>
            <div className="mb-2 icon-tile">
              <FileText className="h-5 w-5" />
            </div>
            <CardTitle>No policies yet</CardTitle>
            <CardDescription>
              Generate your first policy and save it to the library. Saved
              policies keep their control mappings, so you can trace every
              statement back to a regulatory requirement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/policy-generator"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              Open Policy Generator
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-[11px] tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Policy</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                  Frameworks
                </th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                  Controls
                </th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const mapped = Array.isArray(p.policy_control_mappings)
                  ? p.policy_control_mappings.length
                  : 0
                return (
                  <tr
                    key={p.id}
                    className="border-t border-border transition-colors hover:bg-primary/[0.03]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/policies/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.policy_type} · v{p.version}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(p.frameworks ?? []).map((f) => (
                          <Badge key={f} variant="outline">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 tabular-nums sm:table-cell">
                      {mapped}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[p.status] ?? 'outline'}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {formatDate(p.updated_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
