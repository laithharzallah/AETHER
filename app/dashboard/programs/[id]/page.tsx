import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ControlMatrix } from '@/components/programs/control-matrix'
import { ProgramActions } from '@/components/programs/program-actions'
import { ReadinessBar } from '@/components/programs/readiness-bar'
import { ReadinessReview } from '@/components/programs/readiness-review'
import { getProgram } from '@/lib/programs/queries'
import { JURISDICTION_LABELS } from '@/lib/regulatory-library/queries'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getProgram(id)
  if (!detail) notFound()

  const { program, implementations, members, evidenceOptions, organizationId } =
    detail

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    : { data: null }
  const canDelete = !!me && ['owner', 'admin'].includes(me.role)

  const total = program.total_controls ?? implementations.length
  const na = program.not_applicable ?? 0
  const applicable = total - na
  const pct = program.readiness_pct ?? 0
  const withEvidence = implementations.filter((i) => i.evidence.length > 0).length
  const overdue = implementations.filter(
    (i) =>
      i.due_date &&
      i.status !== 'implemented' &&
      i.status !== 'not_applicable' &&
      new Date(`${i.due_date}T23:59:59`) < new Date()
  ).length

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/dashboard/programs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Programs
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/regulations/${encodeURIComponent(program.framework_code ?? '')}`}
              className="inline-flex"
            >
              <Badge variant="outline" className="hover:bg-muted">
                {program.framework_short_name}
              </Badge>
            </Link>
            <Badge variant="ghost">
              {JURISDICTION_LABELS[program.framework_jurisdiction ?? ''] ??
                program.framework_jurisdiction}
            </Badge>
            {program.target_date && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                Target {formatDate(program.target_date)}
              </span>
            )}
          </div>
          <h1
            className="mt-3 text-3xl tracking-tight md:text-4xl"
            style={{ fontFamily: 'var(--font-instrument-serif), serif' }}
          >
            {program.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {program.description ||
              `${program.framework_name_en ?? ''} · created ${program.created_at ? formatDate(program.created_at) : ''}`}
          </p>
        </div>
        <ProgramActions
          programId={program.id!}
          status={program.status ?? 'active'}
          canDelete={canDelete}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Readiness
              </p>
              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">
                {pct}%
              </p>
            </div>
            <p className="text-right text-xs text-muted-foreground tabular-nums">
              {program.implemented ?? 0} of {applicable} applicable controls
              implemented
              <br />
              {na} marked not applicable
            </p>
          </div>
          <ReadinessBar pct={pct} size="md" className="mt-3" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
          <Stat label="Implemented" value={program.implemented ?? 0} tone="good" />
          <Stat label="In progress" value={program.in_progress ?? 0} tone="warn" />
          <Stat label="Not started" value={program.not_started ?? 0} />
          <Stat label="Overdue" value={overdue} tone={overdue > 0 ? 'bad' : undefined} />
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground tabular-nums">
        {withEvidence} of {total} controls have linked evidence.
      </p>

      <div className="mt-6">
        <ReadinessReview
          programId={program.id!}
          disabled={implementations.length === 0}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-medium tracking-tight">Control matrix</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Set status, owner and due date inline. Expand a control for notes,
          N/A justification and evidence.
        </p>
        <ControlMatrix
          programId={program.id!}
          frameworkCode={program.framework_code ?? ''}
          organizationId={organizationId}
          implementations={implementations}
          members={members}
          evidenceOptions={evidenceOptions}
        />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'good' | 'warn' | 'bad'
}) {
  const toneClass =
    tone === 'good'
      ? 'text-green-600 dark:text-green-500'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'bad'
          ? 'text-red-600 dark:text-red-400'
          : ''
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <p className={`text-2xl font-semibold tabular-nums tracking-tight ${toneClass}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
