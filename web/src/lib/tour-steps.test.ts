import assert from "node:assert/strict";
import { clockLabel, TOUR_STEPS, tourSeconds } from "./tour-steps";

assert.equal(TOUR_STEPS.length, 6);
assert.equal(new Set(TOUR_STEPS.map((s) => s.id)).size, 6, "unique ids");
for (const s of TOUR_STEPS) {
  assert.ok(s.title.trim() && s.caption.trim(), `${s.id} has words`);
  assert.ok(s.caption.length <= 260, `${s.id} caption is short enough to read in one go`);
  assert.equal(s.blocks.length, 3, `${s.id} shows three parts of the screen`);
  assert.ok(s.focus >= 0 && s.focus < s.blocks.length, `${s.id} lights up a real part`);
  assert.ok(s.seconds >= 15 && s.seconds <= 40, `${s.id} runs 15 to 40 seconds`);
}
assert.equal(tourSeconds(), 160);
assert.equal(clockLabel(160), "2:40");
assert.equal(clockLabel(25), "0:25");
// The tour must not promise things the app does not do
const text = TOUR_STEPS.map((s) => s.caption).join(" ");
assert.doesNotMatch(text, /15 days/, "validity is set per carrier, never a fixed period");
console.log("tour tests passed");
