/**
 * The directory of email addresses (see inbox-directory.js), through callables, because the app's database rules are not changed for it.
 *   directoryList   any signed-in user: the contacts, for suggestions on the desks and for reading the list.
 *   directoryUpdate admin only: set a contact's type, organisation, carrier code, name, how a rate is obtained, or remove it.
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const D = require("./inbox-directory");

const ADMIN_EMAIL = "ganny@atlaspricing.com";
const RATE_SOURCES = ["", "tariff", "portal", "email"];

function requireUser(context) {
  if (!context.auth || context.auth.token.chatOnly === true) throw new functions.https.HttpsError("unauthenticated", "Sign in is required.");
}
function requireAdmin(context) {
  requireUser(context);
  if (String(context.auth.token.email || "").toLowerCase() !== ADMIN_EMAIL) throw new functions.https.HttpsError("permission-denied", "Only the admin can change the directory.");
}

exports.directoryList = functions.runWith({ timeoutSeconds: 60, memory: "256MB" }).https.onCall(async (data, context) => {
  requireUser(context);
  const snap = await admin.firestore().collection("emailDirectory").orderBy("lastSeen", "desc").limit(3000).get();
  return {
    contacts: snap.docs.map((d) => {
      const x = d.data();
      return { id: d.id, email: x.email, name: x.name || "", domain: x.domain || "", type: x.type || "unknown", typeSource: x.typeSource || "none", org: x.org || "", carrierCode: x.carrierCode || "", rateSource: x.rateSource || "", mailboxes: x.mailboxes || [], count: x.count || 0, firstSeen: x.firstSeen || 0, lastSeen: x.lastSeen || 0, note: x.note || "" };
    }),
  };
});

exports.directoryUpdate = functions.runWith({ timeoutSeconds: 60, memory: "256MB" }).https.onCall(async (data, context) => {
  requireAdmin(context);
  const id = String((data && data.id) || "");
  if (!/^[0-9a-f]{20}$/.test(id)) throw new functions.https.HttpsError("invalid-argument", "Which contact?");
  const ref = admin.firestore().collection("emailDirectory").doc(id);
  if (data && data.remove === true) {
    await ref.delete();
    return { ok: true, removed: true };
  }
  const patch = {};
  if (typeof data.type === "string") {
    if (!D.TYPES.includes(data.type)) throw new functions.https.HttpsError("invalid-argument", "That is not a contact type.");
    patch.type = data.type;
    patch.typeSource = "admin";
  }
  for (const k of ["org", "name", "note"]) if (typeof data[k] === "string") patch[k] = data[k].trim().slice(0, 120);
  if (typeof data.carrierCode === "string") {
    const c = data.carrierCode.trim().toUpperCase();
    if (c && !/^[A-Z0-9]{2,4}$/.test(c)) throw new functions.https.HttpsError("invalid-argument", "A carrier code is 2 to 4 letters or digits, like EK.");
    patch.carrierCode = c;
  }
  if (typeof data.rateSource === "string") {
    if (!RATE_SOURCES.includes(data.rateSource)) throw new functions.https.HttpsError("invalid-argument", "Rate source must be tariff, portal or email.");
    patch.rateSource = data.rateSource;
  }
  if (!Object.keys(patch).length) throw new functions.https.HttpsError("invalid-argument", "Nothing to change.");
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "That contact is no longer in the directory.");
  await ref.set({ ...patch, updatedAt: Date.now(), updatedBy: String(context.auth.token.email || "") }, { merge: true });
  return { ok: true };
});
