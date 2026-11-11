/**
 * The directory of email addresses our people deal with (see functions/inbox-directory.js). Plain helpers for the Admin screen and for
 * the desks, which use it to suggest how to ask a carrier for a rate.
 */
export const CONTACT_TYPES = ["airline", "liner", "nvocc", "transporter", "overseas-agent", "exporter", "importer", "trader", "warehouser", "customer", "other", "unknown"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  airline: "Airline",
  liner: "Liner",
  nvocc: "NVOCC",
  transporter: "Transporter",
  "overseas-agent": "Overseas agent",
  exporter: "Exporter",
  importer: "Importer",
  trader: "Trader",
  warehouser: "Warehouser",
  customer: "Customer",
  other: "Other",
  unknown: "Not sorted yet",
};

export type RateSource = "" | "tariff" | "portal" | "email";
export const RATE_SOURCE_LABELS: Record<RateSource, string> = { "": "Not set", tariff: "Tariff on file", portal: "Online portal", email: "Ask by email" };

export interface EmailContact {
  id: string;
  email: string;
  name: string;
  domain: string;
  type: ContactType;
  /** "rules" (a known airline or liner), "guess" (from the name), "admin" (set by hand), "none". */
  typeSource: string;
  org: string;
  carrierCode: string;
  rateSource: RateSource;
  mailboxes: string[];
  count: number;
  firstSeen: number;
  lastSeen: number;
  note: string;
}

export function filterContacts(rows: EmailContact[], opts: { type?: ContactType | "all"; text?: string }): EmailContact[] {
  const q = (opts.text || "").trim().toLowerCase();
  return rows.filter((r) => {
    if (opts.type && opts.type !== "all" && r.type !== opts.type) return false;
    if (!q) return true;
    return [r.email, r.name, r.org, r.carrierCode, r.domain].some((x) => String(x || "").toLowerCase().includes(q));
  });
}

export function countByType(rows: EmailContact[]): Record<ContactType | "all", number> {
  const out = { all: rows.length } as Record<ContactType | "all", number>;
  for (const t of CONTACT_TYPES) out[t] = 0;
  for (const r of rows) out[r.type] = (out[r.type] ?? 0) + 1;
  return out;
}

/**
 * How to ask this carrier for a rate: the contact addresses the directory holds for it (airlines and liners), found by carrier code or
 * by the carrier's name. Used on the desks: "Ask by email: rates@..." or "Online portal".
 */
export function contactsForCarrier(rows: EmailContact[], carrier: { code?: string; name?: string }): EmailContact[] {
  const code = (carrier.code || "").trim().toUpperCase();
  const name = (carrier.name || "").trim().toLowerCase();
  return rows.filter((r) => (r.type === "airline" || r.type === "liner" || r.type === "nvocc") && ((code && r.carrierCode === code) || (name.length >= 3 && (r.org.toLowerCase().includes(name) || name.includes(r.org.toLowerCase()) && r.org.length >= 3))));
}

export function suggestRateSource(contacts: EmailContact[]): { source: RateSource; emails: string[] } {
  const set = contacts.find((c) => c.rateSource);
  const emails = contacts.map((c) => c.email).slice(0, 3);
  if (set) return { source: set.rateSource, emails };
  return { source: emails.length ? "email" : "", emails };
}
