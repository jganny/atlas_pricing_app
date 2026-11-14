/**
 * The folders of the Inbox. They are filters, not copies: an email is stored once and shows in every folder it belongs to.
 * Every list is ordered by the time a reply is due (see reply-by.ts), soonest first.
 */
import type { InboxEnquiry } from "@/lib/types";
import { replyBy, urgencyOf } from "./reply-by";
import { workState } from "./inbox-working";
import { labelsOf, LABEL_NAMES, type LabelKey } from "./inbox-labels";
import { isRateEnquiryToQuote } from "./rate-enquiry";

export type ViewKey =
  | "all" | "mine" | "others" | "due" | "past" | "followup" | "escalation"
  | "air" | "sea" | "mb:pricing" | "mb:pricingsales"
  | "label:dg" | "label:pharma" | "label:perishable" | "label:deadline" | "label:attachment";

export const VIEW_LABELS: Record<ViewKey, string> = {
  all: "All open",
  mine: "I am quoting",
  others: "Others are quoting",
  due: "Due within the hour",
  past: "Past its time",
  followup: "Follow-ups",
  escalation: "Escalations and discrepancies",
  air: "Air",
  sea: "Sea",
  "mb:pricing": "pricing@",
  "mb:pricingsales": "pricingsales@",
  "label:dg": LABEL_NAMES.dg,
  "label:pharma": LABEL_NAMES.pharma,
  "label:perishable": LABEL_NAMES.perishable,
  "label:deadline": LABEL_NAMES.deadline,
  "label:attachment": LABEL_NAMES.attachment,
};

/** A new enquiry, one somebody has claimed, or one a desk has been opened on (it stays until its quote is saved, then it leaves the list). */
export const isOpenItem = (r: Pick<InboxEnquiry, "status" | "workingBy">): boolean =>
  r.status === "new" || r.status === "claimed" || (r.status === "applied" && !!r.workingBy);

export function inView(r: InboxEnquiry, view: ViewKey, me: string | undefined | null, now: number): boolean {
  if (!isOpenItem(r)) return false;
  // A problem raised on a shipment is not an enquiry to quote: it lives in its own folder (and in its mailbox's folder).
  const problem = r.tag === "escalation";
  if (view === "escalation") return problem;
  if (problem && !view.startsWith("mb:")) return false;
  if (view.startsWith("label:")) return labelsOf(r).includes(view.slice(6) as LabelKey);
  switch (view) {
    case "all":
      return true;
    case "mine": {
      const k = workState(r, me, now).kind;
      return k === "mine" || k === "incoming";
    }
    case "others": {
      const k = workState(r, me, now).kind;
      return k === "other" || k === "asked" || k === "can-take";
    }
    case "due":
      return isRateEnquiryToQuote(r) && !r.repliedAt && urgencyOf(replyBy(r, now).at, now) === "soon";
    case "past":
      return isRateEnquiryToQuote(r) && !r.repliedAt && urgencyOf(replyBy(r, now).at, now) === "past";
    case "followup":
      return r.tag === "follow_up";
    case "air":
      return r.mode === "air";
    case "sea":
      return r.mode === "sea";
    case "mb:pricing":
      return r.mailbox === "pricing";
    case "mb:pricingsales":
      return r.mailbox === "pricingsales";
    default:
      return false;
  }
}

/** The enquiries of a folder, soonest reply-by first. */
export function listView(rows: InboxEnquiry[], view: ViewKey, me: string | undefined | null, now: number = Date.now()): InboxEnquiry[] {
  return rows
    .filter((r) => inView(r, view, me, now))
    .map((r) => ({ r, at: replyBy(r, now).at, arrived: Date.parse(r.receivedAt || "") || 0 }))
    .sort((a, b) => a.at - b.at || a.arrived - b.arrived)
    .map((x) => x.r);
}

export function viewCounts(rows: InboxEnquiry[], me: string | undefined | null, now: number = Date.now()): Record<ViewKey, number> {
  const out = {} as Record<ViewKey, number>;
  for (const k of Object.keys(VIEW_LABELS) as ViewKey[]) out[k] = rows.filter((r) => inView(r, k, me, now)).length;
  return out;
}

/** "Takeshi Yamada <t@x.co.jp>" -> "Takeshi Yamada". With no name, the company part of the address, never the whole address. */
export function senderDisplay(from: string | undefined | null): string {
  const raw = String(from || "").trim();
  const m = /^(.*?)\s*<([^>]+)>\s*$/.exec(raw);
  const name = (m ? m[1] : "").replace(/^"|"$/g, "").trim();
  if (name && !name.includes("@")) return name;
  const email = (m ? m[2] : raw).trim();
  const domain = (email.split("@")[1] || "").toLowerCase().split(".");
  const generic = new Set(["gmail", "yahoo", "outlook", "hotmail", "icloud", "proton", "protonmail", "live", "rediffmail", "aol"]);
  const label = domain.length >= 2 ? domain[domain.length - 2] : domain[0] || "";
  const company = ["co", "com", "net", "org", "gov", "ac", "ltd"].includes(label) && domain.length >= 3 ? domain[domain.length - 3] : label;
  if (company && !generic.has(company)) return company.charAt(0).toUpperCase() + company.slice(1);
  const local = (email.split("@")[0] || "").replace(/[._\d]+/g, " ").trim();
  return local ? local.replace(/\b\w/g, (c) => c.toUpperCase()) : "Unknown sender";
}
