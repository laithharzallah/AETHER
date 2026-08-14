'use client'

import { useActionState, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Loader2, Play, X } from 'lucide-react'
import {
  acknowledgeDirective,
  actOnDirective,
  dismissDirective,
  type ActionState,
} from '@/lib/actions/machine'
import { Button } from '@/components/ui/button'
import { Pill, PriorityPill, StatusPill } from '@/components/dashboard/pills'
import { formatRelativeDays } from '@/lib/dashboard/format'

export type DirectiveView = {
  id: string
  title: string
  reasoning: string
  directive_type: string
  priority: string
  urgency_score: number
  confidence: number
  status: string
  subject_type: string
  subject_label: string | null
  evidence: unknown
  recommended_actions: unknown
  created_at: string | null
  resulting_task_id: string | null
  dismissal_reason: string | null
}

type RecommendedAction = {
  label: string
  description: string
  creates?: string
}

function parseActions(value: unknown): RecommendedAction[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const record = entry as Record<string, unknown>
    if (typeof record.label !== 'string') return []
    return [
      {
        label: record.label,
        description: typeof record.description === 'string' ? record.description : '',
        creates: typeof record.creates === 'string' ? record.creates : undefined,
      },
    ]
  })
}

function parseEvidence(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null
  )
}

export function DirectiveCard({
  directive,
  canWrite,
}: {
  directive: DirectiveView
  canWrite: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [showDismiss, setShowDismiss] = useState(false)

  const [ackState, ackAction, ackPending] = useActionState<ActionState, FormData>(
    acknowledgeDirective,
    {}
  )
  const [actState, actAction, actPending] = useActionState<ActionState, FormData>(
    actOnDirective,
    {}
  )
  const [dismissState, dismissAction, dismissPending] = useActionState<
    ActionState,
    FormData
  >(dismissDirective, {})

  const actions = parseActions(directive.recommended_actions)
  const evidence = parseEvidence(directive.evidence)
  const taskActionIndex = actions.findIndex((a) => a.creates === 'task')

  const message = ackState.error ?? actState.error ?? dismissState.error
  const success = ackState.success ?? actState.success ?? dismissState.success

  const isResolved = ['actioned', 'dismissed', 'expired'].includes(directive.status)

  return (
    <article
      id={directive.id}
      className="scroll-mt-20 rounded-xl bg-card ring-1 ring-foreground/10"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={directive.priority} />
            <Pill>{directive.directive_type.replace(/_/g, ' ')}</Pill>
            {directive.status !== 'open' && <StatusPill status={directive.status} />}
            <span
              className="text-xs text-muted-foreground tabular-nums"
              title={`Urgency ${(directive.urgency_score * 100).toFixed(0)}%, confidence ${(directive.confidence * 100).toFixed(0)}%`}
            >
              {(directive.urgency_score * 100).toFixed(0)}% urgency
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeDays(directive.created_at)}
            </span>
          </div>

          <h3 className="mt-2 text-sm font-medium">{directive.title}</h3>

          {directive.subject_label && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {directive.subject_type.replace(/_/g, ' ')}: {directive.subject_label}
            </p>
          )}

          <p
            className={
              expanded
                ? 'mt-3 text-sm whitespace-pre-line text-muted-foreground'
                : 'mt-3 line-clamp-3 text-sm text-muted-foreground'
            }
          >
            {directive.reasoning}
          </p>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Reasoning and evidence
              </>
            )}
          </button>

          {expanded && evidence.length > 0 && (
            <div className="mt-3 rounded-lg bg-foreground/[0.03] p-3">
              <p className="mb-2 text-xs font-medium">Evidence</p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {evidence.map((item, index) => (
                  <li key={index} className="break-words">
                    {Object.entries(item)
                      .filter(([, value]) => value !== null && value !== undefined)
                      .map(([key, value]) => (
                        <span key={key} className="mr-3 inline-block">
                          <span className="text-foreground/60">{key}:</span>{' '}
                          {typeof value === 'string' && value.startsWith('http') ? (
                            <a
                              href={value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-2"
                            >
                              {value.length > 60 ? `${value.slice(0, 60)}…` : value}
                            </a>
                          ) : (
                            String(value)
                          )}
                        </span>
                      ))}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {expanded && actions.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium">Recommended actions</p>
              <ol className="space-y-2 text-xs text-muted-foreground">
                {actions.map((action, index) => (
                  <li key={index}>
                    <span className="font-medium text-foreground">{action.label}.</span>{' '}
                    {action.description}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {directive.dismissal_reason && (
            <p className="mt-3 rounded-lg bg-foreground/[0.03] p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Dismissed:</span>{' '}
              {directive.dismissal_reason}
            </p>
          )}

          {(message || success) && (
            <p
              role="status"
              className={
                message
                  ? 'mt-3 text-xs text-destructive'
                  : 'mt-3 text-xs text-emerald-600 dark:text-emerald-400'
              }
            >
              {message ?? success}
            </p>
          )}
        </div>

        {canWrite && !isResolved && (
          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
            {taskActionIndex >= 0 && (
              <form action={actAction}>
                <input type="hidden" name="directiveId" value={directive.id} />
                <input type="hidden" name="actionIndex" value={taskActionIndex} />
                <Button type="submit" size="sm" disabled={actPending}>
                  {actPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Create task
                </Button>
              </form>
            )}

            {directive.status === 'open' && (
              <form action={ackAction}>
                <input type="hidden" name="directiveId" value={directive.id} />
                <Button type="submit" size="sm" variant="outline" disabled={ackPending}>
                  {ackPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Acknowledge
                </Button>
              </form>
            )}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowDismiss((v) => !v)}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Dismiss
            </Button>
          </div>
        )}
      </div>

      {showDismiss && canWrite && !isResolved && (
        <form action={dismissAction} className="border-t border-border/60 p-4">
          <label htmlFor={`reason-${directive.id}`} className="text-xs font-medium">
            Why is this not applicable?
          </label>
          <p className="mt-1 mb-2 text-xs text-muted-foreground">
            Recorded in the audit trail. A dismissal with no reason is
            indistinguishable from an oversight when this is read back in a year.
          </p>
          <input type="hidden" name="directiveId" value={directive.id} />
          <textarea
            id={`reason-${directive.id}`}
            name="reason"
            rows={2}
            required
            minLength={5}
            placeholder="e.g. This framework was descoped by the board in June; see decision log DL-114."
            className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <div className="mt-2 flex gap-2">
            <Button type="submit" size="sm" variant="outline" disabled={dismissPending}>
              {dismissPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Confirm dismissal
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowDismiss(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </article>
  )
}
