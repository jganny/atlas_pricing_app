import { ATLAS_IMAP, MAILBOX_TEAMS, isAdminUser } from "@/lib/quotes/team-roles";
import type { InboxEnquiry, InboxMailboxKey, ParsedEnquiry } from "@/lib/types";

export { ATLAS_IMAP };

export function detectEnquiryMode(text: string): "air" | "sea" | "unknown" {
  const t = text.toLowerCase();
  const seaHits =
    /\b(fcl|lcl|container|cbm|teu|liner|maersk|msc|cma|innsa|nlrtm|un.?locode)\b/i.test(text) ||
    /\b[A-Z]{2}[A-Z]{3}\b/.test(text) && /\b(pol|pod|port)\b/i.test(text);
  const airHits =
    /\b(air|awb|airline|kg|kgs|cwt|emirates|qatar|blr|lhr|dxb)\b/i.test(t) ||
    /\bpol\b[:\s]*[A-Z]{3}\b/i.test(text);

  if (seaHits && !airHits) return "sea";
  if (airHits && !seaHits) return "air";
  if (seaHits && airHits) {
    if (/\b(fcl|lcl|container)\b/i.test(text)) return "sea";
    return "air";
  }
  return "unknown";
}

export function assignInboxUsers(
  mailbox: InboxMailboxKey,
  mode: InboxEnquiry["mode"],
): { assignedUsers: string[]; suggestedUser: string | null } {
  if (mailbox === "pricing") {
    if (mode === "air") return { assignedUsers: ["shashank"], suggestedUser: "shashank" };
    if (mode === "sea") return { assignedUsers: ["shaheer"], suggestedUser: "shaheer" };
    return { assignedUsers: [...MAILBOX_TEAMS.pricing.users], suggestedUser: null };
  }
  // Free Hand + NRS share pricingsales until someone claims the row.
  return { assignedUsers: [...MAILBOX_TEAMS.pricingsales.users], suggestedUser: null };
}

export function canSeeInboxItem(
  username: string | undefined,
  role: string | undefined,
  item: InboxEnquiry,
): boolean {
  if (isAdminUser(username, role)) return true;
  const u = (username || "").toLowerCase();
  if (!u) return false;
  if (item.claimedBy && item.claimedBy === u) return true;
  if (item.assignedUsers.map((x) => x.toLowerCase()).includes(u)) return true;
  if ((MAILBOX_TEAMS.pricing.users as readonly string[]).includes(u) && item.mailbox === "pricing") {
    return true;
  }
  if (
    (MAILBOX_TEAMS.pricingsales.users as readonly string[]).includes(u) &&
    item.mailbox === "pricingsales"
  ) {
    return true;
  }
  return false;
}

export function parsedFromInbox(item: InboxEnquiry): ParsedEnquiry {
  if (item.parsed?.origin || item.parsed?.customer) return item.parsed;
  return {
    customer: "",
    origin: "",
    destination: "",
    packages: [],
    containers: [],
    confidence: item.confidence || 0,
    source: "email-imap",
  };
}
