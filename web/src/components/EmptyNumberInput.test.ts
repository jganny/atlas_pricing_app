import assert from "node:assert/strict";
import { emptyNumberDisplay, isNumberDraft } from "./EmptyNumberInput";

// Typing 7.5 one key at a time: the dot must survive the trip through the number.
const typed = ["7", "7.", "7.5"];
let value = 0;
let draft: string | null = null;
for (const raw of typed) {
  assert.equal(isNumberDraft(raw), true);
  draft = raw;
  value = Number(raw);
  assert.equal(emptyNumberDisplay(draft, value), raw); // what the box shows while typing
}
assert.equal(value, 7.5);

// Other in-progress decimals.
assert.equal(emptyNumberDisplay("0.", 0), "0.");          // on the way to 0.05 the box keeps what was typed
assert.equal(emptyNumberDisplay("0.0", 0), "0.0");
assert.equal(emptyNumberDisplay("0.05", 0.05), "0.05");
assert.equal(emptyNumberDisplay("12.50", 12.5), "12.50"); // trailing zero kept while typing
assert.equal(emptyNumberDisplay(".5", 0.5), ".5");

// Once the typed text no longer matches the number (value changed from outside), the number wins.
assert.equal(emptyNumberDisplay("7.", 3), "3");
assert.equal(emptyNumberDisplay(null, 0), "");   // blank at 0
assert.equal(emptyNumberDisplay(null, 18), "18");

// Rejected input.
for (const bad of ["abc", "1.2.3", "1,5", "--2", "5e3"]) assert.equal(isNumberDraft(bad), false);
for (const ok of ["", "-", "-1", "10", "0.5", ".5", "7."]) assert.equal(isNumberDraft(ok), true);

console.log("EmptyNumberInput.test.ts: all assertions passed");
