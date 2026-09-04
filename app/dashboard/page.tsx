import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileText,
  FolderLock,
  Scale,
  ScrollText,
  Sparkles,
} from 'lucide-react'
import { getDashboardContext } from '@/lib/dashboard/get-dashboard-context'
import { getLibraryStats } from '@/lib/regulatory-library/queries'
import { listPrograms } from '@/lib/programs/queries'
import { getIcfrDashboard } from '@/lib/icfr/queries'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
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
  const supabase = await createClient()
  const [{ orgName, fullName }, stats, programs, icfr, policyCountRes, evidenceCountRes] =
    await Promise.all([
      getDashboardContext(),
      getLibraryStats(),
      listPrograms(),
      getIcfrDashboard(),
      supabase.from('policies').select('id', { count: 'exact', head: true }),
      supabase.from('evidence').select('id', { count: 'exact', head: true }),
    ])

  const policyCount = policyCountRes.count ?? 0
  const evidenceCount = evidenceCountRes.count ?? 0
  const activePrograms = programs.filter((p) => p.status === 'active')
  const avgReadiness =
    activePrograms.length > 0
      ? Math.round(
          activePrograms.reduce((n, p) => n + (p.readiness_pct ?? 0), 0) / activePrograms.length
        )
      : null

  return (
    <div className="mx-auto max-w-5xl">
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

      {/* Posture strip */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Compliance readiness"
          value={avgReadiness === null ? '—' : `${avgReadiness}%`}
          hint={
            activePrograms.length === 0
              ? 'No active programs yet'
              : `${activePrograms.length} active program${activePrograms.length === 1 ? '' : 's'}`
          }
          href="/dashboard/programs"
        />
        <Stat
          label="Key controls effective"
          value={icfr.keyControls === 0 ? '—' : `${icfr.keyEffectivePct}%`}
          hint={
            icfr.keyControls === 0
              ? 'No ICFR processes yet'
              : `${icfr.keyEffective} of ${icfr.keyControls} key controls`
          }
          href="/dashboard/icfr"
        />
        <Stat
          label="Open deficiencies"
          value={icfr.openDeficiencies.toString()}
          hint={
            icfr.bySeverity.material_weakness > 0
              ? `${icfr.bySeverity.material_weakness} material weakness${icfr.bySeverity.material_weakness === 1 ? '' : 'es'}`
              : icfr.overdueRemediations > 0
                ? `${icfr.overdueRemediations} overdue remediation${icfr.overdueRemediations === 1 ? '' : 's'}`
                : 'None overdue'
          }
          href="/dashboard/icfr/deficiencies"
          tone={icfr.bySeverity.material_weakness > 0 ? 'danger' : icfr.openDeficiencies > 0 ? 'warn' : 'default'}
        />
        <Stat
          label="Evidence on file"
          value={evidenceCount.toString()}
          hint={`${policyCount} polic${policyCount === 1 ? 'y' : 'ies'} in library`}
          href="/dashboard/evidence"
        />
      </div>

      {/* Programs */}
      {programs.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              Programs
            </h2>
            <Link href="/dashboard/programs" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {programs.slice(0, 4).map((p) => (
              <Link key={p.id} href={`/dashboard/programs/${p.id}`} className="group block">
                <Card className="transition-colors group-hover:border-border">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.framework_short_name} · {p.framework_jurisdiction}
                        </p>
                      </div>
                      <Badge variant={p.status === 'active' ? 'secondary' : 'ghost'} className="capitalize">
                        {p.status}
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground transition-all"
                          style={{ width: `${p.readiness_pct ?? 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium tabular-nums">{p.readiness_pct ?? 0}%</span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                      {p.implemented ?? 0} implemented · {p.in_progress ?? 0} in progress ·{' '}
                      {p.not_started ?? 0} not started
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Modules */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Modules
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            icon={Sparkles}
            title="Ask AETHER"
            description="A GRC advisor that reads the library and your policies before answering, in English or Arabic, with every claim cited."
            href="/dashboard/assistant"
            cta="Start a conversation"
            primary
          />
          <ModuleCard
            icon={ClipboardCheck}
            title="Compliance Programs"
            description="Adopt any framework as a program. Track every control's status, owner and evidence; run an AI readiness review."
            href="/dashboard/programs"
            cta={programs.length > 0 ? 'Open programs' : 'Start a program'}
          />
          <ModuleCard
            icon={Scale}
            title="ICFR"
            description={
              icfr.processes > 0
                ? `${icfr.processes} process${icfr.processes === 1 ? '' : 'es'}, ${icfr.controls} controls, ${icfr.keyTestedPct}% of key controls tested.`
                : 'COSO-based risk-control matrices, design and operating tests, deficiency log. Import a cycle template or generate one with AI.'
            }
            href="/dashboard/icfr"
            cta="Open ICFR"
          />
          <ModuleCard
            icon={BookOpen}
            title="Regulatory Library"
            description={
              stats.controls > 0
                ? `${stats.controls.toLocaleString()} controls across ${stats.frameworks} frameworks and ${stats.jurisdictions} jurisdictions, EN/AR.`
                : 'GCC and international frameworks at control level, in English and Arabic.'
            }
            href="/dashboard/regulations"
            cta="Browse library"
          />
          <ModuleCard
            icon={FileText}
            title="Policy Generator"
            description="Draft board-grade policies that cite real control identifiers from the library, then save them with mappings."
            href="/dashboard/policy-generator"
            cta="Generate a policy"
          />
          <ModuleCard
            icon={FolderLock}
            title="Evidence"
            description="Upload, review and expire evidence; link every file to the controls it supports."
            href="/dashboard/evidence"
            cta="Open vault"
          />
        </div>
      </section>

      {policyCount > 0 && (
        <p className="mt-8 text-sm text-muted-foreground">
          <ScrollText className="mr-1.5 inline h-3.5 w-3.5" />
          {policyCount} saved polic{policyCount === 1 ? 'y' : 'ies'} ·{' '}
          <Link href="/dashboard/policies" className="underline-offset-4 hover:underline">
            open the policy library
          </Link>
        </p>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  href,
  tone = 'default',
}: {
  label: string
  value: string
  hint: string
  href: string
  tone?: 'default' | 'warn' | 'danger'
}) {
  return (
    <Link href={href} className="group block">
      <Card className="transition-colors group-hover:border-border">
        <CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              'mt-1 text-2xl font-semibold tracking-tight tabular-nums',
              tone === 'warn' && 'text-amber-600 dark:text-amber-400',
              tone === 'danger' && 'text-red-600 dark:text-red-400'
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function ModuleCard({
  icon: Icon,
  title,
  description,
  href,
  cta,
  primary = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  href: string
  cta: string
  primary?: boolean
}) {
  return (
    <Card
      className={cn(
        'flex flex-col transition-colors hover:border-border',
        primary && 'border-foreground/15 bg-foreground/[0.02]'
      )}
    >
      <CardHeader className="flex-1">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href={href}
          className={cn(buttonVariants({ variant: primary ? 'default' : 'outline' }))}
        >
          {cta}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
