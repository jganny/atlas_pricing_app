/**
 * readRateEmail: reads vendor / agent emails into rates. AI (Haiku 5.5, one short read per email, about ₹0.30 or less each), only when a
 * person presses the button, behind the AI on/off switch and the budget guard like every other AI feature. The fixed rules in
 * rate-email-logic.js decide the currency, the airline and what still needs a person.
 */
const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const L = require("./rate-email-logic");

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const MAX_EMAILS = 6;

async function readOne(apiKey, mail, ctx, pdfs = []) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(L.requestBody(mail, ctx, "claude-haiku-5-5", pdfs)),
  });
  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      /* ignore */
    }
    // The AI switch, the budget guard and the account limit all answer with a plain sentence: pass it on as it is.
    if (response.status === 403 || /switched off|budget|usage limits?|credit balance/i.test(detail)) {
      let message = "AI is not available right now, so these rates need to be typed in by hand.";
      try {
        const j = JSON.parse(detail);
        if (j && j.error && typeof j.error.message === "string") message = j.error.message;
      } catch {
        /* keep the default */
      }
      throw new functions.https.HttpsError("resource-exhausted", message);
    }
    functions.logger.warn("readRateEmail: API error", { status: response.status, detail: detail.slice(0, 300) });
    throw new functions.https.HttpsError("unavailable", "Reading the email is temporarily unavailable. Try again.");
  }
  const record = L.pickRecord(await response.json());
  if (!record) throw new functions.https.HttpsError("internal", "The email could not be read into rates. Try again, or type the rates in.");
  return L.finishRead(record, mail, ctx);
}

exports.readRateEmail = functions.runWith({ secrets: [anthropicApiKey], timeoutSeconds: 180, memory: "512MB" }).https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.chatOnly === true) throw new functions.https.HttpsError("unauthenticated", "Sign in is required.");
  const apiKey = anthropicApiKey.value();
  if (!apiKey) throw new functions.https.HttpsError("failed-precondition", "Reading emails is not set up yet. Ask your admin to set ANTHROPIC_API_KEY.");
  const emails = (Array.isArray(data && data.emails) ? data.emails : []).slice(0, MAX_EMAILS);
  if (!emails.length) throw new functions.https.HttpsError("invalid-argument", "Add at least one email.");
  const d = data || {};
  const ctx = { mode: d.mode === "sea" ? "sea" : "air", origin: String(d.origin || "").slice(0, 60), destination: String(d.destination || "").slice(0, 60), weightKg: Number(d.weightKg) || 0 };
  const reads = [];
  for (const e of emails) {
    const mail = { fromName: String((e && e.fromName) || ""), fromEmail: String((e && e.fromEmail) || ""), subject: String((e && e.subject) || ""), text: String((e && e.text) || "") };
    if (mail.text.trim().length < 5) {
      reads.push({ ...L.finishRead({}, mail, ctx), error: "The email has no text to read." });
      continue;
    }
    reads.push(await readOne(apiKey, mail, ctx));
  }
  return { reads };
});

exports.readMail = readOne;
exports._test = { readOne };
