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

console.log("ai-usage-logic tests passed");
