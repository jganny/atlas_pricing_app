import assert from "node:assert/strict";
import {
  RETENTION_DAYS, MAX_FILE_BYTES, expiryFor, daysLeft, dmRoomId, isMember, roomTitle, sectionsFor,
  hasUnread, wasMentioned, badgeRooms, unreadCount, asksVertex, vertexQuestion, parseMentions, tokenize,
  groupByDay, searchMessages, previewText, withReaction, isOnline, typingNames, typingLabel, seenBy,
  fileKind, formatBytes, checkFile, safeFileName, transcriptFor, NOTICE_BODY, EVERYONE_ROOM,
} from "./chat-logic";
import type { ChatMessage, ChatRoom, ChatState, Person } from "./types";

const DAY = 86_400_000;
const people: Person[] = [
  { login: "shashank", name: "Shashank Rao", desk: "Air Desk" },
  { login: "cathrina", name: "Cathrina" },
  { login: "ganny", name: "Admin" },
];
const room = (o: Partial<ChatRoom>): ChatRoom => ({ id: "r1", kind: "group", name: "G", audience: "list", memberLogins: ["a", "b"], createdBy: "a", createdAt: 1, ...o });
const msg = (o: Partial<ChatMessage>): ChatMessage => ({ id: "m", roomId: "r1", senderLogin: "a", senderName: "Aarav", text: "hi", createdAtMs: 1000, ...o });
const state = (o: Partial<ChatState> = {}): ChatState => ({ reads: {}, muted: {}, noticeAcceptedAt: 100, ...o });

// Retention: exactly 100 days
assert.equal(RETENTION_DAYS, 100);
assert.equal(expiryFor(0), 100 * DAY);
assert.equal(daysLeft(0, 99 * DAY), 1);
assert.equal(daysLeft(0, 101 * DAY), 0);
assert.match(NOTICE_BODY, /100 days/);

// Rooms
assert.equal(dmRoomId("Cathrina", "ganny"), dmRoomId("ganny", "cathrina"));
assert.equal(isMember(room({ audience: "all", memberLogins: [] }), "x"), true);
assert.equal(isMember(room({}), "A"), true);
assert.equal(isMember(room({}), "zed"), false);
assert.equal(roomTitle(room({ kind: "dm", memberLogins: ["cathrina", "ganny"] }), "ganny", people), "Cathrina");
assert.equal(roomTitle(room({ kind: "group", name: "Reefer" }), "ganny", people), "Reefer");
const secs = sectionsFor([room({ id: "a", kind: "channel", name: "Sea Desk" }), room({ id: EVERYONE_ROOM, kind: "channel", name: "Everyone" }), room({ id: "g1", lastMessageAt: 5 }), room({ id: "g2", lastMessageAt: 9 })]);
assert.deepEqual(secs[0].rooms.map((r) => r.id), [EVERYONE_ROOM, "a"]);
assert.deepEqual(secs[1].rooms.map((r) => r.id), ["g2", "g1"]);

// Unread: nothing counts before the person accepted the notice; own messages never count
assert.equal(hasUnread(room({ lastMessageAt: 500, lastMessageBy: "b" }), state({ noticeAcceptedAt: undefined }), "a"), false);
assert.equal(hasUnread(room({ lastMessageAt: 50, lastMessageBy: "b" }), state(), "a"), false, "older than first use");
assert.equal(hasUnread(room({ lastMessageAt: 500, lastMessageBy: "b" }), state(), "a"), true);
assert.equal(hasUnread(room({ lastMessageAt: 500, lastMessageBy: "a" }), state(), "a"), false, "own message");
assert.equal(hasUnread(room({ lastMessageAt: 500, lastMessageBy: "b" }), state({ reads: { r1: 600 } }), "a"), false);
const muted = state({ muted: { r1: true } });
assert.equal(badgeRooms([room({ lastMessageAt: 500, lastMessageBy: "b" })], muted, "a"), 0, "muted stays quiet");
assert.equal(badgeRooms([room({ lastMessageAt: 500, lastMessageBy: "b", mentioned: { a: 500 } })], muted, "a"), 1, "unless mentioned");
assert.equal(wasMentioned(room({ mentioned: { a: 700 } }), state({ reads: { r1: 600 } }), "a"), true);
assert.equal(unreadCount([msg({ createdAtMs: 5 }), msg({ id: "2", createdAtMs: 9, senderLogin: "b" }), msg({ id: "3", createdAtMs: 9, senderLogin: "b", deleted: true })], 6, "a"), 1);

// @Vertex and @mentions
assert.equal(asksVertex("hey @Vertex what is FCA"), true);
assert.equal(asksVertex("email vertex@x.com"), false);
assert.equal(vertexQuestion("@Vertex, what is FCA?"), "what is FCA?");
assert.deepEqual(parseMentions("@Shashank please check, cc @cathrina", people), ["shashank", "cathrina"]);
assert.deepEqual(parseMentions("@Shashank Rao ok", people), ["shashank"]);
assert.deepEqual(parseMentions("mail me at x@cathrina.com", people), []);
const segs = tokenize("see https://a.co/x and ask @Cathrina or @Vertex.", people);
assert.deepEqual(segs.map((s) => s.kind), ["text", "link", "text", "mention", "text", "vertex", "text"]);
assert.equal(segs.map((s) => s.value).join(""), "see https://a.co/x and ask @Cathrina or @Vertex.");

// Reading
const day = new Date(2026, 9, 10, 12).getTime();
const groups = groupByDay([
  msg({ id: "1", createdAtMs: day }),
  msg({ id: "2", createdAtMs: day + 60_000 }),
  msg({ id: "3", createdAtMs: day + 60_000 * 20 }),
  msg({ id: "4", createdAtMs: day + 60_000 * 21, senderLogin: "b" }),
  msg({ id: "5", createdAtMs: day + DAY }),
], day + DAY);
assert.equal(groups.length, 2);
assert.deepEqual(groups[0].items.map((i) => i.startsRun), [true, false, true, true]);
assert.equal(groups[1].label, "Today");
assert.equal(searchMessages([msg({ text: "Reefer to Dubai" }), msg({ id: "2", text: "other" }), msg({ id: "3", text: "reefer", deleted: true })], "REEFER").length, 1);
assert.equal(previewText(msg({ text: "", quote: { id: "q", ref: "AE-1", customer: "Pearl", mode: "air", route: "BLR-CMB", status: "open" } })), "Quote AE-1 · Pearl");
assert.equal(previewText(msg({ deleted: true })), "Message deleted");
assert.deepEqual(withReaction({ "👍": ["a"] }, "👍", "b", true), { "👍": ["a", "b"] });
assert.deepEqual(withReaction({ "👍": ["a"] }, "👍", "a", false), {});
assert.equal(isOnline({ login: "a", name: "A", at: 1000 }, 1000 + 89_000), true);
assert.equal(isOnline({ login: "a", name: "A", at: 1000 }, 1000 + 91_000), false);
assert.deepEqual(typingNames([{ login: "a", name: "Aarav K", at: 100 }, { login: "b", name: "Bina", at: 7000 }, { login: "c", name: "Old", at: 1 }], "a", 8000), ["Bina"]);
assert.equal(typingLabel(["Bina"]), "Bina is typing…");
assert.deepEqual(seenBy(msg({ createdAtMs: 100 }), { a: 500, b: 500, c: 50 }, "a"), ["b"]);

// Files
assert.equal(fileKind("image/png", "x.png"), "image");
assert.equal(fileKind("", "rates.xlsx"), "sheet");
assert.equal(formatBytes(2048), "2.0 KB");
assert.equal(checkFile({ name: "big.zip", size: MAX_FILE_BYTES + 1 })?.includes("10.0 MB"), true);
assert.equal(checkFile({ name: "ok.pdf", size: 1000 }), null);
assert.equal(safeFileName("../a/b c?.pdf"), ".._a_b c_.pdf");

// Assistant context
const t = transcriptFor([msg({ id: "1", createdAtMs: 1, text: "Need rate for BLR-DXB" }), msg({ id: "2", createdAtMs: 2, ai: true, senderName: "Bina", text: "FCA means…" }), msg({ id: "3", createdAtMs: 3, deleted: true, text: "secret" })]);
assert.equal(t, "Aarav: Need rate for BLR-DXB\nVertex: FCA means…");

console.log("chat-logic tests passed");
