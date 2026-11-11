/**
 * Alerts for new enquiries in the shared mailboxes.
 *   - When an enquiry arrives: the people who share that mailbox are told.
 *   - After 20 minutes with nobody having opened it: both are reminded.
 *   - After 60 minutes: the manager is told.
 * "Opened" means someone has a desk open on it (workingBy), has quoted it, or has replied to it. Nothing is assigned: Air Nom and Sea Nom
 * share pricing@, Free Hand and NRS share pricingsales@, and everyone on a mailbox gets the same alerts. Alerts go to the devices
 * people registered in the app (the same ones team chat uses). No AI credit is used.
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

const DEFAULTS = {
  remindAfterMin: 20,
  managerAfterMin: 60,
  /** Older than this and an enquiry is left alone: a day-old item is not news, and it keeps the first run from alerting about the backlog. */
  ignoreAfterMin: 24 * 60,
  teams: { pricing: ["shashank", "shaheer"], pricingsales: ["cathrina", "jabeena"] },
  managers: ["ganny", "manager"],
  /** While the Sea Nom seat is vacant, sea enquiries on pricing@ are also alerted to NRS and Free Hand. Set to [] when the seat is filled. */
  seaCover: ["jabeena", "cathrina"],
};

const MIN = 60_000;

/** Which enquiries need an alert right now, and who gets it. Pure: no Firebase. */
function planAlerts(items, settings = DEFAULTS, now = Date.now()) {
  const cfg = { ...DEFAULTS, ...(settings || {}), teams: { ...DEFAULTS.teams, ...((settings && settings.teams) || {}) } };
  const out = [];
  for (const it of items) {
    if (!it || it.status !== "new" || it.actionRequired === false) continue;
    if (it.tag && it.tag !== "new_enquiry" && it.tag !== "needs_human" && it.tag !== "escalation") continue;
    if (it.workingBy || it.repliedAt) continue;
    const team = it.mailbox === "pricing" && it.mode === "sea" ? [...new Set([...(cfg.teams[it.mailbox] || []), ...(cfg.seaCover || [])])] : cfg.teams[it.mailbox] || [];
    if (!team.length) continue;
    const arrived = Date.parse(it.receivedAt || "") || Number(it.timestamp) || now;
    const age = Math.max(0, Math.round((now - arrived) / MIN));
    const who = String(it.from || "").replace(/<[^>]*>/g, "").replace(/["]/g, "").trim() || "A customer";
    const subject = String(it.subject || "(no subject)").slice(0, 90);
    if (age > cfg.ignoreAfterMin) continue;
    if (age >= cfg.managerAfterMin && !it.managerAt) {
      out.push({ id: it.id, kind: "manager", recipients: cfg.managers, title: `Not actioned for ${age} min`, body: `${who}: ${subject}` });
    } else if (age >= cfg.remindAfterMin && age < cfg.managerAfterMin && !it.remindedAt) {
      out.push({ id: it.id, kind: "remind", recipients: team, title: `Nobody has opened this enquiry (${age} min)`, body: `${who}: ${subject}` });
    } else if (!it.notifiedAt && age < cfg.remindAfterMin) {
      out.push({ id: it.id, kind: "arrived", recipients: team, title: it.tag === "escalation" ? "Problem on a shipment" : "New enquiry", body: `${who}: ${subject}` });
    }
  }
  return out;
}

const FIELD = { arrived: "notifiedAt", remind: "remindedAt", manager: "managerAt" };

async function sendToLogins(db, logins, payload) {
  const docs = await db.getAll(...logins.map((l) => db.doc(`chatState/${l}`)));
  let sent = 0;
  for (const d of docs) {
    const st = d.exists ? d.data() : null;
    if (!st || !st.noticeAcceptedAt || !(st.tokens || []).length) continue; // only people who registered a device
    try {
      const res = await admin.messaging().sendEachForMulticast({
        tokens: st.tokens,
        data: { title: payload.title, body: payload.body, url: "/app/inbox/", tag: `inbox-${payload.id}` },
        webpush: { headers: { Urgency: "high", TTL: "86400" } },
      });
      sent += res.successCount;
      const dead = [];
      res.responses.forEach((x, i) => {
        const code = x.error && x.error.code;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") dead.push(st.tokens[i]);
      });
      if (dead.length) await d.ref.update({ tokens: admin.firestore.FieldValue.arrayRemove(...dead) });
    } catch (err) {
      functions.logger.warn("inbox alert failed", { login: d.id, message: String((err && err.message) || err) });
    }
  }
  return sent;
}

exports.inboxAlerts = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .pubsub.schedule("every 5 minutes")
  .onRun(async () => {
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const settingsSnap = await db.doc("inboxAlerts/settings").get().catch(() => null);
    const settings = settingsSnap && settingsSnap.exists ? settingsSnap.data() : {};
    if (settings.enabled === false) return null;
    const snap = await db.collection("inbox_enquiries").where("status", "==", "new").limit(300).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const plan = planAlerts(items, settings, Date.now());
    let sent = 0;
    for (const a of plan) {
      sent += await sendToLogins(db, a.recipients, a);
      await db.collection("inbox_enquiries").doc(a.id).set({ [FIELD[a.kind]]: Date.now() }, { merge: true }).catch(() => undefined);
    }
    functions.logger.info("inbox alerts", { checked: items.length, alerts: plan.length, sent });
    return null;
  });


/**
 * The Manager's end-of-day line, pushed to the phone: how many enquiries came in today, and which are still waiting for someone.
 * "Waiting" = new, nobody has a desk open on it, nobody has replied. Pure: no Firebase.
 */
function daySummary(items, received, now = Date.now()) {
  const waiting = items.filter((it) => it && it.status === "new" && !it.workingBy && !it.repliedAt && it.actionRequired !== false && (!it.tag || ["new_enquiry", "needs_human", "escalation"].includes(it.tag)) && now - (Date.parse(it.receivedAt || "") || Number(it.timestamp) || now) < 24 * 60 * MIN);
  const who = (it) => String(it.from || "").replace(/<[^>]*>/g, "").replace(/["]/g, "").trim() || "A customer";
  const names = [...new Set(waiting.map(who))].slice(0, 4);
  const body = waiting.length
    ? `${waiting.length} still waiting: ${names.join(", ")}${waiting.length > names.length ? " and more" : ""}.`
    : "Nothing is waiting. Everyone is on top of it.";
  const title = `Today: ${received} enquir${received === 1 ? "y" : "ies"} in`;
  return { title, body, waiting: waiting.length };
}

exports.inboxDaySummary = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .pubsub.schedule("30 18 * * 1-6")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const settingsSnap = await db.doc("inboxAlerts/settings").get().catch(() => null);
    const settings = settingsSnap && settingsSnap.exists ? settingsSnap.data() : {};
    if (settings.enabled === false || settings.daySummary === false) return null;
    const day = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
    const stats = await Promise.all(["pricing", "pricingsales"].map((k) => db.collection("inbox_stats").doc(`${day}_${k}`).get().catch(() => null)));
    const received = stats.reduce((n, s) => n + (s && s.exists ? Number(s.data().kept) || 0 : 0), 0);
    const snap = await db.collection("inbox_enquiries").where("status", "==", "new").limit(300).get();
    const sum = daySummary(snap.docs.map((d) => ({ id: d.id, ...d.data() })), received, Date.now());
    const managers = settings.managers || DEFAULTS.managers;
    const sent = await sendToLogins(db, managers, { id: `day-${day}`, title: sum.title, body: sum.body });
    functions.logger.info("inbox day summary", { received, waiting: sum.waiting, sent });
    return null;
  });

exports._test = { planAlerts, daySummary, DEFAULTS };
