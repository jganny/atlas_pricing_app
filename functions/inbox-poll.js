/**
 * Poll Atlas shared mailboxes over IMAP (Logix / csipop.logix.in:993).
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
  host: "csipop.logix.in",
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
  const cust = text.match(/(?:customer|client|shipper|for)[:\s]+([^\n,;]+)/i);
  if (cust) result.customer = cust[1].trim();
  const polPod = text.match(/\bpol\b[:\s]*([A-Z]{3,5})[\s\S]*?\bpod\b[:\s]*([A-Z]{3,5})/i);
  if (polPod) {
    result.origin = polPod[1].toUpperCase();
    result.destination = polPod[2].toUpperCase();
    result.confidence = 70;
  }
  if (mode === "sea") result.mode = /\blcl\b/i.test(text) ? "lcl" : "fcl";
  return result;
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
