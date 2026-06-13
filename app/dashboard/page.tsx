import Link from 'next/link'
import { ArrowRight, FileText } from 'lucide-react'
import { getDashboardContext } from '@/lib/dashboard/get-dashboard-context'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default async function DashboardOverviewPage() {
  const { orgName, fullName } = await getDashboardContext()

  return (
    <div className="mx-auto max-w-3xl">
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
        <Card className="transition-colors hover:border-border">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5">
              <FileText className="h-5 w-5" />
            </div>
            <CardTitle>Policy Generator</CardTitle>
            <CardDescription>
              Draft GCC-aligned policies tailored to your organization and
              regulatory frameworks.
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
      </div>
    </div>
  )
}
