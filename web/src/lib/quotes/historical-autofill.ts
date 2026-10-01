import type { WeightBreakName } from "@atlas/pricing-core";
import type { EnquiryRecord, SavedQuote } from "@/lib/types";
import { AIR_WEIGHT_BREAKS } from "@/lib/pricing/air-desk";
import { fetchQuoteById } from "@/lib/firebase/quote-lifecycle";

/**
 * Silently pre-fills charge lines that have been consistent across a user's
 * own quote history for the same route/incoterm/currency/module — never
 * blends across carriers for freight rate, only for local surcharges, and
 * never overwrites a field the user has already typed. See the plan at
 * ~/.claude/plans/luminous-sleeping-harbor.md ("Historical-Consistency
 * Charge Auto-Fill") for the full design rationale.
 */

export const HISTORICAL_LOOKBACK_DAYS = 365;
const MAX_CANDIDATES = 25;
const MIN_SAMPLES = 2;
const MODE_THRESHOLD = 0.7;

export interface ChargeValue {
  sell: number | null;
  buy: number | null;
}

interface Sample {
  value: number;
  timestamp: number;
}

export function normalizeSurchargeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export const normalizeCarrierName = normalizeSurchargeName;

export function withinLookbackDays(
  timestamp: number | undefined,
  days: number,
  now: number = Date.now(),
): boolean {
  if (!timestamp) return false;
  return now - timestamp <= days * 24 * 60 * 60 * 1000;
}

/**
 * n=2 requires exact agreement; n>=3 requires the rounded mode to cover
 * >=70% of samples, ties broken by the most recent sample's timestamp.
 * Returns null (leave the field blank) when there isn't enough agreement.
 */
export function pickConsistentValue(samples: Sample[]): number | null {
  if (samples.length < MIN_SAMPLES) return null;
  const rounded = samples.map((s) => ({ value: Math.round(s.value * 100) / 100, timestamp: s.timestamp }));
  if (rounded.length === 2) {
    return rounded[0].value === rounded[1].value ? rounded[0].value : null;
  }
  const counts = new Map<number, { count: number; latest: number }>();
  for (const s of rounded) {
    const entry = counts.get(s.value);
    if (entry) {
      entry.count += 1;
      entry.latest = Math.max(entry.latest, s.timestamp);
    } else {
      counts.set(s.value, { count: 1, latest: s.timestamp });
    }
  }
  let bestValue: number | null = null;
  let bestCount = 0;
  let bestLatest = -Infinity;
  for (const [value, { count, latest }] of counts) {
    if (count > bestCount || (count === bestCount && latest > bestLatest)) {
      bestValue = value;
      bestCount = count;
      bestLatest = latest;
    }
  }
  if (bestValue === null || bestCount / rounded.length < MODE_THRESHOLD) return null;
  return bestValue;
}

function pushSample(map: Map<string, Sample[]>, key: string, value: number, timestamp: number) {
  if (!(value > 0)) return; // 0 means "unset" throughout this app — never treated as real data
  const arr = map.get(key);
  if (arr) arr.push({ value, timestamp });
  else map.set(key, [{ value, timestamp }]);
}

function reduceMap(map: Map<string, Sample[]>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [key, samples] of map) {
    const value = pickConsistentValue(samples);
    if (value !== null) out.set(key, value);
  }
  return out;
}

function parseCreatedAt(createdAt: string): number {
  const asNumber = Number(createdAt);
  if (Number.isFinite(asNumber) && asNumber > 1e11) return asNumber;
  const parsed = Date.parse(createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface HistoricalMatchFilter {
  deskType: "air" | "sea" | "courier" | "transport" | "warehouse";
  origin: string;
  destination: string;
  /** Air/Sea only — Courier/Transport/Warehouse don't have an incoterm. */
  incoterm?: string;
  currency: string;
  /** Air/Sea only. */
  module?: "export" | "import";
  /** Courier only — domestic vs. international rates don't mix. */
  scope?: "domestic" | "international";
  carrierName?: string;
  customer?: string;
}

/**
 * Coarse candidate net from the already-live useEnquiries() cache (zero
 * extra Firestore reads). EnquiryRecord has no incoterm/module/charge
 * detail, so this only narrows by desk type, O/D, currency and recency —
 * exact tier membership (incoterm, module, per-carrier rows) is
 * re-verified against the full SavedQuote in extractAirCharges/
 * extractSeaCharges. Ranks same-customer matches first, then most recent.
 */
export function selectCandidateIds(
  enquiries: EnquiryRecord[],
  filter: HistoricalMatchFilter,
  lookbackDays: number = HISTORICAL_LOOKBACK_DAYS,
  maxCandidates: number = MAX_CANDIDATES,
  now: number = Date.now(),
): string[] {
  const origin = normalizeCarrierName(filter.origin);
  const destination = normalizeCarrierName(filter.destination);
  const currency = filter.currency.trim().toUpperCase();
  const customer = filter.customer ? normalizeCarrierName(filter.customer) : "";

  const needsIncoterm = filter.deskType === "air" || filter.deskType === "sea";
  if (!origin || (needsIncoterm && !filter.incoterm?.trim())) return [];

  return enquiries
    .filter((e) => e.mode === filter.deskType)
    .filter((e) => normalizeCarrierName(e.origin || "") === origin)
    .filter((e) => normalizeCarrierName(e.destination || "") === destination)
    .filter((e) => (e.currency || "").trim().toUpperCase() === currency)
    .filter((e) => withinLookbackDays(parseCreatedAt(e.createdAt), lookbackDays, now))
    .map((e) => ({
      id: e.id,
      sameCustomer: customer ? normalizeCarrierName(e.customer || "") === customer : false,
      timestamp: parseCreatedAt(e.createdAt),
    }))
    .sort((a, b) => {
      if (a.sameCustomer !== b.sameCustomer) return a.sameCustomer ? -1 : 1;
      return b.timestamp - a.timestamp;
    })
    .slice(0, maxCandidates)
    .map((s) => s.id);
}

export async function fetchCandidateQuotes(ids: string[]): Promise<SavedQuote[]> {
  const results = await Promise.allSettled(ids.map((id) => fetchQuoteById(id)));
  const quotes: SavedQuote[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) quotes.push(r.value);
  }
  return quotes;
}

function chargeValue(sellMap: Map<string, number>, buyMap: Map<string, number>, key: string): ChargeValue {
  return { sell: sellMap.get(key) ?? null, buy: buyMap.get(key) ?? null };
}

export interface AirAutofillResult {
  breaks: Partial<Record<WeightBreakName, ChargeValue>>;
  ams: ChargeValue;
  originSurcharges: Record<string, ChargeValue>;
  destSurcharges: Record<string, ChargeValue>;
}

/**
 * Freight (breaks/AMS) is gated to Tier 1 — same carrier — only, never
 * blended across carriers. Surcharges try Tier 1 first, then fall back to
 * Tier 2 (any carrier on the same O/D+incoterm+module+currency) per row,
 * independently, only when Tier 1 has no qualifying value for that row.
 */
export function extractAirCharges(quotes: SavedQuote[], filter: HistoricalMatchFilter): AirAutofillResult {
  const targetOrigin = normalizeCarrierName(filter.origin);
  const targetDest = normalizeCarrierName(filter.destination);
  const targetIncoterm = (filter.incoterm ?? "").trim().toUpperCase();
  const targetCurrency = filter.currency.trim().toUpperCase();
  const targetCarrier = filter.carrierName ? normalizeCarrierName(filter.carrierName) : "";

  const breakSell1 = new Map<string, Sample[]>();
  const breakBuy1 = new Map<string, Sample[]>();
  const amsSell1: Sample[] = [];
  const amsBuy1: Sample[] = [];
  const originSell1 = new Map<string, Sample[]>();
  const originBuy1 = new Map<string, Sample[]>();
  const destSell1 = new Map<string, Sample[]>();
  const destBuy1 = new Map<string, Sample[]>();
  const originSell2 = new Map<string, Sample[]>();
  const originBuy2 = new Map<string, Sample[]>();
  const destSell2 = new Map<string, Sample[]>();
  const destBuy2 = new Map<string, Sample[]>();

  for (const quote of quotes) {
    const d = quote.details ?? {};
    if (String(d.incoterm ?? "").trim().toUpperCase() !== targetIncoterm) continue;
    const qModule = d.module === "import" ? "import" : "export";
    if (qModule !== filter.module) continue;
    if (normalizeCarrierName(String(d.origin ?? "")) !== targetOrigin) continue;
    if (normalizeCarrierName(String(d.destination ?? "")) !== targetDest) continue;
    if ((quote.currency || "").trim().toUpperCase() !== targetCurrency) continue;

    const timestamp = typeof quote.timestamp === "number" ? quote.timestamp : parseCreatedAt(quote.date || "");
    const airlines = Array.isArray(d.airlines) ? (d.airlines as Record<string, unknown>[]) : [];

    for (const raw of airlines) {
      const name = normalizeCarrierName(String(raw.name ?? ""));
      const isTier1 = Boolean(targetCarrier) && name === targetCarrier;

      if (isTier1) {
        const breaks = (raw.breaks ?? {}) as Record<string, { sell?: number; buy?: number }>;
        for (const bn of AIR_WEIGHT_BREAKS) {
          const pair = breaks[bn];
          if (pair) {
            pushSample(breakSell1, bn, Number(pair.sell) || 0, timestamp);
            pushSample(breakBuy1, bn, Number(pair.buy) || 0, timestamp);
          }
        }
        if (raw.amsFee) amsSell1.push({ value: Number(raw.amsFee), timestamp });
        if (raw.amsFeeBuy) amsBuy1.push({ value: Number(raw.amsFeeBuy), timestamp });
      }

      const originRows = Array.isArray(raw.originSurcharges) ? (raw.originSurcharges as Record<string, unknown>[]) : [];
      for (const row of originRows) {
        const rname = normalizeSurchargeName(String(row.name ?? ""));
        if (!rname) continue;
        pushSample(originSell2, rname, Number(row.sell) || 0, timestamp);
        pushSample(originBuy2, rname, Number(row.buy) || 0, timestamp);
        if (isTier1) {
          pushSample(originSell1, rname, Number(row.sell) || 0, timestamp);
          pushSample(originBuy1, rname, Number(row.buy) || 0, timestamp);
        }
      }
      const destRows = Array.isArray(raw.destSurcharges) ? (raw.destSurcharges as Record<string, unknown>[]) : [];
      for (const row of destRows) {
        const rname = normalizeSurchargeName(String(row.name ?? ""));
        if (!rname) continue;
        pushSample(destSell2, rname, Number(row.sell) || 0, timestamp);
        pushSample(destBuy2, rname, Number(row.buy) || 0, timestamp);
        if (isTier1) {
          pushSample(destSell1, rname, Number(row.sell) || 0, timestamp);
          pushSample(destBuy1, rname, Number(row.buy) || 0, timestamp);
        }
      }
    }
  }

  const breakSellR = reduceMap(breakSell1);
  const breakBuyR = reduceMap(breakBuy1);
  const breaks: Partial<Record<WeightBreakName, ChargeValue>> = {};
  for (const bn of AIR_WEIGHT_BREAKS) {
    const cv = chargeValue(breakSellR, breakBuyR, bn);
    if (cv.sell !== null || cv.buy !== null) breaks[bn] = cv;
  }

  const originSell1R = reduceMap(originSell1);
  const originBuy1R = reduceMap(originBuy1);
  const originSell2R = reduceMap(originSell2);
  const originBuy2R = reduceMap(originBuy2);
  const destSell1R = reduceMap(destSell1);
  const destBuy1R = reduceMap(destBuy1);
  const destSell2R = reduceMap(destSell2);
  const destBuy2R = reduceMap(destBuy2);

  const originNames = new Set([...originSell2R.keys(), ...originBuy2R.keys()]);
  const destNames = new Set([...destSell2R.keys(), ...destBuy2R.keys()]);

  const originSurcharges: Record<string, ChargeValue> = {};
  for (const name of originNames) {
    originSurcharges[name] = {
      sell: originSell1R.get(name) ?? originSell2R.get(name) ?? null,
      buy: originBuy1R.get(name) ?? originBuy2R.get(name) ?? null,
    };
  }
  const destSurcharges: Record<string, ChargeValue> = {};
  for (const name of destNames) {
    destSurcharges[name] = {
      sell: destSell1R.get(name) ?? destSell2R.get(name) ?? null,
      buy: destBuy1R.get(name) ?? destBuy2R.get(name) ?? null,
    };
  }

  return {
    breaks,
    ams: {
      sell: pickConsistentValue(amsSell1),
      buy: pickConsistentValue(amsBuy1),
    },
    originSurcharges,
    destSurcharges,
  };
}

export interface SeaAutofillResult {
  containers: Record<string, ChargeValue>;
  lcl: ChargeValue;
  originSurcharges: Record<string, ChargeValue>;
  destSurcharges: Record<string, ChargeValue>;
}

export function extractSeaCharges(quotes: SavedQuote[], filter: HistoricalMatchFilter): SeaAutofillResult {
  const targetOrigin = normalizeCarrierName(filter.origin);
  const targetDest = normalizeCarrierName(filter.destination);
  const targetIncoterm = (filter.incoterm ?? "").trim().toUpperCase();
  const targetCurrency = filter.currency.trim().toUpperCase();
  const targetCarrier = filter.carrierName ? normalizeCarrierName(filter.carrierName) : "";

  const containerSell1 = new Map<string, Sample[]>();
  const containerBuy1 = new Map<string, Sample[]>();
  const lclSell1: Sample[] = [];
  const lclBuy1: Sample[] = [];
  const originSell1 = new Map<string, Sample[]>();
  const originBuy1 = new Map<string, Sample[]>();
  const destSell1 = new Map<string, Sample[]>();
  const destBuy1 = new Map<string, Sample[]>();
  const originSell2 = new Map<string, Sample[]>();
  const originBuy2 = new Map<string, Sample[]>();
  const destSell2 = new Map<string, Sample[]>();
  const destBuy2 = new Map<string, Sample[]>();

  for (const quote of quotes) {
    const d = quote.details ?? {};
    if (String(d.incoterm ?? "").trim().toUpperCase() !== targetIncoterm) continue;
    const qModule = d.module === "import" ? "import" : "export";
    if (qModule !== filter.module) continue;
    if (normalizeCarrierName(String(d.origin ?? "")) !== targetOrigin) continue;
    if (normalizeCarrierName(String(d.destination ?? "")) !== targetDest) continue;
    if ((quote.currency || "").trim().toUpperCase() !== targetCurrency) continue;

    const timestamp = typeof quote.timestamp === "number" ? quote.timestamp : parseCreatedAt(quote.date || "");
    const liners = Array.isArray(d.liners) ? (d.liners as Record<string, unknown>[]) : [];

    for (const raw of liners) {
      const name = normalizeCarrierName(String(raw.name ?? ""));
      const isTier1 = Boolean(targetCarrier) && name === targetCarrier;

      if (isTier1) {
        const containers = Array.isArray(raw.containers) ? (raw.containers as Record<string, unknown>[]) : [];
        for (const row of containers) {
          const type = normalizeSurchargeName(String(row.type ?? ""));
          if (!type) continue;
          pushSample(containerSell1, type, Number(row.sellRate) || 0, timestamp);
          pushSample(containerBuy1, type, Number(row.buyRate) || 0, timestamp);
        }
        if (raw.lclSell) lclSell1.push({ value: Number(raw.lclSell), timestamp });
        if (raw.lclBuy) lclBuy1.push({ value: Number(raw.lclBuy), timestamp });
      }

      const originRows = Array.isArray(raw.originSurcharges) ? (raw.originSurcharges as Record<string, unknown>[]) : [];
      for (const row of originRows) {
        const rname = normalizeSurchargeName(String(row.name ?? ""));
        if (!rname) continue;
        pushSample(originSell2, rname, Number(row.sell) || 0, timestamp);
        pushSample(originBuy2, rname, Number(row.buy) || 0, timestamp);
        if (isTier1) {
          pushSample(originSell1, rname, Number(row.sell) || 0, timestamp);
          pushSample(originBuy1, rname, Number(row.buy) || 0, timestamp);
        }
      }
      const destRows = Array.isArray(raw.destSurcharges) ? (raw.destSurcharges as Record<string, unknown>[]) : [];
      for (const row of destRows) {
        const rname = normalizeSurchargeName(String(row.name ?? ""));
        if (!rname) continue;
        pushSample(destSell2, rname, Number(row.sell) || 0, timestamp);
        pushSample(destBuy2, rname, Number(row.buy) || 0, timestamp);
        if (isTier1) {
          pushSample(destSell1, rname, Number(row.sell) || 0, timestamp);
          pushSample(destBuy1, rname, Number(row.buy) || 0, timestamp);
        }
      }
    }
  }

  const containerSellR = reduceMap(containerSell1);
  const containerBuyR = reduceMap(containerBuy1);
  const containerTypes = new Set([...containerSellR.keys(), ...containerBuyR.keys()]);
  const containers: Record<string, ChargeValue> = {};
  for (const type of containerTypes) containers[type] = chargeValue(containerSellR, containerBuyR, type);

  const originSell1R = reduceMap(originSell1);
  const originBuy1R = reduceMap(originBuy1);
  const originSell2R = reduceMap(originSell2);
  const originBuy2R = reduceMap(originBuy2);
  const destSell1R = reduceMap(destSell1);
  const destBuy1R = reduceMap(destBuy1);
  const destSell2R = reduceMap(destSell2);
  const destBuy2R = reduceMap(destBuy2);

  const originNames = new Set([...originSell2R.keys(), ...originBuy2R.keys()]);
  const destNames = new Set([...destSell2R.keys(), ...destBuy2R.keys()]);

  const originSurcharges: Record<string, ChargeValue> = {};
  for (const name of originNames) {
    originSurcharges[name] = {
      sell: originSell1R.get(name) ?? originSell2R.get(name) ?? null,
      buy: originBuy1R.get(name) ?? originBuy2R.get(name) ?? null,
    };
  }
  const destSurcharges: Record<string, ChargeValue> = {};
  for (const name of destNames) {
    destSurcharges[name] = {
      sell: destSell1R.get(name) ?? destSell2R.get(name) ?? null,
      buy: destBuy1R.get(name) ?? destBuy2R.get(name) ?? null,
    };
  }

  return {
    containers,
    lcl: { sell: pickConsistentValue(lclSell1), buy: pickConsistentValue(lclBuy1) },
    originSurcharges,
    destSurcharges,
  };
}

export interface CourierAutofillResult {
  marginPct: number | null;
  manualSell: number | null;
  manualBuy: number | null;
  fuelPct: number | null;
  remoteAmount: number | null;
  residentialAmount: number | null;
  saturdayAmount: number | null;
  dgAmount: number | null;
  insurancePct: number | null;
  declaredValue: number | null;
  oversizedAmount: number | null;
}

/**
 * Courier surcharges are single scalars (no sell/buy split) and are
 * genuinely carrier-specific — fuel %, remote fee etc. vary a lot between
 * courier companies, so (unlike Air/Sea local surcharges) there is no
 * Tier-2 any-carrier fallback: a value only fills in when the same
 * directory carrier was used before.
 */
export function extractCourierCharges(quotes: SavedQuote[], filter: HistoricalMatchFilter): CourierAutofillResult {
  const targetOrigin = normalizeCarrierName(filter.origin);
  const targetDest = normalizeCarrierName(filter.destination);
  const targetCurrency = filter.currency.trim().toUpperCase();
  const targetCarrier = filter.carrierName ? normalizeCarrierName(filter.carrierName) : "";

  const marginS: Sample[] = [];
  const manualSellS: Sample[] = [];
  const manualBuyS: Sample[] = [];
  const fuelPctS: Sample[] = [];
  const remoteAmountS: Sample[] = [];
  const residentialAmountS: Sample[] = [];
  const saturdayAmountS: Sample[] = [];
  const dgAmountS: Sample[] = [];
  const insurancePctS: Sample[] = [];
  const declaredValueS: Sample[] = [];
  const oversizedAmountS: Sample[] = [];

  for (const quote of quotes) {
    const d = quote.details ?? {};
    if (filter.scope && String(d.scope ?? "") !== filter.scope) continue;
    if (normalizeCarrierName(String(d.originCity ?? "")) !== targetOrigin) continue;
    if (normalizeCarrierName(String(d.destCity ?? "")) !== targetDest) continue;
    if ((quote.currency || "").trim().toUpperCase() !== targetCurrency) continue;
    if (!targetCarrier) continue;

    const timestamp = typeof quote.timestamp === "number" ? quote.timestamp : parseCreatedAt(quote.date || "");
    const cards = Array.isArray(d.carrierQuotes) ? (d.carrierQuotes as Record<string, unknown>[]) : [];

    for (const raw of cards) {
      const name = normalizeCarrierName(String(raw.directoryCarrier ?? ""));
      if (name !== targetCarrier) continue;
      if (raw.marginPct) marginS.push({ value: Number(raw.marginPct), timestamp });
      if (raw.manualSell) manualSellS.push({ value: Number(raw.manualSell), timestamp });
      if (raw.manualBuy) manualBuyS.push({ value: Number(raw.manualBuy), timestamp });
      const s = (raw.surcharges ?? {}) as Record<string, unknown>;
      if (s.fuelPct) fuelPctS.push({ value: Number(s.fuelPct), timestamp });
      if (s.remoteAmount) remoteAmountS.push({ value: Number(s.remoteAmount), timestamp });
      if (s.residentialAmount) residentialAmountS.push({ value: Number(s.residentialAmount), timestamp });
      if (s.saturdayAmount) saturdayAmountS.push({ value: Number(s.saturdayAmount), timestamp });
      if (s.dgAmount) dgAmountS.push({ value: Number(s.dgAmount), timestamp });
      if (s.insurancePct) insurancePctS.push({ value: Number(s.insurancePct), timestamp });
      if (s.declaredValue) declaredValueS.push({ value: Number(s.declaredValue), timestamp });
      if (s.oversizedAmount) oversizedAmountS.push({ value: Number(s.oversizedAmount), timestamp });
    }
  }

  return {
    marginPct: pickConsistentValue(marginS),
    manualSell: pickConsistentValue(manualSellS),
    manualBuy: pickConsistentValue(manualBuyS),
    fuelPct: pickConsistentValue(fuelPctS),
    remoteAmount: pickConsistentValue(remoteAmountS),
    residentialAmount: pickConsistentValue(residentialAmountS),
    saturdayAmount: pickConsistentValue(saturdayAmountS),
    dgAmount: pickConsistentValue(dgAmountS),
    insurancePct: pickConsistentValue(insurancePctS),
    declaredValue: pickConsistentValue(declaredValueS),
    oversizedAmount: pickConsistentValue(oversizedAmountS),
  };
}

export interface TransportAutofillResult {
  freightSell: number | null;
  freightBuy: number | null;
  detention: number | null;
  tolls: number | null;
}

/**
 * Transport quotes don't carry a flat origin/destination on `details` —
 * the route lives on the first lane — so matching reads `d.lanes[0]`
 * instead. Freight/detention/tolls are vendor-specific, so (like Courier)
 * this is Tier-1-only: no any-carrier fallback.
 */
export function extractTransportCharges(quotes: SavedQuote[], filter: HistoricalMatchFilter): TransportAutofillResult {
  const targetOrigin = normalizeCarrierName(filter.origin);
  const targetDest = normalizeCarrierName(filter.destination);
  const targetCurrency = filter.currency.trim().toUpperCase();
  const targetCarrier = filter.carrierName ? normalizeCarrierName(filter.carrierName) : "";

  const freightSellS: Sample[] = [];
  const freightBuyS: Sample[] = [];
  const detentionS: Sample[] = [];
  const tollsS: Sample[] = [];

  for (const quote of quotes) {
    const d = quote.details ?? {};
    const lanes = Array.isArray(d.lanes) ? (d.lanes as Record<string, unknown>[]) : [];
    const firstLane = (lanes[0] ?? {}) as Record<string, unknown>;
    const qOrigin = normalizeCarrierName(String(firstLane.origin ?? d.origin ?? ""));
    const qDest = normalizeCarrierName(String(firstLane.destination ?? d.destination ?? ""));
    if (qOrigin !== targetOrigin || qDest !== targetDest) continue;
    if ((quote.currency || "").trim().toUpperCase() !== targetCurrency) continue;
    if (!targetCarrier) continue;

    const timestamp = typeof quote.timestamp === "number" ? quote.timestamp : parseCreatedAt(quote.date || "");
    const truckers = Array.isArray(d.truckers) ? (d.truckers as Record<string, unknown>[]) : [];
    for (const raw of truckers) {
      const name = normalizeCarrierName(String(raw.name ?? ""));
      if (name !== targetCarrier) continue;
      if (raw.freightSell) freightSellS.push({ value: Number(raw.freightSell), timestamp });
      if (raw.freightBuy) freightBuyS.push({ value: Number(raw.freightBuy), timestamp });
      if (raw.detention) detentionS.push({ value: Number(raw.detention), timestamp });
      if (raw.tolls) tollsS.push({ value: Number(raw.tolls), timestamp });
    }
  }

  return {
    freightSell: pickConsistentValue(freightSellS),
    freightBuy: pickConsistentValue(freightBuyS),
    detention: pickConsistentValue(detentionS),
    tolls: pickConsistentValue(tollsS),
  };
}

export interface WarehouseAutofillResult {
  ratePerCbm: number | null;
  handling: number | null;
  buyTotal: number | null;
}

/**
 * Warehouse has no carrier concept at all — just a storage location — so
 * this matches purely on `details.location` (passed in as filter.origin by
 * the caller) with a single consistent value per field, no Tier-1/2 split.
 */
export function extractWarehouseCharges(quotes: SavedQuote[], filter: HistoricalMatchFilter): WarehouseAutofillResult {
  const targetLocation = normalizeCarrierName(filter.origin);
  const targetCurrency = filter.currency.trim().toUpperCase();

  const rateS: Sample[] = [];
  const handlingS: Sample[] = [];
  const buyTotalS: Sample[] = [];

  for (const quote of quotes) {
    const d = quote.details ?? {};
    if (normalizeCarrierName(String(d.location ?? "")) !== targetLocation) continue;
    if ((quote.currency || "").trim().toUpperCase() !== targetCurrency) continue;

    const timestamp = typeof quote.timestamp === "number" ? quote.timestamp : parseCreatedAt(quote.date || "");
    if (d.ratePerCbm) rateS.push({ value: Number(d.ratePerCbm), timestamp });
    if (d.handling) handlingS.push({ value: Number(d.handling), timestamp });
    if (d.buyTotal) buyTotalS.push({ value: Number(d.buyTotal), timestamp });
  }

  return {
    ratePerCbm: pickConsistentValue(rateS),
    handling: pickConsistentValue(handlingS),
    buyTotal: pickConsistentValue(buyTotalS),
  };
}
