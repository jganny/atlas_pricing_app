/**
 * A directory of the email addresses our people deal with: airlines, liners, NVOCCs, transporters, overseas agents, exporters,
 * importers, traders, warehousers. The app remembers an address when it shows up in mail it keeps, and when a reply goes out to it.
 * It keeps only who it is, never what was said. The admin can see and correct the whole list, and the desks use it to suggest how to
 * ask a carrier for a rate (its portal, an email, or its tariff on file). The type is a guess from fixed rules (no AI credit) that the
 * admin confirms.
 */
const crypto = require("crypto");

const TYPES = ["airline", "gsa", "csa", "liner", "nvocc", "coloader", "transporter", "packer", "customs-broker", "courier", "overseas-agent", "forwarder", "exporter", "importer", "trader", "warehouser", "customer", "other", "unknown"];

const OWN_DOMAINS = ["atlaslogistics.co.in", "atlaspricing.com"];

/** Registrable-looking domain of an address ("mail.emirates.com" -> "emirates.com", "x.co.jp" -> "x.co.jp"). */
function domainOf(email) {
  const host = String(email || "").toLowerCase().split("@")[1] || "";
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const second = parts[parts.length - 2];
  return ["co", "com", "net", "org", "gov", "ac", "ltd"].includes(second) && parts[parts.length - 1].length === 2 ? parts.slice(-3).join(".") : parts.slice(-2).join(".");
}

const AIRLINES = {
  "emirates.com": ["EK", "Emirates SkyCargo"], "skycargo.com": ["EK", "Emirates SkyCargo"], "qrcargo.com": ["QR", "Qatar Airways Cargo"], "qatarairways.com.qa": ["QR", "Qatar Airways Cargo"],
  "etihad.com": ["EY", "Etihad Cargo"], "etihadcargo.com": ["EY", "Etihad Cargo"], "turkishcargo.com": ["TK", "Turkish Cargo"], "thy.com": ["TK", "Turkish Cargo"],
  "lufthansa-cargo.com": ["LH", "Lufthansa Cargo"], "lhcargo.com": ["LH", "Lufthansa Cargo"], "singaporeair.com.sg": ["SQ", "Singapore Airlines Cargo"], "siacargo.com": ["SQ", "Singapore Airlines Cargo"],
  "cathaycargo.com": ["CX", "Cathay Cargo"], "cathaypacific.com": ["CX", "Cathay Cargo"], "airindia.com": ["AI", "Air India Cargo"], "airindia.in": ["AI", "Air India Cargo"],
  "indigo.in": ["6E", "IndiGo CarGo"], "goindigo.in": ["6E", "IndiGo CarGo"], "spicejet.com": ["SG", "SpiceJet Cargo"], "saudia.com": ["SV", "Saudia Cargo"], "saudiacargo.com": ["SV", "Saudia Cargo"],
  "omanair.com": ["WY", "Oman Air Cargo"], "sharafcargo.com": ["WY", "Oman Air Cargo"], "malaysiaairlines.com": ["MH", "MASkargo"], "maskargo.com": ["MH", "MASkargo"],
  "ual.com": ["UA", "United Cargo"], "unitedcargo.com": ["UA", "United Cargo"], "britishairways.com": ["BA", "IAG Cargo"], "iagcargo.com": ["BA", "IAG Cargo"],
  "airfrance.fr": ["AF", "Air France KLM Martinair Cargo"], "afklmcargo.com": ["AF", "Air France KLM Martinair Cargo"], "ethiopianairlines.com": ["ET", "Ethiopian Cargo"], "srilankan.com": ["UL", "SriLankan Cargo"],
  "kuwaitairways.com": ["KU", "Kuwait Airways Cargo"], "gulfair.com": ["GF", "Gulf Air Cargo"], "flydubai.com": ["FZ", "flydubai Cargo"], "airarabia.com": ["G9", "Air Arabia Cargo"],
};
const LINERS = {
  "maersk.com": "Maersk", "msc.com": "MSC", "cma-cgm.com": "CMA CGM", "hapag-lloyd.com": "Hapag-Lloyd", "one-line.com": "ONE", "evergreen-line.com": "Evergreen", "evergreen-marine.com": "Evergreen",
  "cosco.com": "COSCO", "coscoshipping.com": "COSCO", "yangming.com": "Yang Ming", "zim.com": "ZIM", "hmm21.com": "HMM", "pilship.com": "PIL", "wanhai.com": "Wan Hai", "oocl.com": "OOCL", "sealead.com": "Sea Lead",
  "emiratesline.com": "Emirates Shipping Line", "rcclgroup.com": "RCL", "sitc.com": "SITC", "seaconshipping.com": "Seacon",
};

const KEYWORDS = [
  // An airline's sales agent (GSA) or cargo sales agent (CSA) is named as such; the admin sets the rest by hand.
  [/\b(gsa|general sales agents?|general sales agency)\b/i, "gsa"],
  [/\b(csa|cargo sales agents?|carrier sales agents?)\b/i, "csa"],
  [/\b(cargo|airlines?|airways?)\b/i, "airline"],
  [/\b(shipping|lines?|marine|maritime)\b/i, "liner"],
  [/\b(nvocc)/i, "nvocc"],
  [/\b(consolidat|co-?load|consol)/i, "coloader"],
  [/\b(packers?|packing|crating|movers (?:and|&) packers)/i, "packer"],
  [/\b(customs|cha\b|clearing|clearance|brokers?\b)/i, "customs-broker"],
  [/\b(courier|parcel|dhl|fedex|aramex|tnt)\b/i, "courier"],
  [/\b(transport|truck|carriers?\b|haulage|roadways?|movers?\b)/i, "transporter"],
  [/\b(warehous|storage|godown|cfs\b|icd\b)/i, "warehouser"],
  [/\b(export|manufactur|industries\b)/i, "exporter"],
  [/\b(import)/i, "importer"],
  [/\b(trading|traders?\b|enterprises\b|impex\b)/i, "trader"],
  [/\b(forward|freight|logistic|agency\b|agents?\b)/i, "forwarder-or-agent"],
];

/** { email, name } -> { type, org, carrierCode, confidence }. Fixed rules; "unknown" when nothing fits. */
function guessType(email, name = "") {
  const dom = domainOf(email);
  if (AIRLINES[dom]) return { type: "airline", org: AIRLINES[dom][1], carrierCode: AIRLINES[dom][0], confidence: "high" };
  if (LINERS[dom]) return { type: "liner", org: LINERS[dom], carrierCode: "", confidence: "high" };
  const text = `${name} ${dom.replace(/\.[a-z.]+$/, "").replace(/[-_.]/g, " ")}`;
  for (const [re, type] of KEYWORDS) {
    if (!re.test(text)) continue;
    // A forwarder abroad is an overseas agent; one in India is a forwarder.
    const resolved = type === "forwarder-or-agent" ? (/\.in$/.test(String(email || "").toLowerCase()) ? "forwarder" : "overseas-agent") : type;
    return { type: resolved, org: "", carrierCode: "", confidence: "guess" };
  }
  return { type: "unknown", org: "", carrierCode: "", confidence: "none" };
}

const contactId = (email) => crypto.createHash("sha1").update(String(email || "").toLowerCase().trim()).digest("hex").slice(0, 20);
const isOwn = (email) => OWN_DOMAINS.includes(domainOf(email));
const isAddress = (a) => /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/.test(String(a || "").trim());
const SYSTEM_LOCAL = /^(no-?reply|noreply|donotreply|do-not-reply|mailer-daemon|postmaster|bounce|notifications?|alerts?)\b/i;

/**
 * Remember addresses. list: [{ email, name, mailbox, source }]. Own colleagues and system senders are not contacts.
 * An address the admin has already set (a type or organisation typed by hand) is never overwritten by a guess.
 */
async function learnContacts(db, list, now = Date.now()) {
  const seen = new Set();
  let added = 0;
  for (const c of list || []) {
    const email = String((c && c.email) || "").trim().toLowerCase();
    if (!isAddress(email) || isOwn(email) || SYSTEM_LOCAL.test(email.split("@")[0]) || seen.has(email)) continue;
    seen.add(email);
    const ref = db.collection("emailDirectory").doc(contactId(email));
    const snap = await ref.get();
    const name = String((c && c.name) || "").replace(/["<>]/g, "").trim().slice(0, 80);
    if (snap.exists) {
      const d = snap.data();
      const patch = { lastSeen: now, count: (Number(d.count) || 0) + 1 };
      // Not sorted yet: try again with what is known now (never over a type the admin set).
      if ((d.type === "unknown" || d.typeSource === "none") && d.typeSource !== "admin") {
        const g2 = guessType(email, name || d.name);
        if (g2.type !== "unknown") Object.assign(patch, { type: g2.type, typeSource: g2.confidence === "high" ? "rules" : "guess", org: d.org || g2.org, carrierCode: d.carrierCode || g2.carrierCode });
      }
      if (name && !d.name) patch.name = name;
      if (c.mailbox && !(d.mailboxes || []).includes(c.mailbox)) patch.mailboxes = [...(d.mailboxes || []), c.mailbox];
      await ref.set(patch, { merge: true });
    } else {
      const g = guessType(email, name);
      await ref.set({
        email,
        name,
        domain: domainOf(email),
        type: g.type,
        typeSource: g.confidence === "none" ? "none" : g.confidence === "high" ? "rules" : "guess",
        org: g.org,
        carrierCode: g.carrierCode,
        rateSource: "",
        mailboxes: c.mailbox ? [c.mailbox] : [],
        firstSeen: now,
        lastSeen: now,
        count: 1,
        source: c.source || "inbox",
      });
      added += 1;
    }
  }
  return added;
}

module.exports = { TYPES, domainOf, guessType, contactId, isOwn, learnContacts };
