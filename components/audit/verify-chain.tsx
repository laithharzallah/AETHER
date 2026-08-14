'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react'
import { verifyAuditChain, type VerifyResult } from '@/lib/actions/audit'
import { Button } from '@/components/ui/button'

/**
 * Runs chain verification on demand.
 *
 * Deliberately user-initiated rather than computed on page load: recomputing the
 * chain is linear in the number of events, and an integrity check the reader did
 * not ask for is one they have no particular reason to believe actually ran.
 */
export function VerifyChain({ eventCount }: { eventCount: number }) {
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [pending, setPending] = useState(false)

  async function verify() {
    setPending(true)
    setResult(null)
    try {
      setResult(await verifyAuditChain())
    } catch {
      setResult({
        valid: false,
        eventsChecked: 0,
        detail: 'Verification could not be run.',
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Integrity</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Each event is chained to the one before it with SHA-256 over its canonical
            serialisation. Verification recomputes the whole chain and reports the first
            event that does not reconcile, so removing, reordering or editing any entry
            is detectable — including by someone with direct database access.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={verify}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-1.5 h-4 w-4" />
          )}
          Verify {eventCount > 0 ? `${eventCount} events` : 'chain'}
        </Button>
      </div>

      {result && (
        <div
          role="status"
          className={
            result.valid
              ? 'mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm'
              : 'mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm'
          }
        >
          {result.valid ? (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div className="min-w-0">
            <p className="font-medium">
              {result.valid ? 'Chain intact' : 'Chain integrity failure'}
            </p>
            <p className="mt-0.5 text-muted-foreground">{result.detail}</p>
            {result.firstBadSeq != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                First inconsistency at sequence {result.firstBadSeq}. Every event from
                that point onward is unverifiable.
              </p>
            )}
            {result.valid && result.headHash && (
              <p className="mt-1 font-mono text-[10px] break-all text-muted-foreground">
                head: {result.headHash}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
