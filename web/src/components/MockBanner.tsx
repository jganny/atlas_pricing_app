import { FlaskConical } from 'lucide-react'
import { mockApi } from '../lib/mock/api'

export function MockBanner() {
  const label = mockApi.getEnvironmentLabel()
  const isMock = label.toLowerCase().includes('mock')

  if (!isMock) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-xs font-bold text-amber-950">
      <FlaskConical className="h-3.5 w-3.5" />
      {label} — no Firebase connection · demo data only · deploy blocked until you approve
    </div>
  )
}
