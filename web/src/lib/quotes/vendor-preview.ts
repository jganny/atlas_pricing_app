import type { SavedQuote } from "@/lib/types";

export interface VendorPreviewRow {
  id: string;
  name: string;
  kind: string;
  total: number;
  selected: boolean;
  cheapest: boolean;
}

function markCheapest(rows: Omit<VendorPreviewRow, "cheapest">[]): VendorPreviewRow[] {
  const priced = rows.filter((r) => r.total > 0);
  const min = priced.length ? Math.min(...priced.map((r) => r.total)) : 0;
  return rows.map((r) => ({
    ...r,
    cheapest: r.total > 0 && priced.length > 0 && r.total === min,
  }));
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Airline / liner / courier options for quote preview — star = lowest total. */
export function vendorRowsFromQuote(quote: SavedQuote): VendorPreviewRow[] {
  const d = quote.details ?? {};
  const type = (quote.type || "").toLowerCase();

  if (type.includes("air") && Array.isArray(d.airlines) && d.airlines.length > 0) {
    return markCheapest(
      d.airlines.map((raw, i) => {
        const a = raw as Record<string, unknown>;
        return {
          id: String(a.id ?? i),
          name: String(a.name || "Untitled"),
          kind: String(a.kind || "airline"),
          total: num(a.quoteTotal ?? a.grandSell ?? a.amount),
          selected: Boolean(a.selected),
        };
      }),
    );
  }

  if (type.includes("sea") && Array.isArray(d.liners) && d.liners.length > 0) {
    return markCheapest(
      d.liners.map((raw, i) => {
        const a = raw as Record<string, unknown>;
        return {
          id: String(a.id ?? i),
          name: String(a.name || "Untitled"),
          kind: String(a.kind || "liner"),
          total: num(a.quoteTotal ?? a.grandSell ?? a.amount),
          selected: Boolean(a.selected),
        };
      }),
    );
  }

  if (type.includes("courier") && Array.isArray(d.carrierQuotes) && d.carrierQuotes.length > 0) {
    const chosen = String(d.carrier ?? d.carrierName ?? "");
    return markCheapest(
      d.carrierQuotes.map((raw, i) => {
        const a = raw as Record<string, unknown>;
        const id = String(a.id ?? i);
        const name = String(a.name || "Carrier");
        return {
          id,
          name,
          kind: "courier",
          total: num(a.sellLocal ?? a.sellUsd ?? a.total),
          selected: id === chosen || name === chosen,
        };
      }),
    );
  }

  return [];
}
