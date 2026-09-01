export type UserRole = 'ganny' | 'manager' | 'pricing' | 'sales'

export interface AuthUser {
  id: string
  username: string
  displayName: string
  role: UserRole
  email: string
}

export interface EnquiryRecord {
  id: string
  ref: string
  customer: string
  mode: 'air' | 'sea' | 'courier' | 'transport' | 'warehouse'
  origin: string
  destination: string
  status: 'open' | 'quoted' | 'won' | 'lost'
  slaHoursOpen: number
  assignee: string
  createdAt: string
  grandTotal?: number
  currency?: string
}

export interface AirTariff {
  id: string
  carrier: string
  carrierCode: string
  origin: string
  destination: string
  breaks: Record<string, { sell: number; buy: number }>
  currency: string
}

export interface SeaTariff {
  id: string
  carrier: string
  carrierCode: string
  origin: string
  destination: string
  mode: 'fcl' | 'lcl' | 'bb'
  lclRate: { sell: number; buy: number }
  fclRates: Record<string, { sell: number; buy: number }>
  currency: string
}

export interface ParsedEnquiry {
  customer: string
  origin: string
  destination: string
  airline?: string
  airlineLabel?: string
  mode?: 'fcl' | 'lcl' | 'bb'
  linerLabel?: string
  grossWeight?: number
  volume?: number
  packages: Array<{ qty: number; gw?: number; l?: number; w?: number; h?: number }>
  containers: Array<{ type: string; qty: number }>
  confidence: number
  source: string
}

export interface SmartQuoteDraft {
  parsed: ParsedEnquiry
  tariffFound: boolean
  carrierLabel: string
  estimatedTotal?: number
  message: string
}
