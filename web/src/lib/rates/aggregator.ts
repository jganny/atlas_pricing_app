/**
 * Multi-carrier rate aggregator.
 *
 * Honest scope: there is no free global API that returns live Maersk/Emirates
 * sell rates. This module combines:
 *  1. Atlas circulars (when available via existing smart-quote pipeline)
 *  2. Free public carrier directories (airlines.json / liner SCAC list)
 *  3. Transparent lane-band estimates (clearly labeled, not carrier contracts)
 *  4. Pluggable slots for paid keys later (Searates, Shipsgo, Amadeus, …)
 */

export type TransportMode = "air" | "sea" | "road" | "all";

export type RateQuoteCard = {
  id: string;
  mode: "air" | "sea" | "road";
  carrierCode: string;
  carrierName: string;
  service: string;
  origin: string;
  destination: string;
  transitDays: number;
  currency: "USD" | "INR";
  total: number;
  perUnit?: number;
  unitLabel?: string;
  source: "estimate" | "circular" | "directory";
  sourceNote: string;
  co2eTons?: number;
  highlights: string[];
};

export type RateSearchInput = {
  mode: TransportMode;
  origin: string;
  destination: string;
  weightKg?: number;
  volumeCbm?: number;
  containers?: number;
  readyDate?: string;
  insurance?: boolean;
  customs?: boolean;
  dangerous?: boolean;
  localChargesOnly?: boolean;
};

function laneBand(
  origin: string,
  destination: string,
  mode: "air" | "sea",
): {
  usdPerKg?: number;
  usdPerCbm?: number;
  usdPerTeu?: number;
  transitDays: number;
  region: string;
} {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  const sameCountry =
    (o.length === 3 && d.length === 3 && o[0] === d[0]) ||
    (o.length >= 5 && d.length >= 5 && o.slice(0, 2) === d.slice(0, 2));

  const indiaAir = new Set(["BOM", "BLR", "DEL", "MAA", "HYD", "CCU", "COK", "AMD"]);
  const indiaTouch =
    o.startsWith("IN") ||
    d.startsWith("IN") ||
    indiaAir.has(o) ||
    indiaAir.has(d);

  if (mode === "air") {
    if (sameCountry || (indiaAir.has(o) && indiaAir.has(d))) {
      return { usdPerKg: 1.8, transitDays: 1, region: "Domestic air" };
    }
    if (indiaTouch) {
      return { usdPerKg: 4.2, transitDays: 3, region: "India trade lane" };
    }
    return { usdPerKg: 5.5, transitDays: 5, region: "Intercontinental air" };
  }

  if (sameCountry) {
    return { usdPerCbm: 18, usdPerTeu: 450, transitDays: 4, region: "Domestic / coastal" };
  }
  if (indiaTouch) {
    return { usdPerCbm: 42, usdPerTeu: 1450, transitDays: 18, region: "India ocean lane" };
  }
  return { usdPerCbm: 55, usdPerTeu: 2100, transitDays: 28, region: "Deep-sea" };
}

const AIR_SERVICES = [
  { code: "EK", name: "Emirates SkyCargo", service: "Express", mult: 1.18, daysAdj: -1 },
  { code: "QR", name: "Qatar Airways Cargo", service: "Priority", mult: 1.12, daysAdj: -1 },
  { code: "SQ", name: "Singapore Airlines Cargo", service: "Premium", mult: 1.08, daysAdj: 0 },
  { code: "LH", name: "Lufthansa Cargo", service: "td.Pro", mult: 1.05, daysAdj: 0 },
  { code: "CV", name: "Cargolux", service: "General", mult: 0.95, daysAdj: 1 },
  { code: "AI", name: "Air India Cargo", service: "Standard", mult: 0.9, daysAdj: 1 },
];

const SEA_SERVICES = [
  { code: "MAEU", name: "Maersk", service: "Maersk Spot est.", mult: 1.1, daysAdj: -2 },
  { code: "MSCU", name: "MSC", service: "Spot estimate", mult: 1.05, daysAdj: 0 },
  { code: "CMDU", name: "CMA CGM", service: "Spot estimate", mult: 1.08, daysAdj: -1 },
  { code: "COSU", name: "COSCO", service: "Economy", mult: 0.92, daysAdj: 2 },
  { code: "HLCU", name: "Hapag-Lloyd", service: "Standard", mult: 1.02, daysAdj: 0 },
  { code: "ONEY", name: "Ocean Network Express", service: "Standard", mult: 0.98, daysAdj: 1 },
];

function surchargeUsd(input: RateSearchInput): number {
  let s = 0;
  if (input.insurance) s += 35;
  if (input.customs) s += 55;
  if (input.dangerous) s += 120;
  if (input.localChargesOnly) s += 40;
  return s;
}

export function searchRateCards(input: RateSearchInput): RateQuoteCard[] {
  const origin = input.origin.trim().toUpperCase();
  const destination = input.destination.trim().toUpperCase();
  if (!origin || !destination) return [];

  const modes: Array<"air" | "sea"> =
    input.mode === "all" ? ["air", "sea"] : input.mode === "road" ? [] : [input.mode];

  const cards: RateQuoteCard[] = [];
  const extras = surchargeUsd(input);
  const weight = Math.max(1, input.weightKg || 100);
  const cbm = Math.max(0.1, input.volumeCbm || weight / 167);
  const teu = Math.max(1, input.containers || 1);

  for (const mode of modes) {
    const band = laneBand(origin, destination, mode);
    const roster = mode === "air" ? AIR_SERVICES : SEA_SERVICES;
    for (const c of roster) {
      let total = extras;
      let perUnit = 0;
      let unitLabel = "";
      if (mode === "air") {
        perUnit = (band.usdPerKg || 4) * c.mult;
        total += perUnit * weight;
        unitLabel = "USD/kg";
      } else if ((input.containers || 0) > 0) {
        perUnit = (band.usdPerTeu || 1500) * c.mult;
        total += perUnit * teu;
        unitLabel = "USD/TEU";
      } else {
        perUnit = (band.usdPerCbm || 45) * c.mult;
        total += perUnit * cbm;
        unitLabel = "USD/CBM";
      }
      const transit = Math.max(1, band.transitDays + c.daysAdj);
      cards.push({
        id: `${mode}-${c.code}-${origin}-${destination}`,
        mode,
        carrierCode: c.code,
        carrierName: c.name,
        service: c.service,
        origin,
        destination,
        transitDays: transit,
        currency: "USD",
        total: Math.round(total),
        perUnit: Math.round(perUnit * 100) / 100,
        unitLabel,
        source: "estimate",
        sourceNote: `${band.region} · Atlas open estimate (not a carrier contract). Use Circulars or a paid rate API for live sell rates.`,
        co2eTons:
          mode === "air"
            ? Math.round((weight / 1000) * 2.1 * 10) / 10
            : Math.round(teu * 1.8 * 10) / 10,
        highlights: [
          band.region,
          input.dangerous ? "DG surcharge applied" : "General cargo",
          input.insurance ? "Insurance add-on" : "Ex-works style",
        ],
      });
    }
  }

  if (input.mode === "road" || input.mode === "all") {
    cards.push({
      id: `road-ATL-${origin}-${destination}`,
      mode: "road",
      carrierCode: "ATL",
      carrierName: "Atlas Road",
      service: "FTL / LTL estimate",
      origin,
      destination,
      transitDays: 3,
      currency: "INR",
      total: Math.round(Math.max(4500, weight * 12 + cbm * 800)),
      perUnit: 12,
      unitLabel: "INR/kg",
      source: "estimate",
      sourceNote: "Domestic road band estimate for Indian corridors.",
      highlights: ["Door options", "Local cartage"],
    });
  }

  return cards.sort((a, b) => {
    const au = a.currency === "USD" ? a.total : a.total / 83;
    const bu = b.currency === "USD" ? b.total : b.total / 83;
    return au - bu;
  });
}

export const RATE_PROVIDER_SLOTS = [
  {
    id: "circulars",
    name: "Atlas Circulars",
    status: "active" as const,
    note: "Your uploaded airline/liner tariffs",
  },
  {
    id: "atlas-estimate",
    name: "Atlas open estimates",
    status: "active" as const,
    note: "Free lane-band model + public carrier directory",
  },
  {
    id: "frankfurter",
    name: "Frankfurter / ER-API FX",
    status: "active" as const,
    note: "Free mid-market USD · EUR · GBP → INR",
  },
  {
    id: "iata-tact",
    name: "IATA TACT Tariffs API",
    status: "ready" as const,
    note: "Published air tariffs (not live inventory) — subscribe via IATA, then wire credentials",
  },
  {
    id: "dcsa",
    name: "DCSA carrier APIs",
    status: "ready" as const,
    note: "Shared OpenAPI shape for MSC/Maersk/CMA/Hapag/… — needs per-carrier portal credentials",
  },
  {
    id: "one-record",
    name: "IATA ONE Record",
    status: "ready" as const,
    note: "Air cargo JSON-LD standard — pilot stage; Circulars remain live rates",
  },
  {
    id: "searates",
    name: "Searates / ShipsGo",
    status: "ready" as const,
    note: "Add API key when you subscribe — slot already reserved",
  },
  {
    id: "amadeus",
    name: "Amadeus Air",
    status: "ready" as const,
    note: "Sandbox key optional for schedule enrichment",
  },
] as const;
