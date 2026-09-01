import { useEffect, useRef } from 'react'
import { Badge, Card } from './ui'
import type { SmartQuoteDraft } from '../lib/types'
import { formatCurrency } from '../lib/utils'

export function SmartQuoteResult({
  draft,
  error,
  mode,
}: {
  draft: SmartQuoteDraft | null
  error: string | null
  mode: 'air' | 'sea'
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if ((draft || error) && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [draft, error])

  if (!draft && !error) return null

  return (
    <div ref={ref} aria-live="polite" data-testid="smart-quote-result">
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-800">{error}</p>
        </Card>
      ) : null}
      {draft ? (
        <Card className={error ? 'mt-4' : ''}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={draft.tariffFound ? 'success' : 'warn'}>
              {draft.tariffFound ? 'Circulars tariff' : 'Manual rates needed'}
            </Badge>
            <Badge tone="info">{draft.parsed.confidence}% match</Badge>
            {draft.parsed.mode ? <Badge tone="neutral">{draft.parsed.mode.toUpperCase()}</Badge> : null}
          </div>
          <p className="mt-3 text-sm font-semibold text-[var(--color-atlas-navy)]">{draft.message}</p>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-[var(--color-text-muted)]">Route</dt>
              <dd className="font-bold">
                {draft.parsed.origin} → {draft.parsed.destination}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Customer</dt>
              <dd className="font-bold">{draft.parsed.customer || '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">{mode === 'air' ? 'Carrier' : 'Liner'}</dt>
              <dd className="font-bold">{draft.carrierLabel}</dd>
            </div>
            {mode === 'air' ? (
              <div>
                <dt className="text-[var(--color-text-muted)]">Packages</dt>
                <dd className="font-bold">{draft.parsed.packages.length || '—'}</dd>
              </div>
            ) : (
              <div>
                <dt className="text-[var(--color-text-muted)]">Containers</dt>
                <dd className="font-bold">
                  {draft.parsed.containers.length
                    ? draft.parsed.containers.map((c) => `${c.qty}×${c.type}`).join(', ')
                    : '—'}
                </dd>
              </div>
            )}
            {draft.estimatedTotal ? (
              <div>
                <dt className="text-[var(--color-text-muted)]">Est. freight (mock)</dt>
                <dd className="text-lg font-extrabold text-emerald-700">
                  {formatCurrency(draft.estimatedTotal)}
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>
      ) : null}
    </div>
  )
}
