import assert from "node:assert/strict";
import type { EnquiryRecord } from "../types";
import {
  formatBuyCell,
  formatDateCell,
  formatGpCell,
  formatSellCell,
  formatTonnage,
  formatTonnageCell,
  parseRowDate,
  totalTonnage,
} from "./edb-metrics";

function row(partial: Partial<EnquiryRecord>): EnquiryRecord {
  return {
    id: "1",
    ref: "AEABC0926IN83013",
    customer: "ABC",
    mode: "air",
    origin: "BLR",
    destination: "GRU",
    status: "quoted",
    slaHoursOpen: 2,
    assignee: "Ganny",
    creator: "ganny",
    createdAt: "2026-09-10",
    ...partial,
  };
}

{
  const usd = row({
    grandTotal: 820,
    currency: "USD",
    amountINR: 68470,
    grossProfit: undefined,
  });
  const sell = formatSellCell(usd, "total");
  assert.equal(sell, "$820.00");
  assert.doesNotMatch(sell, /₹|68470/);
  assert.equal(formatGpCell(usd, "amount"), "—");
  assert.equal(formatBuyCell(usd, "total"), "—");
}

{
  const withGp = row({
    grandTotal: 820,
    currency: "USD",
    grossProfit: 40,
    grossProfitCurrency: "USD",
  });
  assert.equal(formatSellCell(withGp, "total"), "$820.00");
  assert.equal(formatGpCell(withGp, "amount"), "$40.00");
  assert.equal(formatBuyCell(withGp, "total"), "$780.00");
}

{
  assert.equal(formatTonnageCell(row({ billingWeight: undefined })), "—");
  assert.equal(formatTonnageCell(row({ billingWeight: 1250, billingUnit: "kg" })), "1,250 kg");
  assert.equal(formatTonnageCell(row({ billingWeight: 8.5, billingUnit: "rt" })), "8.5 RT");
  assert.equal(formatTonnageCell(row({ billingWeight: 400, billingUnit: "gw" })), "400 kg (GW)");
}

{
  // "Latest quoted first" must always be able to sort by real date — YYYY-MM-DD
  // strings (the normal case) and a raw epoch-ms fallback both need to parse,
  // and a later date must sort after an earlier one.
  assert.ok(parseRowDate("2026-09-26") > parseRowDate("2026-09-01"));
  assert.equal(parseRowDate(""), 0);
  assert.equal(parseRowDate(undefined), 0);
  assert.ok(parseRowDate("1758844800000") > 0, "epoch-ms fallback string must parse too");
  assert.equal(formatDateCell(row({ createdAt: "" })), "—");
  assert.match(formatDateCell(row({ createdAt: "2026-09-26" })), /2026/);
}

// --- the summary strip's total tonnage ---
{
  const air = (kg: number) => row({ billingWeight: kg, billingUnit: "kg" });
  assert.deepEqual(totalTonnage([air(1200), air(800)]), { tonnes: 2, counted: 2 }, "kilograms are divided by 1,000");
  assert.deepEqual(totalTonnage([row({ billingWeight: 12.5, billingUnit: "rt" })]), { tonnes: 12.5, counted: 1 }, "a sea revenue tonne already is a tonne");
  assert.deepEqual(totalTonnage([row({ billingWeight: 3000, billingUnit: "gw" })]), { tonnes: 3, counted: 1 }, "gross kilograms too");
  assert.deepEqual(totalTonnage([air(500), row({ billingWeight: undefined }), row({ billingWeight: 0, billingUnit: "kg" }), row({ billingWeight: Number.NaN, billingUnit: "kg" })]), { tonnes: 0.5, counted: 1 }, "quotes with no weight add nothing");
  assert.deepEqual(totalTonnage([]), { tonnes: 0, counted: 0 });
  assert.equal(formatTonnage(0), "—");
  assert.equal(formatTonnage(0.85), "850 kg");
  assert.equal(formatTonnage(12.456), "12.46 t");
  assert.equal(formatTonnage(1234.56), "1,234.6 t");
}

console.log("edb-metrics tests passed");
