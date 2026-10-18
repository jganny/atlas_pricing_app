import assert from "node:assert/strict";
import {
  applyEvent, appContextFrom, dayKeyIST, historyForServer, parseLines, tagsFor, titleFromQuestion, type ChatMessage,
} from "./vertex-chat";
import { monthStartKey, summarizeUsage } from "./chat-usage";
import { compactMessage, compactThread } from "./chat-store";

const base: ChatMessage = { id: "b", role: "assistant", content: "", createdAt: "2026-10-18T00:00:00Z", status: "Thinking…" };

// Reading a stream: complete lines become events; a half line waits for the next chunk.
let p = parseLines('{"t":"delta","text":"Hel"}\n{"t":"delta","text":"lo"}\n{"t":"sta');
assert.equal(p.events.length, 2);
assert.equal(p.rest, '{"t":"sta');
p = parseLines(p.rest + 'tus","text":"Searching the web…"}\n\nnot json\n{"t":"done","count":3,"limit":50}\n');
assert.deepEqual(p.events.map((e) => e.t), ["status", "done"]); // blank and damaged lines are skipped
assert.equal(p.rest, "");

// Folding events into an answer.
let m = applyEvent(base, { t: "status", text: "Searching the web…" });
assert.equal(m.status, "Searching the web…");
m = applyEvent(m, { t: "delta", text: "Hello " });
m = applyEvent(m, { t: "delta", text: "world" });
assert.equal(m.content, "Hello world");
assert.equal(m.status, undefined); // the progress note disappears once text arrives
m = applyEvent(m, { t: "sources", items: Array.from({ length: 12 }, (_, i) => ({ title: `S${i}`, url: `https://x/${i}` })) });
assert.equal(m.sources?.length, 8);
m = applyEvent(m, { t: "used", web: 2, quotes: false, files: false });
assert.deepEqual(m.tags, ["web"]);
assert.equal(applyEvent(base, { t: "error", message: "limit" }).error, "limit");

// Source badges.
assert.deepEqual(tagsFor({ web: 0, quotes: false, files: false }), ["general"]);
assert.deepEqual(tagsFor({ web: 1, quotes: true, files: true }), ["web", "quotes", "file"]);

// What is remembered: finished turns only, recent ones, text only.
const msgs: ChatMessage[] = [
  { id: "1", role: "user", content: "q1", createdAt: "" },
  { id: "2", role: "assistant", content: "a1", createdAt: "", tags: ["general"], sources: [{ title: "t", url: "u" }] },
  { id: "3", role: "user", content: "q2", createdAt: "" },
  { id: "4", role: "assistant", content: "", createdAt: "", error: "failed" },
];
assert.deepEqual(historyForServer(msgs), [{ role: "user", content: "q1" }, { role: "assistant", content: "a1" }, { role: "user", content: "q2" }]);
assert.equal(historyForServer(Array.from({ length: 50 }, (_, i) => ({ id: `${i}`, role: "user" as const, content: `m${i}`, createdAt: "" })), 30).length, 30);

assert.equal(titleFromQuestion("  What   is FCA?  "), "What is FCA?");
assert.equal(titleFromQuestion("x".repeat(100)).length, 48);
assert.equal(titleFromQuestion(""), "New chat");
assert.match(appContextFrom([{ id: "x", title: "Add charges", where: "Courier", summary: "How", steps: ["Open", "Add"], path: "/courier", keywords: [] }]), /## Add charges[\s\S]*1\. Open/);
assert.equal(dayKeyIST(Date.parse("2026-10-18T18:31:00Z")), "20261019"); // the same day boundary the server uses

// Stored chats are trimmed so a long chat never outgrows a database document.
const long: ChatMessage = { id: "l", role: "assistant", content: "y".repeat(50000), createdAt: "", status: "x", sources: Array.from({ length: 20 }, (_, i) => ({ title: "t", url: `u${i}` })) };
const c = compactMessage(long);
assert.equal(c.content.length, 24000);
assert.equal(c.sources?.length, 8);
assert.equal("status" in c, false);
const thread = compactThread({ id: "t", title: "T", updatedAt: "", messages: Array.from({ length: 100 }, (_, i) => ({ id: `${i}`, role: "user" as const, content: `m${i}`, createdAt: "" })) });
assert.equal(thread.messages.length, 60);
assert.equal(thread.messages[59].content, "m99");

// Admin usage: per person, busiest first, with totals.
assert.equal(monthStartKey(new Date("2026-10-18T10:00:00Z")), "20261001");
assert.equal(monthStartKey(new Date("2026-09-30T20:00:00Z")), "20261001"); // already October in India
const u = summarizeUsage([
  { username: "Shashank", day: "20261001", count: 3, inTokens: 1000, outTokens: 200, webSearches: 1 },
  { username: "shashank", day: "20261002", count: 5, inTokens: 2000, outTokens: 300, webSearches: 0 },
  { username: "sunil", day: "20261002", count: 9, inTokens: 500, outTokens: 100, webSearches: 4 },
]);
assert.deepEqual(u.users.map((x) => [x.username, x.questions, x.daysActive]), [["sunil", 9, 1], ["shashank", 8, 2]]);
assert.equal(u.total.questions, 17);
assert.equal(u.total.inTokens, 3500);
assert.equal(u.total.webSearches, 5);

console.log("vertex-chat.test.ts: all assertions passed");
