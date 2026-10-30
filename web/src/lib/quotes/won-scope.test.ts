import assert from "node:assert/strict";
import { pendingByOwner, wonRowsForViewer, type WonScopedRow } from "./won-scope";

const blank = { shipperName: "", consigneeName: "", commodity: "", buyRate: 0, sellAmount: 0 };
const row = (quoteId: string, extra: Partial<WonScopedRow> = {}): WonScopedRow => ({ quoteId, wonAt: new Date().toISOString(), ...blank, ...extra });

// shashank holds the Air Nom desk, kavya holds Free Hand (see desk-seats defaults)
const stamped = row("q1", { ownerSeat: "air-nom" });
const viaQuote = row("q2");
const lastResort = row("q3", { updatedBy: "kavya" });
const quotes: Record<string, { deskSeat?: string; creator?: string }> = { q2: { deskSeat: "freehand", creator: "kavya" } };
const rows = [stamped, viaQuote, lastResort];
const quoteOf = (id: string) => quotes[id];

assert.deepEqual(wonRowsForViewer(rows, "shashank", false, quoteOf).map((r) => r.quoteId), ["q1"], "a desk sees only its own");
assert.deepEqual(wonRowsForViewer(rows, "kavya", false, quoteOf).map((r) => r.quoteId).sort(), ["q2", "q3"], "older rows follow the quote, then whoever pressed Won");
assert.equal(wonRowsForViewer(rows, "someone-else", false, quoteOf).length, 0);
assert.equal(wonRowsForViewer(rows, "admin", true, quoteOf).length, 3, "admin sees everything");

const by = pendingByOwner(rows, quoteOf);
assert.equal(by.reduce((n, o) => n + o.pending, 0), 3);
assert.equal(by.length, 2, "two desks have work waiting");
assert.equal(pendingByOwner([row("q9", { ...{}, shipperName: "a", consigneeName: "b", commodity: "c", buyRate: 1, sellAmount: 2 })], quoteOf).length, 0, "complete rows are not pending");
console.log("won-scope tests passed");
