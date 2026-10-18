// Run with: node functions/vertex-chat.test.js
const assert = require("node:assert/strict");
const t = require("./vertex-chat")._test;

// The daily limit resets at midnight India time (UTC+5:30), not UTC.
assert.equal(t.dayKey(Date.parse("2026-10-18T18:29:00Z")), "20261018");
assert.equal(t.dayKey(Date.parse("2026-10-18T18:31:00Z")), "20261019");

// Prompt: general-purpose, honest, never invents rates; web line follows the switch.
const p = t.systemPrompt({ role: "admin", workspace: "Air desk", today: "18 October 2026", hasWeb: true });
assert.match(p, /answer ANY question/);
assert.match(p, /NEVER invent, estimate or 'ballpark' a freight rate/);
assert.match(p, /18 October 2026/);
assert.match(p, /You can search the web/);
assert.match(t.systemPrompt({ hasWeb: false }), /Web search is switched off/);
assert.match(t.systemPrompt({ hasWeb: true, hasQuotes: false }), /cannot look up quotes in this chat/);
assert.doesNotMatch(t.systemPrompt({ hasWeb: true, hasQuotes: false }), /search_quotes/);
assert.match(t.systemPrompt({ hasWeb: true }), /search_quotes/);

// Who can see which quotes — desks own their quotes, individuals see their own, admin sees all.
const rows = [{ seatId: "sea-nom", loginId: "newsea", previousLogins: ["shaheer"] }];
const info = t.seatInfo(rows);
assert.equal(info.seatOf("newsea"), "sea-nom");
assert.equal(info.seatOf("shashank"), "air-nom"); // untouched seat keeps its default holder
assert.equal(info.seatOf("shaheer"), null); // the sea seat moved on to someone else
assert.equal(info.seatOf("sunil"), null);
const see = (q, u, admin = false) => t.canSeeQuote(q, u, admin, info);
assert.equal(see({ creator: "shaheer", deskSeat: "sea-nom" }, "newsea"), true); // the new holder sees the desk's history
assert.equal(see({ creator: "shaheer" }, "newsea"), true); // unstamped older quote by a past holder
assert.equal(see({ creator: "shashank", deskSeat: "air-nom" }, "newsea"), false); // other desks stay private
assert.equal(see({ creator: "sunil" }, "sunil"), true);
assert.equal(see({ creator: "sunil" }, "spoorthi"), false);
assert.equal(see({ creator: "anyone" }, "ganny", true), true);

// Quote search filters, counts and caps the list.
const NOW = Date.parse("2026-10-18T00:00:00Z");
const q = (id, over) => ({ id, data: { customer: "Movemax System Logistics", type: "air", route: "BLR → CMB", status: "quoted", date: "2026-10-10", amount: 1950, currency: "USD", timestamp: NOW - 3 * 86400000, creator: "sunil", ...over } });
const docs = [q("a"), q("b", { status: "converted", customer: "Gulf Freight Co", route: "MAA → AEJEA", type: "sea" }), q("c", { timestamp: NOW - 40 * 86400000 }), q("d", { creator: "other" })];
const all = () => true;
const r1 = t.filterQuotes(docs, { customer: "movemax" }, all, NOW);
assert.equal(r1.matched, 3);
assert.equal(r1.byStatus.quoted, 3);
assert.equal(t.filterQuotes(docs, { status: "won" }, all, NOW).quotes[0].status, "won"); // "won" is stored as "converted"
assert.equal(t.filterQuotes(docs, { destination: "cmb", days: 30 }, all, NOW).matched, 2); // 40-day-old one excluded
assert.equal(t.filterQuotes(docs, { mode: "sea" }, all, NOW).quotes[0].customer, "Gulf Freight Co");
assert.equal(t.filterQuotes(docs, {}, (d) => d.creator === "sunil", NOW).matched, 3); // visibility rule applied
assert.equal(t.filterQuotes(docs, { limit: 1 }, all, NOW).quotes.length, 1);
assert.match(t.filterQuotes(docs, { limit: 1 }, all, NOW).note, /latest 1 of 4/);

// Rebuilding the model's answer from a stream, so a tool round can be continued.
const b = new t.BlockBuilder();
[
  { type: "message_start", message: { usage: { input_tokens: 120 } } },
  { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "hmm" } },
  { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "SIG" } },
  { type: "content_block_stop", index: 0 },
  { type: "content_block_start", index: 1, content_block: { type: "server_tool_use", id: "s1", name: "web_search", input: {} } },
  { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"query":"CMB ' } },
  { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: 'cargo"}' } },
  { type: "content_block_stop", index: 1 },
  { type: "content_block_start", index: 2, content_block: { type: "web_search_tool_result", tool_use_id: "s1", content: [{ type: "web_search_result", url: "https://a.com/x", title: "A" }, { type: "web_search_result", url: "https://b.com/y", title: "B" }] } },
  { type: "content_block_stop", index: 2 },
  { type: "content_block_start", index: 3, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 3, delta: { type: "text_delta", text: "Hello " } },
  { type: "content_block_delta", index: 3, delta: { type: "text_delta", text: "world" } },
  { type: "content_block_delta", index: 3, delta: { type: "citations_delta", citation: { url: "https://a.com/x" } } },
  { type: "content_block_stop", index: 3 },
  { type: "content_block_start", index: 4, content_block: { type: "tool_use", id: "t1", name: "search_quotes", input: {} } },
  { type: "content_block_delta", index: 4, delta: { type: "input_json_delta", partial_json: '{"customer":"mov' } },
  { type: "content_block_delta", index: 4, delta: { type: "input_json_delta", partial_json: 'emax"}' } },
  { type: "content_block_stop", index: 4 },
  { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 77, server_tool_use: { web_search_requests: 1 } } },
].forEach((e) => b.handle(e));
assert.equal(b.stopReason, "tool_use");
assert.deepEqual(b.usage, { input: 120, output: 77, webSearches: 1 });
assert.deepEqual(b.toolUses()[0].input, { customer: "movemax" });
const content = b.content();
assert.deepEqual(content[0], { type: "thinking", thinking: "hmm", signature: "SIG" });
assert.deepEqual(content[1].input, { query: "CMB cargo" });
assert.equal(content[3].text, "Hello world");
assert.equal(content[3].citations.length, 1);
assert.deepEqual(b.sources().map((s) => s.url), ["https://a.com/x", "https://b.com/y"]);
assert.deepEqual(t.dedupeSources([{ url: "u1" }, { url: "u1" }, { url: "u2" }], 8).length, 2);

// The event reader copes with events split across network chunks.
(async () => {
  const sse = 'event: a\ndata: {"type":"x","n":1}\n\nevent: b\ndata: {"type":"y","n":2}\n\n';
  const enc = new TextEncoder();
  const chunks = [sse.slice(0, 17), sse.slice(17, 50), sse.slice(50)].map((s) => enc.encode(s));
  const got = [];
  await t.readEvents((async function* () { for (const c of chunks) yield c; })(), (e) => got.push(e));
  assert.deepEqual(got.map((e) => e.n), [1, 2]);

  // History: recent turns kept, opens with the user, attachments placed before the question, app guide added.
  const history = [{ role: "assistant", content: "stale opener" }, { role: "user", content: "q1" }, { role: "assistant", content: "a1" }, { role: "system", content: "ignored" }, { role: "user", content: "" }];
  const m = t.buildMessages({ history, text: "q2", attachments: [{ name: "x.pdf", kind: "pdf", mime: "application/pdf", data: "QQ==" }, { name: "n.txt", kind: "text", text: "hello" }], appContext: "GUIDE" });
  assert.deepEqual(m.slice(0, 2).map((x) => x.role), ["user", "assistant"]);
  assert.equal(m[0].content, "q1");
  const last = m[m.length - 1];
  assert.equal(last.role, "user");
  assert.equal(last.content[1].type, "document");
  assert.match(last.content.at(-1).text, /^q2[\s\S]*GUIDE/);
  const long = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "x".repeat(20000) }));
  assert.ok(t.buildMessages({ history: long, text: "q", attachments: [] }).length <= 5); // trimmed to the size limit
  assert.equal(t.MODELS.quick.includes("haiku"), true);
  console.log("vertex-chat.test.js: all assertions passed");
})().catch((e) => { console.error(e); process.exit(1); });
