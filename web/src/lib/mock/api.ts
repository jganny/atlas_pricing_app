import { delay } from '../utils'
import type { AirTariff, AuthUser, EnquiryRecord, SeaTariff, SmartQuoteDraft } from '../types'
import {
  MOCK_AIR_TARIFFS,
  MOCK_ENQUIRIES,
  MOCK_SEA_TARIFFS,
  MOCK_USERS,
} from './data'
import {
  estimateAirTotal,
  parseAirEnquiry,
  parseSeaEnquiry,
} from '../pricing/parse-enquiry'

const isMock = import.meta.env.VITE_MOCK_MODE !== 'false'

function stripPassword(user: (typeof MOCK_USERS)[number]): AuthUser {
  const { password: _password, ...safe } = user
  return safe
}

export async function mockLogin(username: string, password: string): Promise<AuthUser> {
  await delay(400)
  const found = MOCK_USERS.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password,
  )
  if (!found) throw new Error('Invalid credentials. Try ganny / demo')
  return stripPassword(found)
}

export async function fetchEnquiries(): Promise<EnquiryRecord[]> {
  await delay(300)
  return [...MOCK_ENQUIRIES]
}

export async function fetchAirTariffs(): Promise<AirTariff[]> {
  await delay(200)
  return [...MOCK_AIR_TARIFFS]
}

export async function fetchSeaTariffs(): Promise<SeaTariff[]> {
  await delay(200)
  return [...MOCK_SEA_TARIFFS]
}

export function lookupAirTariff(origin: string, destination: string, carrierCode?: string) {
  return MOCK_AIR_TARIFFS.find((t) => {
    if (t.origin !== origin || t.destination !== destination) return false
    if (carrierCode && t.carrierCode !== carrierCode) return false
    return true
  }) || MOCK_AIR_TARIFFS.find((t) => t.origin === origin && t.destination === destination)
}

export function lookupSeaTariff(origin: string, destination: string, mode?: string) {
  const o = origin.toUpperCase()
  const d = destination.toUpperCase()
  return MOCK_SEA_TARIFFS.find((t) => {
    if (t.origin !== o || t.destination !== d) return false
    if (mode && t.mode !== mode) return false
    return true
  }) || MOCK_SEA_TARIFFS.find((t) => t.origin === o && t.destination === d)
}

export async function runAirSmartQuote(text: string): Promise<SmartQuoteDraft> {
  await delay(500)
  const parsed = parseAirEnquiry(text)
  if (!parsed.origin || !parsed.destination) {
    return {
      parsed,
      tariffFound: false,
      carrierLabel: parsed.airlineLabel || '—',
      message: 'Could not detect POL/POD. Include airport codes (BLR, LHR…).',
    }
  }

  const tariff = lookupAirTariff(parsed.origin, parsed.destination, parsed.airline)
  const carrierLabel = parsed.airlineLabel || tariff?.carrier || 'From route history'
  let estimatedTotal: number | undefined

  if (tariff) {
    const est = estimateAirTotal(parsed.packages, tariff.breaks)
    estimatedTotal = est.freight
  }

  return {
    parsed,
    tariffFound: Boolean(tariff),
    carrierLabel,
    estimatedTotal,
    message: tariff
      ? `Draft ready · ${parsed.origin} → ${parsed.destination} · rates from Circulars`
      : `Draft ready · no Circulars tariff — enter rates manually (CWT still auto)`,
  }
}

export async function runSeaSmartQuote(text: string): Promise<SmartQuoteDraft> {
  await delay(500)
  const parsed = parseSeaEnquiry(text)
  if (!parsed.origin || !parsed.destination) {
    return {
      parsed,
      tariffFound: false,
      carrierLabel: parsed.linerLabel || '—',
      message: 'Could not detect POL/POD. Include UN/LOCODE (INNSA, NLRTM…).',
    }
  }

  const tariff = lookupSeaTariff(parsed.origin, parsed.destination, parsed.mode)
  const carrierLabel = parsed.linerLabel || tariff?.carrier || 'From route history'
  let estimatedTotal: number | undefined

  if (tariff?.mode === 'fcl' && parsed.containers.length) {
    estimatedTotal = parsed.containers.reduce((sum, c) => {
      const rate = tariff.fclRates[c.type]?.sell || 0
      return sum + rate * c.qty
    }, 0)
  } else if (tariff?.mode === 'lcl') {
    const rt = Math.max((parsed.grossWeight || 0) / 1000, parsed.volume || 0, 1)
    estimatedTotal = rt * tariff.lclRate.sell
  }

  return {
    parsed,
    tariffFound: Boolean(tariff),
    carrierLabel,
    estimatedTotal,
    message: tariff
      ? `Sea draft ready · ${parsed.origin} → ${parsed.destination} · ${tariff.mode.toUpperCase()} from Circulars`
      : `Sea draft ready · no Circulars tariff — enter rates on Carriers tab`,
  }
}

export function getEnvironmentLabel() {
  return isMock ? 'Mock environment' : 'Live Firebase'
}

export const mockApi = {
  login: mockLogin,
  fetchEnquiries,
  fetchAirTariffs,
  fetchSeaTariffs,
  runAirSmartQuote,
  runSeaSmartQuote,
  getEnvironmentLabel,
}
