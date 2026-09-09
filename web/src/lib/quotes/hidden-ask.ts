/** Hide quotes from Ask Vertex / Home queue without deleting Firestore. */

const KEY = "atlas_ask_hidden_quotes_v1";
const EVENT = "atlas:ask-hidden";

export function listHiddenQuoteIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as unknown;
    return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function isQuoteHiddenFromAsk(id: string): boolean {
  if (!id) return false;
  return listHiddenQuoteIds().includes(id);
}

export function hideQuoteFromAsk(id: string): void {
  if (!id) return;
  try {
    const next = Array.from(new Set([...listHiddenQuoteIds(), id]));
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, 500)));
  } catch {
    /* quota */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function subscribeHiddenAsk(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
