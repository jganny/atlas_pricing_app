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

// ───────────────────────── budgets and spikes ─────────────────────────

/** What each feature is called in a phone alert (the key is the name of the function that calls the AI). */
const FEATURE_LABELS = {
  vertexChat: "Ask Vertex",
  atlasCopilot: "App help assistant",
  atlasCopilotStream: "App help assistant",
  extractAirTariffFromCircular: "Air circular upload",
  extractSeaTariffFromCircular: "Sea circular upload",
  extractCourierTariffFromCircular: "Courier circular upload",
  extractVendorRateFromDocument: "Vendor rate from a document",
  draftEnquiryReply: "Enquiry reply drafts",
  extractShipmentFromDocuments: "Quote Hub documents",
  parseQuoteInstruction: "Quote by instruction",
  pollPricingInboxes: "Mailbox reading",
  readCarrierCircular: "Carrier Board reader",
  autoReadCarrierCircular: "Carrier Board auto-read",
  autoReadReplacedCircular: "Carrier Board auto-read",
  weeklyAgencyListEmail: "Agency list check",
  triggerAgencyListNow: "Agency list check",
};
const featureLabel = (k) => FEATURE_LABELS[k] || String(k || "this feature");

/**
 * The places AI is used, as the admin and the users know them. Each group is one switch. A function name (the key AI usage is counted
 * under) belongs to exactly one group; a function that is in no group is never switched off.
 */
const AI_GROUPS = {
  quoteHub: ["extractShipmentFromDocuments"],
  mailbox: ["pollPricingInboxes"],
  circulars: ["readLibraryCircular", "readCarrierCircular", "autoReadCarrierCircular", "autoReadReplacedCircular", "extractAirTariffFromCircular", "extractSeaTariffFromCircular", "extractCourierTariffFromCircular"],
  askVertex: ["vertexChat"],
  help: ["atlasCopilot", "atlasCopilotStream"],
  replyDrafts: ["draftEnquiryReply"],
  instruction: ["parseQuoteInstruction"],
  vendorRate: ["extractVendorRateFromDocument"],
  agencyList: ["weeklyAgencyListEmail", "triggerAgencyListNow"],
};
const AI_GROUP_LABELS = {
  quoteHub: "Quote Hub reading",
  mailbox: "Mailbox sorting and confirmation reading",
  circulars: "Circular reading",
  askVertex: "Ask Vertex",
  help: "App help assistant",
  replyDrafts: "Enquiry reply drafts",
  instruction: "Quote by instruction",
  vendorRate: "Vendor rate from a document",
  agencyList: "Agency list check",
};
const groupOf = (feature) => Object.keys(AI_GROUPS).find((g) => AI_GROUPS[g].includes(feature)) || null;

/**
 * The admin's switches: { master: boolean (default on), groups: { quoteHub: false, ... } }. Missing means on, so a fault or an empty document
 * never switches anything off. Returns { allowed: true } or a refusal with the group that is off.
 */
function switchVerdict(switches, feature) {
  const sw = switches || {};
  if (sw.master === false) return { allowed: false, scope: "switch", all: true, feature, group: groupOf(feature) };
  const g = groupOf(feature);
  if (g && sw.groups && sw.groups[g] === false) return { allowed: false, scope: "switch", all: false, feature, group: g };
  return { allowed: true };
}

/** Clean admin input for the switches. */
function parseSwitchesInput(data) {
  const d = data || {};
  const groups = {};
  for (const g of Object.keys(AI_GROUPS)) if (d.groups && typeof d.groups[g] === "boolean") groups[g] = d.groups[g];
  return { master: d.master === false ? false : true, groups };
}

const BUDGET_NAME = /^[A-Za-z0-9_]{1,60}$/;
const budgetNumber = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Admin input for the budget form -> clean numbers, or a plain-words problem. Empty means "no limit"; 0 means "paused". */
function parseBudgetsInput(data) {
  const d = data || {};
  const total = budgetNumber(d.totalUsd);
  if (total !== null && (!Number.isFinite(total) || total < 0 || total > 100000)) return { error: "The overall monthly budget must be a number of dollars (0 or more), or empty for no limit." };
  const perFeature = {};
  for (const [k, v] of Object.entries(d.perFeature || {})) {
    if (!BUDGET_NAME.test(k)) return { error: `"${k}" is not a feature name.` };
    const n = budgetNumber(v);
    if (n === null) continue;
    if (!Number.isFinite(n) || n < 0 || n > 100000) return { error: `The budget for ${featureLabel(k)} must be a number of dollars (0 or more), or empty for no limit.` };
    perFeature[k] = round6(n);
  }
  return { totalUsd: total === null ? null : round6(total), perFeature };
}

/** A month document -> what has been spent so far this month: { total, byFeature }. */
function monthSpend(doc) {
  const m = summarizeMonth(doc);
  return { total: m.total.costUsd, byFeature: Object.fromEntries(m.features.map((f) => [f.key, f.costUsd])) };
}

/**
 * May this feature call the AI right now? `budgets` is { totalUsd, perFeature }; `spend` is { total, byFeature } for this month.
 * No budgets set means always allowed. A budget is reached when spend is AT or over it (so a budget of 0 pauses a feature).
 */
function budgetVerdict(budgets, feature, spend) {
  if (!budgets) return { allowed: true };
  const fLimit = budgets.perFeature && Number.isFinite(budgets.perFeature[feature]) ? budgets.perFeature[feature] : null;
  const fUsed = num(spend && spend.byFeature && spend.byFeature[feature]);
  if (fLimit !== null && fUsed >= fLimit) return { allowed: false, scope: "feature", feature, usedUsd: round6(fUsed), limitUsd: fLimit };
  const tLimit = Number.isFinite(budgets.totalUsd) ? budgets.totalUsd : null;
  const tUsed = num(spend && spend.total);
  if (tLimit !== null && tUsed >= tLimit) return { allowed: false, scope: "total", feature, usedUsd: round6(tUsed), limitUsd: tLimit };
  return { allowed: true };
}

/** The reason in plain words, for a log line, a phone alert or the message a caller receives. */
function budgetMessage(v) {
  if (v && v.scope === "switch") {
    return v.all
      ? "AI is switched off by your admin, so this needs to be done by hand. Nothing is lost."
      : `AI reading for ${AI_GROUP_LABELS[v.group] || featureLabel(v.feature)} is switched off by your admin, so this needs to be done by hand. Nothing is lost.`;
  }
  const money = (n) => `$${num(n).toFixed(2)}`;
  return v.scope === "total"
    ? `The overall AI budget for this month (${money(v.limitUsd)}) has been reached, so AI features are paused until next month or until the budget is raised in Admin.`
    : `The AI budget for ${featureLabel(v.feature)} this month (${money(v.limitUsd)}) has been reached, so it is paused until next month or until the budget is raised in Admin.`;
}

/** Which features (and whether the whole thing) are paused right now. */
function pausedNow(budgets, spend) {
  if (!budgets) return { total: false, features: [] };
  const total = budgetVerdict({ totalUsd: budgets.totalUsd, perFeature: {} }, "", spend).allowed === false;
  const features = Object.keys(budgets.perFeature || {}).filter((f) => budgetVerdict({ totalUsd: null, perFeature: budgets.perFeature }, f, spend).allowed === false);
  return { total, features };
}

/**
 * Is today's AI spend unusually high? `days` is [{ day: "07", costUsd }] for this month. Warn when today is at least `floorUsd`
 * and `factor` times the average of the earlier days with any use. With fewer than `minDays` earlier days to compare against,
 * only a higher figure (2.5 × the floor) counts.
 */
function spikeCheck(days, today, { floorUsd = 2, factor = 3, minDays = 3 } = {}) {
  const todayUsd = round6(num((days || []).find((d) => d.day === today)?.costUsd));
  const prev = (days || []).filter((d) => d.day < today && num(d.costUsd) > 0);
  const avgUsd = prev.length ? round6(prev.reduce((t, d) => t + num(d.costUsd), 0) / prev.length) : 0;
  const base = { todayUsd, avgUsd, times: avgUsd > 0 ? Math.round((todayUsd / avgUsd) * 10) / 10 : null };
  if (todayUsd < floorUsd) return { alert: false, ...base };
  if (prev.length >= minDays ? todayUsd < factor * avgUsd : todayUsd < floorUsd * 2.5) return { alert: false, ...base };
  return { alert: true, ...base };
}

// ───────────────────────── the cost policy: which model, with or without thinking ─────────────────────────

const HAIKU_OLD = /^claude-haiku-4-5/;
const HAIKU_NEW = "claude-haiku-5-5";
const SONNET = "claude-sonnet-5-5";
/** Features whose answers benefit from the model thinking first, so they keep the default. */
const KEEP_THINKING = new Set(["vertexChat"]);

/**
 * The money-saving rules, applied to one AI request just before it is sent.
 *  - A Haiku 4.5 request moves to Haiku 5.5 (about a tenth of the price per word) with thinking off, so its short answer is not used up by thinking.
 *  - A Sonnet 5.5 request that did not choose a thinking setting gets none, except for the features that keep it: simple extraction and drafting
 *    do not need it, and thinking is billed as output.
 * Requests the rules cannot safely change (an assistant prefill, an explicit sampling setting, anything already set) are left exactly as they are.
 * Returns { body, changed } where changed says what was rewritten, or null.
 */
function applyModelPolicy(body, feature) {
  if (!body || typeof body !== "object" || !Array.isArray(body.messages)) return { body, changed: null };
  const last = body.messages[body.messages.length - 1];
  if (last && last.role === "assistant") return { body, changed: null }; // a prefill is refused by the newer model
  if (typeof body.model === "string" && HAIKU_OLD.test(body.model)) {
    const next = { ...body, model: HAIKU_NEW };
    delete next.temperature;
    delete next.top_p;
    delete next.top_k;
    if (!next.thinking) next.thinking = { type: "disabled" };
    return { body: next, changed: "haiku-5-5" };
  }
  if (body.model === SONNET && body.thinking === undefined && !KEEP_THINKING.has(feature)) {
    return { body: { ...body, thinking: { type: "between_tools" } }, changed: "thinking-off" };
  }
  return { body, changed: null };
}

/** The AI service refused the request itself (not the account or the load): worth retrying the old way once. */
function isRequestRefusal(status, text) {
  const s = Number(status);
  if (s !== 400 && s !== 404) return false;
  return !isOutOfCredit(s, text);
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
  FEATURE_LABELS,
  featureLabel,
  AI_GROUPS,
  AI_GROUP_LABELS,
  groupOf,
  switchVerdict,
  parseSwitchesInput,
  parseBudgetsInput,
  monthSpend,
  budgetVerdict,
  budgetMessage,
  pausedNow,
  spikeCheck,
  applyModelPolicy,
  isRequestRefusal,
};
