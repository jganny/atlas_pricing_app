/**
 * The team board: per shared mailbox, how many enquiries are open, how many are late, who is quoting what, and who has waited longest.
 * For a second screen or a wall TV, and for the Manager's "Needs attention" card on Home. Fixed rules, no AI credit.
 */
import type { InboxEnquiry } from "@/lib/types";
import { replyBy, urgencyOf } from "./reply-by";
import { isOpenItem, senderDisplay } from "./inbox-views";
import { isWaiting } from "./work-bar";

export interface BoardLine {
  id: string;
  who: string;
  subject: string;
  /** Minutes since it arrived. */
  waitedMin: number;
  /** Who has a desk open on it, when anyone does. */
  quoting?: string;
  late: boolean;
}

export interface BoardMailbox {
  mailbox: "pricing" | "pricingsales";
  label: string;
  open: number;
  late: number;
  waiting: number;
  quoting: number;
  lines: BoardLine[];
}

const LABELS = { pricing: "pricing@", pricingsales: "pricingsales@" } as const;

export function teamBoard(rows: InboxEnquiry[], now: number = Date.now()): BoardMailbox[] {
  return (["pricing", "pricingsales"] as const).map((mailbox) => {
    const mine = rows.filter((r) => r.mailbox === mailbox && isOpenItem(r) && r.tag !== "follow_up");
    const lines: BoardLine[] = mine
      .map((r) => {
        const arrived = Date.parse(r.receivedAt || "") || now;
        return {
          id: r.id,
          who: senderDisplay(r.from),
          subject: String(r.subject || "(no subject)").slice(0, 70),
          waitedMin: Math.max(0, Math.floor((now - arrived) / 60_000)),
          quoting: r.workingBy?.name,
          late: !r.repliedAt && urgencyOf(replyBy(r, now).at, now) === "past",
        };
      })
      // Late first, then the longest waiting.
      .sort((a, b) => Number(b.late) - Number(a.late) || b.waitedMin - a.waitedMin);
    return {
      mailbox,
      label: LABELS[mailbox],
      open: mine.length,
      late: lines.filter((l) => l.late).length,
      waiting: mine.filter((r) => isWaiting(r, now)).length,
      quoting: mine.filter((r) => r.workingBy).length,
      lines: lines.slice(0, 8),
    };
  });
}

export const waitedText = (min: number): string => (min < 1 ? "just arrived" : min < 60 ? `${min} min` : min < 24 * 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${Math.floor(min / 1440)} d`);
