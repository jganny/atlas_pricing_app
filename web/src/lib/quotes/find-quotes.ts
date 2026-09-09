import type { EnquiryRecord } from "@/lib/types";

function haystack(row: EnquiryRecord): string {
  return [
    row.ref,
    row.id,
    row.customer,
    row.origin,
    row.destination,
    row.carrier,
    row.assignee,
    row.creator,
    row.mode,
    row.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Rank a quote for free-text search — customer, city, lane, carrier, or ref. Filename optional. */
export function scoreQuoteMatch(row: EnquiryRecord, raw: string): number {
  const q = raw.toLowerCase().trim();
  if (!q) return 0;
  const tokens = q.split(/[\s,/|→\-]+/).filter((t) => t.length >= 2);
  if (!tokens.length) return 0;
  const hay = haystack(row);
  const customer = (row.customer || "").toLowerCase();
  const ref = (row.ref || "").toLowerCase();
  const origin = (row.origin || "").toLowerCase();
  const dest = (row.destination || "").toLowerCase();
  const carrier = (row.carrier || "").toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (ref === t) score += 100;
    else if (ref.startsWith(t) || ref.includes(t)) score += 80;
    else if (customer === t) score += 90;
    else if (customer.startsWith(t)) score += 70;
    else if (customer.includes(t)) score += 55;
    else if (origin === t || dest === t) score += 65;
    else if (origin.includes(t) || dest.includes(t)) score += 45;
    else if (carrier.includes(t)) score += 50;
    else if (hay.includes(t)) score += 20;
    else score -= 15;
  }
  return score;
}

export function searchQuotes(rows: EnquiryRecord[], raw: string, limit = 12): EnquiryRecord[] {
  const q = raw.trim();
  if (q.length < 2) return [];
  return rows
    .map((row) => ({ row, score: scoreQuoteMatch(row, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.row);
}

export function enquiryHref(row: Pick<EnquiryRecord, "id" | "ref">): string {
  return `/enquiries/?q=${encodeURIComponent(row.ref)}&select=${encodeURIComponent(row.id)}`;
}

export function deskEditHref(type: string, id: string): string {
  const t = (type || "air").toLowerCase();
  const path =
    t.includes("sea")
      ? "/sea"
      : t.includes("courier")
        ? "/courier"
        : t.includes("transport")
          ? "/transport"
          : t.includes("warehouse")
            ? "/warehouse"
            : "/air";
  return `${path}?edit=${encodeURIComponent(id)}`;
}
