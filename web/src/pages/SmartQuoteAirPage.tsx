import { useState } from 'react'
import { Loader2, Plane, Zap } from 'lucide-react'
import { Badge, Button, Card } from '../components/ui'
import { SAMPLE_AIR_ENQUIRY } from '../lib/mock/data'
import { mockApi } from '../lib/mock/api'
import type { SmartQuoteDraft } from '../lib/types'
import { formatCurrency } from '../lib/utils'

export function SmartQuoteAirPage() {
  const [text, setText] = useState(SAMPLE_AIR_ENQUIRY)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<SmartQuoteDraft | null>(null)

  async function runAutomation() {
    setLoading(true)
    try {
      const result = await mockApi.runAirSmartQuote(text)
      setDraft(result)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[var(--color-atlas-air)]">
          <Plane className="h-5 w-5" />
          <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Smart Quote · Air</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Paste enquiry or upload later — rates resolve from mock Circulars tariffs.
        </p>
      </div>

      <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-white">
        <label className="block text-sm font-bold text-[var(--color-atlas-navy)]">
          Enquiry text
          <textarea
            className="mt-2 min-h-40 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={runAutomation} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Run automation
          </Button>
          <Button variant="secondary" onClick={() => setText(SAMPLE_AIR_ENQUIRY)}>
            Load sample
          </Button>
        </div>
      </Card>

      {draft ? (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={draft.tariffFound ? 'success' : 'warn'}>
              {draft.tariffFound ? 'Circulars tariff' : 'Manual rates needed'}
            </Badge>
            <Badge tone="info">{draft.parsed.confidence}% match</Badge>
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
              <dt className="text-[var(--color-text-muted)]">Carrier</dt>
              <dd className="font-bold">{draft.carrierLabel}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Packages</dt>
              <dd className="font-bold">{draft.parsed.packages.length || '—'}</dd>
            </div>
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
