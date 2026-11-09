/**
 * Carrier Board logic (no Firebase, no screen): given the airline rates the reader saved for one lane, and each airline's
 * "how do we get a rate" rule from the procurement sheet, work out what to show for a weight:
 *   Tariff  - the airline's printed rate is on file and we use it
 *   Portal  - the rate is taken online from the airline's portal
 *   Email   - the airline must be asked
 * Rates are the airline's own charges, so they are BUY rates. Fuel and security surcharges are not part of the reader yet.
 */
import { vendorKind } from "@/lib/directory/coverage";
import { normalizeCarrierName } from "@/lib/quotes/historical-autofill";
import type { DirectoryContact } from "@/lib/types";

export type RateSource = "Tariff" | "Portal" | "Email";
export type BreakKey = "min" | "minus45" | "plus45" | "plus100" | "plus300" | "plus500" | "plus1000";

export const PER_KG_BREAKS: Array<{ key: Exclude<BreakKey, "min">; label: string; from: number }> = [
  { key: "minus45", label: "<45", from: 0 },
  { key: "plus45", label: "45+", from: 45 },
  { key: "plus100", label: "100+", from: 100 },
  { key: "plus300", label: "300+", from: 300 },
  { key: "plus500", label: "500+", from: 500 },
  { key: "plus1000", label: "1000+", from: 1000 },
];

/** How an airline's rate is obtained, from the procurement sheet. Add an airline here and the board follows. */
export interface CarrierRule {
  code: string;
  name: string;
  /** Below this weight the printed tariff is used; at or above it the rate is taken online. */
  tariffBelowKg?: number;
  /** The portal gives the rate up to and including this weight; above it the airline is asked by email. */
  portalUpToKg?: number;
  portalUrl?: string;
  remark: string;
}

export const CARRIER_RULES: CarrierRule[] = [
  {
    code: "EK",
    name: "Emirates",
    tariffBelowKg: 500,
    portalUrl: "https://eskycargo.emirates.com/app/offerandorder/",
    remark: "Below 500 kg use the tariff. Above 500 kg take the rate online from any station login, but book from the respective station's login.",
  },
  { code: "LH", name: "Lufthansa", portalUpToKg: 2500, portalUrl: "https://www.lufthansa-cargo.com/en/home", remark: "Online up to 2.5 tonnes. Above that, ask by email." },
  { code: "AF", name: "Air France KLM Cargo", portalUpToKg: 5000, portalUrl: "https://www.afklcargo.com/", remark: "Online up to 5 tonnes. Above that, ask by email." },
  { code: "AI", name: "Air India", portalUpToKg: 500, portalUrl: "https://aicargoportal.airindia.com/icargoneoportal/app/main/#/app", remark: "Online up to 500 kg. Above that, ask by email." },
];

export const ruleFor = (code: string): CarrierRule | undefined => CARRIER_RULES.find((r) => r.code === code.toUpperCase());

/** One airline route saved by the reader (carrierTariffs). Weight-break rates are the airline's charge per kg; min is a flat minimum. */
export interface BoardTariff {
  carrierCode: string;
  origin: string;
  destination: string;
  currency: string;
  validFrom: string;
  validTo: string;
  rateKind: string;
  breaks: Partial<Record<BreakKey, number | null>>;
  notes: string;
  updatedAt: number;
  sourceFile: string;
}

/** Which source gives the rate for this airline at this weight. A tariff on file is used unless the airline's rule sends this weight online or to email. */
export function sourceFor(rule: CarrierRule | undefined, weightKg: number, hasTariff: boolean): RateSource {
  if (rule?.tariffBelowKg !== undefined) return weightKg < rule.tariffBelowKg ? "Tariff" : "Portal";
  if (hasTariff) return "Tariff";
  if (rule?.portalUpToKg !== undefined) return weightKg <= rule.portalUpToKg ? "Portal" : "Email";
  return "Email";
}

/** Which source each weight band uses, for the "how rates are obtained" map. */
export const MAP_BANDS: Array<{ label: string; rep: number }> = [
  { label: "<45", rep: 1 },
  { label: "45–99", rep: 46 },
  { label: "100–299", rep: 101 },
  { label: "300–499", rep: 301 },
  { label: "500–999", rep: 501 },
  { label: "1,000–2,499", rep: 1001 },
  { label: "2,500+", rep: 2501 },
];

export function bandIndex(w: number): number {
  return w < 45 ? 0 : w < 100 ? 1 : w < 300 ? 2 : w < 500 ? 3 : w < 1000 ? 4 : w < 2500 ? 5 : 6;
}

export function ruleText(rule: CarrierRule | undefined): string {
  if (!rule) return "Tariff if on file, else ask by email";
  if (rule.tariffBelowKg !== undefined) return `Tariff below ${rule.tariffBelowKg} kg, portal above`;
  if (rule.portalUpToKg !== undefined) return `Portal up to ${rule.portalUpToKg >= 1000 ? `${rule.portalUpToKg / 1000} t` : `${rule.portalUpToKg} kg`}, email above`;
  return "Ask by email";
}

export function breakKeyFor(weightKg: number): Exclude<BreakKey, "min"> {
  let key: Exclude<BreakKey, "min"> = "minus45";
  for (const b of PER_KG_BREAKS) if (weightKg >= b.from) key = b.key;
  return key;
}

export interface Freight {
  key: Exclude<BreakKey, "min">;
  /** The airline's rate per kg for the weight's break. */
  perKg: number;
  /** Rate x weight, but never below the flat minimum. */
  freight: number;
}

/** null when the airline has no rate for this weight's break: nothing is guessed from a neighbouring break. */
export function freightFor(breaks: BoardTariff["breaks"], weightKg: number): Freight | null {
  if (!(weightKg > 0)) return null;
  const key = breakKeyFor(weightKg);
  const perKg = Number(breaks[key]);
  if (!Number.isFinite(perKg) || perKg <= 0) return null;
  const min = Number(breaks.min);
  const raw = perKg * weightKg;
  return { key, perKg, freight: Number.isFinite(min) && min > 0 ? Math.max(min, raw) : raw };
}

/** Whole days from today to a YYYY-MM-DD date: negative once past. null when there is no date. */
export function daysLeft(validTo: string, today: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validTo)) return null;
  const end = new Date(`${validTo}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export type Validity = "ok" | "soon" | "expired" | "none";
export function validityOf(days: number | null): Validity {
  if (days === null) return "none";
  return days < 0 ? "expired" : days <= 30 ? "soon" : "ok";
}

export interface PricedRow {
  code: string;
  name: string;
  tariff: BoardTariff;
  freight: Freight;
  days: number | null;
  validity: Validity;
  rank: number;
}

export interface OtherRow {
  code: string;
  name: string;
  source: Exclude<RateSource, "Tariff">;
  rule?: CarrierRule;
  /** Why it is not priced: no tariff on file, or the tariff has no rate for this weight. */
  why: string;
}

export interface LaneView {
  currency: string;
  currencies: string[];
  priced: PricedRow[];
  other: OtherRow[];
  /** Airlines whose tariff on this lane is in another currency than the one shown. */
  otherCurrency: string[];
  median: number | null;
  spreadPct: number | null;
}

const newest = (a: BoardTariff, b: BoardTariff) => (b.updatedAt || 0) - (a.updatedAt || 0);

/**
 * Everything the board shows for one lane and weight. names maps an airline code to its name (the circular's own airline list).
 * Expired tariffs are still shown, but never ranked first or counted in the headline.
 */
export function buildLane(tariffs: BoardTariff[], weightKg: number, today: Date, names: Record<string, string>, preferCurrency?: string): LaneView {
  const byCode = new Map<string, BoardTariff[]>();
  for (const t of tariffs) {
    const list = byCode.get(t.carrierCode) ?? [];
    list.push(t);
    byCode.set(t.carrierCode, list);
  }
  const counts = new Map<string, number>();
  for (const t of tariffs) counts.set(t.currency, (counts.get(t.currency) ?? 0) + 1);
  const currencies = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  const currency = preferCurrency && currencies.includes(preferCurrency) ? preferCurrency : (currencies[0] ?? "INR");

  const nameOf = (code: string) => ruleFor(code)?.name || names[code] || code;
  const priced: PricedRow[] = [];
  const other: OtherRow[] = [];
  const otherCurrency: string[] = [];
  const seen = new Set<string>();

  for (const [code, list] of byCode) {
    seen.add(code);
    const here = list.filter((t) => t.currency === currency).sort(newest);
    if (!here.length) {
      otherCurrency.push(nameOf(code));
      continue;
    }
    const rule = ruleFor(code);
    const tariff = here[0];
    const src = sourceFor(rule, weightKg, true);
    const f = src === "Tariff" ? freightFor(tariff.breaks, weightKg) : null;
    if (f) {
      const days = daysLeft(tariff.validTo, today);
      priced.push({ code, name: nameOf(code), tariff, freight: f, days, validity: validityOf(days), rank: 0 });
    } else {
      const source = src === "Tariff" ? "Email" : src;
      other.push({ code, name: nameOf(code), source, rule, why: src === "Tariff" ? "The tariff has no rate for this weight." : "" });
    }
  }
  for (const rule of CARRIER_RULES) {
    if (seen.has(rule.code)) continue;
    const source = sourceFor(rule, weightKg, false);
    other.push({ code: rule.code, name: rule.name, source: source === "Tariff" ? "Email" : source, rule, why: "No tariff on file for this lane." });
  }

  priced.sort((a, b) => Number(a.validity === "expired") - Number(b.validity === "expired") || a.freight.freight - b.freight.freight);
  priced.forEach((p, i) => (p.rank = i + 1));
  other.sort((a, b) => a.source.localeCompare(b.source) || a.code.localeCompare(b.code));

  const live = priced.filter((p) => p.validity !== "expired").map((p) => p.freight.freight).sort((a, b) => a - b);
  const median = live.length ? (live.length % 2 ? live[(live.length - 1) / 2] : (live[live.length / 2 - 1] + live[live.length / 2]) / 2) : null;
  const spreadPct = live.length > 1 ? Math.round(((live[live.length - 1] - live[0]) / live[0]) * 100) : null;
  return { currency, currencies, priced, other, otherCurrency, median, spreadPct };
}

/** The Directory contact for an airline: an airline-type contact whose name matches the airline's name or code, with an email. */
export function findCarrierContact(contacts: DirectoryContact[], code: string, name: string): DirectoryContact | undefined {
  const n = normalizeCarrierName(name);
  const c = normalizeCarrierName(code);
  const candidates = contacts.filter((x) => !x.suspended && /@/.test(x.email || "") && vendorKind(x) === "airline");
  const hit = (x: DirectoryContact) => {
    const k = normalizeCarrierName(x.name);
    return !!k && ((n && (k === n || k.startsWith(n) || n.startsWith(k))) || k === c);
  };
  return candidates.find(hit);
}

export interface EmailInput {
  airline: string;
  origin: string;
  destination: string;
  weightKg: number;
  /** Ask for every weight break (no tariff, no portal) or just the break for this shipment. */
  allBreaks: boolean;
  /** The weight above which the portal stops answering, when that is why we are writing. */
  aboveKg?: number;
  contactPerson?: string;
  senderName?: string;
}

export function buildRateEmail(i: EmailInput): { subject: string; body: string } {
  const w = Math.round(i.weightKg).toLocaleString("en-IN");
  const breaks = i.allBreaks ? "MIN, under 45 kg, 45+, 100+, 300+, 500+ and 1000+ kg" : `the ${PER_KG_BREAKS.find((b) => b.key === breakKeyFor(i.weightKg))?.label ?? ""} kg break for this shipment`;
  const greet = i.contactPerson ? `Dear ${i.contactPerson.split(" ")[0]},` : `Dear ${i.airline} Cargo team,`;
  const lines = [
    greet,
    "",
    `Please share your best rate for the following shipment${i.aboveKg ? ` (weights above ${i.aboveKg.toLocaleString("en-IN")} kg)` : ""}:`,
    "",
    `  Route: ${i.origin} to ${i.destination}`,
    `  Weight: ${w} kg gross`,
    "  Commodity: general cargo",
    `  Rates needed: ${breaks}`,
    "  Validity: next 7 days",
    "",
    "Kindly include fuel, security and AMS charges, and the flight options.",
    "",
    "Thank you,",
    i.senderName || "",
  ];
  return { subject: `Rate request ${i.origin} - ${i.destination} · ${w} kg general cargo`, body: lines.join("\n").trimEnd() };
}

/** A mail link that opens the user's own email program with the draft. */
export function mailtoLink(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
