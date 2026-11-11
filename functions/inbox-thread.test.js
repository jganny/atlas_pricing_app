const assert = require("node:assert/strict");
const T = require("./inbox-thread");

// ---- pieces ----
assert.equal(T.normalizeSubject("RE: FW: [EXTERNAL] AMD - LRD//463Kg"), "amd - lrd//463kg");
assert.equal(T.normalizeSubject("Cotización aérea ticket #109196"), "cotización aérea ticket #109196");
assert.equal(T.normalizeSubject(""), "");
// Outlook conversation mark: same first 22 bytes, different tail -> same root.
const base = Buffer.alloc(22, 7).toString("base64");
const a = Buffer.concat([Buffer.alloc(22, 7), Buffer.from([1, 2, 3, 4, 5])]).toString("base64");
const b = Buffer.concat([Buffer.alloc(22, 7), Buffer.from([9, 9, 9, 9, 9])]).toString("base64");
assert.equal(T.convRootOf(a), T.convRootOf(b));
assert.notEqual(T.convRootOf(a), "");
assert.equal(T.convRootOf("abc"), "");
assert.equal(T.convRootOf(base), T.convRootOf(a));

assert.deepEqual(T.extractCodes("AMD - LRD//463Kg"), ["AMD", "LRD"]);
assert.deepEqual(T.extractCodes("AOL: BEST OPTION\nAOD: LRD"), ["LRD"]);
assert.deepEqual(T.extractCodes("Please quote BOM to NRT, EXW, FOB"), ["BOM", "NRT"]);
assert.deepEqual(T.extractCodes("rates in USD for 100 KGS"), []);
assert.deepEqual(T.extractWeights("AMD - LRD//463Kg"), [463]);
assert.deepEqual(T.extractWeights("gross weight 1,250.5 and 20 kgs"), [20, 1250.5]);
assert.ok(T.extractTokens("Cotización aérea ticket #109196").includes("109196"));
assert.ok(T.extractTokens("Ref No: AB-12345 please").includes("ab-12345"));
assert.deepEqual(T.extractTokens("on 12 November 2026, 100 boxes"), []);
assert.ok(T.weightsMatch(463, 463.0) && T.weightsMatch(463, 464) && !T.weightsMatch(463, 520));

// ---- a tiny stand-in for the database ----
function fakeDb(data) {
  const col = (name) => ({
    doc: (id) => ({ get: async () => ({ exists: !!(data[name] || {})[id], id, data: () => (data[name] || {})[id] }) }),
    where: (field, op, value) => ({
      limit: () => ({
        get: async () => ({
          docs: Object.entries(data[name] || {})
            .filter(([, v]) => (op === "==" ? v[field] === value : v[field] > value))
            .map(([id, v]) => ({ id, data: () => v })),
        }),
      }),
    }),
  });
  return { collection: col };
}

const NOW = Date.parse("2026-11-11T05:30:00Z");
const hours = (h) => new Date(NOW - h * 3_600_000).toISOString();
const enquirySig = T.signalsOf({ subject: "Cotización aérea ticket #109196", text: "Please quote. AOL: BEST OPTION AOD: LRD. 463 kg gross.", threadIndex: a, refs: [] });
const enquiry = { mailbox: "pricing", tag: "new_enquiry", receivedAt: hours(2), timestamp: NOW - 2 * 3_600_000, messageId: "<orig@airmar>", from: "Briseyda <bcruz@airmar.com.mx>", ...enquirySig };
const otherEnquiry = { mailbox: "pricing", tag: "new_enquiry", receivedAt: hours(1.5), timestamp: NOW - 1.5 * 3_600_000, messageId: "<other@x>", from: "Omar <o@x.ae>", ...T.signalsOf({ subject: "Sea JNPT to Jebel Ali 2x20", text: "JNPT - AEJEA, 2x20", refs: [] }) };
const ORIG = T.cardId("pricing", "<orig@airmar>");
const db0 = { inbox_enquiries: { [ORIG]: enquiry, [T.cardId("pricing", "<other@x>")]: otherEnquiry }, inbox_sent: {} };

(async () => {
  // 1. The forward the desk sent from Outlook: subject changed, no reply headers, but the original is quoted underneath.
  const fwd = { ...T.signalsOf({ subject: "AMD - LRD//463Kg", text: "Pls quote\n\nFrom: Briseyda Cruz\nSubject: Cotización aérea ticket #109196\nYour urgent support is needed", threadIndex: "", refs: [] }), at: NOW - 1.8 * 3_600_000 };
  fwd.quoted = "Pls quote From: Briseyda Cruz Subject: Cotización aérea ticket #109196";
  const r1 = await T.findThread(fakeDb(db0), "pricing", "sent", fwd, NOW);
  assert.deepEqual({ root: r1.root, by: r1.by }, { root: ORIG, by: "quoted" });

  // 2. Same forward without the original underneath: only the airports and the weight tie it. Destination + weight + same hours = enough.
  const bare = { ...T.signalsOf({ subject: "AMD - LRD//463Kg", text: "", refs: [] }), at: NOW - 1.8 * 3_600_000, quoted: "" };
  const r2 = await T.findThread(fakeDb(db0), "pricing", "sent", bare, NOW);
  assert.equal(r2 && r2.root, ORIG);
  assert.equal(r2.by, "lane");

  // 3. A forward about something else is NOT tied (no shared airport, weight or ticket).
  const unrelated = { ...T.signalsOf({ subject: "Meeting tomorrow", text: "lunch?", refs: [] }), at: NOW - 1 * 3_600_000, quoted: "" };
  assert.equal(await T.findThread(fakeDb(db0), "pricing", "sent", unrelated, NOW), null);

  // 4. Sent BEFORE the enquiry arrived: never tied.
  const early = { ...bare, at: NOW - 5 * 3_600_000 };
  assert.equal(await T.findThread(fakeDb(db0), "pricing", "sent", early, NOW), null);

  // 5. Two enquiries that fit equally: the closest is linked and flagged.
  const twin = { ...enquiry, messageId: "<twin@x>", timestamp: NOW - 1.9 * 3_600_000, receivedAt: hours(1.9) };
  const dbTwin = { ...db0, inbox_enquiries: { ...db0.inbox_enquiries, [T.cardId("pricing", "<twin@x>")]: twin } };
  // The twin arrived a little before the original: both fit, so the closest one is taken and a person is asked to check.
  const r5 = await T.findThread(fakeDb(dbTwin), "pricing", "sent", bare, NOW);
  assert.equal(r5.check, true, "ambiguous: linked to the closest, flagged for a check");
  assert.equal(r5.root, T.cardId("pricing", "<twin@x>"), "the enquiry that arrived most recently before the mail");
  assert.equal(r2.check, false, "a single fit is not flagged");

  // 6. The vendor's reply: its References name the mail we sent, which is already tied -> same conversation.
  const SENT = T.cardId("pricing", "<sent1@atlas>");
  const db1 = { ...db0, inbox_sent: { [SENT]: { mailbox: "pricing", threadId: ORIG, subjectKey: "amd - lrd//463kg", at: NOW - 1.8 * 3_600_000, to: [{ email: "prashant@alg.in" }], convRoot: "" } } };
  const reply = { ...T.signalsOf({ subject: "RE: AMD - LRD//463Kg", text: "+500kg=730 allin NH", refs: ["<sent1@atlas>"] }), at: NOW - 1.5 * 3_600_000, tag: "follow_up", fromAddr: "prashant@alg.in" };
  assert.deepEqual(await T.findThread(fakeDb(db1), "pricing", "card", reply, NOW), { root: ORIG, by: "headers" });

  // 7. The reply came without headers (a new mail with "RE:" typed in): same subject, from a vendor we sent it to.
  const bareReply = { ...reply, refs: [] };
  assert.deepEqual(await T.findThread(fakeDb(db1), "pricing", "card", bareReply, NOW), { root: ORIG, by: "subject" });
  // ...from someone we did not send it to (a vendor's colleague answering), it can still be tied by its content, as "lane", never as "subject".
  assert.equal((await T.findThread(fakeDb(db1), "pricing", "card", { ...bareReply, fromAddr: "colleague@alg.in" }, NOW))?.by, "lane");
  // ...and a stranger whose mail shares nothing with the enquiry is not tied.
  assert.equal(await T.findThread(fakeDb(db1), "pricing", "card", { ...T.signalsOf({ subject: "RE: AMD - LRD//463Kg", text: "thanks", refs: [] }), codes: [], nums: [], tokens: [], at: NOW - 1.5 * 3_600_000, tag: "follow_up", fromAddr: "stranger@x.com" }, NOW), null);

  // 8. Outlook's conversation mark ties a forward whose subject and text share nothing with the enquiry.
  const dbConv = { ...db0, inbox_enquiries: { ...db0.inbox_enquiries, [ORIG]: { ...enquiry, convRoot: T.convRootOf(a) } } };
  const odd = { ...T.signalsOf({ subject: "Rates please", text: "hello", threadIndex: b, refs: [] }), at: NOW - 1 * 3_600_000, quoted: "" };
  assert.deepEqual(await T.findThread(fakeDb(dbConv), "pricing", "sent", odd, NOW), { root: ORIG, by: "conversation" });

  // 8b. A vendor who answers days later, or a forward sent a day later: still tied (the window is the whole 15 days a conversation is kept).
  const lateFwd = { ...bare, at: NOW + 30 * 3_600_000 };
  assert.equal((await T.findThread(fakeDb(db0), "pricing", "sent", lateFwd, NOW + 30 * 3_600_000))?.root, ORIG, "sent a day and a half after the enquiry");
  const lateReply = { ...reply, at: NOW + 8 * 24 * 3_600_000 };
  assert.deepEqual(await T.findThread(fakeDb(db1), "pricing", "card", lateReply, NOW + 8 * 24 * 3_600_000), { root: ORIG, by: "headers" }, "a reply eight days later");

  // 9. A different mailbox never ties.
  assert.equal(await T.findThread(fakeDb(db0), "pricingsales", "sent", bare, NOW), null);

  console.log("inbox-thread tests passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

// ---- the answer the screen shows ----
{
  const { _test } = require("./thread-api");
  const out = _test.buildThread(
    "root",
    [
      { id: "root", receivedAt: "2026-11-11T05:11:00Z", from: "Briseyda Cruz <bcruz@airmar.com.mx>", subject: "Cotización aérea ticket #109196", attachmentCount: 1 },
      { id: "r1", receivedAt: "2026-11-11T05:28:00Z", from: "Prashant <prashant@alg.in>", subject: "RE: AMD - LRD//463Kg", linkedBy: "headers" },
    ],
    [{ id: "s1", at: Date.parse("2026-11-11T05:23:00Z"), to: [{ email: "prashant@alg.in", name: "Prashant" }, { email: "ops@cargopartners.com", name: "" }], subject: "AMD - LRD//463Kg", linkedBy: "quoted" }],
  );
  assert.deepEqual(out.members.map((m) => m.role), ["enquiry", "sent", "reply"], "oldest first: enquiry, sent on, reply");
  assert.deepEqual(out.vendors.map((v) => [v.email, v.replied]), [["prashant@alg.in", true], ["ops@cargopartners.com", false]]);
  assert.ok(out.vendors[0].askedAt > 0 && out.vendors[0].repliedAt > out.vendors[0].askedAt, "when each was asked and when they replied");
  assert.match(out.members[1].reason, /original enquiry/);
  console.log("thread-api tests passed");
}
