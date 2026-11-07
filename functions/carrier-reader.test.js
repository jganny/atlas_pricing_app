/**
 * The whole reader, end to end, against a pretend AI, a pretend database and a real spreadsheet. No network, no credit.
 */
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.CARRIER_RETRY_MS = "5";
const admin = require("firebase-admin");

// ---- a pretend database and storage -------------------------------------------------------------------------------------------
const store = new Map(); // "collection/doc" -> data
const fakeDb = {
  collection(name) {
    const docRef = (id, parent = name) => ({
      path: `${parent}/${id}`,
      id,
      async get() {
        const k = `${parent}/${id}`;
        return { exists: store.has(k), id, data: () => store.get(k) };
      },
      async set(data) {
        store.set(`${parent}/${id}`, data);
      },
      async delete() {
        store.delete(`${parent}/${id}`);
      },
      collection(sub) {
        return { doc: (sid) => docRef(sid, `${parent}/${id}/${sub}`) };
      },
    });
    return {
      doc: (id) => docRef(id),
      where(field, op, values) {
        return {
          async get() {
            const docs = [...store.entries()].filter(([k, v]) => k.startsWith(`${name}/`) && !k.slice(name.length + 1).includes("/") && values.includes(v[field])).map(([, v]) => ({ data: () => v }));
            return { forEach: (cb) => docs.forEach(cb) };
          },
        };
      },
    };
  },
  batch() {
    const ops = [];
    return {
      set: (ref, data) => ops.push(() => store.set(ref.path, data)),
      commit: async () => ops.forEach((o) => o()),
    };
  },
};
const fsFn = () => fakeDb;
fsFn.FieldValue = { increment: (n) => ({ __inc: n }) };
let bucketFile = null;
Object.defineProperty(admin, "firestore", { value: fsFn, configurable: true });
Object.defineProperty(admin, "storage", { value: () => ({ bucket: () => ({ file: () => ({ download: async () => [bucketFile] }) }) }), configurable: true });

// ---- a pretend AI --------------------------------------------------------------------------------------------------------------
const calls = [];
let behave = () => ({});
const line = (...f) => [...f, ...Array(11 - f.length).fill("")].join("|"); // 8 leading fields, 2 rate columns, notes
const reply = (rows) => ["COLUMNS|0|45", ...rows].join("\n");
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  const text = body.messages[0].content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
  const isB = /weight-break column in turn/.test(body.system);
  const call = { body, text, isB };
  calls.push(call);
  const special = behave(call, calls.length);
  if (special && special.status) return new Response(special.body || "busy", { status: special.status });
  if (special && special.reply !== undefined) return new Response(JSON.stringify({ content: [{ type: "text", text: special.reply }], usage: { input_tokens: 1000, output_tokens: 100 }, stop_reason: special.stop || "end_turn" }), { status: 200 });
  const out = [];
  for (const l of text.split("\n")) {
    const m = /^([A-Z]{3}),([A-Z]{3}),(\d+),([\d.]+),([\d.]+)$/.exec(l.trim());
    if (m) out.push(line("EK", m[1], m[2], "INR", "", "", "published", m[3], m[4], m[5]));
  }
  return new Response(JSON.stringify({ content: [{ type: "text", text: out.length ? reply(out) : "NONE" }], usage: { input_tokens: 1000, output_tokens: 100 }, stop_reason: "end_turn" }), { status: 200 });
};

const { readCarrierCircular } = require("./carrier-reader");
const run = (data, email = "ganny@atlaspricing.com") => readCarrierCircular.run({ auth: { token: { email } }, data, rawRequest: {} });

// a spreadsheet of 1,500 routes: a title block, column headings, then one line per route
const code = (i) => String.fromCharCode(65 + Math.floor(i / 676) % 26, 65 + Math.floor(i / 26) % 26, 65 + (i % 26));
const N = 1500;
const routes = Array.from({ length: N }, (_, i) => ({ o: code(i + 1), d: "DXB", min: 1500, u: 30 + (i % 5), p: 27 + (i % 4) }));
const aoa = [["EMIRATES SKYCARGO TARIFF"], ["Valid 01 Sep to 31 Dec 2026"], ["Currency INR"], [], ["Origin", "Dest", "Min", "Under45", "Plus45"], ...routes.map((r) => [r.o, r.d, r.min, r.u, r.p])];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "BLR");
bucketFile = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
store.set("circularsLibrary/c1", { category: "airline_tariff", carrier: "EK", title: "EK_BLR", fileName: "BLR TARIFF.xlsx", storagePath: "circulars/x/EK.xlsx" });

(async () => {
  // 1) the normal case: every part read twice, every route applied, nothing lost
  let res = await run({ circularId: "c1" });
  assert.ok(res.parts.total >= 3, `a long sheet is read in several parts (got ${res.parts.total})`);
  assert.equal(calls.length, res.parts.total * 2, "each part is read exactly twice");
  assert.equal(res.parts.failed, 0);
  assert.equal(res.applied, N, "every route applied, none dropped at part boundaries");
  assert.equal(res.held, 0);
  assert.deepEqual(res.usage, { input: calls.length * 1000, output: calls.length * 100 });
  for (const c of calls) {
    assert.deepEqual(c.body.thinking, { type: "between_tools" }, "thinking is off");
    assert.equal(c.body.max_tokens, 16000);
    assert.equal(c.body.model, "claude-sonnet-5-5");
  }
  assert.ok(calls.some((c) => c.isB) && calls.some((c) => !c.isB), "two differently-framed reads");
  assert.ok(calls.every((c) => /Origin,Dest,Min,Under45,Plus45/.test(c.text)), "every part carries the column headings");
  const doc = store.get(`carrierTariffs/EK_${routes[0].o}_DXB_INR`);
  assert.deepEqual([doc.carrierCode, doc.origin, doc.currency, doc.breaks.min, doc.breaks.plus45, doc.sourceCircularId], ["EK", routes[0].o, "INR", 1500, 27, "c1"]);
  assert.equal(store.get("carrierReads/c1").applied, N);
  assert.ok(!store.has("carrierTariffHolds/c1"));
  assert.ok(store.get("carrierReadUsage/" + new Date().toISOString().slice(0, 7)).reads.__inc === 1);

  // 2) a practice read changes nothing
  [...store.keys()].filter((k) => k.startsWith("carrierTariffs/")).forEach((k) => store.delete(k));
  store.delete("carrierReads/c1");
  calls.length = 0;
  res = await run({ circularId: "c1", dryRun: true });
  assert.equal(res.applied, N);
  assert.equal([...store.keys()].filter((k) => k.startsWith("carrierTariffs/")).length, 0, "dry run writes no rates");
  assert.ok(!store.has("carrierReads/c1"));

  // 3) the second read disagrees about one route: that route is held, the rest are applied
  calls.length = 0;
  const victim = routes[10].o;
  behave = (call) => {
    if (call.isB && call.text.includes(`${victim},DXB`)) {
      const out = [];
      for (const l of call.text.split("\n")) {
        const m = /^([A-Z]{3}),([A-Z]{3}),(\d+),([\d.]+),([\d.]+)$/.exec(l.trim());
        if (m) out.push(line("EK", m[1], m[2], "INR", "", "", "published", m[3], m[1] === victim ? "99" : m[4], m[5]));
      }
      return { reply: reply(out) };
    }
    return {};
  };
  res = await run({ circularId: "c1" });
  assert.equal(res.applied, N - 1);
  assert.equal(res.held, 1);
  assert.ok(!store.has(`carrierTariffs/EK_${victim}_DXB_INR`), "a disputed route is not stored");
  assert.ok(store.get("carrierTariffHolds/c1").rows[0].route.includes(victim));

  // 4) one part cannot be understood in one read: only its routes are skipped, everything else still applies, and it says so
  [...store.keys()].filter((k) => k.startsWith("carrierTariffs/")).forEach((k) => store.delete(k));
  calls.length = 0;
  let failedOnce = false;
  behave = (call) => {
    if (!call.isB && !failedOnce && /part 2 of/.test(call.text)) {
      failedOnce = true;
      return { reply: "Sorry, I cannot read this." };
    }
    return {};
  };
  res = await run({ circularId: "c1" });
  assert.equal(res.parts.failed, 1);
  assert.ok(res.applied > 0 && res.applied < N, `some routes applied (${res.applied}), the unreadable part's skipped`);
  const holdReasons = store.get("carrierTariffHolds/c1").rows.flatMap((r) => r.reasons).join(" ");
  assert.match(holdReasons, /1 of \d+ part\(s\) could not be understood/);

  // 5) a read cut short is never trusted
  calls.length = 0;
  behave = (call) => (/part 1 of/.test(call.text) && call.isB ? { reply: reply([line("EK", "AAA", "DXB", "INR", "", "", "published", "1", "2", "3")]), stop: "max_tokens" } : {});
  res = await run({ circularId: "c1" });
  assert.equal(res.parts.failed, 1);
  assert.ok(!store.has("carrierTariffs/EK_AAA_DXB_INR"), "a truncated part contributes nothing");
  assert.match(store.get("carrierTariffHolds/c1").rows.flatMap((r) => r.reasons).join(" "), /cut short/);

  // 6) the AI service is busy: waits and tries again, then succeeds
  [...store.keys()].filter((k) => k.startsWith("carrierTariffs/")).forEach((k) => store.delete(k));
  calls.length = 0;
  let busyLeft = 3;
  behave = () => (busyLeft-- > 0 ? { status: 529 } : {});
  res = await run({ circularId: "c1" });
  assert.equal(res.applied, N);
  assert.ok(calls.length > res.parts.total * 2, "busy replies were retried");

  // 7) out of credit: a plain-words refusal, nothing written
  store.delete("carrierReads/c1");
  behave = () => ({ status: 400, body: '{"error":{"message":"Your credit balance is too low to access the Anthropic API."}}' });
  await assert.rejects(run({ circularId: "c1", dryRun: true }), /run out of credit/);

  // 8) people who may not run it, and files it cannot read
  behave = () => ({});
  await assert.rejects(run({ circularId: "c1" }, "someone@atlaspricing.com"), /Only the admin/);
  await assert.rejects(readCarrierCircular.run({ auth: { token: { email: "ganny@atlaspricing.com", chatOnly: true } }, data: { circularId: "c1" }, rawRequest: {} }), /Sign in is required/);
  await assert.rejects(run({ circularId: "nope" }), /does not exist/);
  store.set("circularsLibrary/c2", { category: "fuel_surcharge", storagePath: "x.xlsx" });
  await assert.rejects(run({ circularId: "c2" }), /Only airline tariff/);
  store.set("circularsLibrary/c3", { category: "airline_tariff", fileName: "notes.docx", storagePath: "x.docx" });
  await assert.rejects(run({ circularId: "c3" }), /Only PDF and Excel/);

  // 9) a sheet with far too many parts is refused up front, before any AI call is paid for
  calls.length = 0;
  const big = Array.from({ length: 30000 }, (_, i) => [code(i), "DXB", 1500, 30, 27]);
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet([["Origin", "Dest", "Min", "Under45", "Plus45"], ...big]), "Big");
  bucketFile = XLSX.write(wb2, { type: "buffer", bookType: "xlsx" });
  store.set("circularsLibrary/c4", { category: "airline_tariff", carrier: "EK", fileName: "big.xlsx", storagePath: "x.xlsx" });
  await assert.rejects(run({ circularId: "c4" }), /too long to read automatically/);
  assert.equal(calls.length, 0, "refused before spending anything");

  console.log("carrier reader end-to-end tests passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
