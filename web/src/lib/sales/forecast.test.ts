import assert from "node:assert/strict";
import {
  STAGE_PROBABILITY,
  UNSCHEDULED,
  effectiveProbability,
  forecastByMonth,
  forecastByStage,
  weightedForecastValue,
  weightedPipelineTotal,
} from "./forecast";
import type { SalesLead } from "../types";

function lead(partial: Partial<SalesLead>): SalesLead {
  return { id: "x", company: "Acme", status: "new", ...partial };
}

// stage default vs override, override clamped
assert.equal(effectiveProbability(lead({ status: "quoted" })), STAGE_PROBABILITY.quoted);
assert.equal(effectiveProbability(lead({ status: "quoted", probability: 20 })), 20);
assert.equal(effectiveProbability(lead({ status: "new", probability: 250 })), 100);
assert.equal(effectiveProbability(lead({ status: "new", probability: -5 })), 0);
assert.equal(effectiveProbability(lead({ status: "new", probability: 0 })), 0); // explicit 0 is honoured

// weighted value
assert.equal(weightedForecastValue(lead({ status: "qualified", dealValue: 200_000 })), 100_000);
assert.equal(weightedForecastValue(lead({ status: "qualified" })), 0);

// pipeline total counts open leads only
const leads = [
  lead({ id: "a", status: "quoted", dealValue: 100_000 }), // 70k
  lead({ id: "b", status: "new", dealValue: 100_000 }), // 10k
  lead({ id: "c", status: "won", dealValue: 900_000 }), // excluded
  lead({ id: "d", status: "lost", dealValue: 900_000 }), // excluded
];
assert.equal(weightedPipelineTotal(leads), 80_000);

// by stage
const byStage = forecastByStage(leads);
assert.deepEqual(byStage.map((b) => b.key), ["new", "contacted", "qualified", "quoted"]);
assert.equal(byStage.find((b) => b.key === "quoted")?.weighted, 70_000);
assert.equal(byStage.find((b) => b.key === "contacted")?.count, 0);

// by month: sorted, undated last, closed leads excluded
const byMonth = forecastByMonth([
  lead({ id: "1", status: "quoted", dealValue: 100, expectedCloseDate: "2026-11-15" }),
  lead({ id: "2", status: "quoted", dealValue: 100, expectedCloseDate: "2026-10-01" }),
  lead({ id: "3", status: "new", dealValue: 100 }),
  lead({ id: "4", status: "won", dealValue: 100, expectedCloseDate: "2026-10-01" }),
]);
assert.deepEqual(byMonth.map((b) => b.key), ["2026-10", "2026-11", UNSCHEDULED]);
assert.equal(byMonth[0]!.count, 1);

console.log("forecast.test.ts: all assertions passed");
