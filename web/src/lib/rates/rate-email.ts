/**
 * Rates read from a vendor's or an overseas agent's email (see functions/rate-email-logic.js), turned into airline and liner options for the desks.
 * The vendor's rate is the BUY rate: it stays on the desk. The person adds a margin to get the sell rate. Nothing here goes to a customer.
 */
import { createAirlineOption, createLinerOption, type AirlineOption, type LinerOption } from "@/lib/pricing/carrier-options";
import { EMPTY_AIR_BREAKS } from "@/lib/pricing/air-desk";
import type { WeightBreakName, WeightBreaks } from "@atlas/pricing-core";

export interface RateRead {
  vendor: string;
  fromEmail: string;
  mode: "air" | "sea";
  airlineCode: string;
  airlineName: string;
  currency: string;
  currencyAssumed: boolean;
  basis: "all-in" | "freight-only" | "";
  breaks: Partial<Record<WeightBreakName, number>>;
  containers: Array<{ type: string; label: string; rate: number }>;
  lclPerCbm: number | null;
  charges: Array<{ name: string; amount: number | null; unit: string }>;
  validity: string;
  transit: string;
  routing: string;
  remarks: string;
  hasRates: boolean;
  needsCheck: string[];
  error?: string;
}

export type MarginInput = { mode: "perUnit"; amount: number } | { mode: "percent"; percent: number };

export const BREAK_LABELS: Record<WeightBreakName, string> = {
  min: "Minimum charge",
  minus45: "Under 45 kg",
  plus45: "45 kg and above",
  plus100: "100 kg and above",
  plus250: "250 kg and above",
  plus300: "300 kg and above",
  plus500: "500 kg and above",
  plus1000: "1000 kg and above",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sell from buy. A per-unit margin is added to a per-kg (or per-container) rate; a minimum charge is a total, so a per-unit margin cannot be added to it: it is left for a person. */
export function sellFromBuy(buy: number, margin: MarginInput, isTotal = false): number {
  if (margin.mode === "percent") return round2(buy * (1 + margin.percent / 100));
  return isTotal ? 0 : round2(buy + margin.amount);
}

/** What still stops a read from being added to the desk, in plain words. Empty = ready. */
export function blockers(read: RateRead, choice: { currency?: string; airlineName?: string }): string[] {
  const out: string[] = [];
  if (!read.hasRates) out.push("No rates were found in this email.");
  if (!(choice.currency || read.currency)) out.push("Choose the currency.");
  if (read.mode === "air" && !(choice.airlineName || read.airlineName).trim()) out.push("Name the airline.");
  if (read.needsCheck.includes("container type")) out.push("Some container types are not clear: check them.");
  return out;
}

export interface AddChoices {
  currency?: string;
  airlineName?: string;
  /** Name of the agent or vendor. Kept on the desk only; it never reaches the customer. */
  agentName?: string;
  isAgent: boolean;
  margin: MarginInput;
  laneId?: string;
}

/** An air read -> an airline option: buy = the vendor's rate, sell = buy + margin, tagged as from email (and as an agent rate when it is one). */
export function readToAirOption(read: RateRead, c: AddChoices): AirlineOption {
  const breaks: WeightBreaks = { ...EMPTY_AIR_BREAKS };
  for (const [name, buy] of Object.entries(read.breaks) as Array<[WeightBreakName, number]>) {
    breaks[name] = { buy, sell: sellFromBuy(buy, c.margin, name === "min") };
  }
  const name = (c.airlineName || read.airlineName).trim();
  return createAirlineOption(
    {
      name,
      routing: read.routing,
      tt: read.transit || "TBA",
      validity: read.validity,
      breaks,
      rateLock: true,
      laneId: c.laneId ?? "",
      ...(c.isAgent ? { agentRate: true, agentName: (c.agentName || read.vendor).trim() } : {}),
      fromEmail: true,
    },
    false,
  );
}

/** A sea read -> a liner option: container buy rates with sell = buy + margin; an LCL rate per cbm. */
export function readToLinerOption(read: RateRead, c: AddChoices & { carrierName?: string }): LinerOption {
  const containers = read.containers.filter((x) => x.type).map((x) => ({ type: x.type, qty: 1, buyRate: x.rate, sellRate: sellFromBuy(x.rate, c.margin) }));
  return createLinerOption(
    {
      name: (c.carrierName || c.airlineName || read.airlineName || read.vendor).trim(),
      routing: read.routing,
      tt: read.transit,
      validity: read.validity,
      laneId: c.laneId ?? "",
      containers: containers.length ? containers : undefined,
      lclBuy: read.lclPerCbm ?? 0,
      lclSell: read.lclPerCbm ? sellFromBuy(read.lclPerCbm, c.margin) : 0,
      ...(c.isAgent ? { agentRate: true, agentName: (c.agentName || read.vendor).trim() } : {}),
      fromEmail: true,
    },
    false,
  );
}

/** Reads in different currencies cannot go on one desk together. */
export function currencyClash(reads: Array<{ currency: string }>): string | null {
  const set = new Set(reads.map((r) => r.currency).filter(Boolean));
  return set.size > 1 ? `These rates are in different currencies (${[...set].join(", ")}). The desk quotes in one currency: add them one currency at a time.` : null;
}

/** The emails waiting to be read, left by the Inbox conversation ("Send to desk as rates"). Memory of this tab only. */
export const RATE_EMAILS_KEY = "atlas_rate_emails_v1";
export interface PendingRateEmail {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  text: string;
}
