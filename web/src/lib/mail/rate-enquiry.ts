/**
 * What is a rate enquiry vs a follow-up. Re: subjects keep the old RFQ title;
 * that does not make the new mail a quote request. A GSA / agent sending us
 * their rates is not a customer asking us to quote.
 */

const REPLY_PREFIX = /^(re|fw|fwd)\s*:/i;
const ASK =
  /\b(please quote|kindly quote|pls quote|quote (?:me|us|for|the)|rate request|rfq|need rates?|offer rates?|pricing request|quotation|new inquir(?:y|ies)|kindly offer|offer best rate)\b/i;
const ASK_SHORT =
  /(\b(?:please|pls|plz|kindly|can you|could you|request(?:ing)?|need|require|looking for|share|send|provide|advise|revert|let (?:me|us) know)\b[^.\n]{0,60}\b(?:rates?|quote|quotation|price|pricing|offer|freight)\b|\b(?:rfq|quote please|rates please|rate request|new inquir(?:y|ies))\b|\b(?:please|kindly|pls) give us\b[^.\n]{0,80}\b(?:rate|quote|offer|ex[- ]?works|exw|air import|sea import|freight)\b|\bkindly revert with your best offer\b)/im;
const OPS_FOLLOWUP =
  /\b(booking confirm|confirmed booking|we confirm|pls proceed|please proceed|kindly proceed|pre-?alert|shipping instruction|\bsi attached\b|\bhbl\b|\bmbl\b|house bl|awb (?:no|number|issued|stock)|shipper details|consignee details|please (?:share|send|advise) (?:the )?(?:shipper|consignee|hbl|mbl|si|bl)|cargo received|stuffed|sailed|gate[- ]?in|\bvgm\b|nomination (?:received|confirmed)|shipping address|origin charges|egm(?:\s+(?:number|no|details|filed))?|still not moved|has not moved|paid all origin|vessel and schedule changed)\b/i;
/** GSA / overseas agent / liner sending Atlas their sell or buy rates. */
const VENDOR_OFFER =
  /\b(?:(?:please|pls|plz|kindly) find(?:\s+below)?(?:\s+\w+){0,3}\s+our (?:revised |best |latest )?(?:freight )?rates?|(?:please find below|pls find) our|our (?:revised |best |latest )?(?:freight )?rates?(?:\s+for)?|rate offer(?: with)?|we can offer|pleased to offer|revised rates? for|our freight rates|please find attached our (?:rate|offer|quotation)|as follows(?:\s+our)?\s+(?:rates?|freight))\b/i;
const CUSTOMER_ASK =
  /\b(please quote|kindly quote|pls quote|quote (?:me|us|for|the)|kindly offer|offer best rate|share (?:the )?rates?|need rates?|rate request|rfq|new inquir(?:y|ies)|kindly revert with your best offer|please give us)\b/i;
/** Someone is sending a quote — not asking us to price. */
const QUOTE_DELIVERED =
  /\b(?:(?:please|pls|plz|kindly)\s+find(?:\s+\w+){0,8}?\s+(?:the\s+)?(?:below\s+)?(?:our\s+)?(?:quote|quotation|rates?)|find below (?:the )?(?:quote|quotation|rates?)|quoted as follows|please find attached (?:the )?(?:quote|quotation)|pls find below quote)\b/i;
const STRONG_ASK =
  /\b(please quote|kindly quote|pls quote|rate request|rfq|need rates?|new inquir(?:y|ies)|kindly revert with your best offer)\b/i;
const OWN_HOST = /(^|\.)atlaslogistics\.co\.in$|(^|\.)atlaspricing\.com$/i;

export function isReplySubject(subject: string | undefined | null): boolean {
  return REPLY_PREFIX.test(String(subject || "").trim());
}

function latestText(subject: string, text: string): string {
  const t = String(text || "");
  if (/^\s*(fw|fwd)\s*:/i.test(String(subject || ""))) return t;
  const cut = t.search(
    /^\s*(?:On .{5,160} wrote:|-{2,}\s*Original Message\s*-{2,}|_{8,}|From:\s.{0,160}[\r\n]+\s*(?:Sent|Date):|From:\s.{0,120}\r?\n\s*Sent:)/im,
  );
  const head = cut > 0 ? t.slice(0, cut) : t;
  return head
    .split(/\r?\n/)
    .filter((l) => !/^\s*>/.test(l))
    .join("\n");
}

function workingText(subject: string, body: string): string {
  const latest = latestText(subject, body);
  return isReplySubject(subject) ? latest : `${subject}\n${latest}`;
}

function emailOfFrom(from: string | undefined | null): string {
  return ((/<([^>]+)>/.exec(String(from || "")) || [])[1] || String(from || "")).trim().toLowerCase();
}

/** A colleague or a shared Atlas mailbox — never a customer RFQ on the pending clock. */
export function isOwnFrom(from: string | undefined | null): boolean {
  const email = emailOfFrom(from);
  const host = email.split("@")[1] || "";
  if (host && OWN_HOST.test(host)) return true;
  const name = String(from || "").replace(/<[^>]*>/g, "").replace(/["]/g, "").trim();
  return /\batlas\s*logistics\b/i.test(name);
}

/** "Dear Awwab" / "Hi Linson," — who the mail is written to. */
export function greetingName(text: string | undefined | null): string {
  const m = String(text || "").match(/^\s*(?:dear|hi|hello|good\s+(?:morning|afternoon|evening)|attn(?:ention)?\.?:?)\s+([A-Za-z][A-Za-z.'-]{1,40})/im);
  return m ? m[1].replace(/[.,;:]+$/, "") : "";
}

/** Atlas (or a colleague) sending a quote, not a customer asking for one. */
export function isQuoteDelivered(subject: string, body: string): boolean {
  const text = workingText(subject, body);
  if (!QUOTE_DELIVERED.test(text)) return false;
  if (STRONG_ASK.test(text)) return false;
  return true;
}

/** True when the NEW part of the mail is asking for rates. Inherited "RFQ" in a Re: subject does not count. */
export function askedForQuote(subject: string, body: string): boolean {
  const latest = latestText(subject, body);
  if (isQuoteDelivered(subject, body)) return false;
  if (isReplySubject(subject)) return ASK.test(latest) || ASK_SHORT.test(latest);
  const text = `${subject}\n${latest}`;
  return ASK.test(text) || ASK_SHORT.test(text);
}

export function isOpsFollowUp(subject: string, body: string): boolean {
  return OPS_FOLLOWUP.test(workingText(subject, body));
}

/** A vendor sending us a rate sheet — not a customer RFQ. */
export function isVendorRateOffer(subject: string, body: string): boolean {
  const text = workingText(subject, body);
  if (!VENDOR_OFFER.test(text)) return false;
  if (CUSTOMER_ASK.test(text)) return false;
  return true;
}

/**
 * Home / work bar / Due / Past / "Xh late": only a real unanswered customer or
 * overseas-agent RFQ waits as an enquiry. Internal Atlas quote-shares, vendor
 * offers, ops Re: threads and already-replied mail do not.
 */
export function isRateEnquiryToQuote(row: {
  tag?: string;
  from?: string;
  subject?: string;
  bodyPreview?: string;
  body?: string;
  summary?: string;
  repliedAt?: number;
  actionRequired?: boolean;
}): boolean {
  if (row.tag === "follow_up" || row.tag === "noise") return false;
  if (row.tag === "escalation") return true;
  if (row.tag === "needs_human") return false;
  if (row.repliedAt || row.actionRequired === false) return false;
  const subject = row.subject || "";
  const body = `${row.bodyPreview || ""} ${row.body || ""} ${row.summary || ""}`;
  if (isOwnFrom(row.from) || isQuoteDelivered(subject, body)) return false;
  // Re: + consignee / HBL / booking is ops even if the old title still says RFQ.
  if (isReplySubject(subject) && isOpsFollowUp(subject, body)) return false;
  if (isVendorRateOffer(subject, body)) return false;
  if (isOpsFollowUp(subject, body) && !askedForQuote(subject, body)) return false;
  if (askedForQuote(subject, body)) return true;
  if (isReplySubject(subject) && !askedForQuote(subject, body)) return false;
  if (row.tag === "new_enquiry") return true;
  return false;
}
