import assert from "node:assert/strict";
import {
  GROUP_ORDER,
  SECTIONS,
  canSee,
  groupSections,
  hashFor,
  parseRecent,
  pushRecent,
  searchSections,
  sectionFromHash,
  visibleSections,
} from "./sections";

const ganny = { isAdmin: true, isGanny: true, live: true };
const manager = { isAdmin: true, isGanny: false, live: true };
const demoGanny = { isAdmin: true, isGanny: true, live: false };
const nobody = { isAdmin: false, isGanny: false, live: true };

// every section has a unique link, a known group, and a blurb
assert.equal(new Set(SECTIONS.map((s) => s.id)).size, SECTIONS.length);
for (const s of SECTIONS) {
  assert.ok((GROUP_ORDER as readonly string[]).includes(s.group), `${s.id}: unknown group ${s.group}`);
  assert.ok(s.blurb.length > 10 && /^[a-z0-9-]+$/.test(s.id), s.id);
  assert.equal(s.keywords, s.keywords.toLowerCase(), `${s.id}: keywords must be lower case`);
}

// who sees what: exactly what the old Admin page did
assert.equal(visibleSections(nobody).length, 0);
const idsFor = (ctx: typeof ganny) => visibleSections(ctx).map((s) => s.id);
assert.equal(visibleSections(ganny).length, SECTIONS.length - 0, "the main administrator sees every section in the live app");
assert.ok(!idsFor(manager).includes("ai-credit-and-cost"), "AI balance is the main administrator's");
assert.ok(!idsFor(manager).includes("chat-only-staff"));
assert.ok(!idsFor(manager).includes("team-chat-review"));
assert.ok(!idsFor(manager).includes("sign-ins-activity"));
assert.ok(!idsFor(manager).includes("test-sending-email"));
assert.ok(idsFor(manager).includes("error-monitor") && idsFor(manager).includes("desk-seats"));
// in the demo, the AI balance and chat-only staff need the real database, but chat review is shown
assert.ok(!idsFor(demoGanny).includes("ai-credit-and-cost") && !idsFor(demoGanny).includes("chat-only-staff"));
assert.ok(idsFor(demoGanny).includes("team-chat-review"));
assert.ok(canSee("ganny-or-demo", { isAdmin: true, isGanny: false, live: false }), "chat review shows for any admin in the demo");

// order: by group, then as listed
const order = visibleSections(ganny).map((s) => s.group);
assert.deepEqual(order, [...order].sort((a, b) => (GROUP_ORDER as readonly string[]).indexOf(a) - (GROUP_ORDER as readonly string[]).indexOf(b)));
assert.deepEqual(groupSections(visibleSections(ganny)).map((g) => g.group), [...GROUP_ORDER]);

// search: plain words find the right section, best match first
const all = visibleSections(ganny);
const first = (q: string) => searchSections(q, all)[0]?.id;
assert.equal(first("password"), "password-reset-queue");
assert.equal(first("forgot"), "password-reset-queue");
assert.equal(first("holiday"), "branch-holiday-calendar");
assert.equal(first("money"), "ai-credit-and-cost");
assert.equal(first("AI"), "ai-credit-and-cost");
assert.equal(first("email"), "test-sending-email");
assert.equal(first("  Desk  "), "desk-seats");
assert.equal(first("crash"), "error-monitor");
assert.equal(first("who changed"), "audit-trail");
// every word typed must match, so more words narrow the list
assert.ok(searchSections("reset password", all).length <= searchSections("reset", all).length);
assert.equal(first("reset password"), "password-reset-queue");
assert.equal(searchSections("zzzz", all).length, 0);
assert.equal(searchSections("", all).length, 0);
assert.equal(searchSections("   ", all).length, 0);
// a title match beats a keyword match
assert.equal(first("audit"), "audit-trail");
// hidden sections are never found
assert.ok(!searchSections("balance", visibleSections(manager)).some((s) => s.id === "ai-credit-and-cost"));

// links
assert.equal(hashFor("desk-seats"), "#desk-seats");
assert.equal(sectionFromHash("#error-monitor", all), "error-monitor");
assert.equal(sectionFromHash("error-monitor", all), "error-monitor");
assert.equal(sectionFromHash("#nope", all), null);
assert.equal(sectionFromHash("", all), null);
assert.equal(sectionFromHash("#ai-credit-and-cost", visibleSections(manager)), null, "a hidden section's link falls back");

// recent: newest first, no repeats, capped, never a hidden or removed id
assert.deepEqual(pushRecent(["a", "b", "c"], "b"), ["b", "a", "c"]);
assert.deepEqual(pushRecent([], "x"), ["x"]);
assert.equal(pushRecent(["1", "2", "3", "4", "5", "6"], "7").length, 6);
assert.deepEqual(parseRecent(JSON.stringify(["error-monitor", "gone", "ai-credit-and-cost"]), visibleSections(manager)), ["error-monitor"]);
assert.deepEqual(parseRecent("not json", all), []);
assert.deepEqual(parseRecent(null, all), []);
assert.deepEqual(parseRecent('{"a":1}', all), []);

console.log("admin sections tests passed");
