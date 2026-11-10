/**
 * Slim AI intake for pricing / pricingsales IMAP.
 *
 * Design (storage-safe):
 * - Read mail from Logix IMAP (source of truth stays on the mail server)
 * - Classify: new_enquiry | follow_up | noise | needs_human
 * - Persist ONLY actionable slim enquiry docs (no full MIME / long body)
 * - Noise is counted and skipped (not written to Firestore)
 *
 * Secrets:
 *   IMAP_PRICING_PASSWORD, IMAP_PRICINGSALES_PASSWORD
 *   ANTHROPIC_API_KEY (optional — heuristic fallback if missing)
 *
 *   firebase deploy --only functions:pollPricingInboxes
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");
const { ImapFlow } = require("imapflow");
const P = require("./inbox-poll-logic");
const F = require("./inbox-filter");
const C = require("./inbox-circular");
const R = require("./inbox-reply");
const K = require("./inbox-confirm");
const nodemailer = require("nodemailer");
const { simpleParser } = require("mailparser");

const MAX_AI_PER_RUN = 20; // a safety ceiling: the free rules already keep the AI to the unclear few

const MAX_PER_RUN = 40; // keeps the AI sorting and the mail server within the time allowed
const FIRST_RUN_DAYS = 3; // the first time, only the last few days are looked at, never the whole mailbox

if (!admin.apps.length) {
  admin.initializeApp();
}

const pricingPassword = defineSecret("IMAP_PRICING_PASSWORD");
const salesPassword = defineSecret("IMAP_PRICINGSALES_PASSWORD");
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const IMAP = {
  host: "czipop.logix.in",
  port: 993,
  secure: true,
  folder: "INBOX",
};

const MAILBOXES = [
  {
    key: "pricing",
    user: "pricing@atlaslogistics.co.in",
    secret: pricingPassword,
  },
  {
    key: "pricingsales",
    user: "pricingsales@atlaslogistics.co.in",
    secret: salesPassword,
  },
];

const ACTIONABLE = new Set(["new_enquiry", "follow_up", "needs_human"]);

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectMode(text) {
  const sea = /\b(fcl|lcl|container|cbm|liner|maersk|msc|innsa|nlrtm|pol|pod)\b/i.test(text);
  const air = /\b(air|awb|airline|kg|kgs|emirates|qatar|blr|lhr|dxb)\b/i.test(text);
  if (sea && !air) return "sea";
  if (air && !sea) return "air";
  if (sea) return "sea";
  if (air) return "air";
  return "unknown";
}

function assignUsers(mailboxKey, mode) {
  if (mailboxKey === "pricing") {
    if (mode === "air") return { assignedUsers: ["shashank"], suggestedUser: "shashank" };
    if (mode === "sea") return { assignedUsers: ["shaheer"], suggestedUser: "shaheer" };
    return { assignedUsers: ["shashank", "shaheer"], suggestedUser: null };
  }
  return { assignedUsers: ["kavya", "cathrina"], suggestedUser: null };
}

function extractCode(value, mode) {
  const v = String(value || "").trim();
  if (mode === "sea") {
    const m5 = v.match(/\b([A-Z]{2}[A-Z0-9]{3})\b/);
    if (m5) return m5[1];
  }
  const m3 = v.match(/\b([A-Z]{3})\b/);
  return m3 ? m3[1] : v.slice(0, 40);
}

function parseLite(text, mode) {
  const result = {
    customer: "",
    origin: "",
    destination: "",
    packages: [],
    containers: [],
    confidence: 40,
    source: "email-imap",
  };
  const cust = text.match(/(?:customer|client|shipper|company)\s*[:\-]\s*([^\n,;]{2,80})/i);
  if (cust) result.customer = cust[1].trim();

  const polPod = text.match(/\bpol\b[:\s]*([^\n,;(]{2,40})[\s\S]*?\bpod\b[:\s]*([^\n,;(]{2,40})/i);
  if (polPod) {
    result.origin = extractCode(polPod[1], mode);
    result.destination = extractCode(polPod[2], mode);
    result.confidence = 70;
  } else {
    const codes3 = text.match(/\b([A-Z]{3})\b/g);
    const codes5 = text.match(/\b([A-Z]{2}[A-Z0-9]{3})\b/g);
    if (mode === "sea" && codes5 && codes5.length >= 2) {
      result.origin = codes5[0];
      result.destination = codes5[1];
      result.confidence = 65;
    } else if (codes3 && codes3.length >= 2) {
      result.origin = codes3[0];
      result.destination = codes3[1];
      result.confidence = 60;
    }
  }

  if (mode === "sea") {
    const cont = text.match(/(\d+)\s*[x×*]\s*(20|40|45)\s*['']?\s*(gp|hc|hq|ot|rf)/i);
    if (cont) {
      result.containers.push({
        type: `${cont[2]}'${cont[3].toUpperCase() === "HQ" ? "HC" : cont[3].toUpperCase()}`,
        qty: parseInt(cont[1], 10) || 1,
      });
      result.confidence = Math.min(100, result.confidence + 15);
    }
  } else {
    const gw = text.match(/(?:gross|total)?\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(?:kg|kgs)?/i);
    const dim = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
    const qty = text.match(/(\d+)\s*(?:pcs|pieces|pkgs|ctns)/i);
    if (gw || dim) {
      result.packages.push({
        qty: qty ? parseInt(qty[1], 10) : 1,
        gw: gw ? parseFloat(gw[1]) : 0,
        l: dim ? parseFloat(dim[1]) : undefined,
        w: dim ? parseFloat(dim[2]) : undefined,
        h: dim ? parseFloat(dim[3]) : undefined,
      });
      result.confidence = Math.min(100, result.confidence + 15);
    }
  }

  return result;
}

/** Fast rules when Anthropic is unavailable or fails. */
function classifyHeuristic(subject, body) {
  const text = `${subject}\n${body}`.toLowerCase();
  const subj = subject.toLowerCase();

  if (
    /\b(unsubscribe|newsletter|marketing|out of office|automatic reply|delivery status|undeliverable)\b/i.test(
      text,
    )
  ) {
    return {
      tag: "noise",
      actionRequired: false,
      reason: "Automated / marketing / bounce",
      mode: "unknown",
    };
  }

  const isReply = /^(re|fw|fwd)\s*:/i.test(subject.trim());
  const quoteSignals =
    /\b(please quote|kindly quote|rate request|rfq|need rates?|offer rates?|pricing request|quotation)\b/i.test(
      text,
    ) ||
    (/\b(pol|pod|origin|destination)\b/i.test(text) &&
      /\b(fcl|lcl|kg|kgs|cbm|container|awb)\b/i.test(text));

  if (isReply && !quoteSignals) {
    return {
      tag: "follow_up",
      actionRequired: /\b(urgent|pending|awaiting|still waiting|follow.?up|any update)\b/i.test(text),
      reason: "Reply/forward without a clear new RFQ",
      mode: detectMode(text),
    };
  }

  if (quoteSignals) {
    return {
      tag: "new_enquiry",
      actionRequired: true,
      reason: "Looks like a rate / quote request",
      mode: detectMode(text),
    };
  }

  if (/\b(thank you|thanks|noted|received|fyi|for your information)\b/i.test(subj) && !quoteSignals) {
    return {
      tag: "noise",
      actionRequired: false,
      reason: "Acknowledgement / FYI",
      mode: "unknown",
    };
  }

  return {
    tag: "needs_human",
    actionRequired: true,
    reason: "Ambiguous — desk should glance",
    mode: detectMode(text),
  };
}

async function classifyWithAi(apiKey, subject, body) {
  if (!apiKey) return null;
  // The first lines say what the mail is. A shorter question and answer cost less on every unclear mail.
  const excerpt = body.slice(0, 1400);
  const prompt = `You classify freight pricing mailbox emails for Atlas Logistics (India forwarder).
Return ONLY compact JSON (no markdown) with keys:
tag: new_enquiry | follow_up | noise | needs_human
actionRequired: boolean
reason: short string
mode: air | sea | unknown
customer: string (or "")
origin: airport/seaport code if clear else ""
destination: code if clear else ""
summary: one short sentence for the desk

Rules:
- new_enquiry = first ask for rates / RFQ with cargo or lane
- follow_up = reply on an existing thread, chasing, clarifying (not a brand-new RFQ)
- noise = OOOffice, marketing, bounce, pure thanks with no ask
- needs_human = unclear but might need a person

Subject: ${subject}
Body: ${excerpt}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 160,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    functions.logger.warn("AI classify HTTP error", {
      status: response.status,
      errText: errText.slice(0, 200),
    });
    return null;
  }

  const data = await response.json();
  const text = (data.content || [])
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const tag = String(parsed.tag || "needs_human");
    if (!ACTIONABLE.has(tag) && tag !== "noise") {
      parsed.tag = "needs_human";
    }
    return parsed;
  } catch {
    return null;
  }
}

async function classifyAndExtract(apiKey, subject, body) {
  const heuristic = classifyHeuristic(subject, body);
  let ai = null;
  try {
    ai = await classifyWithAi(apiKey, subject, body);
  } catch (err) {
    functions.logger.warn("AI classify failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const tag = ai?.tag || heuristic.tag;
  const mode =
    ai?.mode === "air" || ai?.mode === "sea" || ai?.mode === "unknown"
      ? ai.mode
      : heuristic.mode || detectMode(`${subject}\n${body}`);
  const actionRequired =
    typeof ai?.actionRequired === "boolean" ? ai.actionRequired : heuristic.actionRequired;
  const reason = String(ai?.reason || heuristic.reason || "");
  const summary = String(ai?.summary || reason || "").slice(0, 200);

  const lite = parseLite(`${subject}\n${body}`, mode === "unknown" ? "air" : mode);
  if (ai?.customer) lite.customer = String(ai.customer).slice(0, 120);
  if (ai?.origin) lite.origin = extractCode(String(ai.origin), mode);
  if (ai?.destination) lite.destination = extractCode(String(ai.destination), mode);
  if (ai && (ai.origin || ai.destination || ai.customer)) {
    lite.confidence = Math.max(lite.confidence, 75);
  }
  lite.source = ai ? "email-imap+ai" : "email-imap";

  return {
    tag,
    mode,
    actionRequired: Boolean(actionRequired) || tag === "new_enquiry" || tag === "needs_human",
    reason,
    summary,
    classifier: ai ? "anthropic" : "heuristic",
    parsed: lite,
  };
}

/** Has this mail replied to one we already kept? (In-Reply-To / References carry the earlier mail's id.) Costs a few reads, no AI. */
async function repliesToKept(db, mailboxKey, parsedMail) {
  if (!parsedMail) return false;
  const refs = [parsedMail.inReplyTo, ...(Array.isArray(parsedMail.references) ? parsedMail.references : [parsedMail.references])].filter((x) => typeof x === "string" && x).slice(-5);
  for (const ref of new Set(refs)) {
    const id = crypto.createHash("sha1").update(`${mailboxKey}:${ref}`).digest("hex").slice(0, 24);
    const hit = await db.collection("inbox_enquiries").doc(id).get();
    if (hit.exists) return true;
  }
  return false;
}

async function getSenderStats(db, key, cache) {
  if (cache.has(key)) return cache.get(key);
  const snap = await db.collection("inbox_senders").doc(key).get();
  const st = snap.exists ? snap.data() : { asked: 0, kept: 0 };
  cache.set(key, st);
  return st;
}

async function recordSender(db, key, kept, cache) {
  const st = await getSenderStats(db, key, cache);
  const next = { asked: (st.asked || 0) + 1, kept: (st.kept || 0) + (kept ? 1 : 0), updatedAt: Date.now() };
  cache.set(key, next);
  await db.collection("inbox_senders").doc(key).set(next, { merge: true });
}

const MAX_CIRCULAR_BYTES = 20 * 1024 * 1024;

/**
 * Files the document attachments of a circular/tariff mail into the Circulars library: stored in the bucket, recorded in
 * circularsLibrary (which starts the circular reader), and skipped when the very same file is already there.
 * Returns how many files were filed. Reading a file costs no AI credit; the reader decides what it needs.
 */
async function fileCircular(client, db, msg, mailbox, circ, meta) {
  let full = null;
  try {
    const one = await client.fetchOne(String(msg.uid), { source: { maxLength: MAX_CIRCULAR_BYTES }, uid: true }, { uid: true });
    full = one && one.source ? await simpleParser(one.source) : null;
  } catch (err) {
    functions.logger.warn("circular mail could not be fetched", { mailbox: mailbox.key, uid: msg.uid, message: err instanceof Error ? err.message : String(err) });
  }
  if (!full) return 0;
  const docs = (full.attachments || []).filter((a) => C.documentAttachments([{ filename: a.filename, contentType: a.contentType, size: a.size }]).length).slice(0, 4);
  let filed = 0;
  for (const a of docs) {
    const hash = crypto.createHash("sha1").update(a.content).digest("hex");
    const dup = await db.collection("circularsLibrary").where("contentHash", "==", hash).limit(1).get();
    if (!dup.empty) continue;
    const safeName = String(a.filename || "circular").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `circulars/${circ.category || "general"}/${Date.now()}_${safeName}`;
    const bucket = admin.storage().bucket();
    const token = crypto.randomUUID();
    await bucket.file(storagePath).save(a.content, { contentType: a.contentType || "application/octet-stream", metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
    await db.collection("circularsLibrary").add({
      title: docs.length > 1 ? `${circ.title} (${a.filename})`.slice(0, 120) : circ.title,
      carrier: circ.carrier,
      category: circ.category,
      notes: `Received by email from ${meta.fromName ? `${meta.fromName} <${meta.fromAddr}>` : meta.fromAddr}: ${String(meta.subject || "").slice(0, 120)}`,
      effectiveDate: "",
      expiryDate: "",
      validTo: "",
      fileName: a.filename || safeName,
      downloadURL,
      storagePath,
      uploadedBy: "",
      source: "email",
      contentHash: hash,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    filed += 1;
  }
  return filed;
}


// ---------------------------------------------------------------------------------------------------------------------
// Automatic acknowledgements and shipment confirmations
// ---------------------------------------------------------------------------------------------------------------------

const SMTP = { host: "czipop.logix.in", port: 465, secure: true };
const DEFAULT_AUTO = { ackEnquiry: false, ackConfirmation: false, testRedirect: "", dailyCap: 150, branchTeams: [], nrsDesk: "NRS Desk" };
const ISTDAY = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const sha = (x) => crypto.createHash("sha1").update(String(x)).digest("hex").slice(0, 24);

/** The admin's switches. Everything is OFF until the admin turns it on (Admin > Automatic replies). */
async function loadAutoSettings(db) {
  try {
    const snap = await db.collection("inboxAutoReply").doc("settings").get();
    const v = snap.exists ? snap.data() : {};
    return {
      ackEnquiry: v.ackEnquiry === true,
      ackConfirmation: v.ackConfirmation === true,
      testRedirect: R.isAddress(v.testRedirect) ? String(v.testRedirect).trim() : "",
      dailyCap: Number.isFinite(Number(v.dailyCap)) && Number(v.dailyCap) > 0 ? Math.min(Number(v.dailyCap), 500) : DEFAULT_AUTO.dailyCap,
      branchTeams: Array.isArray(v.branchTeams) ? v.branchTeams : [],
      nrsDesk: String(v.nrsDesk || DEFAULT_AUTO.nrsDesk).slice(0, 40),
    };
  } catch {
    return { ...DEFAULT_AUTO };
  }
}

/**
 * Sends one automatic reply, once. Guards: one reply per thread and kind; a daily ceiling; a test address that takes every
 * message instead of the real recipients while the admin is testing. Never throws: a failure is logged and the mail is simply
 * not answered. Returns "sent" | "skipped" | "failed".
 */
async function sendAuto(ctx, o) {
  const { db, mailbox, password, settings } = ctx;
  try {
    const dedupeId = sha(`${mailbox.key}|${o.kind}|${o.threadKey}`);
    const seen = await db.collection("inbox_acks").doc(dedupeId).get();
    if (seen.exists) return "skipped";
    const capRef = db.collection("inbox_ack_caps").doc(ISTDAY());
    const used = ((await capRef.get()).data() || {}).count || 0;
    if (used >= settings.dailyCap) {
      functions.logger.warn("automatic reply ceiling reached", { cap: settings.dailyCap });
      return "skipped";
    }
    await db.collection("inbox_acks").doc(dedupeId).set({ kind: o.kind, mailbox: mailbox.key, at: Date.now() }); // before sending, so a failure never repeats
    await capRef.set({ count: used + 1, day: ISTDAY() }, { merge: true });

    const redirected = !!settings.testRedirect;
    const to = redirected ? settings.testRedirect : o.to;
    const cc = redirected ? [] : (o.cc || []);
    const subject = redirected ? `[TEST - would go to ${o.to}${o.cc && o.cc.length ? ` cc ${o.cc.join(", ")}` : ""}] ${o.subject}` : o.subject;
    const transport = ctx.transport || (ctx.transport = nodemailer.createTransport({ host: SMTP.host, port: SMTP.port, secure: SMTP.secure, auth: { user: mailbox.user, pass: String(password).trim() } }));
    let status = "sent";
    let error = "";
    try {
      await transport.sendMail({
        from: `"${o.desk} - Atlas Logistics" <${mailbox.user}>`,
        to,
        ...(cc.length ? { cc } : {}),
        replyTo: mailbox.user,
        subject,
        text: o.text,
        inReplyTo: o.inReplyTo || undefined,
        references: o.references || undefined,
        attachments: (o.attachments || []).map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
        headers: { "Auto-Submitted": "auto-replied", "X-Auto-Response-Suppress": "All" },
      });
    } catch (err) {
      status = "failed";
      error = String((err && err.message) || err).slice(0, 200);
      functions.logger.warn("automatic reply failed", { mailbox: mailbox.key, kind: o.kind, message: error });
    }
    await db.collection("inbox_ack_log").add({ at: Date.now(), mailbox: mailbox.key, kind: o.kind, to, wouldGoTo: o.to, cc, subject: String(subject).slice(0, 160), attachments: (o.attachments || []).length, status, error, test: redirected });
    return status;
  } catch (err) {
    functions.logger.warn("automatic reply skipped", { message: err instanceof Error ? err.message : String(err) });
    return "failed";
  }
}

/** One AI call to read a confirmation (a small model; counted in AI usage as Mailbox reading). Returns the reply text or "". */
async function askConfirmAi(apiKey, content) {
  if (!apiKey) return "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 2500, thinking: { type: "adaptive" }, system: K.SYSTEM, messages: [{ role: "user", content }] }),
      });
      if (res.ok) {
        const j = await res.json();
        return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      }
      if (![429, 500, 502, 503, 529].includes(res.status)) return "";
    } catch {
      /* try once more */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return "";
}

const MAX_REPLY_ATTACH_BYTES = 15 * 1024 * 1024;

/**
 * A shipment confirmation: read the parties, record the shipment in NRS, tell the NRS desk, and (when the admin has turned it
 * on) answer the sender with the right branch team copied and the documents attached. The mail is not kept in the Inbox.
 * Returns true when it was handled (so the Inbox skips it).
 */
async function handleConfirmation(ctx, msg, parsedMail, meta) {
  const { db, client, mailbox, settings, apiKey } = ctx;
  let full = parsedMail;
  let fullLoaded = false;
  const loadFull = async () => {
    if (fullLoaded) return full;
    fullLoaded = true;
    try {
      const one = await client.fetchOne(String(msg.uid), { source: { maxLength: MAX_CIRCULAR_BYTES }, uid: true }, { uid: true });
      if (one && one.source) full = await simpleParser(one.source);
    } catch (err) {
      functions.logger.warn("confirmation mail could not be fetched in full", { message: err instanceof Error ? err.message : String(err) });
    }
    return full;
  };

  // 1) Read the parties from the text; the invoice and packing list only when the text does not name both.
  let shipment = K.parseConfirmation(await askConfirmAi(apiKey, [{ type: "text", text: `Subject: ${meta.subject}\nFrom: ${meta.fromName} <${meta.fromAddr}>\n\n${meta.bodyWork.slice(0, 6000)}` }]));
  let readDocuments = false;
  if (!K.partiesNamed(shipment)) {
    const docs = K.shipmentDocuments(meta.attachments);
    if (docs.length) {
      const f = await loadFull();
      const blocks = [];
      let bytes = 0;
      for (const a of (f && f.attachments) || []) {
        if (!K.shipmentDocuments([{ filename: a.filename, contentType: a.contentType, size: a.size }]).length) continue;
        if (!/pdf/i.test(a.contentType || "") && !/\.pdf$/i.test(a.filename || "")) continue; // images and sheets are left to a person
        if (bytes + a.size > 12 * 1024 * 1024 || blocks.length >= 3) break;
        bytes += a.size;
        blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.content.toString("base64") } });
      }
      if (blocks.length) {
        const again = K.parseConfirmation(await askConfirmAi(apiKey, [...blocks, { type: "text", text: `The confirmation email (subject: ${meta.subject}):\n${meta.bodyWork.slice(0, 3000)}\n\nRead the parties and the shipment from the documents and the email.` }]));
        if (again) shipment = again;
        readDocuments = true;
      }
    }
  }
  const s = shipment || K.parseConfirmation("{}");

  // 2) NRS: the booking, and a notice for the NRS desk.
  const id = `email_${sha(`${mailbox.key}|${meta.messageId}`)}`;
  const today = ISTDAY();
  const named = K.partiesNamed(s);
  await db.collection("nrs_registry").doc(id).set(
    {
      id,
      refId: s.reference || "",
      mode: s.mode,
      agent: s.agent.name || s.agent.company || meta.fromName || meta.fromAddr,
      pol: s.pol,
      pod: s.pod,
      shipperName: s.shipper.name,
      shipperPhone: s.shipper.phone,
      shipperEmail: s.shipper.email,
      shipperAddress: s.shipper.address,
      consigneeName: s.consignee.name,
      consigneePhone: s.consignee.phone,
      consigneeEmail: s.consignee.email,
      consigneeAddress: s.consignee.address,
      commodity: s.commodity,
      dateWon: today,
      creator: "email",
      pendingShipperDetails: !named,
      source: "email",
      fromEmail: meta.fromAddr,
      subject: String(meta.subject || "").slice(0, 200),
      followUps: [{ date: today, time: new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(11, 16), status: "Booking Confirmed by Shipper", note: `Confirmation received by email from ${meta.fromName || meta.fromAddr}.`, by: "email" }],
    },
    { merge: true },
  );
  const route = [s.pol, s.pod].filter(Boolean).join(" -> ");
  await db.collection("nrs_alerts").doc(id).set({
    id,
    date: today,
    message: `Shipment confirmed by email from ${meta.fromName || meta.fromAddr}${s.shipper.name || s.consignee.name ? `: ${s.shipper.name || "shipper not stated"} to ${s.consignee.name || "consignee not stated"}` : ""}${route ? ` (${route})` : ""}. Added to NRS${named ? "" : "; shipper or consignee details still needed"}.`,
    quoteRef: s.reference || "",
    dismissed: false,
  });

  // 3) The acknowledgement, with the branch team copied and the documents attached.
  let reply = "off";
  if (settings.ackConfirmation) {
    const ok = R.canAutoReply({ fromAddr: meta.fromAddr, headers: parsedMail ? parsedMail.headers : null, subject: meta.subject });
    if (!ok.ok) reply = `not sent: ${ok.reason}`;
    else {
      const team = R.branchFor(settings.branchTeams, { direction: s.direction, pol: s.pol, pod: s.pod });
      const cc = team ? R.splitEmails((team.emails || []).join(",")).filter((e) => e.toLowerCase() !== meta.fromAddr.toLowerCase()) : [];
      let attachments = [];
      if (meta.attachments.length) {
        const f = await loadFull();
        let total = 0;
        attachments = ((f && f.attachments) || [])
          .filter((a) => !a.related && a.filename)
          .filter((a) => {
            total += a.size || 0;
            return total <= MAX_REPLY_ATTACH_BYTES;
          })
          .map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType }));
      }
      const ack = R.confirmationAck({ fromName: meta.fromName, fromAddr: meta.fromAddr, subject: meta.subject, desk: settings.nrsDesk, branch: team ? team.branch : "", hasTeam: cc.length > 0, attached: attachments.length > 0, shipper: s.shipper.name, consignee: s.consignee.name, route: route.replace("->", "to") });
      reply = await sendAuto(ctx, { kind: "confirmation", threadKey: R.threadRoot(parsedMail || { messageId: meta.messageId }), to: meta.fromAddr, cc, desk: settings.nrsDesk, subject: ack.subject, text: ack.text, inReplyTo: meta.messageId, references: [...(parsedMail && Array.isArray(parsedMail.references) ? parsedMail.references : []), meta.messageId].filter(Boolean), attachments });
      if (!team) {
        await db.collection("nrs_alerts").doc(`${id}_team`).set({ id: `${id}_team`, date: today, message: `No branch team is set up for ${s.pod || s.pol || "this shipment"}: the acknowledgement went without a branch team copied. Add the branch in Admin > Automatic replies.`, quoteRef: s.reference || "", dismissed: false });
      }
    }
  }
  return { handled: true, reply, readDocuments, named };
}

async function pollOne(mailbox, password, apiKey) {
  if (!password) {
    functions.logger.warn("IMAP password secret empty — skip", { mailbox: mailbox.key });
    return { mailbox: mailbox.key, imported: 0, skippedNoise: 0, skipped: true };
  }

  const client = new ImapFlow({
    host: IMAP.host,
    port: IMAP.port,
    secure: IMAP.secure,
    // A secret saved from a terminal often carries a hidden new-line or space at the end, which the mail server rejects.
    auth: { user: mailbox.user, pass: String(password).trim() },
    logger: false,
  });

  const db = admin.firestore();
  const autoSettings = await loadAutoSettings(db);
  const autoCtx = { db, client, mailbox, password, settings: autoSettings, apiKey };
  let imported = 0;
  let skippedNoise = 0;
  let failedMessages = 0;
  let scanned = 0;
  let ruleNoise = 0;
  let aiNoise = 0;
  let aiUsed = 0;
  let circularsFiled = 0;
  let confirmationsHandled = 0;
  let acksSent = 0;
  const senderCache = new Map();

  await client.connect();
  try {
    const lock = await client.getMailboxLock(IMAP.folder);
    try {
      // Read only mail newer than the last one handled (the number is kept in Firestore). Nothing is changed in the mailbox.
      const stateRef = db.collection("inbox_poll_state").doc(mailbox.key);
      const state = (await stateRef.get()).data() || {};
      const firstRun = typeof state.lastUid !== "number";
      let uids = [];
      let tip = null;
      if (firstRun) {
        const tipMsg = await client.fetchOne("*", { uid: true });
        tip = tipMsg && tipMsg.uid ? tipMsg.uid : null;
        const recent = await client.search({ since: new Date(Date.now() - FIRST_RUN_DAYS * 86_400_000) }, { uid: true });
        uids = P.nextUids(recent, 0, MAX_PER_RUN, true);
      } else {
        const newer = await client.fetchAll(`${state.lastUid + 1}:*`, { uid: true }, { uid: true });
        uids = P.nextUids(newer.map((m) => m.uid), state.lastUid, MAX_PER_RUN, false);
      }

      // UIDs, not sequence numbers (the third argument says so). All collected first: no mail-server command runs while reading them.
      const messages = uids.length ? await client.fetchAll(uids, { envelope: true, bodyStructure: true, source: { maxLength: 150000 }, uid: true }, { uid: true }) : [];

      for (const msg of messages) {
        try {
        const messageId = msg.envelope?.messageId || `uid-${mailbox.key}-${msg.uid}`;
        const docId = crypto
          .createHash("sha1")
          .update(`${mailbox.key}:${messageId}`)
          .digest("hex")
          .slice(0, 24);

        const existing = await db.collection("inbox_enquiries").doc(docId).get();
        if (existing.exists) continue;

        scanned += 1;
        // The mail's own readable text (decoded), not its raw source. A work buffer only: never stored in full.
        let parsedMail = null;
        try {
          parsedMail = msg.source ? await simpleParser(msg.source) : null;
        } catch {
          parsedMail = null;
        }
        const subject = msg.envelope?.subject || "(no subject)";
        const fullText = parsedMail && (parsedMail.text || stripHtml(parsedMail.html || "")) ? String(parsedMail.text || stripHtml(parsedMail.html || "")) : stripHtml(msg.source ? msg.source.toString("utf8") : "");
        // Only what is new in the mail: a reply's old conversation underneath is left out, so it neither looks like a new enquiry nor costs AI words.
        const bodyWork = F.latestText(subject, fullText).replace(/\s+/g, " ").trim().slice(0, 8000);
        const from =
          (msg.envelope?.from || [])
            .map((a) => a.address || [a.name, a.address].filter(Boolean).join(" "))
            .join(", ") || "";

        // 0) A tariff or circular from an airline, liner, courier or transporter is filed into the Circulars tab by itself
        //    (the circular reader then picks it up) and the mail is not kept in the app at all.
        const attachments = (() => {
          const fromStructure = P.attachmentsFromStructure(msg.bodyStructure);
          return fromStructure.length ? fromStructure : parsedMail ? parsedMail.attachments : [];
        })();
        const fromAddr = String(msg.envelope?.from?.[0]?.address || "");
        const fromName = String(msg.envelope?.from?.[0]?.name || "");
        if (!F.headerFlags(parsedMail ? parsedMail.headers : null).auto) {
          const askedForQuote = F.ASK.test(`${subject}\n${bodyWork}`) || F.ASK_SHORT.test(`${subject}\n${bodyWork}`);
          const circ = C.classifyCircularMail({ from: fromAddr, fromName, subject, body: bodyWork, attachments, askedForQuote });
          if (circ.isCircular) {
            const filed = await fileCircular(client, db, msg, mailbox, circ, { fromAddr, fromName, subject });
            circularsFiled += filed;
            if (filed > 0) continue; // filed: nothing is kept in the Inbox
            // nothing could be filed (a duplicate or no usable file): it still is not an enquiry
            continue;
          }
        }

        // 0b) A shipment confirmation (with the parties or the shipping documents) goes to NRS and is acknowledged.
        if (!F.headerFlags(parsedMail ? parsedMail.headers : null).auto) {
          const asked = F.ASK.test(`${subject}\n${bodyWork}`) || F.ASK_SHORT.test(`${subject}\n${bodyWork}`);
          const conf = K.detectConfirmation({ subject, body: bodyWork, attachments, askedForQuote: asked });
          if (conf.isConfirmation) {
            try {
              const done = await handleConfirmation(autoCtx, msg, parsedMail, { subject, bodyWork, attachments, fromAddr, fromName, messageId });
              if (done && done.handled) {
                confirmationsHandled += 1;
                continue;
              }
            } catch (err) {
              // Never lose a confirmation: if NRS could not be updated, it falls through and is kept in the Inbox for a person.
              functions.logger.error("confirmation could not be processed", { mailbox: mailbox.key, message: err instanceof Error ? err.message : String(err) });
            }
          }
        }

        // 1) Free rules first: automatic mail, newsletters, bounces and mail with no enquiry in it are dropped here, with no AI credit.
        const verdict = F.prefilter({ headers: parsedMail ? parsedMail.headers : null, from: msg.envelope?.from?.[0]?.address || "", subject, body: bodyWork, attachments });
        if (verdict.verdict === "noise") {
          ruleNoise += 1;
          skippedNoise += 1;
          continue;
        }
        // 2) A clear enquiry is kept without the AI. Only the unclear ones can be sent to the small AI model, and even then
        //    not when the mail is a reply on a thread already kept, or comes from someone who has never sent an enquiry.
        let askAi = verdict.verdict === "maybe" && aiUsed < MAX_AI_PER_RUN;
        let replyOnKept = false;
        const senderAddr = String(msg.envelope?.from?.[0]?.address || "").toLowerCase();
        const senderKey = P.senderKey(senderAddr);
        if (verdict.verdict === "maybe") {
          replyOnKept = await repliesToKept(db, mailbox.key, parsedMail);
          if (replyOnKept) askAi = false;
          else if (senderKey) {
            const st = await getSenderStats(db, senderKey, senderCache);
            if (P.senderNeverEnquires(st)) {
              ruleNoise += 1;
              skippedNoise += 1;
              continue;
            }
          }
        }
        if (askAi) aiUsed += 1;
        const classified = await classifyAndExtract(askAi ? apiKey : "", subject, bodyWork);
        if (replyOnKept && !ACTIONABLE.has(classified.tag)) {
          classified.tag = "follow_up";
          classified.actionRequired = /\b(urgent|pending|awaiting|still waiting|follow.?up|any update)\b/i.test(`${subject} ${bodyWork}`);
          classified.reason = "A reply on an enquiry already in the list";
        }
        if (askAi && senderKey) {
          // Remember how this sender turned out, so a sender who only ever sends noise stops costing AI credit.
          const kept = ACTIONABLE.has(classified.tag);
          await recordSender(db, senderKey, kept, senderCache);
        }
        if (verdict.verdict === "sure" && !ACTIONABLE.has(classified.tag)) {
          classified.tag = "new_enquiry";
          classified.actionRequired = true;
          classified.reason = verdict.reason;
        }

        if (classified.tag === "noise" || !ACTIONABLE.has(classified.tag)) {
          aiNoise += 1;
          skippedNoise += 1;
          continue;
        }

        const assignment = assignUsers(mailbox.key, classified.mode);

        // Slim Firestore doc — no full body.
        await db.collection("inbox_enquiries").doc(docId).set({
          mailbox: mailbox.key,
          mailboxEmail: mailbox.user,
          messageId,
          uid: msg.uid,
          from,
          subject: subject.slice(0, 300),
          receivedAt: (msg.envelope?.date || new Date()).toISOString(),
          timestamp: Date.now(),
          bodyPreview: bodyWork.slice(0, 240),
          body: "", // intentionally empty — storage-safe; mail stays on IMAP
          mode: classified.mode,
          confidence: classified.parsed.confidence,
          assignedUsers: assignment.assignedUsers,
          suggestedUser: assignment.suggestedUser,
          claimedBy: null,
          status: "new",
          tag: classified.tag,
          actionRequired: classified.actionRequired,
          reason: classified.reason,
          summary: classified.summary,
          classifier: classified.classifier,
          // Firestore refuses fields that are undefined (e.g. a missing package length): drop them.
          parsed: JSON.parse(JSON.stringify(classified.parsed)),
        });
        imported += 1;
        // An acknowledgement goes to a real enquiry (not to a follow-up or an unclear one), once per thread, when the admin has turned it on.
        if (autoSettings.ackEnquiry && classified.tag === "new_enquiry") {
          const ok = R.canAutoReply({ fromAddr, headers: parsedMail ? parsedMail.headers : null, subject });
          if (ok.ok) {
            const desk = R.deskLabel(mailbox.key, classified.mode);
            const ack = R.enquiryAck({ fromName, fromAddr, subject, desk });
            const refs = parsedMail && Array.isArray(parsedMail.references) ? parsedMail.references : [];
            const r = await sendAuto(autoCtx, { kind: "enquiry", threadKey: R.threadRoot(parsedMail || { messageId }), to: fromAddr, cc: [], desk, subject: ack.subject, text: ack.text, inReplyTo: messageId, references: [...refs, messageId] });
            if (r === "sent") acksSent += 1;
          }
        }
        } catch (err) {
          // One bad message must not stop the rest, or hold the cursor back for ever.
          failedMessages += 1;
          functions.logger.error("Inbox message skipped", { mailbox: mailbox.key, uid: msg.uid, message: err instanceof Error ? err.message : String(err) });
        }
      }
      await stateRef.set({ lastUid: P.nextCursor(state.lastUid, uids, tip, firstRun), at: Date.now() }, { merge: true });
      // A running count per day, so the admin can see how many mails were sorted out for free and how many needed the AI.
      if (scanned || circularsFiled || confirmationsHandled) {
        const day = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
        const inc = admin.firestore.FieldValue.increment;
        await db.collection("inbox_stats").doc(`${day}_${mailbox.key}`).set({ day, mailbox: mailbox.key, scanned: inc(scanned), ruleNoise: inc(ruleNoise), aiAsked: inc(aiUsed), aiNoise: inc(aiNoise), kept: inc(imported), circulars: inc(circularsFiled), confirmations: inc(confirmationsHandled), acks: inc(acksSent), updatedAt: Date.now() }, { merge: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }

  return { mailbox: mailbox.key, imported, skippedNoise, failedMessages, circularsFiled, confirmationsHandled, acksSent };
}

exports.pollPricingInboxes = functions
  .runWith({
    secrets: [pricingPassword, salesPassword, anthropicApiKey],
    timeoutSeconds: 300,
    memory: "1GB",
  })
  .pubsub.schedule("every 2 minutes")
  .onRun(async () => {
    let apiKey = "";
    try {
      apiKey = anthropicApiKey.value() || "";
    } catch {
      apiKey = "";
    }

    const results = [];
    for (const box of MAILBOXES) {
      try {
        results.push(await pollOne(box, box.secret.value(), apiKey));
      } catch (err) {
        // imapflow's own message is only "Command failed"; the mail server's actual reason is on the error object.
        const why = {
          message: err instanceof Error ? err.message : String(err),
          serverSays: err && err.responseText ? String(err.responseText).slice(0, 200) : "",
          serverStatus: err && err.responseStatus ? String(err.responseStatus) : "",
          serverCode: err && err.serverResponseCode ? String(err.serverResponseCode) : "",
          loginRefused: Boolean(err && err.authenticationFailed),
          where: err && err.executedCommand ? String(err.executedCommand).split(" ")[0] : "",
          code: err && err.code ? String(err.code) : "",
        };
        functions.logger.error("IMAP poll failed", { mailbox: box.key, ...why });
        results.push({ mailbox: box.key, error: why.serverSays || why.message, ...why });
      }
    }
    functions.logger.info("IMAP slim intake complete", { results, ai: Boolean(apiKey) });
    return results;
  });

/**
 * One email, whole, fetched from the mailbox when somebody chooses to action it (the app keeps only a short preview).
 * Returns the raw message as base64, which the app reads like a dropped .eml file: body and attachments.
 * Reading it costs no AI credit; the AI is used afterwards, once, only for the emails people action.
 */
const MAX_EML_BYTES = 6.5 * 1024 * 1024; // a callable's reply is capped at 10 MB, and base64 adds a third
exports.fetchInboxEmail = functions
  .runWith({ secrets: [pricingPassword, salesPassword], timeoutSeconds: 60, memory: "512MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.chatOnly === true) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in is required.");
    }
    const id = String((data && data.id) || "");
    if (!id) throw new functions.https.HttpsError("invalid-argument", "Which email?");
    const snap = await admin.firestore().collection("inbox_enquiries").doc(id).get();
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "That enquiry is no longer in the list.");
    const item = snap.data();
    const box = MAILBOXES.find((b) => b.key === item.mailbox);
    if (!box) throw new functions.https.HttpsError("failed-precondition", "That mailbox is not set up.");
    const password = String(box.secret.value() || "").trim();
    if (!password) throw new functions.https.HttpsError("failed-precondition", "The mailbox password is not set up.");

    const client = new ImapFlow({ host: IMAP.host, port: IMAP.port, secure: IMAP.secure, auth: { user: box.user, pass: password }, logger: false });
    try {
      await client.connect();
    } catch (err) {
      functions.logger.warn("fetchInboxEmail: could not connect", { message: err instanceof Error ? err.message : String(err) });
      throw new functions.https.HttpsError("unavailable", "The mailbox did not answer. Try again in a minute.");
    }
    try {
      const lock = await client.getMailboxLock(IMAP.folder);
      try {
        let uid = null;
        if (item.messageId && !String(item.messageId).startsWith("uid-")) {
          const found = await client.search({ header: { "message-id": item.messageId } }, { uid: true });
          if (Array.isArray(found) && found.length) uid = found[found.length - 1];
        }
        if (!uid && Number.isInteger(item.uid)) uid = item.uid;
        if (!uid) throw new functions.https.HttpsError("not-found", "The email is no longer in the mailbox.");
        const msg = await client.fetchOne(String(uid), { source: { maxLength: MAX_EML_BYTES }, uid: true }, { uid: true });
        if (!msg || !msg.source) throw new functions.https.HttpsError("not-found", "The email is no longer in the mailbox.");
        const truncated = msg.source.length >= MAX_EML_BYTES;
        return { eml: msg.source.toString("base64"), size: msg.source.length, truncated };
      } finally {
        lock.release();
      }
    } finally {
      try {
        await client.logout();
      } catch {
        client.close();
      }
    }
  });

/**
 * Nothing stays in the app longer than it is needed. Run once a day:
 *  - an enquiry still unopened after 30 days, or opened (applied, claimed, dismissed) more than 7 days ago, is removed;
 *    an enquiry whose quote is saved is removed at once by the app, this is the safety net
 *  - Quote Hub jobs already opened or dismissed more than 7 days ago are removed
 *  - the small daily counters are kept 90 days
 * Mail itself is never touched: it stays on the mail server.
 */
const DAY = 24 * 3600 * 1000;
async function deleteOld(db, collection, field, olderThanMs, filterFn, label) {
  const cutoff = Date.now() - olderThanMs;
  const snap = await db.collection(collection).where(field, "<", cutoff).limit(400).get();
  const docs = [];
  snap.forEach((d) => {
    if (!filterFn || filterFn(d.data())) docs.push(d);
  });
  for (let i = 0; i < docs.length; i += 200) {
    const batch = db.batch();
    docs.slice(i, i + 200).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  functions.logger.info("inbox cleanup", { label, removed: docs.length });
  return docs.length;
}

exports.inboxCleanup = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .pubsub.schedule("every day 03:00")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    const db = admin.firestore();
    const done = {};
    done.opened = await deleteOld(db, "inbox_enquiries", "timestamp", 7 * DAY, (d) => d.status && d.status !== "new", "opened enquiries");
    done.unopened = await deleteOld(db, "inbox_enquiries", "timestamp", 30 * DAY, null, "unopened enquiries");
    // Quote Hub jobs keep their date as text (ISO), which sorts the same way.
    const isoCut = new Date(Date.now() - 7 * DAY).toISOString();
    const jobSnap = await db.collection("quoteHubJobs").where("createdAt", "<", isoCut).limit(400).get();
    const oldJobs = [];
    jobSnap.forEach((d) => {
      const v = d.data();
      if (v.status === "opened" || v.status === "dismissed") oldJobs.push(d);
    });
    for (let i = 0; i < oldJobs.length; i += 200) {
      const batch = db.batch();
      oldJobs.slice(i, i + 200).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    done.jobs = oldJobs.length;
    done.stats = await deleteOld(db, "inbox_stats", "updatedAt", 90 * DAY, null, "daily counters");
    return done;
  });

/**
 * Admin only: sends a sample enquiry acknowledgement and a sample confirmation acknowledgement (with a pretend branch team
 * copied and a small attachment) to ONE address the admin types, from the chosen mailbox, to prove sending works before the
 * switches are turned on. Nothing goes to anyone else.
 */
exports.autoReplyTest = functions
  .runWith({ secrets: [pricingPassword, salesPassword], timeoutSeconds: 60, memory: "256MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.chatOnly === true || String(context.auth.token.email || "").toLowerCase() !== "ganny@atlaspricing.com") {
      throw new functions.https.HttpsError("permission-denied", "Only the admin can do this.");
    }
    const to = String((data && data.to) || "").trim();
    if (!R.isAddress(to)) throw new functions.https.HttpsError("invalid-argument", "Type an email address to send the test to.");
    const box = MAILBOXES.find((b) => b.key === String((data && data.mailbox) || "pricing")) || MAILBOXES[0];
    const transport = nodemailer.createTransport({ host: SMTP.host, port: SMTP.port, secure: SMTP.secure, auth: { user: box.user, pass: String(box.secret.value() || "").trim() } });
    try {
      await transport.verify();
    } catch (err) {
      throw new functions.https.HttpsError("unavailable", `The mail server did not accept the login: ${String((err && err.message) || err).slice(0, 160)}`);
    }
    const desk = R.deskLabel(box.key, "air");
    const a = R.enquiryAck({ fromName: "Sample Customer", fromAddr: "sample@customer.com", subject: "Rates BLR to FRA, 3 cartons 180 kg", desk });
    const c = R.confirmationAck({ fromName: "Sample Agent", fromAddr: "agent@example.com", subject: "Booking confirmed FRA to BLR", desk: "NRS Desk", branch: "Bangalore", hasTeam: true, attached: true, shipper: "ABC GmbH", consignee: "XYZ India Pvt Ltd", route: "FRA to BLR" });
    try {
      for (const m of [{ ...a, cc: [], att: [] }, { ...c, cc: [], att: [{ filename: "sample-packing-list.txt", content: Buffer.from("Sample attachment: the documents received with a confirmation are attached like this.") }] }]) {
        await transport.sendMail({ from: `"${desk} - Atlas Logistics" <${box.user}>`, to, subject: `[TEST] ${m.subject}`, text: `${m.text}\n\n(This is a test message. Nothing was sent to anyone else.)`, attachments: m.att, headers: { "Auto-Submitted": "auto-replied" } });
      }
    } catch (err) {
      throw new functions.https.HttpsError("unavailable", `The mail server refused the test: ${String((err && err.message) || err).slice(0, 160)}`);
    }
    return { ok: true, sent: 2, from: box.user };
  });
