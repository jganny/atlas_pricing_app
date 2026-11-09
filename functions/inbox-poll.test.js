/**
 * The mailbox poller end to end with a pretend mail server, a pretend database and a pretend AI: noise is dropped for free,
 * clear enquiries are kept without the AI, unclear ones are asked, nothing in the mailbox is changed.
 */
const assert = require("node:assert/strict");
const Module = require("node:module");
process.env.IMAP_PRICING_PASSWORD = "x";
process.env.IMAP_PRICINGSALES_PASSWORD = "y";
process.env.ANTHROPIC_API_KEY = "test-key";

const mail = (id, from, subject, body, extra = "") =>
  Buffer.from(`From: ${from}\r\nTo: pricing@atlaslogistics.co.in\r\nSubject: ${subject}\r\nMessage-ID: <${id}@x>\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n${extra}\r\n${Buffer.from(body).toString("base64")}\r\n`);

const MESSAGES = [
  { uid: 101, id: "m1", from: "Newsletter <news@carrier.com>", subject: "Weekly rates newsletter", body: "unsubscribe", extra: "List-Unsubscribe: <mailto:u@x.com>\r\n" },
  { uid: 102, id: "m2", from: "Buyer <buyer@acme.com>", subject: "Rate request", body: "Please quote 3 cartons, 180 kg gross weight, from Bangalore to Frankfurt, ex works." },
  { uid: 103, id: "m3", from: "Buyer <buyer@acme.com>", subject: "Need rates", body: "Can you share rates for our usual lane? Thanks" },
  { uid: 104, id: "m4", from: "noreply@bank.com", subject: "Statement", body: "your statement is ready" },
  { uid: 105, id: "m5", from: "Friend <f@x.com>", subject: "Lunch?", body: "shall we have lunch" },
];

// ---- a pretend mail server ----
const touched = [];
class FakeImap {
  constructor() {}
  async connect() {}
  async getMailboxLock() { return { release() {} }; }
  async search(q) {
    if (q && q.header && q.header["message-id"]) return MESSAGES.filter((m) => `<${m.id}@x>` === q.header["message-id"]).map((m) => m.uid);
    return MESSAGES.map((m) => m.uid);
  }
  async fetchOne(seq, query) {
    if (query && query.source) {
      const m = MESSAGES.find((x) => x.uid === Number(seq));
      return m ? { uid: m.uid, source: mail(m.id, m.from, m.subject, m.body, m.extra) } : false;
    }
    return { uid: 100 };
  }
  async fetchAll(range, query) {
    if (query && query.envelope) {
      return (Array.isArray(range) ? range : []).map((uid) => {
        const m = MESSAGES.find((x) => x.uid === uid);
        const m2 = /<(.+?)>/.exec(m.from);
        return { uid, envelope: { messageId: `<${m.id}@x>`, subject: m.subject, date: new Date(), from: [{ name: "", address: m2 ? m2[1] : m.from }] }, source: mail(m.id, m.from, m.subject, m.body, m.extra) };
      });
    }
    return MESSAGES.map((m) => ({ uid: m.uid })).filter((m) => typeof range === "string" ? m.uid >= Number(range.split(":")[0]) : true);
  }
  async messageFlagsAdd() { touched.push("flags"); }
  async messageDelete() { touched.push("delete"); }
  async logout() {}
  close() {}
}

// ---- a pretend database ----
const store = new Map();
const fakeDb = {
  collection(name) {
    return {
      doc: (id) => ({
        async get() { const v = store.get(`${name}/${id}`); return { exists: v !== undefined, data: () => v }; },
        async set(data, opts) { const k = `${name}/${id}`; const prev = store.get(k) || {}; store.set(k, opts && opts.merge ? { ...prev, ...Object.fromEntries(Object.entries(data).map(([a, b]) => [a, b && b.__inc !== undefined ? (prev[a] || 0) + b.__inc : b])) } : data); },
      }),
    };
  },
};
const fsFn = () => fakeDb;
fsFn.FieldValue = { increment: (n) => ({ __inc: n }), serverTimestamp: () => ({ __ts: true }) };

const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "imapflow") return { ImapFlow: FakeImap };
  return realLoad.call(this, request, ...rest);
};
const admin = require("firebase-admin");
Object.defineProperty(admin, "firestore", { value: fsFn, configurable: true });
Object.defineProperty(admin, "apps", { value: [{}], configurable: true });

// ---- a pretend AI ----
const aiCalls = [];
globalThis.fetch = async (url, init) => {
  aiCalls.push(JSON.parse(init.body));
  return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ tag: "new_enquiry", actionRequired: true, reason: "asks for rates", mode: "air", customer: "Acme", origin: "BLR", destination: "FRA", summary: "Rates for the usual lane" }) }], usage: { input_tokens: 800, output_tokens: 60 } }), { status: 200 });
};

const { pollPricingInboxes, fetchInboxEmail } = require("./inbox-poll");

(async () => {
  const results = await pollPricingInboxes.run({}, {});
  const pricing = results.find((r) => r.mailbox === "pricing");
  assert.equal(pricing.error, undefined);
  const docs = [...store.entries()].filter(([k]) => k.startsWith("inbox_enquiries/")).map(([, v]) => v);
  assert.deepEqual([...new Set(docs.map((d) => d.subject))].sort(), ["Need rates", "Rate request"], "only the two enquiries are kept; the other three are dropped");
  assert.equal(docs.length, 4, "two enquiries in each of the two mailboxes (the fake server gives both the same mail)");
  assert.equal(aiCalls.length, 2, "one unclear mail per mailbox is asked (the same fake inbox is read twice); the clear enquiry and the noise cost nothing");
  const clear = docs.find((d) => d.subject === "Rate request" && d.mailbox === "pricing");
  assert.equal(clear.tag, "new_enquiry");
  assert.equal(clear.classifier, "heuristic", "a clear enquiry is kept without the AI");
  assert.ok(/Frankfurt|FRA/i.test(clear.bodyPreview), "the readable text, not the raw mail, is what is looked at");
  assert.equal(clear.body, "", "the full mail is never stored");
  const unclear = docs.find((d) => d.subject === "Need rates" && d.mailbox === "pricing");
  assert.equal(unclear.classifier, "anthropic");
  assert.equal(unclear.uid, 103, "the mail's number is kept so it can be fetched when someone actions it");
  assert.deepEqual(touched, [], "nothing in the mailbox is marked read, moved or deleted");
  const stats = [...store.entries()].filter(([k]) => k.startsWith("inbox_stats/")).map(([, v]) => v);
  const p = stats.find((s) => s.mailbox === "pricing");
  assert.deepEqual([p.scanned, p.ruleNoise, p.aiAsked, p.kept], [5, 3, 1, 2], "5 mails: 3 dropped by the free rules, 1 asked of the AI, 2 kept");
  // the cursor moves on, so the same mails are not read again
  assert.equal(store.get("inbox_poll_state/pricing").lastUid, 100);
  // ---- actioning one: the whole mail comes back on request, and costs no AI credit ----
  const kept = [...store.entries()].find(([k, v]) => k.startsWith("inbox_enquiries/") && v.subject === "Rate request" && v.mailbox === "pricing");
  const id = kept[0].split("/")[1];
  const before = aiCalls.length;
  const got = await fetchInboxEmail.run({ id }, { auth: { uid: "u", token: { email: "shashank@atlaspricing.com" } } });
  const text = Buffer.from(got.eml, "base64").toString("utf8");
  assert.match(text, /Subject: Rate request/);
  assert.equal(got.truncated, false);
  assert.equal(aiCalls.length, before, "fetching the mail uses no AI credit");
  await assert.rejects(fetchInboxEmail.run({ id }, { auth: { uid: "u", token: { chatOnly: true } } }), /Sign in/);
  await assert.rejects(fetchInboxEmail.run({ id }, {}), /Sign in/);
  await assert.rejects(fetchInboxEmail.run({ id: "nope" }, { auth: { uid: "u", token: {} } }), /no longer in the list/);
  console.log("inbox poll ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
