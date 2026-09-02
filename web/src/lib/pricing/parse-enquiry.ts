import type { ParsedEnquiry } from '../types'

const AIRLINE_HINTS: Record<string, string> = {
  EK: 'EK - Emirates',
  QR: 'QR - Qatar Airways',
  AI: 'AI - Air India',
  BA: 'BA - British Airways',
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

  const custMatch = t.match(/(?:customer|client|shipper|for)[:\s]+([^\n,;]+)/i)
  if (custMatch) result.customer = custMatch[1].trim()

  const polPod = t.match(/\bpol\b[:\s]*([A-Z]{3})[\s\S]*?\bpod\b[:\s]*([A-Z]{3})/i)
  if (polPod) {
    result.origin = polPod[1].toUpperCase()
    result.destination = polPod[2].toUpperCase()
  } else {
    const routePatterns = [
      /(?:origin|from|ex)\s+([A-Z]{3})[\s\S]*?(?:to|→|->)\s+([A-Z]{3})/i,
      /([A-Z]{3})\s*(?:to|→|->|-|–)\s*([A-Z]{3})/i,
    ]
    for (const pattern of routePatterns) {
      const match = t.match(pattern)
      if (match) {
        result.origin = match[1].toUpperCase()
        result.destination = match[2].toUpperCase()
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

  const gwMatches: number[] = []
  const gwRe = /(?:gross|total)?\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(?:kg|kgs)?/gi
  let gwm: RegExpExecArray | null
  while ((gwm = gwRe.exec(t)) !== null) gwMatches.push(parseFloat(gwm[1]))

  const dimGlobal = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/gi
  let dimMatch: RegExpExecArray | null
  const qtyM = t.match(/(\d+)\s*(?:pcs|pieces|pkgs|cartons)/i)
  const qtyDefault = qtyM ? parseInt(qtyM[1], 10) : 1

  while ((dimMatch = dimGlobal.exec(t)) !== null) {
    result.packages.push({
      qty: qtyDefault,
      gw: gwMatches[0] || 0,
      l: parseFloat(dimMatch[1]),
      w: parseFloat(dimMatch[2]),
      h: parseFloat(dimMatch[3]),
    })
  }

  if (!result.packages.length && gwMatches.length) {
    result.packages.push({ qty: qtyDefault, gw: gwMatches[0] })
  }

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

  const custMatch = t.match(/(?:customer|client|shipper|for)[:\s]+([^\n,;]+)/i)
  if (custMatch) result.customer = custMatch[1].trim()

  const polPodSea = t.match(/\bpol\b[:\s]*([^\n,;(]+)[\s\S]*?\bpod\b[:\s]*([^\n,;(]+)/i)
  if (polPodSea) {
    result.origin = extractPortCode(polPodSea[1])
    result.destination = extractPortCode(polPodSea[2])
  } else {
    const polM = t.match(/(?:pol|port of loading|origin)[:\s]+([^\n,;(]+)/i)
    const podM = t.match(/(?:pod|port of discharge|destination)[:\s]+([^\n,;(]+)/i)
    if (polM) result.origin = extractPortCode(polM[1])
    if (podM) result.destination = extractPortCode(podM[1])
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

  const contRe = /(\d+)\s*[x×*]\s*(20|40|45)\s*['']?\s*(gp|hc|hq)/gi
  let cm: RegExpExecArray | null
  while ((cm = contRe.exec(t)) !== null) {
    const key = `${cm[2]}${cm[3].toUpperCase()}`
    const type = CONTAINER_ALIASES[key] || `${cm[2]}'${cm[3].toUpperCase()}`
    result.containers.push({ type, qty: parseInt(cm[1], 10) || 1 })
    result.mode = 'fcl'
  }

  if (/maersk/i.test(t)) result.linerLabel = 'Maersk Line'
  if (/msc/i.test(t)) result.linerLabel = 'MSC (Mediterranean Shipping Company)'

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
  const gross = packages.reduce((sum, p) => sum + (p.gw || 0), 0)
  const volumetric = packages.reduce((sum, p) => {
    if (!p.l || !p.w || !p.h || !p.qty) return sum
    return sum + (p.l * p.w * p.h * p.qty) / 6000
  }, 0)
  return Math.max(gross, volumetric)
}

export function estimateAirTotal(
  packages: ParsedEnquiry['packages'],
  breaks: Record<string, { sell: number; buy: number }>,
) {
  const cwt = estimateChargeableWeightKg(packages)
  const chargeable = Math.max(cwt, 45)
  let rate = breaks.plus45?.sell || breaks.plus100?.sell || breaks.min?.sell || 0
  if (chargeable >= 1000 && breaks.plus1000) rate = breaks.plus1000.sell
  else if (chargeable >= 500 && breaks.plus500) rate = breaks.plus500.sell
  else if (chargeable >= 300 && breaks.plus300) rate = breaks.plus300.sell
  else if (chargeable >= 100 && breaks.plus100) rate = breaks.plus100.sell
  const freight = Math.max(breaks.min?.sell || 0, rate * chargeable)
  return { chargeable, freight, cwt }
}
