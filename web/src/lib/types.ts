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
  /** Display name for desk (from TEAM_ROLES). */
  assignee: string
  /** Raw Firestore creator / desk id. */
  creator: string
  createdAt: string
  grandTotal?: number
  currency?: string
  amountINR?: number
  grossProfit?: number
  grossProfitCurrency?: string
  /** Precomputed buy total when available (amount − GP or stored). */
  buyTotal?: number
  buyRate?: number
  confirmedBuyRate?: number
  carrier?: string
  appliedRate?: number
  appliedBuyRate?: number
  usedBreak?: string
  billingWeight?: number
  billingUnit?: 'kg' | 'rt' | 'gw'
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
  buyRate?: number
  confirmedBuyRate?: number
  notes?: string
  mode?: string
  details?: Record<string, unknown>
  quoteRefNo?: string
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
  commodity?: string
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
  downloadURL?: string
  storagePath?: string
  effectiveDate?: string
  expiryDate?: string
  uploadedBy?: string
}

/** Agent / vendor contact from Firestore `contactsDirectory`. */
export interface DirectoryContact {
  id: string
  name: string
  category: string
  contactPerson?: string
  email?: string
  phone?: string
  location?: string
  notes?: string
  sheetGroup?: string
  agreement?: string
  agreementUrl?: string
  agreementFileName?: string
  suspended?: boolean
  updatedBy?: string
  updatedAt?: string
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'quoted' | 'won' | 'lost'

export interface SalesLead {
  id: string
  company: string
  contactName?: string
  email?: string
  phone?: string
  status: LeadStatus
  mode?: 'air' | 'sea' | 'transport' | 'warehouse' | 'courier'
  lane?: string
  dealValue?: number
  nextAction?: string
  nextDueDate?: string
  winLossReason?: string
  owner?: string
  notes?: string
  updatedAt?: string
  createdAt?: string
}

export interface LeadActivity {
  id: string
  leadId: string
  type: 'note' | 'call' | 'email' | 'meeting' | 'status'
  body: string
  createdBy?: string
  createdAt: string
}

export interface CreditControl {
  id: string
  customer: string
  creditDays: number
  creditLimit: number
  hasAgreement: boolean
  waiveAgreement?: boolean
  blocked?: boolean
  notes?: string
  updatedAt?: string
}

export type InboxMailboxKey = 'pricing' | 'pricingsales'
export type InboxStatus = 'new' | 'claimed' | 'applied' | 'ignored'

export interface InboxEnquiry {
  id: string
  mailbox: InboxMailboxKey
  mailboxEmail: string
  messageId?: string
  from: string
  subject: string
  receivedAt: string
  bodyPreview: string
  body: string
  mode: 'air' | 'sea' | 'unknown'
  confidence: number
  assignedUsers: string[]
  suggestedUser?: string | null
  claimedBy?: string | null
  status: InboxStatus
  parsed: ParsedEnquiry
}
