/**
 * The Sea desk's version of an instruction: "use MSC rates for 40HC, add 50/container, quote in USD".
 * Rates come ONLY from the Circulars sea tariffs on file — or a rate the person typed. Full-container loads are priced per
 * container, part loads per cbm. Nothing is invented: a missing carrier, lane or container type is reported with what IS on file.
 */
import { normalizeCarrierName } from "@/lib/quotes/historical-autofill";
import type { SeaTariff } from "@/lib/types";
import { normalizeContainerType } from "./normalize";
import type { Instruction, MarginOption } from "./instruction";
import { marginLabel } from "./instruction-quote";

export interface SeaChoice {
  margin?: number;
  currency?: string;
  carrier?: string;
  /** A container type picked when the one asked for had no rate. */
  container?: string;
  /** A carrier rate typed by the person, in the quote currency (per container for FCL, per cbm for LCL). */
  buyRate?: number;
}

export interface SeaPlanInput {
  instr: Instruction;
  tariffs: SeaTariff[];
  originCode: string;
  destCode: string;
  /** The desk's own mode; the instruction's FCL / LCL wins when it says one. */
  mode: "fcl" | "lcl" | "bb";
  /** The containers already on the desk (from the enquiry). */
  containers: Array<{ type: string; qty: number }>;
  choice?: SeaChoice;
}

export interface SeaPlan {
  status: "ready" | "choose" | "blocked";
  mode?: "fcl" | "lcl";
  tariff?: SeaTariff;
  carrierLabel?: string;
  typedRate?: boolean;
  currency?: string;
  /** FCL: one row per container type, per-container rates in the quote currency. */
  containers?: Array<{ type: string; qty: number; sellRate: number; buyRate: number }>;
  /** LCL: per cbm. */
  lclSell?: number;
  lclBuy?: number;
  customFx?: number;
  summary: string;
  issues: string[];
  choices: { margin?: MarginOption[]; currency?: string[]; carriers?: Array<{ code: string; label: string; rate: string }>; containers?: Array<{ type: string; rate: number }> };
  askRate?: { carrier: string; currency: string; unit: "container" | "cbm" };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const rateOf = (r?: { sell: number; buy: number }) => ((r?.buy ?? 0) > 0 ? r!.buy : (r?.sell ?? 0) > 0 ? r!.sell : 0);

function blocked(issue: string, extra: Partial<SeaPlan> = {}): SeaPlan {
  return { status: "blocked", summary: issue, issues: [issue], choices: {}, ...extra };
}

export function planSeaInstruction(p: SeaPlanInput): SeaPlan {
  const { instr } = p;
  const choice = p.choice ?? {};
  const origin = (instr.originCode || p.originCode || "").toUpperCase();
  const dest = (p.destCode || "").toUpperCase();
  if (!origin || !dest) return blocked("Origin and destination ports are needed to find the rate.");
  const mode = instr.seaMode ?? p.mode;
  if (mode === "bb") return blocked("Break-bulk quotes are not read from instructions yet — fill the desk by hand.");
  const fcl = mode === "fcl";
  const unit = fcl ? "container" : "cbm";

  for (const m of instr.margins) {
    if (m.kind === "perKg") return blocked("A per-kg margin belongs to an air quote. For sea give it per container (FCL), per cbm (LCL) or as a %.");
    if (fcl && m.kind === "perCbm") return blocked("A per-cbm margin is for part loads (LCL). For a full container give it per container or as a %.");
    if (!fcl && m.kind === "perContainer") return blocked("A per-container margin is for full containers (FCL). For a part load give it per cbm or as a %.");
  }

  // Which container types are being priced (FCL)
  const wanted = choice.container || instr.container;
  const deskRows = p.containers.filter((c) => c.type);
  const rows: Array<{ type: string; qty: number }> = wanted
    ? (() => {
        const type = normalizeContainerType(wanted);
        const onDesk = deskRows.find((c) => normalizeContainerType(c.type) === type);
        return [{ type, qty: onDesk?.qty || 1 }];
      })()
    : deskRows.length
      ? deskRows.map((c) => ({ type: normalizeContainerType(c.type), qty: c.qty || 1 }))
      : [{ type: "20'GP", qty: 1 }];

  const carrierWord = (choice.carrier || instr.carrier || "").trim();
  const onLane = p.tariffs.filter((t) => t.origin.toUpperCase() === origin && t.destination.toUpperCase() === dest && t.mode === mode);
  const newest = (a: SeaTariff, b: SeaTariff) => (b.createdAt || "").localeCompare(a.createdAt || "");

  const rateFor = (t: SeaTariff, type: string) => (fcl ? rateOf(t.fclRates[type]) : rateOf(t.lclRate));
  const carriersWithRate = () => {
    const seen = new Set<string>();
    const list: Array<{ code: string; label: string; rate: string }> = [];
    for (const t of [...onLane].sort(newest)) {
      const code = (t.carrierCode || t.carrier).toUpperCase();
      if (seen.has(code)) continue;
      const ok = fcl ? rows.every((r) => rateFor(t, r.type) > 0) : rateFor(t, "") > 0;
      if (!ok) continue;
      seen.add(code);
      const cur = (t.currency || "USD").toUpperCase();
      list.push({ code, label: t.carrier, rate: fcl ? rows.map((r) => `${r.type} ${cur} ${rateFor(t, r.type)}`).join(", ") : `${cur} ${rateFor(t, "")}/cbm` });
    }
    return list;
  };

  let tariff: SeaTariff | undefined;
  if (carrierWord) {
    const want = normalizeCarrierName(carrierWord);
    const code = carrierWord.toUpperCase();
    tariff = onLane.filter((t) => (t.carrierCode || "").toUpperCase() === code || (want.length >= 3 && normalizeCarrierName(t.carrier).includes(want))).sort(newest)[0];
  }

  const typed = choice.buyRate ?? instr.buyRate;
  const quoteCurWanted = choice.currency || (instr.currencies.length === 1 ? instr.currencies[0] : "");
  const sheetCur = (tariff?.currency || onLane[0]?.currency || "USD").toUpperCase();
  const modeWord = fcl ? "full-container" : "part-load (LCL)";

  if (!(typed && typed > 0)) {
    if (!carrierWord) {
      const carriers = carriersWithRate();
      if (!carriers.length) return blocked(onLane.length ? `No liner has a rate on file for this ${modeWord} load on ${origin} → ${dest}.` : `No ${modeWord} rates on file for ${origin} → ${dest}.`);
      return blocked("Which liner's rates should be used? Pick one:", { choices: { carriers } });
    }
    if (!onLane.length) {
      return blocked(`No ${modeWord} rates on file for ${origin} → ${dest}. Type ${carrierWord}'s rate to go on.`, { askRate: { carrier: carrierWord, currency: quoteCurWanted || "USD", unit } });
    }
    if (!tariff) {
      const carriers = carriersWithRate();
      return blocked(`${carrierWord} has no ${modeWord} rate on file for ${origin} → ${dest}. ${carriers.length ? "Use one that does, or type" : "Type"} ${carrierWord}'s rate.`, {
        choices: carriers.length ? { carriers } : {},
        askRate: { carrier: carrierWord, currency: quoteCurWanted || sheetCur, unit },
      });
    }
    const missing = fcl ? rows.filter((r) => !(rateFor(tariff!, r.type) > 0)) : rateFor(tariff, "") > 0 ? [] : [{ type: "LCL", qty: 1 }];
    if (missing.length) {
      const onSheet = fcl ? Object.entries(tariff.fclRates).map(([type, r]) => ({ type, rate: rateOf(r) })).filter((x) => x.rate > 0) : [];
      const name = tariff.carrierCode || tariff.carrier;
      return blocked(`${name} has no ${fcl ? missing.map((m) => m.type).join(", ") : "LCL"} rate on its ${origin} → ${dest} sheet.${onSheet.length ? " Pick a container it does have, or type the rate." : " Type the rate to go on."}`, {
        choices: onSheet.length ? { containers: onSheet } : {},
        askRate: { carrier: name, currency: quoteCurWanted || sheetCur, unit },
      });
    }
  }

  const issues: string[] = [];
  const choices: SeaPlan["choices"] = {};
  const tariffCur = typed && typed > 0 ? quoteCurWanted || instr.currencies[0] || "USD" : sheetCur;
  let quoteCur = quoteCurWanted;
  if (!quoteCur) {
    if (instr.currencies.length > 1) choices.currency = instr.currencies;
    quoteCur = tariffCur;
  }

  let margin: MarginOption | undefined;
  if (instr.margins.length === 1) margin = instr.margins[0];
  else if (instr.margins.length > 1) {
    if (choice.margin !== undefined && instr.margins[choice.margin]) margin = instr.margins[choice.margin];
    else choices.margin = instr.margins;
  } else issues.push("No margin was given, so the sell rate equals the liner rate.");

  let factor = 1;
  if (typed && typed > 0) {
    issues.push(`The liner rate (${quoteCur} ${typed}/${unit}) was typed in, not read from a tariff sheet.`);
  } else if (quoteCur !== tariffCur) {
    if (instr.crossRate && instr.crossRate.from === tariffCur && instr.crossRate.to === quoteCur) factor = instr.crossRate.rate;
    else if (instr.crossRate && instr.crossRate.from === quoteCur && instr.crossRate.to === tariffCur) factor = 1 / instr.crossRate.rate;
    else if (quoteCur === "INR" && instr.inrRate) factor = instr.inrRate;
    else return blocked(`The rate sheet is in ${tariffCur}. Give the exchange rate to quote in ${quoteCur}, for example “1 ${tariffCur} = 0.92 ${quoteCur}”.`);
  }
  const sellFrom = (cost: number) => (margin ? r2(margin.kind === "percent" ? cost * (1 + margin.value / 100) : cost + margin.value) : cost);
  const costOf = (type: string) => r2((typed && typed > 0 ? typed : rateFor(tariff!, type)) * factor);

  const customFx = quoteCur !== "INR" && instr.inrRate ? instr.inrRate : undefined;
  const nameFromFile = p.tariffs.find((t) => (t.carrierCode || "").toUpperCase() === carrierWord.toUpperCase())?.carrier;
  const carrierLabel = tariff?.carrier || nameFromFile || (carrierWord.length <= 4 ? carrierWord.toUpperCase() : carrierWord);
  const code = tariff?.carrierCode || tariff?.carrier || carrierWord.toUpperCase();
  const status: SeaPlan["status"] = choices.margin || choices.currency ? "choose" : "ready";
  const m = margin ? ` + ${marginLabel(margin)}` : "";

  if (fcl) {
    const containers = rows.map((r) => {
      const cost = costOf(r.type);
      return { type: r.type, qty: r.qty, buyRate: cost, sellRate: sellFrom(cost) };
    });
    const parts = [`${code} · ${origin}→${dest}`, containers.map((c) => `${c.qty}×${c.type} ${quoteCur} ${c.buyRate.toFixed(2)}${m} = ${quoteCur} ${c.sellRate.toFixed(2)}`).join(", ")];
    if (customFx) parts.push(`rate ${customFx}`);
    return { status, mode: "fcl", tariff, carrierLabel, typedRate: !!(typed && typed > 0), currency: quoteCur, containers, customFx, summary: parts.join(" · "), issues, choices };
  }
  const cost = costOf("");
  const sell = sellFrom(cost);
  const parts = [`${code} · ${origin}→${dest} · LCL`, `${quoteCur} ${cost.toFixed(2)}${m} = ${quoteCur} ${sell.toFixed(2)}/cbm`];
  if (customFx) parts.push(`rate ${customFx}`);
  return { status, mode: "lcl", tariff, carrierLabel, typedRate: !!(typed && typed > 0), currency: quoteCur, lclBuy: cost, lclSell: sell, customFx, summary: parts.join(" · "), issues, choices };
}
