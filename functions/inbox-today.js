/**
 * What happened in the mailboxes today, so nothing goes missing silently:
 *   - circulars the app filed into the Circulars tab today (and circulars that came as plain words and need filing by hand),
 *   - which of the given email addresses are saved in the contact directory (the small "Contact saved" tick on an email).
 * No AI credit, no email text.
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const D = require("./inbox-directory");

const DAY = 86_400_000;
/** Midnight in India, as a timestamp. */
const startOfDayIst = (now = Date.now()) => Math.floor((now + 5.5 * 3_600_000) / DAY) * DAY - 5.5 * 3_600_000;

exports.inboxToday = functions.runWith({ timeoutSeconds: 60, memory: "256MB" }).https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.chatOnly === true) throw new functions.https.HttpsError("unauthenticated", "Sign in is required.");
  const db = admin.firestore();
  const start = startOfDayIst();
  const [circSnap, unfiledSnap] = await Promise.all([
    db.collection("circularsLibrary").where("createdAt", ">", admin.firestore.Timestamp.fromMillis(start)).limit(80).get(),
    db.collection("circular_unfiled").where("timestamp", ">", Date.now() - 3 * DAY).limit(30).get(),
  ]);
  const circulars = circSnap.docs
    .map((d) => d.data())
    .filter((c) => c.source === "email")
    .map((c) => ({ title: String(c.title || ""), carrier: String(c.carrier || ""), category: String(c.category || ""), at: c.createdAt && c.createdAt.toMillis ? c.createdAt.toMillis() : 0 }))
    .sort((a, b) => b.at - a.at)
    .slice(0, 10);
  const unfiled = unfiledSnap.docs.map((d) => d.data()).sort((a, b) => b.at - a.at).slice(0, 10).map((u) => ({ subject: u.subject, from: u.from, carrier: u.carrier, mailbox: u.mailbox, at: u.at }));
  const emails = (Array.isArray(data && data.emails) ? data.emails : []).map((e) => String(e || "").toLowerCase().trim()).filter(Boolean).slice(0, 20);
  const docs = await Promise.all(emails.map((e) => db.collection("emailDirectory").doc(D.contactId(e)).get()));
  const saved = docs.filter((d) => d.exists).map((d) => ({ email: d.data().email, type: d.data().type || "unknown" }));
  return { circulars, unfiled, saved };
});

exports._test = { startOfDayIst };
