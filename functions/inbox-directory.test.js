const assert = require("assert");
const D = require("./inbox-directory");

assert.strictEqual(D.domainOf("a@mail.emirates.com"), "emirates.com");
assert.strictEqual(D.domainOf("t@example.co.jp"), "example.co.jp");
assert.strictEqual(D.domainOf("x@acme.com"), "acme.com");

// Known airlines and liners are recognised outright.
assert.deepStrictEqual(D.guessType("cargo@etihad.com", "Etihad Cargo").type, "airline");
assert.strictEqual(D.guessType("cargo@etihad.com").carrierCode, "EY");
assert.strictEqual(D.guessType("rates@qrcargo.com").carrierCode, "QR");
assert.strictEqual(D.guessType("a@maersk.com").type, "liner");
assert.strictEqual(D.guessType("a@maersk.com").org, "Maersk");
// Everything else is a guess from the name, or unknown. Never invented.
assert.strictEqual(D.guessType("ops@sunrisecargoservices.com", "Sunrise Cargo Services").type, "airline", "a guess, to be confirmed");
assert.strictEqual(D.guessType("a@blueseaforwarding.com", "Bluesea Forwarding Ltd").type, "overseas-agent");
assert.strictEqual(D.guessType("a@greenwarehousing.in", "Green Warehousing").type, "warehouser");
assert.strictEqual(D.guessType("a@kumartransport.in", "Kumar Transport").type, "transporter");
assert.strictEqual(D.guessType("a@zzzq.com", "Mr Z").type, "unknown");
assert.ok(D.TYPES.includes(D.guessType("a@zzzq.com").type));

assert.strictEqual(D.contactId("A@B.com"), D.contactId("a@b.com"), "the same address is the same contact whatever its case");
assert.notStrictEqual(D.contactId("a@b.com"), D.contactId("c@b.com"));
assert.strictEqual(D.isOwn("shashank@blr.atlaslogistics.co.in"), true);
assert.strictEqual(D.isOwn("x@acme.com"), false);

// Learning, with a tiny fake database.
function fakeDb() {
  const store = new Map();
  return {
    store,
    collection: () => ({
      doc: (id) => ({
        get: async () => ({ exists: store.has(id), data: () => store.get(id) }),
        set: async (v, o) => store.set(id, o && o.merge ? { ...(store.get(id) || {}), ...v } : v),
      }),
    }),
  };
}
(async () => {
  const db = fakeDb();
  const n = await D.learnContacts(db, [
    { email: "Cargo@Etihad.com", name: "Etihad Cargo", mailbox: "pricing" },
    { email: "cargo@etihad.com", mailbox: "pricing" }, // the same address twice in one call
    { email: "shashank@blr.atlaslogistics.co.in" }, // our own colleague: not a contact
    { email: "noreply@x.com" }, // a system sender
    { email: "not-an-address" },
    { email: "a@blueseaforwarding.com", name: "Bluesea Forwarding", mailbox: "pricingsales" },
  ], 1000);
  assert.strictEqual(n, 2);
  assert.strictEqual(db.store.size, 2);
  const et = db.store.get(D.contactId("cargo@etihad.com"));
  assert.deepStrictEqual([et.type, et.carrierCode, et.count, et.typeSource], ["airline", "EY", 1, "rules"]);
  // Seen again: counted, not duplicated; a type the admin set by hand is kept.
  db.store.set(D.contactId("a@blueseaforwarding.com"), { ...db.store.get(D.contactId("a@blueseaforwarding.com")), type: "nvocc", typeSource: "admin" });
  await D.learnContacts(db, [{ email: "a@blueseaforwarding.com", mailbox: "pricing" }], 2000);
  const bs = db.store.get(D.contactId("a@blueseaforwarding.com"));
  assert.deepStrictEqual([bs.type, bs.count, bs.mailboxes.join(), bs.lastSeen], ["nvocc", 2, "pricingsales,pricing", 2000]);
  console.log("inbox-directory tests passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

// More kinds of contact are sorted by their name, and an overseas forwarder is told apart from an Indian one.
{
  const D = require("./inbox-directory");
  assert.equal(D.guessType("ops@gulfpackers.ae", "Gulf Packers and Movers").type, "packer");
  assert.equal(D.guessType("a@skyline-consolidators.com", "Skyline Consol").type, "coloader");
  assert.equal(D.guessType("a@xyz-customs.in", "XYZ Customs Clearing").type, "customs-broker");
  assert.equal(D.guessType("a@fastcourier.in", "Fast Courier").type, "courier");
  assert.equal(D.guessType("a@airmar.com.mx", "Airmar Logistics").type, "overseas-agent");
  assert.equal(D.guessType("a@bluefreight.in", "Blue Freight").type, "forwarder");
  assert.equal(D.guessType("a@somewhere.com", "Aero GSA Services").type, "gsa");
  assert.ok(["gsa", "csa", "coloader", "packer", "customs-broker", "courier", "forwarder"].every((t) => D.TYPES.includes(t)));
  console.log("directory kinds ok");
}
