import type { ParsedEnquiry } from '../types'
import { calculateAirFreight, chargeableWeightKg, summarizeCargo } from '@atlas/pricing-core'

const AIRLINE_HINTS: Record<string, string> = {
  EK: 'EK - Emirates',
  QR: 'QR - Qatar Airways',
  AI: 'AI - Air India',
  BA: 'BA - British Airways',
  SQ: 'SQ - Singapore Airlines',
  CX: 'CX - Cathay Pacific',
  LH: 'LH - Lufthansa',
  TK: 'TK - Turkish Airlines',
  EY: 'EY - Etihad',
  AF: 'AF - Air France',
  KL: 'KL - KLM',
  UA: 'UA - United',
  AA: 'AA - American Airlines',
  DL: 'DL - Delta',
  MH: 'MH - Malaysia Airlines',
  TG: 'TG - Thai Airways',
  CZ: 'CZ - China Southern',
  CA: 'CA - Air China',
}

const CITY_TO_IATA: Record<string, string> = {
  bengaluru: 'BLR',
  bangalore: 'BLR',
  mumbai: 'BOM',
  delhi: 'DEL',
  chennai: 'MAA',
  hyderabad: 'HYD',
  london: 'LHR',
  heathrow: 'LHR',
  dubai: 'DXB',
  singapore: 'SIN',
  hongkong: 'HKG',
  'hong kong': 'HKG',
  frankfurt: 'FRA',
  amsterdam: 'AMS',
  paris: 'CDG',
  newyork: 'JFK',
  'new york': 'JFK',
  chicago: 'ORD',
  losangeles: 'LAX',
  'los angeles': 'LAX',
  shanghai: 'PVG',
  tokyo: 'NRT',
  sydney: 'SYD',
}

const CITY_TO_UNLOCODE: Record<string, string> = {
  'nhava sheva': 'INNSA',
  nhavasheva: 'INNSA',
  jawaharlal: 'INNSA',
  mundra: 'INMUN',
  chennai: 'INMAA',
  kolkata: 'INCCU',
  rotterdam: 'NLRTM',
  hamburg: 'DEHAM',
  antwerp: 'BEANR',
  shanghai: 'CNSHA',
  singapore: 'SGSIN',
  dubai: 'AEJEA',
  jebelali: 'AEJEA',
  'jebel ali': 'AEJEA',
  losangeles: 'USLAX',
  'los angeles': 'USLAX',
  longbeach: 'USLGB',
  'long beach': 'USLGB',
  newyork: 'USNYC',
  'new york': 'USNYC',
}

function normalizeCityKey(s: string) {
  return s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
}

function resolveAirport(token: string): string {
  const t = token.trim()
  const code = t.match(/\b([A-Z]{3})\b/)
  if (code) return code[1].toUpperCase()
  const key = normalizeCityKey(t)
  return CITY_TO_IATA[key] || CITY_TO_IATA[key.replace(/\s/g, '')] || t.toUpperCase().slice(0, 3)
}

function resolvePort(token: string): string {
  const t = token.trim()
  const code = t.match(/\b([A-Z]{2}[A-Z0-9]{3})\b/)
  if (code) return code[1].toUpperCase()
  const key = normalizeCityKey(t)
  return CITY_TO_UNLOCODE[key] || CITY_TO_UNLOCODE[key.replace(/\s/g, '')] || extractPortCode(t)
}

export function parseAirEnquiry(text: string): ParsedEnquiry {
  const t = text.replace(/\r/g, '')
  const result: ParsedEnquiry = {
    customer: '',
    origin: '',
    destination: '',
    packages: [],
    containers: [],
    confidence: 0,
    source: 'email-text',
  }

  const custMatch =
    t.match(/(?:customer|client|shipper)\s*[:\-]\s*([^\n,;]+)/i) ||
    t.match(/(?:quote\s+(?:air\s+)?(?:export|import)\s+for|for)\s+([A-Z][^\n,;.]{2,60})/i)
  if (custMatch) result.customer = custMatch[1].replace(/\s+/g, ' ').trim()

  const polPod = t.match(/\bpol\b[:\s]*([A-Za-z][A-Za-z0-9 \-]{1,40})[\s\S]*?\bpod\b[:\s]*([A-Za-z][A-Za-z0-9 \-]{1,40})/i)
  if (polPod) {
    result.origin = resolveAirport(polPod[1])
    result.destination = resolveAirport(polPod[2])
  } else {
    const routePatterns = [
      /(?:origin|from|ex)\s+([A-Za-z][A-Za-z0-9 \-]{1,30})[\s\S]{0,40}?(?:to|→|->)\s+([A-Za-z][A-Za-z0-9 \-]{1,30})/i,
      /\b([A-Z]{3})\s*(?:to|→|->|-|–)\s*([A-Z]{3})\b/,
    ]
    for (const pattern of routePatterns) {
      const match = t.match(pattern)
      if (match) {
        result.origin = resolveAirport(match[1])
        result.destination = resolveAirport(match[2])
        break
      }
    }
  }

  Object.entries(AIRLINE_HINTS).forEach(([code, label]) => {
    if (result.airline) return
    if (new RegExp(`\\b${code}\\b`, 'i').test(t)) {
      result.airline = code
      result.airlineLabel = label
    }
  })
  if (!result.airline) {
    const named = t.match(/\b(emirates|qatar|etihad|lufthansa|turkish|singapore\s*airlines?)\b/i)
    if (named) {
      const n = named[1].toLowerCase()
      if (n.startsWith('emirates')) {
        result.airline = 'EK'
        result.airlineLabel = AIRLINE_HINTS.EK
      } else if (n.startsWith('qatar')) {
        result.airline = 'QR'
        result.airlineLabel = AIRLINE_HINTS.QR
      } else if (n.startsWith('etihad')) {
        result.airline = 'EY'
        result.airlineLabel = AIRLINE_HINTS.EY
      } else if (n.startsWith('lufthansa')) {
        result.airline = 'LH'
        result.airlineLabel = AIRLINE_HINTS.LH
      } else if (n.startsWith('turkish')) {
        result.airline = 'TK'
        result.airlineLabel = AIRLINE_HINTS.TK
      } else if (n.startsWith('singapore')) {
        result.airline = 'SQ'
        result.airlineLabel = AIRLINE_HINTS.SQ
      }
    }
  }

  const gwMatches: number[] = []
  const gwRe = /(?:gross|total)?\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(?:kg|kgs)?/gi
  let gwm: RegExpExecArray | null
  while ((gwm = gwRe.exec(t)) !== null) gwMatches.push(parseFloat(gwm[1]))

  // Prefer "dims … x N pcs" so qty is per dim line when present
  const dimWithQty =
    /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:cm)?\s*[x×*]?\s*(\d+)\s*(?:pcs|pieces|pkgs|cartons)?/gi
  let dimQty: RegExpExecArray | null
  while ((dimQty = dimWithQty.exec(t)) !== null) {
    result.packages.push({
      qty: parseInt(dimQty[4], 10) || 1,
      gw: 0,
      l: parseFloat(dimQty[1]),
      w: parseFloat(dimQty[2]),
      h: parseFloat(dimQty[3]),
    })
  }

  if (!result.packages.length) {
    const dimGlobal = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/gi
    let dimMatch: RegExpExecArray | null
    const qtyM = t.match(/(\d+)\s*(?:pcs|pieces|pkgs|cartons)/i)
    const qtyDefault = qtyM ? parseInt(qtyM[1], 10) : 1
    while ((dimMatch = dimGlobal.exec(t)) !== null) {
      result.packages.push({
        qty: qtyDefault,
        gw: 0,
        l: parseFloat(dimMatch[1]),
        w: parseFloat(dimMatch[2]),
        h: parseFloat(dimMatch[3]),
      })
    }
  }

  // Distribute total GW across package lines by qty share
  if (result.packages.length && gwMatches.length) {
    const totalQty = result.packages.reduce((s, p) => s + (p.qty || 1), 0) || 1
    const totalGw = gwMatches[0]
    result.packages = result.packages.map((p) => ({
      ...p,
      gw: Math.round(((totalGw * (p.qty || 1)) / totalQty) * 100) / 100,
    }))
  } else if (!result.packages.length && gwMatches.length) {
    const qtyM = t.match(/(\d+)\s*(?:pcs|pieces|pkgs|cartons)/i)
    result.packages.push({ qty: qtyM ? parseInt(qtyM[1], 10) : 1, gw: gwMatches[0] })
  }

  const commodity = t.match(/(?:commodity|goods|description)[:\s]+([^\n;]+)/i)
  if (commodity) result.commodity = commodity[1].trim()

  result.confidence = scoreAir(result)
  return result
}

function scoreAir(r: ParsedEnquiry) {
  let score = 0
  if (r.origin && r.destination) score += 40
  if (r.packages.length) score += 25
  if (r.packages.some((p) => (p.gw || 0) > 0)) score += 15
  if (r.customer) score += 10
  if (r.airline) score += 10
  return Math.min(100, score)
}

const CONTAINER_ALIASES: Record<string, string> = {
  '20GP': "20'GP",
  '40GP': "40'GP",
  '40HC': "40'HC",
  '40HQ': "40'HC",
  '45HC': "45'HC",
  '20RF': "20'RF",
  '40RF': "40'RF",
}

export function parseSeaEnquiry(text: string): ParsedEnquiry {
  const t = text.replace(/\r/g, '')
  const result: ParsedEnquiry = {
    customer: '',
    origin: '',
    destination: '',
    packages: [],
    containers: [],
    confidence: 0,
    source: 'email-text',
  }

  const custMatch =
    t.match(/(?:customer|client|shipper)\s*[:\-]\s*([^\n,;]+)/i) ||
    t.match(/(?:for)\s+([A-Z][^\n,;.]{2,60})/i)
  if (custMatch) result.customer = custMatch[1].replace(/\s+/g, ' ').trim()

  const polPodSea = t.match(/\bpol\b[:\s]*([^\n,;(]+)[\s\S]*?\bpod\b[:\s]*([^\n,;(]+)/i)
  if (polPodSea) {
    result.origin = resolvePort(polPodSea[1])
    result.destination = resolvePort(polPodSea[2])
  } else {
    const polM = t.match(/(?:pol|port of loading|origin)[:\s]+([^\n,;(]+)/i)
    const podM = t.match(/(?:pod|port of discharge|destination)[:\s]+([^\n,;(]+)/i)
    if (polM) result.origin = resolvePort(polM[1])
    if (podM) result.destination = resolvePort(podM[1])
  }

  const codes = t.match(/\b([A-Z]{2}[A-Z0-9]{3})\b/g)
  if (codes) {
    if (!result.origin) result.origin = codes[0]
    if (!result.destination && codes.length > 1) result.destination = codes[1]
  }

  if (/break\s*bulk|\bbb\b/i.test(t)) result.mode = 'bb'
  else if (/\blcl\b/i.test(t)) result.mode = 'lcl'
  else if (/\bfcl\b|full\s*container/i.test(t)) result.mode = 'fcl'

  const cbmM = t.match(/(\d+(?:\.\d+)?)\s*(?:cbm|m3)/i)
  if (cbmM) result.volume = parseFloat(cbmM[1])

  const tonM = t.match(/(\d+(?:\.\d+)?)\s*(?:mt|metric\s*ton|tons?)\b/i)
  if (tonM) result.grossWeight = parseFloat(tonM[1]) * 1000
  else {
    const kgM = t.match(/(?:gross|total)?\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(?:kg|kgs)\b/i)
    if (kgM) result.grossWeight = parseFloat(kgM[1])
  }

  const contRe = /(\d+)\s*[x×*]\s*(20|40|45)\s*['']?\s*(gp|hc|hq|rf)/gi
  let cm: RegExpExecArray | null
  while ((cm = contRe.exec(t)) !== null) {
    const key = `${cm[2]}${cm[3].toUpperCase()}`
    const type = CONTAINER_ALIASES[key] || `${cm[2]}'${cm[3].toUpperCase()}`
    result.containers.push({ type, qty: parseInt(cm[1], 10) || 1 })
    result.mode = 'fcl'
  }

  if (/maersk/i.test(t)) result.linerLabel = 'Maersk Line'
  else if (/msc/i.test(t)) result.linerLabel = 'MSC (Mediterranean Shipping Company)'
  else if (/cma\s*cgm|cma-cgm/i.test(t)) result.linerLabel = 'CMA CGM'
  else if (/hapag/i.test(t)) result.linerLabel = 'Hapag-Lloyd'
  else if (/evergreen/i.test(t)) result.linerLabel = 'Evergreen'
  else if (/cosco/i.test(t)) result.linerLabel = 'COSCO'
  else if (/one\b|ocean\s*network/i.test(t)) result.linerLabel = 'ONE (Ocean Network Express)'

  result.confidence = scoreSea(result)
  return result
}

function extractPortCode(value: string) {
  const code = value.match(/\b([A-Z]{2}[A-Z0-9]{3})\b/)
  return code ? code[1] : value.trim()
}

function scoreSea(r: ParsedEnquiry) {
  let score = 0
  if (r.origin && r.destination) score += 35
  if (r.mode) score += 15
  if ((r.grossWeight || 0) > 0 || (r.volume || 0) > 0) score += 20
  if (r.containers.length) score += 15
  if (r.customer) score += 8
  if (r.linerLabel) score += 7
  return Math.min(100, score)
}

export function estimateChargeableWeightKg(packages: ParsedEnquiry['packages']) {
  const cargo = packages.map((p) => ({
    length: p.l ?? 0,
    width: p.w ?? 0,
    height: p.h ?? 0,
    qty: p.qty,
    grossWeightKg: p.gw ?? 0,
  }))
  return chargeableWeightKg(summarizeCargo(cargo))
}

/** @deprecated Use estimateAirFreightFromTariff from ./estimate.ts */
export function estimateAirTotal(
  packages: ParsedEnquiry['packages'],
  breaks: Record<string, { sell: number; buy: number }>,
) {
  const cargo = packages.map((p) => ({
    length: p.l ?? 0,
    width: p.w ?? 0,
    height: p.h ?? 0,
    qty: p.qty,
    grossWeightKg: p.gw ?? 0,
  }))
  const result = calculateAirFreight({ cargo, breaks })
  return {
    chargeable: result.chargeableWeightKg,
    freight: result.baseFreightSell,
    cwt: result.chargeableWeightKg,
  }
}
