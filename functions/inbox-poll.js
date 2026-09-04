/**
 * Poll Atlas shared mailboxes over IMAP (Logix / czipop.logix.in:993).
 * Passwords are Firebase secrets — never committed.
 *
 * Set once:
 *   firebase functions:secrets:set IMAP_PRICING_PASSWORD
 *   firebase functions:secrets:set IMAP_PRICINGSALES_PASSWORD
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");
const { ImapFlow } = require("imapflow");

const pricingPassword = defineSecret("IMAP_PRICING_PASSWORD");
const salesPassword = defineSecret("IMAP_PRICINGSALES_PASSWORD");

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

function detectMode(text) {
  const sea = /\b(fcl|lcl|container|cbm|liner|maersk|innsa|nlrtm)\b/i.test(text);
  const air = /\b(air|awb|airline|kg|kgs|emirates|qatar|blr|lhr)\b/i.test(text);
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
  const cust = text.match(/(?:customer|client|shipper)\s*[:\-]\s*([^\n,;]+)/i);
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
    result.mode = /\blcl\b/i.test(text) ? "lcl" : /\bbb\b|break\s*bulk/i.test(text) ? "bb" : "fcl";
    const cont = text.match(/(\d+)\s*[x×*]\s*(20|40|45)\s*['']?\s*(gp|hc|hq)/i);
    if (cont) {
      result.containers.push({
        type: `${cont[2]}'${cont[3].toUpperCase() === "HQ" ? "HC" : cont[3].toUpperCase()}`,
        qty: parseInt(cont[1], 10) || 1,
      });
      result.confidence = Math.min(100, result.confidence + 15);
    }
    const ton = text.match(/(\d+(?:\.\d+)?)\s*(?:mt|tons?)\b/i);
    if (ton) result.grossWeight = parseFloat(ton[1]) * 1000;
  } else {
    const gw = text.match(/(?:gross|total)?\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(?:kg|kgs)?/i);
    const dim = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
    const qty = text.match(/(\d+)\s*(?:pcs|pieces|pkgs)/i);
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

function extractCode(value, mode) {
  const v = String(value || "").trim();
  if (mode === "sea") {
    const m5 = v.match(/\b([A-Z]{2}[A-Z0-9]{3})\b/);
    if (m5) return m5[1];
  }
  const m3 = v.match(/\b([A-Z]{3})\b/);
  return m3 ? m3[1] : v.slice(0, 40);
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function pollOne(mailbox, password) {
  if (!password) {
    functions.logger.warn("IMAP password secret empty — skip", { mailbox: mailbox.key });
    return { mailbox: mailbox.key, imported: 0, skipped: true };
  }

  const client = new ImapFlow({
    host: IMAP.host,
    port: IMAP.port,
    secure: IMAP.secure,
    auth: { user: mailbox.user, pass: password },
    logger: false,
  });

  const db = admin.firestore();
  let imported = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock(IMAP.folder);
    try {
      const unseen = await client.search({ seen: false }, { uid: true });
      const uids = Array.isArray(unseen) ? unseen.slice(-40) : [];
      for await (const msg of client.fetch(uids, { envelope: true, source: true, uid: true })) {
        const messageId = msg.envelope?.messageId || `uid-${mailbox.key}-${msg.uid}`;
        const docId = crypto.createHash("sha1").update(`${mailbox.key}:${messageId}`).digest("hex").slice(0, 24);
        const existing = await db.collection("inbox_enquiries").doc(docId).get();
        if (existing.exists) continue;

        const raw = msg.source ? msg.source.toString("utf8") : "";
        const body = stripHtml(raw).slice(0, 12000);
        const subject = msg.envelope?.subject || "(no subject)";
        const from =
          (msg.envelope?.from || [])
            .map((a) => a.address || [a.name, a.address].filter(Boolean).join(" "))
            .join(", ") || "";
        const mode = detectMode(`${subject}\n${body}`);
        const assignment = assignUsers(mailbox.key, mode);
        const parsed = parseLite(`${subject}\n${body}`, mode);

        await db.collection("inbox_enquiries").doc(docId).set({
          mailbox: mailbox.key,
          mailboxEmail: mailbox.user,
          messageId,
          from,
          subject,
          receivedAt: (msg.envelope?.date || new Date()).toISOString(),
          timestamp: Date.now(),
          bodyPreview: body.slice(0, 280),
          body,
          mode,
          confidence: parsed.confidence,
          assignedUsers: assignment.assignedUsers,
          suggestedUser: assignment.suggestedUser,
          claimedBy: null,
          status: "new",
          parsed,
        });
        imported += 1;
        try {
          await client.messageFlagsAdd(msg.uid, ["\\Seen"], { uid: true });
        } catch {
          /* flag optional */
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => client.close());
  }

  return { mailbox: mailbox.key, imported };
}

exports.pollPricingInboxes = functions
  .runWith({ secrets: [pricingPassword, salesPassword], timeoutSeconds: 120, memory: "256MB" })
  .pubsub.schedule("every 2 minutes")
  .onRun(async () => {
    const results = [];
    for (const box of MAILBOXES) {
      try {
        results.push(await pollOne(box, box.secret.value()));
      } catch (err) {
        functions.logger.error("IMAP poll failed", { mailbox: box.key, message: err.message });
        results.push({ mailbox: box.key, error: err.message });
      }
    }
    functions.logger.info("IMAP poll complete", { results });
    return results;
  });
