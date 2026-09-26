import assert from "node:assert/strict";
import type { EnquiryRecord } from "../types";
import { formatBuyCell, formatGpCell, formatSellCell, formatTonnageCell } from "./edb-metrics";

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

console.log("edb-metrics tests passed");
