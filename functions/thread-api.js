/**
 * The conversation behind an Inbox item, through callables (the app's database rules are not changed for it).
 *   threadGet     any signed-in user: the enquiry, what was sent on to vendors, the replies, with the reason each was tied in.
 *   threadUnlink  any signed-in user: this mail does not belong to that conversation (it is not tied again by itself).
 *   threadLink    any signed-in user: this mail belongs to that enquiry (by hand, when the rules were not sure).
 * Only small cards are read or written. No AI credit.
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const TH = require("./inbox-thread");

const SHARED_HOSTS = new Set(["gmail.com", "yahoo.com", "yahoo.co.in", "outlook.com", "hotmail.com", "rediffmail.com", "live.com", "icloud.com", "protonmail.com"]);

function requireUser(context) {
  if (!context.auth || context.auth.token.chatOnly === true) throw new functions.https.HttpsError("unauthenticated", "Sign in is required.");
}
const addrOf = (from) => ((/<([^>]+)>/.exec(String(from || "")) || [])[1] || String(from || "")).trim().toLowerCase();
const nameOf = (from) => String(from || "").replace(/<[^>]*>/g, "").replace(/["]/g, "").trim() || addrOf(from);
const hostOf = (email) => String(email).split("@")[1] || "";

/** Pure: the answer for one conversation. cards and sents are plain objects with an id. */
function buildThread(rootId, cards, sents) {
  const members = [
    ...cards.map((c) => ({
      kind: "card",
      id: c.id,
      role: c.id === rootId ? "enquiry" : "reply",
      at: Date.parse(c.receivedAt || "") || Number(c.timestamp) || 0,
      who: nameOf(c.from),
      email: addrOf(c.from),
      subject: String(c.subject || ""),
      attachments: Number(c.attachmentCount) || 0,
      by: c.id === rootId ? "self" : c.linkedBy || "",
      check: c.id !== rootId && c.needsCheck === true,
      rateState: c.rateState || "",
      rates: c.rates || null,
      reason: c.id === rootId ? "" : TH.REASONS[c.linkedBy] || "",
    })),
    ...sents.map((s) => ({
      kind: "sent",
      id: s.id,
      role: "sent",
      at: Number(s.at) || 0,
      who: (s.to || []).map((t) => t.name || t.email).join(", "),
      email: ((s.to || [])[0] || {}).email || "",
      to: (s.to || []).map((t) => ({ email: t.email, name: t.name || "" })),
      cc: (s.cc || []).map((t) => ({ email: t.email, name: t.name || "" })),
      subject: String(s.subject || ""),
      attachments: 0,
      by: s.linkedBy || "",
      check: s.needsCheck === true,
      reason: TH.REASONS[s.linkedBy] || "",
    })),
  ].sort((a, b) => a.at - b.at);

  // Who was asked, and who has answered (the same address, or for a company mailbox the same company).
  const repliers = members.filter((m) => m.role === "reply");
  const asked = new Map();
  for (const m of members.filter((x) => x.role === "sent")) for (const t of [...(m.to || [])]) if (!asked.has(t.email)) asked.set(t.email, { name: t.name || t.email, at: m.at });
  const vendors = [...asked.entries()].map(([email, v]) => {
    const reply = repliers.find((r) => r.email === email || (!SHARED_HOSTS.has(hostOf(email)) && hostOf(r.email) === hostOf(email)));
    return { email, name: v.name, replied: !!reply, askedAt: v.at, repliedAt: reply ? reply.at : 0 };
  });
  return { rootId, members, vendors };
}

exports.threadGet = functions.runWith({ timeoutSeconds: 60, memory: "256MB" }).https.onCall(async (data, context) => {
  requireUser(context);
  const id = String((data && data.id) || "");
  if (!id) throw new functions.https.HttpsError("invalid-argument", "Which email?");
  const db = admin.firestore();
  const snap = await db.collection("inbox_enquiries").doc(id).get();
  if (!snap.exists) return { rootId: null, members: [], vendors: [], gone: true };
  const rootId = snap.data().threadId || null;
  if (!rootId) return { rootId: null, members: [], vendors: [], root: false };
  const [cards, sents] = await Promise.all([
    db.collection("inbox_enquiries").where("threadId", "==", rootId).limit(60).get(),
    db.collection("inbox_sent").where("threadId", "==", rootId).limit(60).get(),
  ]);
  const out = buildThread(rootId, cards.docs.map((d) => ({ id: d.id, ...d.data() })), sents.docs.map((d) => ({ id: d.id, ...d.data() })));
  return { ...out, mailbox: snap.data().mailbox };
});

exports.threadUnlink = functions.runWith({ timeoutSeconds: 60, memory: "256MB" }).https.onCall(async (data, context) => {
  requireUser(context);
  const kind = data && data.kind === "sent" ? "sent" : "card";
  const id = String((data && data.id) || "");
  if (!id) throw new functions.https.HttpsError("invalid-argument", "Which email?");
  const ref = admin.firestore().collection(kind === "sent" ? "inbox_sent" : "inbox_enquiries").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "That email is no longer in the list.");
  if (kind === "card" && snap.data().threadId === id) throw new functions.https.HttpsError("failed-precondition", "This is the enquiry itself. Unlink the other emails from it instead.");
  await ref.set({ threadId: null, linkedBy: "unlinked", noAutoLink: true, unlinkedBy: String(context.auth.token.email || context.auth.uid || ""), unlinkedAt: Date.now() }, { merge: true });
  return { ok: true };
});

exports.threadLink = functions.runWith({ timeoutSeconds: 60, memory: "256MB" }).https.onCall(async (data, context) => {
  requireUser(context);
  const kind = data && data.kind === "sent" ? "sent" : "card";
  const id = String((data && data.id) || "");
  const rootId = String((data && data.rootId) || "");
  if (!id || !rootId) throw new functions.https.HttpsError("invalid-argument", "Which email, and which enquiry?");
  const db = admin.firestore();
  const [item, root] = await Promise.all([db.collection(kind === "sent" ? "inbox_sent" : "inbox_enquiries").doc(id).get(), db.collection("inbox_enquiries").doc(rootId).get()]);
  if (!item.exists || !root.exists) throw new functions.https.HttpsError("not-found", "That email or enquiry is no longer in the list.");
  if (!TH.isRootCard(root.data()) || root.data().mailbox !== item.data().mailbox) throw new functions.https.HttpsError("failed-precondition", "That enquiry is in another mailbox, or is not an enquiry.");
  await item.ref.set({ threadId: rootId, linkedBy: "manual", noAutoLink: false, needsCheck: false, linkedAt: Date.now(), linkedByUser: String(context.auth.token.email || context.auth.uid || "") }, { merge: true });
  await TH.markRoot(db, rootId);
  return { ok: true };
});

exports._test = { buildThread };
