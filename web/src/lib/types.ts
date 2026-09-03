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
  status: 'open' | 'quoted' | 'won' | 'lost' | 'cancelled'
  slaHoursOpen: number
  assignee: string
  createdAt: string
  grandTotal?: number
  currency?: string
}

/** Full Firestore quote document (legacy-compatible shape) */
export interface SavedQuote {
  id: string
  quoteNumber?: string | number
  customer: string
  creator: string
  status: string
  type: string
  date?: string
  timestamp?: number
  amount?: number
  amountINR?: number
  currency?: string
  route?: string
  routingDetails?: string
  grossProfit?: number
  grossProfitCurrency?: string
  grossProfitINR?: number
  notes?: string
  mode?: string
  details?: Record<string, unknown>
  shipperName?: string
  shipperPhone?: string
  shipperEmail?: string
  shipperAddress?: string
  consigneeName?: string
  consigneePhone?: string
  consigneeEmail?: string
  consigneeAddress?: string
  commodity?: string
  conversionDate?: string
}

export type QuoteFirestoreStatus = 'quoted' | 'converted' | 'lost' | 'cancelled'

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
  currency?: string
  /** Snapshot for Apply-to-desk */
  airBreaks?: AirTariff['breaks']
  seaTariff?: Pick<SeaTariff, 'mode' | 'lclRate' | 'fclRates' | 'currency' | 'carrier'>
}

export interface CircularRecord {
  id: string
  title?: string
  carrier?: string
  category?: string
  notes?: string
  createdAt?: string
  validTo?: string
  fileName?: string
}
