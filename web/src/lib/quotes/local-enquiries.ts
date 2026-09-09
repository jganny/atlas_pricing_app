import type { EnquiryRecord, SavedQuote } from "@/lib/types";

const KEY = "atlas_local_enquiries_v1";
const QUOTES_KEY = "atlas_local_quotes_v1";

export function listLocalEnquiries(): EnquiryRecord[] {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]") as EnquiryRecord[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function rememberLocalEnquiry(row: EnquiryRecord) {
  try {
    const rows = listLocalEnquiries().filter((r) => r.id !== row.id);
    rows.unshift(row);
    localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 50)));
  } catch {
    /* quota */
  }
}

export function listLocalQuotes(): Record<string, SavedQuote> {
  try {
    const raw = JSON.parse(localStorage.getItem(QUOTES_KEY) || "{}") as Record<string, SavedQuote>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function rememberLocalQuote(quote: SavedQuote) {
  if (!quote?.id) return;
  try {
    const map = listLocalQuotes();
    map[quote.id] = quote;
    const ids = Object.keys(map);
    if (ids.length > 50) {
      const extra = ids.slice(0, ids.length - 50);
      for (const id of extra) delete map[id];
    }
    localStorage.setItem(QUOTES_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function getLocalQuote(id: string | null | undefined): SavedQuote | null {
  if (!id) return null;
  return listLocalQuotes()[id] ?? null;
}

const LAST_KEY = "atlas_last_saved_enquiry_v1";

export function rememberLastSavedEnquiry(row: Pick<EnquiryRecord, "id" | "ref">) {
  try {
    sessionStorage.setItem(
      LAST_KEY,
      JSON.stringify({ id: row.id, ref: row.ref, at: Date.now() }),
    );
  } catch {
    /* private mode */
  }
}

export function getLastSavedEnquiry(): { id: string; ref: string; at: number } | null {
  try {
    const raw = sessionStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { id?: string; ref?: string; at?: number };
    if (!v?.id) return null;
    if (Date.now() - Number(v.at || 0) > 4 * 60 * 60 * 1000) return null;
    return { id: v.id, ref: String(v.ref || ""), at: Number(v.at || 0) };
  } catch {
    return null;
  }
}

/** Prepend quotes saved on this computer that Firestore has not returned yet. */
export function mergeLocalEnquiries(live: EnquiryRecord[]): EnquiryRecord[] {
  const seen = new Set(live.map((r) => r.id));
  const extra = listLocalEnquiries().filter((r) => r.id && !seen.has(r.id));
  return extra.length ? [...extra, ...live] : live;
}
