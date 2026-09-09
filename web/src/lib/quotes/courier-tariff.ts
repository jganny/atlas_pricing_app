import { inferCountryFromText } from "@/lib/locations/country-aliases";

export const COURIER_TARIFF_MAX_KG = 70;
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

const SKIP_HEADER = /^(weight|wgt|kg|kgs|kilo|kilos|lbs|lb|sr|sno|sl|no|#|rate|buy|sell|min|remarks?|notes?|from|to|origin|destination|zone|service|mode)$/i;

const CARRIER_IDS: Array<{ id: string; code: string; name: string; needles: string[] }> = [
  { id: "fedex", code: "FDX", name: "FedEx", needles: ["fedex", "fdx", "fx", "tnt"] },
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
  return { id: "fedex", code: "FDX", name: "FedEx" };
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).replace(/\s+/g, " ").trim();
}

function parseWeight(raw: string): number | null {
  const t = raw.toLowerCase().replace(/,/g, "").replace(/kgs?|kilos?|lbs?/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0 || n > 200) return null;
  return Math.round(n * 1000) / 1000;
}

function parseRate(raw: string): number | null {
  const t = raw.replace(/[,₹$€£]/g, "").replace(/\s/g, "");
  if (!t || /[^0-9.]/.test(t)) {
    const n = Number(t.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function inferDirection(name: string): CourierTariffDirection {
  const t = name.toLowerCase();
  if (/domestic|within india|india.?india/.test(t)) return "domestic";
  if (/import|inbound|incoming/.test(t)) return "import";
  if (/export|outbound|outgoing/.test(t)) return "export";
  return "export";
}

function inferCurrency(rows: string[][]): string {
  const blob = rows
    .slice(0, 8)
    .flat()
    .join(" ")
    .toLowerCase();
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

function placeKey(raw: string): { code: string; label: string } | null {
  const label = raw.trim();
  if (!label || SKIP_HEADER.test(label)) return null;
  const lower = label.toLowerCase().replace(/\./g, "");
  if (PLACE_ISO[lower]) return { code: PLACE_ISO[lower], label };
  const iso = inferCountryFromText(label);
  if (iso) return { code: iso, label };
  const cleaned = label.replace(/zone\s*/i, "").trim();
  if (cleaned.length < 2) return null;
  return { code: cleaned.toUpperCase().slice(0, 24), label };
}

function looksLikeZoneMap(rows: string[][]): boolean {
  if (rows.length < 6) return false;
  const header = rows[0].map((h) => h.toLowerCase());
  const hasCountry = header.some((h) => /country|destination|origin|nation|place/.test(h));
  const hasZone = header.some((h) => /zone/.test(h));
  return hasCountry && hasZone;
}

function parseZoneMap(rows: string[][]): Map<string, string> {
  const map = new Map<string, string>();
  const header = rows[0].map((h) => h.toLowerCase());
  const countryIdx = header.findIndex((h) => /country|destination|origin|nation|place/.test(h));
  const zoneIdx = header.findIndex((h) => /zone/.test(h));
  if (countryIdx < 0 || zoneIdx < 0) return map;
  for (const row of rows.slice(1)) {
    const place = placeKey(row[countryIdx] || "");
    const zone = cellStr(row[zoneIdx]);
    if (place && zone) map.set(place.code, zone.toUpperCase());
  }
  return map;
}

function headerRowIndex(rows: string[][]): number {
  let best = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, 12);
  for (let i = 0; i < limit; i++) {
    const cells = rows[i] || [];
    const weights = cells.map(parseWeight).filter((n): n is number => n != null);
    const places = cells.map(placeKey).filter(Boolean);
    const score = weights.length >= 3 ? weights.length + 20 : places.length;
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
  const headerIdx = rows.findIndex((r) =>
    r.some((c) => /origin|pol|from/i.test(c)) && r.some((c) => /dest|pod|to/i.test(c)),
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
    const origin = o >= 0 ? placeKey(row[o] || "")?.code || (direction === "import" ? dest.code : "IN") : direction === "import" ? dest.code : "IN";
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

function matrixFromWeightRows(
  header: string[],
  body: string[][],
  direction: CourierTariffDirection,
): CourierTariffLane[] {
  const destCols: Array<{ i: number; place: { code: string; label: string } }> = [];
  header.forEach((h, i) => {
    if (i === 0) return;
    const place = placeKey(h);
    if (place) destCols.push({ i, place });
  });
  if (destCols.length < 1) return [];
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
  for (const row of body) {
    const kg = parseWeight(row[0] || "");
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

function parseSheet(sheet: SheetGrid): CourierTariffLane[] {
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
  return matrixFromWeightRows(header, body, direction);
}

export function parseCourierTariffSheets(
  sheets: SheetGrid[],
  meta: { fileName?: string; year?: number; validFrom?: string; validTo?: string; currency?: string } = {},
): CourierTariffBook {
  const year = meta.year || new Date().getFullYear();
  const carrier = inferCourierCarrier(`${meta.fileName || ""} ${sheets.map((s) => s.name).join(" ")}`);
  const zoneMap = new Map<string, string>();
  for (const sheet of sheets) {
    const rows = (sheet.rows || []).map((r) => (Array.isArray(r) ? r.map(cellStr) : []));
    if (looksLikeZoneMap(rows)) {
      for (const [k, v] of parseZoneMap(rows)) zoneMap.set(k, v);
    }
  }

  const lanes: CourierTariffLane[] = [];
  let currency = meta.currency || "";
  for (const sheet of sheets) {
    const rows = (sheet.rows || []).map((r) => (Array.isArray(r) ? r.map(cellStr) : []));
    if (looksLikeZoneMap(rows)) continue;
    if (!currency) currency = inferCurrency(rows);
    lanes.push(...parseSheet(sheet));
  }

  if (zoneMap.size) {
    for (const lane of lanes) {
      const zone = zoneMap.get(lane.destination) || zoneMap.get(lane.origin);
      if (zone && /^ZONE/.test(lane.destination) === false && lane.destination.length > 2) {
        /* country already set */
      } else if (zone) {
        lane.destinationLabel = `${lane.destinationLabel} · ${zone}`;
      }
    }
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
    lanes: [...seen.values()],
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
  const blob = `${book.carrierId} ${book.carrierCode} ${book.carrier} ${directoryCarrier}`.toLowerCase();
  const id = (carrierId || inferCourierCarrier(directoryCarrier).id).toLowerCase();
  return blob.includes(id) || inferCourierCarrier(blob).id === id;
}

function inferLookupDirection(
  originCountry: string,
  destCountry: string,
  scope?: string,
): CourierTariffDirection {
  if (scope === "domestic" || (originCountry && originCountry === destCountry)) return "domestic";
  if (destCountry === "IN" && originCountry !== "IN") return "import";
  return "export";
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

  const origin = (q.originCountry || inferCountryFromText(q.originText || "") || "").toUpperCase();
  const dest = (q.destCountry || inferCountryFromText(q.destText || "") || "").toUpperCase();
  const direction = inferLookupDirection(origin, dest, q.scope);
  const ranked = [...books]
    .filter((b) => b.lanes?.length && carrierMatches(b, q.carrierId || "", q.directoryCarrier || ""))
    .sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));

  for (const book of ranked) {
    const lanes = book.lanes.filter((l) => l.direction === direction);
    const hit =
      lanes.find((l) => l.origin === origin && l.destination === dest) ||
      lanes.find((l) => l.destination === dest) ||
      lanes.find((l) => l.origin === origin && dest && l.destinationLabel.toUpperCase().includes(dest)) ||
      lanes.find((l) => dest && (l.destination === dest || l.origin === dest));
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
