import assert from "node:assert/strict";
import { deskHrefForLead, isFollowUpDue, splitLane } from "./quote-from-lead";

assert.deepEqual(splitLane("LHR → BLR"), { origin: "LHR", dest: "BLR" });
assert.deepEqual(splitLane("INNSA -> NLRTM"), { origin: "INNSA", dest: "NLRTM" });

const href = deskHrefForLead({
  id: "l1",
  company: "Akshara teck",
  status: "quoted",
  mode: "air",
  lane: "LHR → BLR",
});
assert.match(href, /\/air\//);
assert.match(href, /customer=Akshara/);
assert.match(href, /origin=LHR/);
assert.match(href, /dest=BLR/);

assert.equal(
  isFollowUpDue({ id: "a", company: "X", status: "new", nextDueDate: "2026-09-01" }, "2026-09-10"),
  true,
);
assert.equal(
  isFollowUpDue({ id: "a", company: "X", status: "won", nextDueDate: "2026-09-01" }, "2026-09-10"),
  false,
);

console.log("quote-from-lead tests passed");
