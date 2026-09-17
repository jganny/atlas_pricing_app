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
  grossProfitINR?: number
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
  /** Real link back to the SalesLead this quote was created from, when any. */
  leadId?: string
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
  /** Real link back to the SalesLead this quote was created from, when any. */
  leadId?: string
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
  incoterm?: string
  notes?: string
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
  source?: string
  owner?: string
  notes?: string
  updatedAt?: string
  createdAt?: string
  /** Opportunity-pipeline enrichment — all additive/optional, never required. */
  accountId?: string
  contactId?: string
  /** 0-100 override; falls back to STAGE_PROBABILITY[status] when unset. */
  probability?: number
  expectedCloseDate?: string
  lossReasonCode?: string
  lossReasonNotes?: string
  wonAt?: string
  lostAt?: string
  /** Real relational link to quotes created from this lead. */
  quoteIds?: string[]
  territory?: string
}

/** A customer/prospect company — distinct from the agent/vendor DirectoryContact below. */
export interface Account {
  id: string
  name: string
  industry?: string
  website?: string
  billingAddress?: string
  primaryContactId?: string
  owner: string
  territory?: string
  accountType?: 'prospect' | 'customer' | 'churned'
  contractRenewalDate?: string
  /** Denormalized, refreshed when a linked lead is won. */
  lastWonAt?: string
  /** Denormalized, refreshed when a linked lead's quote is created. */
  lastQuoteAt?: string
  notes?: string
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

/** A person at an Account — named to avoid colliding with the unrelated agent/vendor DirectoryContact. */
export interface SalesContact {
  id: string
  accountId: string
  name: string
  title?: string
  email?: string
  phone?: string
  isPrimary?: boolean
  /** Denormalized from the owning Account at write time. */
  owner: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

/** A quota for a rep ("ganny") or a team ("team:air-export") for one period. */
export interface SalesTarget {
  id: string
  owner: string
  /** "2026-Q4" — quarterly only. */
  period: string
  targetRevenue: number
  targetWinCount?: number
  notes?: string
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

/** Lightweight territory tag registry — not a rules engine. */
export interface SalesTerritory {
  id: string
  name: string
  description?: string
  ownerUsernames?: string[]
  createdAt?: string
  updatedAt?: string
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
/** AI / heuristic intake tag — noise is never stored. */
export type InboxTag = 'new_enquiry' | 'follow_up' | 'needs_human'

export interface InboxEnquiry {
  id: string
  mailbox: InboxMailboxKey
  mailboxEmail: string
  messageId?: string
  from: string
  subject: string
  receivedAt: string
  /** Short preview only — full mail stays on IMAP. */
  bodyPreview: string
  /** Deprecated: kept empty for storage; prefer parsed + bodyPreview. */
  body: string
  mode: 'air' | 'sea' | 'unknown'
  confidence: number
  assignedUsers: string[]
  suggestedUser?: string | null
  claimedBy?: string | null
  status: InboxStatus
  tag?: InboxTag
  actionRequired?: boolean
  reason?: string
  summary?: string
  classifier?: 'anthropic' | 'heuristic' | string
  parsed: ParsedEnquiry
}
