/**
 * Admin screen "AI credit and cost" — the wording and tone rules, kept apart from the screen so they can be tested.
 * The numbers come from the aiUsageSummary function (see functions/ai-usage.js).
 */

export interface AiUsageRowView {
  key: string;
  calls: number;
  input: number;
  output: number;
  web: number;
  costUsd: number;
}

export interface AiMonthView {
  month: string;
  total: { calls: number; input: number; output: number; web: number; costUsd: number };
  features: AiUsageRowView[];
  models: AiUsageRowView[];
  days: Array<{ day: string; calls: number; costUsd: number }>;
}

export interface AiSummaryView {
  months: AiMonthView[];
  countingSince: number | null;
  totalUsd: number;
  status: { outOfCredit: boolean; since: number | null; lastFeature: string };
  billing: null | {
    balanceUsd: number;
    asOf: number;
    lowAtUsd: number;
    inrPerUsd: number;
    estimateUsd: number | null;
    spentSinceUsd: number;
    alertedAt: number | null;
  };
  defaults: { lowAtUsd: number; inrPerUsd: number };
  budgets?: { totalUsd: number | null; perFeature: Record<string, number> } | null;
  paused?: { total: boolean; features: string[] };
  today?: { alert: boolean; todayUsd: number; avgUsd: number; times: number | null };
}

/** What each feature is called to the people who run the company (the key is the name of the server function). */
const FEATURE_LABELS: Record<string, string> = {
  vertexChat: "Ask Vertex",
  atlasCopilot: "App help assistant",
  atlasCopilotStream: "App help assistant",
  extractAirTariffFromCircular: "Air circular upload",
  extractSeaTariffFromCircular: "Sea circular upload",
  extractCourierTariffFromCircular: "Courier circular upload",
  extractVendorRateFromDocument: "Vendor rate from a document",
  draftEnquiryReply: "Enquiry reply drafts",
  extractShipmentFromDocuments: "Quote Hub documents",
  parseQuoteInstruction: "Quote by instruction",
  pollPricingInboxes: "Mailbox reading",
  readCarrierCircular: "Carrier Board reader",
  weeklyAgencyListEmail: "Agency list check",
  triggerAgencyListNow: "Agency list check",
};

export function featureLabel(key: string): string {
  const k = String(key || "");
  if (FEATURE_LABELS[k]) return FEATURE_LABELS[k];
  // function names that came from the server in lower case (for example "vertexchat")
  const hit = Object.keys(FEATURE_LABELS).find((name) => name.toLowerCase() === k.toLowerCase());
  return hit ? FEATURE_LABELS[hit] : k || "Unknown";
}

/** "claude_haiku_4_5_20251001" -> "Haiku 4.5"; "claude_sonnet_5_5" -> "Sonnet 5.5". Unknown names are left readable. */
export function modelLabel(key: string): string {
  const m = /(fable|opus|sonnet|haiku|mythos)_(\d+)(?:_(\d{1,2}))?(?:_|$)/i.exec(String(key || ""));
  if (!m) return String(key || "Unknown").replace(/_/g, " ");
  const family = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  return `${family} ${m[2]}${m[3] ? `.${m[3]}` : ""}`;
}

export function fmtUsd(n: number): string {
  const v = Number(n) || 0;
  if (v > 0 && v < 0.005) return "under $0.01";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtInr(usd: number, inrPerUsd: number): string {
  const v = (Number(usd) || 0) * (Number(inrPerUsd) || 0);
  if (v > 0 && v < 0.5) return "under ₹1";
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

export function fmtTokens(n: number): string {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month || "");
  if (!m) return month || "";
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

export type CreditTone = "out" | "low" | "ok" | "none";

/** One plain sentence about where the credit stands, and how worried to look. */
export function creditStatus(s: AiSummaryView): { tone: CreditTone; headline: string; detail: string } {
  const rate = s.billing?.inrPerUsd ?? s.defaults.inrPerUsd;
  if (s.status.outOfCredit) {
    return {
      tone: "out",
      headline: "The AI credit has run out",
      detail: "AI features are stopped for everyone until credit is added in the Anthropic Console. Then type the new balance below.",
    };
  }
  if (!s.billing || s.billing.estimateUsd === null) {
    return {
      tone: "none",
      headline: "Balance not entered yet",
      detail: "Type the balance shown in the Anthropic Console once. The app then counts down from it and warns you before it runs out.",
    };
  }
  const est = s.billing.estimateUsd;
  if (est <= s.billing.lowAtUsd) {
    return {
      tone: "low",
      headline: est <= 0 ? "The credit is probably finished" : `About ${fmtUsd(est)} (${fmtInr(est, rate)}) left, which is low`,
      detail: `You asked to be warned below ${fmtUsd(s.billing.lowAtUsd)}. Add credit in the Anthropic Console, then type the new balance below.`,
    };
  }
  return {
    tone: "ok",
    headline: `About ${fmtUsd(est)} (${fmtInr(est, rate)}) left`,
    detail: `Counted down from the ${fmtUsd(s.billing.balanceUsd)} you entered. You will be warned below ${fmtUsd(s.billing.lowAtUsd)}.`,
  };
}

/** The balance form's numbers -> what to send, or a plain problem. */
export function readBalanceForm(f: { balance: string; lowAt: string; rate: string }):
  | { ok: true; balanceUsd: number; lowAtUsd: number; inrPerUsd: number }
  | { ok: false; message: string } {
  const clean = (t: string) => Number(String(t).replace(/[$,₹\s]/g, ""));
  const balanceUsd = clean(f.balance);
  if (f.balance.trim() === "" || !Number.isFinite(balanceUsd) || balanceUsd < 0) return { ok: false, message: "Type the balance shown in the Anthropic Console, in US dollars." };
  const lowAtUsd = f.lowAt.trim() === "" ? 10 : clean(f.lowAt);
  if (!Number.isFinite(lowAtUsd) || lowAtUsd < 0) return { ok: false, message: "The warning level must be a number of dollars." };
  const inrPerUsd = f.rate.trim() === "" ? 90 : clean(f.rate);
  if (!Number.isFinite(inrPerUsd) || inrPerUsd < 1 || inrPerUsd > 1000) return { ok: false, message: "The rupee rate must be between 1 and 1000." };
  return { ok: true, balanceUsd, lowAtUsd, inrPerUsd };
}

/** A tidy top for a bar chart: the smallest of 1, 2, 5 or 10 (times a power of ten) that holds every bar, and where to draw the grid lines. */
export function chartScale(values: number[]): { max: number; ticks: number[] } {
  const mx = Math.max(0.1, ...values.map((v) => Number(v) || 0));
  const mag = 10 ** Math.floor(Math.log10(mx));
  const round = (x: number) => Math.round(x * 1e6) / 1e6;
  const max = round([1, 2, 5, 10].map((m) => m * mag).find((v) => v >= mx) ?? mx);
  return { max, ticks: [0, round(max / 2), max] };
}

/** The features a monthly budget can be set for, in the order shown (each is the name of the function that calls the AI). */
export const AI_FEATURE_KEYS = [
  "vertexChat",
  "readCarrierCircular",
  "extractAirTariffFromCircular",
  "extractSeaTariffFromCircular",
  "extractCourierTariffFromCircular",
  "extractShipmentFromDocuments",
  "parseQuoteInstruction",
  "extractVendorRateFromDocument",
  "draftEnquiryReply",
  "pollPricingInboxes",
  "atlasCopilotStream",
  "weeklyAgencyListEmail",
] as const;

export type BudgetState = "none" | "ok" | "near" | "paused";

export interface BudgetRow {
  key: string;
  label: string;
  usedUsd: number;
  limitUsd: number | null;
  pct: number | null; // 0..1, capped at 1
  state: BudgetState;
}

export function budgetState(used: number, limit: number | null): BudgetState {
  if (limit === null) return "none";
  if (used >= limit) return "paused";
  return used >= limit * 0.8 ? "near" : "ok";
}

/** One row per feature that has a budget, has been used this month, or can be given one; most used first. */
export function budgetRows(s: AiSummaryView): { total: BudgetRow; features: BudgetRow[] } {
  const month = s.months[0];
  const used = new Map((month?.features ?? []).map((f) => [f.key, f.costUsd]));
  const limits = s.budgets?.perFeature ?? {};
  const keys = [...new Set([...AI_FEATURE_KEYS, ...used.keys(), ...Object.keys(limits)])];
  const row = (key: string, label: string, usedUsd: number, limitUsd: number | null): BudgetRow => ({
    key,
    label,
    usedUsd,
    limitUsd,
    pct: limitUsd === null ? null : limitUsd <= 0 ? 1 : Math.min(1, usedUsd / limitUsd),
    state: budgetState(usedUsd, limitUsd),
  });
  const features = keys
    .map((k) => row(k, featureLabel(k), used.get(k) ?? 0, Number.isFinite(limits[k]) ? limits[k] : null))
    .sort((a, b) => b.usedUsd - a.usedUsd || AI_FEATURE_KEYS.indexOf(a.key as never) - AI_FEATURE_KEYS.indexOf(b.key as never));
  return { total: row("total", "All AI together", month?.total.costUsd ?? 0, s.budgets && s.budgets.totalUsd !== null && Number.isFinite(s.budgets.totalUsd) ? s.budgets.totalUsd : null), features };
}

/** The budget form -> what to send, or a plain problem. Empty means no limit; 0 pauses. `rows` maps feature name to the typed text. */
export function readBudgetForm(f: { total: string; rows: Record<string, string> }):
  | { ok: true; totalUsd: number | null; perFeature: Record<string, number> }
  | { ok: false; message: string } {
  const clean = (t: string) => String(t ?? "").replace(/[$,\s]/g, "");
  const parse = (t: string): number | null | "bad" => {
    const c = clean(t);
    if (c === "") return null;
    const n = Number(c);
    return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : "bad";
  };
  const total = parse(f.total);
  if (total === "bad") return { ok: false, message: "The overall budget must be a number of dollars (0 or more), or empty for no limit." };
  const perFeature: Record<string, number> = {};
  for (const [k, v] of Object.entries(f.rows)) {
    const n = parse(v);
    if (n === "bad") return { ok: false, message: `The budget for ${featureLabel(k)} must be a number of dollars (0 or more), or empty for no limit.` };
    if (n !== null) perFeature[k] = n;
  }
  return { ok: true, totalUsd: total, perFeature };
}

/** One sentence if today's spending is far above the month's usual, otherwise nothing. */
export function spikeNote(s: AiSummaryView): string | null {
  const t = s.today;
  if (!t || !t.alert) return null;
  return `Today's AI use is high: ${fmtUsd(t.todayUsd)} so far${t.times ? `, about ${t.times} times a normal day` : ""}. The table below shows what used it.`;
}
