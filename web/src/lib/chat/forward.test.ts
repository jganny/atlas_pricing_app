import assert from "node:assert/strict";
import { forwardChatMessage } from "./actions";
import type { ChatBackend, ChatMessage, ChatRoom, Me, Person } from "./types";

const sent: ChatMessage[] = [];
const backend = { sendMessage: (m: ChatMessage) => void sent.push(m) } as unknown as ChatBackend;
const me: Me = { login: "kavya", name: "Kavya", isAdmin: false };
const people: Person[] = [{ login: "shashank", name: "Shashank" }, { login: "kavya", name: "Kavya" }];
const room = (id: string): ChatRoom => ({ id, kind: "group", name: id, audience: "list", memberLogins: ["kavya"], createdBy: "kavya", createdAt: 1 });

const original: ChatMessage = {
  id: "m1", roomId: "r0", senderLogin: "shashank", senderName: "Shashank", text: "EK rate is in Circulars", createdAtMs: 1,
  attachments: [
    { name: "EK_BLR.pdf", size: 1000, type: "application/pdf", url: "https://files/EK_BLR.pdf", status: "ready" },
    { name: "still-uploading.xlsx", size: 5, type: "", url: "", status: "uploading" },
  ],
  quote: { id: "q1", ref: "AEUGS0826IN00478", customer: "UGS", mode: "air", route: "BOM → ISB", status: "quoted" },
};

// To two conversations at once
const n = forwardChatMessage({ backend, me, rooms: [room("a"), room("b")], people, msg: original });
assert.equal(n, 2);
assert.deepEqual(sent.map((m) => m.roomId), ["a", "b"]);
const m = sent[0];
assert.equal(m.senderLogin, "kavya", "the forwarder is the sender");
assert.equal(m.text, "EK rate is in Circulars");
assert.deepEqual(m.forwardedFrom, { name: "Shashank", login: "shashank" }, "it says who wrote it first");
assert.equal(m.quote?.ref, "AEUGS0826IN00478", "the quote card goes along");
assert.equal(m.attachments?.length, 1, "only files that are fully uploaded are forwarded");
assert.equal(m.attachments?.[0].url, "https://files/EK_BLR.pdf", "the same stored file is reused, not uploaded again");
assert.equal(m.attachments?.[0].status, "ready");
assert.ok(m.id !== original.id, "it is a new message");
assert.equal(m.replyTo, undefined);

// Forwarding a forward keeps the first author
sent.length = 0;
forwardChatMessage({ backend, me: { login: "shashank", name: "Shashank", isAdmin: false }, rooms: [room("c")], people, msg: { ...m, id: "m2", senderLogin: "kavya", senderName: "Kavya" } });
assert.deepEqual(sent[0].forwardedFrom, { name: "Shashank", login: "shashank" });

// A deleted message, or one with nothing to carry, forwards nothing
sent.length = 0;
assert.equal(forwardChatMessage({ backend, me, rooms: [room("a")], people, msg: { ...original, deleted: true } }), 0);
assert.equal(forwardChatMessage({ backend, me, rooms: [room("a")], people, msg: { ...original, text: "", quote: undefined, attachments: [{ name: "x", size: 1, type: "", url: "", status: "uploading" }] } }), 0);
assert.equal(sent.length, 0);

// A file-only message still forwards
assert.equal(forwardChatMessage({ backend, me, rooms: [room("a")], people, msg: { ...original, text: "", quote: undefined } }), 1);
console.log("forward tests passed");
