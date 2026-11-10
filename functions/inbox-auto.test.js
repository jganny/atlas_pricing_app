/**
 * Automatic acknowledgements and shipment confirmations, end to end with a pretend mail server, database, SMTP and AI.
 */
const assert = require("node:assert/strict");
const Module = require("node:module");
process.env.IMAP_PRICING_PASSWORD = "x";
process.env.IMAP_PRICINGSALES_PASSWORD = "y";
process.env.ANTHROPIC_API_KEY = "test-key";

const PDF = Buffer.alloc(8000, "B");
const plain = (m) => Buffer.from(`From: ${m.from}\r\nTo: pricing@atlaslogistics.co.in\r\nSubject: ${m.subject}\r\nMessage-ID: <${m.id}@x>\r\n${m.inReplyTo ? `In-Reply-To: <${m.inReplyTo}@x>\r\nReferences: <${m.root || m.inReplyTo}@x>\r\n` : ""}${m.headers || ""}Content-Type: text/plain; charset=utf-8\r\n\r\n${m.body}\r\n`);
const multi = (m) => Buffer.from(`From: ${m.from}\r\nTo: pricing@atlaslogistics.co.in\r\nSubject: ${m.subject}\r\nMessage-ID: <${m.id}@x>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="b1"\r\n\r\n--b1\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${m.body}\r\n${m.pdfs.map((n) => `--b1\r\nContent-Type: application/pdf; name="${n}"\r\nContent-Disposition: attachment; filename="${n}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${PDF.toString("base64")}\r\n`).join("")}--b1--\r\n`);
const sourceOf = (m) => (m.pdfs ? multi(m) : plain(m));
const structureOf = (m) => (m.pdfs ? { type: "multipart/mixed", childNodes: [{ type: "text/plain", size: 40 }, ...m.pdfs.map((n) => ({ type: "application/pdf", disposition: "attachment", dispositionParameters: { filename: n }, size: PDF.length }))] } : { type: "text/plain", size: 100 });

let MESSAGES = [
  { uid: 201, id: "e1", from: "Ravi Kumar <ravi@acme.com>", subject: "Rate request", body: "Please quote 3 cartons, 180 kg gross weight, from Bangalore to Frankfurt, ex works." },
  { uid: 202, id: "e2", from: "Ravi Kumar <ravi@acme.com>", subject: "Re: Rate request", body: "Also please quote 2 cartons, 90 kg, from Bangalore to Frankfurt.", inReplyTo: "e1", root: "e1" },
  { uid: 203, id: "e3", from: "Robot <noreply@portal.com>", subject: "RFQ 55", body: "Please quote 5 pallets 800 kg from BOM to DXB ex works." },
  { uid: 204, id: "e4", from: "Colleague <someone@atlaslogistics.co.in>", subject: "Fwd: Rate request", body: "Please quote 5 pallets 800 kg from BOM to DXB ex works." },
  { uid: 205, id: "c1", from: "Hans Mueller <hans@euroagent.de>", subject: "Booking confirmed FRA to BLR", body: "Please proceed. Shipper: ABC GmbH, Berlin. Consignee: XYZ India Pvt Ltd, Bangalore. 3 cartons machinery." },
  { uid: 206, id: "c2", from: "Anna Weiss <anna@otheragent.de>", subject: "Shipment confirmation - please proceed", body: "Pls proceed with pickup, documents attached.", pdfs: ["Commercial Invoice 77.pdf", "Packing List 77.pdf"] },
];
const touched = [];
class FakeImap {
  constructor(o) { this.pricing = String(o.auth.user).startsWith("pricing@"); }
  async connect() {}
  async getMailboxLock() { return { release() {} }; }
  async fetchOne(seq, q) { if (q && q.source) { const m = MESSAGES.find((x) => x.uid === Number(seq)); return m ? { uid: m.uid, source: sourceOf(m) } : false; } return { uid: 200 }; }
  async search() { return this.pricing ? MESSAGES.map((m) => m.uid) : []; }
  async fetchAll(range, query) {
    if (query && query.envelope) return (Array.isArray(range) && this.pricing ? range : []).map((uid) => { const m = MESSAGES.find((x) => x.uid === uid); const a = /<(.+?)>/.exec(m.from); const n = /^(.*?)\s*</.exec(m.from); return { uid, envelope: { messageId: `<${m.id}@x>`, subject: m.subject, date: new Date(), from: [{ name: n ? n[1] : "", address: a ? a[1] : m.from }] }, bodyStructure: structureOf(m), source: sourceOf(m) }; });
    if (!this.pricing) return [];
    return MESSAGES.map((m) => ({ uid: m.uid })).filter((m) => (typeof range === "string" ? m.uid >= Number(range.split(":")[0]) : true));
  }
  async messageFlagsAdd() { touched.push("flags"); }
  async logout() {}
  close() {}
}

const store = new Map();
let autoN = 0;
const docRef = (name, id) => ({
  id,
  path: `${name}/${id}`,
  async get() { const v = store.get(`${name}/${id}`); return { exists: v !== undefined, data: () => v }; },
  async set(data, opts) { const k = `${name}/${id}`; const prev = store.get(k) || {}; store.set(k, opts && opts.merge ? { ...prev, ...Object.fromEntries(Object.entries(data).map(([a, b]) => [a, b && b.__inc !== undefined ? (prev[a] || 0) + b.__inc : b])) } : data); },
});
const fakeDb = {
  collection(name) {
    return {
      async add(data) { const id = `auto${++autoN}`; store.set(`${name}/${id}`, data); return { id }; },
      where(field, op, value) { return { limit: () => ({ async get() { const hit = [...store.entries()].filter(([k, v]) => k.startsWith(`${name}/`) && v[field] === value); return { empty: hit.length === 0 }; } }) }; },
      doc: (id) => docRef(name, id),
    };
  },
};
const fsFn = () => fakeDb;
fsFn.FieldValue = { increment: (n) => ({ __inc: n }), serverTimestamp: () => ({ __ts: true }) };

// pretend SMTP
const sent = [];
let smtpFails = false;
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "imapflow") return { ImapFlow: FakeImap };
  if (request === "nodemailer") return { createTransport: () => ({ async sendMail(o) { if (smtpFails) throw new Error("550 refused"); sent.push(o); return {}; }, async verify() { return true; } }) };
  return realLoad.call(this, request, ...rest);
};
const admin = require("firebase-admin");
Object.defineProperty(admin, "firestore", { value: fsFn, configurable: true });
Object.defineProperty(admin, "apps", { value: [{}], configurable: true });
Object.defineProperty(admin, "storage", { value: () => ({ bucket: () => ({ name: "b", file: () => ({ async save() {} }) }) }), configurable: true });

// pretend AI
const aiCalls = [];
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  aiCalls.push(body);
  const isConfirm = /CONFIRMATION email/.test(body.system || "");
  if (isConfirm) {
    const hasDoc = (body.messages[0].content || []).some((c) => c.type === "document");
    const text = (body.messages[0].content || []).map((c) => c.text || "").join(" ");
    let out;
    if (/ABC GmbH/.test(text)) out = { mode: "air", direction: "import", agent: { name: "Hans Mueller", company: "EuroAgent" }, shipper: { name: "ABC GmbH", address: "Berlin" }, consignee: { name: "XYZ India Pvt Ltd", address: "Bangalore" }, pol: "FRA", pod: "BLR", commodity: "Machinery", pieces: 3 };
    else if (hasDoc) out = { mode: "sea", direction: "export", agent: { name: "Anna Weiss" }, shipper: { name: "Indo Exports Pvt Ltd" }, consignee: { name: "Weiss GmbH" }, pol: "Chennai", pod: "Hamburg", commodity: "Textiles" };
    else out = { mode: "unknown", direction: "unknown", agent: { name: "Anna Weiss" } };
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(out) }], usage: { input_tokens: 900, output_tokens: 150 } }), { status: 200 });
  }
  return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ tag: "needs_human", actionRequired: true, reason: "x", mode: "unknown" }) }], usage: { input_tokens: 500, output_tokens: 40 } }), { status: 200 });
};

const { pollPricingInboxes, autoReplyTest } = require("./inbox-poll");

(async () => {
  // ---- 1) switches OFF (the default): nothing is sent, but the confirmations still reach NRS ----
  let res = await pollPricingInboxes.run({}, {});
  assert.equal(sent.length, 0, "nothing is sent until the admin turns it on");
  const nrs0 = [...store.keys()].filter((k) => k.startsWith("nrs_registry/"));
  assert.equal(nrs0.length, 2, "the two confirmations are in NRS even with replies off");
  assert.ok([...store.values()].some((v) => v && typeof v.message === "string" && /Shipment confirmed by email/.test(v.message)), "and the NRS desk is told");
  const inbox0 = [...store.values()].filter((v) => v && v.mailbox === "pricing" && v.subject);
  assert.ok(!inbox0.some((v) => /confirm|proceed/i.test(v.subject)), "confirmations are not kept in the Inbox");

  // ---- 2) switches ON, with branch teams ----
  [...store.keys()].filter((k) => k.startsWith("inbox_") || k.startsWith("nrs_")).forEach((k) => store.delete(k));
  store.set("inboxAutoReply/settings", { ackEnquiry: true, ackConfirmation: true, testRedirect: "", dailyCap: 50, nrsDesk: "NRS Desk", branchTeams: [{ branch: "Bangalore", stations: ["BLR", "Bangalore"], emails: ["blr-team@atlaslogistics.co.in", "blr-ops@atlaslogistics.co.in"] }, { branch: "Chennai", stations: ["MAA", "Chennai"], emails: ["maa-team@atlaslogistics.co.in"] }] });
  sent.length = 0;
  res = await pollPricingInboxes.run({}, {});
  // (the first run is the cursor's first look; run again with fresh uids so the messages are "new")
  MESSAGES = MESSAGES.map((m) => ({ ...m, uid: m.uid + 100, id: `${m.id}b`, inReplyTo: m.inReplyTo ? `${m.inReplyTo}b` : undefined, root: m.root ? `${m.root}b` : undefined }));
  store.delete("inbox_poll_state/pricing"); store.delete("inbox_poll_state/pricingsales");
  [...store.keys()].filter((k) => k.startsWith("inbox_acks/") || k.startsWith("inbox_ack_caps/") || k.startsWith("inbox_ack_log/") || k.startsWith("nrs_")).forEach((k) => store.delete(k));
  sent.length = 0;
  res = await pollPricingInboxes.run({}, {});
  const pr = res.find((r) => r.mailbox === "pricing");
  const toRavi = sent.filter((m) => m.to === "ravi@acme.com");
  assert.equal(toRavi.length, 1, "one acknowledgement for the enquiry thread, not two");
  assert.equal(toRavi[0].subject, "Re: Rate request");
  assert.match(toRavi[0].text, /Dear Ravi,/);
  assert.equal(toRavi[0].headers["Auto-Submitted"], "auto-replied", "marked as automatic so other systems do not answer it");
  assert.equal(toRavi[0].inReplyTo, "<e1b@x>");
  assert.match(toRavi[0].from, /Air Desk|Pricing Desk|Sea Desk/);
  assert.match(toRavi[0].from, /pricing@atlaslogistics\.co\.in/);
  assert.ok(!sent.some((m) => /noreply|someone@atlaslogistics/.test(String(m.to))), "never to a system address or to our own people");

  // confirmation 1: parties in the text, no documents -> a reply with the Bangalore team copied
  const toHans = sent.find((m) => m.to === "hans@euroagent.de");
  assert.ok(toHans, "the agent is answered");
  assert.deepEqual(toHans.cc, ["blr-team@atlaslogistics.co.in", "blr-ops@atlaslogistics.co.in"], "an import into BLR: the Bangalore team is copied");
  assert.match(toHans.text, /Bangalore team is copied/);
  assert.match(toHans.text, /Shipper: ABC GmbH/);
  assert.equal(toHans.attachments.length, 0, "no documents came with it, none are attached");
  const hansCalls = aiCalls.filter((b) => /ABC GmbH/.test(JSON.stringify(b.messages)));
  assert.ok(hansCalls.length >= 1 && !hansCalls.some((b) => b.messages[0].content.some((c) => c.type === "document")), "the parties were in the text, so no document was read");

  // confirmation 2: only documents -> read once from the PDFs, replied with the team (export from Chennai) and the documents attached
  const toAnna = sent.find((m) => m.to === "anna@otheragent.de");
  assert.ok(toAnna);
  assert.deepEqual(toAnna.cc, ["maa-team@atlaslogistics.co.in"], "an export from Chennai: the Chennai team");
  assert.deepEqual(toAnna.attachments.map((a) => a.filename), ["Commercial Invoice 77.pdf", "Packing List 77.pdf"], "the documents received are attached");
  assert.ok(aiCalls.some((b) => b.messages[0].content.some((c) => c.type === "document")), "the invoice and packing list were read because the text named nobody");

  // NRS
  const nrs = [...store.entries()].filter(([k]) => k.startsWith("nrs_registry/")).map(([, v]) => v);
  assert.equal(nrs.length, 2);
  const a = nrs.find((n) => n.shipperName === "ABC GmbH");
  assert.deepEqual([a.mode, a.pol, a.pod, a.consigneeName, a.agent, a.pendingShipperDetails, a.source], ["air", "FRA", "BLR", "XYZ India Pvt Ltd", "Hans Mueller", false, "email"]);
  const alerts = [...store.entries()].filter(([k]) => k.startsWith("nrs_alerts/")).map(([, v]) => v);
  assert.ok(alerts.some((x) => /ABC GmbH to XYZ India Pvt Ltd/.test(x.message)), "the NRS desk is told who and where");

  // the log for the admin
  const log = [...store.entries()].filter(([k]) => k.startsWith("inbox_ack_log/")).map(([, v]) => v);
  assert.equal(log.length, sent.length);
  assert.ok(log.every((l) => l.status === "sent" && l.test === false));
  assert.deepEqual(touched, [], "the mailbox is never changed");

  // ---- 3) the same mails again: nothing is sent twice ----
  const before = sent.length;
  store.delete("inbox_poll_state/pricing"); store.delete("inbox_poll_state/pricingsales");
  [...store.keys()].filter((k) => k.startsWith("inbox_enquiries/")).forEach((k) => store.delete(k));
  await pollPricingInboxes.run({}, {});
  assert.equal(sent.length, before, "one reply per thread, ever");

  // ---- 4) test mode: every message goes to the admin's address instead, labelled ----
  store.set("inboxAutoReply/settings", { ...store.get("inboxAutoReply/settings"), testRedirect: "admin@test.com" });
  MESSAGES = MESSAGES.map((m) => ({ ...m, uid: m.uid + 100, id: `${m.id}c`, inReplyTo: m.inReplyTo ? `${m.inReplyTo}c` : undefined, root: m.root ? `${m.root}c` : undefined }));
  store.delete("inbox_poll_state/pricing"); store.delete("inbox_poll_state/pricingsales");
  sent.length = 0;
  await pollPricingInboxes.run({}, {});
  assert.ok(sent.length >= 3);
  assert.ok(sent.every((m) => m.to === "admin@test.com" && !m.cc), "nothing reaches a real customer while testing");
  assert.ok(sent.every((m) => /^\[TEST - would go to /.test(m.subject)), "each says who it would have gone to");

  // ---- 5) a mail server that refuses: logged, never thrown, never repeated ----
  MESSAGES = MESSAGES.map((m) => ({ ...m, uid: m.uid + 100, id: `${m.id}d`, inReplyTo: m.inReplyTo ? `${m.inReplyTo}d` : undefined, root: m.root ? `${m.root}d` : undefined }));
  store.delete("inbox_poll_state/pricing"); store.delete("inbox_poll_state/pricingsales");
  smtpFails = true;
  const failRes = await pollPricingInboxes.run({}, {});
  assert.equal(failRes.find((r) => r.mailbox === "pricing").error, undefined, "a refused send does not break the poll");
  assert.ok([...store.values()].some((v) => v && v.status === "failed" && /refused/.test(v.error || "")), "the failure is logged for the admin");
  smtpFails = false;

  // ---- 6) the ceiling ----
  store.set("inboxAutoReply/settings", { ...store.get("inboxAutoReply/settings"), testRedirect: "", dailyCap: 1 });
  MESSAGES = MESSAGES.map((m) => ({ ...m, uid: m.uid + 100, id: `${m.id}e`, inReplyTo: m.inReplyTo ? `${m.inReplyTo}e` : undefined, root: m.root ? `${m.root}e` : undefined }));
  store.delete("inbox_poll_state/pricing"); store.delete("inbox_poll_state/pricingsales");
  store.delete(`inbox_ack_caps/${new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)}`);
  sent.length = 0;
  await pollPricingInboxes.run({}, {});
  assert.equal(sent.length, 1, "a daily ceiling stops the rest");

  // ---- 7) the admin's test button ----
  sent.length = 0;
  await assert.rejects(autoReplyTest.run({ to: "a@b.com" }, { auth: { token: { email: "someone@atlaspricing.com" } } }), /Only the admin/);
  await assert.rejects(autoReplyTest.run({ to: "nope" }, { auth: { token: { email: "ganny@atlaspricing.com" } } }), /valid|address/i);
  const t = await autoReplyTest.run({ to: "me@test.com" }, { auth: { token: { email: "ganny@atlaspricing.com" } } });
  assert.deepEqual([t.ok, t.sent], [true, 2]);
  assert.ok(sent.every((m) => m.to === "me@test.com" && /^\[TEST\]/.test(m.subject)), "the test goes only to the typed address");
  assert.equal(sent[1].attachments.length, 1);

  console.log("inbox auto ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
