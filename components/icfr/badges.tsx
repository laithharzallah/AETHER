import { Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  ASSERTION_LABEL,
  ASSERTION_SHORT,
  CONTROL_TYPE_LABEL,
  DEFICIENCY_STATUS_LABEL,
  FREQUENCY_LABEL,
  NATURE_LABEL,
  SEVERITY_LABEL,
  TEST_RESULT_LABEL,
  type Assertion,
  type ControlType,
  type DeficiencyStatus,
  type Frequency,
  type Nature,
  type Severity,
  type TestResult,
} from '@/lib/icfr/constants'
import { cn } from '@/lib/utils'

export function AssertionChips({
  assertions,
  full = false,
  className,
}: {
  assertions: string[]
  full?: boolean
  className?: string
}) {
  if (!assertions?.length) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {assertions.map((a) => (
        <Badge
          key={a}
          variant="outline"
          title={ASSERTION_LABEL[a as Assertion] ?? a}
          className="font-mono text-[10px]"
        >
          {full ? ASSERTION_LABEL[a as Assertion] ?? a : ASSERTION_SHORT[a as Assertion] ?? a}
        </Badge>
      ))}
    </div>
  )
}

export function ControlAttrBadges({
  controlType,
  nature,
  frequency,
}: {
  controlType: string
  nature: string
  frequency: string
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={controlType === 'preventive' ? 'secondary' : 'outline'}>
        {CONTROL_TYPE_LABEL[controlType as ControlType] ?? controlType}
      </Badge>
      <Badge variant="outline">{NATURE_LABEL[nature as Nature] ?? nature}</Badge>
      <Badge variant="ghost" className="border-border/60">
        {FREQUENCY_LABEL[frequency as Frequency] ?? frequency}
      </Badge>
    </div>
  )
}

export function KeyStar({ isKey, className }: { isKey: boolean; className?: string }) {
  return (
    <Star
      aria-label={isKey ? 'Key control' : 'Non-key control'}
      className={cn(
        'h-3.5 w-3.5',
        isKey ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/40',
        className
      )}
    />
  )
}

const RESULT_CLASS: Record<TestResult, string> = {
  effective: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  effective_with_exceptions: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  ineffective: 'bg-red-500/10 text-red-700 dark:text-red-400',
  not_tested: 'bg-muted text-muted-foreground',
}

export function ResultBadge({
  result,
  className,
}: {
  result: string | null | undefined
  className?: string
}) {
  const r = (result ?? 'not_tested') as TestResult
  return (
    <Badge
      variant="ghost"
      className={cn('border-transparent', RESULT_CLASS[r] ?? RESULT_CLASS.not_tested, className)}
    >
      {TEST_RESULT_LABEL[r] ?? r}
    </Badge>
  )
}

const SEVERITY_CLASS: Record<Severity, string> = {
  deficiency: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  significant_deficiency: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  material_weakness: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

export function SeverityBadge({ severity }: { severity: string }) {
  const s = severity as Severity
  return (
    <Badge variant="ghost" className={cn('border-transparent', SEVERITY_CLASS[s] ?? '')}>
      {SEVERITY_LABEL[s] ?? severity}
    </Badge>
  )
}

const DEF_STATUS_VARIANT: Record<
  DeficiencyStatus,
  'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
> = {
  open: 'destructive',
  in_remediation: 'secondary',
  remediated: 'outline',
  closed: 'ghost',
}

export function DeficiencyStatusBadge({ status }: { status: string }) {
  const s = status as DeficiencyStatus
  return (
    <Badge variant={DEF_STATUS_VARIANT[s] ?? 'outline'}>
      {DEFICIENCY_STATUS_LABEL[s] ?? status}
    </Badge>
  )
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
