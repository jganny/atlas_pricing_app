import type { SavedQuote } from "@/lib/types";

export interface VendorPreviewRow {
  id: string;
  name: string;
  kind: string;
  kindLabel: string;
  total: number;
  selected: boolean;
  cheapest: boolean;
  routing?: string;
  tt?: string;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function kindLabel(kind: string): string {
  const k = (kind || "").toLowerCase();
  if (k === "coloader") return "Coloader";
  if (k === "liner") return "Liner";
  if (k === "courier") return "Courier";
  if (k === "trucker" || k === "transport") return "Trucker";
  if (k === "airline") return "Airline";
  return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : "Option";
}

export function compareHeading(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("air")) return "Airline / coloader options";
  if (t.includes("sea")) return "Liner / coloader options";
  if (t.includes("courier")) return "Courier options";
  if (t.includes("transport")) return "Trucker options";
  return "Vendor options";
}

export function quotedFieldLabel(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("air")) return "Quoted airline";
  if (t.includes("sea")) return "Quoted liner";
  if (t.includes("courier")) return "Quoted carrier";
  if (t.includes("transport")) return "Quoted trucker";
  return "Quoted option";
}

export function markCheapest(rows: Omit<VendorPreviewRow, "cheapest">[]): VendorPreviewRow[] {
  const priced = rows.filter((r) => r.total > 0);
  const min = priced.length ? Math.min(...priced.map((r) => r.total)) : 0;
  const marked = rows.map((r) => ({
    ...r,
    cheapest: r.total > 0 && priced.length > 0 && r.total === min,
  }));
  return marked.sort((a, b) => {
    const ta = a.total > 0 ? a.total : Number.POSITIVE_INFINITY;
    const tb = b.total > 0 ? b.total : Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function rec(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function storedTotal(a: Record<string, unknown>): number {
  return (
    num(a.quoteTotal) ||
    num(a.grandSell) ||
    num(a.sellLocal) ||
    num(a.sellUsd) ||
    num(a.amount) ||
    num(a.freightSell) + num(a.detention) + num(a.tolls)
  );
}

function rowFromRaw(
  raw: unknown,
  i: string | number,
  fallbackKind: string,
  total = storedTotal(rec(raw)),
): Omit<VendorPreviewRow, "cheapest"> {
  const a = rec(raw);
  const kind = String(a.kind || fallbackKind);
  return {
    id: String(a.id ?? i),
    name: String(a.name || "Untitled"),
    kind,
    kindLabel: kindLabel(kind),
    total,
    selected: Boolean(a.selected),
    routing: String(a.routing ?? ""),
    tt: String(a.tt ?? a.transit ?? ""),
  };
}

function mergeMissingAlternatives(
  rows: Omit<VendorPreviewRow, "cheapest">[],
  alternatives: unknown,
  fallbackKind: string,
): Omit<VendorPreviewRow, "cheapest">[] {
  if (!Array.isArray(alternatives) || !alternatives.length) return rows;
  const names = new Set(rows.map((r) => r.name.trim().toLowerCase()).filter(Boolean));
  const extra = alternatives
    .map((raw, i) => {
      const a = rec(raw);
      const name = String(a.name || "").trim();
      if (!name || names.has(name.toLowerCase())) return null;
      return rowFromRaw(a, `alt-${i}`, fallbackKind);
    })
    .filter((r): r is Omit<VendorPreviewRow, "cheapest"> => Boolean(r));
  return [...rows, ...extra];
}

/** Shared cheapest-star rows for desk compare + quote preview. */
export function vendorRowsFromEntries(
  items: Array<{
    id: string;
    name: string;
    kind?: string;
    total: number;
    selected: boolean;
    routing?: string;
    tt?: string;
  }>,
): VendorPreviewRow[] {
  return markCheapest(
    items.map((item) => {
      const kind = item.kind || "option";
      return {
        id: item.id,
        name: item.name || "Untitled",
        kind,
        kindLabel: kindLabel(kind),
        total: num(item.total),
        selected: Boolean(item.selected),
        routing: item.routing || "",
        tt: item.tt || "",
      };
    }),
  );
}

/** Airline / liner / courier / trucker options for quote preview — star = lowest total. */
export function vendorRowsFromQuote(quote: SavedQuote): VendorPreviewRow[] {
  const d = (quote.details ?? {}) as Record<string, unknown>;
  const type = (quote.type || String(d.type ?? d.mode ?? "")).toLowerCase();

  if ((type.includes("air") || type === "ae" || type === "ai") && Array.isArray(d.airlines) && d.airlines.length > 0) {
    const rows = d.airlines.map((raw, i) => rowFromRaw(raw, i, String(rec(raw).kind || "airline")));
    return markCheapest(mergeMissingAlternatives(rows, d.alternatives, "airline"));
  }

  if (type.includes("sea") && Array.isArray(d.liners) && d.liners.length > 0) {
    const rows = d.liners.map((raw, i) => rowFromRaw(raw, i, String(rec(raw).kind || "liner")));
    return markCheapest(mergeMissingAlternatives(rows, d.alternatives, "liner"));
  }

  if (type.includes("courier") && Array.isArray(d.carrierQuotes) && d.carrierQuotes.length > 0) {
    const chosen = String(d.carrier ?? d.carrierName ?? "");
    return markCheapest(
      d.carrierQuotes.map((raw, i) => {
        const a = rec(raw);
        const id = String(a.id ?? i);
        const name = String(a.name || "Carrier");
        return {
          id,
          name,
          kind: "courier",
          kindLabel: kindLabel("courier"),
          total: num(a.sellLocal ?? a.sellUsd ?? a.total),
          selected: id === chosen || name === chosen,
          routing: "",
          tt: String(a.transit ?? d.transit ?? ""),
        };
      }),
    );
  }

  if (type.includes("transport")) {
    if (Array.isArray(d.truckers) && d.truckers.length > 0) {
      return markCheapest(d.truckers.map((raw, i) => rowFromRaw(raw, i, "trucker")));
    }
    const single = num(d.freightSell) + num(d.detention) + num(d.tolls);
    if (single > 0 || String(d.truckerName ?? d.vehicleType ?? "")) {
      return markCheapest([
        {
          id: "trucker-0",
          name: String(d.truckerName || d.vehicleType || "Trucker"),
          kind: "trucker",
          kindLabel: kindLabel("trucker"),
          total: single || num(quote.amount),
          selected: true,
          routing: "",
          tt: "",
        },
      ]);
    }
  }

  return [];
}
