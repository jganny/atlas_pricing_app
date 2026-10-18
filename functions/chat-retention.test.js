const assert = require("node:assert/strict");
const admin = require("firebase-admin");
const { _test: r } = require("./chat-retention");
const { _test: n } = require("./chat-notify");

const DAY = 86_400_000;

// 100 days, exactly
assert.equal(r.RETENTION_DAYS, 100);
assert.equal(r.expiryFor(0), 100 * DAY);
assert.equal(r.cutoffFor(100 * DAY), 0);
assert.equal(r.previewExpired({ lastMessageAt: 1, lastMessageText: "old" }, 101 * DAY), true);
assert.equal(r.previewExpired({ lastMessageAt: 50 * DAY, lastMessageText: "recent" }, 101 * DAY), false);
assert.equal(r.previewExpired({ lastMessageAt: 1, lastMessageText: "" }, 101 * DAY), false);

// purgeExpired against a tiny in-memory stand-in for the database
function fakeDb(messagesByRoom) {
  const deleted = [];
  const roomUpdates = [];
  const rooms = Object.entries(messagesByRoom).map(([id, msgs]) => ({
    id,
    data: () => msgs.room || {},
    ref: {
      update: async (u) => roomUpdates.push([id, u]),
      collection: (name) => {
        if (name === "typing") return { where: () => ({ get: async () => ({ empty: true, docs: [] }) }) };
        return {
          where: (_f, _op, ts) => ({
            limit: () => ({
              get: async () => {
                const due = msgs.items.filter((m) => !m.gone && m.expireAt <= ts.toMillis());
                return { empty: due.length === 0, size: due.length, docs: due.map((m) => ({ id: m.id, ref: { path: `${id}/${m.id}`, m } })) };
              },
            }),
          }),
        };
      },
    },
  }));
  return {
    deleted,
    roomUpdates,
    collection: () => ({ get: async () => ({ docs: rooms }) }),
    batch: () => {
      const refs = [];
      return { delete: (ref) => refs.push(ref), commit: async () => refs.forEach((ref) => { ref.m.gone = true; deleted.push(ref.path); }) };
    },
  };
}
const filesRemoved = [];
const bucket = { deleteFiles: async ({ prefix }) => filesRemoved.push(prefix) };
const now = 200 * DAY;
const db = fakeDb({
  roomA: { room: { lastMessageAt: 10 * DAY, lastMessageText: "stale preview" }, items: [{ id: "old1", expireAt: 110 * DAY }, { id: "old2", expireAt: 150 * DAY }, { id: "fresh", expireAt: 250 * DAY }] },
  roomB: { room: {}, items: [] },
});
(async () => {
  const removed = await r.purgeExpired({ db, bucket, now });
  assert.equal(removed, 2);
  assert.deepEqual(db.deleted.sort(), ["roomA/old1", "roomA/old2"]);
  assert.deepEqual(filesRemoved.sort(), ["chat/roomA/old1/", "chat/roomA/old2/"]);
  assert.deepEqual(db.roomUpdates, [["roomA", { lastMessageText: "", pinned: [] }]]);

  // Alerts: who is told
  const room = { id: "r", kind: "group", name: "Reefer", audience: "list", memberLogins: ["a", "b", "c", "d", "e"] };
  const msg = { senderLogin: "a", senderName: "Aarav", text: "Rate for Dubai?", mentions: ["c"] };
  const st = (o = {}) => ({ noticeAcceptedAt: 1, tokens: ["t"], muted: {}, ...o });
  const states = { b: st(), c: st({ muted: { r: true } }), d: st({ noticeAcceptedAt: undefined }), e: st({ tokens: [] }) };
  const presence = { b: { at: now }, c: null };
  let plan = n.planRecipients({ room, message: msg, states, presence: { c: null }, now });
  assert.deepEqual(plan.map((p) => p.login), ["b", "c"], "b alerted; c muted but mentioned; d never opened chat; e has no device; sender excluded");
  assert.equal(plan.find((p) => p.login === "c").mention, true);
  plan = n.planRecipients({ room, message: msg, states, presence, now });
  assert.deepEqual(plan.map((p) => p.login), ["c"], "b is already online in the app");
  assert.deepEqual(n.planRecipients({ room: { ...room, audience: "all", memberLogins: [] }, message: { ...msg, mentions: [] }, states, presence: {}, now }), [], "Everyone channel alerts no one without a mention");
  assert.deepEqual(n.planRecipients({ room: { ...room, audience: "all", memberLogins: [] }, message: msg, states, presence: {}, now }).map((p) => p.login), ["c"]);
  assert.deepEqual(n.planRecipients({ room, message: { ...msg, ai: true }, states, presence: {}, now }), [], "assistant replies don't alert");
  assert.equal(n.snippet({ text: "", attachments: [{ name: "rates.xlsx" }] }), "📎 rates.xlsx");
  assert.equal(n.titleFor({ kind: "dm", name: "x" }, msg, "Aarav"), "Aarav");
  assert.equal(n.titleFor(room, msg, "Aarav"), "Aarav · Reefer");
  void admin;
  console.log("chat-retention.test.js: all assertions passed");
})();
