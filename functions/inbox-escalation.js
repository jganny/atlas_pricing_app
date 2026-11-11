/**
 * Problems raised on shipments that are already moving: a discrepancy, a shortage, damage, a delay, a claim. Such a conversation is not an
 * enquiry, but it must not be lost. It is kept for the team of the mailbox it arrived at (pricing@: Air Nom and Sea Nom; pricingsales@:
 * Free Hand and NRS), and for anyone already copied on the email, until someone marks it resolved. Fixed rules only: no AI credit.
 */

/** Words that say something went wrong with a shipment. */
const PROBLEM =
  /\b(discrepanc(?:y|ies)|short[- ]?ship(?:ped|ment)?|short[- ]?landed|short[- ]?received|shortage|damag(?:e|ed|es)|pilfer(?:age|ed)|missing (?:cartons?|pieces|pcs|boxes|packages?|cargo|documents?|pallets?)|wrong (?:consignee|shipper|invoice|documents?|weight|dimensions?|address)|(?:weight|quantity|dimension|piece) (?:mismatch|difference|discrepancy)|mismatch|not received|non[- ]?delivery|not delivered|delayed|delay in (?:delivery|shipment|departure|clearance)|rolled over|offloaded|off[- ]?loaded|detention|demurrage|insurance claim|claim|complaint|escalat(?:e|ed|ion)|customs (?:hold|query|objection|exam)|short[- ]?shut)\b/i;

/** Words or numbers that tie the mail to a particular shipment. */
const SHIPMENT =
  /\b(awb|mawb|hawb|b\/l|bl no|bl#|bol|booking|bkg|shipment|shpt|consignment|container|cntr|job no|invoice no|flight|vessel|voyage|etd|eta|pallets?|cartons?)\b|\b\d{3}[- ]?\d{8}\b/i;

/** Asking for a rate is an enquiry, whatever else it says. */
const ASKING = /\b(quote|quotation|rate request|rates? (?:please|for|ex|from|to)|pls (?:quote|revert with rate)|best rates?|kindly quote|indication)\b/i;

/**
 * { subject, body } -> { isEscalation, reason, keyword }.
 * Needs a problem word AND a sign of a real shipment (a reference, or a reply on a thread), and must not be a request for a quote.
 */
function detectEscalation({ subject = "", body = "" }) {
  const text = `${subject}\n${String(body || "").slice(0, 3000)}`;
  if (ASKING.test(text) && !/\b(claim|complaint|discrepanc|damag|shortage|short[- ]?ship)/i.test(text)) return { isEscalation: false, reason: "asks for a rate", keyword: "" };
  const p = PROBLEM.exec(text);
  if (!p) return { isEscalation: false, reason: "no problem wording", keyword: "" };
  const isReply = /^\s*(re|fw|fwd)\s*:/i.test(subject);
  if (!SHIPMENT.test(text) && !isReply) return { isEscalation: false, reason: "no shipment reference", keyword: p[1] };
  return { isEscalation: true, reason: `A problem on a shipment: "${p[1].toLowerCase()}"`, keyword: p[1].toLowerCase() };
}

module.exports = { detectEscalation };
