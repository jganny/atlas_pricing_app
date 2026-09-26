import type { EnquiryLeg, EnquiryLegKind, EnquiryRecord } from "@/lib/types";
import { gpAmountInr, sellAmountInr } from "@/lib/quotes/money";
import { deskDisplayName } from "@/lib/quotes/team-roles";
import { seatForLogin } from "@/lib/auth/desk-seats";
import { PERIOD_GRANULARITIES, parseCreatedAt, periodKey, type PeriodGranularity } from "@/lib/quotes/report-periods";

export type ReportDim =
  | "mode"
  | "carrierKind"
  | "carrier"
  | "pol"
  | "pod"
  | "lane"
  | "tonnage"
  | "status"
  | "customer"
  | "desk"
  | "seat"
  | PeriodGranularity;

export const REPORT_DIMS: Array<{ id: ReportDim; label: string }> = [
  { id: "mode", label: "Mode" },
  { id: "carrierKind", label: "Carrier type (Airline / Coloader / Liner)" },
  { id: "carrier", label: "Carrier" },
  { id: "pol", label: "POL (origin)" },
  { id: "pod", label: "POD (destination)" },
  { id: "lane", label: "Lane (POL → POD)" },
  { id: "tonnage", label: "Tonnage band" },
  { id: "status", label: "Status" },
  { id: "customer", label: "Customer" },
  { id: "desk", label: "Desk / creator" },
  { id: "seat", label: "Desk seat (Free Hand / Air Nom / Sea Nom / NRS…)" },
  ...PERIOD_GRANULARITIES.map((g) => ({ id: g.id as ReportDim, label: `Period: ${g.label}` })),
];

const PERIOD_IDS = new Set<string>(PERIOD_GRANULARITIES.map((g) => g.id));

/** One quoted lane of one quote — the unit reports group over. */
export interface ReportFact {
  quoteId: string;
  mode: EnquiryRecord["mode"];
  status: EnquiryRecord["status"];
  customer: string;
  desk: string;
  /** Stable desk seat (Free Hand, Air Nom…) — unchanged when the person in the seat changes. */
  seat: string;
  /** Quote creation time (epoch ms), null when undated. */
  time: number | null;
  leg: EnquiryLeg;
  sellInr: number;
  gpInr: number;
  tonnes: number | null;
}

const KIND_LABEL: Record<EnquiryLegKind, string> = {
  airline: "Airline",
  coloader: "Coloader",
  liner: "Liner",
  other: "Other",
};

/** kg / gross-weight → tonnes; sea revenue-tons (RT) are already tonne-equivalent. */
export function billingTonnes(row: Pick<EnquiryRecord, "billingWeight" | "billingUnit">): number | null {
  const w = row.billingWeight;
  if (!w || w <= 0) return null;
  return row.billingUnit === "rt" ? w : w / 1000;
}

export function tonnageBand(tonnes: number | null): string {
  if (tonnes == null) return "No weight";
  if (tonnes < 0.1) return "< 0.1 t";
  if (tonnes < 0.5) return "0.1 – 0.5 t";
  if (tonnes < 1) return "0.5 – 1 t";
  if (tonnes < 5) return "1 – 5 t";
  if (tonnes < 20) return "5 – 20 t";
  return "20 t +";
}

function portCode(v: string): string {
  return (v.split(" - ")[0] || v).trim().toUpperCase() || "—";
}

function fallbackLeg(row: EnquiryRecord): EnquiryLeg {
  return {
    origin: row.origin,
    destination: row.destination,
    carrier: row.carrier || "",
    kind: row.mode === "air" ? "airline" : row.mode === "sea" ? "liner" : "other",
  };
}

/** Explodes quotes into one fact per quoted lane; revenue/GP split by each lane's share of the quote. */
export function explodeFacts(rows: EnquiryRecord[]): ReportFact[] {
  const facts: ReportFact[] = [];
  for (const row of rows) {
    const legs = row.legs?.length ? row.legs : [fallbackLeg(row)];
    const sell = sellAmountInr(row);
    const gp = gpAmountInr(row);
    const amounts = legs.map((l) => l.amount ?? 0);
    const amountSum = amounts.reduce((a, b) => a + b, 0);
    for (const [i, leg] of legs.entries()) {
      const share = legs.length === 1 ? 1 : amountSum > 0 ? amounts[i]! / amountSum : 1 / legs.length;
      facts.push({
        quoteId: row.id,
        mode: row.mode,
        status: row.status,
        customer: row.customer || "—",
        desk: deskDisplayName(row.creator || row.assignee) || "—",
        seat: seatForLogin(row.creator || row.assignee)?.label || deskDisplayName(row.creator || row.assignee) || "—",
        time: parseCreatedAt(row.createdAt),
        leg,
        sellInr: sell * share,
        gpInr: gp * share,
        tonnes: billingTonnes(row),
      });
    }
  }
  return facts;
}

export function dimValue(f: ReportFact, dim: ReportDim): string {
  switch (dim) {
    case "mode":
      return f.mode.toUpperCase();
    case "carrierKind":
      return KIND_LABEL[f.leg.kind];
    case "carrier":
      return f.leg.carrier.trim() || "—";
    case "pol":
      return portCode(f.leg.origin);
    case "pod":
      return portCode(f.leg.destination);
    case "lane":
      return `${portCode(f.leg.origin)} → ${portCode(f.leg.destination)}`;
    case "tonnage":
      return tonnageBand(f.tonnes);
    case "status":
      return f.status;
    case "customer":
      return f.customer;
    case "desk":
      return f.desk;
    case "seat":
      return f.seat;
    default:
      return PERIOD_IDS.has(dim) ? periodKey(f.time, dim as PeriodGranularity) : "—";
  }
}

export interface ReportRow {
  keys: string[];
  quotes: number;
  won: number;
  winRate: number;
  sellInr: number;
  gpInr: number;
  tonnes: number;
}

export type ReportSort = "quotes" | "sell" | "gp" | "tonnes" | "winRate" | "key";

export interface ReportFilters {
  carrierKind?: EnquiryLegKind | "all";
}

/** Group facts by the chosen dimensions (in order). Quotes are counted once per group even if several lanes fall in it. */
export function buildReport(
  rows: EnquiryRecord[],
  dims: ReportDim[],
  sort: ReportSort = "sell",
  filters: ReportFilters = {},
): ReportRow[] {
  let facts = explodeFacts(rows);
  if (filters.carrierKind && filters.carrierKind !== "all") {
    facts = facts.filter((f) => f.leg.kind === filters.carrierKind);
  }
  const groups = new Map<string, { keys: string[]; quotes: Set<string>; won: Set<string>; sell: number; gp: number; tonnes: number }>();
  for (const f of facts) {
    const keys = dims.map((d) => dimValue(f, d));
    const id = keys.join("");
    let g = groups.get(id);
    if (!g) {
      g = { keys, quotes: new Set(), won: new Set(), sell: 0, gp: 0, tonnes: 0 };
      groups.set(id, g);
    }
    g.quotes.add(f.quoteId);
    if (f.status === "won") g.won.add(f.quoteId);
    g.sell += f.sellInr;
    g.gp += f.gpInr;
    g.tonnes += f.tonnes ?? 0;
  }
  const out: ReportRow[] = [...groups.values()].map((g) => ({
    keys: g.keys,
    quotes: g.quotes.size,
    won: g.won.size,
    winRate: g.quotes.size ? g.won.size / g.quotes.size : 0,
    sellInr: g.sell,
    gpInr: g.gp,
    tonnes: g.tonnes,
  }));
  const by: Record<ReportSort, (a: ReportRow, b: ReportRow) => number> = {
    quotes: (a, b) => b.quotes - a.quotes,
    sell: (a, b) => b.sellInr - a.sellInr,
    gp: (a, b) => b.gpInr - a.gpInr,
    tonnes: (a, b) => b.tonnes - a.tonnes,
    winRate: (a, b) => b.winRate - a.winRate || b.quotes - a.quotes,
    key: (a, b) => a.keys.join(" ").localeCompare(b.keys.join(" ")),
  };
  return out.sort(by[sort]);
}

function esc(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(rows: ReportRow[], dims: ReportDim[]): string {
  const labels = dims.map((d) => REPORT_DIMS.find((x) => x.id === d)?.label ?? d);
  const header = [...labels, "Quotes", "Won", "Win rate %", "Sell (INR)", "GP (INR)", "Tonnes"];
  const lines = [header.map(esc).join(",")];
  for (const r of rows) {
    lines.push(
      [
        ...r.keys,
        r.quotes,
        r.won,
        (r.winRate * 100).toFixed(1),
        Math.round(r.sellInr),
        Math.round(r.gpInr),
        r.tonnes.toFixed(2),
      ]
        .map(esc)
        .join(","),
    );
  }
  return lines.join("\n");
}
