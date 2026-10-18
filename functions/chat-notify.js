/**
 * Team chat — alerts for people who are not in the app. When a message is saved, the people it is for
 * (and who are not already looking at Atlas) get a notification on their registered devices.
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const ONLINE_MS = 60_000;

function snippet(m) {
  if (m.deleted) return "";
  if (m.text && m.text.trim()) return m.text.trim().replace(/\s+/g, " ").slice(0, 140);
  if (m.quote) return `Quote ${m.quote.ref} · ${m.quote.customer}`;
  if (m.attachments && m.attachments.length) return `📎 ${m.attachments[0].name}`;
  return "New message";
}

/**
 * Who should be alerted. `states` and `presence` map login -> their chatState / chatPresence data.
 * - Desk chats, groups and direct messages: every member except the sender.
 * - "Everyone": only people who were @mentioned (otherwise it would alert the whole company).
 * - Never before someone has opened chat once; muted chats only for @mentions; not people already online.
 */
function planRecipients({ room, message, states, presence, now = Date.now() }) {
  if (message.ai || message.deleted) return [];
  const mentioned = new Set(message.mentions || []);
  const pool = room.audience === "all" ? [...mentioned] : room.memberLogins || [];
  const out = [];
  for (const login of new Set(pool)) {
    if (login === message.senderLogin) continue;
    const st = states[login];
    if (!st || !st.noticeAcceptedAt || !(st.tokens || []).length) continue;
    const isMention = mentioned.has(login);
    if (st.muted && st.muted[room.id || ""] && !isMention) continue;
    const seen = presence[login];
    if (seen && now - Number(seen.at || 0) < ONLINE_MS) continue;
    out.push({ login, tokens: st.tokens, mention: isMention });
  }
  return out;
}

function titleFor(room, message, senderName) {
  if (room.kind === "dm") return senderName;
  return `${senderName} · ${room.name}`;
}

exports.chatNotify = onDocumentCreated(
  { document: "chatRooms/{roomId}/messages/{messageId}", region: "asia-south1" },
  async (event) => {
    const message = event.data && event.data.data();
    if (!message) return;
    const db = admin.firestore();
    const roomSnap = await db.doc(`chatRooms/${event.params.roomId}`).get();
    if (!roomSnap.exists) return;
    const room = { id: roomSnap.id, ...roomSnap.data() };

    const candidates = room.audience === "all" ? message.mentions || [] : room.memberLogins || [];
    if (!candidates.length) return;
    const [stateDocs, presenceDocs] = await Promise.all([
      db.getAll(...candidates.map((l) => db.doc(`chatState/${l}`))),
      db.getAll(...candidates.map((l) => db.doc(`chatPresence/${l}`))),
    ]);
    const states = Object.fromEntries(stateDocs.map((d, i) => [candidates[i], d.exists ? d.data() : null]));
    const presence = Object.fromEntries(presenceDocs.map((d, i) => [candidates[i], d.exists ? d.data() : null]));
    const plan = planRecipients({ room, message, states, presence });
    if (!plan.length) return;

    const title = titleFor(room, message, message.senderName || "Colleague");
    const body = snippet(message);
    const url = `/app/chat/?room=${encodeURIComponent(room.id)}`;
    for (const r of plan) {
      try {
        const res = await admin.messaging().sendEachForMulticast({
          tokens: r.tokens,
          data: { title: r.mention ? `${title} (mentioned you)` : title, body, url, tag: room.id },
          webpush: { headers: { Urgency: "high", TTL: "86400" } },
        });
        const dead = [];
        res.responses.forEach((x, i) => {
          const code = x.error && x.error.code;
          if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") dead.push(r.tokens[i]);
        });
        if (dead.length) await db.doc(`chatState/${r.login}`).update({ tokens: admin.firestore.FieldValue.arrayRemove(...dead) });
      } catch (e) {
        logger.warn("chat notify failed", { login: r.login, error: String(e) });
      }
    }
  },
);

exports._test = { snippet, planRecipients, titleFor };
