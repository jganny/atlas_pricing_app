/**
 * AI usage and cost — the pure parts (no network, no database), so they can be tested.
 *
 * Every call the app makes to the AI service is counted by the wrapper in ai-usage.js. This file holds:
 *  - the price list (US dollars per million tokens; web search per 1,000) — one place to change when prices move,
 *  - turning one AI reply's usage numbers into counts,
 *  - cost from counts,
 *  - the estimated balance (what the Anthropic Console showed when the admin last typed it in, minus what the app has
 *    spent since) and the "running low" decision.
 *
 * The balance is an ESTIMATE: the AI service gives no way to read the prepaid balance from code.
 */

// USD per 1,000,000 tokens: [input, output]. Matched against the model name with punctuation turned into "_".
// Order matters: the first pattern that matches wins.
const PRICES = [
  { match: /fable/, input: 10, output: 50 },
  { match: /opus_5_5/, input: 4, output: 20 },
  { match: /opus/, input: 5, output: 25 },
  { match: /sonnet_5/, input: 2, output: 10 },
  { match: /sonnet/, input: 3, output: 15 },
  { match: /haiku_5/, input: 0.1, output: 0.5 },
  { match: /haiku/, input: 1, output: 5 },
];
const FALLBACK_PRICE = { input: 3, output: 15 }; // an unknown model is costed like an older Sonnet, i.e. on the safe (high) side
const WEB_SEARCH_USD_EACH = 0.01; // $10 per 1,000 searches
const ADMIN_EMAIL = "ganny@atlaspricing.com";

const DEFAULTS = { lowAtUsd: 10, inrPerUsd: 90 };

/** A model name made safe to use as a database field name: lowercase letters, digits and "_". */
function modelKey(model) {
  const k = String(model || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return k || "unknown";
}

function priceFor(key) {
  const k = modelKey(key);
  const hit = PRICES.find((p) => p.match.test(k));
  return hit ? { input: hit.input, output: hit.output, known: true } : { ...FALLBACK_PRICE, known: false };
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round6 = (v) => Math.round(v * 1e6) / 1e6;

/** Dollars for one set of counts. */
function costUsd({ model, input = 0, output = 0, web = 0 }) {
  const p = priceFor(model);
  return round6((num(input) * p.input + num(output) * p.output) / 1e6 + num(web) * WEB_SEARCH_USD_EACH);
}

/** The "usage" object of an AI reply -> plain counts. Cached tokens are counted as input (a slight over-estimate). */
function countsFromUsage(usage) {
  const u = usage || {};
  return {
    input: num(u.input_tokens) + num(u.cache_creation_input_tokens) + num(u.cache_read_input_tokens),
    output: num(u.output_tokens),
    web: num(u.server_tool_use && u.server_tool_use.web_search_requests),
  };
}

/** A streamed (server-sent events) reply -> { model, input, output, web }. Output is the last cumulative figure. */
function countsFromSse(text) {
  let model = "";
  let input = 0;
  let output = 0;
  let web = 0;
  for (const line of String(text || "").split("\n")) {
    if (!line.startsWith("data:")) continue;
    let ev;
    try {
      ev = JSON.parse(line.slice(5).trim());
    } catch {
      continue;
    }
    if (ev.type === "message_start" && ev.message) {
      model = ev.message.model || model;
      const c = countsFromUsage(ev.message.usage);
      input = c.input;
      output = Math.max(output, c.output);
      web = Math.max(web, c.web);
    } else if (ev.type === "message_delta" && ev.usage) {
      const c = countsFromUsage(ev.usage);
      if (c.input) input = c.input;
      output = Math.max(output, c.output);
      web = Math.max(web, c.web);
    }
  }
  return { model, input, output, web };
}

/** The AI service refused because the prepaid credit is used up. */
function isOutOfCredit(status, bodyText) {
  return Number(status) === 400 && /credit balance is too low/i.test(String(bodyText || ""));
}

/** India Standard Time parts of a moment: month "2026-11", day "07", and yyyymmdd. */
function istParts(ms = Date.now()) {
  const d = new Date(ms + 5.5 * 3600 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return { month: `${y}-${m}`, day: dd, ymd: `${y}${m}${dd}` };
}

/** What the function was called when it ran -> the feature this spend belongs to. */
function featureName(env = process.env) {
  return String(env.FUNCTION_TARGET || env.K_SERVICE || env.FUNCTION_NAME || "unknown");
}

/**
 * Estimated prepaid balance in USD. `billing` is what the admin saved: { balanceUsd, spendAtCheckpoint }.
 * `totalSpentUsd` is everything the app has spent so far. Returns null when the admin hasn't entered a balance yet.
 */
function estimateBalance(billing, totalSpentUsd) {
  if (!billing || !Number.isFinite(Number(billing.balanceUsd))) return null;
  const since = Math.max(0, num(totalSpentUsd) - num(billing.spendAtCheckpoint));
  return { balanceUsd: round6(num(billing.balanceUsd) - since), spentSinceUsd: round6(since) };
}

/**
 * Should the admin be warned now? Only once per saved balance (alertedFor === asOf means "already warned").
 * Returns { alert: boolean, reason, estimateUsd }.
 */
function lowBalanceCheck(billing, totalSpentUsd) {
  const est = estimateBalance(billing, totalSpentUsd);
  if (!est) return { alert: false, reason: "no-balance", estimateUsd: null };
  const lowAt = Number.isFinite(Number(billing.lowAtUsd)) ? Number(billing.lowAtUsd) : DEFAULTS.lowAtUsd;
  if (est.balanceUsd > lowAt) return { alert: false, reason: "ok", estimateUsd: est.balanceUsd };
  if (billing.alertedFor && billing.alertedFor === billing.asOf) return { alert: false, reason: "already-warned", estimateUsd: est.balanceUsd };
  return { alert: true, reason: est.balanceUsd <= 0 ? "empty" : "low", estimateUsd: est.balanceUsd };
}

/** Admin input for the balance form -> clean numbers, or a plain-words problem. */
function parseBillingInput(data) {
  const d = data || {};
  const balanceUsd = Number(d.balanceUsd);
  if (!Number.isFinite(balanceUsd) || balanceUsd < 0 || balanceUsd > 1_000_000) return { error: "Type the balance shown in the Anthropic Console, in US dollars." };
  const lowAtUsd = d.lowAtUsd === undefined || d.lowAtUsd === "" ? DEFAULTS.lowAtUsd : Number(d.lowAtUsd);
  if (!Number.isFinite(lowAtUsd) || lowAtUsd < 0 || lowAtUsd > 100_000) return { error: "The warning level must be a number of dollars, 0 or more." };
  const inrPerUsd = d.inrPerUsd === undefined || d.inrPerUsd === "" ? DEFAULTS.inrPerUsd : Number(d.inrPerUsd);
  if (!Number.isFinite(inrPerUsd) || inrPerUsd < 1 || inrPerUsd > 1000) return { error: "The rupee rate must be between 1 and 1000." };
  return { balanceUsd: round6(balanceUsd), lowAtUsd: round6(lowAtUsd), inrPerUsd: round6(inrPerUsd) };
}

/**
 * Month documents -> what the Admin screen shows.
 * A month doc looks like { month, days: { "07": { "<feature>__<modelKey>": { calls, input, output, web } } } }.
 */
function summarizeMonth(doc) {
  const total = { calls: 0, input: 0, output: 0, web: 0, costUsd: 0 };
  const features = new Map();
  const models = new Map();
  const days = [];
  for (const [day, entries] of Object.entries((doc && doc.days) || {})) {
    let dayCost = 0;
    let dayCalls = 0;
    for (const [k, v] of Object.entries(entries || {})) {
      const [feature, ...rest] = k.split("__");
      const model = rest.join("__") || "unknown";
      const row = { calls: num(v.calls), input: num(v.input), output: num(v.output), web: num(v.web) };
      const cost = costUsd({ model, ...row });
      for (const [map, key] of [
        [features, feature],
        [models, model],
      ]) {
        const a = map.get(key) || { key, calls: 0, input: 0, output: 0, web: 0, costUsd: 0 };
        a.calls += row.calls;
        a.input += row.input;
        a.output += row.output;
        a.web += row.web;
        a.costUsd = round6(a.costUsd + cost);
        map.set(key, a);
      }
      total.calls += row.calls;
      total.input += row.input;
      total.output += row.output;
      total.web += row.web;
      total.costUsd = round6(total.costUsd + cost);
      dayCost += cost;
      dayCalls += row.calls;
    }
    days.push({ day, calls: dayCalls, costUsd: round6(dayCost) });
  }
  const byCost = (a, b) => b.costUsd - a.costUsd;
  return {
    month: (doc && doc.month) || "",
    total,
    features: [...features.values()].sort(byCost),
    models: [...models.values()].sort(byCost),
    days: days.sort((a, b) => a.day.localeCompare(b.day)),
  };
}

module.exports = {
  PRICES,
  WEB_SEARCH_USD_EACH,
  ADMIN_EMAIL,
  DEFAULTS,
  modelKey,
  priceFor,
  costUsd,
  countsFromUsage,
  countsFromSse,
  isOutOfCredit,
  istParts,
  featureName,
  estimateBalance,
  lowBalanceCheck,
  parseBillingInput,
  summarizeMonth,
};
