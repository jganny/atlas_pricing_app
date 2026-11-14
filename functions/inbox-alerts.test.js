const assert = require("assert");
const { planAlerts, DEFAULTS } = require("./inbox-alerts")._test;

const NOW = Date.UTC(2026, 10, 11, 8, 35);
const ago = (min) => new Date(NOW - min * 60_000).toISOString();
const item = (id, over) => ({ id, mailbox: "pricing", status: "new", actionRequired: true, tag: "new_enquiry", from: "Takeshi <t@x.jp>", subject: "Air BOM to NRT", receivedAt: ago(1), ...over });

// Just arrived: the two who share pricing@ are told. Once.
let p = planAlerts([item("a")], DEFAULTS, NOW);
assert.deepStrictEqual(p.map((x) => [x.id, x.kind, x.recipients.join()]), [["a", "arrived", "shashank,shaheer"]]);
assert.deepStrictEqual(planAlerts([item("a", { notifiedAt: 1 })], DEFAULTS, NOW), [], "already told");

// 20 minutes with nobody on it: remind both. Not twice.
p = planAlerts([item("b", { receivedAt: ago(21), notifiedAt: 1 })], DEFAULTS, NOW);
assert.deepStrictEqual(p.map((x) => x.kind), ["remind"]);
assert.deepStrictEqual(planAlerts([item("b", { receivedAt: ago(21), notifiedAt: 1, remindedAt: 2 })], DEFAULTS, NOW), []);

// 60 minutes: the manager.
p = planAlerts([item("c", { receivedAt: ago(61), notifiedAt: 1, remindedAt: 2 })], DEFAULTS, NOW);
assert.deepStrictEqual(p.map((x) => [x.kind, x.recipients.join()]), [["manager", "ganny,manager"]]);
assert.deepStrictEqual(planAlerts([item("c", { receivedAt: ago(61), managerAt: 3 })], DEFAULTS, NOW), [], "the manager is told once");
// Something that slept past 20 minutes without ever being alerted goes straight to the right step, never a stale "arrived".
assert.strictEqual(planAlerts([item("d", { receivedAt: ago(30) })], DEFAULTS, NOW)[0].kind, "remind");

// Nobody is alerted about an enquiry someone is already on, has replied to, or that is not a real enquiry.
for (const over of [{ workingBy: { username: "shaheer", name: "S", at: 1 } }, { repliedAt: 5 }, { status: "applied" }, { actionRequired: false }, { tag: "follow_up" }]) {
  assert.deepStrictEqual(planAlerts([item("e", { receivedAt: ago(30), ...over })], DEFAULTS, NOW), [], JSON.stringify(over));
}

// A backlog is never alerted: nothing older than a day.
assert.deepStrictEqual(planAlerts([item("old", { receivedAt: ago(26 * 60) })], DEFAULTS, NOW), []);

// The other mailbox has its own team.
p = planAlerts([item("f", { mailbox: "pricingsales" })], DEFAULTS, NOW);
assert.strictEqual(p[0].recipients.join(), "cathrina,jabeena");
// The admin can change the times and the people.
p = planAlerts([item("g", { receivedAt: ago(11), notifiedAt: 1 })], { remindAfterMin: 10, teams: { pricing: ["x"] } }, NOW);
assert.deepStrictEqual([p[0].kind, p[0].recipients.join()], ["remind", "x"]);

// Internal Atlas quote-share must not alert as a pending enquiry.
assert.deepStrictEqual(
  planAlerts(
    [
      item("atlas", {
        from: "Atlaslogistics <pricing@atlaslogistics.co.in>",
        subject: "Air Freight // BLR to Qatar // 560 Kgs",
        bodyPreview: "Dear Awwab Pls find below quote for said shipment",
      }),
    ],
    DEFAULTS,
    NOW,
  ),
  [],
  "internal quote-share is not pending",
);

console.log("inbox-alerts tests passed");

// While the Sea Nom seat is vacant, a sea enquiry on pricing@ also alerts NRS and Free Hand; an air one does not.
{
  const A = require("./inbox-alerts")._test;
  const now = Date.parse("2026-11-11T06:00:00Z");
  const sea = { id: "s", status: "new", tag: "new_enquiry", mailbox: "pricing", mode: "sea", receivedAt: new Date(now - 60_000).toISOString(), from: "O <o@x.ae>", subject: "Sea" };
  const air = { ...sea, id: "a", mode: "air" };
  const planSea = A.planAlerts([sea], undefined, now);
  const planAir = A.planAlerts([air], undefined, now);
  assert.ok(["jabeena", "cathrina", "shashank"].every((l) => planSea[0].recipients.includes(l)), "sea cover: Jabeena and Cathrina are told");
  assert.ok(!planAir[0].recipients.includes("jabeena"), "air enquiries stay with the Air Nom team");
  assert.deepEqual(A.planAlerts([sea], { seaCover: [] }, now)[0].recipients.sort(), ["shaheer", "shashank"], "cover can be switched off");
  console.log("sea cover ok");
}

// The Manager's end-of-day line.
{
  const { daySummary } = require("./inbox-alerts")._test;
  const now = Date.parse("2026-11-11T13:00:00Z");
  const mk = (over) => ({ status: "new", tag: "new_enquiry", from: "Omar K <o@x.ae>", receivedAt: new Date(now - 3600_000).toISOString(), ...over });
  const s1 = daySummary([mk({}), mk({ from: "Briseyda Cruz <b@x.mx>" }), mk({ workingBy: { username: "x" } }), mk({ repliedAt: now }), mk({ tag: "follow_up" }), mk({ receivedAt: new Date(now - 3 * 86400000).toISOString() })], 31, now);
  assert.equal(s1.title, "Today: 31 enquiries in");
  assert.equal(s1.waiting, 2);
  assert.match(s1.body, /^2 still waiting: Omar K, Briseyda Cruz\.$/);
  assert.match(daySummary([], 1, now).title, /1 enquiry in/);
  assert.equal(daySummary([], 31, now, 24).title, "Today: 31 enquiries in, 24 answered");
  assert.match(daySummary([], 0, now).body, /Nothing is waiting/);
  console.log("day summary ok");
}
