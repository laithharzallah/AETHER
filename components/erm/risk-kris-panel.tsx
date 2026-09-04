'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { KriPill } from '@/components/erm/badges'
import { KriSparkline } from '@/components/erm/charts'
import { KriFormDialog, RecordReadingDialog } from '@/components/erm/kri-dialogs'
import {
  KRI_DIRECTION_LABEL,
  KRI_FREQUENCY_LABEL,
  type KriDirection,
  type KriFrequency,
} from '@/lib/erm/constants'
import { deleteKri } from '@/lib/actions/erm'
import type { KriRow } from '@/lib/erm/queries'

export function RiskKrisPanel({
  riskId,
  kris,
  members,
}: {
  riskId: string
  kris: KriRow[]
  members: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteKri(id, riskId)
      if (!result.ok) toast.error(result.error)
      else {
        toast.success('KRI removed.')
        router.refresh()
      }
    })
  }

  return (
    <div className="surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="eyebrow">Monitoring</p>
          <h2 className="mt-1 text-base font-medium">Key risk indicators</h2>
        </div>
        <KriFormDialog
          riskId={riskId}
          members={members}
          trigger={
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Add KRI
            </Button>
          }
        />
      </div>

      {kris.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No indicator is monitoring this risk. Without a KRI the register reports a point-in-
          time judgement with nothing tracking movement between assessments.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {kris.map((k) => (
            <li key={k.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <KriPill status={k.status_rag} />
                    <span className="font-medium">{k.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {k.frequency && KRI_FREQUENCY_LABEL[k.frequency as KriFrequency]}
                    {k.direction && <> · {KRI_DIRECTION_LABEL[k.direction as KriDirection]}</>}
                    {' · '}Amber {Number(k.amber_threshold)} · Red {Number(k.red_threshold)}
                    {k.data_source && <> · Source: {k.data_source}</>}
                  </p>
                  <p className="mt-1.5 text-sm tabular-nums">
                    {k.latest_value === null ? (
                      <span className="text-muted-foreground">No reading recorded</span>
                    ) : (
                      <>
                        Latest{' '}
                        <span className="font-medium">{Number(k.latest_value)}</span>
                        {k.unit && <span className="text-muted-foreground"> {k.unit}</span>}
                        <span className="text-muted-foreground">
                          {' '}
                          as at {k.latest_period} · {k.reading_count} readings ·{' '}
                          {k.breaches} breach {k.breaches === 1 ? 'period' : 'periods'}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <KriSparkline
                    readings={k.readings}
                    amber={k.amber_threshold === null ? null : Number(k.amber_threshold)}
                    red={k.red_threshold === null ? null : Number(k.red_threshold)}
                  />
                  <div className="flex items-center gap-1">
                    {k.id && (
                      <RecordReadingDialog
                        kriId={k.id}
                        kriName={k.name ?? 'Indicator'}
                        unit={k.unit}
                        direction={k.direction}
                        amber={k.amber_threshold === null ? null : Number(k.amber_threshold)}
                        red={k.red_threshold === null ? null : Number(k.red_threshold)}
                        trigger={
                          <Button variant="outline" size="xs">
                            Record reading
                          </Button>
                        }
                      />
                    )}
                    {k.id && (
                      <KriFormDialog
                        riskId={riskId}
                        members={members}
                        kriId={k.id}
                        initial={{
                          riskId,
                          name: k.name ?? '',
                          description: '',
                          unit: k.unit ?? '',
                          direction: k.direction ?? 'higher_is_worse',
                          greenThreshold:
                            k.green_threshold === null ? null : Number(k.green_threshold),
                          amberThreshold: Number(k.amber_threshold ?? 0),
                          redThreshold: Number(k.red_threshold ?? 0),
                          frequency: k.frequency ?? 'monthly',
                          ownerId: k.owner_id ?? '',
                          dataSource: k.data_source ?? '',
                        }}
                        trigger={
                          <Button variant="ghost" size="xs">
                            Edit
                          </Button>
                        }
                      />
                    )}
                    {k.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={pending}
                        onClick={() => remove(k.id as string)}
                        aria-label={`Remove ${k.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
