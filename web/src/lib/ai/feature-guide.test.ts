import assert from "node:assert/strict";
import { GUIDE, searchGuide, tipsForPath } from "./feature-guide";

const top = (q: string, path = "") => searchGuide(q, path)[0]?.entry.id;

assert.equal(top("how do I get an airline wise report"), "edb-report-builder");
assert.equal(top("tonnage wise report"), "edb-report-builder");
assert.equal(top("export coloader report csv"), "edb-report-builder");
assert.equal(top("why did we lose this lead"), "sales-loss");
assert.equal(top("what is lead score"), "sales-forecast");
assert.equal(top("weighted forecast"), "sales-forecast");
assert.equal(top("win rate"), "sales-analytics");
assert.equal(top("whatsapp not sending pdf"), "share-whatsapp");
assert.equal(top("charges filled automatically"), "autofill-history");
assert.equal(top("what does lowest mean"), "multi-lane");
assert.equal(top("refresh banner"), "refresh-banner");
assert.equal(top("how do I replace the free hand user with a new person"), "desk-seats");
assert.equal(top("how do I set a quarterly quota for a rep"), "sales-targets");
assert.equal(top("why is this lead view only"), "sales-permissions");
assert.equal(top("which customers are due for renewal"), "sales-renewals");
assert.equal(top("customers who have gone quiet"), "sales-renewals");
assert.deepEqual(searchGuide("   "), []);
assert.deepEqual(searchGuide("zzzz qqqq"), []);

// page-aware tips
assert.ok(tipsForPath("/sales/").every((e) => e.path === "/sales"));
assert.ok(tipsForPath("/enquiries").some((e) => e.id === "edb-report-builder"));
assert.ok(tipsForPath("/sea/").some((e) => e.id === "autofill-history")); // sea shares the air desk tips
assert.ok(tipsForPath("/unknown").length > 0);

// every entry is complete and unique
assert.equal(new Set(GUIDE.map((g) => g.id)).size, GUIDE.length);
for (const g of GUIDE) assert.ok(g.title && g.where && g.summary && g.steps.length && g.keywords.length, g.id);

console.log("feature-guide.test.ts: all assertions passed");
