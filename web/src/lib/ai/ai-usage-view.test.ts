import assert from "node:assert/strict";
import { AI_FEATURE_KEYS, budgetRows, budgetState, readBudgetForm, spikeNote, chartScale, creditStatus, featureLabel, fmtInr, fmtTokens, fmtUsd, modelLabel, monthLabel, readBalanceForm, type AiSummaryView } from "./ai-usage-view";

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

// budgets
assert.equal(budgetState(1, null), "none");
assert.equal(budgetState(1, 10), "ok");
assert.equal(budgetState(8, 10), "near");
assert.equal(budgetState(10, 10), "paused");
assert.equal(budgetState(0, 0), "paused", "a budget of 0 is a pause");

const withBudgets: AiSummaryView = {
  ...base,
  months: [{ month: "2026-11", total: { calls: 9, input: 0, output: 0, web: 0, costUsd: 9.5 }, features: [{ key: "readCarrierCircular", calls: 3, input: 0, output: 0, web: 0, costUsd: 8.5 }, { key: "vertexChat", calls: 6, input: 0, output: 0, web: 0, costUsd: 1 }, { key: "brandNewThing", calls: 1, input: 0, output: 0, web: 0, costUsd: 0.2 }], models: [], days: [] }],
  budgets: { totalUsd: 20, perFeature: { readCarrierCircular: 10, vertexChat: 3, draftEnquiryReply: 0 } },
};
const br = budgetRows(withBudgets);
assert.deepEqual([br.total.label, br.total.usedUsd, br.total.limitUsd, br.total.state], ["All AI together", 9.5, 20, "ok"]);
assert.deepEqual(br.features.slice(0, 3).map((r) => r.key), ["readCarrierCircular", "vertexChat", "brandNewThing"], "most used first, including a feature the list did not know");
assert.equal(br.features[0].state, "near");
assert.equal(br.features[0].pct, 0.85);
assert.equal(br.features.find((r) => r.key === "vertexChat")!.state, "ok");
assert.equal(br.features.find((r) => r.key === "draftEnquiryReply")!.state, "paused");
assert.equal(br.features.find((r) => r.key === "draftEnquiryReply")!.pct, 1);
assert.equal(br.features.find((r) => r.key === "brandNewThing")!.limitUsd, null);
assert.equal(br.features.length, new Set(br.features.map((r) => r.key)).size, "no repeats");
for (const k of AI_FEATURE_KEYS) assert.ok(br.features.some((r) => r.key === k), `${k} can be given a budget`);
// no data yet: every known feature is listed, none limited
const empty = budgetRows(base);
assert.equal(empty.features.length, AI_FEATURE_KEYS.length);
assert.ok(empty.features.every((r) => r.limitUsd === null && r.state === "none"));
assert.equal(empty.total.state, "none");

assert.deepEqual(readBudgetForm({ total: "$20", rows: { vertexChat: "3", readCarrierCircular: "", draftEnquiryReply: "0" } }), { ok: true, totalUsd: 20, perFeature: { vertexChat: 3, draftEnquiryReply: 0 } });
assert.deepEqual(readBudgetForm({ total: "", rows: {} }), { ok: true, totalUsd: null, perFeature: {} });
assert.equal(readBudgetForm({ total: "abc", rows: {} }).ok, false);
assert.equal(readBudgetForm({ total: "", rows: { vertexChat: "-1" } }).ok, false);
const badRow = readBudgetForm({ total: "", rows: { vertexChat: "x" } });
assert.ok(!badRow.ok && /Ask Vertex/.test(badRow.message));

// a spending spike is one plain sentence, only when there is one
assert.equal(spikeNote(base), null);
assert.equal(spikeNote({ ...base, today: { alert: false, todayUsd: 1, avgUsd: 1, times: 1 } }), null);
assert.match(spikeNote({ ...base, today: { alert: true, todayUsd: 7, avgUsd: 1, times: 7 } })!, /\$7\.00 so far, about 7 times a normal day/);
assert.match(spikeNote({ ...base, today: { alert: true, todayUsd: 6, avgUsd: 0, times: null } })!, /\$6\.00 so far\. The table/);

console.log("ai-usage-view tests passed");
