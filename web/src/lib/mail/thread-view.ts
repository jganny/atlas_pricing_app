/**
 * How a conversation is shown: the labels, the plain-language reason a mail was tied in, and the times. Pure, so it is tested.
 */
export type ThreadRole = "enquiry" | "sent" | "reply";

export interface ThreadMember {
  kind: "card" | "sent";
  id: string;
  role: ThreadRole;
  at: number;
  who: string;
  email: string;
  to?: Array<{ email: string; name: string }>;
  cc?: Array<{ email: string; name: string }>;
  subject: string;
  attachments: number;
  by: string;
  /** The rules were not certain (two enquiries fitted): a person is asked to confirm. */
  check: boolean;
  reason: string;
}

export interface ThreadVendor {
  email: string;
  name: string;
  replied: boolean;
}

export interface ThreadView {
  rootId: string | null;
  members: ThreadMember[];
  vendors: ThreadVendor[];
  gone?: boolean;
}

export const EMPTY_THREAD: ThreadView = { rootId: null, members: [], vendors: [] };

/** One line for a member: who it is from or who it went to. */
export function memberTitle(m: ThreadMember): string {
  if (m.role === "enquiry") return "Enquiry received";
  if (m.role === "reply") return `Reply from ${m.who || m.email || "someone"}`;
  const names = (m.to ?? []).map((t) => t.name || t.email).filter(Boolean);
  if (!names.length) return "Sent on from Outlook";
  return names.length === 1 ? `Sent to ${names[0]}` : `Sent to ${names[0]} and ${names.length - 1} more`;
}

/** The people asked, and how many have answered: "1 of 3 vendors have replied", or "" when nobody was asked. */
export function vendorSummary(vendors: ThreadVendor[]): string {
  if (!vendors.length) return "";
  const replied = vendors.filter((v) => v.replied).length;
  if (replied === vendors.length) return vendors.length === 1 ? "The vendor has replied" : `All ${vendors.length} have replied`;
  return `${replied} of ${vendors.length} ${vendors.length === 1 ? "vendor has" : "vendors have"} replied`;
}

/** Emails that are part of the conversation besides the enquiry itself. */
export const linkedCount = (t: ThreadView): number => t.members.filter((m) => m.role !== "enquiry").length;

/** "11 Nov, 10:58" in the viewer's own clock. */
export function whenText(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** The short reason chip: "Linked automatically" for rules, "Linked by hand" for a person. */
export function linkLabel(by: string): string {
  if (!by || by === "self") return "";
  if (by === "manual") return "Linked by hand";
  return "Linked automatically";
}
