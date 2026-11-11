import { activeSeatForLogin, isDisplacedLogin, occupantLoginForSeat, type DeskSeatId } from "@/lib/auth/desk-seats";
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

/** Which desk seats read each shared mailbox — whoever sits in them gets the mail. */
const MAILBOX_SEATS: Record<"pricing" | "pricingsales", DeskSeatId[]> = {
  pricing: ["air-nom", "sea-nom"],
  pricingsales: ["freehand", "nrs"],
};

export function assignInboxUsers(
  mailbox: InboxMailboxKey,
  mode: InboxEnquiry["mode"],
): { assignedUsers: string[]; suggestedUser: string | null } {
  if (mailbox === "pricing") {
    // Routed to the desk seat's current holder, not a fixed person.
    if (mode === "air") {
      const u = occupantLoginForSeat("air-nom");
      return { assignedUsers: [u], suggestedUser: u };
    }
    if (mode === "sea") {
      const u = occupantLoginForSeat("sea-nom");
      return { assignedUsers: [u], suggestedUser: u };
    }
    return { assignedUsers: MAILBOX_SEATS.pricing.map(occupantLoginForSeat), suggestedUser: null };
  }
  // Free Hand + NRS share pricingsales until someone claims the row.
  return { assignedUsers: MAILBOX_SEATS.pricingsales.map(occupantLoginForSeat), suggestedUser: null };
}

/**
 * While the Sea Nom seat is vacant, sea enquiries that arrive on pricing@ are also seen (and alerted) by NRS and Free Hand, who quote them.
 * Set to [] when the seat is filled. The same list is `seaCover` in functions/inbox-alerts.js.
 */
export const SEA_COVER_SEATS: DeskSeatId[] = ["nrs", "freehand"];
export const SEA_COVER_LOGINS = ["jabeena", "cathrina"];

export function canSeeInboxItem(
  username: string | undefined,
  role: string | undefined,
  item: InboxEnquiry,
  /** The person's own email address: someone who was copied on the email can see it, even from the other team. */
  email?: string,
): boolean {
  if (isAdminUser(username, role)) return true;
  const u = (username || "").toLowerCase();
  if (!u) return false;
  const mail = (email || "").toLowerCase();
  if (mail && (item.copiedAddresses || []).includes(mail)) return true;
  if (item.claimedBy && item.claimedBy === u) return true;
  if (item.assignedUsers.map((x) => x.toLowerCase()).includes(u)) return true;
  const seat = activeSeatForLogin(u)?.id;
  if (item.mailbox === "pricing" && item.mode === "sea" && ((seat && SEA_COVER_SEATS.includes(seat)) || SEA_COVER_LOGINS.includes(u))) return true;
  if (seat && item.mailbox === "pricing" && MAILBOX_SEATS.pricing.includes(seat)) return true;
  if (seat && item.mailbox === "pricingsales" && MAILBOX_SEATS.pricingsales.includes(seat)) return true;
  if (isDisplacedLogin(u)) return false;
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
