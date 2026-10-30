import assert from "node:assert/strict";
import { formatValidity, validityStatus } from "./validity";

const now = new Date(2026, 9, 30); // 30 Oct 2026
assert.equal(formatValidity("2026-11-14"), "14 Nov 2026");
assert.equal(formatValidity("subject to space"), "subject to space", "free text is left alone");
assert.equal(formatValidity(""), "");
assert.equal(formatValidity(undefined), "");
// Nothing is filled in on the desk's behalf
assert.equal(validityStatus("", now), "none");
assert.equal(validityStatus("   ", now), "none");
// Status for the hint
assert.equal(validityStatus("2026-10-29", now), "expired");
assert.equal(validityStatus("2026-10-30", now), "soon");
assert.equal(validityStatus("2026-11-02", now), "soon");
assert.equal(validityStatus("2026-11-14", now), "ok");
assert.equal(validityStatus("15 days", now), "text");
console.log("validity tests passed");
