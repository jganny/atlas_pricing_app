/**
 * Admin console — the "at a glance" tiles and the little counters beside sections.
 * Pure: it turns numbers the screen has already fetched into what to show (words, colour, a bar), so the rules can be tested.
 * `undefined` means "still loading", `null` means "not available to this person or the lookup failed" (the tile is hidden).
 */
import { creditStatus, fmtUsd, monthLabel, type AiSummaryView } from "@/lib/ai/ai-usage-view";
import type { AdminContext, AdminIcon } from "./sections";
import { canSee, SECTIONS } from "./sections";

export type Tone = "ok" | "warn" | "bad" | "mute";

export interface AdminSignals {
  ai: AiSummaryView | null | undefined;
  resets: { count: number; oldestAt: number | null };
  errors: { week: number; day: number } | null | undefined;
  staff: { joined: number; invited: number; total: number } | null | undefined;
}

export interface Tile {
  id: string; // the section it opens
  icon: AdminIcon;
  label: string;
  value: string;
  pill: string;
  tone: Tone;
  sub: string;
  bar?: number; // 0..1
}

function dayLabel(ms: number, now: number): string {
  const days = Math.floor((now - ms) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function aiTile(ai: AiSummaryView): Tile {
  const s = creditStatus(ai);
  const month = ai.months[0];
  const spent = month ? `${fmtUsd(month.total.costUsd)} spent in ${monthLabel(month.month)}` : "Counting starts with the next AI call";
  if (s.tone === "out") return { id: "ai-credit-and-cost", icon: "spark", label: "AI credit", value: "$0.00", pill: "Out of credit", tone: "bad", sub: "AI is stopped for everyone", bar: 0 };
  if (s.tone === "none" || !ai.billing || ai.billing.estimateUsd === null) {
    return { id: "ai-credit-and-cost", icon: "spark", label: "AI credit", value: "Not set", pill: "Balance needed", tone: "mute", sub: "Type your Console balance once" };
  }
  const est = Math.max(0, ai.billing.estimateUsd);
  const base = Math.max(ai.billing.balanceUsd, est, 0.01);
  return { id: "ai-credit-and-cost", icon: "spark", label: "AI credit", value: fmtUsd(est), pill: s.tone === "low" ? "Running low" : "Healthy", tone: s.tone === "low" ? "warn" : "ok", sub: spent, bar: Math.min(1, est / base) };
}

export function buildTiles(sig: AdminSignals, ctx: AdminContext, now: number = Date.now()): Tile[] {
  const sees = (id: string) => {
    const s = SECTIONS.find((x) => x.id === id);
    return !!s && canSee(s.rule, ctx);
  };
  const out: Tile[] = [];
  if (sees("ai-credit-and-cost") && sig.ai) out.push(aiTile(sig.ai));
  if (sees("password-reset-queue")) {
    const n = sig.resets.count;
    out.push({
      id: "password-reset-queue",
      icon: "key",
      label: "Password resets",
      value: String(n),
      pill: n > 0 ? "Waiting" : "None waiting",
      tone: n > 0 ? "warn" : "ok",
      sub: n > 0 && sig.resets.oldestAt ? `Oldest request is from ${dayLabel(sig.resets.oldestAt, now)}` : "Nothing to process",
    });
  }
  if (sees("error-monitor") && sig.errors) {
    const e = sig.errors;
    out.push({
      id: "error-monitor",
      icon: "alert",
      label: "App errors",
      value: String(e.week),
      pill: e.week > 0 ? "This week" : "None this week",
      tone: e.week > 0 ? "warn" : "ok",
      sub: e.day > 0 ? `${e.day} reported in the last 24 hours` : "None in the last 24 hours",
    });
  }
  if (sees("chat-only-staff") && sig.staff) {
    const s = sig.staff;
    out.push(
      s.total === 0
        ? { id: "chat-only-staff", icon: "chat", label: "Chat-only staff", value: "None yet", pill: "Not started", tone: "mute", sub: "Add people who only use Vertex Chat" }
        : {
            id: "chat-only-staff",
            icon: "chat",
            label: "Chat-only staff",
            value: `${s.joined} of ${s.total}`,
            pill: "Joined",
            tone: s.joined === s.total ? "ok" : "mute",
            sub: s.invited > 0 ? `${s.invited} invite link${s.invited === 1 ? "" : "s"} not opened yet` : s.joined === s.total ? "Everyone has joined" : "Some logins are not invited yet",
            bar: s.joined / s.total,
          },
    );
  }
  return out;
}

/** Small counters shown beside a section in the list. */
export function railBadges(sig: AdminSignals): Record<string, { text: string; tone: "warn" | "bad" }> {
  const out: Record<string, { text: string; tone: "warn" | "bad" }> = {};
  if (sig.resets.count > 0) out["password-reset-queue"] = { text: String(sig.resets.count), tone: "warn" };
  if (sig.errors && sig.errors.week > 0) out["error-monitor"] = { text: String(sig.errors.week), tone: "bad" };
  if (sig.ai) {
    const s = creditStatus(sig.ai);
    if (s.tone === "out") out["ai-credit-and-cost"] = { text: "!", tone: "bad" };
    else if (s.tone === "low") out["ai-credit-and-cost"] = { text: "!", tone: "warn" };
  }
  return out;
}
