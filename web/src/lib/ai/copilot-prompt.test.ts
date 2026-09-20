import assert from "node:assert/strict";
import { COPILOT_MAX_MESSAGE, buildCopilotMessage } from "./copilot-prompt";
import { GUIDE, searchGuide } from "./feature-guide";

const hits = searchGuide("how do I export a tonnage report", "/enquiries").map((h) => h.entry);
const msg = buildCopilotMessage("how do I export a tonnage report", hits, "/enquiries");
assert.ok(msg.includes("QUESTION: how do I export a tonnage report"));
assert.ok(msg.includes("Current screen: /enquiries"));
assert.ok(msg.includes("Report builder"));
assert.ok(msg.includes("Answer ONLY from the APP GUIDE"));
assert.ok(msg.length <= COPILOT_MAX_MESSAGE);

// oversized input is bounded on both sides
const long = buildCopilotMessage("x".repeat(5000), GUIDE, "/sales");
assert.ok(long.length <= COPILOT_MAX_MESSAGE);
assert.ok(long.includes("QUESTION: " + "x".repeat(500) + "\n"));
assert.ok(!long.includes("x".repeat(501)));

// no matching entries is stated explicitly, not silently empty
assert.ok(buildCopilotMessage("zzz", [], "/").includes("(no matching guide entries)"));

// nothing but guide text is included: no dynamic business data can leak in
for (const bad of ["dealValue", "grandTotal", "contactName", "@atlaspricing.com"]) assert.ok(!long.includes(bad), bad);

console.log("copilot-prompt.test.ts: all assertions passed");
