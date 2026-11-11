import assert from "node:assert/strict";
import { agoText, badgeText, groupNotifications, unreadCounts, type NotificationItem } from "./notifications-view";

const n = (id: string, level: "need" | "update", at: number, read = false): NotificationItem => ({ id, kind: "x", level, title: id, body: "", itemId: "", at, read });
const items = [n("a", "update", 100), n("b", "need", 200), n("c", "need", 300, true), n("d", "update", 400)];
const g = groupNotifications(items);
assert.deepEqual(g.need.map((i) => i.id), ["c", "b"], "needs you: newest first");
assert.deepEqual(g.update.map((i) => i.id), ["d", "a"]);
assert.deepEqual(unreadCounts(items), { unread: 3, needs: 1 });
const NOW = 10_000_000;
assert.equal(agoText(NOW - 20_000, NOW), "just now");
assert.equal(agoText(NOW - 12 * 60_000, NOW), "12 min ago");
assert.equal(agoText(NOW - 3 * 3_600_000, NOW), "3 h ago");
assert.equal(agoText(NOW - 50 * 3_600_000, NOW), "2 d ago");
assert.equal(badgeText(0), "");
assert.equal(badgeText(4), "4");
assert.equal(badgeText(12), "9+");
console.log("notifications-view tests passed");
