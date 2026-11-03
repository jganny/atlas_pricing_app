/**
 * Chat-only staff: people who use Vertex Chat but have no Pricing app access.
 * The admin creates the login and gets a private one-time link; the person chooses their own password.
 * Their account carries the custom claim chatOnly, which the database and storage rules (and every other
 * function) use to keep them out of everything except chat.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const L = require("./chat-staff-logic");

const ADMIN_EMAIL = `ganny@${L.DOMAIN}`;
const JOIN_BASE = "https://vertex-35d95-chat.web.app/join/";
const MAX_BATCH = 100;

function requireAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
  if (String(request.auth.token.email || "").toLowerCase() !== ADMIN_EMAIL) throw new HttpsError("permission-denied", "Only the admin can do this.");
}

async function newInvite(db, username, uid) {
  const token = L.newInviteToken();
  await db.collection("chatInvites").doc(L.hashToken(token)).set({ username, uid, expiresAt: L.inviteExpiry(), used: false, createdAt: Date.now() });
  return `${JOIN_BASE}?t=${token}`;
}

/** { people: [{ name, username? }] } -> one result per person: created (with a link) or a plain reason it was skipped. */
exports.chatStaffCreate = onCall({ timeoutSeconds: 120 }, async (request) => {
  requireAdmin(request);
  const people = Array.isArray(request.data?.people) ? request.data.people.slice(0, MAX_BATCH) : [];
  if (!people.length) throw new HttpsError("invalid-argument", "Add at least one person.");
  const db = admin.firestore();
  const auth = admin.auth();
  const results = [];
  for (const p of people) {
    const name = L.cleanName(p?.name);
    const username = String(p?.username || L.suggestUsername(name)).toLowerCase().trim();
    if (!name) {
      results.push({ name, username, ok: false, reason: "Name is missing." });
      continue;
    }
    if (!L.validUsername(username)) {
      results.push({ name, username, ok: false, reason: "Login must be 3 to 30 letters or numbers, starting with a letter." });
      continue;
    }
    try {
      // A name that already belongs to anyone (pricing staff, a desk, or another chat-only person) is never reused.
      const taken =
        (await db.collection("users").doc(username).get()).exists ||
        (await db.collection("chatProfiles").doc(username).get()).exists ||
        (await auth.getUserByEmail(`${username}@${L.DOMAIN}`).then(() => true, () => false)) ||
        (await auth.getUserByEmail(`${username}@pricing.local`).then(() => true, () => false));
      if (taken) {
        results.push({ name, username, ok: false, reason: "That login is already taken. Try another." });
        continue;
      }
      // The starting password is random and never shown: the person sets their own through the link.
      const user = await auth.createUser({ email: `${username}@${L.DOMAIN}`, password: require("crypto").randomBytes(24).toString("base64url"), displayName: name });
      await auth.setCustomUserClaims(user.uid, { chatOnly: true });
      await db.collection("chatProfiles").doc(username).set({ login: username, name, chatOnly: true, addedBy: "ganny", addedAt: Date.now() });
      results.push({ name, username, ok: true, link: await newInvite(db, username, user.uid) });
    } catch (e) {
      console.warn("chatStaffCreate", username, e && e.message);
      results.push({ name, username, ok: false, reason: "Could not create this login. Try again." });
    }
  }
  return { results };
});

/** A fresh link for someone who has not joined yet or forgot their password. { username } */
exports.chatStaffInvite = onCall(async (request) => {
  requireAdmin(request);
  const username = String(request.data?.username || "").toLowerCase().trim();
  const db = admin.firestore();
  const prof = await db.collection("chatProfiles").doc(username).get();
  if (!prof.exists || prof.data().chatOnly !== true) throw new HttpsError("not-found", "No chat-only login with that name.");
  const user = await admin.auth().getUserByEmail(`${username}@${L.DOMAIN}`);
  return { link: await newInvite(db, username, user.uid) };
});

/** Turn a chat-only login off or on. { username, active } An off login is signed out everywhere. */
exports.chatStaffSetActive = onCall(async (request) => {
  requireAdmin(request);
  const username = String(request.data?.username || "").toLowerCase().trim();
  const active = request.data?.active === true;
  const prof = await admin.firestore().collection("chatProfiles").doc(username).get();
  if (!prof.exists || prof.data().chatOnly !== true) throw new HttpsError("not-found", "No chat-only login with that name.");
  const user = await admin.auth().getUserByEmail(`${username}@${L.DOMAIN}`);
  await admin.auth().updateUser(user.uid, { disabled: !active });
  if (!active) await admin.auth().revokeRefreshTokens(user.uid);
  return { ok: true };
});

/** The admin's list: everyone with a chat-only login and where they are (ready, invited, joined, off). */
exports.chatStaffList = onCall(async (request) => {
  requireAdmin(request);
  const db = admin.firestore();
  const profiles = await db.collection("chatProfiles").where("chatOnly", "==", true).get();
  const now = Date.now();
  const rows = [];
  for (const d of profiles.docs) {
    const p = d.data();
    let disabled = false;
    try {
      disabled = (await admin.auth().getUserByEmail(`${d.id}@${L.DOMAIN}`)).disabled === true;
    } catch {
      /* login missing: shown as off */
      disabled = true;
    }
    const invites = await db.collection("chatInvites").where("username", "==", d.id).get();
    const invitePending = invites.docs.some((i) => !i.data().used && i.data().expiresAt > now);
    rows.push({ username: d.id, name: p.name || d.id, addedAt: p.addedAt || 0, joinedAt: p.joinedAt || 0, state: L.staffState({ disabled, joinedAt: p.joinedAt, invitePending }) });
  }
  return { rows: rows.sort((a, b) => b.addedAt - a.addedAt) };
});

/** Public: the person opens their link and chooses a password. { token, password } -> { username } */
exports.chatInviteRedeem = onCall(async (request) => {
  const token = String(request.data?.token || "");
  const db = admin.firestore();
  const ref = db.collection("chatInvites").doc(L.hashToken(token));
  const snap = token ? await ref.get() : null;
  const invite = snap && snap.exists ? snap.data() : null;
  const problem = L.inviteProblem(invite);
  if (problem) throw new HttpsError("failed-precondition", problem);
  const pwProblem = L.passwordProblem(request.data?.password);
  if (pwProblem) throw new HttpsError("invalid-argument", pwProblem);
  const user = await admin.auth().getUser(invite.uid);
  if (user.disabled) throw new HttpsError("permission-denied", "This login is turned off. Ask your admin.");
  await admin.auth().updateUser(invite.uid, { password: request.data.password });
  await ref.update({ used: true, usedAt: Date.now() });
  await db.collection("chatProfiles").doc(invite.username).set({ joinedAt: Date.now() }, { merge: true });
  return { username: invite.username };
});
