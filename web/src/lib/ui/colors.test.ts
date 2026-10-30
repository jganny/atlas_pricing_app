import assert from "node:assert/strict";
import { chipStyle, modeColor, statusColor, tint } from "./colors";

assert.equal(tint("#378ADD", 0.16), "rgba(55,138,221,0.16)");
assert.equal(modeColor("air"), "#378ADD");
assert.equal(modeColor("SEA"), "#1D9E75", "case does not matter");
assert.equal(modeColor("something else"), "#888780", "unknown kinds stay neutral grey");
assert.equal(modeColor(undefined), "#888780");
assert.equal(statusColor("won"), "#34A853");
assert.equal(statusColor("quoted"), "#EF9F27");
assert.equal(statusColor("lost"), "#E24B4A");
assert.deepEqual(chipStyle("#34A853"), { backgroundColor: "rgba(52,168,83,0.16)", borderColor: "#34A853" });
// Five kinds of shipment, five different colours
assert.equal(new Set(["air", "sea", "courier", "transport", "warehouse"].map(modeColor)).size, 5);
console.log("colors tests passed");
