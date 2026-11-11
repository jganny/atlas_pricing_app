/**
 * When must an enquiry be answered?
 *   1. If the email states its own deadline ("by 3 pm IST", "before 15:00 JST", "within 2 hours"), that is the time.
 *   2. Otherwise the sender's office closes at 18:00 in their time zone, so a Tokyo enquiry is due before a Bangkok or an Indian one.
 * The sender's zone comes from the Date header of the email (exact), else the country of the sender's address, else India.
 * Fixed rules only: no AI credit. Weekends: an office is treated as closed on Sunday, so a Sunday close moves to Monday.
 */
export interface SenderZone {
  abbr: string;
  offsetMin: number;
  city: string;
}

const Z = (abbr: string, offsetMin: number, city: string): SenderZone => ({ abbr, offsetMin, city });
const CET = Z("CET", 60, "Europe");

/** Country of the sender's address -> its usual clock in November. The Date header, when there is one, always wins. */
const TLD_ZONES: Record<string, SenderZone> = {
  in: Z("IST", 330, "India"), lk: Z("IST", 330, "Colombo"), bd: Z("BST", 360, "Dhaka"), pk: Z("PKT", 300, "Karachi"),
  jp: Z("JST", 540, "Tokyo"), kr: Z("KST", 540, "Seoul"), cn: Z("CST", 480, "China"), hk: Z("HKT", 480, "Hong Kong"), tw: Z("CST", 480, "Taipei"),
  sg: Z("SGT", 480, "Singapore"), my: Z("MYT", 480, "Kuala Lumpur"), th: Z("ICT", 420, "Bangkok"), vn: Z("ICT", 420, "Vietnam"), id: Z("WIB", 420, "Jakarta"), ph: Z("PHT", 480, "Manila"),
  ae: Z("GST", 240, "Dubai"), om: Z("GST", 240, "Muscat"), sa: Z("AST", 180, "Riyadh"), qa: Z("AST", 180, "Doha"), kw: Z("AST", 180, "Kuwait"), bh: Z("AST", 180, "Bahrain"),
  tr: Z("TRT", 180, "Istanbul"), eg: Z("EET", 120, "Cairo"), za: Z("SAST", 120, "Johannesburg"), ke: Z("EAT", 180, "Nairobi"), ng: Z("WAT", 60, "Lagos"),
  de: { ...CET, city: "Germany" }, fr: { ...CET, city: "France" }, nl: { ...CET, city: "Netherlands" }, be: { ...CET, city: "Belgium" }, it: { ...CET, city: "Italy" },
  es: { ...CET, city: "Spain" }, ch: { ...CET, city: "Switzerland" }, at: { ...CET, city: "Austria" }, se: { ...CET, city: "Sweden" }, dk: { ...CET, city: "Denmark" },
  no: { ...CET, city: "Norway" }, pl: { ...CET, city: "Poland" }, cz: { ...CET, city: "Prague" },
  uk: Z("GMT", 0, "London"), gb: Z("GMT", 0, "London"), ie: Z("GMT", 0, "Dublin"), pt: Z("WET", 0, "Lisbon"),
  us: Z("EST", -300, "United States"), ca: Z("EST", -300, "Canada"), mx: Z("CST", -360, "Mexico"), br: Z("BRT", -180, "Brazil"),
  au: Z("AEDT", 660, "Sydney"), nz: Z("NZDT", 780, "Auckland"),
};

export const OFFICE_ZONE: SenderZone = Z("IST", 330, "India");
export const OFFICE_CLOSE_HOUR = 18;

/** "+0900" or "-0500" at the end of a Date header -> minutes east of UTC. null when it has none. */
export function offsetFromDateHeader(header: string | undefined | null): number | null {
  const m = /([+-])(\d{2}):?(\d{2})\s*(?:\(.*\))?\s*$/.exec(String(header || "").trim());
  if (!m) return null;
  const mins = Number(m[2]) * 60 + Number(m[3]);
  if (mins > 14 * 60) return null;
  return m[1] === "-" ? -mins : mins;
}

const ABBR_OFFSETS: Record<string, number> = {
  IST: 330, JST: 540, KST: 540, SGT: 480, HKT: 480, ICT: 420, GST: 240, UTC: 0, GMT: 0, CET: 60, CEST: 120, EST: -300, EDT: -240, PST: -480, AEST: 600, AEDT: 660,
};

function nameOffset(offsetMin: number): string {
  const sign = offsetMin < 0 ? "-" : "+";
  const a = Math.abs(offsetMin);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, "0")}` : ""}`;
}

/** The sender's clock for an Inbox item: header offset, else the country of their address, else India. */
export function senderZone(item: { from?: string; senderTzMin?: number | null }): SenderZone {
  const email = /<([^>]+)>/.exec(item.from || "")?.[1] || item.from || "";
  const tld = (email.split("@")[1] || "").toLowerCase().split(".").pop() || "";
  const byCountry = TLD_ZONES[tld];
  if (typeof item.senderTzMin === "number" && Number.isFinite(item.senderTzMin)) {
    if (byCountry && byCountry.offsetMin === item.senderTzMin) return byCountry;
    const known = Object.values(TLD_ZONES).find((z) => z.offsetMin === item.senderTzMin);
    return known ? { ...known, city: byCountry?.city || known.city } : { abbr: nameOffset(item.senderTzMin), offsetMin: item.senderTzMin, city: byCountry?.city || "Sender" };
  }
  return byCountry || OFFICE_ZONE;
}

/** The first moment at or after `from` when it is 18:00 on a working day in a zone. */
export function officeCloseAfter(fromMs: number, offsetMin: number): number {
  const shift = offsetMin * 60_000;
  const local = new Date(fromMs + shift);
  let close = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), OFFICE_CLOSE_HOUR, 0, 0);
  if (fromMs + shift >= close) close += 24 * 3_600_000;
  if (new Date(close).getUTCDay() === 0) close += 24 * 3_600_000; // Sunday: closed
  return close - shift;
}

export interface ClientDeadline {
  at: number;
  label: string;
}

/** A deadline written in the email, or null. Needs a clear time ("3 pm", "15:00", "3 hrs") so "by 3 pallets" is never read as a time. */
export function parseClientDeadline(text: string, receivedMs: number, fallbackOffsetMin: number): ClientDeadline | null {
  const t = String(text || "").replace(/\s+/g, " ");
  const within = /\b(?:within|in)\s+(?:the next\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?)\b/i.exec(t);
  if (within && /\b(quote|rate|revert|reply|respond|send|let us know|get back|asap|urgent)/i.test(t)) {
    const n = Number(within[1]);
    const ms = /^h/i.test(within[2]) ? n * 3_600_000 : n * 60_000;
    if (ms > 0 && ms <= 72 * 3_600_000) return { at: receivedMs + ms, label: `within ${within[1]} ${/^h/i.test(within[2]) ? "h" : "min"}` };
  }
  const by = /\b(?:by|before|latest(?: by)?|no later than|until|till)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|hrs|h)?\s*(IST|JST|KST|SGT|HKT|ICT|GST|UTC|GMT|CEST|CET|EST|EDT|PST|AEST|AEDT)?\b/i.exec(t);
  if (by) {
    const hasClock = by[2] !== undefined || by[3] !== undefined || by[4] !== undefined;
    if (hasClock) {
      let h = Number(by[1]);
      const mi = by[2] ? Number(by[2]) : 0;
      const ap = (by[3] || "").toLowerCase();
      if (ap === "pm" && h < 12) h += 12;
      if (ap === "am" && h === 12) h = 0;
      if (h <= 23 && mi <= 59 && !(ap && Number(by[1]) > 12)) {
        const abbr = (by[4] || "").toUpperCase();
        const offset = abbr && abbr in ABBR_OFFSETS ? ABBR_OFFSETS[abbr] : fallbackOffsetMin;
        const shift = offset * 60_000;
        const local = new Date(receivedMs + shift);
        let at = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, mi, 0) - shift;
        if (at <= receivedMs) at += 24 * 3_600_000;
        return { at, label: `by ${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}${abbr ? ` ${abbr}` : ""}` };
      }
    }
  }
  return null;
}

export interface ReplyBy {
  at: number;
  basis: "client" | "office";
  /** "Client deadline" or "Tokyo closes". */
  basisLabel: string;
  zone: SenderZone;
  /** The time in the sender's clock, "18:00 JST". */
  localText: string;
}

function hhmm(ms: number, offsetMin: number): string {
  const d = new Date(ms + offsetMin * 60_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function replyBy(item: { from?: string; subject?: string; bodyPreview?: string; body?: string; receivedAt?: string; senderTzMin?: number | null }, now: number = Date.now()): ReplyBy {
  const zone = senderZone(item);
  const parsed = Date.parse(item.receivedAt || "");
  const received = Number.isFinite(parsed) ? parsed : now;
  const client = parseClientDeadline(`${item.subject || ""}. ${item.bodyPreview || item.body || ""}`, received, zone.offsetMin);
  if (client) return { at: client.at, basis: "client", basisLabel: "Client deadline", zone, localText: `${hhmm(client.at, zone.offsetMin)} ${zone.abbr}` };
  const at = officeCloseAfter(received, zone.offsetMin);
  return { at, basis: "office", basisLabel: `${zone.city} closes`, zone, localText: `${hhmm(at, zone.offsetMin)} ${zone.abbr}` };
}

export type Urgency = "past" | "soon" | "ok";
export const SOON_MINUTES = 60;

export function urgencyOf(at: number, now: number = Date.now()): Urgency {
  const left = at - now;
  if (left < 0) return "past";
  return left <= SOON_MINUTES * 60_000 ? "soon" : "ok";
}

/** "25 min", "1 h 25 min", "8 h", "2 d", or "2 h 05 min late". */
export function timeLeftText(at: number, now: number = Date.now()): string {
  const diff = at - now;
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  const text = min < 60 ? `${Math.max(min, 1)} min` : min < 60 * 24 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, "0")} min` : ""}` : `${Math.floor(min / (60 * 24))} d`;
  return diff < 0 ? `${text} late` : text;
}
