/**
 * Team chat — automatic deletion. Every message (and its files) is removed 100 days after it was sent.
 * Runs once a day; the pure parts are exported for tests.
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const RETENTION_DAYS = 100;
const DAY_MS = 86_400_000;

/** A message sent at `sentMs` expires at this time (the app stores the same value as `expireAt`). */
function expiryFor(sentMs) {
  return sentMs + RETENTION_DAYS * DAY_MS;
}

function cutoffFor(now) {
  return now - RETENTION_DAYS * DAY_MS;
}

/** Does a room's "last message" preview still describe a message that exists? */
function previewExpired(room, now) {
  return typeof room.lastMessageAt === "number" && room.lastMessageAt < cutoffFor(now) && !!room.lastMessageText;
}

/**
 * Removes expired messages (and their stored files) from every room.
 * `db` and `bucket` are the Admin SDK handles; returns how many messages were removed.
 */
async function purgeExpired({ db, bucket, now = Date.now(), batchSize = 300 }) {
  const rooms = await db.collection("chatRooms").get();
  let removed = 0;
  for (const room of rooms.docs) {
    for (;;) {
      const snap = await room.ref
        .collection("messages")
        .where("expireAt", "<=", admin.firestore.Timestamp.fromMillis(now))
        .limit(batchSize)
        .get();
      if (snap.empty) break;
      for (const m of snap.docs) {
        try {
          await bucket.deleteFiles({ prefix: `chat/${room.id}/${m.id}/`, force: true });
        } catch (e) {
          logger.warn("chat retention: could not remove files", { room: room.id, message: m.id, error: String(e) });
        }
      }
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      removed += snap.size;
      if (snap.size < batchSize) break;
    }
    if (previewExpired(room.data(), now)) {
      await room.ref.update({ lastMessageText: "", pinned: [] });
    }
    // Typing marks are only meaningful for seconds.
    const stale = await room.ref.collection("typing").where("at", "<", now - DAY_MS).get();
    if (!stale.empty) {
      const batch = db.batch();
      stale.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  return removed;
}

exports.chatRetention = onSchedule(
  { schedule: "every day 03:30", timeZone: "Asia/Kolkata", region: "asia-south1", memory: "512MiB", timeoutSeconds: 540 },
  async () => {
    const removed = await purgeExpired({ db: admin.firestore(), bucket: admin.storage().bucket() });
    logger.info("chat retention finished", { removed, days: RETENTION_DAYS });
  },
);

exports._test = { RETENTION_DAYS, expiryFor, cutoffFor, previewExpired, purgeExpired };
