import assert from "node:assert/strict";
import { createSurchargeRow, calcSurchargeCost } from "@/lib/pricing/surcharges";
import { surchargeLine, surchargeLineValue } from "./option-breakdown";

const money = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
const line = (partial: Parameters<typeof createSurchargeRow>[0], bases: Parameters<typeof calcSurchargeCost>[1]) =>
  surchargeLine(calcSurchargeCost(createSurchargeRow(partial), bases));

// The example from the PSA BDP quote: Handling entered at 0.06 per kg on 8,582.80 kg
const handling = line({ name: "Handling", sell: 0.06, unit: "kg" }, { chargeableKg: 8582.8 });
assert.equal(handling.amount, 514.968);
assert.equal(surchargeLineValue(handling, money), "8582.80 kg × $0.06 = $514.97", "per-kilo charges show weight × rate = total, like base freight");

// A flat charge is just its amount
assert.equal(surchargeLineValue(line({ name: "Pickup", sell: 689, unit: "flat" }, { chargeableKg: 8582.8 }), money), "$689.00");

// A rate typed only as Buy still shows its working (the quote uses Buy when Sell is blank)
assert.equal(surchargeLineValue(line({ name: "Screening", buy: 0.1, unit: "kg" }, { chargeableKg: 500 }), money), "500.00 kg × $0.10 = $50.00");

// Per cbm and per container work the same way
assert.equal(surchargeLineValue(line({ name: "CFS", sell: 12, unit: "cbm" }, { cbm: 3.5 }), money), "3.50 cbm × $12.00 = $42.00");
assert.equal(surchargeLineValue(line({ name: "THC", sell: 285, unit: "container" }, { containerCount: 2 }), money), "2 containers × $285.00 = $570.00");
assert.equal(surchargeLineValue(line({ name: "THC", sell: 285, unit: "container" }, { containerCount: 1 }), money), "1 container × $285.00 = $285.00");

// A remark rides along; a remarks-only row still shows its note
assert.equal(surchargeLineValue(line({ name: "Handling", sell: 0.06, unit: "kg", remarks: "min $50" }, { chargeableKg: 1000 }), money), "1000.00 kg × $0.06 = $60.00 (min $50)");
assert.equal(surchargeLineValue({ name: "X", amount: 0, remarks: "at actuals" }, money), "at actuals");
console.log("surcharge-line tests passed");
