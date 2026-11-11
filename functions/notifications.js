/**
 * Notifications for people: a small card per person per event, so every user has the full list in the bell of the app (new enquiry, nobody has
 * opened it, a vendor's rates were read, a circular needs filing). The phone pop-ups (inbox-alerts.js) stay for urgent things; this is the history.
 * A card is only a title and one line: never the text of an email. Kept 7 days.
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

const DEFAULT_TEAMS = { pricing: ["shashank", "shaheer"], pricingsales: ["cathrina", "jabeena"] };
const SEA_COVER = ["jabeena", "cathrina"];

/** Writes one card per login. Never throws: a notification must not stop the work that caused it. */
async function notifyLogins(db, logins, card) {
  try {
    const batch = db.batch();
    for (const login of [...new Set(logins)].filter(Boolean)) {
      batch.set(db.collection("notifications").doc(), { login, kind: card.kind || "info", level: card.level === "need" ? "need" : "update", title: String(card.title || "").slice(0, 120), body: String(card.body || "").slice(0, 200), itemId: String(card.itemId || ""), at: Date.now(), read: false });
    }
    await batch.commit();
  } catch (err) {
    functions.logger.warn("notifications: could not write", { message: String((err && err.message) || err).slice(0, 120) });
  }
}

/** The people on a shared mailbox (and the sea cover while Sea Nom is vacant, for sea enquiries on pricing@). */
function teamFor(mailbox, mode) {
  const team = DEFAULT_TEAMS[mailbox] || [];
  return mailbox === "pricing" && mode === "sea" ? [...new Set([...team, ...SEA_COVER])] : team;
}

const loginOf = (context) => String((context.auth && context.auth.token.email) || "").toLowerCase().split("@")[0];
function requireUser(context) {
  if (!context.auth || context.auth.token.chatOnly === true) throw new functions.https.HttpsError("unauthenticated", "Sign in is required.");
}

exports.notificationsList = functions.runWith({ timeoutSeconds: 30, memory: "256MB" }).https.onCall(async (data, context) => {
  requireUser(context);
  const login = loginOf(context);
  if (!login) return { items: [], unread: 0 };
  const snap = await admin.firestore().collection("notifications").where("login", "==", login).limit(150).get();
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at).slice(0, 40);
  return { items, unread: items.filter((i) => !i.read).length };
});

exports.notificationsRead = functions.runWith({ timeoutSeconds: 30, memory: "256MB" }).https.onCall(async (data, context) => {
  requireUser(context);
  const login = loginOf(context);
  const db = admin.firestore();
  const ids = Array.isArray(data && data.ids) ? data.ids.map(String).slice(0, 60) : [];
  let refs;
  if (data && data.all === true) {
    const snap = await db.collection("notifications").where("login", "==", login).limit(150).get();
    refs = snap.docs.filter((d) => !d.data().read).map((d) => d.ref);
  } else {
    const docs = await Promise.all(ids.map((id) => db.collection("notifications").doc(id).get()));
    refs = docs.filter((d) => d.exists && d.data().login === login).map((d) => d.ref); // only your own
  }
  const batch = db.batch();
  refs.forEach((r) => batch.set(r, { read: true }, { merge: true }));
  await batch.commit();
  return { ok: true, marked: refs.length };
});

exports.notifyLogins = notifyLogins;
exports.teamFor = teamFor;
exports._test = { teamFor, loginOf };
