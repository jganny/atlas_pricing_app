/**
 * Who sent this mail to whom, who it is written to, and whose enquiry it continues.
 * The reading pane shows this in plain language so a continuation is never anonymous.
 */
import { DESK_SEATS } from "@/lib/auth/desk-seats";
import { deskDisplayName, TEAM_ROLES } from "@/lib/quotes/team-roles";
import { greetingName, isOwnFrom, isQuoteDelivered } from "./rate-enquiry";

/** Shared desk logins (Air Nom, Free Hand, NRS, …) are not a salesperson whose enquiry this is. */
const DESK_LOGINS = new Set([
  ...DESK_SEATS.flatMap((s) => s.defaultLoginIds),
  // Shared mailbox desks that may not sit in DESK_SEATS defaults on every build.
  "jabeena",
  "pricing",
]);

export interface MailIdentity {
  fromName: string;
  fromEmail: string;
  toLine: string;
  writtenTo: string;
  internal: boolean;
  quoteShare: boolean;
  salespersonName: string;
  salespersonLogin: string;
}

export interface ThreadOriginIdentity {
  id?: string;
  from?: string;
  fromName?: string;
  fromEmail?: string;
  mailbox?: string;
  mailboxEmail?: string;
  receivedAt?: string;
  repliedAt?: number;
  assignedUsers?: string[];
  addressedTo?: string;
  toAddresses?: string[];
  subject?: string;
}

function addrOf(from: string | undefined | null): string {
  return ((/<([^>]+)>/.exec(String(from || "")) || [])[1] || String(from || "")).trim().toLowerCase();
}

function displayName(from: string | undefined | null): string {
  const raw = String(from || "").trim();
  const m = /^(.*?)\s*<([^>]+)>\s*$/.exec(raw);
  const name = (m ? m[1] : "").replace(/^"|"$/g, "").trim();
  if (name && !name.includes("@")) return name;
  const email = (m ? m[2] : raw).trim();
  const host = (email.split("@")[1] || "").toLowerCase();
  const parts = host.split(".");
  const label = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || "";
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : email || "Unknown sender";
}

function firstEmail(from: string | undefined | null): string {
  const e = addrOf(from);
  return e.includes("@") ? e : "";
}

export function salespersonFromLogin(login: string | undefined | null): { login: string; name: string } | null {
  const key = String(login || "").toLowerCase().trim();
  if (!key || !TEAM_ROLES[key] || DESK_LOGINS.has(key)) return null;
  return { login: key, name: deskDisplayName(key) };
}

/** A named salesperson (Linson, Sunil, …), not the shared quoting desk. */
export function salespersonOf(row: {
  assignedUsers?: string[];
  addressedTo?: string;
  bodyPreview?: string;
  body?: string;
  from?: string;
}): { login: string; name: string } | null {
  for (const u of row.assignedUsers || []) {
    const hit = salespersonFromLogin(u);
    if (hit) return hit;
  }
  const hay = `${row.addressedTo || ""} ${row.bodyPreview || ""} ${row.body || ""} ${row.from || ""}`;
  const lower = hay.toLowerCase();
  for (const login of Object.keys(TEAM_ROLES)) {
    if (DESK_LOGINS.has(login)) continue;
    const name = deskDisplayName(login);
    const first = name.split(/\s+/)[0] || "";
    if (first.length >= 3 && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(hay)) {
      return { login, name };
    }
    if (new RegExp(`\\b${login}\\b`, "i").test(lower)) return { login, name };
  }
  return null;
}

export function mailIdentity(row: {
  from?: string;
  mailboxEmail?: string;
  mailbox?: string;
  copiedAddresses?: string[];
  toAddresses?: string[];
  addressedTo?: string;
  bodyPreview?: string;
  body?: string;
  subject?: string;
  assignedUsers?: string[];
}): MailIdentity {
  const fromEmailAddr = firstEmail(row.from);
  const fromName = displayName(row.from) || fromEmailAddr || "Unknown sender";
  const to = (row.toAddresses || []).map((x) => String(x || "").trim()).filter(Boolean);
  const toLine = to.length ? to.join(", ") : row.mailboxEmail || row.mailbox || "";
  const writtenTo = (row.addressedTo || "").trim() || greetingName(row.bodyPreview || row.body || "");
  const sales = salespersonOf(row);
  return {
    fromName,
    fromEmail: fromEmailAddr,
    toLine,
    writtenTo,
    internal: isOwnFrom(row.from),
    quoteShare: isQuoteDelivered(row.subject || "", `${row.bodyPreview || ""} ${row.body || ""}`),
    salespersonName: sales?.name || "",
    salespersonLogin: sales?.login || "",
  };
}

export interface IdentityLine {
  label: string;
  value: string;
}

/**
 * Lines for the reading pane. Always names who sent it and who received it.
 * When this mail continues someone else's enquiry, that original is named too.
 */
export function identityLines(
  row: Parameters<typeof mailIdentity>[0] & { receivedAt?: string; repliedAt?: number },
  origin?: ThreadOriginIdentity | null,
): IdentityLine[] {
  const me = mailIdentity(row);
  const lines: IdentityLine[] = [];
  const fromBit = me.fromEmail && !me.fromName.toLowerCase().includes(me.fromEmail) ? `${me.fromName} <${me.fromEmail}>` : me.fromName || me.fromEmail;
  lines.push({ label: "From", value: fromBit || "unknown" });
  if (me.toLine) lines.push({ label: "To", value: me.toLine });
  if (me.writtenTo) lines.push({ label: "Written to", value: me.writtenTo });
  if (me.internal && me.quoteShare) lines.push({ label: "Kind", value: "Internal Atlas quote — not a customer asking for rates" });
  else if (me.internal) lines.push({ label: "Kind", value: "Internal Atlas mail" });

  const originSales = origin ? salespersonOf(origin) : null;
  const sales = originSales || (me.salespersonName ? { name: me.salespersonName, login: me.salespersonLogin } : null);
  if (origin && (origin.from || origin.fromName || origin.fromEmail)) {
    const oName = origin.fromName || displayName(origin.from) || "";
    const oEmail = origin.fromEmail || firstEmail(origin.from);
    const oFrom = oEmail && oName && !oName.toLowerCase().includes(oEmail) ? `${oName} <${oEmail}>` : oName || oEmail;
    const oTo = (origin.toAddresses || []).join(", ") || origin.mailboxEmail || origin.mailbox || "";
    const whose = sales ? `${sales.name}'s enquiry` : "the original enquiry";
    lines.push({ label: "Relates to", value: `${whose} from ${oFrom || "the customer"}${oTo ? ` to ${oTo}` : ""}` });
    if (origin.repliedAt) lines.push({ label: "Original", value: "Has a reply" });
  } else if (sales) {
    lines.push({ label: "Relates to", value: `${sales.name}'s enquiry` });
  }
  return lines;
}
