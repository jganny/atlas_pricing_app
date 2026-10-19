/**
 * How long a new quote takes from opening the desk to saving it. Measured quietly (no extra steps for the user)
 * and stored on the quote as `quoteSeconds`, so speed can be tracked instead of guessed.
 */

const MAX_SECONDS = 4 * 60 * 60; // anything longer is a left-open tab, not a quote
let startedAt: number | null = null;

export function markQuoteStart(now = Date.now()): void {
  startedAt = now;
}

/** Seconds since the desk was opened, once, for a NEW quote. Null when unknown or implausible. */
export function takeQuoteSeconds(now = Date.now()): number | null {
  if (startedAt === null) return null;
  const secs = Math.round((now - startedAt) / 1000);
  startedAt = now; // the next quote saved from this same page is timed from here
  return secs >= 1 && secs <= MAX_SECONDS ? secs : null;
}

export interface TimedQuote {
  quoteSeconds?: number;
  deskSeat?: string;
  mode?: string;
  createdAt: string;
}

export interface SpeedRow {
  key: string;
  count: number;
  medianSeconds: number;
  under30: number;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Median time to quote per group (e.g. per desk) over the last `days` days; untimed quotes are ignored. */
export function speedBy(rows: TimedQuote[], keyOf: (q: TimedQuote) => string, days = 30, now = Date.now()): SpeedRow[] {
  const since = now - days * 86_400_000;
  const groups = new Map<string, number[]>();
  for (const q of rows) {
    if (typeof q.quoteSeconds !== "number" || q.quoteSeconds <= 0) continue;
    if (Date.parse(q.createdAt) < since) continue;
    const k = keyOf(q);
    groups.set(k, [...(groups.get(k) ?? []), q.quoteSeconds]);
  }
  return [...groups.entries()]
    .map(([key, v]) => ({ key, count: v.length, medianSeconds: median(v), under30: v.filter((x) => x <= 30).length }))
    .sort((a, b) => b.count - a.count);
}

export function formatSeconds(s: number): string {
  if (s < 90) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${s % 60 ? `${s % 60} s` : ""}`.trim();
}
