/**
 * Mails from airlines, liners, couriers and transporters that carry a tariff or a circular.
 *
 * Such a mail is not an enquiry: the attached file is filed straight into the Circulars library (where the circular reader
 * picks it up by itself) and the mail is not kept in the app at all. This module only decides, with fixed rules and no AI
 * credit, whether a mail is one of those and how to label it.
 */
const AIRLINES = require("./airline-names.json");
const DIR = require("./inbox-directory");

const DOC_TYPE = /(pdf|msword|wordprocessingml|spreadsheetml|ms-excel|excel|csv|opendocument)/i;
const DOC_NAME = /\.(pdf|xlsx|xlsm|xls|csv|docx|doc)$/i;

/** Words that say "this announces rates or charges" (not "please quote"). */
const CIRCULAR_WORDS = /\b(tariffs?|rate ?sheets?|rate ?cards?|rates? (?:advice|update|revision|notice|circular)|circulars?|surcharges?|fsc|baf|caf|gri|psc|peak season|fuel (?:surcharge|adjustment)|general rate increase|revised rates|new rates|rate revision|price (?:list|revision)|advisory|schedule|w\.?e\.?f\.?|effective (?:from|\d)|validity|notice)\b/i;

const FUEL_WORDS = /\b(fuel|fsc|baf|bunker|bunker adjustment|caf)\b/i;
const SEA_WORDS = /\b(liner|vessel|fcl|lcl|container|ocean|shipping|sailing|thc|detention|demurrage|peak season|gri|bunker|baf|reefer|nhava|mundra|chennai port|port charges)\b/i;
const AIR_WORDS = /\b(airline|air ?cargo|air ?freight|airways|awb|iata|general cargo rates?|gcr|aircraft|flight|belly)\b/i;
const COURIER_WORDS = /\b(dhl|fedex|ups|tnt|aramex|courier|express|parcel)\b/i;
const TRANSPORT_WORDS = /\b(trucking|transport(?:er|ation)?|haulage|truck|lorry|ftl|ltl|cfs|warehouse|warehousing|container yard)\b/i;

const LINERS = ["maersk", "msc", "cma cgm", "hapag", "hapag-lloyd", "evergreen", "cosco", "oocl", "yang ming", "hmm", "zim", "pil", "wan hai", "ocean network express", "one line", "apl", "arkas", "x-press feeders", "samudera", "sealead", "gold star", "emirates shipping", "unifeeder"];

const norm = (s) => String(s || "").toLowerCase();

/** The attachments that are documents (a tariff is a PDF or a sheet), not pictures or calendar files. */
function documentAttachments(list) {
  return (Array.isArray(list) ? list : []).filter((a) => {
    const name = String((a && a.filename) || "");
    const type = String((a && a.contentType) || "");
    return (DOC_NAME.test(name) || DOC_TYPE.test(type)) && Number((a && a.size) || 1) > 1500;
  });
}

/** The airline named in the mail (sender name, subject or file name): { code, name } or null. */
function airlineIn(text, filenames = []) {
  const hay = norm(text);
  let best = null;
  for (const [code, name] of Object.entries(AIRLINES)) {
    const n = norm(name).replace(/\s*\([^)]*\)\s*/g, " ").trim();
    if (n.length < 5 || /^\d/.test(n)) continue;
    if (hay.includes(n) && (!best || n.length > best.len)) best = { code, name, len: n.length };
  }
  if (best) return { code: best.code, name: best.name };
  for (const f of filenames) {
    const m = /^([A-Z0-9]{2})[_\- ]/.exec(String(f || "").trim());
    if (m && AIRLINES[m[1]]) return { code: m[1], name: AIRLINES[m[1]] };
  }
  return null;
}

/**
 * { from, fromName, subject, body, attachments } -> { isCircular, category, carrier, title, reason }.
 * Only a mail that carries a document AND says it announces rates or charges AND does not ask for a quote is taken.
 */
function classifyCircularMail({ from = "", fromName = "", subject = "", body = "", attachments = [], askedForQuote = false }) {
  const docs = documentAttachments(attachments);
  if (!docs.length) return { isCircular: false, reason: "no document attached" };
  if (askedForQuote) return { isCircular: false, reason: "it asks for a quote" };
  const subj = String(subject || "");
  const names = docs.map((d) => String(d.filename || ""));
  // The subject or a file name must say it is a tariff or circular; words only in the body are not enough for a mailing.
  const strong = CIRCULAR_WORDS.test(subj) || names.some((n) => CIRCULAR_WORDS.test(n));
  const inBody = CIRCULAR_WORDS.test(String(body || "").slice(0, 1500));
  if (!strong && !inBody) return { isCircular: false, reason: "no tariff or circular wording" };
  if (!strong) return { isCircular: false, reason: "only the body mentions it" };

  const hay = `${fromName} ${subj} ${names.join(" ")} ${String(from).split("@")[1] || ""}`;
  const airline = airlineIn(`${fromName} ${subj} ${names.join(" ")}`, names);
  const liner = LINERS.find((l) => norm(hay).includes(l));
  const isFuel = FUEL_WORDS.test(`${subj} ${names.join(" ")}`);
  let category = "general";
  let carrier = "";
  // A liner's name can also be an airline's (Maersk Air): a liner name with no air wording is a liner.
  // The contact directory knows carriers by address too ("Etihad Cargo" from etihad.com is an airline even though the name table says "Etihad Airways").
  const known = DIR.guessType(from, fromName);
  if ((airline || AIR_WORDS.test(hay) || known.type === "airline") && !(liner && !AIR_WORDS.test(hay))) {
    category = isFuel ? "fuel_circular_airline" : "airline_tariff";
    carrier = airline ? airline.code : known.type === "airline" ? known.carrierCode || known.org : "";
  } else if (liner || known.type === "liner" || SEA_WORDS.test(hay)) {
    category = isFuel ? "fuel_circular_shipping" : /\btariff|rate ?sheet|rates?\b/i.test(`${subj} ${names.join(" ")}`) ? "sea_tariff" : "line_circular";
    carrier = liner ? liner.toUpperCase() : "";
  } else if (COURIER_WORDS.test(hay)) {
    category = "courier_tariff";
  } else if (TRANSPORT_WORDS.test(hay)) {
    category = "general";
  }
  // A tariff that is really a surcharge notice is a circular, not a rate table.
  if (category === "airline_tariff" && /\b(circular|notice|advisory|surcharge|advice)\b/i.test(subj) && !/\b(tariff|rate ?sheet|rates?)\b/i.test(`${subj} ${names.join(" ")}`)) category = "general";
  if (!carrier) carrier = String(fromName || "").replace(/["<>]/g, "").trim().slice(0, 60) || String(from).split("@")[1] || "";
  const fileBase = (names[0] || "").replace(/\.(pdf|xlsx|xlsm|xls|csv|docx|doc)$/i, "");
  const title = (fileBase.length >= 10 ? fileBase : subj || fileBase).replace(/[_]+/g, " ").trim().slice(0, 100) || subj.slice(0, 100);
  return { isCircular: true, category, carrier, title, reason: `A ${category.replace(/_/g, " ")} sent by email` };
}

/**
 * A circular that came as plain words with no file (for example an airline's fuel surcharge notice in the body of the email). There is nothing
 * to file into the Circulars tab, so it is noted as "needs filing by hand" instead of being lost. Needs: a circular word in the subject,
 * a sender that is a known airline or liner (or says so in its name), and no request for a quote.
 */
function looksLikePlainTextCircular({ from = "", fromName = "", subject = "", askedForQuote = false }) {
  if (askedForQuote) return { isCircular: false };
  const subj = String(subject || "");
  if (!CIRCULAR_WORDS.test(subj)) return { isCircular: false };
  const hay = `${fromName} ${subj} ${String(from).split("@")[1] || ""}`;
  const airline = airlineIn(`${fromName} ${subj}`);
  const liner = LINERS.find((l) => norm(hay).includes(l));
  // The contact directory knows many carriers by address ("Etihad Cargo" is not in the airline name table, but etihad.com is a known airline).
  const guess = DIR.guessType(from, fromName);
  const kind = airline ? "airline" : liner ? "liner" : guess.type === "airline" || guess.type === "liner" ? guess.type : "";
  if (!kind) return { isCircular: false };
  const fuel = FUEL_WORDS.test(subj);
  const carrier = airline ? airline.name : liner ? liner.toUpperCase() : guess.org || String(fromName || "").trim() || String(from).split("@")[1] || "";
  return { isCircular: true, carrier, category: kind === "airline" ? (fuel ? "fuel_circular_airline" : "airline_tariff") : fuel ? "fuel_circular_shipping" : "line_circular" };
}

module.exports = { classifyCircularMail, looksLikePlainTextCircular, documentAttachments, airlineIn };
