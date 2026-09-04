import Link from 'next/link'
import { ArrowRight, CalendarDays, ClipboardCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  NewProgramDialog,
  type FrameworkOption,
} from '@/components/programs/new-program-dialog'
import { ReadinessBar } from '@/components/programs/readiness-bar'
import { listPrograms, PROGRAM_STATUSES } from '@/lib/programs/queries'
import {
  JURISDICTION_LABELS,
  listFrameworks,
} from '@/lib/regulatory-library/queries'

export const dynamic = 'force-dynamic'

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
> = {
  active: 'default',
  paused: 'secondary',
  completed: 'outline',
  archived: 'ghost',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function ProgramsPage() {
  const [programs, frameworks] = await Promise.all([
    listPrograms(),
    listFrameworks(),
  ])

  const frameworkOptions: FrameworkOption[] = frameworks.flatMap((f) =>
    f.id && f.code
      ? [
          {
            id: f.id,
            code: f.code,
            shortName: f.short_name ?? f.code,
            name: f.name_en ?? f.short_name ?? f.code,
            jurisdiction: f.jurisdiction ?? 'INTL',
            controlCount: f.control_count ?? 0,
          },
        ]
      : []
  )

  const existingFrameworkIds = programs
    .filter((p) => !p.client_workspace_id && p.framework_id)
    .map((p) => p.framework_id as string)

  const totalControls = programs.reduce((n, p) => n + (p.total_controls ?? 0), 0)
  const totalImplemented = programs.reduce((n, p) => n + (p.implemented ?? 0), 0)

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-3xl tracking-tight md:text-4xl"
            style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
          >
            Compliance Programs
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Track how your organization implements each framework, control by
            control, with owners, due dates and evidence.
          </p>
        </div>
        <NewProgramDialog
          frameworks={frameworkOptions}
          existingFrameworkIds={existingFrameworkIds}
        />
      </div>

      {programs.length > 0 && (
        <p className="mt-6 text-xs text-muted-foreground tabular-nums">
          {programs.length} program{programs.length === 1 ? '' : 's'} ·{' '}
          {totalImplemented.toLocaleString()} of {totalControls.toLocaleString()}{' '}
          controls implemented
        </p>
      )}

      {programs.length === 0 ? (
        <Card className="mt-10">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <CardTitle>No programs yet</CardTitle>
            <CardDescription>
              A program is your organization&apos;s adoption of one framework
              (for example NCA ECC or ISO 27001). Creating one copies every
              control from the Regulatory Library into a control matrix where
              you set status, assign owners, add notes and attach evidence.
              Readiness is calculated from implemented controls, excluding
              those you mark not applicable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewProgramDialog
              frameworks={frameworkOptions}
              existingFrameworkIds={existingFrameworkIds}
              variant="outline"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {programs.map((p) => {
            const pct = p.readiness_pct ?? 0
            const statusLabel =
              PROGRAM_STATUSES.find((s) => s.value === p.status)?.label ??
              p.status
            return (
              <Link
                key={p.id}
                href={`/dashboard/programs/${p.id}`}
                className="group block"
              >
                <Card className="h-full transition-colors group-hover:border-border">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{p.framework_short_name}</Badge>
                      <Badge variant="ghost">
                        {JURISDICTION_LABELS[p.framework_jurisdiction ?? ''] ??
                          p.framework_jurisdiction}
                      </Badge>
                      <Badge variant={STATUS_VARIANT[p.status ?? ''] ?? 'outline'}>
                        {statusLabel}
                      </Badge>
                    </div>
                    <CardTitle className="mt-2 flex items-center justify-between gap-3">
                      <span className="truncate">{p.name}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                    {p.description && (
                      <CardDescription className="line-clamp-2">
                        {p.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between gap-3">
                      <p className="text-2xl font-semibold tabular-nums tracking-tight">
                        {pct}%
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          ready
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {p.implemented ?? 0} / {(p.total_controls ?? 0) - (p.not_applicable ?? 0)}{' '}
                        applicable controls
                      </p>
                    </div>
                    <ReadinessBar pct={pct} className="mt-2" />
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                      <span>{p.in_progress ?? 0} in progress</span>
                      <span>{p.not_started ?? 0} not started</span>
                      <span>{p.not_applicable ?? 0} N/A</span>
                      {p.target_date && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(p.target_date)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
