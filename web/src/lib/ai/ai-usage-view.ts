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
