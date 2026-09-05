/**
 * Free global carrier directory — no paid API keys required.
 * Curated majors + slim OpenFlights dump for broad search.
 */

export type CarrierKind = "airline" | "ocean" | "courier";

export type CarrierRecord = {
  code: string;
  name: string;
  kind: CarrierKind;
  country?: string;
  trackingUrl?: string;
  website?: string;
};

/** Majors desks quote daily — public metadata only. */
export const CURATED_CARRIERS: CarrierRecord[] = [
  { code: "EK", name: "Emirates SkyCargo", kind: "airline", country: "AE", website: "https://www.skycargo.com", trackingUrl: "https://www.skycargo.com/en/track/" },
  { code: "QR", name: "Qatar Airways Cargo", kind: "airline", country: "QA", website: "https://www.qrcargo.com" },
  { code: "SQ", name: "Singapore Airlines Cargo", kind: "airline", country: "SG", website: "https://www.siacargo.com" },
  { code: "LH", name: "Lufthansa Cargo", kind: "airline", country: "DE", website: "https://www.lufthansa-cargo.com" },
  { code: "CV", name: "Cargolux", kind: "airline", country: "LU", website: "https://www.cargolux.com" },
  { code: "AI", name: "Air India Cargo", kind: "airline", country: "IN", website: "https://www.airindia.com" },
  { code: "EY", name: "Etihad Cargo", kind: "airline", country: "AE", website: "https://www.etihadcargo.com" },
  { code: "TK", name: "Turkish Cargo", kind: "airline", country: "TR", website: "https://www.turkishcargo.com" },
  { code: "CX", name: "Cathay Pacific Cargo", kind: "airline", country: "HK", website: "https://www.cathaypacificcargo.com" },
  { code: "BA", name: "IAG Cargo", kind: "airline", country: "GB", website: "https://www.iagcargo.com" },
  { code: "AF", name: "Air France / KLM Cargo", kind: "airline", country: "FR", website: "https://www.afklcargo.com" },
  { code: "DL", name: "Delta Cargo", kind: "airline", country: "US" },
  { code: "UA", name: "United Cargo", kind: "airline", country: "US" },
  { code: "AA", name: "American Airlines Cargo", kind: "airline", country: "US" },
  { code: "QF", name: "Qantas Freight", kind: "airline", country: "AU" },
  { code: "NH", name: "ANA Cargo", kind: "airline", country: "JP" },
  { code: "KE", name: "Korean Air Cargo", kind: "airline", country: "KR" },
  { code: "TG", name: "Thai Cargo", kind: "airline", country: "TH" },
  { code: "MH", name: "MASkargo", kind: "airline", country: "MY" },
  { code: "SV", name: "Saudia Cargo", kind: "airline", country: "SA" },
  { code: "ET", name: "Ethiopian Cargo", kind: "airline", country: "ET" },
  { code: "6E", name: "IndiGo", kind: "airline", country: "IN" },
  { code: "MAEU", name: "Maersk", kind: "ocean", country: "DK", website: "https://www.maersk.com", trackingUrl: "https://www.maersk.com/tracking/" },
  { code: "MSCU", name: "MSC", kind: "ocean", country: "CH", website: "https://www.msc.com", trackingUrl: "https://www.msc.com/track-a-shipment" },
  { code: "CMDU", name: "CMA CGM", kind: "ocean", country: "FR", website: "https://www.cma-cgm.com", trackingUrl: "https://www.cma-cgm.com/ebusiness/tracking" },
  { code: "COSU", name: "COSCO Shipping", kind: "ocean", country: "CN", website: "https://elines.coscoshipping.com" },
  { code: "HLCU", name: "Hapag-Lloyd", kind: "ocean", country: "DE", website: "https://www.hapag-lloyd.com", trackingUrl: "https://www.hapag-lloyd.com/en/online-business/track/" },
  { code: "ONEY", name: "ONE (Ocean Network Express)", kind: "ocean", country: "JP", website: "https://www.one-line.com" },
  { code: "EGLV", name: "Evergreen Line", kind: "ocean", country: "TW" },
  { code: "YMLU", name: "Yang Ming", kind: "ocean", country: "TW" },
  { code: "ZIMU", name: "ZIM", kind: "ocean", country: "IL" },
  { code: "HJSC", name: "HMM", kind: "ocean", country: "KR" },
  { code: "OOLU", name: "OOCL", kind: "ocean", country: "HK" },
  { code: "WHLC", name: "Wan Hai Lines", kind: "ocean", country: "TW" },
  { code: "SUDU", name: "Hamburg Süd", kind: "ocean", country: "DE" },
  { code: "MATS", name: "Matson", kind: "ocean", country: "US" },
  { code: "DHL", name: "DHL Express", kind: "courier", country: "DE", trackingUrl: "https://www.dhl.com/track" },
  { code: "FDX", name: "FedEx", kind: "courier", country: "US", trackingUrl: "https://www.fedex.com/tracking" },
  { code: "UPS", name: "UPS", kind: "courier", country: "US", trackingUrl: "https://www.ups.com/track" },
  { code: "TNT", name: "TNT / FedEx", kind: "courier", country: "NL" },
  { code: "ARAMEX", name: "Aramex", kind: "courier", country: "AE", trackingUrl: "https://www.aramex.com/track" },
  { code: "DTDC", name: "DTDC", kind: "courier", country: "IN" },
  { code: "BLUEDART", name: "Blue Dart", kind: "courier", country: "IN" },
  { code: "DELHIVERY", name: "Delhivery", kind: "courier", country: "IN" },
];

type SlimFile = {
  air?: Array<{ code: string; name: string; country?: string }>;
  sea?: Array<{ code: string; name: string; country?: string }>;
};

let slimCache: CarrierRecord[] | null = null;

function isJunkCode(code: string): boolean {
  if (!code || code.length > 4) return true;
  if (!/^[A-Z0-9]{2,4}$/i.test(code)) return true;
  return false;
}

export async function loadExtendedCarriers(): Promise<CarrierRecord[]> {
  if (slimCache) return slimCache;
  try {
    const res = await fetch("/app/data/carriers-slim.json", { cache: "force-cache" });
    if (!res.ok) throw new Error("carriers");
    const data = (await res.json()) as SlimFile;
    const rows: CarrierRecord[] = [];
    for (const a of data.air || []) {
      if (isJunkCode(a.code)) continue;
      if (!a.name || a.name.length < 2) continue;
      rows.push({
        code: a.code.toUpperCase(),
        name: a.name,
        kind: "airline",
        country: a.country,
      });
    }
    for (const s of data.sea || []) {
      if (!s.code || !s.name) continue;
      rows.push({
        code: s.code.toUpperCase(),
        name: s.name,
        kind: "ocean",
        country: s.country,
      });
    }
    slimCache = rows;
    return rows;
  } catch {
    slimCache = [];
    return [];
  }
}

export async function searchCarriers(
  query: string,
  kind: CarrierKind | "all" = "all",
  limit = 40,
): Promise<CarrierRecord[]> {
  const q = query.trim().toLowerCase();
  const curated = CURATED_CARRIERS.filter((c) => kind === "all" || c.kind === kind);
  if (!q) return curated.slice(0, limit);

  const curatedHits = curated.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.country || "").toLowerCase().includes(q),
  );

  const extended = await loadExtendedCarriers();
  const seen = new Set(curatedHits.map((c) => `${c.kind}:${c.code}`));
  const more: CarrierRecord[] = [];
  for (const c of extended) {
    if (kind !== "all" && c.kind !== kind) continue;
    const key = `${c.kind}:${c.code}`;
    if (seen.has(key)) continue;
    if (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.country || "").toLowerCase().includes(q)
    ) {
      seen.add(key);
      more.push(c);
    }
    if (curatedHits.length + more.length >= limit) break;
  }
  return [...curatedHits, ...more].slice(0, limit);
}

export const FREE_DATA_SOURCES = [
  {
    id: "curated",
    name: "Atlas curated carriers",
    note: "Major airlines, liners, and couriers with public tracking links",
  },
  {
    id: "openflights",
    name: "OpenFlights airlines",
    note: "Community airline codes — free, no key",
  },
  {
    id: "locations",
    name: "Airports / seaports",
    note: "IATA + port codes for origin/destination search — free static data",
  },
  {
    id: "frankfurter",
    name: "Frankfurter / ER-API FX",
    note: "Free mid-market USD/INR",
  },
  {
    id: "estimates",
    name: "Atlas lane estimates",
    note: "Transparent band model — not a live carrier contract rate",
  },
] as const;
