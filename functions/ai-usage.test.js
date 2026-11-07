const assert = require("node:assert/strict");

// A small in-memory stand-in for Firestore: documents, merges with increments, transactions.
function makeFakeDb() {
  const store = new Map();
  const isInc = (v) => v && typeof v === "object" && "__inc" in v;
  function merge(target, patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (isInc(v)) target[k] = (Number(target[k]) || 0) + v.__inc;
      else if (v && typeof v === "object" && !Array.isArray(v) && !("__remove" in v)) target[k] = merge(target[k] && typeof target[k] === "object" ? target[k] : {}, v);
      else target[k] = v;
    }
    return target;
  }
  const ref = (path) => ({
    path,
    async get() {
      return { exists: store.has(path), data: () => (store.has(path) ? structuredClone(store.get(path)) : undefined) };
    },
    async set(data, opts) {
      store.set(path, opts && opts.merge ? merge(structuredClone(store.get(path) || {}), data) : merge({}, data));
    },
    async update(data) {
      store.set(path, merge(structuredClone(store.get(path) || {}), data));
    },
  });
  const db = {
    store,
    doc: ref,
    collection: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) }),
    FieldValue: { increment: (n) => ({ __inc: n }), arrayRemove: (...x) => ({ __remove: x }) },
    async runTransaction(fn) {
      const tx = {
        get: (r) => r.get(),
        set: (r, d, o) => r.set(d, o),
        update: (r, d) => r.update(d),
      };
      return fn(tx);
    },
  };
  return db;
}

const U = require("./ai-usage");
const { istParts } = require("./ai-usage-logic");

const jsonReply = (usage, model = "claude-sonnet-5-5") =>
  new Response(JSON.stringify({ model, content: [{ type: "text", text: "ok" }], usage }), { status: 200, headers: { "content-type": "application/json" } });

(async () => {
  const db = makeFakeDb();
  U._test.setDb(db);
  const { month, day } = istParts();

  // 1) a normal reply is counted under the right month, day, feature and model, and the dollar total grows
  process.env.FUNCTION_TARGET = "draftEnquiryReply";
  const total1 = await U._test.recordUsage({ feature: "draftEnquiryReply", model: "claude-sonnet-5-5", input: 1000, output: 200, web: 0 });
  assert.equal(total1, 0.004); // 1000*2/1e6 + 200*10/1e6
  const m1 = db.store.get(`aiUsage/${month}`);
  assert.deepEqual(m1.days[day].draftEnquiryReply__claude_sonnet_5_5, { calls: 1, input: 1000, output: 200, web: 0 });
  assert.equal(db.store.get("aiStatus/spend").totalUsd, 0.004);
  assert.ok(db.store.get("aiStatus/spend").since > 0);

  // a second call adds to it
  await U._test.recordUsage({ feature: "draftEnquiryReply", model: "claude-sonnet-5-5", input: 500, output: 100, web: 1 });
  assert.deepEqual(db.store.get(`aiUsage/${month}`).days[day].draftEnquiryReply__claude_sonnet_5_5, { calls: 2, input: 1500, output: 300, web: 1 });

  // 2) observe(): a normal JSON reply
  await U._test.observe(jsonReply({ input_tokens: 2000, output_tokens: 50 }), "vertexChat");
  assert.equal(db.store.get(`aiUsage/${month}`).days[day].vertexChat__claude_sonnet_5_5.calls, 1);

  // 3) observe(): a streamed reply
  const sse = [
    'data: {"type":"message_start","message":{"model":"claude-haiku-4-5-20251001","usage":{"input_tokens":800,"output_tokens":1}}}',
    'data: {"type":"message_delta","usage":{"output_tokens":120}}',
  ].join("\n");
  await U._test.observe(new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } }), "atlasCopilotStream");
  assert.deepEqual(db.store.get(`aiUsage/${month}`).days[day].atlasCopilotStream__claude_haiku_4_5_20251001, { calls: 1, input: 800, output: 120, web: 0 });

  // 4) a reply with no usage numbers is ignored
  const before = db.store.get("aiStatus/spend").calls;
  await U._test.observe(jsonReply(undefined), "x");
  assert.equal(db.store.get("aiStatus/spend").calls, before);

  // 5) out of credit: flagged once, then cleared when a call works again
  const outReply = () => new Response('{"error":{"message":"Your credit balance is too low to access the Anthropic API."}}', { status: 400 });
  await U._test.observe(outReply(), "readCarrierCircular");
  assert.equal(db.store.get("aiStatus/credit").outOfCredit, true);
  assert.equal(db.store.get("aiStatus/credit").lastFeature, "readCarrierCircular");
  const since = db.store.get("aiStatus/credit").since;
  await U._test.observe(outReply(), "vertexChat");
  assert.equal(db.store.get("aiStatus/credit").since, since); // same outage, same start
  U._test.setDb(db); // resets the "checked a moment ago" timer
  await U._test.observe(jsonReply({ input_tokens: 10, output_tokens: 10 }), "vertexChat");
  assert.equal(db.store.get("aiStatus/credit").outOfCredit, false);

  // 6) other errors are not mistaken for "out of credit"
  await U._test.observe(new Response("busy", { status: 529 }), "vertexChat");
  assert.equal(db.store.get("aiStatus/credit").outOfCredit, false);

  // 7) low balance: warned once for a saved balance, never twice
  const pushes = [];
  const fakeMessaging = { sendEachForMulticast: async (m) => (pushes.push(m), { successCount: 1, responses: m.tokens.map(() => ({})) }) };
  const admin = require("firebase-admin");
  const realMessaging = admin.messaging;
  try {
    Object.defineProperty(admin, "messaging", { value: () => fakeMessaging, configurable: true });
  } catch {
    // if the SDK does not let us swap it, the push is skipped quietly and the assertions on the flag below still hold
  }
  await db.doc("chatState/ganny").set({ tokens: ["tok1"] });
  const spent = db.store.get("aiStatus/spend").totalUsd;
  await db.doc("aiBilling/settings").set({ balanceUsd: spent + 0.5, lowAtUsd: 0.4, asOf: 111, spendAtCheckpoint: spent, alertedFor: null });
  U._test.setDb(db);
  // 0.5 left, warn at 0.4: not yet
  await U._test.observe(jsonReply({ input_tokens: 1000, output_tokens: 100 }), "vertexChat"); // ~$0.003
  assert.equal(db.store.get("aiBilling/settings").alertedFor, null);
  // spend ~0.2 more in one go: now below 0.4
  await U._test.observe(jsonReply({ input_tokens: 10_000_000, output_tokens: 0 }), "vertexChat"); // $20 → well past
  assert.equal(db.store.get("aiBilling/settings").alertedFor, 111);
  const pushesAfterFirst = pushes.length;
  await U._test.observe(jsonReply({ input_tokens: 1000, output_tokens: 100 }), "vertexChat");
  assert.equal(pushes.length, pushesAfterFirst); // no second warning for the same balance
  assert.equal(pushesAfterFirst, 1); // exactly one warning went to the admin's device
  assert.deepEqual(pushes[0].tokens, ["tok1"]);
  assert.match(pushes[0].data.title, /AI credit/);
  assert.equal(pushes[0].data.url, "/app/admin/");
  try {
    Object.defineProperty(admin, "messaging", { value: realMessaging, configurable: true });
  } catch {
    // nothing to restore
  }

  // 8) install(): the wrapper counts a call made through fetch and still hands the reply to the caller untouched
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(url);
    return jsonReply({ input_tokens: 300, output_tokens: 30 });
  };
  U._test.setDb(db);
  U.install();
  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", body: "{}" });
  const body = await res.json();
  assert.equal(body.content[0].text, "ok"); // caller can still read the body
  assert.equal(db.store.get(`aiUsage/${month}`).days[day].draftEnquiryReply__claude_sonnet_5_5.calls, 3); // counted under the function's name
  // other websites are not touched or counted
  const callsBefore = db.store.get("aiStatus/spend").calls;
  await fetch("https://example.com/", {});
  assert.equal(db.store.get("aiStatus/spend").calls, callsBefore);
  globalThis.fetch = realFetch;

  console.log("ai-usage tests passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
