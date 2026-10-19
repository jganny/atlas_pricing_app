/**
 * Rate requests — emails a desk sends to agents, airlines, liners and coloaders asking for rates.
 *
 * The desk chooses the contacts and reviews the message in the app; this function only sends it:
 * one separate email per contact (nobody sees anyone else), from the shared pricing mailbox, with a reference
 * code in the subject so replies can be matched to the enquiry. Every send is logged in `rateRequests`.
 * Guards: signed-in users only, a cap per request and per person per day, no repeat to the same address for the
 * same reference, and the customer's name and prices are never part of the message (the app composes it that way).
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

const pricingPassword = defineSecret("IMAP_PRICING_PASSWORD");

const SMTP = { host: "czipop.logix.in", port: 465, secure: true, user: "pricing@atlaslogistics.co.in" };
const MAX_PER_REQUEST = 40;
const MAX_PER_DAY = 150;
const MAX_BODY = 6000;
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

function istDay(now = Date.now()) {
  return new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Plain text → simple HTML paragraphs, safely escaped. */
function toHtml(text) {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;font-family:Calibri,Arial,sans-serif;font-size:14px;line-height:1.5">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Keeps valid, distinct addresses from a contact's email field ("a@x.com; b@y.com"). */
function parseEmails(raw) {
  const out = [];
  for (const part of String(raw || "").split(/[;,\s]+/)) {
    const e = part.trim().toLowerCase();
    if (EMAIL_RE.test(e) && !out.includes(e)) out.push(e);
  }
  return out.slice(0, 3);
}

/** Validates what the app sent. Returns { error } or { recipients, subject, body }. */
function validateRequest(data) {
  const ref = typeof data?.ref === "string" ? data.ref.trim() : "";
  if (!/^RQ-[A-Z0-9]{4,12}$/.test(ref)) return { error: "A valid request reference is required." };
  const subject = typeof data?.subject === "string" ? data.subject.trim().slice(0, 200) : "";
  if (!subject) return { error: "Add a subject." };
  if (!subject.includes(ref)) return { error: "The subject must contain the request reference." };
  const body = typeof data?.body === "string" ? data.body.trim().slice(0, MAX_BODY) : "";
  if (body.length < 20) return { error: "Write the request before sending." };
  const list = Array.isArray(data?.recipients) ? data.recipients : [];
  if (!list.length) return { error: "Choose at least one contact." };
  if (list.length > MAX_PER_REQUEST) return { error: `Send to at most ${MAX_PER_REQUEST} contacts at a time.` };
  const recipients = [];
  const seen = new Set();
  for (const r of list) {
    const emails = parseEmails(r?.email).filter((e) => !seen.has(e));
    if (!emails.length) continue;
    emails.forEach((e) => seen.add(e));
    recipients.push({ id: String(r?.id || "").slice(0, 60), name: String(r?.name || "").slice(0, 120), emails });
  }
  if (!recipients.length) return { error: "None of the chosen contacts has a valid email address." };
  return { ref, subject, body, recipients };
}

exports.sendRateRequests = onCall({ secrets: [pricingPassword], timeoutSeconds: 300, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
  const email = String(request.auth.token.email || "");
  const login = email.split("@")[0].toLowerCase();
  const data = request.data || {};
  const db = admin.firestore();

  // Admin-only test: one message to an address the admin types, to prove sending works.
  if (data.test === true) {
    if (login !== "ganny") throw new HttpsError("permission-denied", "Admin only.");
    const to = parseEmails(data.testTo)[0];
    if (!to) throw new HttpsError("invalid-argument", "Enter a valid email address to send the test to.");
    const t = nodemailer.createTransport({ host: SMTP.host, port: SMTP.port, secure: SMTP.secure, auth: { user: SMTP.user, pass: pricingPassword.value() } });
    try {
      await t.sendMail({
        from: `"Atlas Pricing" <${SMTP.user}>`,
        to,
        subject: "Atlas Pricing — test email",
        text: "This is a test from Atlas Pricing. Sending rate requests works from this mailbox.",
      });
    } catch (e) {
      logger.warn("rate request test failed", { message: String(e && e.message) });
      throw new HttpsError("unavailable", `The mail server refused the test: ${String((e && e.message) || "unknown error").slice(0, 160)}`);
    }
    return { ok: true, sent: 1 };
  }

  const v = validateRequest(data);
  if (v.error) throw new HttpsError("invalid-argument", v.error);

  // Daily cap per person, counted in emails.
  const capRef = db.doc(`rateRequestCaps/${login}_${istDay()}`);
  const used = ((await capRef.get()).data() || {}).count || 0;
  const wanted = v.recipients.reduce((n, r) => n + r.emails.length, 0);
  if (used + wanted > MAX_PER_DAY) {
    throw new HttpsError("resource-exhausted", `Daily limit reached (${MAX_PER_DAY} emails). ${Math.max(0, MAX_PER_DAY - used)} left today.`);
  }

  // Never repeat to an address already sent this reference.
  const logRef = db.doc(`rateRequests/${v.ref}`);
  const prior = ((await logRef.get()).data() || {}).sentTo || [];
  const priorSet = new Set(prior);

  const byName = String(data.senderName || login).slice(0, 80);
  const transporter = nodemailer.createTransport({
    host: SMTP.host, port: SMTP.port, secure: SMTP.secure, pool: true, maxConnections: 2,
    auth: { user: SMTP.user, pass: pricingPassword.value() },
  });

  const results = [];
  for (const r of v.recipients) {
    const to = r.emails.filter((e) => !priorSet.has(e));
    if (!to.length) {
      results.push({ id: r.id, name: r.name, status: "skipped", note: "Already sent this request" });
      continue;
    }
    try {
      await transporter.sendMail({
        from: `"${byName.replace(/"/g, "")} — Atlas Logistics" <${SMTP.user}>`,
        replyTo: SMTP.user,
        to,
        subject: v.subject,
        text: v.body,
        html: toHtml(v.body),
        headers: { "X-Atlas-Request": v.ref },
      });
      to.forEach((e) => priorSet.add(e));
      results.push({ id: r.id, name: r.name, status: "sent" });
    } catch (e) {
      logger.warn("rate request send failed", { ref: v.ref, message: String(e && e.message) });
      results.push({ id: r.id, name: r.name, status: "failed", note: String((e && e.message) || "").slice(0, 120) });
    }
  }
  transporter.close();

  const sentCount = results.filter((x) => x.status === "sent").length;
  await capRef.set({ count: used + results.filter((x) => x.status === "sent").reduce((n, x) => n + (v.recipients.find((r) => r.id === x.id)?.emails.length || 1), 0) }, { merge: true });
  await logRef.set(
    {
      ref: v.ref,
      by: login,
      byName,
      at: admin.firestore.FieldValue.serverTimestamp(),
      subject: v.subject,
      mode: String(data.mode || "").slice(0, 10),
      direction: String(data.direction || "").slice(0, 10),
      incoterm: String(data.incoterm || "").slice(0, 10),
      origin: String(data.origin || "").slice(0, 80),
      destination: String(data.destination || "").slice(0, 80),
      sentTo: [...priorSet],
      recipients: admin.firestore.FieldValue.arrayUnion(...results.map((x) => ({ id: x.id, name: x.name, status: x.status }))),
    },
    { merge: true },
  );
  logger.info("rate request sent", { ref: v.ref, by: login, sent: sentCount, total: results.length });
  return { ref: v.ref, sent: sentCount, results };
});

exports._test = { parseEmails, validateRequest, toHtml, istDay, MAX_PER_REQUEST };
