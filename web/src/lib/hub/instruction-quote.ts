/**
 * Turns an instruction into numbers. Rates come ONLY from the Circulars tariffs on file — or from a rate the person
 * typed themselves; the arithmetic is plain code. Nothing is invented: if the carrier, the lane or the break has no rate,
 * the result says so and offers what IS on file (other carriers, other breaks) or lets the person type the rate.
 */
import { getWeightBreakBracket } from "@atlas/pricing-core";
import { normalizeCarrierName } from "@/lib/quotes/historical-autofill";
import type { AirTariff } from "@/lib/types";
import type { BreakKey, Instruction, MarginOption } from "./instruction";

export interface PlanChoice {
  /** Index into the instruction's margins. */
  margin?: number;
  currency?: string;
  /** Carrier code picked when the instruction's carrier had no rate (or none was named). */
  carrier?: string;
  /** Weight break picked when the one asked for had no rate. */
  weightBreak?: BreakKey;
  /** A carrier rate typed by the person, in the quote currency per kg. */
  buyRate?: number;
}

export interface PlanInput {
  instr: Instruction;
  tariffs: AirTariff[];
  /** The enquiry's own origin/destination airport codes. */
  originCode: string;
  destCode: string;
  chargeableKg?: number;
  /** The person's answers when the instruction left something open. */
  choice?: PlanChoice;
}

export interface CarrierChoice {
  code: string;
  label: string;
  rate: number;
  currency: string;
}
export interface BreakChoice {
  key: BreakKey;
  label: string;
  rate: number;
}

export interface Plan {
  status: "ready" | "choose" | "blocked";
  /** The tariff the rate came from; absent when the person typed the rate. */
  tariff?: AirTariff;
  /** The airline name to put on the desk. */
  carrierLabel?: string;
  /** True when the carrier rate was typed by a person rather than read from a tariff sheet. */
  typedRate?: boolean;
  weightBreak?: BreakKey;
  /** Quote currency and the sell/buy per kg in it. */
  currency?: string;
  sellRate?: number;
  buyRate?: number;
  /** INR per one unit of the quote currency, when given. */
  customFx?: number;
  summary: string;
  issues: string[];
  choices: { margin?: MarginOption[]; currency?: string[]; carriers?: CarrierChoice[]; breaks?: BreakChoice[] };
  /** The rate is missing, so the person may type it (in this currency, per kg). */
  askRate?: { carrier: string; currency: string };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const BREAK_ORDER: BreakKey[] = ["min", "minus45", "plus45", "plus100", "plus300", "plus500", "plus1000"];
export const breakLabel = (k: BreakKey) => (k === "min" ? "Minimum" : k === "minus45" ? "-45" : k.replace("plus", "+"));

export function marginLabel(m: MarginOption): string {
  return m.kind === "perKg" ? `${m.value}/kg` : m.kind === "percent" ? `${m.value}%` : m.kind === "perCbm" ? `${m.value}/cbm` : `${m.value}/container`;
}

/** The rate a tariff row gives: the buy rate when there is one, otherwise the sell rate. */
function rateOf(t: AirTariff, k: BreakKey): number {
  const row = t.breaks[k];
  return (row?.buy ?? 0) > 0 ? row.buy : (row?.sell ?? 0) > 0 ? row.sell : 0;
}

function blocked(issue: string, extra: Partial<Plan> = {}): Plan {
  return { status: "blocked", summary: issue, issues: [issue], choices: {}, ...extra };
}

export function planInstruction(p: PlanInput): Plan {
  const { instr } = p;
  const choice = p.choice ?? {};
  const origin = (instr.originCode || p.originCode || "").toUpperCase();
  const dest = (p.destCode || "").toUpperCase();
  if (!origin || !dest) return blocked("Origin and destination are needed to find the rate.");
  if (instr.margins.some((m) => m.kind === "perContainer" || m.kind === "perCbm")) {
    return blocked("A per-container or per-cbm margin belongs to a sea quote. For air, give the margin as /kg or %.");
  }

  const brk: BreakKey = choice.weightBreak ?? instr.weightBreak ?? (p.chargeableKg && p.chargeableKg > 0 ? getWeightBreakBracket(p.chargeableKg) : "plus100");
  const brkWord = `${breakLabel(brk)}${instr.weightBreak || choice.weightBreak ? "" : " (by weight)"}`;
  const carrierWord = (choice.carrier || instr.carrier || "").trim();
  const onLane = p.tariffs.filter((t) => t.origin.toUpperCase() === origin && t.destination.toUpperCase() === dest);

  // What IS on file for this lane at the wanted break — offered when the asked-for carrier or break has nothing.
  const carriersWithRate = (): CarrierChoice[] => {
    const seen = new Set<string>();
    const list: CarrierChoice[] = [];
    for (const t of [...onLane].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))) {
      const code = (t.carrierCode || t.carrier).toUpperCase();
      const rate = rateOf(t, brk);
      if (seen.has(code) || !(rate > 0)) continue;
      seen.add(code);
      list.push({ code, label: t.carrier, rate, currency: (t.currency || "USD").toUpperCase() });
    }
    return list;
  };

  // Which tariff row, if any, supplies the carrier rate
  let tariff: AirTariff | undefined;
  if (carrierWord) {
    const want = normalizeCarrierName(carrierWord);
    const code = carrierWord.toUpperCase();
    tariff = onLane
      .filter((t) => (t.carrierCode || "").toUpperCase() === code || (want.length >= 3 && normalizeCarrierName(t.carrier).includes(want)))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
  }

  // A rate the person typed beats the sheet: they know something we do not.
  const typed = choice.buyRate ?? instr.buyRate;

  const quoteCurWanted = choice.currency || (instr.currencies.length === 1 ? instr.currencies[0] : "");
  const sheetCur = (tariff?.currency || onLane[0]?.currency || "USD").toUpperCase();

  if (!(typed && typed > 0)) {
    if (!carrierWord) {
      const carriers = carriersWithRate();
      if (!carriers.length) return blocked(onLane.length ? `No carrier has a ${breakLabel(brk)} rate on file for ${origin} → ${dest}.` : `No rates on file for ${origin} → ${dest}.`);
      return blocked("Which carrier's rates should be used? Pick one:", { choices: { carriers } });
    }
    if (!onLane.length) {
      return blocked(`No rates on file for ${origin} → ${dest}. Type ${carrierWord}'s rate to go on.`, {
        askRate: { carrier: carrierWord, currency: quoteCurWanted || "USD" },
      });
    }
    if (!tariff) {
      const carriers = carriersWithRate();
      return blocked(`${carrierWord} has no rate on file for ${origin} → ${dest}${carriers.length ? "." : "."} Use one that does, or type ${carrierWord}'s rate.`, {
        choices: carriers.length ? { carriers } : {},
        askRate: { carrier: carrierWord, currency: quoteCurWanted || sheetCur },
      });
    }
    if (!(rateOf(tariff, brk) > 0)) {
      const breaks: BreakChoice[] = BREAK_ORDER.filter((k) => rateOf(tariff!, k) > 0).map((k) => ({ key: k, label: breakLabel(k), rate: rateOf(tariff!, k) }));
      const name = tariff.carrierCode || tariff.carrier;
      return blocked(`${name} has no ${breakLabel(brk)} rate on its ${origin} → ${dest} sheet.${breaks.length ? " Pick a break it does have, or type the rate." : " Type the rate to go on."}`, {
        choices: breaks.length ? { breaks } : {},
        askRate: { carrier: name, currency: quoteCurWanted || sheetCur },
      });
    }
  }

  const issues: string[] = [];
  const choices: Plan["choices"] = {};

  // Currency of the quote
  const tariffCur = typed && typed > 0 ? quoteCurWanted || instr.currencies[0] || "USD" : sheetCur;
  let quoteCur = quoteCurWanted;
  if (!quoteCur) {
    if (instr.currencies.length > 1) choices.currency = instr.currencies;
    quoteCur = tariffCur;
  }

  // Margin
  let margin: MarginOption | undefined;
  if (instr.margins.length === 1) margin = instr.margins[0];
  else if (instr.margins.length > 1) {
    if (choice.margin !== undefined && instr.margins[choice.margin]) margin = instr.margins[choice.margin];
    else choices.margin = instr.margins;
  } else issues.push("No margin was given, so the sell rate equals the carrier rate.");

  // The carrier rate, in the quote currency
  let base: number;
  let factor = 1;
  if (typed && typed > 0) {
    base = typed;
    // A typed rate is already in the quote currency, whatever the sheet says.
    quoteCur = quoteCur || tariffCur;
    issues.push(`The carrier rate (${quoteCur} ${typed}/kg) was typed in, not read from a tariff sheet.`);
  } else {
    base = rateOf(tariff!, brk);
    if (quoteCur !== tariffCur) {
      if (instr.crossRate && instr.crossRate.from === tariffCur && instr.crossRate.to === quoteCur) factor = instr.crossRate.rate;
      else if (instr.crossRate && instr.crossRate.from === quoteCur && instr.crossRate.to === tariffCur) factor = 1 / instr.crossRate.rate;
      else if (quoteCur === "INR" && instr.inrRate) factor = instr.inrRate;
      else return blocked(`The rate sheet is in ${tariffCur}. Give the exchange rate to quote in ${quoteCur}, for example “1 ${tariffCur} = 0.92 ${quoteCur}”.`);
    }
  }
  const cost = r2(base * factor);
  let sell = cost;
  if (margin) sell = r2(margin.kind === "perKg" ? cost + margin.value : cost * (1 + margin.value / 100));

  const customFx = quoteCur !== "INR" && instr.inrRate ? instr.inrRate : undefined;
  const nameFromFile = p.tariffs.find((t) => (t.carrierCode || "").toUpperCase() === carrierWord.toUpperCase())?.carrier;
  const carrierLabel = tariff?.carrier || nameFromFile || (carrierWord.length <= 3 ? carrierWord.toUpperCase() : carrierWord);
  const code2 = tariff?.carrierCode || tariff?.carrier || carrierWord.toUpperCase();
  const parts = [`${code2} · ${origin}→${dest} · ${brkWord}`, `${quoteCur} ${cost.toFixed(2)}${margin ? ` + ${marginLabel(margin)}` : ""} = ${quoteCur} ${sell.toFixed(2)}/kg`];
  if (customFx) parts.push(`rate ${customFx}`);

  const status: Plan["status"] = choices.margin || choices.currency ? "choose" : "ready";
  return {
    status,
    tariff,
    carrierLabel,
    typedRate: !!(typed && typed > 0),
    weightBreak: brk,
    currency: quoteCur,
    sellRate: sell,
    buyRate: cost,
    customFx,
    summary: parts.join(" · "),
    issues,
    choices,
  };
}
