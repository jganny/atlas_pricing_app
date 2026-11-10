const assert = require("node:assert/strict");
process.env.ANTHROPIC_API_KEY = "test-key";
const admin = require("firebase-admin");
let cheapFirst = false;
const fsFn = () => ({ collection: () => ({ doc: () => ({ async get() { return { exists: true, data: () => ({ cheapFirst }) }; } }) }) });
Object.defineProperty(admin, "firestore", { value: fsFn, configurable: true });

const calls = [];
let cheapReply = null; // what the cheaper model "reads"
let cheapStatus = 200;
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  calls.push(body.model);
  const full = { mode: "air", originText: "Bangalore", originCode: "BLR", destinationText: "Frankfurt", destinationCode: "FRA", grossWeightKg: 180, packages: [{ qty: 3, gw: 60 }], summary: "full" };
  if (body.model === "claude-haiku-5-5") {
    if (cheapStatus !== 200) return new Response("busy", { status: cheapStatus });
    return new Response(JSON.stringify({ content: [{ type: "tool_use", name: "record_shipment", input: cheapReply }] }), { status: 200 });
  }
  return new Response(JSON.stringify({ content: [{ type: "tool_use", name: "record_shipment", input: full }] }), { status: 200 });
};

const hub = require("./hub-extract");
const t = hub._test;
const run = () => hub.extractShipmentFromDocuments.run({ documents: [{ name: "mail", kind: "text", text: "Please quote 3 cartons 180 kg BLR to FRA" }], ownDomains: ["atlaslogistics.co.in"] }, { auth: { uid: "u", token: {} } });

(async () => {
  // --- what "complete enough" means ---
  const ok = { mode: "air", origin: { text: "Bangalore", code: "BLR" }, destination: { text: "", code: "FRA" }, grossWeightKg: 180, packages: [], containers: [] };
  assert.equal(t.isCompleteEnough(ok), true);
  assert.equal(t.isCompleteEnough({ ...ok, mode: "unknown" }), false, "no mode");
  assert.equal(t.isCompleteEnough({ ...ok, destination: { text: "", code: "" } }), false, "no destination");
  assert.equal(t.isCompleteEnough({ ...ok, grossWeightKg: 0 }), false, "no cargo at all");
  assert.equal(t.isCompleteEnough({ ...ok, grossWeightKg: 0, containers: [{ type: "40'HC", qty: 1 }], mode: "sea" }), true, "a container is cargo");
  assert.equal(t.isCompleteEnough({ mode: "transport", origin: { text: "A" }, destination: { text: "B" }, vehicleType: "32ft", packages: [] }), true);
  assert.equal(t.isCompleteEnough({ mode: "warehouse", storageLocation: "Bangalore", storageCbm: 40, packages: [] }), true);
  assert.equal(t.isCompleteEnough(null), false);

  // --- the request for each model ---
  const docs = t.validateDocs([{ name: "a", kind: "text", text: "x" }]);
  const sonnet = t.buildRequestBody(docs, {});
  assert.deepEqual([sonnet.model, sonnet.thinking, sonnet.max_tokens], ["claude-sonnet-5-5", undefined, 3000], "unchanged for the stronger model");
  const cheap = t.buildRequestBody(docs, {}, t.CHEAP_MODEL);
  assert.deepEqual([cheap.model, cheap.thinking, cheap.max_tokens], ["claude-haiku-5-5", { type: "adaptive" }, 6000], "the cheaper model thinks first");

  // --- switch OFF (the default): exactly as before, one call to the stronger model ---
  cheapFirst = false;
  let r = await run();
  assert.deepEqual(calls.splice(0), ["claude-sonnet-5-5"]);
  assert.equal(r.extraction.summary, "full");

  // --- switch ON: a complete cheaper read is used, the stronger model is not called at all ---
  cheapFirst = true;
  const hub2 = require("./hub-extract"); // the switch is read once per five minutes; clear it by reloading
  delete require.cache[require.resolve("./hub-extract")];
  const fresh = require("./hub-extract");
  const runFresh = () => fresh.extractShipmentFromDocuments.run({ documents: [{ name: "mail", kind: "text", text: "Please quote 3 cartons 180 kg BLR to FRA" }], ownDomains: [] }, { auth: { uid: "u", token: {} } });
  cheapReply = { mode: "air", originText: "Bangalore", originCode: "BLR", destinationText: "Frankfurt", destinationCode: "FRA", grossWeightKg: 180, packages: [{ qty: 3 }], summary: "cheap" };
  r = await runFresh();
  assert.deepEqual(calls.splice(0), ["claude-haiku-5-5"], "a complete cheap read is enough");
  assert.equal(r.extraction.summary, "cheap");

  // --- switch ON, but the cheaper read misses the destination: the stronger model reads it again ---
  cheapReply = { mode: "air", originText: "Bangalore", originCode: "BLR", grossWeightKg: 180, summary: "cheap" };
  r = await runFresh();
  assert.deepEqual(calls.splice(0), ["claude-haiku-5-5", "claude-sonnet-5-5"], "incomplete: escalated");
  assert.equal(r.extraction.summary, "full");

  // --- switch ON, the cheaper model is unavailable: the stronger model reads it ---
  cheapStatus = 529;
  r = await runFresh();
  assert.deepEqual(calls.splice(0), ["claude-haiku-5-5", "claude-sonnet-5-5"]);
  assert.equal(r.extraction.summary, "full");
  cheapStatus = 200;

  // --- the cheaper model returns nothing usable: escalated ---
  cheapReply = null;
  r = await runFresh();
  assert.equal(r.extraction.summary, "full");
  void hub2;
  console.log("hub extract cascade ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
