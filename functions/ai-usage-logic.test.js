const assert = require("node:assert/strict");
const L = require("./ai-usage-logic");

// model names become safe field names and find the right price
assert.equal(L.modelKey("claude-haiku-4-5-20251001"), "claude_haiku_4_5_20251001");
assert.equal(L.modelKey(""), "unknown");
assert.deepEqual(
  [L.priceFor("claude-sonnet-5-5").input, L.priceFor("claude-sonnet-5-5").output],
  [2, 10],
);
assert.deepEqual([L.priceFor("claude-haiku-4-5-20251001").input, L.priceFor("claude-haiku-4-5-20251001").output], [1, 5]);
assert.deepEqual([L.priceFor("claude-haiku-5-5").input, L.priceFor("claude-haiku-5-5").output], [0.1, 0.5]);
assert.deepEqual([L.priceFor("claude-opus-5-5").input, L.priceFor("claude-opus-5-5").output], [4, 20]);
assert.deepEqual([L.priceFor("claude-opus-4-8").input, L.priceFor("claude-opus-4-8").output], [5, 25]);
assert.deepEqual([L.priceFor("claude-sonnet-4-6").input, L.priceFor("claude-sonnet-4-6").output], [3, 15]);
assert.equal(L.priceFor("claude-fable-5-1").input, 10);
// an unknown model is costed on the high side and marked unknown
assert.equal(L.priceFor("mystery-1").known, false);
assert.equal(L.priceFor("mystery-1").input, 3);

// cost: 1M in + 1M out on Sonnet 5.5 = $12; 3 web searches = $0.03
assert.equal(L.costUsd({ model: "claude-sonnet-5-5", input: 1e6, output: 1e6 }), 12);
assert.equal(L.costUsd({ model: "claude-sonnet-5-5", web: 3 }), 0.03);
assert.equal(L.costUsd({ model: "claude-haiku-4-5", input: 202345, output: 29627 }), 0.35048);

// a reply's usage -> counts (cached tokens count as input, missing fields are 0)
assert.deepEqual(L.countsFromUsage({ input_tokens: 10, output_tokens: 4 }), { input: 10, output: 4, web: 0 });
assert.deepEqual(
  L.countsFromUsage({ input_tokens: 10, cache_read_input_tokens: 5, cache_creation_input_tokens: 1, output_tokens: 2, server_tool_use: { web_search_requests: 3 } }),
  { input: 16, output: 2, web: 3 },
);
assert.deepEqual(L.countsFromUsage(null), { input: 0, output: 0, web: 0 });

// a streamed reply: input from the start, the LAST output figure, searches from the end
const sse = [
  'event: message_start',
  'data: {"type":"message_start","message":{"model":"claude-sonnet-5-5","usage":{"input_tokens":1200,"output_tokens":1}}}',
  'data: {"type":"content_block_delta","delta":{"text":"hi"}}',
  'data: {"type":"message_delta","usage":{"output_tokens":300,"server_tool_use":{"web_search_requests":2}}}',
  "data: not json",
  'data: {"type":"message_stop"}',
].join("\n");
assert.deepEqual(L.countsFromSse(sse), { model: "claude-sonnet-5-5", input: 1200, output: 300, web: 2 });
assert.deepEqual(L.countsFromSse(""), { model: "", input: 0, output: 0, web: 0 });

// out-of-credit detection
assert.ok(L.isOutOfCredit(400, '{"error":{"message":"Your credit balance is too low to access the Anthropic API."}}'));
assert.ok(!L.isOutOfCredit(429, "Your credit balance is too low"));
assert.ok(!L.isOutOfCredit(400, "something else"));

// India date: 18:30 UTC on 30 Nov is already 1 Dec in India
assert.deepEqual(L.istParts(Date.UTC(2026, 10, 30, 18, 30)), { month: "2026-12", day: "01", ymd: "20261201" });
assert.deepEqual(L.istParts(Date.UTC(2026, 10, 7, 12, 0)), { month: "2026-11", day: "07", ymd: "20261107" });

// feature name comes from the function's own name
assert.equal(L.featureName({ FUNCTION_TARGET: "vertexChat", K_SERVICE: "vertexchat" }), "vertexChat");
assert.equal(L.featureName({ K_SERVICE: "readcarriercircular" }), "readcarriercircular");
assert.equal(L.featureName({}), "unknown");

// estimated balance = typed balance minus spend since; none until a balance is typed
assert.equal(L.estimateBalance(null, 5), null);
assert.deepEqual(L.estimateBalance({ balanceUsd: 50, spendAtCheckpoint: 2 }, 5.5), { balanceUsd: 46.5, spentSinceUsd: 3.5 });
assert.equal(L.estimateBalance({ balanceUsd: 5, spendAtCheckpoint: 10 }, 8).balanceUsd, 5); // never negative "spent since"

// low-balance warning: not before a balance exists, not while healthy, once when low, not again for the same balance
assert.equal(L.lowBalanceCheck(null, 1).alert, false);
assert.equal(L.lowBalanceCheck({ balanceUsd: 50, spendAtCheckpoint: 0, lowAtUsd: 10, asOf: 1 }, 20).alert, false);
const low = L.lowBalanceCheck({ balanceUsd: 50, spendAtCheckpoint: 0, lowAtUsd: 10, asOf: 1 }, 41);
assert.deepEqual([low.alert, low.reason, low.estimateUsd], [true, "low", 9]);
assert.equal(L.lowBalanceCheck({ balanceUsd: 50, spendAtCheckpoint: 0, lowAtUsd: 10, asOf: 1, alertedFor: 1 }, 45).alert, false);
assert.equal(L.lowBalanceCheck({ balanceUsd: 50, spendAtCheckpoint: 0, lowAtUsd: 10, asOf: 2, alertedFor: 1 }, 45).alert, true); // new balance saved => can warn again
assert.equal(L.lowBalanceCheck({ balanceUsd: 5, spendAtCheckpoint: 0, lowAtUsd: 10, asOf: 1 }, 6).reason, "empty");
assert.equal(L.lowBalanceCheck({ balanceUsd: 20, spendAtCheckpoint: 0, asOf: 1 }, 11).alert, true); // default warning level is $10

// admin form input
assert.deepEqual(L.parseBillingInput({ balanceUsd: "25.5" }), { balanceUsd: 25.5, lowAtUsd: 10, inrPerUsd: 90 });
assert.deepEqual(L.parseBillingInput({ balanceUsd: 40, lowAtUsd: 5, inrPerUsd: 88.5 }), { balanceUsd: 40, lowAtUsd: 5, inrPerUsd: 88.5 });
assert.ok(L.parseBillingInput({ balanceUsd: "abc" }).error);
assert.ok(L.parseBillingInput({ balanceUsd: -1 }).error);
assert.ok(L.parseBillingInput({ balanceUsd: 10, lowAtUsd: -2 }).error);
assert.ok(L.parseBillingInput({ balanceUsd: 10, inrPerUsd: 0 }).error);
assert.ok(L.parseBillingInput(undefined).error);

// month summary: by feature, by model, by day; most expensive first
const m = L.summarizeMonth({
  month: "2026-11",
  days: {
    "02": { "vertexChat__claude_sonnet_5_5": { calls: 2, input: 1e6, output: 0, web: 0 } },
    "03": {
      "vertexChat__claude_sonnet_5_5": { calls: 1, input: 0, output: 1e6, web: 2 },
      "pollPricingInboxes__claude_haiku_4_5_20251001": { calls: 10, input: 1e6, output: 0, web: 0 },
    },
  },
});
assert.equal(m.total.calls, 13);
assert.equal(m.total.costUsd, 2 + 10 + 0.02 + 1);
assert.deepEqual(m.features.map((f) => f.key), ["vertexChat", "pollPricingInboxes"]);
assert.equal(m.features[0].costUsd, 12.02);
assert.deepEqual(m.models.map((x) => x.key), ["claude_sonnet_5_5", "claude_haiku_4_5_20251001"]);
assert.deepEqual(m.days, [{ day: "02", calls: 2, costUsd: 2 }, { day: "03", calls: 11, costUsd: 11.02 }]);
assert.equal(L.summarizeMonth(null).total.calls, 0);

// ── budgets ──
assert.deepEqual(L.parseBudgetsInput({ totalUsd: "20", perFeature: { vertexChat: "3", readCarrierCircular: "", draftEnquiryReply: 0 } }), { totalUsd: 20, perFeature: { vertexChat: 3, draftEnquiryReply: 0 } });
assert.deepEqual(L.parseBudgetsInput({}), { totalUsd: null, perFeature: {} });
assert.deepEqual(L.parseBudgetsInput({ totalUsd: "", perFeature: {} }), { totalUsd: null, perFeature: {} });
assert.ok(L.parseBudgetsInput({ totalUsd: "abc" }).error);
assert.ok(L.parseBudgetsInput({ totalUsd: -1 }).error);
assert.ok(L.parseBudgetsInput({ perFeature: { vertexChat: "x" } }).error);
assert.match(L.parseBudgetsInput({ perFeature: { vertexChat: -5 } }).error, /Ask Vertex/);
assert.ok(L.parseBudgetsInput({ perFeature: { "bad name!": 1 } }).error);

const spend = L.monthSpend({ month: "2026-11", days: { "02": { vertexChat__claude_sonnet_5_5: { calls: 1, input: 1e6, output: 0, web: 0 } }, "03": { readCarrierCircular__claude_sonnet_5_5: { calls: 1, input: 0, output: 1e6, web: 0 } } } });
assert.deepEqual(spend, { total: 12, byFeature: { readCarrierCircular: 10, vertexChat: 2 } });
assert.deepEqual(L.monthSpend(null), { total: 0, byFeature: {} });

// nothing set: always allowed; under: allowed; at or over: paused; zero pauses at once; the overall budget stops everything
assert.deepEqual(L.budgetVerdict(null, "vertexChat", spend), { allowed: true });
assert.deepEqual(L.budgetVerdict({ totalUsd: null, perFeature: {} }, "vertexChat", spend), { allowed: true });
assert.deepEqual(L.budgetVerdict({ totalUsd: null, perFeature: { vertexChat: 3 } }, "vertexChat", spend), { allowed: true });
const hit = L.budgetVerdict({ totalUsd: null, perFeature: { vertexChat: 2 } }, "vertexChat", spend);
assert.deepEqual([hit.allowed, hit.scope, hit.usedUsd, hit.limitUsd], [false, "feature", 2, 2]);
assert.equal(L.budgetVerdict({ totalUsd: null, perFeature: { vertexChat: 2 } }, "readCarrierCircular", spend).allowed, true, "another feature is not affected");
assert.equal(L.budgetVerdict({ totalUsd: null, perFeature: { draftEnquiryReply: 0 } }, "draftEnquiryReply", spend).allowed, false, "a budget of 0 pauses a feature");
const tot = L.budgetVerdict({ totalUsd: 12, perFeature: {} }, "draftEnquiryReply", spend);
assert.deepEqual([tot.allowed, tot.scope], [false, "total"]);
assert.equal(L.budgetVerdict({ totalUsd: 12.01, perFeature: {} }, "vertexChat", spend).allowed, true);
assert.match(L.budgetMessage(hit), /Ask Vertex this month \(\$2\.00\) has been reached/);
assert.match(L.budgetMessage(tot), /overall AI budget .*\$12\.00/);
assert.deepEqual(L.pausedNow({ totalUsd: 12, perFeature: { vertexChat: 2, readCarrierCircular: 50 } }, spend), { total: true, features: ["vertexChat"] });
assert.deepEqual(L.pausedNow(null, spend), { total: false, features: [] });
assert.equal(L.featureLabel("readCarrierCircular"), "Carrier Board reader");
assert.equal(L.featureLabel("somethingNew"), "somethingNew");

// ── a day that costs far more than usual ──
const d = (day, costUsd) => ({ day, costUsd });
assert.equal(L.spikeCheck([d("01", 1), d("02", 1.2), d("03", 0.8), d("04", 1.0), d("05", 7)], "05").alert, true, "7 against an average of 1");
assert.equal(L.spikeCheck([d("01", 1), d("02", 1.2), d("03", 0.8), d("04", 1.0), d("05", 2.5)], "05").alert, false, "2.5 is under three times the average");
assert.equal(L.spikeCheck([d("01", 0.1), d("02", 0.1), d("03", 0.1), d("04", 1.9)], "04").alert, false, "below the floor, however many times the average");
const few = [d("01", 0.2), d("02", 3)];
assert.equal(L.spikeCheck(few, "02").alert, false, "too little history: needs a bigger amount");
assert.equal(L.spikeCheck([d("01", 0.2), d("02", 5.5)], "02").alert, true);
assert.equal(L.spikeCheck([d("01", 6)], "01").alert, true, "first day of the month with a large bill");
assert.equal(L.spikeCheck([], "01").alert, false);
assert.deepEqual([L.spikeCheck([d("01", 1), d("02", 1), d("03", 1), d("04", 6)], "04").todayUsd, L.spikeCheck([d("01", 1), d("02", 1), d("03", 1), d("04", 6)], "04").times], [6, 6]);
assert.equal(L.spikeCheck([d("01", 1), d("02", 0), d("03", 1), d("04", 1), d("05", 4)], "05").avgUsd, 1, "days with no use are not counted in the average");

console.log("ai-usage-logic tests passed");
