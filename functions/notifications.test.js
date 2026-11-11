const assert = require("node:assert/strict");
const NT = require("./notifications");
const { teamFor, loginOf } = NT._test;

// Who is in the bell of a mailbox: the two desks, plus NRS and Free Hand for sea enquiries on pricing@ while Sea Nom is vacant.
assert.deepEqual(teamFor("pricing", "air"), ["shashank", "shaheer"]);
assert.deepEqual(teamFor("pricing", "sea").sort(), ["cathrina", "jabeena", "shaheer", "shashank"]);
assert.deepEqual(teamFor("pricingsales", "sea"), ["cathrina", "jabeena"]);
assert.equal(loginOf({ auth: { token: { email: "Ganny@atlaspricing.com" } } }), "ganny");

// A card is a title and one line: writing never throws, and one card per person.
(async () => {
  const written = [];
  const db = { batch: () => ({ set: (ref, card) => written.push(card), commit: async () => undefined }), collection: () => ({ doc: () => ({}) }) };
  await NT.notifyLogins(db, ["shashank", "shashank", "shaheer", ""], { kind: "arrived", level: "need", title: "New enquiry", body: "x".repeat(500), itemId: "abc" });
  assert.deepEqual(written.map((c) => c.login), ["shashank", "shaheer"]);
  assert.equal(written[0].body.length, 200, "one short line, never the email");
  assert.equal(written[0].read, false);
  await NT.notifyLogins({ batch: () => { throw new Error("db down"); } }, ["a"], { title: "t" }); // must not throw
  console.log("notifications tests passed");
})();
