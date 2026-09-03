import Link from 'next/link'
import { ArrowRight, BookOpen, FileText, ScrollText, Sparkles } from 'lucide-react'
import { getDashboardContext } from '@/lib/dashboard/get-dashboard-context'
import { getLibraryStats } from '@/lib/regulatory-library/queries'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardOverviewPage() {
  const [{ orgName, fullName }, stats, supabase] = await Promise.all([
    getDashboardContext(),
    getLibraryStats(),
    createClient(),
  ])

  const { count: policyCount } = await supabase
    .from('policies')
    .select('id', { count: 'exact', head: true })

  return (
    <div className="mx-auto max-w-4xl">
      <h1
        className="text-4xl tracking-tight md:text-5xl"
        style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
      >
        Welcome to AETHER
      </h1>
      <p className="mt-3 text-muted-foreground">
        {fullName ? `${fullName} · ` : ''}
        {orgName ?? 'Your organization'}
      </p>

      <div className="mt-10">
        <Card className="border-foreground/15 bg-foreground/[0.02] transition-colors hover:border-border">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5">
              <Sparkles className="h-5 w-5" />
            </div>
            <CardTitle>Ask AETHER</CardTitle>
            <CardDescription>
              A GRC advisor that reads the regulatory library and your saved
              policies before answering, in English or Arabic, with every claim
              cited to a control.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/assistant"
              className={cn(buttonVariants({ variant: 'default' }))}
            >
              Start a conversation
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card className="transition-colors hover:border-border">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5">
              <BookOpen className="h-5 w-5" />
            </div>
            <CardTitle>Regulatory Library</CardTitle>
            <CardDescription>
              {stats.controls > 0
                ? `${stats.controls.toLocaleString()} controls across ${stats.frameworks} frameworks and ${stats.jurisdictions} jurisdictions.`
                : 'GCC and international frameworks at control level, in English and Arabic.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/regulations"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              Browse library
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="transition-colors hover:border-border">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5">
              <FileText className="h-5 w-5" />
            </div>
            <CardTitle>Policy Generator</CardTitle>
            <CardDescription>
              Draft board-grade policies that cite real control identifiers
              from the library.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/policy-generator"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              Generate a policy
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="transition-colors hover:border-border">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5">
              <ScrollText className="h-5 w-5" />
            </div>
            <CardTitle>Policies</CardTitle>
            <CardDescription>
              {policyCount && policyCount > 0
                ? `${policyCount} saved polic${policyCount === 1 ? 'y' : 'ies'} with control mappings.`
                : 'Your saved policies, each traceable to regulatory requirements.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/policies"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              Open policies
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
