/**
 * AI usage, cost and low-balance alert.
 *
 * install() wraps the server's fetch once, so EVERY call to the AI service (Ask Vertex, circular reading, quote by
 * instruction, mailbox reading, Quote Hub, the Carrier Board reader, anything added later) is counted without each
 * feature having to remember to. The feature is named after the Cloud Function that made the call.
 *
 * Stored:
 *  aiUsage/{yyyy-mm}     counts per day, per feature and model (tokens in/out, web searches, calls)
 *  aiStatus/spend        running total in US dollars (all time)
 *  aiStatus/credit       { outOfCredit, since, lastFeature } — set when the AI service says the credit is used up
 *  aiBilling/settings    what the admin typed from the Anthropic Console: balance, warning level, rupee rate
 *
 * Nothing here can reach a browser directly: the collections have no client rules, so only the admin-only functions below
 * read or write them. Counting never blocks or breaks the call it observes.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const L = require("./ai-usage-logic");

const AI_URL = "https://api.anthropic.com/v1/messages";
const SETTINGS_TTL_MS = 5 * 60 * 1000;
const CLEAR_CHECK_MS = 5 * 60 * 1000;
const WRITE_WAIT_MS = 1500;
const GUARD_TTL_MS = 60 * 1000;
const SPIKE_CHECK_MS = 5 * 60 * 1000;

let installed = false;
let settingsCache = { at: 0, data: null };
let lastClearCheck = 0;
let lastSpikeCheck = 0;
let guardCache = { at: 0, month: "", doc: null, budgets: null, pending: { total: 0, byFeature: {} } };

let dbOverride = null; // tests only: an in-memory stand-in for the database
const db = () => dbOverride || admin.firestore();
const FieldValue = () => (dbOverride && dbOverride.FieldValue) || admin.firestore.FieldValue;

function timeout(ms) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (t.unref) t.unref();
  });
}

/** Count one finished AI call. Returns the new all-time total in dollars (or null if it could not be saved). */
async function recordUsage({ feature, model, input, output, web, now = Date.now() }) {
  const key = L.modelKey(model);
  const cost = L.costUsd({ model: key, input, output, web });
  const { month, day } = L.istParts(now);
  const spendRef = db().doc("aiStatus/spend");
  const monthRef = db().doc(`aiUsage/${month}`);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(spendRef);
    const prev = snap.exists ? Number(snap.data().totalUsd) || 0 : 0;
    const total = Math.round((prev + cost) * 1e6) / 1e6;
    const inc = FieldValue().increment;
    tx.set(
      spendRef,
      { totalUsd: total, calls: inc(1), updatedAt: now, ...(snap.exists ? {} : { since: now }) },
      { merge: true },
    );
    tx.set(
      monthRef,
      { month, updatedAt: now, days: { [day]: { [`${feature}__${key}`]: { calls: inc(1), input: inc(input), output: inc(output), web: inc(web) } } } },
      { merge: true },
    );
    return total;
  });
}

async function getSettings(force = false) {
  if (!force && Date.now() - settingsCache.at < SETTINGS_TTL_MS) return settingsCache.data;
  const snap = await db().doc("aiBilling/settings").get();
  settingsCache = { at: Date.now(), data: snap.exists ? snap.data() : null };
  return settingsCache.data;
}

/** A short alert to the admin's registered devices (the same ones chat alerts use). Never throws. */
async function pushAdmin(title, body) {
  try {
    const snap = await db().doc("chatState/ganny").get();
    const tokens = (snap.exists && snap.data().tokens) || [];
    if (!tokens.length) return false;
    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      data: { title, body, url: "/app/admin/", tag: "ai-credit" },
      webpush: { headers: { Urgency: "high", TTL: "86400" } },
    });
    const dead = [];
    res.responses.forEach((x, i) => {
      const code = x.error && x.error.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") dead.push(tokens[i]);
    });
    if (dead.length) await db().doc("chatState/ganny").update({ tokens: FieldValue().arrayRemove(...dead) });
    return res.successCount > 0;
  } catch (e) {
    logger.warn("ai-usage: could not alert the admin", { error: String(e) });
    return false;
  }
}

const money = (usd) => `$${usd.toFixed(2)}`;

/** After a call is counted: warn once if the estimated balance has dropped to the level the admin chose. */
async function checkLow(totalUsd) {
  const billing = await getSettings();
  const verdict = L.lowBalanceCheck(billing, totalUsd);
  if (!verdict.alert) return;
  // Only one instance may send the warning for a given saved balance.
  const ref = db().doc("aiBilling/settings");
  const won = await db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const d = s.exists ? s.data() : null;
    if (!d || (d.alertedFor && d.alertedFor === d.asOf)) return false;
    tx.update(ref, { alertedFor: d.asOf, alertedAt: Date.now(), alertedEstimateUsd: verdict.estimateUsd });
    return true;
  });
  if (!won) return;
  settingsCache = { at: 0, data: null };
  const empty = verdict.reason === "empty";
  await pushAdmin(
    empty ? "AI credit is probably used up" : "AI credit is running low",
    empty
      ? "By the app's count the AI credit is finished. Add credit in the Anthropic Console, then enter the new balance in Admin."
      : `About ${money(Math.max(0, verdict.estimateUsd))} of AI credit left. Add credit in the Anthropic Console, then enter the new balance in Admin.`,
  );
}

async function noteOutOfCredit(feature) {
  const ref = db().doc("aiStatus/credit");
  const first = await db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const d = s.exists ? s.data() : {};
    const isNew = !d.outOfCredit;
    tx.set(ref, { outOfCredit: true, lastFeature: feature, lastAt: Date.now(), ...(isNew ? { since: Date.now() } : {}) }, { merge: true });
    return isNew;
  });
  if (first) {
    await pushAdmin("AI credit has run out", "AI features have stopped for everyone. Add credit in the Anthropic Console, then tap 'I've added credit' in Admin.");
  }
}

/** A call worked, so if we had marked the credit as used up, it plainly isn't any more. */
async function noteWorked() {
  if (Date.now() - lastClearCheck < CLEAR_CHECK_MS) return;
  lastClearCheck = Date.now();
  const ref = db().doc("aiStatus/credit");
  const s = await ref.get();
  if (s.exists && s.data().outOfCredit) await ref.set({ outOfCredit: false, clearedAt: Date.now() }, { merge: true });
}

// ───────────────────────── monthly budgets and the daily spike alert ─────────────────────────

/** This month's usage document and the budgets, re-read at most once a minute per server instance. */
async function guardSnapshot(now = Date.now()) {
  const { month } = L.istParts(now);
  if (guardCache.month === month && now - guardCache.at < GUARD_TTL_MS) return guardCache;
  const [monthSnap, budgetSnap] = await Promise.all([db().doc(`aiUsage/${month}`).get(), db().doc("aiBilling/budgets").get()]);
  const b = budgetSnap.exists ? budgetSnap.data() : null;
  guardCache = {
    at: now,
    month,
    doc: monthSnap.exists ? monthSnap.data() : null,
    budgets: b ? { totalUsd: Number.isFinite(Number(b.totalUsd)) && b.totalUsd !== null ? Number(b.totalUsd) : null, perFeature: b.perFeature || {} } : null,
    pending: { total: 0, byFeature: {} },
  };
  return guardCache;
}

/** Remember what this instance has spent since the snapshot was taken, so a budget bites before the next re-read. */
function bumpPending(feature, cost) {
  guardCache.pending.total += cost;
  guardCache.pending.byFeature[feature] = (guardCache.pending.byFeature[feature] || 0) + cost;
}

/** May this feature call the AI now? Any trouble reading the budgets lets the call through: a fault here must never stop the app. */
async function budgetGuard(feature) {
  try {
    const c = await guardSnapshot();
    if (!c.budgets) return { allowed: true };
    const base = L.monthSpend(c.doc);
    const spend = { total: base.total + c.pending.total, byFeature: { ...base.byFeature, [feature]: (base.byFeature[feature] || 0) + (c.pending.byFeature[feature] || 0) } };
    return L.budgetVerdict(c.budgets, feature, spend);
  } catch (e) {
    logger.warn("ai-usage: could not check the budgets, allowing the call", { error: String(e) });
    return { allowed: true };
  }
}

/** The reply a feature gets when its budget is used up: a plain refusal it can show, never a charge. */
function budgetResponse(verdict) {
  return new Response(JSON.stringify({ type: "error", error: { type: "budget_exceeded", message: L.budgetMessage(verdict) } }), { status: 403, headers: { "content-type": "application/json" } });
}

/** Tell the admin once per month per budget that it has been reached. */
async function noteBudgetHit(verdict) {
  const { month } = L.istParts();
  const key = verdict.scope === "total" ? "total" : verdict.feature;
  const ref = db().doc("aiStatus/budgetAlerts");
  const first = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists && snap.data().month === month ? snap.data() : { month, hit: {} };
    if (d.hit && d.hit[key]) return false;
    tx.set(ref, { month, hit: { ...(d.hit || {}), [key]: Date.now() } });
    return true;
  });
  if (first) await pushAdmin("AI budget reached", L.budgetMessage(verdict));
}

/** Warn once a day if today's AI spend is far above the earlier days of the month. */
async function checkSpike(now = Date.now()) {
  if (now - lastSpikeCheck < SPIKE_CHECK_MS) return;
  lastSpikeCheck = now;
  const c = await guardSnapshot(now);
  const { day, ymd } = L.istParts(now);
  const days = L.summarizeMonth(c.doc).days.map((d) => ({ ...d }));
  const today = days.find((d) => d.day === day);
  if (today) today.costUsd += c.pending.total;
  else days.push({ day, calls: 0, costUsd: c.pending.total });
  const v = L.spikeCheck(days, day);
  if (!v.alert) return;
  const ref = db().doc("aiStatus/spike");
  const first = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.data().ymd === ymd) return false;
    tx.set(ref, { ymd, at: Date.now(), todayUsd: v.todayUsd, avgUsd: v.avgUsd });
    return true;
  });
  if (first) {
    await pushAdmin(
      "AI use is unusually high today",
      `About ${money(v.todayUsd)} so far today${v.times ? `, roughly ${v.times} times a normal day` : ""}. Open Admin, AI credit and cost, to see what used it.`,
    );
  }
}

async function observe(res, feature) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (L.isOutOfCredit(res.status, text)) await noteOutOfCredit(feature);
    return;
  }
  const type = String(res.headers.get("content-type") || "");
  let counts;
  if (type.includes("event-stream")) {
    counts = L.countsFromSse(await res.text());
  } else {
    const payload = await res.json().catch(() => null);
    if (!payload) return;
    counts = { model: payload.model || "", ...L.countsFromUsage(payload.usage) };
  }
  if (!counts.input && !counts.output && !counts.web) return;
  const total = await recordUsage({ feature, model: counts.model, input: counts.input, output: counts.output, web: counts.web });
  bumpPending(feature, L.costUsd({ model: counts.model, input: counts.input, output: counts.output, web: counts.web }));
  await Promise.allSettled([checkLow(total), noteWorked(), checkSpike()]);
}

/** Wrap fetch once. Call this at the top of index.js, after the admin SDK is initialised. */
function install() {
  if (installed || typeof globalThis.fetch !== "function") return;
  installed = true;
  const original = globalThis.fetch.bind(globalThis);
  const feature = L.featureName();
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input && input.url) || String(input);
    const isAi = url.startsWith(AI_URL);
    if (isAi) {
      const verdict = await budgetGuard(feature);
      if (!verdict.allowed) {
        await Promise.race([noteBudgetHit(verdict).catch((e) => logger.warn("ai-usage: could not note a budget", { error: String(e) })), timeout(WRITE_WAIT_MS)]);
        return budgetResponse(verdict);
      }
    }
    // The cost policy: cheaper model / no needless thinking where that is safe. If the AI service refuses the changed request itself, the
    // same request is sent once more exactly as the feature wrote it, so saving money can never break a feature.
    let callInit = init;
    let changed = null;
    if (isAi && init && typeof init.body === "string") {
      try {
        const pol = L.applyModelPolicy(JSON.parse(init.body), feature);
        if (pol.changed) {
          changed = pol.changed;
          callInit = { ...init, body: JSON.stringify(pol.body) };
        }
      } catch {
        /* not JSON: send as it is */
      }
    }
    let res = await original(input, callInit);
    if (changed && !res.ok) {
      const text = await res.clone().text().catch(() => "");
      if (L.isRequestRefusal(res.status, text)) {
        logger.warn("ai-usage: the cost policy was refused, sending the original request", { feature, change: changed, status: res.status, body: text.slice(0, 200) });
        res = await original(input, init);
      }
    }
    try {
      if (isAi) {
        const work = observe(res.clone(), feature).catch((e) => logger.warn("ai-usage: could not count a call", { error: String(e) }));
        // For a normal reply, give the count a moment to be saved before the function can be frozen; streams finish on their own.
        const streaming = String(res.headers.get("content-type") || "").includes("event-stream");
        if (!streaming) await Promise.race([work, timeout(WRITE_WAIT_MS)]);
      }
    } catch (e) {
      logger.warn("ai-usage: wrapper problem", { error: String(e) });
    }
    return res;
  };
}

exports.install = install;

// ───────────────────────── Admin-only functions ─────────────────────────

function requireAdmin(request) {
  if (!request.auth || request.auth.token.chatOnly === true) throw new HttpsError("unauthenticated", "Sign in is required.");
  if (String(request.auth.token.email || "").toLowerCase() !== L.ADMIN_EMAIL) throw new HttpsError("permission-denied", "Only the admin can do this.");
}

/** Everything the Admin screen shows, in one call: the last three months, the credit status and the estimated balance. */
exports.aiUsageSummary = onCall({ invoker: "public", timeoutSeconds: 60 }, async (request) => {
  requireAdmin(request);
  const [monthsSnap, spendSnap, creditSnap, billingSnap, budgetsSnap] = await Promise.all([
    db().collection("aiUsage").orderBy("month", "desc").limit(3).get(),
    db().doc("aiStatus/spend").get(),
    db().doc("aiStatus/credit").get(),
    db().doc("aiBilling/settings").get(),
    db().doc("aiBilling/budgets").get(),
  ]);
  const spend = spendSnap.exists ? spendSnap.data() : {};
  const billing = billingSnap.exists ? billingSnap.data() : null;
  const est = L.estimateBalance(billing, spend.totalUsd);
  const credit = creditSnap.exists ? creditSnap.data() : {};
  const bd = budgetsSnap.exists ? budgetsSnap.data() : null;
  const budgets = bd ? { totalUsd: bd.totalUsd ?? null, perFeature: bd.perFeature || {} } : null;
  const { month: thisMonth, day: today } = L.istParts();
  const thisDoc = monthsSnap.docs.map((d) => d.data()).find((d) => d.month === thisMonth) || null;
  const months = monthsSnap.docs.map((d) => L.summarizeMonth(d.data()));
  const thisSummary = L.summarizeMonth(thisDoc);
  return {
    months,
    countingSince: spend.since || null,
    totalUsd: Number(spend.totalUsd) || 0,
    status: { outOfCredit: !!credit.outOfCredit, since: credit.since || null, lastFeature: credit.lastFeature || "" },
    billing: billing
      ? {
          balanceUsd: billing.balanceUsd,
          asOf: billing.asOf,
          lowAtUsd: billing.lowAtUsd ?? L.DEFAULTS.lowAtUsd,
          inrPerUsd: billing.inrPerUsd ?? L.DEFAULTS.inrPerUsd,
          estimateUsd: est ? est.balanceUsd : null,
          spentSinceUsd: est ? est.spentSinceUsd : 0,
          alertedAt: billing.alertedFor && billing.alertedFor === billing.asOf ? billing.alertedAt || null : null,
        }
      : null,
    defaults: L.DEFAULTS,
    budgets,
    paused: L.pausedNow(budgets, L.monthSpend(thisDoc)),
    today: L.spikeCheck(thisSummary.days, today),
  };
});

/** { balanceUsd, lowAtUsd?, inrPerUsd? } — the admin types what the Anthropic Console shows; the app counts down from it. */
exports.aiBillingSave = onCall({ invoker: "public", timeoutSeconds: 60 }, async (request) => {
  requireAdmin(request);
  const parsed = L.parseBillingInput(request.data);
  if (parsed.error) throw new HttpsError("invalid-argument", parsed.error);
  const spendSnap = await db().doc("aiStatus/spend").get();
  const spendAtCheckpoint = spendSnap.exists ? Number(spendSnap.data().totalUsd) || 0 : 0;
  const asOf = Date.now();
  await db().doc("aiBilling/settings").set({
    balanceUsd: parsed.balanceUsd,
    lowAtUsd: parsed.lowAtUsd,
    inrPerUsd: parsed.inrPerUsd,
    asOf,
    spendAtCheckpoint,
    alertedFor: null,
    savedBy: String(request.auth.token.email || ""),
  });
  settingsCache = { at: 0, data: null };
  // Typing a positive balance means credit was added: clear any "ran out" mark until the AI service says otherwise.
  if (parsed.balanceUsd > 0) await db().doc("aiStatus/credit").set({ outOfCredit: false, clearedAt: asOf }, { merge: true });
  return { ok: true, asOf };
});

/** { totalUsd?, perFeature: { name: dollars } } — monthly budgets. Empty means no limit; 0 pauses a feature. Enforced before every AI call. */
exports.aiBudgetsSave = onCall({ invoker: "public", timeoutSeconds: 60 }, async (request) => {
  requireAdmin(request);
  const parsed = L.parseBudgetsInput(request.data);
  if (parsed.error) throw new HttpsError("invalid-argument", parsed.error);
  await db().doc("aiBilling/budgets").set({ totalUsd: parsed.totalUsd, perFeature: parsed.perFeature, updatedAt: Date.now(), savedBy: String(request.auth.token.email || "") });
  guardCache = { at: 0, month: "", doc: null, budgets: null, pending: { total: 0, byFeature: {} } };
  // A raised budget can be reached again later: let the "reached" alerts fire afresh.
  await db().doc("aiStatus/budgetAlerts").set({ month: "", hit: {} });
  return { ok: true };
});

exports._test = {
  observe,
  recordUsage,
  pushAdmin,
  setDb(fake) {
    dbOverride = fake;
    settingsCache = { at: 0, data: null };
    lastClearCheck = 0;
    lastSpikeCheck = 0;
    guardCache = { at: 0, month: "", doc: null, budgets: null, pending: { total: 0, byFeature: {} } };
  },
  checkSpike,
  budgetGuard,
  resetInstall() {
    installed = false;
  },
};
