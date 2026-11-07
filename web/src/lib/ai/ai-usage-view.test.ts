import assert from "node:assert/strict";
import { chartScale, creditStatus, featureLabel, fmtInr, fmtTokens, fmtUsd, modelLabel, monthLabel, readBalanceForm, type AiSummaryView } from "./ai-usage-view";

// friendly names, including the lower-case names the server may report
assert.equal(featureLabel("vertexChat"), "Ask Vertex");
assert.equal(featureLabel("vertexchat"), "Ask Vertex");
assert.equal(featureLabel("readCarrierCircular"), "Carrier Board reader");
assert.equal(featureLabel("someNewThing"), "someNewThing");
assert.equal(featureLabel(""), "Unknown");

assert.equal(modelLabel("claude_haiku_4_5_20251001"), "Haiku 4.5");
assert.equal(modelLabel("claude_sonnet_5_5"), "Sonnet 5.5");
assert.equal(modelLabel("claude_opus_5_5"), "Opus 5.5");
assert.equal(modelLabel("claude_fable_5_1"), "Fable 5.1");
assert.equal(modelLabel("mystery_model"), "mystery model");

assert.equal(fmtUsd(1234.5), "$1,234.50");
assert.equal(fmtUsd(0), "$0.00");
assert.equal(fmtUsd(0.001), "under $0.01");
assert.equal(fmtInr(10, 90), "₹900");
assert.equal(fmtInr(1234.5, 90), "₹1,11,105"); // Indian digit grouping
assert.equal(fmtInr(0.001, 90), "under ₹1");
assert.equal(fmtTokens(950), "950");
assert.equal(fmtTokens(202345), "202.3K");
assert.equal(fmtTokens(2_500_000), "2.50M");
assert.equal(monthLabel("2026-11"), "November 2026");
assert.equal(monthLabel("bad"), "bad");

const base: AiSummaryView = {
  months: [],
  countingSince: null,
  totalUsd: 0,
  status: { outOfCredit: false, since: null, lastFeature: "" },
  billing: null,
  defaults: { lowAtUsd: 10, inrPerUsd: 90 },
};
const withBilling = (estimateUsd: number | null, lowAtUsd = 10): AiSummaryView => ({
  ...base,
  billing: { balanceUsd: 50, asOf: 1, lowAtUsd, inrPerUsd: 90, estimateUsd, spentSinceUsd: 0, alertedAt: null },
});

// the four states
assert.equal(creditStatus(base).tone, "none");
assert.equal(creditStatus(withBilling(null)).tone, "none");
assert.equal(creditStatus(withBilling(42)).tone, "ok");
assert.match(creditStatus(withBilling(42)).headline, /\$42\.00 \(₹3,780\) left/);
assert.equal(creditStatus(withBilling(9.5)).tone, "low");
assert.equal(creditStatus(withBilling(10)).tone, "low"); // at the line counts as low
assert.equal(creditStatus(withBilling(0)).tone, "low");
assert.match(creditStatus(withBilling(-3)).headline, /probably finished/);
// out of credit wins over any estimate
assert.equal(creditStatus({ ...withBilling(42), status: { outOfCredit: true, since: 5, lastFeature: "vertexChat" } }).tone, "out");

// the form
assert.deepEqual(readBalanceForm({ balance: "$25.50", lowAt: "", rate: "" }), { ok: true, balanceUsd: 25.5, lowAtUsd: 10, inrPerUsd: 90 });
assert.deepEqual(readBalanceForm({ balance: "1,200", lowAt: "50", rate: "₹88.4" }), { ok: true, balanceUsd: 1200, lowAtUsd: 50, inrPerUsd: 88.4 });
assert.equal(readBalanceForm({ balance: "", lowAt: "", rate: "" }).ok, false);
assert.equal(readBalanceForm({ balance: "abc", lowAt: "", rate: "" }).ok, false);
assert.equal(readBalanceForm({ balance: "-5", lowAt: "", rate: "" }).ok, false);
assert.equal(readBalanceForm({ balance: "10", lowAt: "x", rate: "" }).ok, false);
assert.equal(readBalanceForm({ balance: "10", lowAt: "", rate: "0" }).ok, false);

// chart scale: the top always holds the tallest bar, on a round number
assert.deepEqual(chartScale([0.42, 0.9, 1.1, 0.35, 1.6, 1.25, 0.78]), { max: 2, ticks: [0, 1, 2] });
assert.deepEqual(chartScale([6.4, 3]), { max: 10, ticks: [0, 5, 10] });
assert.deepEqual(chartScale([0.03, 0.04]), { max: 0.1, ticks: [0, 0.05, 0.1] });
assert.deepEqual(chartScale([]), { max: 0.1, ticks: [0, 0.05, 0.1] });
assert.deepEqual(chartScale([100]), { max: 100, ticks: [0, 50, 100] });
assert.ok(chartScale([37]).max >= 37);

console.log("ai-usage-view tests passed");
