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

console.log("inbox-alerts tests passed");
