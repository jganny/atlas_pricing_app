/**
 * Free global carrier directory — no paid API keys required.
 * Curated majors + bundled OpenFlights dump (imported, never fetched from a stale CDN).
 */

import slimSeed from "../../../public/data/carriers-slim.json";

export type CarrierKind = "airline" | "ocean" | "courier";
export type CarrierSearchKind = CarrierKind | "all" | "airline+courier";

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
  { code: "UL", name: "SriLankan Airlines", kind: "airline", country: "LK", website: "https://www.srilankan.com" },
  { code: "SG", name: "SpiceJet", kind: "airline", country: "IN" },
  { code: "IX", name: "Air India Express", kind: "airline", country: "IN" },
  { code: "G8", name: "Go First / GoAir", kind: "airline", country: "IN" },
  { code: "UK", name: "Vistara", kind: "airline", country: "IN" },
  { code: "WY", name: "Oman Air", kind: "airline", country: "OM" },
  { code: "GF", name: "Gulf Air", kind: "airline", country: "BH" },
  { code: "KU", name: "Kuwait Airways", kind: "airline", country: "KW" },
  { code: "RJ", name: "Royal Jordanian", kind: "airline", country: "JO" },
  { code: "MS", name: "EgyptAir Cargo", kind: "airline", country: "EG" },
  { code: "OZ", name: "Asiana Cargo", kind: "airline", country: "KR" },
  { code: "CZ", name: "China Southern Cargo", kind: "airline", country: "CN" },
  { code: "CA", name: "Air China Cargo", kind: "airline", country: "CN" },
  { code: "MU", name: "China Eastern", kind: "airline", country: "CN" },
  { code: "BR", name: "EVA Air Cargo", kind: "airline", country: "TW" },
  { code: "CI", name: "China Airlines Cargo", kind: "airline", country: "TW" },
  { code: "JL", name: "JAL Cargo", kind: "airline", country: "JP" },
  { code: "NZ", name: "Air New Zealand", kind: "airline", country: "NZ" },
  { code: "SA", name: "South African Airways", kind: "airline", country: "ZA" },
  { code: "KQ", name: "Kenya Airways Cargo", kind: "airline", country: "KE" },
  { code: "AT", name: "Royal Air Maroc", kind: "airline", country: "MA" },
  { code: "IB", name: "Iberia / IAG Cargo", kind: "airline", country: "ES" },
  { code: "AZ", name: "ITA Airways / IAG Cargo", kind: "airline", country: "IT" },
  { code: "LX", name: "SWISS WorldCargo", kind: "airline", country: "CH" },
  { code: "OS", name: "Austrian Cargo", kind: "airline", country: "AT" },
  { code: "SK", name: "SAS Cargo", kind: "airline", country: "SE" },
  { code: "KL", name: "KLM Cargo", kind: "airline", country: "NL" },
  { code: "VS", name: "Virgin Atlantic Cargo", kind: "airline", country: "GB" },
  { code: "AC", name: "Air Canada Cargo", kind: "airline", country: "CA" },
  { code: "AM", name: "Aeromexico Cargo", kind: "airline", country: "MX" },
  { code: "LA", name: "LATAM Cargo", kind: "airline", country: "CL" },
  { code: "JJ", name: "LATAM Brasil", kind: "airline", country: "BR" },
  { code: "5X", name: "UPS Airlines", kind: "airline", country: "US" },
  { code: "FX", name: "FedEx Express", kind: "airline", country: "US" },
  { code: "5Y", name: "Atlas Air", kind: "airline", country: "US" },
  { code: "CK", name: "China Cargo Airlines", kind: "airline", country: "CN" },
  { code: "Y8", name: "Suparna / Yangtze River Express", kind: "airline", country: "CN" },
  { code: "RU", name: "AirBridgeCargo", kind: "airline", country: "RU" },
  { code: "QY", name: "European Air Transport / DHL", kind: "airline", country: "DE" },
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

const GDS_CODES = new Set(["1A", "1B", "1C", "1D", "1E", "1F", "1G", "1L", "1P", "1S", "1U", "1Y"]);

const NAME_ALIASES: Array<{ codes: string[]; needles: string[] }> = [
  { codes: ["UL"], needles: ["sri lankan", "srilankan", "sri-lankan", "srilanka"] },
  { codes: ["EK"], needles: ["skycargo", "emirates cargo"] },
  { codes: ["EY"], needles: ["etihad cargo"] },
  { codes: ["QR"], needles: ["qatar cargo"] },
  { codes: ["AI"], needles: ["air india cargo"] },
];

function isJunkCode(code: string): boolean {
  if (!code || code.length > 4) return true;
  if (!/^[A-Z0-9]{2,4}$/i.test(code)) return true;
  if (GDS_CODES.has(code.toUpperCase())) return true;
  return false;
}

function isJunkName(name: string): boolean {
  return /virtual|dummy|consultative|amadeus|sabre|galileo|travelport|abacus|worldspan/i.test(
    name,
  );
}

/** Rank hits so IATA code "UL" returns SriLankan Airlines, not names that merely contain "ul". */
export function rankCarrierHits(
  query: string,
  records: CarrierRecord[],
  limit = 40,
): CarrierRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return records.slice(0, limit);

  const aliasCodes = new Set<string>();
  for (const row of NAME_ALIASES) {
    if (row.needles.some((n) => n.includes(q) || q.includes(n))) {
      for (const c of row.codes) aliasCodes.add(c);
    }
  }

  const scored: Array<{ c: CarrierRecord; score: number }> = [];
  for (const c of records) {
    if (isJunkCode(c.code) || isJunkName(c.name)) continue;
    const code = c.code.toLowerCase();
    const name = c.name.toLowerCase();
    const country = (c.country || "").toLowerCase();
    let score = 0;
    if (code === q) score = 1000;
    else if (aliasCodes.has(c.code.toUpperCase()) && q.length >= 2) score = 900;
    else if (code.startsWith(q)) score = 800;
    else if (name.startsWith(q)) score = 600;
    else if (name.split(/[\s/—\-]+/).some((w) => w.startsWith(q))) score = 500;
    else if (q.length >= 3 && name.includes(q)) score = 120;
    else if (q.length >= 3 && country.includes(q)) score = 80;
    else if (q.length >= 3 && code.includes(q)) score = 60;
    if (score > 0) scored.push({ c, score });
  }
  scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  const seen = new Set<string>();
  const out: CarrierRecord[] = [];
  for (const row of scored) {
    const key = `${row.c.kind}:${row.c.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row.c);
    if (out.length >= limit) break;
  }
  return out;
}

function recordsFromSlim(data: SlimFile): CarrierRecord[] {
  const rows: CarrierRecord[] = [];
  for (const a of data.air || []) {
    if (isJunkCode(a.code)) continue;
    if (!a.name || a.name.length < 2 || isJunkName(a.name)) continue;
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
  return rows;
}

const BUNDLED_EXTENDED = recordsFromSlim(slimSeed as SlimFile);

function kindsFor(kind: CarrierSearchKind): CarrierKind[] | null {
  if (kind === "all") return null;
  if (kind === "airline+courier") return ["airline", "courier"];
  return [kind];
}

function carrierPool(kind: CarrierSearchKind): CarrierRecord[] {
  const kinds = kindsFor(kind);
  const pool: CarrierRecord[] = [];
  const seen = new Set<string>();
  for (const c of [...CURATED_CARRIERS, ...BUNDLED_EXTENDED]) {
    if (kinds && !kinds.includes(c.kind)) continue;
    const key = `${c.kind}:${c.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(c);
  }
  return pool;
}

export function airlineDirectoryCount(): number {
  return carrierPool("airline").length;
}

export function formatCarrierLabel(c: Pick<CarrierRecord, "code" | "name">): string {
  return `${c.code} — ${c.name}`;
}

/** Turn "ul" / "UL" / "sri lankan" into "UL — SriLankan Airlines". */
export function resolveCarrierLabel(raw: string, kind: CarrierSearchKind = "airline"): string {
  const t = raw.trim();
  if (!t) return t;
  const labeled = t.match(/^([A-Za-z0-9]{2,4})\s*[—–-]\s*(.+)$/);
  const codeGuess = (labeled?.[1] || t).trim().toUpperCase();
  const hits = rankCarrierHits(labeled ? codeGuess : t, carrierPool(kind), 12);
  const exact = hits.find((h) => h.code === codeGuess);
  if (exact) return formatCarrierLabel(exact);
  if (!labeled && t.length >= 3 && hits[0]) return formatCarrierLabel(hits[0]);
  return t;
}

export async function loadExtendedCarriers(): Promise<CarrierRecord[]> {
  return BUNDLED_EXTENDED;
}

export async function searchCarriers(
  query: string,
  kind: CarrierSearchKind = "all",
  limit = 40,
): Promise<CarrierRecord[]> {
  const q = query.trim();
  const pool = carrierPool(kind);
  if (!q) return pool.filter((c) => CURATED_CARRIERS.some((x) => x.code === c.code && x.kind === c.kind)).slice(0, limit);
  return rankCarrierHits(q, pool, limit);
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
