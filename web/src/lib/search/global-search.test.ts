import assert from "node:assert/strict";
import { LIMITS, buildGroups, customerHits, flatten, moveActive, quoteRow } from "./global-search";
import { parseDeskIntent } from "@/lib/ai/desk-intent";
import { visibleSections } from "@/lib/admin/sections";
import type { EnquiryRecord } from "@/lib/types";

const row = (o: Partial<EnquiryRecord> & { id: string }): EnquiryRecord =>
  ({ ref: `REF${o.id}`, customer: "", origin: "BLR", destination: "DXB", carrier: "", status: "quoted", mode: "air", createdAt: "2026-11-01T00:00:00Z", ...o }) as EnquiryRecord;

const rows = [
  row({ id: "1", customer: "Pearl Cargo Ltd", carrier: "EK" }),
  row({ id: "2", customer: "pearl cargo ltd " }),
  row({ id: "3", customer: "Pearl Cargo Ltd" }),
  row({ id: "4", customer: "Gulf Freight Co" }),
  row({ id: "5", customer: "Pearson Exports" }),
  row({ id: "6", customer: "" }),
];
const none = new Set<string>();
const admin = visibleSections({ isAdmin: true, isGanny: true, live: true });

// a quote row reads as customer, then ref · lane · carrier, with the status on the right
const q1 = quoteRow(rows[0]);
assert.deepEqual([q1.title, q1.sub, q1.meta], ["Pearl Cargo Ltd", "REF1 · BLR→DXB · EK", "quoted"]);
assert.equal(q1.href, "/enquiries/?q=REF1&select=1");
assert.equal(quoteRow(rows[5]).title, "REF6", "no customer: the ref is the title");

// customers: every word must match, spelling case and spacing are merged, busiest first
assert.deepEqual(customerHits(rows, "pearl"), [{ name: "Pearl Cargo Ltd", count: 3 }]);
assert.deepEqual(customerHits(rows, "pear").map((c) => c.name), ["Pearl Cargo Ltd", "Pearson Exports"]);
assert.deepEqual(customerHits(rows, "cargo pearl").map((c) => c.name), ["Pearl Cargo Ltd"]);
assert.deepEqual(customerHits(rows, "x"), []);
assert.deepEqual(customerHits(rows, ""), []);
assert.equal(customerHits(rows, "pearl")[0].count, 3);
assert.equal(customerHits(rows, "a", 1).length, 0, "one-letter words are ignored");

const base = { older: [], hiddenIds: none, allRows: rows, sections: [] };

// nothing is shown for fewer than two letters
assert.deepEqual(buildGroups({ ...base, query: "p", intent: parseDeskIntent("p"), quotes: rows }), []);
assert.deepEqual(buildGroups({ ...base, query: "  ", intent: parseDeskIntent("  "), quotes: rows }), []);

// a plain word: quotes, then customers; no start row, no settings for people who may not see them
const g = buildGroups({ ...base, query: "pearl", intent: parseDeskIntent("pearl"), quotes: rows.slice(0, 3) });
assert.deepEqual(g.map((x) => x.label), ["Quotes", "Customers"]);
assert.equal(g[0].items.length, 3);
assert.equal(g[1].items[0].href, "/enquiries/?q=Pearl%20Cargo%20Ltd");
assert.equal(g[1].items[0].sub, "3 quotes");

// older quotes follow the ones on screen, never repeat, and the group is capped
const many = Array.from({ length: 9 }, (_, i) => row({ id: `m${i}`, customer: `Zed ${i}` }));
const capped = buildGroups({ ...base, query: "zed", intent: parseDeskIntent("zed"), quotes: many.slice(0, 3), older: [many[0], ...many.slice(3)] });
assert.equal(capped[0].items.length, LIMITS.quotes);
assert.deepEqual(capped[0].items.map((i) => i.key), ["q-m0", "q-m1", "q-m2", "q-m3", "q-m4"]);

// quotes the person hid from search stay hidden
const hid = buildGroups({ ...base, query: "pearl", intent: parseDeskIntent("pearl"), quotes: rows.slice(0, 3), hiddenIds: new Set(["1", "2"]) });
assert.deepEqual(hid[0].items.map((i) => i.key), ["q-3"]);

// administrators also get settings, in plain words
const s = buildGroups({ ...base, query: "password", intent: parseDeskIntent("password"), quotes: [], sections: admin });
assert.deepEqual(s.map((x) => x.label), ["Settings"]);
assert.equal(s[0].items[0].href, "/admin/?section=password-reset-queue");
assert.equal(s[0].items[0].sub, "Admin · People and access");
assert.ok(s[0].items.length <= LIMITS.settings);
assert.deepEqual(buildGroups({ ...base, query: "password", intent: parseDeskIntent("password"), quotes: [], sections: [] }), [], "no settings for non-admins");

// a page named in plain words
const go = buildGroups({ ...base, query: "inbox", intent: parseDeskIntent("inbox"), quotes: [] });
assert.deepEqual(go.map((x) => x.label), ["Go to"]);
assert.equal(go[0].items[0].href, "/inbox");
assert.equal(go[0].items[0].sub, "Opens that page");

// a quote request: the last row starts a quote, and no quote list is shown for it
const n = buildGroups({ ...base, query: "quote air BLR to DXB 120 kg", intent: parseDeskIntent("quote air BLR to DXB 120 kg"), quotes: rows });
assert.deepEqual(n.map((x) => x.label), ["Quote"]);
assert.deepEqual([n[0].items[0].kind, n[0].items[0].title, n[0].items[0].sub, n[0].items[0].href], ["start", "Start a quote from this", "Air desk BLR to DXB", "/air"]);
const seaStart = buildGroups({ ...base, query: "quote sea INMAA to AEJEA", intent: parseDeskIntent("quote sea INMAA to AEJEA"), quotes: [] });
assert.equal(seaStart[0].items[0].href, "/sea");

// the flat list keeps the order on screen, so arrow keys and Enter match what is shown
assert.deepEqual(flatten(g).map((i) => i.key), [...g[0].items, ...g[1].items].map((i) => i.key));

// arrow keys wrap, and start sensibly from nothing highlighted
assert.equal(moveActive(-1, 1, 4), 0);
assert.equal(moveActive(-1, -1, 4), 3);
assert.equal(moveActive(3, 1, 4), 0);
assert.equal(moveActive(0, -1, 4), 3);
assert.equal(moveActive(1, 1, 4), 2);
assert.equal(moveActive(0, 1, 0), -1);

console.log("global search tests passed");
