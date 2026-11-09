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
let autoId = 0;
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
      doc: (id) => docRef(id || `auto${++autoId}`),
      where(field, op, values) {
        const want = op === "==" ? [values] : values;
        return {
          async get() {
            const docs = [...store.entries()].filter(([k, v]) => k.startsWith(`${name}/`) && !k.slice(name.length + 1).includes("/") && want.includes(v[field])).map(([k, v]) => ({ id: k.slice(name.length + 1), data: () => v }));
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
fsFn.FieldValue = { increment: (n) => ({ __inc: n }), serverTimestamp: () => ({ __ts: true }) };
let bucketFile = null;
Object.defineProperty(admin, "firestore", { value: fsFn, configurable: true });
Object.defineProperty(admin, "storage", { value: () => ({ bucket: () => ({ file: () => ({ download: async () => [bucketFile] }) }) }), configurable: true });

// ---- a pretend AI --------------------------------------------------------------------------------------------------------------
const calls = [];
let behave = () => ({});
let refuseCheap = false;
let digestReply = "```json\n" + JSON.stringify({ kind: "liner", company: "Maersk", effectiveFrom: "2026-12-01", validTo: "2026-12-31", appliesTo: "India to Europe", summary: ["Peak season surcharge applies from 1 Dec.", "Bookings after 25 Nov are charged the new rate."], charges: [{ name: "Peak season surcharge", amount: "450", currency: "usd", unit: "per 20ft", appliesTo: "INNSA to NLRTM", note: "" }, { name: "", amount: 1 }], deadlines: ["25 Nov 2026: last day for the old rate."] }) + "\n```";
const line = (...f) => [...f, ...Array(11 - f.length).fill("")].join("|"); // 8 leading fields, 2 rate columns, notes
const reply = (rows) => ["COLUMNS|0|45", ...rows].join("\n");
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  const text = body.messages[0].content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
  const isB = /weight-break column in turn/.test(body.system);
  if (/CIRCULAR DIGEST/.test(body.system)) {
    calls.push({ body, text, isB: false, digest: true });
    return new Response(JSON.stringify({ content: [{ type: "text", text: digestReply }], usage: { input_tokens: 2000, output_tokens: 300 }, stop_reason: "end_turn" }), { status: 200 });
  }
  if (refuseCheap && body.model === "claude-haiku-5-5") return new Response('{"type":"error","error":{"message":"model: not supported"}}', { status: 400 });
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

const { readCarrierCircular, autoReadCarrierCircular, autoReadReplacedCircular, carrierAutoReadSave, readLibraryCircular } = require("./carrier-reader");
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
    assert.equal(c.body.max_tokens, 16000);
    assert.equal(c.body.model, c.isB ? "claude-haiku-5-5" : "claude-sonnet-5-5", "careful model first, cheaper model second");
    assert.deepEqual(c.body.thinking, c.isB ? { type: "adaptive" } : { type: "between_tools" }, "the careful model answers directly; the cheaper one must think first");
  }
  assert.ok(calls.some((c) => c.isB) && calls.some((c) => !c.isB), "two differently-framed reads");
  assert.ok(calls.every((c) => /Origin,Dest,Min,Under45,Plus45/.test(c.text)), "every part carries the column headings");
  const doc = store.get(`carrierTariffs/EK_${routes[0].o}_DXB_INR`);
  assert.deepEqual([doc.carrierCode, doc.origin, doc.currency, doc.breaks.min, doc.breaks.plus45, doc.sourceCircularId], ["EK", routes[0].o, "INR", 1500, 27, "c1"]);
  assert.equal(store.get("carrierReads/c1").applied, N);
  assert.ok(!store.has("carrierTariffHolds/c1"));
  assert.ok(store.get("carrierReadUsage/" + new Date().toISOString().slice(0, 7)).reads.__inc === 1);
  // the Air desk's own rate list gets every applied route as BUY (never SELL), named as the desk names the airline
  const deskRows = [...store.entries()].filter(([k]) => k.startsWith("air_tariffs/")).map(([, v]) => v);
  assert.equal(deskRows.length, N, "every applied route is published to the Air desk");
  assert.equal(res.publishedToAirDesk, N);
  assert.deepEqual([deskRows[0].carrier, deskRows[0].carrierCode, deskRows[0].source, deskRows[0].published, deskRows[0].breaks.min.sell, deskRows[0].breaks.min.buy], ["Emirates", "EK", "carrier_board", true, 0, 1500]);

  // 2) a practice read changes nothing
  [...store.keys()].filter((k) => k.startsWith("carrierTariffs/")).forEach((k) => store.delete(k));
  store.delete("carrierReads/c1");
  calls.length = 0;
  res = await run({ circularId: "c1", dryRun: true });
  assert.equal(res.applied, N);
  assert.equal([...store.keys()].filter((k) => k.startsWith("carrierTariffs/")).length, 0, "dry run writes no rates");
  assert.ok(!store.has("carrierReads/c1"));
  assert.equal([...store.keys()].filter((k) => k.startsWith("air_tariffs/")).length, N, "a practice read publishes nothing new");
  assert.equal(res.publishedToAirDesk, undefined);

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

  // 7b) the feature's monthly budget is used up: its own plain message comes back, no retries
  const before = calls.length;
  behave = () => ({ status: 403, body: JSON.stringify({ type: "error", error: { type: "budget_exceeded", message: "The AI budget for Carrier Board reader this month ($10.00) has been reached, so it is paused until next month or until the budget is raised in Admin." } }) });
  await assert.rejects(run({ circularId: "c1", dryRun: true }), /AI budget for Carrier Board reader/);
  assert.ok(calls.length - before <= 12, "a refusal is not retried over and over");

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

  // 10) by default the second read is the cheap model with thinking ON; secondRead: "sonnet" gives two careful reads; if the cheap one refuses, the careful one does that read
  calls.length = 0;
  store.set("circularsLibrary/c1", { category: "airline_tariff", carrier: "EK", title: "EK_BLR", fileName: "BLR TARIFF.xlsx", storagePath: "circulars/x/EK.xlsx" });
  bucketFile = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  behave = () => ({});
  res = await run({ circularId: "c1", dryRun: true });
  assert.ok(calls.filter((c) => c.isB).every((c) => c.body.model === "claude-haiku-5-5" && c.body.thinking.type === "adaptive"), "default: the cheap second read thinks first");
  assert.ok(calls.filter((c) => c.isB).every((c) => c.body.thinking.type !== "disabled"), "thinking is never switched off for the cheap model");
  assert.equal(res.models.readB, "claude-haiku-5-5");
  assert.equal(res.applied + res.unchanged, N, "every route read and agreed");
  calls.length = 0;
  res = await run({ circularId: "c1", dryRun: true, secondRead: "sonnet" });
  assert.ok(calls.every((c) => c.body.model === "claude-sonnet-5-5"), "secondRead: sonnet keeps both reads on the careful model");
  assert.equal(res.models.readB, "claude-sonnet-5-5");
  assert.equal(res.applied + res.unchanged, N);
  calls.length = 0;
  refuseCheap = true;
  res = await run({ circularId: "c1", dryRun: true });
  assert.equal(res.applied + res.unchanged, N, "if the cheaper model refuses, the read is done by the stronger one and still counts");
  assert.equal(res.models.readB, "claude-sonnet-5-5");
  refuseCheap = false;


  // 8) auto-read: an uploaded airline circular is read by itself; switched off, over the limit, or the wrong kind it is not
  const upload = (id, data) => { store.set("circularsLibrary/" + id, data); return autoReadCarrierCircular.run({ data: { data: () => data }, params: { circularId: id } }); };
  const wipe = () => { [...store.keys()].filter((k) => /^(carrierTariffs|air_tariffs|carrierReads|carrierTariffHolds)\//.test(k)).forEach((k) => store.delete(k)); calls.length = 0; };
  const sheet = { category: "airline_tariff", carrier: "EK", title: "EK_BLR rev", fileName: "BLR TARIFF.xlsx", storagePath: "circulars/x/EK.xlsx", uploadedBy: "ganny" };
  wipe();
  await upload("a1", sheet);
  assert.equal(store.get("carrierReads/a1").status, "read", "no settings saved yet: auto-read is on");
  assert.equal(store.get("carrierReads/a1").auto, true);
  assert.equal(store.get("carrierReads/a1").uploadedBy, "ganny", "the uploader is recorded on the read");
  assert.equal(store.get("carrierReads/a1").applied, N);
  assert.ok([...store.keys()].some((k) => k.startsWith("air_tariffs/")), "an auto-read also feeds the Air desk");
  const readCalls = calls.length;
  await upload("a1", sheet);
  assert.equal(calls.length, readCalls, "an already-read circular is not read twice");
  wipe();
  await upload("a2", { ...sheet, category: "line_circular", carrier: "Maersk", title: "Peak season notice", uploadedBy: "priya" });
  assert.equal(store.get("carrierReads/a2").status, "read", "a liner circular is summarised");
  assert.equal(store.get("carrierReads/a2").kind, "digest");
  assert.equal(store.get("carrierReads/a2").uploadedBy, "priya", "the uploader is recorded so they can be told");
  const dg = store.get("circularDigests/a2");
  assert.equal(dg.kind, "liner");
  assert.equal(dg.validTo, "2026-12-31");
  assert.deepEqual(dg.charges, [{ name: "Peak season surcharge", amount: 450, currency: "USD", unit: "per 20ft", appliesTo: "INNSA to NLRTM", note: "" }], "a charge with no name is dropped, numbers become numbers");
  assert.equal(dg.summary.length, 2);
  assert.equal(calls.length, 1, "a digest is one read, not two");
  assert.equal(calls[0].body.model, "claude-haiku-5-5", "digests use the cheap model");
  assert.notEqual(calls[0].body.thinking.type, "disabled");
  assert.ok(!store.has("carrierTariffs/a2") && ![...store.keys()].some((k) => k.startsWith("air_tariffs/")), "a digest never touches rates");
  wipe();
  await upload("a2b", { ...sheet, category: "something_else" });
  assert.ok(!store.has("carrierReads/a2b") && calls.length === 0, "unknown kinds of circular are left alone");
  digestReply = "I could not read this.";
  await upload("a2c", { ...sheet, category: "general" });
  assert.equal(store.get("carrierReads/a2c").status, "failed", "a reply with no digest in it is reported, not hidden");
  assert.match(store.get("carrierReads/a2c").reason, /Nothing useful/);
  digestReply = "{}";
  await upload("a2d", { ...sheet, category: "general" });
  assert.equal(store.get("carrierReads/a2d").status, "failed", "an empty digest counts as nothing");
  // a replaced file is read again; other edits are not
  wipe();
  digestReply = JSON.stringify({ kind: "other", summary: ["New rates apply."], charges: [] });
  const replace = (id, before, after) => autoReadReplacedCircular.run({ data: { before: { data: () => before }, after: { data: () => after } }, params: { circularId: id } });
  const lib = { ...sheet, category: "line_circular", storagePath: "circulars/x/old.xlsx" };
  await replace("a2e", lib, { ...lib, notes: "edited" });
  assert.ok(!store.has("carrierReads/a2e") && calls.length === 0, "editing notes or station does not read again");
  await replace("a2e", lib, { ...lib, storagePath: "circulars/x/new.xlsx" });
  assert.equal(store.get("carrierReads/a2e").status, "read", "a replacement file is read");
  assert.equal(store.get("carrierReads/a2e").storagePath, "circulars/x/new.xlsx");
  await replace("a2e", lib, { ...lib, storagePath: "circulars/x/new.xlsx" });
  assert.equal(calls.length, 1, "the same replacement is not read twice");
  digestReply = "x";
  wipe();
  await upload("a3", { ...sheet, storagePath: "" });
  assert.ok(!store.has("carrierReads/a3") && calls.length === 0, "no file, nothing to read");
  store.set("carrierReadSettings/auto", { enabled: false, monthlyCapUsd: 3 });
  await upload("a4", sheet);
  assert.equal(store.get("carrierReads/a4").status, "skipped");
  assert.match(store.get("carrierReads/a4").reason, /switched off/);
  assert.equal(calls.length, 0, "switched off: the AI is not called");
  store.set("carrierReadSettings/auto", { enabled: true, monthlyCapUsd: 3 });
  const monthKey = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 7);
  store.set("aiUsage/" + monthKey, { month: monthKey, days: { "09": { "readCarrierCircular__claude-sonnet-5-5": { calls: 10, input: 1000000, output: 80000, web: 0 } } } });
  await upload("a5", sheet);
  assert.equal(store.get("carrierReads/a5").status, "skipped");
  assert.match(store.get("carrierReads/a5").reason, /limit \(\$3\.00/);
  assert.equal(calls.length, 0, "over the monthly limit: the AI is not called");
  store.delete("aiUsage/" + monthKey);
  bucketFile = Buffer.from("not a spreadsheet");
  await upload("a6", { ...sheet, fileName: "weird.docx", storagePath: "circulars/x/weird.docx" });
  assert.equal(store.get("carrierReads/a6").status, "failed", "an unreadable file is recorded as failed, not lost");
  assert.match(store.get("carrierReads/a6").reason, /Only PDF and Excel/);
  // the admin's settings callable
  assert.deepEqual(await carrierAutoReadSave.run({ auth: { token: { email: "ganny@atlaspricing.com" } }, data: { enabled: true, monthlyCapUsd: 5 }, rawRequest: {} }), { ok: true, enabled: true, monthlyCapUsd: 5 });
  assert.equal(store.get("carrierReadSettings/auto").monthlyCapUsd, 5);
  await assert.rejects(carrierAutoReadSave.run({ auth: { token: { email: "someone@else.com" } }, data: { enabled: true, monthlyCapUsd: 5 }, rawRequest: {} }), /Only the admin/);
  await assert.rejects(carrierAutoReadSave.run({ auth: { token: { email: "ganny@atlaspricing.com" } }, data: { enabled: true, monthlyCapUsd: 500 }, rawRequest: {} }), /monthly limit/);


  // 9) reading what is already in the library (admin only, quiet, skips what is done)
  const readLib = (id, data, email = "ganny@atlaspricing.com", extra = {}) => readLibraryCircular.run({ auth: { token: { email } }, data: { circularId: id, ...extra }, rawRequest: {} });
  wipe();
  digestReply = JSON.stringify({ kind: "airline", summary: ["Fuel surcharge changes."], charges: [{ name: "Fuel surcharge", amount: 12.5, currency: "INR", unit: "per kg" }] });
  bucketFile = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  store.set("circularsLibrary/L1", { ...sheet, category: "airline_tariff", uploadedBy: "someone" });
  store.set("circularsLibrary/L2", { ...sheet, category: "fuel_circular_shipping", title: "Line notice", uploadedBy: "someone" });
  store.set("circularsLibrary/L3", { ...sheet, category: "airline_tariff", storagePath: "" });
  store.set("circularsLibrary/L4", { ...sheet, category: "courier_tariff_unknown" });
  await assert.rejects(readLib("L1", null, "someone@else.com"), /Only the admin/);
  let l1 = await readLib("L1");
  assert.equal(l1.kind, "rates");
  assert.equal(l1.applied, N);
  assert.equal(store.get("carrierReads/L1").uploadedBy, "", "a backfill does not notify the original uploader");
  assert.equal(store.get("carrierReads/L1").status, "read");
  const callsAfterL1 = calls.length;
  l1 = await readLib("L1");
  assert.deepEqual([l1.skipped, calls.length], [true, callsAfterL1], "an already-read circular is skipped and costs nothing");
  const l2 = await readLib("L2");
  assert.equal(l2.kind, "digest");
  assert.equal(store.get("carrierReads/L2").uploadedBy, "");
  assert.equal(store.get("circularDigests/L2").charges[0].amount, 12.5);
  await assert.rejects(readLib("L3"), /no file/);
  await assert.rejects(readLib("L4"), /not read automatically/);
  await assert.rejects(readLib("nope"), /does not exist/);
  digestReply = "no json";
  store.set("circularsLibrary/L5", { ...sheet, category: "general", uploadedBy: "someone" });
  await assert.rejects(readLib("L5"), /Nothing useful/);
  assert.equal(store.get("carrierReads/L5").status, "failed", "a failed backfill is recorded on the circular, quietly");
  assert.equal(store.get("carrierReads/L5").uploadedBy, "");

  console.log("carrier reader end-to-end tests passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
