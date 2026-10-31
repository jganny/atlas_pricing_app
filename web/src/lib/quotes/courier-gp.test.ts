import assert from "node:assert/strict";
import { courierGrossProfit } from "./courier-gp";

// CRADV1026IN19953: sell 28,850, buy 25,050
assert.equal(courierGrossProfit([{ base: 28850, buy: 25050 }]), 3800);
// More than one lane: the profits add up
assert.equal(courierGrossProfit([{ base: 1000, buy: 800 }, { base: 500, buy: 450 }]), 250);
// A loss is a real answer, not "unknown"
assert.equal(courierGrossProfit([{ base: 900, buy: 1000 }]), -100);
// No buy figure: unknown, never a fake 0
assert.equal(courierGrossProfit([{ base: 1000, buy: 0 }]), null);
assert.equal(courierGrossProfit([{ base: 1000, buy: 800 }, { base: 500, buy: 0 }]), null, "one lane with no cost makes the total unknown");
assert.equal(courierGrossProfit([]), null);
assert.equal(courierGrossProfit([undefined]), null);
// Pennies are kept to 2 places
assert.equal(courierGrossProfit([{ base: 100.456, buy: 50.123 }]), 50.33);
console.log("courier-gp tests passed");
