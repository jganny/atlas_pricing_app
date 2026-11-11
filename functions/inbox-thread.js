/**
 * Email threads: the original enquiry, what the desk sent on to vendors from Outlook, and the vendors' replies, tied together by themselves.
 * Fixed rules only, no AI credit. Nothing but small cards is stored (subject, who it went to, times, a few reference marks); the emails
 * stay in the mailbox and open live.
 *
 * How a mail is tied to an enquiry, strongest first:
 *   headers       its In-Reply-To / References name a mail we already hold (exact)
 *   conversation  Outlook's own conversation mark (Thread-Index) is the same, which survives a changed subject (exact)
 *   quoted        a forward that carries the original underneath: the original's subject or its ticket number is inside it
 *   token         the same ticket or reference number in both
 *   lane          same airports and the same weight, close in time, and only one enquiry fits
 *   subject       a vendor's reply with the same subject as what we sent that vendor
 * Anything the rules are unsure of is left alone. A person can always unlink, or link by hand.
 */
const crypto = require("crypto");

const DAY = 86_400_000;
const sha = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 24);
const cardId = (mailboxKey, messageId) => sha(`${mailboxKey}:${messageId}`);

const NOT_AIRPORTS = new Set(("THE AND FOR YOU ARE NOT ALL NET GRS KGS KG CBM CMS PCS CTN BOX PKG PDF USD INR EUR GBP AED SGD JPY CNY EXW FOB CIF CFR FCA DAP DDP DDU AWB MAWB HAWB ETD ETA ETC AOD AOL POL POD PLS FYI ASAP DGR LCL FCL TEU FEU LTD PVT LLP INC GST VAT TEL FAX WEB OUT NEW OLD DIM WT QTY REF NOS PER VIA MIN MAX TOT NIL N/A " +
  "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC MON TUE WED THU FRI SAT SUN CCS BCC CC FWD URL ONE TWO").split(/\s+/));

/** "RE: [EXTERNAL] AMD - LRD//463Kg" -> "amd - lrd//463kg": the same subject however it was forwarded or answered. */
function normalizeSubject(subject) {
  let s = String(subject || "").toLowerCase();
  for (let i = 0; i < 8; i++) {
    const n = s.replace(/^\s*(?:re|fw|fwd|aw|wg|tr|rv|enc|res|sv|vs)\s*(?:\[\d+\])?\s*:\s*/i, "").replace(/^\s*\[[^\]]{1,40}\]\s*/, "");
    if (n === s) break;
    s = n;
  }
  return s.replace(/[^\p{L}\p{N}#\/.\-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/** Letters and digits only, for "is this subject inside that body". */
const squash = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Outlook's conversation mark: the first 22 bytes of the Thread-Index header are the same for every mail in a conversation, whatever the subject becomes. */
function convRootOf(threadIndex) {
  const s = String(threadIndex || "").replace(/\s+/g, "");
  if (!s) return "";
  let bytes;
  try {
    bytes = Buffer.from(s, "base64");
  } catch {
    return "";
  }
  return bytes.length >= 22 ? bytes.subarray(0, 22).toString("hex") : "";
}

/** Ticket and reference numbers that are named as such ("ticket #109196", "ref: AB-12345"). Lower case, at most 8. */
function extractTokens(text) {
  const t = String(text || "").slice(0, 20000);
  const out = new Set();
  for (const m of t.matchAll(/(?:ticket|tkt|ref(?:erence)?|rfq|enquiry|inquiry|quote|quotation|request|job|case|file)\s*(?:no\.?|number|nr\.?|id)?\s*[:#=\-]?\s*#?\s*([A-Za-z]{0,4}-?\d{4,10})\b/gi)) out.add(m[1].toLowerCase());
  for (const m of t.matchAll(/#\s?(\d{5,10})\b/g)) out.add(m[1]);
  return [...out].slice(0, 8);
}

/** Airport codes in route-looking places: "AMD - LRD", "BOM to NRT", "(DXB)", "AOD: LRD". In order, at most 8. */
function extractCodes(text) {
  const t = String(text || "").slice(0, 20000);
  const out = [];
  const add = (c) => {
    if (c && !NOT_AIRPORTS.has(c) && !out.includes(c)) out.push(c);
  };
  for (const m of t.matchAll(/\b([A-Z]{3})\s*(?:[-–—\/>→]+|\bto\b|\bTO\b|\bTo\b)\s*([A-Z]{3})\b/g)) {
    if (!NOT_AIRPORTS.has(m[1]) && !NOT_AIRPORTS.has(m[2])) {
      add(m[1]);
      add(m[2]);
    }
  }
  for (const m of t.matchAll(/\(([A-Z]{3})\)/g)) add(m[1]);
  for (const m of t.matchAll(/\b(?:AOD|AOL|POL|POD|ORIGIN|DESTINATION|DEST|FROM|TO)\s*[:=]\s*([A-Z]{3})\b/g)) add(m[1]);
  return out.slice(0, 8);
}

/** Weights written as such: "463 kg", "463Kg", "gross weight 463.000". Rounded to one decimal, at most 12. */
function extractWeights(text) {
  const t = String(text || "").slice(0, 20000);
  const out = new Set();
  const num = (s) => Number(String(s).replace(/,/g, ""));
  const add = (v) => {
    if (Number.isFinite(v) && v >= 1 && v <= 200000) out.add(Math.round(v * 10) / 10);
  };
  for (const m of t.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(?:kgs?\b|kilos?\b|kilograms?\b)/gi)) add(num(m[1]));
  for (const m of t.matchAll(/(?:gross|net|chargeable|actual|total)\s*(?:wt|weight|w\.?)\.?[^0-9\n]{0,30}(\d[\d,]*(?:\.\d+)?)/gi)) add(num(m[1]));
  return [...out].slice(0, 12);
}

const weightsMatch = (a, b) => Math.abs(a - b) <= Math.max(1, 0.01 * Math.max(a, b));

/**
 * Everything a mail tells us about which conversation it belongs to. text: the mail's readable text (the forwarded original included).
 * refs: its In-Reply-To then References, as written. Nothing here is the mail's content beyond short marks.
 */
function signalsOf({ subject, text, threadIndex, refs }) {
  const body = String(text || "");
  const hay = `${subject || ""}\n${body}`;
  return {
    subjectKey: normalizeSubject(subject),
    tokens: extractTokens(hay),
    codes: extractCodes(hay),
    nums: extractWeights(hay),
    convRoot: convRootOf(threadIndex),
    refs: [...new Set((refs || []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()))].slice(-6),
  };
}

/**
 * How well a mail (sent by us, or a reply) fits one enquiry card, from the content alone. { score, by } with by the strongest reason.
 * enquiry: a card's stored marks + receivedAt. mail: signals + at (ms) + quoted (the lower-case text a forward carries underneath).
 */
function scoreAgainst(enquiry, mail) {
  const eAt = Date.parse(enquiry.receivedAt || "") || Number(enquiry.timestamp) || 0;
  const at = Number(mail.at) || 0;
  if (eAt && at && at < eAt - 60_000) return { score: 0, by: "" };
  const hours = eAt && at ? (at - eAt) / 3_600_000 : 0;
  if (hours > 96) return { score: 0, by: "" };
  let score = 0;
  let by = "lane";
  const quoted = squash(mail.quoted || "");
  const subj = squash(enquiry.subjectKey || "");
  if (quoted && subj.length >= 12 && quoted.includes(subj)) {
    score += 90;
    by = "quoted";
  }
  const eTokens = enquiry.tokens || [];
  if (eTokens.some((tok) => (mail.tokens || []).includes(tok) || (quoted && quoted.includes(squash(tok)) && squash(tok).length >= 5))) {
    score += 90;
    if (by !== "quoted") by = "token";
  }
  if ((enquiry.nums || []).some((a) => (mail.nums || []).some((b) => weightsMatch(a, b)))) score += 40;
  const shared = (enquiry.codes || []).filter((c) => (mail.codes || []).includes(c)).length;
  score += Math.min(60, shared * 30);
  if (hours <= 6) score += 10;
  else if (hours <= 24) score += 5;
  return { score, by };
}

/**
 * The enquiry a mail fits best, or null when none fits at all (a score under 70). When two or more fit about equally the closest one in time
 * (the enquiry that arrived most recently before the mail was sent) is taken and `check` is set, so the screen asks a person to confirm it.
 * Nothing is left unlinked for want of a tie-break.
 */
function chooseEnquiry(enquiries, mail) {
  const scored = enquiries.map((e) => ({ e, ...scoreAgainst(e, mail) })).filter((x) => x.score >= 70).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  const top = scored[0].score;
  const close = scored.filter((x) => top - x.score < 20);
  if (close.length === 1) return { id: scored[0].e.id, by: scored[0].by, score: top, check: false };
  const arrived = (x) => Date.parse(x.e.receivedAt || "") || Number(x.e.timestamp) || 0;
  const at = Number(mail.at) || Date.now();
  // The enquiry that arrived most recently before the mail, then the higher score.
  close.sort((a, b) => Math.abs(at - arrived(a)) - Math.abs(at - arrived(b)) || b.score - a.score);
  return { id: close[0].e.id, by: close[0].by, score: close[0].score, check: true };
}

/** Marks an enquiry as the start of a conversation, so it is kept for the conversation's retention and not cleaned up early. */
async function markRoot(db, rootId) {
  try {
    await db.collection("inbox_enquiries").doc(rootId).set({ hasThread: true }, { merge: true });
  } catch {
    /* the link itself is already saved */
  }
}

/** A card that starts a conversation: an enquiry or a problem, not a follow-up. */
const isRootCard = (d) => !!d && d.tag !== "follow_up";

const REASONS = {
  headers: "It is a reply in the same email conversation.",
  conversation: "Outlook shows it belongs to the same conversation, even though the subject changed.",
  quoted: "It carries the original enquiry (the subject or ticket number appears inside it).",
  token: "It names the same ticket or reference number.",
  lane: "Same airports and weight, close in time, and no other enquiry fits.",
  subject: "Same subject as what was sent to this vendor.",
  manual: "Linked by a person.",
};

/** Looks for the conversation a mail belongs to. Returns { root, by } or null. Reads a few small cards; no AI. */
async function findThread(db, mailboxKey, kind, mail, now = Date.now()) {
  // 1. Message references.
  for (const ref of [...(mail.refs || [])].reverse()) {
    const id = cardId(mailboxKey, ref);
    const [sent, card] = await Promise.all([db.collection("inbox_sent").doc(id).get(), db.collection("inbox_enquiries").doc(id).get()]);
    if (sent.exists && sent.data().threadId) return { root: sent.data().threadId, by: "headers" };
    if (card.exists) {
      const d = card.data();
      if (d.threadId) return { root: d.threadId, by: "headers" };
      if (isRootCard(d)) return { root: id, by: "headers" };
    }
  }
  // 2. Outlook's conversation mark.
  if (mail.convRoot) {
    const [sent, cards] = await Promise.all([
      db.collection("inbox_sent").where("convRoot", "==", mail.convRoot).limit(5).get(),
      db.collection("inbox_enquiries").where("convRoot", "==", mail.convRoot).limit(5).get(),
    ]);
    for (const s of sent.docs) if (s.data().mailbox === mailboxKey && s.data().threadId) return { root: s.data().threadId, by: "conversation" };
    for (const c of cards.docs) {
      const d = c.data();
      if (d.mailbox !== mailboxKey) continue;
      if (d.threadId) return { root: d.threadId, by: "conversation" };
      if (isRootCard(d)) return { root: c.id, by: "conversation" };
    }
  }
  // 3. A vendor's reply to something we sent them, by subject (and the vendor must be one we sent it to).
  if (kind === "card" && mail.subjectKey && mail.subjectKey.length >= 8) {
    const sent = await db.collection("inbox_sent").where("subjectKey", "==", mail.subjectKey).limit(5).get();
    const from = String(mail.fromAddr || "").toLowerCase();
    for (const s of sent.docs) {
      const d = s.data();
      if (d.mailbox !== mailboxKey || !d.threadId || Number(d.at) > (Number(mail.at) || now) + 60_000) continue;
      const to = [...(d.to || []), ...(d.cc || [])].map((x) => String((x && x.email) || x).toLowerCase());
      if (!from || to.includes(from)) return { root: d.threadId, by: "subject" };
    }
  }
  // 4. By content: for what we sent, and for replies that no header ties. New enquiries start their own conversation instead.
  if (kind === "sent" || mail.tag === "follow_up") {
    const since = now - 4 * DAY;
    const snap = await db.collection("inbox_enquiries").where("timestamp", ">", since).limit(400).get();
    const candidates = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((d) => d.mailbox === mailboxKey && isRootCard(d) && (!d.threadId || d.threadId === d.id) && !(kind === "card" && d.id === mail.id));
    const hit = chooseEnquiry(candidates, mail);
    if (hit) return { root: hit.id, by: hit.by, check: hit.check };
  }
  return null;
}

module.exports = { markRoot, normalizeSubject, convRootOf, extractTokens, extractCodes, extractWeights, weightsMatch, signalsOf, scoreAgainst, chooseEnquiry, isRootCard, findThread, cardId, REASONS, DAY };
