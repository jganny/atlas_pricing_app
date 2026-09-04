/** Offline / browser backup for quote drafts — mirrors legacy LocalStorage recovery. */

const KEY = "atlas_quote_offline_cache_v1";

export interface OfflineQuoteSnapshot {
  id: string;
  savedAt: number;
  type: string;
  customer: string;
  payload: Record<string, unknown>;
}

export function listOfflineQuotes(): OfflineQuoteSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function cacheOfflineQuote(snap: Omit<OfflineQuoteSnapshot, "savedAt">) {
  const rows = listOfflineQuotes().filter((r) => r.id !== snap.id);
  rows.unshift({ ...snap, savedAt: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
}

export function removeOfflineQuote(id: string) {
  localStorage.setItem(
    KEY,
    JSON.stringify(listOfflineQuotes().filter((r) => r.id !== id)),
  );
}

export function clearOfflineQuotes() {
  localStorage.removeItem(KEY);
}
