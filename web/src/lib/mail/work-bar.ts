/**
 * The work bar: one line across the top of every screen saying which enquiry is waiting for someone, so a late enquiry is never missed
 * while a person is busy elsewhere. Amber when something new has arrived, red when nobody has opened it for 20 minutes or it is past its time.
 * Hidden when nothing is waiting. Fixed rules, no AI credit.
 */
import type { InboxEnquiry } from "@/lib/types";
import { replyBy, urgencyOf } from "./reply-by";
import { senderDisplay } from "./inbox-views";
import { isRateEnquiryToQuote } from "./rate-enquiry";

export const RED_AFTER_MIN = 20;
/** Older than this and an enquiry is not "news" any more (it is in the list, not on the bar). */
const STALE_MIN = 24 * 60;

export interface WorkBarState {
  tone: "amber" | "red";
  id: string;
  /** Total waiting, for the tab title. */
  count: number;
  more: number;
  headline: string;
  detail: string;
}

/** Waiting = a real unanswered RFQ (or escalation), nobody has a desk open on it. */
export function isWaiting(r: InboxEnquiry, now: number): boolean {
  if (r.status !== "new" || r.workingBy || r.repliedAt || r.actionRequired === false) return false;
  if (r.tag === "escalation") {
    const arrived = Date.parse(r.receivedAt || "") || now;
    return (now - arrived) / 60_000 <= STALE_MIN;
  }
  if (!isRateEnquiryToQuote(r)) return false;
  const arrived = Date.parse(r.receivedAt || "") || now;
  return (now - arrived) / 60_000 <= STALE_MIN;
}

function waitedMin(r: InboxEnquiry, now: number): number {
  const arrived = Date.parse(r.receivedAt || "") || now;
  return Math.max(0, Math.floor((now - arrived) / 60_000));
}

export function workBarState(rows: InboxEnquiry[], now: number = Date.now()): WorkBarState | null {
  const waiting = rows.filter((r) => isWaiting(r, now));
  if (!waiting.length) return null;
  // The one to do first: the soonest reply-by, then the one waiting longest.
  const next = [...waiting].sort((a, b) => replyBy(a, now).at - replyBy(b, now).at || waitedMin(b, now) - waitedMin(a, now))[0];
  const min = waitedMin(next, now);
  const past = urgencyOf(replyBy(next, now).at, now) === "past";
  const tone: "amber" | "red" = min >= RED_AFTER_MIN || past ? "red" : "amber";
  const what = next.tag === "escalation" ? "Problem on a shipment" : senderDisplay(next.from);
  const wait = min < 1 ? "just arrived" : `nobody has opened it for ${min} minute${min === 1 ? "" : "s"}`;
  const more = waiting.length - 1;
  return {
    tone,
    id: next.id,
    count: waiting.length,
    more,
    headline: `Next: ${what}, ${String(next.subject || "(no subject)").slice(0, 70)}`,
    detail: `${wait}${past && min < RED_AFTER_MIN ? " · past its reply time" : ""}${more ? ` · ${more} more waiting` : ""}`,
  };
}

/** The browser tab's title with the count in front, "(2) Atlas Pricing"; the plain title when nothing waits. */
export function tabTitle(base: string, count: number): string {
  return count > 0 ? `(${count}) ${base}` : base;
}
