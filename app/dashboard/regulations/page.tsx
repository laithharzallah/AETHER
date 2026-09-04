import Link from 'next/link'
import { ArrowRight, BookOpen, CheckCircle2, Globe2, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  CATEGORY_LABELS,
  JURISDICTION_LABELS,
  listFrameworks,
} from '@/lib/regulatory-library/queries'

export const dynamic = 'force-dynamic'

export default async function RegulationsPage() {
  const frameworks = await listFrameworks()

  const totalControls = frameworks.reduce(
    (n, f) => n + (f.control_count ?? 0),
    0
  )
  const jurisdictions = new Set(frameworks.map((f) => f.jurisdiction)).size

  const grouped = new Map<string, typeof frameworks>()
  for (const f of frameworks) {
    const key = f.jurisdiction ?? 'INTL'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(f)
  }

  const jurisdictionOrder = ['SA', 'AE', 'QA', 'JO', 'BH', 'KW', 'OM', 'EU', 'INTL']
  const orderedKeys = [...grouped.keys()].sort(
    (a, b) => jurisdictionOrder.indexOf(a) - jurisdictionOrder.indexOf(b)
  )

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="page-title">
        Regulatory Library
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Control-level coverage of GCC and international frameworks, in English
        and Arabic. Every policy AETHER generates is grounded in this library.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={BookOpen}
          label="Frameworks"
          value={frameworks.length.toString()}
        />
        <StatCard
          icon={ShieldCheck}
          label="Controls"
          value={totalControls.toLocaleString()}
        />
        <StatCard
          icon={Globe2}
          label="Jurisdictions"
          value={jurisdictions.toString()}
        />
      </div>

      {frameworks.length === 0 && (
        <Card className="mt-10">
          <CardHeader>
            <CardTitle>Library not seeded yet</CardTitle>
            <CardDescription>
              Run <code className="rounded bg-muted px-1.5 py-0.5">supabase db push</code>{' '}
              to apply the regulatory library migrations, then refresh.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {orderedKeys.map((jurisdiction) => (
        <section key={jurisdiction} className="mt-10">
          <h2 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            {JURISDICTION_LABELS[jurisdiction] ?? jurisdiction}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {grouped.get(jurisdiction)!.map((f) => (
              <Link
                key={f.id}
                href={`/dashboard/regulations/${encodeURIComponent(f.code ?? '')}`}
                className="group block"
              >
                <Card className="h-full transition-colors group-hover:border-border">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {CATEGORY_LABELS[f.category ?? ''] ?? f.category}
                      </Badge>
                      {f.mandatory ? (
                        <Badge variant="secondary">Mandatory</Badge>
                      ) : (
                        <Badge variant="ghost">Voluntary</Badge>
                      )}
                      {f.version && (
                        <span className="text-xs text-muted-foreground">
                          v{f.version}
                        </span>
                      )}
                    </div>
                    <CardTitle className="mt-2 flex items-center justify-between gap-3">
                      <span>{f.short_name}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {f.name_en}
                    </CardDescription>
                    {f.name_ar && (
                      <p
                        dir="rtl"
                        lang="ar"
                        className="text-sm text-muted-foreground"
                      >
                        {f.name_ar}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{f.regulator_en}</span>
                      <span className="tabular-nums">
                        {(f.control_count ?? 0).toLocaleString()} controls
                      </span>
                      <span className="tabular-nums">
                        {f.domain_count ?? 0} domains
                      </span>
                      {(f.verified_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          {f.verified_count} verified
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="icon-tile">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
