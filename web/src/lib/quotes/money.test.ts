import assert from "node:assert/strict";
import type { EnquiryRecord } from "../types";
import {
  formatQuoteGp,
  formatQuoteSell,
  gpAmountInr,
  sellAmountInr,
  summarizeInr,
} from "./money";

function row(partial: Partial<EnquiryRecord>): EnquiryRecord {
  return {
    id: "1",
    ref: "AIAKS0926IN00942",
    customer: "Akshara teck",
    mode: "air",
    origin: "LHR",
    destination: "BLR",
    status: "won",
    slaHoursOpen: 0,
    assignee: "Goutham",
    creator: "goutham",
    createdAt: "2026-09-01",
    ...partial,
  };
}

{
  const inrQuote = row({
    grandTotal: 281449.53,
    currency: "INR",
    amountINR: 281449.53,
    grossProfit: 6243.29,
    grossProfitCurrency: "INR",
  });
  assert.equal(sellAmountInr(inrQuote), 281449.53);
  assert.equal(gpAmountInr(inrQuote), 6243.29);
  assert.match(formatQuoteSell(inrQuote), /₹/);
  assert.doesNotMatch(formatQuoteSell(inrQuote), /\$/);
  assert.match(formatQuoteGp(inrQuote), /₹/);
  const sum = summarizeInr([inrQuote]);
  assert.equal(sum.sell, 281449.53);
  assert.equal(sum.gp, 6243.29);
}

{
  const usdQuote = row({
    grandTotal: 3380,
    currency: "USD",
    amountINR: 281449.53,
    grossProfit: 75,
    grossProfitCurrency: "USD",
    grossProfitINR: 6243.29,
  });
  assert.equal(sellAmountInr(usdQuote), 281449.53);
  assert.equal(gpAmountInr(usdQuote), 6243.29);
  assert.match(formatQuoteSell(usdQuote), /\$/);
  assert.match(formatQuoteSell(usdQuote), /₹/);
  assert.match(formatQuoteGp(usdQuote), /\$/);
  assert.match(formatQuoteGp(usdQuote), /₹/);
}

{
  const missingInr = row({
    grandTotal: 100,
    currency: "USD",
    grossProfit: 10,
    grossProfitCurrency: "USD",
  });
  assert.equal(sellAmountInr(missingInr), 100 * 83.25);
  assert.equal(gpAmountInr(missingInr), 10 * 83.25);
}

console.log("money tests passed");
