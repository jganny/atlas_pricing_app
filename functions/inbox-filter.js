/**
 * Which emails in the pricing mailboxes are worth looking at.
 *
 * 500+ emails arrive every day and most are not enquiries. This decides, with fixed rules and no AI credit, which ones are
 * clearly not (automatic mail, newsletters, bounces, notifications), which clearly are, and which are unclear:
 *
 *   noise   -> dropped, never stored, never sent to the AI
 *   sure    -> an enquiry (a quote request with a route and cargo): kept without asking the AI
 *   maybe   -> the AI is asked (a small, cheap model) to decide
 *
 * Everything here is pure so it can be tested.
 */

const SENDER_NOISE = /(?:^|[._\-+])(no[-_.]?reply|do[-_.]?not[-_.]?reply|donotreply|mailer[-_.]?daemon|postmaster|bounces?|notifications?|newsletter|news|marketing|mailer|alerts?|auto[-_.]?(?:reply|response)|system|robot|webmaster)(?:[._\-+]|\d*@)/i;

const SUBJECT_NOISE = /\b(out of office|automatic reply|auto[- ]?reply|autoreply|undeliverable|delivery (?:status|failure|notification)|mail delivery|returned mail|read receipt|^read:|^accepted:|^declined:|invitation:|newsletter|unsubscribe|webinar|you(?:'|’)ve been invited|password reset|verify your|security alert|payment receipt|order confirmation)\b/i;

const BODY_NOISE = /\b(to unsubscribe|click here to unsubscribe|view (?:this email )?in (?:your )?browser|you are receiving this (?:email|message) because|this is an automated (?:message|email)|do not reply to this (?:email|message))\b/i;

/** Signals that someone is asking for a price. */
const ASK = /\b(please quote|kindly quote|pls quote|quote (?:me|us|for|the)|rate request|rfq|need rates?|offer rates?|rates? (?:for|from|to)|best rates?|your (?:best )?rates?|pricing request|price (?:for|on)|quotation|enquiry|inquiry|freight (?:rates?|quote|charges)|ex[- ]?works|fob|cif|cfr|dap|ddp|rates? please|share (?:the )?rates?)\b/i;

/** Cargo words and figures. */
const CARGO = /(\b\d[\d,.]*\s?(?:kgs?|kilos?|cbm|cu\.?m|pcs|pieces|cartons?|ctns?|pallets?|boxes|packages?|pkgs?|tons?|tonnes?|mt)\b|\bfcl\b|\blcl\b|\b(?:20|40)\s?(?:'|’|ft|feet)?\s?(?:gp|hc|hq|ot|rf|fr)\b|\bcontainers?\b|\bair ?freight\b|\bsea ?freight\b|\bconsignment\b|\bgross weight\b|\bchargeable\b)/i;

/** A route: POL/POD words and "from X to Y" in any letter case; airport or port codes joined by a dash or "to" only in capitals. */
const ROUTE_WORDS = /(\b(?:pol|pod|origin|destination|port of (?:loading|discharge)|airport of (?:departure|destination))\b|\bfrom\s+[A-Za-z][A-Za-z .]{2,30}\s+to\s+[A-Za-z][A-Za-z .]{2,30})/i;
const ROUTE_CODES = /(\b[A-Z]{3}\s*(?:-|–|to|→|>|\/)\s*[A-Z]{3}\b|\b[A-Z]{5}\s*(?:-|–|to|→|>)\s*[A-Z]{5}\b)/;
const ROUTE = { test: (t) => ROUTE_WORDS.test(t) || ROUTE_CODES.test(t) };

/** A plain request for rates in few words: enough when the details are in an attachment. */
const ASK_SHORT = /(\b(?:please|pls|plz|kindly|can you|could you|request(?:ing)?|need|require|looking for|share|send|provide|advise|revert|let (?:me|us) know)\b[^.\n]{0,60}\b(?:rates?|quote|quotation|price|pricing|offer|freight|best)\b|\b(?:rfq|enquiry|inquiry|quote please|rates please|rate request|rates required|quote required)\b|^\W*(?:rates?|quote|quotation|price|pricing)\W*$)/im;

/** An attachment name that looks like an enquiry (for the case where nothing is written in the mail). */
const ENQUIRY_FILE = /(rfq|enquiry|inquiry|quotation request|rate request|packing[ _-]?list|\bpl\b|requirement|shipment details|cargo details)/i;

const OWN_NOISE_FILE = /\.(ics|vcf|p7s|asc|sig)$/i;

/** The attachments that could carry an enquiry: not calendar invites, signatures or small inline logos. */
function realAttachments(list) {
  return (Array.isArray(list) ? list : []).filter((a) => {
    const name = String((a && a.filename) || "");
    const type = String((a && a.contentType) || "").toLowerCase();
    const size = Number((a && a.size) || 0);
    if (!name && !type) return false;
    if (OWN_NOISE_FILE.test(name) || /calendar|pgp|pkcs7/.test(type)) return false;
    if (type.startsWith("image/") && (size < 15 * 1024 || (a && a.inline))) return false; // signature logos and pictures in the text
    return true;
  });
}

/**
 * The part of a mail that is new. A reply carries the whole earlier conversation underneath, which would make an old quote
 * look like a new enquiry; so for a reply everything from "On ... wrote:" or "-----Original Message-----" down is left out.
 * A forward keeps everything: the enquiry is usually in the forwarded part.
 */
function latestText(subject, text) {
  const t = String(text || "");
  if (/^\s*(fw|fwd)\s*:/i.test(String(subject || ""))) return t;
  const cut = t.search(/^\s*(?:On .{5,160} wrote:|-{2,}\s*Original Message\s*-{2,}|_{8,}|From:\s.{3,120}\r?\n\s*Sent:)/im);
  const head = cut > 0 ? t.slice(0, cut) : t;
  return head.split(/\r?\n/).filter((l) => !/^\s*>/.test(l)).join("\n");
}

/** A mail's headers (Map or plain object, any case) -> is it bulk or automatic? */
function headerFlags(headers) {
  const get = (name) => {
    if (!headers) return undefined;
    if (typeof headers.get === "function") return headers.get(name);
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
    return key ? headers[key] : undefined;
  };
  const has = (name) => get(name) !== undefined && get(name) !== null;
  const precedence = String(get("precedence") ?? "").toLowerCase();
  const autoSubmitted = String(get("auto-submitted") ?? "").toLowerCase();
  const bulk = has("list-unsubscribe") || has("list") || has("list-id") || /^(bulk|list|junk)$/.test(precedence);
  const auto = (autoSubmitted !== "" && autoSubmitted !== "no") || has("x-autoreply") || has("x-autorespond") || has("x-auto-response-suppress");
  return { bulk, auto };
}

/**
 * { headers, from, subject, body } -> { verdict: "noise" | "sure" | "maybe", reason }.
 * `from` is the sender's address; `body` is the readable text of the mail (not its raw source).
 */
function prefilter({ headers, from = "", subject = "", body = "", attachments = [] }) {
  const flags = headerFlags(headers);
  if (flags.auto) return { verdict: "noise", reason: "Automatic mail" };
  if (flags.bulk) return { verdict: "noise", reason: "Newsletter or mailing list" };
  if (SENDER_NOISE.test(String(from).toLowerCase())) return { verdict: "noise", reason: "Sent by a system address" };
  const subj = String(subject || "");
  if (SUBJECT_NOISE.test(subj)) return { verdict: "noise", reason: "Automatic or marketing subject" };
  const text = `${subj}\n${latestText(subj, body).slice(0, 6000)}`;
  if (BODY_NOISE.test(text)) return { verdict: "noise", reason: "Mailing text" };

  const ask = ASK.test(text);
  const cargo = CARGO.test(text);
  const route = ROUTE.test(text);
  if (ask && cargo && route) return { verdict: "sure", reason: "Asks for a rate with cargo and a route" };
  // Some mails ask for rates in a line and put the details in an attachment (a packing list, an enquiry sheet, a photo).
  const files = realAttachments(attachments);
  if (files.length) {
    if (ASK_SHORT.test(text)) return { verdict: "sure", reason: "Asks for rates; the details are in the attachment" };
    if (files.some((f) => ENQUIRY_FILE.test(String(f.filename || "")))) return { verdict: "maybe", reason: "An attachment that looks like an enquiry" };
  }
  if (ask || (cargo && route)) return { verdict: "maybe", reason: ask ? "Asks for a price" : "Cargo and a route" };
  return { verdict: "noise", reason: "No enquiry in it" };
}

module.exports = { prefilter, headerFlags, realAttachments, latestText, ASK, ASK_SHORT, CARGO, ROUTE };
