/**
 * Turns an instruction into numbers. Rates come ONLY from the Circulars tariffs on file; the arithmetic is plain code.
 * Nothing is invented: if the carrier, the lane or the break has no rate, the result says so and nothing is filled.
 */
import { getWeightBreakBracket } from "@atlas/pricing-core";
import { normalizeCarrierName } from "@/lib/quotes/historical-autofill";
import type { AirTariff } from "@/lib/types";
import type { BreakKey, Instruction, MarginOption } from "./instruction";

export interface PlanInput {
  instr: Instruction;
  tariffs: AirTariff[];
  /** The enquiry's own origin/destination airport codes. */
  originCode: string;
  destCode: string;
  chargeableKg?: number;
  /** The person's answer when the instruction left something open. */
  choice?: { margin?: number; currency?: string };
}

export interface Plan {
  status: "ready" | "choose" | "blocked";
  tariff?: AirTariff;
  weightBreak?: BreakKey;
  /** Quote currency and the sell/buy per kg in it. */
  currency?: string;
  sellRate?: number;
  buyRate?: number;
  /** INR per one unit of the quote currency, when given. */
  customFx?: number;
  summary: string;
  issues: string[];
  choices: { margin?: MarginOption[]; currency?: string[] };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function blocked(issue: string, issues: string[] = []): Plan {
  return { status: "blocked", summary: issue, issues: [issue, ...issues], choices: {} };
}

export function marginLabel(m: MarginOption): string {
  return m.kind === "perKg" ? `${m.value}/kg` : `${m.value}%`;
}

export function planInstruction(p: PlanInput): Plan {
  const { instr } = p;
  const origin = (instr.originCode || p.originCode || "").toUpperCase();
  const dest = (p.destCode || "").toUpperCase();
  if (!origin || !dest) return blocked("Origin and destination are needed to find the rate.");
  if (!instr.carrier) return blocked("Say which carrier's rates to use, for example “use BLR - EK rates”.");

  const onLane = p.tariffs.filter((t) => t.origin.toUpperCase() === origin && t.destination.toUpperCase() === dest);
  if (!onLane.length) return blocked(`No rates on file for ${origin} → ${dest}.`);
  const want = normalizeCarrierName(instr.carrier);
  const code = instr.carrier.toUpperCase();
  const matches = onLane
    .filter((t) => t.carrierCode.toUpperCase() === code || (want.length >= 3 && normalizeCarrierName(t.carrier).includes(want)))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const tariff = matches[0];
  if (!tariff) {
    const others = [...new Set(onLane.map((t) => t.carrierCode || t.carrier))].join(", ");
    return blocked(`${instr.carrier} has no rate on file for ${origin} → ${dest}. On file: ${others}.`);
  }

  const brk: BreakKey = instr.weightBreak ?? (p.chargeableKg && p.chargeableKg > 0 ? getWeightBreakBracket(p.chargeableKg) : "plus100");
  const row = tariff.breaks[brk];
  const base = (row?.buy ?? 0) > 0 ? row.buy : (row?.sell ?? 0) > 0 ? row.sell : 0;
  if (!(base > 0)) return blocked(`${tariff.carrierCode || tariff.carrier} has no ${brk.replace("plus", "+")} rate on its ${origin} → ${dest} sheet.`);

  const issues: string[] = [];
  const choices: Plan["choices"] = {};

  // Currency of the quote
  const tariffCur = (tariff.currency || "USD").toUpperCase();
  let quoteCur = p.choice?.currency || (instr.currencies.length === 1 ? instr.currencies[0] : "");
  if (!quoteCur) {
    if (instr.currencies.length > 1) choices.currency = instr.currencies;
    quoteCur = tariffCur;
  }

  // Margin
  let margin: MarginOption | undefined;
  if (instr.margins.length === 1) margin = instr.margins[0];
  else if (instr.margins.length > 1) {
    if (p.choice?.margin !== undefined && instr.margins[p.choice.margin]) margin = instr.margins[p.choice.margin];
    else choices.margin = instr.margins;
  } else issues.push("No margin was given, so the sell rate equals the carrier rate.");

  // Convert the carrier rate into the quote currency
  let factor = 1;
  if (quoteCur !== tariffCur) {
    if (instr.crossRate && instr.crossRate.from === tariffCur && instr.crossRate.to === quoteCur) factor = instr.crossRate.rate;
    else if (instr.crossRate && instr.crossRate.from === quoteCur && instr.crossRate.to === tariffCur) factor = 1 / instr.crossRate.rate;
    else if (quoteCur === "INR" && instr.inrRate) factor = instr.inrRate;
    else return blocked(`The rate sheet is in ${tariffCur}. Give the exchange rate to quote in ${quoteCur}, for example “1 ${tariffCur} = 0.92 ${quoteCur}”.`);
  }
  const cost = r2(base * factor);
  let sell = cost;
  if (margin) sell = r2(margin.kind === "perKg" ? cost + margin.value : cost * (1 + margin.value / 100));

  const customFx = quoteCur !== "INR" && instr.inrRate ? instr.inrRate : undefined;
  const code2 = tariff.carrierCode || tariff.carrier;
  const parts = [`${code2} · ${origin}→${dest} · ${brk.replace("plus", "+")}${instr.weightBreak ? "" : " (by weight)"}`, `${quoteCur} ${cost.toFixed(2)}${margin ? ` + ${marginLabel(margin)}` : ""} = ${quoteCur} ${sell.toFixed(2)}/kg`];
  if (customFx) parts.push(`rate ${customFx}`);

  const status: Plan["status"] = choices.margin || choices.currency ? "choose" : "ready";
  return {
    status,
    tariff,
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
