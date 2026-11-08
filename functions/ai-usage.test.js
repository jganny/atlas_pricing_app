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

  // ───────────── monthly budgets ─────────────
  // One pretend AI service under the counting wrapper for the whole section; only what it replies with changes.
  let stubUsage = { input_tokens: 1000, output_tokens: 100 };
  const seen = [];
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    return String(url).startsWith("https://api.anthropic.com") ? jsonReply(stubUsage) : new Response("ok", { status: 200 });
  };
  const swapMessaging = () => {
    const sent = [];
    Object.defineProperty(admin, "messaging", { value: () => ({ sendEachForMulticast: async (m) => (sent.push(m), { successCount: 1, responses: m.tokens.map(() => ({})) }) }), configurable: true });
    return sent;
  };
  const bdb = makeFakeDb();
  await bdb.doc("chatState/ganny").set({ tokens: ["tok1"] });
  const { month: bMonth, day: bDay } = istParts();
  // this server instance is "draftEnquiryReply"; it has spent $3 and Ask Vertex $1 this month
  bdb.store.set(`aiUsage/${bMonth}`, { month: bMonth, days: { [bDay]: { draftEnquiryReply__claude_sonnet_5_5: { calls: 1, input: 1_500_000, output: 0, web: 0 }, vertexChat__claude_sonnet_5_5: { calls: 1, input: 500_000, output: 0, web: 0 } } } });
  const AI = "https://api.anthropic.com/v1/messages";
  const sent = swapMessaging();

  // no budgets set: everything goes through
  U._test.setDb(bdb);
  U._test.resetInstall();
  U.install();
  let r = await fetch(AI, { method: "POST", body: "{}" });
  assert.equal(r.status, 200);
  assert.equal(seen.length, 1);

  // this feature's budget ($3) is already reached: refused before any AI call, with a plain reason, and the admin is told once
  bdb.store.set("aiBilling/budgets", { totalUsd: null, perFeature: { draftEnquiryReply: 3 } });
  seen.length = 0;
  U._test.setDb(bdb);
  r = await fetch(AI, { method: "POST", body: "{}" });
  assert.equal(r.status, 403);
  const refusal = await r.json();
  assert.equal(refusal.error.type, "budget_exceeded");
  assert.match(refusal.error.message, /Enquiry reply drafts this month \(\$3\.00\) has been reached/);
  assert.equal(seen.length, 0, "no AI call was made, so nothing was spent");
  assert.equal(sent.length, 1);
  assert.match(sent[0].data.title, /AI budget reached/);
  assert.deepEqual(sent[0].tokens, ["tok1"]);
  r = await fetch(AI, { method: "POST", body: "{}" });
  assert.equal(r.status, 403);
  assert.equal(sent.length, 1, "told once, not on every refused call");

  // another feature's budget does not stop this one
  bdb.store.set("aiBilling/budgets", { totalUsd: null, perFeature: { vertexChat: 0.5 } });
  U._test.setDb(bdb);
  r = await fetch(AI, { method: "POST", body: "{}" });
  assert.equal(r.status, 200);

  // raising the budget lets it through again
  bdb.store.set("aiBilling/budgets", { totalUsd: null, perFeature: { draftEnquiryReply: 4 } });
  U._test.setDb(bdb);
  r = await fetch(AI, { method: "POST", body: "{}" });
  assert.equal(r.status, 200);

  // a budget bites straight away: this instance's own spending counts before the monthly figures are re-read
  bdb.store.set("aiBilling/budgets", { totalUsd: null, perFeature: { draftEnquiryReply: 3.5 } });
  stubUsage = { input_tokens: 300_000, output_tokens: 0 }; // $0.60 per call
  seen.length = 0;
  U._test.setDb(bdb);
  r = await fetch(AI, { method: "POST", body: "{}" });
  assert.equal(r.status, 200, "3.00 spent of 3.50: allowed");
  r = await fetch(AI, { method: "POST", body: "{}" });
  assert.equal(r.status, 403, "3.60 now spent: refused without waiting for a re-read");

  // an overall budget stops every feature; a budget of 0 pauses at once
  bdb.store.set("aiBilling/budgets", { totalUsd: 4, perFeature: {} });
  stubUsage = { input_tokens: 1000, output_tokens: 100 };
  seen.length = 0;
  U._test.setDb(bdb);
  assert.equal((await fetch(AI, { method: "POST", body: "{}" })).status, 403);
  assert.match((await (await fetch(AI, { method: "POST", body: "{}" })).json()).error.message, /overall AI budget/);
  bdb.store.set("aiBilling/budgets", { totalUsd: null, perFeature: { draftEnquiryReply: 0 } });
  U._test.setDb(bdb);
  assert.equal((await fetch(AI, { method: "POST", body: "{}" })).status, 403);

  // a fault while reading the budgets never stops the app
  const broken = { ...bdb, doc: (path) => (path.startsWith("aiBilling/budgets") ? { get: async () => { throw new Error("db down"); } } : bdb.doc(path)) };
  seen.length = 0;
  U._test.setDb(broken);
  r = await fetch(AI, { method: "POST", body: "{}" });
  assert.equal(r.status, 200, "fails open");
  assert.equal(seen.length, 1);

  // other websites are never held up by a budget
  bdb.store.set("aiBilling/budgets", { totalUsd: 0, perFeature: {} });
  U._test.setDb(bdb);
  assert.equal((await fetch("https://example.com/")).status, 200);
  assert.ok(seen.includes("https://example.com/"));

  // the admin saves budgets through a function only they can call
  const save = (data, email = "ganny@atlaspricing.com") => U.aiBudgetsSave.run({ auth: { token: { email } }, data, rawRequest: {} });
  await assert.rejects(save({ totalUsd: 5 }, "someone@atlaspricing.com"), /Only the admin/);
  await assert.rejects(save({ totalUsd: "abc" }), /overall monthly budget/);
  assert.deepEqual(await save({ totalUsd: "20", perFeature: { vertexChat: "3", readCarrierCircular: "" } }), { ok: true });
  assert.deepEqual([bdb.store.get("aiBilling/budgets").totalUsd, bdb.store.get("aiBilling/budgets").perFeature], [20, { vertexChat: 3 }]);
  assert.deepEqual(bdb.store.get("aiStatus/budgetAlerts"), { month: "", hit: {} }, "alerts can fire afresh after a change");

  // ───────────── a day that costs far more than usual ─────────────
  const sdb = makeFakeDb();
  await sdb.doc("chatState/ganny").set({ tokens: ["tok1"] });
  const when = Date.UTC(2026, 10, 10, 6, 0); // 10 November, late morning in India
  const dayCost = (usd) => ({ draftEnquiryReply__claude_sonnet_5_5: { calls: 1, input: (usd / 2) * 1e6, output: 0, web: 0 } });
  sdb.store.set("aiUsage/2026-11", { month: "2026-11", days: { "06": dayCost(1), "07": dayCost(1.2), "08": dayCost(0.8), "09": dayCost(1), "10": dayCost(7) } });
  const sent2 = swapMessaging();
  U._test.setDb(sdb);
  await U._test.checkSpike(when);
  assert.equal(sent2.length, 1);
  assert.match(sent2[0].data.title, /unusually high/);
  assert.match(sent2[0].data.body, /\$7\.00 so far today/);
  U._test.setDb(sdb);
  await U._test.checkSpike(when + 3600_000);
  assert.equal(sent2.length, 1, "once per day");
  // an ordinary day does not alert
  sdb.store.set("aiUsage/2026-11", { month: "2026-11", days: { "06": dayCost(1), "07": dayCost(1.2), "08": dayCost(0.8), "09": dayCost(1), "10": dayCost(1.3) } });
  sdb.store.delete("aiStatus/spike");
  U._test.setDb(sdb);
  await U._test.checkSpike(when);
  assert.equal(sent2.length, 1, "a normal day sends nothing");

  // ───────────── the cost policy in the wrapper ─────────────
  const pdb = makeFakeDb();
  U._test.setDb(pdb);
  const sentBodies = [];
  let refuse = null; // a function deciding whether to refuse a request body
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith("https://api.anthropic.com")) return new Response("ok", { status: 200 });
    const body = JSON.parse(init.body);
    sentBodies.push(body);
    if (refuse && refuse(body)) return new Response('{"type":"error","error":{"type":"invalid_request_error","message":"thinking: not supported"}}', { status: 400 });
    return new Response(JSON.stringify({ model: body.model, content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1000, output_tokens: 100 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  U._test.resetInstall();
  U.install();
  const post = (body) => fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const base = { max_tokens: 400, messages: [{ role: "user", content: "hi" }] };

  // an old Haiku request goes out as Haiku 5.5, thinking off, and is counted at the new, lower price
  await post({ ...base, model: "claude-haiku-4-5-20251001" });
  assert.deepEqual([sentBodies[0].model, sentBodies[0].thinking], ["claude-haiku-5-5", { type: "disabled" }]);
  const monthDoc = pdb.store.get(`aiUsage/${istParts().month}`);
  assert.ok(JSON.stringify(monthDoc).includes("claude_haiku_5_5"), "counted under the model that actually answered");
  // this server instance is "draftEnquiryReply": a Sonnet request without a thinking choice goes out with none
  await post({ ...base, model: "claude-sonnet-5-5" });
  assert.deepEqual(sentBodies[1].thinking, { type: "between_tools" });
  // an explicit choice is left alone
  await post({ ...base, model: "claude-sonnet-5-5", thinking: { type: "adaptive" } });
  assert.deepEqual(sentBodies[2].thinking, { type: "adaptive" });

  // the AI service refuses the changed request: the original is sent once more, and the caller gets that answer
  sentBodies.length = 0;
  refuse = (b) => b.model === "claude-haiku-5-5";
  const rr = await post({ ...base, model: "claude-haiku-4-5-20251001", temperature: 0 });
  assert.equal(rr.status, 200, "the feature still works");
  assert.equal(sentBodies.length, 2, "tried the cheaper way, then the original");
  assert.deepEqual([sentBodies[1].model, sentBodies[1].temperature, sentBodies[1].thinking], ["claude-haiku-4-5-20251001", 0, undefined], "the retry is exactly the original request");
  assert.equal((await rr.json()).model, "claude-haiku-4-5-20251001");
  // a request the policy did not change is not retried
  sentBodies.length = 0;
  refuse = () => true;
  const nr = await post({ ...base, model: "claude-opus-5-5" });
  assert.equal(nr.status, 400);
  assert.equal(sentBodies.length, 1);
  // a refusal for another reason (credit) is not retried either
  sentBodies.length = 0;
  globalThis.fetch = async (url, init) => {
    sentBodies.push(JSON.parse(init.body));
    return new Response('{"type":"error","error":{"message":"Your credit balance is too low to access the Anthropic API."}}', { status: 400 });
  };
  const cr = await post({ ...base, model: "claude-haiku-4-5-20251001" });
  assert.equal(cr.status, 400);
  assert.equal(sentBodies.length, 1, "no retry when the account is out of credit");

  console.log("ai-usage tests passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
