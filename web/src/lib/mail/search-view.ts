/**
 * Mailbox search results, grouped into conversations (the same subject once "RE:" and "FW:" are taken off) and ready to show.
 */
export interface SearchHit {
  mailbox: "pricing" | "pricingsales";
  folder: "inbox" | "sent";
  uid: number;
  messageId: string;
  subject: string;
  from: { email: string; name: string };
  to: Array<{ email: string; name: string }>;
  date: number;
  key: string;
}

export interface SearchGroup {
  key: string;
  subject: string;
  hits: SearchHit[];
  latest: number;
}

/** Hits of one conversation together, newest conversation first, newest mail first inside each. A mail with no usable subject stands alone. */
export function groupHits(hits: SearchHit[]): SearchGroup[] {
  const map = new Map<string, SearchGroup>();
  for (const h of hits) {
    const k = h.key && h.key.length >= 4 ? h.key : `${h.mailbox}:${h.folder}:${h.uid}`;
    const g = map.get(k) ?? { key: k, subject: h.subject, hits: [], latest: 0 };
    g.hits.push(h);
    map.set(k, g);
  }
  const out = [...map.values()];
  for (const g of out) {
    g.hits.sort((a, b) => b.date - a.date);
    g.latest = g.hits[0]?.date ?? 0;
    g.subject = g.hits[0]?.subject ?? g.subject;
  }
  return out.sort((a, b) => b.latest - a.latest);
}

/** Splits text around the searched words so they can be highlighted. */
export function highlightParts(text: string, terms: string[]): Array<{ text: string; hit: boolean }> {
  const words = terms.map((t) => t.trim()).filter((t) => t.length >= 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length || !text) return [{ text, hit: false }];
  // Splitting on a capture group puts the matched words at the odd positions.
  return text.split(new RegExp(`(${words.join("|")})`, "gi")).map((p, i) => ({ text: p, hit: i % 2 === 1 })).filter((p) => p.text !== "");
}

/** "Sent" for what the desk sent, otherwise the sender's name or address. */
export function hitWho(h: SearchHit): string {
  if (h.folder === "sent") {
    const first = h.to[0];
    return first ? `Sent to ${first.name || first.email}${h.to.length > 1 ? ` +${h.to.length - 1}` : ""}` : "Sent";
  }
  return h.from.name || h.from.email || "Unknown sender";
}

export const SEARCH_DAYS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last year" },
] as const;
