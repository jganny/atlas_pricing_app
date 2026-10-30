/**
 * EXW local charges for sea exports, from the agents' "Local Charges.xlsx": what it costs to take a container from the
 * shipper's door (or a CFS / ICD) to the ship, per 20' and per 40', in USD. Hand-copied from that file — when the agents send a new
 * sheet, update the numbers here. A figure the sheet says "will revert" on is kept as a line with no amount, so it still prints.
 */
import { createSurchargeRow, type SurchargeRow } from "./surcharges";

export type Stuffing = "factory" | "cfs";

export interface ExwLine {
  name: string;
  /** USD per 20' container; null = the sheet gives no amount yet. */
  per20: number | null;
  per40: number | null;
  /** Printed beside the amount on the quote. */
  note?: string;
  /** Printed when there is no amount, e.g. "Will revert". */
  tbc?: string;
}

export interface ExwSheet {
  id: string;
  place: string;
  /** UN/LOCODEs of the port or ICD that this sheet covers. */
  seaCodes: string[];
  stuffing: Stuffing;
  /** Set when one place has more than one routing, e.g. "via Chennai". */
  route?: string;
  lines: ExwLine[];
  /** The validity as printed on the sheet. */
  validityText?: string;
  /** ISO date the sheet's rates run to, when it has a usable one. */
  validTo?: string;
  notes: string[];
  /** Totals the sheet prints, used to check the numbers were copied right. */
  printedTotal?: { per20?: number; per40?: number };
}

const L = (name: string, per20: number | null, per40: number | null, note?: string, tbc?: string): ExwLine => ({ name, per20, per40, note, tbc });
const BL = L("BL fees", 75, 75);
const SURRENDER = L("BL surrender fees", 75, 75);

export const EXW_SOURCE = "Local Charges.xlsx (agents' sheets, Oct 2026)";

export const EXW_SHEETS: ExwSheet[] = [
  {
    id: "mumbai-factory",
    place: "Mumbai (Nhava Sheva)",
    seaCodes: ["INBOM", "INNSA", "INNHV", "INMUM"],
    stuffing: "factory",
    lines: [L("Handling", 135, 165), L("THC", 235, 300), BL, SURRENDER, L("Transportation", null, 610, undefined, "Will revert")],
    validityText: "31/10/2026",
    validTo: "2026-10-31",
    notes: ["Detention fee $50; parking at actuals.", "For normal weight up to 18 tons, not over-dimension or heavy cargo.", "Stuffing at the factory is at the shipper's cost."],
    printedTotal: { per20: 520, per40: 1225 },
  },
  {
    id: "mumbai-cfs",
    place: "Mumbai (Nhava Sheva)",
    seaCodes: ["INBOM", "INNSA", "INNHV", "INMUM"],
    stuffing: "cfs",
    lines: [L("CFS charges", 285, 300), L("Handling", 125, 150), L("THC", 275, 300), BL, SURRENDER, L("Transportation", 250, null, undefined, "Will revert")],
    validityText: "31/10/2026",
    validTo: "2026-10-31",
    notes: ["Unloading $50 per vehicle.", "Lashing and choking depend on the cargo.", "For normal weight up to 18 tons."],
  },
  {
    id: "chennai-factory",
    place: "Chennai",
    seaCodes: ["INMAA", "INENR", "INKAT"],
    stuffing: "factory",
    lines: [L("Handling", 145, 175), L("THC", 95, 235), BL, SURRENDER, L("Transportation", null, 250, undefined, "Will revert")],
    validityText: "31/06/2026 (as printed)",
    validTo: "2026-06-30",
    notes: ["Halting charges $35 per container.", "EXW applies only if the shipper has self-sealing permission.", "Detention $50 per day per 20', $60 per day per 40'.", "Quotation valid 7 days, subject to diesel price changes."],
    printedTotal: { per20: 390, per40: 810 },
  },
  {
    id: "chennai-cfs",
    place: "Chennai",
    seaCodes: ["INMAA", "INENR", "INKAT"],
    stuffing: "cfs",
    lines: [L("Handling", 135, 175), L("THC", 225, 285), L("CFS charges", 250, 285), BL, SURRENDER, L("Transportation", 760, null, undefined, "Will revert")],
    validityText: "31/07/2026",
    validTo: "2026-07-31",
    notes: ["Halting $30 per container per day, $60 from the 2nd day.", "For normal weight up to 14 tons."],
    printedTotal: { per40: 895 },
  },
  {
    id: "mundra-factory",
    place: "Mundra",
    seaCodes: ["INMUN"],
    stuffing: "factory",
    lines: [BL, SURRENDER, L("Customs clearance", 150, 175), L("Shipping line charges", 275, 400), L("Transportation", null, 1700, "Yard to factory to yard", "Will revert")],
    notes: ["Detention $60 per day per container, if applicable.", "General cargo only. Other statutory charges at actuals."],
  },
  {
    id: "mundra-cfs",
    place: "Mundra",
    seaCodes: ["INMUN"],
    stuffing: "cfs",
    lines: [BL, SURRENDER, L("Handling", 125, 155), L("Shipping line charges", 260, 390), L("CFS charges", 250, 400), L("Transportation", 345, 345, "One amount on the sheet, no size given")],
    notes: ["Detention $65 per truck per day.", "Subject to trade notices on GRI, PSS and CBS.", "General cargo only, non-haz."],
  },
  {
    id: "blr-factory-maa",
    place: "Bangalore ICD",
    seaCodes: ["INBLR", "INWFD"],
    stuffing: "factory",
    route: "via Chennai",
    lines: [L("Handling", 95, 145), L("THC", 185, 285), BL, SURRENDER, L("Container not returned", 100, 145), L("IHC (inland haulage to port)", 800, 1075, "Via Chennai"), L("Transportation", 220, 250)],
    validityText: "31/01/2026",
    validTo: "2026-01-31",
    notes: ["No detention included.", "Normal weight up to 18 tons, not over-dimension or heavy cargo.", "Container turn-around $15 per container, if applicable. Late gate-in $40."],
    printedTotal: { per20: 1550, per40: 2050 },
  },
  {
    id: "blr-factory-nhv",
    place: "Bangalore ICD",
    seaCodes: ["INBLR", "INWFD"],
    stuffing: "factory",
    route: "via Nhava Sheva",
    lines: [L("Handling", 95, 145), L("THC", 285, 300), BL, SURRENDER, L("Container not returned", 100, 145), L("IHC (inland haulage to port)", 1000, 1550, "ICD Bangalore to Nhava Sheva"), L("Transportation", 180, 250)],
    validityText: "20': 31/10/2025, 40': 30/09/2026",
    validTo: "2026-09-30",
    notes: ["No detention included.", "Normal weight up to 18 tons.", "Container turn-around $15 per container, if applicable. Late gate-in $40."],
    printedTotal: { per20: 1810, per40: 2540 },
  },
  {
    id: "blr-cfs",
    place: "Bangalore ICD",
    seaCodes: ["INBLR", "INWFD"],
    stuffing: "cfs",
    route: "via Chennai",
    lines: [L("Handling", 95, 125), L("THC", 185, 250), BL, SURRENDER, L("Container not returned", 100, 125), L("IHC (inland haulage to port)", 550, 725, "Via Chennai"), L("Transportation", 450, null, undefined, "Will revert")],
    validityText: "30/09/2025",
    validTo: "2025-09-30",
    notes: ["No detention included.", "Normal weight up to 18 tons.", "Container turn-around $15 per container, if applicable. Late gate-in $40."],
  },
  {
    id: "hyd-factory",
    place: "Hyderabad ICD",
    seaCodes: ["INHYD"],
    stuffing: "factory",
    lines: [BL, SURRENDER, L("THC", 195, 285), L("Clearance charges", 150, 225), L("IHC (inland haulage to port)", 825, 1075, "Rail from ICD to Nhava Sheva, up to 20 MT"), L("Transportation", null, null, undefined, "Need complete address")],
    notes: [],
  },
  {
    id: "hyd-cfs",
    place: "Hyderabad ICD",
    seaCodes: ["INHYD"],
    stuffing: "cfs",
    lines: [BL, SURRENDER, L("THC", 185, 225), L("Handling", 75, 125), L("ICD charges", 180, 235), L("IHC (inland haulage to port)", 650, 1080, "Rail from ICD to Nhava Sheva, up to 10 MT"), L("Transportation", null, null, undefined, "Will revert")],
    notes: [],
  },
  {
    id: "delhi-factory",
    place: "Delhi ICD (Tughlakabad)",
    seaCodes: ["INDEL", "INTKD", "INPPG", "INICD"],
    stuffing: "factory",
    lines: [BL, SURRENDER, L("Handling", 95, 135, "Factory stuffing"), L("IHC (inland haulage to port)", 1050, 1700, "ICD to port"), L("Transportation", null, 475, undefined, "Will revert")],
    notes: ["Net/net, port to port. General cargo only.", "Subject to equipment and space; subject to any GRI at the time of shipment."],
  },
  {
    id: "delhi-cfs",
    place: "Delhi ICD",
    seaCodes: ["INDEL", "INTKD", "INPPG", "INICD"],
    stuffing: "cfs",
    lines: [BL, SURRENDER, L("Handling", 95, 125), L("ICD stuffing", 50, 75), L("IHC (inland haulage to port)", 1100, 1700, "ICD to port"), L("Lashing", 50, 75), L("Transportation", null, null, undefined, "Will revert")],
    notes: [],
  },
];

/** "INMAA - Chennai" or "INMAA" -> "INMAA" */
function codeOf(origin: string): string {
  const paren = /\(([A-Za-z]{5})\)/.exec(origin);
  if (paren) return paren[1].toUpperCase();
  return (origin.split(" - ")[0] || "").trim().toUpperCase();
}

/** Every sheet that covers this origin port, factory sheets first. */
export function exwSheetsForOrigin(origin: string | undefined | null): ExwSheet[] {
  const code = codeOf(String(origin ?? ""));
  if (!code) return [];
  return EXW_SHEETS.filter((s) => s.seaCodes.includes(code));
}

/** 20' or 40' for a container type such as "20'GP" or "40'HC". 45' and others have no rate on the sheets. */
export function sizeBucket(type: string): 20 | 40 | null {
  const m = /^\s*(\d{2})/.exec(type);
  if (m?.[1] === "20") return 20;
  if (m?.[1] === "40") return 40;
  return null;
}

export interface ContainerCount {
  type: string;
  qty: number;
}

export function countBySize(containers: ContainerCount[]): { n20: number; n40: number; other: number } {
  let n20 = 0, n40 = 0, other = 0;
  for (const c of containers) {
    const q = Math.max(0, Number(c.qty) || 0);
    const s = sizeBucket(c.type);
    if (s === 20) n20 += q;
    else if (s === 40) n40 += q;
    else other += q;
  }
  return { n20, n40, other };
}

/** Rows are recognised by this id prefix, so refilling never touches what the desk typed. */
export const EXW_ROW_PREFIX = "exw_";
export const isExwRow = (r: Pick<SurchargeRow, "id">) => r.id.startsWith(EXW_ROW_PREFIX);

/**
 * The Local Origin Charges rows for one sheet and the containers on the quote.
 * One size only: a row per charge priced per container (the quote shows "2 containers × $285 = $570").
 * Both sizes: a flat row per charge with the working in its name. A charge with no amount keeps its note ("Will revert").
 */
export function buildExwRows(sheet: ExwSheet, containers: ContainerCount[]): SurchargeRow[] {
  const { n20, n40, other } = countBySize(containers);
  const rows: SurchargeRow[] = [];
  const mk = (name: string, amount: number, unit: SurchargeRow["unit"], remarks: string, idx: number) =>
    createSurchargeRow({ id: `${EXW_ROW_PREFIX}${sheet.id}_${idx}`, name, sell: amount, buy: amount, unit, remarks });
  sheet.lines.forEach((line, idx) => {
    const only: 20 | 40 | null = n20 > 0 && n40 === 0 && other === 0 ? 20 : n40 > 0 && n20 === 0 && other === 0 ? 40 : null;
    const note = [line.note, line.tbc && line.per20 === null && line.per40 === null ? line.tbc : ""].filter(Boolean).join(" · ");
    if (only) {
      const rate = only === 20 ? line.per20 : line.per40;
      if (rate === null) rows.push(mk(`${line.name} (${only}')`, 0, "flat", line.tbc || "Rate to be confirmed", idx));
      else rows.push(mk(`${line.name} (${only}')`, rate, "container", line.note ?? "", idx));
      return;
    }
    // Both sizes (or neither yet): one flat row with the working in its name.
    const parts: string[] = [];
    let total = 0;
    let unknown = false;
    if (n20 > 0) {
      if (line.per20 === null) unknown = true;
      else {
        total += n20 * line.per20;
        parts.push(`${n20} × 20'`);
      }
    }
    if (n40 > 0) {
      if (line.per40 === null) unknown = true;
      else {
        total += n40 * line.per40;
        parts.push(`${n40} × 40'`);
      }
    }
    const label = parts.length ? `${line.name} (${parts.join(" + ")})` : line.name;
    const tbc = unknown ? line.tbc || "Rate to be confirmed" : "";
    rows.push(mk(label, total, "flat", [line.note, tbc].filter(Boolean).join(" · ") || note, idx));
  });
  return rows;
}

/** True when two lists are the same charges, line for line (id, name, amounts, unit, remarks). */
export function sameExwRows(a: SurchargeRow[], b: SurchargeRow[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((r) => [r.id, r]));
  return a.every((r) => {
    const o = byId.get(r.id);
    return !!o && o.name === r.name && o.sell === r.sell && o.buy === r.buy && o.unit === r.unit && o.remarks === r.remarks;
  });
}

/**
 * What to do with the Local Origin Charges when the port, stuffing, containers or terms change.
 * - "fill": the desk has not touched what was filled (or nothing is filled yet), so fill it again for the new inputs.
 * - "clear": it is no longer an EXW export and the filled charges are still untouched, so take them back.
 * - "keep": leave everything alone. The desk edited, deleted or added a charge, typed its own, or opened a saved quote.
 * `previous` is what was filled last time (null if nothing was filled in this session); `next` is the fill for the new inputs
 * (null when the quote is not an EXW export now).
 */
export function exwFillDecision(args: { current: SurchargeRow[]; previous: SurchargeRow[] | null; next: SurchargeRow[] | null }): "fill" | "clear" | "keep" {
  const { current, previous, next } = args;
  const mine = current.filter(isExwRow);
  const typed = current.length - mine.length;
  if (!next) {
    if (!mine.length) return "keep";
    return previous && sameExwRows(mine, previous) ? "clear" : "keep";
  }
  if (typed > 0) return "keep";
  if (!mine.length) return previous ? "keep" : "fill"; // deleted everything after a fill: that was the desk's choice
  return previous && sameExwRows(mine, previous) ? "fill" : "keep";
}

export type ExwValidity = { state: "valid" | "expired" | "undated"; text: string };

export function exwValidity(sheet: ExwSheet, now: Date = new Date()): ExwValidity {
  if (!sheet.validTo) return { state: "undated", text: "The sheet gives no validity date" };
  const end = new Date(`${sheet.validTo}T23:59:59`);
  return { state: end.getTime() >= now.getTime() ? "valid" : "expired", text: sheet.validityText ?? sheet.validTo };
}

/** What one container of this size costs on the sheet, counting only lines that have an amount. */
export function sheetTotal(sheet: ExwSheet, size: 20 | 40): number {
  return sheet.lines.reduce((n, l) => n + ((size === 20 ? l.per20 : l.per40) ?? 0), 0);
}
