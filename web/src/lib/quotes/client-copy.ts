import type { SavedQuote } from "../types";

/**
 * What the client is allowed to see of a quote.
 *
 *  - An airline / liner / coloader whose "show the name" box is unticked is shown as a neutral label ("Airline option 2"),
 *    everywhere the quote's words appear: the option table, charge panels, lane lines, share text and the email cover.
 *  - An agent's name (Import: "Rates procured from an Agent") is never shown. If someone typed it into a note or the terms,
 *    that is replaced too.
 *
 * The saved quote is untouched; only the copy that goes to the client is cleaned. Staff screens keep the real names.
 */

type Rec = Record<string, unknown>;

const OPTION_LISTS: Array<{ key: "airlines" | "liners"; word: (kind: string) => string }> = [
  { key: "airlines", word: (kind) => (kind === "coloader" ? "Coloader" : "Airline") },
  { key: "liners", word: (kind) => (kind === "coloader" ? "Coloader" : "Liner") },
];

const AGENT_PLACEHOLDER = "our partner";

function isRec(v: unknown): v is Rec {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word, case-insensitive: hiding "EK" must not touch "BREAK". */
function wordPattern(name: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(name)}(?![A-Za-z0-9])`, "gi");
}

export type ClientCopyPlan = {
  /** real name -> what the client sees, for options with their name hidden. */
  hidden: Array<{ name: string; label: string }>;
  /** Names of agents, to be removed wherever they appear. */
  agents: string[];
};

/** Reads the saved options and works out which names must not reach the client. */
export function clientCopyPlan(quote: Pick<SavedQuote, "details">): ClientCopyPlan {
  const d = (quote.details ?? {}) as Rec;
  const hidden: ClientCopyPlan["hidden"] = [];
  const agents = new Set<string>();
  for (const { key, word } of OPTION_LISTS) {
    const list = d[key];
    if (!Array.isArray(list)) continue;
    const perLane = new Map<string, number>();
    for (const raw of list) {
      if (!isRec(raw)) continue;
      const lane = String(raw.laneId ?? "");
      const n = (perLane.get(lane) ?? 0) + 1;
      perLane.set(lane, n);
      const name = String(raw.name ?? "").trim();
      if (raw.hideName === true && name) {
        const label = `${word(String(raw.kind ?? ""))} option ${n}`;
        hidden.push({ name, label });
        // "EK — Emirates SkyCargo" is often written as just "EK" elsewhere (a route line, a note).
        const code = name.split(/[^A-Za-z0-9]+/)[0] ?? "";
        if (/^[A-Za-z0-9]{2,3}$/.test(code) && code.toLowerCase() !== name.toLowerCase()) hidden.push({ name: code, label });
      }
      const agent = String(raw.agentName ?? "").trim();
      if (agent) agents.add(agent);
    }
  }
  // Longest first, so "Unico Logistics (Coloader)" is replaced before "Unico".
  hidden.sort((a, b) => b.name.length - a.name.length);
  return { hidden, agents: [...agents].sort((a, b) => b.length - a.length) };
}

function cleanText(text: string, plan: ClientCopyPlan): string {
  let out = text;
  for (const a of plan.agents) out = out.replace(wordPattern(a), AGENT_PLACEHOLDER);
  for (const h of plan.hidden) out = out.replace(wordPattern(h.name), h.label);
  return out;
}

function cleanValue(v: unknown, plan: ClientCopyPlan): unknown {
  if (typeof v === "string") return cleanText(v, plan);
  if (Array.isArray(v)) return v.map((x) => cleanValue(x, plan));
  if (isRec(v)) {
    const out: Rec = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === "agentName" || k === "agentRate") continue; // never leaves the building
      out[k] = cleanValue(val, plan);
    }
    return out;
  }
  return v;
}

/** The quote as the client may see it. Pure: the original is not changed. */
export function quoteForClient(quote: SavedQuote): SavedQuote {
  const plan = clientCopyPlan(quote);
  if (!plan.hidden.length && !plan.agents.length && !hasAgentKeys(quote.details)) return quote;
  const cleaned = cleanValue(quote, plan) as SavedQuote;
  return cleaned;
}

function hasAgentKeys(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(hasAgentKeys);
  if (isRec(v)) return Object.entries(v).some(([k, val]) => k === "agentName" || k === "agentRate" || hasAgentKeys(val));
  return false;
}

/** For staff screens: the options on a saved quote that used an agent, as [carrier name, agent name]. */
export function agentsUsed(quote: Pick<SavedQuote, "details">): Array<{ carrier: string; agent: string }> {
  const d = (quote.details ?? {}) as Rec;
  const out: Array<{ carrier: string; agent: string }> = [];
  for (const { key } of OPTION_LISTS) {
    const list = d[key];
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (isRec(raw) && raw.agentRate === true) out.push({ carrier: String(raw.name ?? ""), agent: String(raw.agentName ?? "").trim() });
    }
  }
  return out;
}

export const AGENT_REPLACEMENT_TEXT = AGENT_PLACEHOLDER;
