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
  const excerpt = body.slice(0, 3500);
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
      max_tokens: 400,
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

async function pollOne(mailbox, password, apiKey) {
  if (!password) {
    functions.logger.warn("IMAP password secret empty — skip", { mailbox: mailbox.key });
    return { mailbox: mailbox.key, imported: 0, skippedNoise: 0, skipped: true };
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
  let skippedNoise = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock(IMAP.folder);
    try {
      // Prefer unseen; cap batch so AI + IMAP stay within timeout.
      const unseen = await client.search({ seen: false }, { uid: true });
      const uids = Array.isArray(unseen) ? unseen.slice(-25) : [];

      for await (const msg of client.fetch(uids, { envelope: true, source: true, uid: true })) {
        const messageId = msg.envelope?.messageId || `uid-${mailbox.key}-${msg.uid}`;
        const docId = crypto
          .createHash("sha1")
          .update(`${mailbox.key}:${messageId}`)
          .digest("hex")
          .slice(0, 24);

        const existing = await db.collection("inbox_enquiries").doc(docId).get();
        if (existing.exists) {
          try {
            await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"]);
          } catch {
            /* optional */
          }
          continue;
        }

        const raw = msg.source ? msg.source.toString("utf8") : "";
        // Work buffer only — never persisted in full.
        const bodyWork = stripHtml(raw).slice(0, 8000);
        const subject = msg.envelope?.subject || "(no subject)";
        const from =
          (msg.envelope?.from || [])
            .map((a) => a.address || [a.name, a.address].filter(Boolean).join(" "))
            .join(", ") || "";

        const classified = await classifyAndExtract(apiKey, subject, bodyWork);

        // Mark seen either way so we do not re-process noise forever.
        try {
          await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"]);
        } catch {
          /* optional */
        }

        if (classified.tag === "noise" || !ACTIONABLE.has(classified.tag)) {
          skippedNoise += 1;
          continue;
        }

        const assignment = assignUsers(mailbox.key, classified.mode);

        // Slim Firestore doc — no full body.
        await db.collection("inbox_enquiries").doc(docId).set({
          mailbox: mailbox.key,
          mailboxEmail: mailbox.user,
          messageId,
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
          parsed: classified.parsed,
        });
        imported += 1;
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

  return { mailbox: mailbox.key, imported, skippedNoise };
}

exports.pollPricingInboxes = functions
  .runWith({
    secrets: [pricingPassword, salesPassword, anthropicApiKey],
    timeoutSeconds: 180,
    memory: "512MB",
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
        functions.logger.error("IMAP poll failed", {
          mailbox: box.key,
          message: err instanceof Error ? err.message : String(err),
        });
        results.push({
          mailbox: box.key,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    functions.logger.info("IMAP slim intake complete", { results, ai: Boolean(apiKey) });
    return results;
  });
