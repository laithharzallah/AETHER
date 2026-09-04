'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Loader2 } from 'lucide-react'
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
import { Field, NativeSelect, ScaleSelect, Textarea, optionsFrom } from '@/components/erm/fields'
import {
  IMPACT_SCALE,
  LIKELIHOOD_SCALE,
  RISK_BAND_LABEL,
  RISK_TRENDS,
  RISK_TREND_LABEL,
  VELOCITY_SCALE,
  bandForScore,
} from '@/lib/erm/constants'
import { assessRisk } from '@/lib/actions/erm'

function ScoreReadout({ label, l, i }: { label: string; l: number | null; i: number | null }) {
  if (!l || !i) {
    return (
      <span className="text-xs text-muted-foreground">
        {label}: not scored
      </span>
    )
  }
  const score = l * i
  const band = bandForScore(score)
  return (
    <span className="text-xs tabular-nums">
      <span className="text-muted-foreground">{label}: </span>
      {l} × {i} = <span className="font-medium">{score}</span>
      {band && <span className="text-muted-foreground"> ({RISK_BAND_LABEL[band]})</span>}
    </span>
  )
}

export function AssessmentDialog({
  riskId,
  riskCode,
  current,
}: {
  riskId: string
  riskCode: string
  current: {
    inherentLikelihood: number | null
    inherentImpact: number | null
    residualLikelihood: number | null
    residualImpact: number | null
    targetLikelihood: number | null
    targetImpact: number | null
    velocity: number | null
    trend: string | null
  }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [il, setIl] = useState<number | null>(current.inherentLikelihood)
  const [ii, setIi] = useState<number | null>(current.inherentImpact)
  const [rl, setRl] = useState<number | null>(current.residualLikelihood)
  const [ri, setRi] = useState<number | null>(current.residualImpact)
  const [tl, setTl] = useState<number | null>(current.targetLikelihood)
  const [ti, setTi] = useState<number | null>(current.targetImpact)
  const [velocity, setVelocity] = useState<number | null>(current.velocity)
  const [trend, setTrend] = useState(current.trend ?? 'stable')
  const [rationale, setRationale] = useState('')

  const complete = il !== null && ii !== null && rl !== null && ri !== null
  const inverted = complete && rl! * ri! > il! * ii!

  function submit() {
    if (!complete) return
    startTransition(async () => {
      const result = await assessRisk({
        riskId,
        inherentLikelihood: il!,
        inherentImpact: ii!,
        residualLikelihood: rl!,
        residualImpact: ri!,
        targetLikelihood: tl,
        targetImpact: ti,
        velocity,
        trend,
        rationale,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Assessment recorded.')
      setRationale('')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <ClipboardCheck className="h-4 w-4" />
        Record assessment
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assess {riskCode}</DialogTitle>
          <DialogDescription>
            Scores are written to the register and a snapshot is added to the assessment
            history in the same transaction, so the history and the register cannot diverge.
            A re-affirmation with unchanged scores is still recorded as an assessment event.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Inherent likelihood" hint="Before controls.">
              <ScaleSelect scale={LIKELIHOOD_SCALE} value={il} onValueChange={setIl} />
            </Field>
            <Field label="Inherent impact">
              <ScaleSelect scale={IMPACT_SCALE} value={ii} onValueChange={setIi} />
            </Field>
            <Field label="Residual likelihood" hint="After the controls actually operating.">
              <ScaleSelect scale={LIKELIHOOD_SCALE} value={rl} onValueChange={setRl} />
            </Field>
            <Field label="Residual impact">
              <ScaleSelect scale={IMPACT_SCALE} value={ri} onValueChange={setRi} />
            </Field>
            <Field label="Target likelihood" hint="Post-treatment intent.">
              <ScaleSelect scale={LIKELIHOOD_SCALE} value={tl} onValueChange={setTl} />
            </Field>
            <Field label="Target impact">
              <ScaleSelect scale={IMPACT_SCALE} value={ti} onValueChange={setTi} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-muted/40 px-3 py-2">
            <ScoreReadout label="Inherent" l={il} i={ii} />
            <ScoreReadout label="Residual" l={rl} i={ri} />
            <ScoreReadout label="Target" l={tl} i={ti} />
          </div>

          {inverted && (
            <p className="text-xs text-danger">
              Residual risk exceeds inherent risk. Controls reduce exposure — revisit the
              inherent assessment before saving.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Velocity" hint="Speed with which the consequence lands.">
              <ScaleSelect scale={VELOCITY_SCALE} value={velocity} onValueChange={setVelocity} />
            </Field>
            <Field label="Trend">
              <NativeSelect value={trend} onChange={(e) => setTrend(e.target.value)}>
                {optionsFrom(RISK_TRENDS, RISK_TREND_LABEL)}
              </NativeSelect>
            </Field>
          </div>

          <Field
            label="Rationale"
            htmlFor="erm-assessment-rationale"
            hint="What evidence supports these scores? This is stored on the snapshot and is what a reviewer will read."
          >
            <Textarea
              id="erm-assessment-rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
            />
          </Field>
        </div>

        <DialogFooter showCloseButton>
          <Button type="button" onClick={submit} disabled={pending || !complete || inverted}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Record assessment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
