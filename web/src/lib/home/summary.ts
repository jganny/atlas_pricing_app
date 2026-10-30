/**
 * What the Home page shows, worked out from data the app already holds.
 * Numbers are for the current month. The admin sees every desk; everyone else sees only their own desk.
 */
import { belongsToViewersDesk, quoteDeskSeatId, quoteOwnerLabel } from "@/lib/auth/desk-seats";
import type { EnquiryRecord } from "@/lib/types";

export interface TeamRow {
  key: string;
  label: string;
  quoted: number;
  won: number;
  /** Whole percent, won out of quoted. */
  wonPct: number;
  /** Average seconds to make a quote, when the desk timed any. */
  avgSeconds: number | null;
}

export interface MonthTotals {
  quoted: number;
  won: number;
  wonPct: number;
  avgSeconds: number | null;
}

export function inMonth(createdAt: string, now: Date): boolean {
  const d = new Date(createdAt);
  return !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

const pct = (won: number, quoted: number) => (quoted > 0 ? Math.round((won / quoted) * 100) : 0);

function avg(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/** Quotes made this month by each desk, biggest first. */
export function teamPerformance(enquiries: EnquiryRecord[], now: Date = new Date()): TeamRow[] {
  const map = new Map<string, { label: string; quoted: number; won: number; secs: number[] }>();
  for (const e of enquiries) {
    if (e.status === "cancelled" || !inMonth(e.createdAt, now)) continue;
    const seat = quoteDeskSeatId(e);
    const key = seat ?? (e.creator || "unknown").toLowerCase();
    const slot = map.get(key) ?? { label: quoteOwnerLabel(e), quoted: 0, won: 0, secs: [] };
    slot.quoted += 1;
    if (e.status === "won") slot.won += 1;
    if (e.quoteSeconds && e.quoteSeconds > 0) slot.secs.push(e.quoteSeconds);
    map.set(key, slot);
  }
  return [...map.entries()]
    .map(([key, s]) => ({ key, label: s.label, quoted: s.quoted, won: s.won, wonPct: pct(s.won, s.quoted), avgSeconds: avg(s.secs) }))
    .sort((a, b) => b.quoted - a.quoted);
}

/** This month's totals for the quotes the viewer is meant to see. */
export function monthTotals(enquiries: EnquiryRecord[], username: string | undefined | null, admin: boolean, now: Date = new Date()): MonthTotals {
  const mine = enquiries.filter((e) => e.status !== "cancelled" && inMonth(e.createdAt, now) && (admin || belongsToViewersDesk(e, username)));
  const won = mine.filter((e) => e.status === "won").length;
  return {
    quoted: mine.length,
    won,
    wonPct: pct(won, mine.length),
    avgSeconds: avg(mine.map((e) => e.quoteSeconds ?? 0).filter((n) => n > 0)),
  };
}

/** "6 min", "45 sec", "—" */
export function secondsLabel(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 90) return `${seconds} sec`;
  return `${Math.round(seconds / 60)} min`;
}

export type AttentionKind = "hub" | "draft" | "won";
export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  title: string;
  sub: string;
  tag: string;
  tone: "new" | "warn" | "late";
  href: string;
  /** Older first within a tone. */
  at: number;
}

const TONE_RANK = { late: 0, warn: 1, new: 2 } as const;

/** The few things waiting on this user, most urgent first. */
export function sortAttention(items: AttentionItem[], limit = 6): AttentionItem[] {
  return [...items].sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || a.at - b.at).slice(0, limit);
}
