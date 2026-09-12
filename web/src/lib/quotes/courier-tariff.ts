import { inferCountryFromText } from "@/lib/locations/country-aliases";

export const COURIER_TARIFF_MAX_KG = 70;
export const COURIER_TARIFF_MARKUP_PCT = 5;
const LOCAL_KEY = "atlas_courier_tariff_books_v1";

export type CourierTariffDirection = "export" | "import" | "domestic";

export type CourierTariffBreak = { kg: number; rate: number };

export type CourierTariffLane = {
  origin: string;
  destination: string;
  destinationLabel: string;
  direction: CourierTariffDirection;
  breaks: CourierTariffBreak[];
};

export type CourierTariffBook = {
  id: string;
  carrier: string;
  carrierCode: string;
  carrierId: string;
  year: number;
  validFrom: string;
  validTo: string;
  currency: string;
  maxKg: number;
  lanes: CourierTariffLane[];
  /** ISO2 country → zone key (ZONE-A). Used when the rate grid is priced by zone. */
  zoneMap?: Record<string, string>;
  warnings?: string[];
  fileName?: string;
  uploadedAt: string;
};

export type CourierTariffLookup =
  | {
      status: "hit";
      lane: CourierTariffLane;
      kg: number;
      slabKg: number;
      rate: number;
      book: CourierTariffBook;
    }
  | { status: "over-max"; maxKg: number; kg: number }
  | { status: "missing" };

export type SheetGrid = { name: string; rows: unknown[][] };

const SKIP_EXACT =
  /^(weight|wgt|wt|kg|kgs|kilo|kilos|lbs|lb|sr|sno|sl|no|#|rate|buy|sell|min|remarks?|notes?|from|to|origin|destination|zone|service|mode|country|nation|place|location)$/i;

const SKIP_FUZZY = /s\.?\s*no|sr\.?\s*no|sl\.?\s*no|^serial|remarks?|notes?/;

const CARRIER_IDS: Array<{ id: string; code: string; name: string; needles: string[] }> = [
  { id: "fedex", code: "FDX", name: "FedEx", needles: ["fedex", "fed ex", "fdx", "tnt"] },
  { id: "dhl", code: "DHL", name: "DHL Express", needles: ["dhl"] },
  { id: "ups", code: "UPS", name: "UPS", needles: ["ups"] },
  { id: "bluedart", code: "BD", name: "Blue Dart", needles: ["blue dart", "bluedart", "blue-dart"] },
  { id: "aramex", code: "ARAMEX", name: "Aramex", needles: ["aramex"] },
  { id: "dtdc", code: "DTDC", name: "DTDC", needles: ["dtdc"] },
];

export function inferCourierCarrier(raw: string): { id: string; code: string; name: string } {
  const t = raw.toLowerCase();
  for (const row of CARRIER_IDS) {
    if (row.needles.some((n) => t.includes(n))) return { id: row.id, code: row.code, name: row.name };
  }
  if (/\bfx\b/.test(t)) return { id: "fedex", code: "FDX", name: "FedEx" };
  return { id: "fedex", code: "FDX", name: "FedEx" };
}

export function applyCourierTariffMarkup(
  uploadedRate: number,
  markupPct = COURIER_TARIFF_MARKUP_PCT,
): number {
  if (!(uploadedRate > 0)) return 0;
  return Math.round(uploadedRate * (1 + markupPct / 100) * 100) / 100;
}

export function courierTariffNeedsReupload(book: CourierTariffBook | null | undefined): boolean {
  if (!book?.lanes?.length) return false;
  const dests = book.lanes.map((l) => String(l.destination || ""));
  const numeric = dests.filter((d) => /^\d+(\.\d+)?$/.test(d)).length;
  if (numeric / dests.length > 0.4) return true;
  const zones = dests.filter((d) => /^ZONE-/.test(d)).length;
  const mapped = Object.keys(book.zoneMap || {}).length;
  if (zones / dests.length > 0.5 && mapped === 0) return true;
  return false;
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).replace(/\s+/g, " ").trim();
}

function isNumericToken(raw: string): boolean {
  return /^\d+(\.\d+)?$/.test(raw.trim());
}

function parseWeight(raw: string): number | null {
  const t = raw.toLowerCase().replace(/,/g, "").replace(/kgs?|kilos?|lbs?/g, "").trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0 || n > 200) return null;
    return Math.round(n * 1000) / 1000;
  }
  if (!/weight|wgt|upto|up to|^[\d.\s–—-]+$/.test(t)) return null;
  const m = t.match(/(\d+(\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 200) return null;
  return Math.round(n * 1000) / 1000;
}

function parseRate(raw: string): number | null {
  const t = raw.replace(/[,₹$€£]/g, "").replace(/\s/g, "");
  if (!t) return null;
  const n = Number(t.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function isRateLike(raw: string): boolean {
  if (!isNumericToken(raw) && !/^[\d,]+(\.\d+)?$/.test(raw.trim())) return false;
  const n = parseRate(raw);
  if (n == null) return false;
  const kg = parseWeight(raw);
  if (kg != null && kg <= COURIER_TARIFF_MAX_KG) return false;
  return n >= 80;
}

function inferDirection(name: string): CourierTariffDirection {
  const t = name.toLowerCase();
  if (/domestic|within india|india.?india/.test(t)) return "domestic";
  if (/import|inbound|incoming/.test(t)) return "import";
  if (/export|outbound|outgoing/.test(t)) return "export";
  return "export";
}

function inferCurrency(rows: string[][]): string {
  const blob = rows.slice(0, 8).flat().join(" ").toLowerCase();
  if (/\binr\b|₹|rupee/.test(blob)) return "INR";
  if (/\busd\b|\$/.test(blob)) return "USD";
  if (/\beur\b|€/.test(blob)) return "EUR";
  if (/\bgbp\b|£/.test(blob)) return "GBP";
  return "INR";
}

const PLACE_ISO: Record<string, string> = {
  usa: "US",
  "u.s.a": "US",
  "u.s": "US",
  "united states": "US",
  "united states of america": "US",
  uk: "GB",
  "u.k": "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  uae: "AE",
  emirates: "AE",
  korea: "KR",
  "south korea": "KR",
  "k.s.a": "SA",
  ksa: "SA",
};

function isSkipHeader(label: string): boolean {
  const t = label.trim();
  if (!t) return true;
  if (SKIP_EXACT.test(t)) return true;
  if (SKIP_FUZZY.test(t.toLowerCase())) return true;
  return false;
}

/** Zone A / A / ZONE-A / Z1 → canonical ZONE-A / ZONE-1. */
export function zoneToken(raw: string): { code: string; label: string } | null {
  const label = raw.trim();
  if (!label) return null;
  const letter = label.match(/^(?:zone\s*[-:]?\s*)?([A-N])$/i);
  if (letter) {
    const z = letter[1].toUpperCase();
    return { code: `ZONE-${z}`, label: `Zone ${z}` };
  }
  const numbered = label.match(/^(?:zone\s*[-:]?\s*|z\s*)(\d{1,2})$/i);
  if (numbered) {
    const z = numbered[1];
    return { code: `ZONE-${z}`, label: `Zone ${z}` };
  }
  return null;
}

function countryPlace(raw: string): { code: string; label: string } | null {
  const label = raw.trim();
  if (!label || isSkipHeader(label) || isNumericToken(label)) return null;
  if (zoneToken(label)) return null;
  const lower = label.toLowerCase().replace(/\./g, "");
  if (PLACE_ISO[lower]) return { code: PLACE_ISO[lower], label };
  const iso = inferCountryFromText(label);
  if (iso) return { code: iso, label };
  return null;
}

function placeKey(raw: string): { code: string; label: string } | null {
  const label = raw.trim();
  if (!label || isSkipHeader(label)) return null;
  if (isNumericToken(label)) return null;
  const zone = zoneToken(label);
  if (zone) return zone;
  const country = countryPlace(label);
  if (country) return country;
  const cleaned = label.replace(/[^A-Za-z0-9]+/g, " ").trim();
  if (cleaned.length < 2 || /^\d/.test(cleaned)) return null;
  if (/^(ip|ie|priority|economy|express|standard)$/i.test(cleaned)) return null;
  return { code: cleaned.toUpperCase().replace(/\s+/g, "-").slice(0, 24), label };
}

function splitPlaces(raw: string): string[] {
  return raw
    .split(/[,;/|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeZoneMap(into: Map<string, string>, from: Map<string, string> | Record<string, string>) {
  const entries = from instanceof Map ? from.entries() : Object.entries(from);
  for (const [k, v] of entries) {
    const iso = k.toUpperCase();
    const zone = zoneToken(v)?.code || (zoneToken(`Zone ${v}`)?.code ?? "");
    if (iso && zone) into.set(iso, zone);
  }
}

function parseCountryZoneTable(rows: string[][]): Map<string, string> {
  const map = new Map<string, string>();
  if (rows.length < 4) return map;
  const scan = Math.min(rows.length, 8);
  let headerIdx = -1;
  let countryIdx = -1;
  let zoneIdx = -1;
  for (let i = 0; i < scan; i++) {
    const header = (rows[i] || []).map((h) => h.toLowerCase());
    const c = header.findIndex((h) => /country|destination|origin|nation|place|location|name/.test(h));
    const z = header.findIndex((h) => /^(zone|z)$|zone code|service area|zone no/.test(h));
    if (c >= 0 && z >= 0 && c !== z) {
      headerIdx = i;
      countryIdx = c;
      zoneIdx = z;
      break;
    }
  }
  if (headerIdx < 0) {
    const width = Math.max(0, ...(rows.slice(0, 30).map((r) => r.length)));
    let bestC = -1;
    let bestZ = -1;
    let bestScore = 0;
    for (let c = 0; c < Math.min(width, 6); c++) {
      for (let z = 0; z < Math.min(width, 6); z++) {
        if (c === z) continue;
        let countries = 0;
        let zones = 0;
        for (const row of rows.slice(0, 40)) {
          if (countryPlace(row[c] || "")) countries += 1;
          if (zoneToken(row[z] || "")) zones += 1;
        }
        const score = Math.min(countries, zones);
        if (score > bestScore && countries >= 5 && zones >= 5) {
          bestScore = score;
          bestC = c;
          bestZ = z;
        }
      }
    }
    if (bestC >= 0) {
      countryIdx = bestC;
      zoneIdx = bestZ;
      headerIdx = 0;
    }
  }
  if (countryIdx < 0 || zoneIdx < 0) return map;
  const namedHeader = headerIdx >= 0 && rows[headerIdx]?.some((h) => /country|zone/i.test(h));
  const start = namedHeader ? headerIdx + 1 : 0;
  for (const row of rows.slice(start)) {
    const place = countryPlace(row[countryIdx] || "");
    const zone = zoneToken(row[zoneIdx] || "") || zoneToken(`Zone ${row[zoneIdx] || ""}`);
    if (place && zone) map.set(place.code, zone.code);
  }
  return map;
}

function parseZoneColumnCountries(rows: string[][]): Map<string, string> {
  const map = new Map<string, string>();
  const hi = headerRowIndex(rows);
  const header = rows[hi] || [];
  const destCols: Array<{ i: number; zone: string }> = [];
  header.forEach((h, i) => {
    const z = zoneToken(h);
    if (z) destCols.push({ i, zone: z.code });
  });
  if (destCols.length < 2) return map;
  const body = rows.slice(hi + 1);
  for (const row of body) {
    const kg = parseWeight(row[0] || "") ?? parseWeight(row[1] || "");
    if (kg != null) break;
    for (const col of destCols) {
      for (const part of splitPlaces(row[col.i] || "")) {
        const place = countryPlace(part);
        if (place) map.set(place.code, col.zone);
      }
    }
  }
  return map;
}

function harvestZoneMap(sheets: SheetGrid[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const sheet of sheets) {
    const rows = (sheet.rows || []).map((r) => (Array.isArray(r) ? r.map(cellStr) : []));
    mergeZoneMap(map, parseCountryZoneTable(rows));
    mergeZoneMap(map, parseZoneColumnCountries(rows));
  }
  return map;
}

function headerRowIndex(rows: string[][]): number {
  let best = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] || []).filter((c) => String(c || "").trim());
    if (cells.length < 2) continue;
    const rateHeavy = cells.filter((c) => isRateLike(c)).length / cells.length;
    if (rateHeavy > 0.5) continue;
    const places = cells.map(placeKey).filter(Boolean);
    const zones = cells.filter((c) => zoneToken(c)).length;
    const weights = cells.map(parseWeight).filter((n): n is number => n != null);
    const weightLabel = cells.some((c) => /weight|^kg/i.test(c)) ? 8 : 0;
    const score =
      (weights.length >= 3 ? weights.length + 20 : 0) + places.length * 2 + zones * 3 + weightLabel;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function uniqueBreaks(breaks: CourierTariffBreak[]): CourierTariffBreak[] {
  const byKg = new Map<number, number>();
  for (const b of breaks) {
    if (b.kg > COURIER_TARIFF_MAX_KG + 0.001) continue;
    byKg.set(b.kg, b.rate);
  }
  return [...byKg.entries()]
    .map(([kg, rate]) => ({ kg, rate }))
    .sort((a, b) => a.kg - b.kg);
}

function longFormatLanes(
  rows: string[][],
  direction: CourierTariffDirection,
): CourierTariffLane[] | null {
  const headerIdx = rows.findIndex(
    (r) => r.some((c) => /origin|pol|from/i.test(c)) && r.some((c) => /dest|pod|to/i.test(c)),
  );
  if (headerIdx < 0) return null;
  const header = rows[headerIdx].map((h) => h.toLowerCase().replace(/\s/g, ""));
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const o = idx(["origin", "pol", "from", "origincountry"]);
  const d = idx(["destination", "pod", "to", "destcountry", "country"]);
  const w = idx(["weight", "kg", "kgs", "wgt", "chargeable"]);
  const rate = idx(["rate", "sell", "amount", "tariff", "price", "inr", "usd"]);
  if (d < 0 || w < 0 || rate < 0) return null;
  const grouped = new Map<string, CourierTariffLane>();
  for (const row of rows.slice(headerIdx + 1)) {
    const dest = placeKey(row[d] || "");
    const kg = parseWeight(row[w] || "");
    const amount = parseRate(row[rate] || "");
    if (!dest || kg == null || amount == null) continue;
    const origin =
      o >= 0
        ? placeKey(row[o] || "")?.code || (direction === "import" ? dest.code : "IN")
        : direction === "import"
          ? dest.code
          : "IN";
    const originCode = direction === "import" ? dest.code : origin;
    const destCode = direction === "import" ? "IN" : dest.code;
    const key = `${direction}:${originCode}:${destCode}`;
    const lane = grouped.get(key) ?? {
      origin: originCode,
      destination: destCode,
      destinationLabel: dest.label,
      direction,
      breaks: [],
    };
    lane.breaks.push({ kg, rate: amount });
    grouped.set(key, lane);
  }
  const lanes = [...grouped.values()].map((l) => ({ ...l, breaks: uniqueBreaks(l.breaks) }));
  return lanes.some((l) => l.breaks.length) ? lanes : null;
}

function matrixFromWeightColumns(
  header: string[],
  body: string[][],
  direction: CourierTariffDirection,
): CourierTariffLane[] {
  const weights: Array<{ i: number; kg: number }> = [];
  let originIdx = -1;
  let destIdx = -1;
  header.forEach((h, i) => {
    const kg = parseWeight(h);
    if (kg != null) weights.push({ i, kg });
    if (/origin|from|pol/i.test(h)) originIdx = i;
    if (/dest|to|pod|country/i.test(h) && destIdx < 0) destIdx = i;
  });
  if (weights.length < 3) return [];
  const lanes = new Map<string, CourierTariffLane>();
  for (const row of body) {
    const destRaw = destIdx >= 0 ? row[destIdx] : row[originIdx >= 0 ? (originIdx === 0 ? 1 : 0) : 0];
    const dest = placeKey(destRaw || "");
    if (!dest) continue;
    const originRaw = originIdx >= 0 ? row[originIdx] : "";
    const origin = placeKey(originRaw)?.code || (direction === "import" ? dest.code : "IN");
    const originCode = direction === "import" ? dest.code : origin;
    const destCode = direction === "import" ? "IN" : dest.code;
    const breaks: CourierTariffBreak[] = [];
    for (const w of weights) {
      const rate = parseRate(row[w.i] || "");
      if (rate != null) breaks.push({ kg: w.kg, rate });
    }
    if (!breaks.length) continue;
    const key = `${direction}:${originCode}:${destCode}`;
    const prev = lanes.get(key);
    lanes.set(key, {
      origin: originCode,
      destination: destCode,
      destinationLabel: dest.label,
      direction,
      breaks: uniqueBreaks([...(prev?.breaks ?? []), ...breaks]),
    });
  }
  return [...lanes.values()];
}

function weightColIndex(header: string[], body: string[][]): number {
  const named = header.findIndex(
    (h) => /weight|wgt|^kg\b|^kgs\b|chargeable|chw/i.test(h) && !zoneToken(h),
  );
  if (named >= 0) return named;
  let best = 0;
  let bestHits = -1;
  const cols = Math.min(4, Math.max(header.length, ...body.map((r) => r.length), 1));
  for (let i = 0; i < cols; i++) {
    const hits = body.filter((r) => {
      const kg = parseWeight(r[i] || "");
      return kg != null && kg <= COURIER_TARIFF_MAX_KG;
    }).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = i;
    }
  }
  return best;
}

function matrixFromWeightRows(
  header: string[],
  body: string[][],
  direction: CourierTariffDirection,
  zoneMap: Map<string, string>,
): CourierTariffLane[] {
  const weightIdx = weightColIndex(header, body);
  const destCols: Array<{ i: number; place: { code: string; label: string } }> = [];
  header.forEach((h, i) => {
    if (i === weightIdx) return;
    const place = placeKey(h);
    if (place) destCols.push({ i, place });
  });
  if (destCols.length < 1) return [];

  let rateStart = 0;
  for (let r = 0; r < body.length; r++) {
    const kg = parseWeight(body[r][weightIdx] || "");
    if (kg != null) {
      rateStart = r;
      break;
    }
    for (const col of destCols) {
      for (const part of splitPlaces(body[r][col.i] || "")) {
        const place = countryPlace(part);
        if (place) zoneMap.set(place.code, col.place.code);
      }
    }
  }

  const buckets = new Map<string, CourierTariffLane>();
  for (const col of destCols) {
    const originCode = direction === "import" ? col.place.code : "IN";
    const destCode = direction === "import" ? "IN" : col.place.code;
    buckets.set(`${col.i}`, {
      origin: originCode,
      destination: destCode,
      destinationLabel: col.place.label,
      direction,
      breaks: [],
    });
  }
  for (const row of body.slice(rateStart)) {
    const kg = parseWeight(row[weightIdx] || "");
    if (kg == null) continue;
    for (const col of destCols) {
      const rate = parseRate(row[col.i] || "");
      if (rate == null) continue;
      buckets.get(`${col.i}`)?.breaks.push({ kg, rate });
    }
  }
  return [...buckets.values()]
    .map((l) => ({ ...l, breaks: uniqueBreaks(l.breaks) }))
    .filter((l) => l.breaks.length);
}

function parseSheet(sheet: SheetGrid, zoneMap: Map<string, string>): CourierTariffLane[] {
  const rows = (sheet.rows || []).map((r) => (Array.isArray(r) ? r.map(cellStr) : []));
  if (rows.length < 2) return [];
  const direction = inferDirection(sheet.name);
  const long = longFormatLanes(rows, direction);
  if (long?.length) return long;
  const hi = headerRowIndex(rows);
  const header = rows[hi] || [];
  const body = rows.slice(hi + 1);
  const weightHeaders = header.map(parseWeight).filter((n): n is number => n != null);
  if (weightHeaders.length >= 3) return matrixFromWeightColumns(header, body, direction);
  return matrixFromWeightRows(header, body, direction, zoneMap);
}

function looksLikeZoneOnlySheet(rows: string[][]): boolean {
  if (rows.length < 6) return false;
  const map = parseCountryZoneTable(rows);
  if (map.size >= 5) {
    const hi = headerRowIndex(rows);
    const header = rows[hi] || [];
    const weightHeaders = header.map(parseWeight).filter((n): n is number => n != null);
    const destCols = header.map(placeKey).filter(Boolean);
    const hasRateGrid =
      weightHeaders.length >= 3 ||
      destCols.filter((p) => p && (zoneToken(p.label) || /^ZONE-/.test(p.code))).length >= 3;
    if (!hasRateGrid) return true;
  }
  return false;
}

export function parseCourierTariffSheets(
  sheets: SheetGrid[],
  meta: { fileName?: string; year?: number; validFrom?: string; validTo?: string; currency?: string } = {},
): CourierTariffBook {
  const year = meta.year || new Date().getFullYear();
  const carrier = inferCourierCarrier(`${meta.fileName || ""} ${sheets.map((s) => s.name).join(" ")}`);
  const zoneMap = harvestZoneMap(sheets);

  const lanes: CourierTariffLane[] = [];
  let currency = meta.currency || "";
  for (const sheet of sheets) {
    const rows = (sheet.rows || []).map((r) => (Array.isArray(r) ? r.map(cellStr) : []));
    if (looksLikeZoneOnlySheet(rows)) continue;
    if (!currency) currency = inferCurrency(rows);
    lanes.push(...parseSheet(sheet, zoneMap));
  }

  const seen = new Map<string, CourierTariffLane>();
  for (const lane of lanes) {
    const key = `${lane.direction}:${lane.origin}:${lane.destination}`;
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, { ...lane, breaks: uniqueBreaks(lane.breaks) });
      continue;
    }
    prev.breaks = uniqueBreaks([...prev.breaks, ...lane.breaks]);
  }

  const mergedLanes = [...seen.values()];
  const zoneObj = Object.fromEntries(zoneMap.entries());
  const warnings: string[] = [];
  const numericDests = mergedLanes.filter((l) => /^\d+(\.\d+)?$/.test(l.destination)).length;
  if (numericDests > 0) {
    warnings.push("Some columns looked like prices, not destinations. Check the Excel header row.");
  }
  const zoneLanes = mergedLanes.filter((l) => /^ZONE-/.test(l.destination) || /^ZONE-/.test(l.origin)).length;
  if (zoneLanes && !Object.keys(zoneObj).length) {
    warnings.push(
      "Rates are by zone (A, B, C…). Add a Country / Zone sheet so Courier desk can match USA, UK, UAE.",
    );
  }
  if (!mergedLanes.length) {
    warnings.push("No weight × destination (or zone) rates were found.");
  }

  return {
    id: `ctariff-${Date.now()}`,
    carrier: carrier.name,
    carrierCode: carrier.code,
    carrierId: carrier.id,
    year,
    validFrom: meta.validFrom || `${year}-01-01`,
    validTo: meta.validTo || `${year}-12-31`,
    currency: currency || "INR",
    maxKg: COURIER_TARIFF_MAX_KG,
    lanes: mergedLanes,
    zoneMap: Object.keys(zoneObj).length ? zoneObj : undefined,
    warnings: warnings.length ? warnings : undefined,
    fileName: meta.fileName,
    uploadedAt: new Date().toISOString(),
  };
}

export function pickTariffSlab(breaks: CourierTariffBreak[], kg: number): CourierTariffBreak | null {
  if (!breaks.length || !(kg > 0)) return null;
  const sorted = [...breaks].sort((a, b) => a.kg - b.kg);
  const exact = sorted.find((b) => Math.abs(b.kg - kg) < 0.0001);
  if (exact) return exact;
  const next = sorted.find((b) => b.kg >= kg - 0.0001);
  return next ?? null;
}

function carrierMatches(book: CourierTariffBook, carrierId: string, directoryCarrier: string): boolean {
  const selectedRaw = (directoryCarrier || "").trim() || carrierId || "";
  if (!selectedRaw.trim()) return false;
  const selected = inferCourierCarrier(selectedRaw);
  const bookCarrier = inferCourierCarrier(`${book.carrierId} ${book.carrierCode} ${book.carrier}`);
  return selected.id === bookCarrier.id;
}

function resolveIso(iso: string, text: string): string {
  const fromText = inferCountryFromText(text || "");
  const code = (iso || "").toUpperCase();
  if (fromText && (!code || code === "IN") && fromText !== "IN") return fromText;
  return code || fromText || "";
}

function inferLookupDirection(
  originCountry: string,
  destCountry: string,
  scope?: string,
): CourierTariffDirection {
  if (originCountry && destCountry && originCountry === destCountry) return "domestic";
  if (destCountry === "IN" && originCountry && originCountry !== "IN") return "import";
  if (originCountry === "IN" && destCountry && destCountry !== "IN") return "export";
  if (scope === "import") return "import";
  if (scope === "domestic") return "domestic";
  return "export";
}

function zoneForCountry(book: CourierTariffBook, iso: string): string | null {
  if (!iso) return null;
  const raw = book.zoneMap?.[iso] || book.zoneMap?.[iso.toUpperCase()];
  if (!raw) return null;
  return zoneToken(raw)?.code || zoneToken(`Zone ${raw}`)?.code || raw.toUpperCase();
}

function laneMatchesPlace(
  lanePlace: string,
  laneLabel: string,
  queryIso: string,
  book: CourierTariffBook,
): boolean {
  if (!queryIso) return false;
  const lp = (lanePlace || "").toUpperCase();
  if (lp === queryIso) return true;
  const zl = zoneToken(lanePlace)?.code || zoneToken(laneLabel)?.code;
  const zq = zoneForCountry(book, queryIso);
  if (zq && zl && zq === zl) return true;
  if (zq && lp === zq) return true;
  if (laneLabel && queryIso && laneLabel.toUpperCase().includes(queryIso)) return true;
  return false;
}

function laneMatchesQuery(
  lane: CourierTariffLane,
  origin: string,
  dest: string,
  book: CourierTariffBook,
): boolean {
  if (lane.direction === "import") {
    const destOk = lane.destination === "IN" || lane.destination === dest || dest === "IN";
    const originOk = laneMatchesPlace(lane.origin, lane.destinationLabel, origin, book);
    return Boolean(destOk && originOk);
  }
  const originOk = !origin || lane.origin === origin || (lane.origin === "IN" && origin === "IN");
  const destOk = laneMatchesPlace(lane.destination, lane.destinationLabel, dest, book);
  return Boolean(destOk && originOk);
}

export function lookupCourierTariff(
  books: CourierTariffBook[],
  q: {
    carrierId?: string;
    directoryCarrier?: string;
    originCountry: string;
    destCountry: string;
    originText?: string;
    destText?: string;
    weightKg: number;
    scope?: string;
  },
): CourierTariffLookup {
  const kg = Number(q.weightKg) || 0;
  if (!(kg > 0)) return { status: "missing" };
  if (kg > COURIER_TARIFF_MAX_KG) return { status: "over-max", maxKg: COURIER_TARIFF_MAX_KG, kg };

  const origin = resolveIso(q.originCountry, q.originText || "");
  const dest = resolveIso(q.destCountry, q.destText || "");
  const direction = inferLookupDirection(origin, dest, q.scope);
  const ranked = [...books]
    .filter((b) => b.lanes?.length && carrierMatches(b, q.carrierId || "", q.directoryCarrier || ""))
    .sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));

  for (const book of ranked) {
    if (courierTariffNeedsReupload(book) && !book.zoneMap) continue;
    const lanes = book.lanes.filter((l) => l.direction === direction);
    const hit = lanes.find((l) => laneMatchesQuery(l, origin, dest, book));
    if (!hit) continue;
    const slab = pickTariffSlab(hit.breaks, kg);
    if (!slab) continue;
    return { status: "hit", lane: hit, kg, slabKg: slab.kg, rate: slab.rate, book };
  }
  return { status: "missing" };
}

export function listLocalCourierTariffBooks(): CourierTariffBook[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as CourierTariffBook[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function rememberCourierTariffBook(book: CourierTariffBook) {
  try {
    const rows = listLocalCourierTariffBooks().filter((b) => b.id !== book.id);
    rows.unshift(book);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 12)));
  } catch {
    /* quota */
  }
}

export function mergeCourierTariffBooks(live: CourierTariffBook[]): CourierTariffBook[] {
  const local = listLocalCourierTariffBooks();
  const seen = new Set(live.map((b) => b.id));
  const extra = local.filter((b) => b.id && !seen.has(b.id));
  return [...extra, ...live];
}
