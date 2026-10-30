import assert from "node:assert/strict";
import { defaultValidity, formatValidity, validityOnDuplicate, validityStatus } from "./validity";

const now = new Date(2026, 9, 30); // 30 Oct 2026
assert.equal(defaultValidity(now), "2026-11-14", "a new quote is valid for 15 days from today");
assert.equal(formatValidity("2026-11-14"), "14 Nov 2026");
assert.equal(formatValidity("15 days"), "15 days", "free text is left alone");
assert.equal(formatValidity(""), "");
// A duplicate keeps the same length, counted from today
assert.equal(validityOnDuplicate("2026-06-25", "2026-06-10", now), "2026-11-14", "15 days stays 15 days");
assert.equal(validityOnDuplicate("2026-07-10", "2026-06-10", now), "2026-11-29", "a 30-day validity stays 30 days");
assert.equal(validityOnDuplicate("2026-06-25", undefined, now), "2026-11-14", "unknown original date falls back to 15 days");
assert.equal(validityOnDuplicate("15 days", "2026-06-10", now), "15 days");
assert.equal(validityOnDuplicate("", "2026-06-10", now), "");
// Status for the hint
assert.equal(validityStatus("2026-10-29", now), "expired");
assert.equal(validityStatus("2026-10-30", now), "soon");
assert.equal(validityStatus("2026-11-02", now), "soon");
assert.equal(validityStatus("2026-11-14", now), "ok");
assert.equal(validityStatus("15 days", now), "text");
console.log("validity tests passed");
