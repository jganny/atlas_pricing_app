import assert from "node:assert/strict";
import { deskHrefForLead, deskHrefsForLead, effectiveLeadModes, isFollowUpDue, splitLane } from "./quote-from-lead";

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

// Multi-mode leads
assert.deepEqual(effectiveLeadModes({ mode: "air", modes: undefined }), ["air"], "legacy single-mode lead falls back cleanly");
assert.deepEqual(effectiveLeadModes({ mode: undefined, modes: [] }), [], "no mode at all is a valid, empty result");
assert.deepEqual(effectiveLeadModes({ mode: "air", modes: ["air", "sea"] }), ["air", "sea"], "modes wins over the old single mode field");

const multi = deskHrefsForLead({
  id: "l2",
  company: "Akshara teck",
  status: "quoted",
  modes: ["air", "sea"],
});
assert.equal(multi.length, 2, "one link per mode on a multi-mode lead");
assert.match(multi[0].href, /\/air\//);
assert.match(multi[1].href, /\/sea\//);

const single = deskHrefsForLead({ id: "l3", company: "X", status: "new", modes: ["courier"] });
assert.equal(single.length, 1);
assert.match(single[0].href, /\/courier\//);

console.log("quote-from-lead tests passed");
