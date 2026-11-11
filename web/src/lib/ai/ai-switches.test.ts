import assert from "node:assert/strict";
import { AI_GROUPS, aiAllowed, aiOffMessage, aiStatusText, allOn, readSwitches } from "./ai-switches";

// Ten places, each with where/cost/who written out so users know which features use AI.
assert.equal(AI_GROUPS.length, 10);
for (const g of AI_GROUPS) assert.ok(g.name && g.where && g.cost && g.who, `${g.id} is fully described`);

// Missing or odd answers mean ON.
assert.deepEqual(readSwitches(undefined), allOn());
assert.deepEqual(readSwitches({ master: "no", groups: { askVertex: 0 } }), allOn());
const some = readSwitches({ master: true, groups: { askVertex: false, circulars: false } });
assert.equal(aiAllowed(some, "askVertex"), false);
assert.equal(aiAllowed(some, "quoteHub"), true);
assert.equal(aiAllowed(readSwitches({ master: false, groups: {} }), "quoteHub"), false, "master beats single switches");
assert.equal(aiAllowed(null, "quoteHub"), true);

assert.equal(aiStatusText(allOn()).tone, "on");
assert.equal(aiStatusText(some).label, "AI on · 2 off");
assert.match(aiStatusText(some).detail, /Ask Vertex/);
assert.equal(aiStatusText(readSwitches({ master: false })).label, "AI off");

assert.match(aiOffMessage(readSwitches({ master: false }), "quoteHub"), /switched off by your admin/);
assert.match(aiOffMessage(some, "askVertex"), /Ask Vertex/);

console.log("ai-switches tests passed");
