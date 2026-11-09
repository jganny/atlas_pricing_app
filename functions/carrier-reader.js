/**
 * Automatic circular reader (airline tariffs). Opens an uploaded circular (PDF or spreadsheet), has the AI read it twice
 * independently, and applies a route only when both reads agree and it looks normal (see tariff-checks.js). Anything
 * else is held, the old rate stays in use, and the admin is told in plain words. Nobody approves anything.
 *
 * Writes: carrierTariffs/{airline_origin_destination_currency} (+ /history), carrierReads/{circularId} (what happened),
 * carrierTariffHolds/{circularId} (what was held and why), carrierReadUsage/{yyyy-mm} (AI usage, for the cost line in Admin).
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const XLSX = require("xlsx");
const { decide } = require("./tariff-checks");
const L = require("./carrier-reader-logic");
const aiUsageLogic = require("./ai-usage-logic");
const { isRequestRefusal } = aiUsageLogic;
const AIRLINE_NAMES = require("./airline-names.json");
const D = require("./circular-digest-logic");

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const ADMIN_EMAIL = "ganny@atlaspricing.com";
const MODEL = "claude-sonnet-5-5";
// The second, independent read uses the much cheaper model WITH thinking on (a different model is a stronger cross-check). Tested live 2026-11-09 on three real circulars: it matched or beat a second careful read (Singapore 110/110 agreed, IndiGo 77/77, Emirates 141/141 vs 132 + 9 held) at 30-41% less cost. With thinking OFF it failed (wrote corrections into its answer; stopped at 14 of 110 routes), so never turn thinking off for it. secondRead: "sonnet" restores two careful reads.
const CHEAP_MODEL = "claude-haiku-5-5";
const MAX_PARTS = 60; // a spreadsheet is read in parts; more than this is held for a person to look at
const PARTS_AT_ONCE = 6;
const MAX_ATTEMPTS = 3;
const RETRY_MS = Number(process.env.CARRIER_RETRY_MS) || 4000;
const FILE_LIFE_DAYS = 30;

function requireAdmin(request) {
  if (!request.auth || request.auth.token.chatOnly === true) throw new HttpsError("unauthenticated", "Sign in is required.");
  if (String(request.auth.token.email || "").toLowerCase() !== ADMIN_EMAIL) throw new HttpsError("permission-denied", "Only the admin can do this.");
}

/** The circular as parts the AI can read in full: the whole PDF as one part, or a spreadsheet cut into small parts of text. */
async function partsFor(circ) {
  const [buffer] = await admin.storage().bucket().file(circ.storagePath).download();
  const kind = L.fileKind(circ.fileName, circ.storagePath);
  if (kind === "pdf") {
    if (buffer.length > 28 * 1024 * 1024) throw new HttpsError("invalid-argument", "This PDF is too large to read (28 MB limit).");
    return [{ label: "document", content: { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } } }];
  }
  if (kind === "sheet") {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheets = wb.SheetNames.map((name) => ({ name, csv: XLSX.utils.sheet_to_csv(wb.Sheets[name]) }));
    return L.chunkSheets(sheets).map((p) => ({ label: p.label, content: { type: "text", text: p.text } }));
  }
  throw new HttpsError("invalid-argument", "Only PDF and Excel circulars can be read automatically.");
}

function sumUsage(list) {
  return list.reduce((t, u) => ({ input: t.input + (u.input_tokens || 0), output: t.output + (u.output_tokens || 0) }), { input: 0, output: 0 });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sonnet answers directly (thinking would use up the answer allowance); the cheaper model needs to think first or it thinks out loud inside its answer. */
const thinkingFor = (model) => (model === MODEL ? { type: "between_tools" } : { type: "adaptive" });

async function askOnce(apiKey, system, content, userText, model = MODEL) {
  let res;
  let used = model;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: used, max_tokens: 16000, thinking: thinkingFor(used), system, messages: [{ role: "user", content: [content, { type: "text", text: userText }] }] }),
    });
    if (!res.ok && used !== MODEL) {
      // The cheaper model refused the request itself: do this read with the stronger one instead of failing.
      const refusal = await res.clone().text().catch(() => "");
      if (isRequestRefusal(res.status, refusal)) {
        console.warn("carrier reader: the cheaper model refused, using the stronger one", res.status, refusal.slice(0, 200));
        used = MODEL;
        continue;
      }
    }
    if (res.ok || ![429, 500, 502, 503, 529].includes(res.status) || attempt === MAX_ATTEMPTS) break;
    await sleep(RETRY_MS * attempt); // busy: wait a little longer each time
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("carrier reader: AI request failed", res.status, body.slice(0, 300));
    if (/budget_exceeded/.test(body)) {
      let msg = "The AI budget for the Carrier Board reader has been reached.";
      try {
        msg = JSON.parse(body).error.message || msg;
      } catch {
        /* keep the plain default */
      }
      throw new HttpsError("resource-exhausted", msg);
    }
    if (/credit balance is too low/i.test(body)) throw new HttpsError("failed-precondition", "The AI account has run out of credit. Top it up in the Anthropic console (Plans & Billing), then try again.");
    throw new HttpsError("unavailable", "The AI service did not answer. Try again in a minute.");
  }
  const payload = await res.json();
  const raw = (payload.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const parsed = L.parseRowLines(raw);
  return { parsed, model: used, usage: payload.usage || {}, truncated: payload.stop_reason === "max_tokens", stop: payload.stop_reason || "", chars: raw.length, head: raw.slice(0, 160), rows: parsed ? parsed.rows.length : 0, columns: parsed ? parsed.columns : null };
}


/**
 * The Air desk reads its rates from air_tariffs. Every airline route just applied is published there too (as BUY, never SELL),
 * replacing that airline's record for the lane, so users never have to copy a rate across. Done a carrier at a time.
 */
async function publishToAirDesk(db, applied, circ, circularId) {
  let published = 0;
  const byCarrier = new Map();
  for (const r of applied) {
    if (!byCarrier.has(r.carrierCode)) byCarrier.set(r.carrierCode, []);
    byCarrier.get(r.carrierCode).push(r);
  }
  for (const [code, rows] of byCarrier) {
    const snap = await db.collection("air_tariffs").where("carrierCode", "==", code).get();
    const existing = {};
    snap.forEach((d) => {
      const v = d.data();
      existing[`${v.origin}|${v.destination}`] = d.id;
    });
    const plan = L.planDeskPublish(rows, existing, { circularCarrier: circ.carrier, circularId, names: AIRLINE_NAMES });
    for (let i = 0; i < plan.length; i += 200) {
      const batch = db.batch();
      for (const p of plan.slice(i, i + 200)) {
        const ref = p.docId ? db.collection("air_tariffs").doc(p.docId) : db.collection("air_tariffs").doc();
        batch.set(ref, { ...p.data, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      await batch.commit();
    }
    published += plan.length;
  }
  return published;
}

/** { circularId, dryRun? } -> what was applied, held and unchanged. dryRun reads and checks but writes nothing. */
/** { circularId, dryRun?, secondRead?, auto? } -> what was applied, held and unchanged. dryRun reads and checks but writes nothing. */
async function runCarrierRead({ circularId, dryRun, secondRead, auto, quiet }, apiKey) {
  const db = admin.firestore();
  const snap = await db.collection("circularsLibrary").doc(circularId).get();
  if (!snap.exists) throw new HttpsError("not-found", "That circular does not exist.");
  const circ = { id: snap.id, ...snap.data() };
  if (circ.category !== "airline_tariff") throw new HttpsError("failed-precondition", "Only airline tariff circulars are read here for now.");
  if (!circ.storagePath) throw new HttpsError("failed-precondition", "This circular has no file attached.");

  const parts = await partsFor(circ);
  if (!parts.length) throw new HttpsError("failed-precondition", "Nothing readable was found in this file.");
  if (parts.length > MAX_PARTS) throw new HttpsError("failed-precondition", `This circular is too long to read automatically (${parts.length} parts; the limit is ${MAX_PARTS}).`);
  const fallback = /^[A-Za-z0-9]{2,3}$/.test(String(circ.carrier || "").trim()) ? circ.carrier : "";
  const userText = `This document is "${circ.title || circ.fileName || ""}"${circ.carrier ? ` from ${circ.carrier}` : ""}. Extract every route's weight-break rates as instructed.`;
  const [sysA, sysB] = L.systemPrompts();

  // Every part is read twice, independently, a few at a time: the careful model first, the cheaper one second (secondRead: "sonnet" for two careful reads).
  const secondModel = secondRead === "sonnet" ? MODEL : CHEAP_MODEL;
  const reads = await L.mapLimit(parts, PARTS_AT_ONCE, async (part) => {
    const [a, b] = await Promise.all([askOnce(apiKey, sysA, part.content, userText, MODEL), askOnce(apiKey, sysB, part.content, userText, secondModel)]);
    return { label: part.label, a, b };
  });
  const problems = [];
  const failed = reads.filter((r) => !r.a.parsed || !r.b.parsed);
  const cut = reads.filter((r) => r.a.truncated || r.b.truncated);
  if (failed.length) problems.push(`${failed.length} of ${reads.length} part(s) could not be understood in one of the two reads (${failed.slice(0, 3).map((r) => r.label).join(", ")}), so routes in them were not updated.`);
  if (cut.length) problems.push(`${cut.length} of ${reads.length} part(s) were so long that a read was cut short (${cut.slice(0, 3).map((r) => r.label).join(", ")}), so routes in them were not updated.`);
  // A part that failed either read contributes nothing: its routes are neither applied nor lost, they simply keep their old rates.
  const good = reads.filter((r) => r.a.parsed && r.b.parsed && !r.a.truncated && !r.b.truncated);
  const readA = L.mergeRows(good.map((r) => L.normalizeRows(r.a.parsed, fallback)));
  const readB = L.mergeRows(good.map((r) => L.normalizeRows(r.b.parsed, fallback)));
  const a = { usage: sumUsage(reads.map((r) => r.a.usage)) };
  const b = { usage: sumUsage(reads.map((r) => r.b.usage)) };

  const carriers = [...new Set([...readA, ...readB].map((r) => r.carrierCode).filter(Boolean))].slice(0, 10);
  const onFile = [];
  if (carriers.length) {
    const stored = await db.collection("carrierTariffs").where("carrierCode", "in", carriers).get();
    stored.forEach((d) => onFile.push(d.data()));
  }
  const decided = decide(readA, readB, onFile);
  const result = problems.length ? { ...decided, hold: [{ row: {}, reasons: problems }, ...decided.hold] } : decided;

  const now = Date.now();
  const usage = { input: a.usage.input + b.usage.input, output: a.usage.output + b.usage.output };
  const summary = {
    circularId,
    status: "read",
    kind: "rates",
    auto: auto === true,
    uploadedBy: quiet ? "" : circ.uploadedBy || "",
    storagePath: circ.storagePath || "",
    title: circ.title || circ.fileName || "",
    carrier: circ.carrier || "",
    fileName: circ.fileName || "",
    at: now,
    rowsReadA: readA.length,
    rowsReadB: readB.length,
    applied: result.apply.length,
    held: result.hold.length,
    unchanged: result.unchanged.length,
    parts: { total: reads.length, failed: failed.length + cut.length },
    models: { readA: MODEL, readB: [...new Set(reads.map((r) => r.b.model))].join(", ") },
    usage,
    dryRun,
    deleteFileAfter: now + FILE_LIFE_DAYS * 86_400_000,
  };

  if (!dryRun) {
    for (let i = 0; i < result.apply.length; i += 200) {
      const batch = db.batch();
      for (const r of result.apply.slice(i, i + 200)) {
        const { changes, ...row } = r;
        const ref = db.collection("carrierTariffs").doc(L.tariffDocId(row));
        batch.set(ref, { ...row, sourceCircularId: circularId, sourceFile: circ.fileName || "", updatedAt: now }, { merge: false });
        if (changes && changes.length) batch.set(ref.collection("history").doc(String(now)), { at: now, sourceCircularId: circularId, changes });
      }
      await batch.commit();
    }
    summary.publishedToAirDesk = await publishToAirDesk(db, result.apply, circ, circularId);
    const holdRef = db.collection("carrierTariffHolds").doc(circularId);
    if (result.hold.length) {
      await holdRef.set({ circularId, carrier: circ.carrier || "", title: summary.title, createdAt: now, status: "open", rows: result.hold.slice(0, 100).map((h) => ({ route: h.row.origin ? `${h.row.carrierCode} ${h.row.origin}→${h.row.destination} ${h.row.currency || ""}`.trim() : "", reasons: h.reasons })) });
    } else {
      await holdRef.delete().catch(() => undefined);
    }
    await db.collection("carrierReads").doc(circularId).set(summary);
    const month = new Date(now).toISOString().slice(0, 7);
    await db.collection("carrierReadUsage").doc(month).set({ month, inputTokens: admin.firestore.FieldValue.increment(usage.input), outputTokens: admin.firestore.FieldValue.increment(usage.output), reads: admin.firestore.FieldValue.increment(1) }, { merge: true });
  }
  // What each of the first parts' two reads said, in brief: lets the admin see why two reads disagreed. Not stored.
  const diagnostics = reads.slice(0, 3).map((r) => ({ part: r.label, readA: { rows: r.a.rows, columns: r.a.columns, stop: r.a.stop, chars: r.a.chars, head: r.a.head }, readB: { rows: r.b.rows, columns: r.b.columns, stop: r.b.stop, chars: r.b.chars, head: r.b.head } }));
  return { ...summary, diagnostics, holdDetails: result.hold.slice(0, 20).map((h) => ({ route: h.row.origin ? `${h.row.carrierCode} ${h.row.origin}→${h.row.destination} ${h.row.currency || "?"}` : "", reasons: h.reasons })), sample: result.apply.slice(0, 3) };
}

/** { circularId, dryRun? } -> what was applied, held and unchanged. dryRun reads and checks but writes nothing. */
exports.readCarrierCircular = onCall({ invoker: "public", secrets: [anthropicApiKey], timeoutSeconds: 900, memory: "1GiB" }, async (request) => {
  requireAdmin(request);
  const apiKey = anthropicApiKey.value();
  if (!apiKey) throw new HttpsError("failed-precondition", "The AI key is not set up.");
  return runCarrierRead({ circularId: String(request.data?.circularId || ""), dryRun: request.data?.dryRun === true, secondRead: request.data?.secondRead }, apiKey);
});

/** Admin only: switch auto-read on or off and set the monthly limit in dollars. */
exports.carrierAutoReadSave = onCall({ invoker: "public" }, async (request) => {
  requireAdmin(request);
  const parsed = L.parseAutoInput(request.data);
  if (parsed.error) throw new HttpsError("invalid-argument", parsed.error);
  await admin.firestore().collection("carrierReadSettings").doc("auto").set({ ...parsed, updatedAt: Date.now() });
  return { ok: true, ...parsed };
});

/** One plain request to the AI service with the same patience as askOnce; returns the reply text and usage. */
async function askDigest(apiKey, content) {
  let res;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: CHEAP_MODEL, max_tokens: 8000, thinking: { type: "adaptive" }, system: D.SYSTEM, messages: [{ role: "user", content }] }),
    });
    if (res.ok || ![429, 500, 502, 503, 529].includes(res.status) || attempt === MAX_ATTEMPTS) break;
    await sleep(RETRY_MS * attempt);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("circular digest: AI request failed", res.status, body.slice(0, 300));
    if (/budget_exceeded/.test(body)) throw new HttpsError("resource-exhausted", "The AI budget for reading circulars has been reached for this month.");
    if (/credit balance is too low/i.test(body)) throw new HttpsError("failed-precondition", "The AI account has run out of credit.");
    throw new HttpsError("unavailable", "The AI service did not answer.");
  }
  const payload = await res.json();
  return { text: (payload.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim(), usage: payload.usage || {}, stop: payload.stop_reason || "" };
}

/** Reads a circular that is not an airline rate table and writes its digest (circularDigests/{id}) and a status line (carrierReads/{id}). */
async function runCircularDigest({ circularId, circ }, apiKey) {
  const db = admin.firestore();
  const parts = await partsFor(circ);
  if (!parts.length) throw new HttpsError("failed-precondition", "Nothing readable was found in this file.");
  if (parts.length > 14) throw new HttpsError("failed-precondition", `This file is too long to summarise automatically (${parts.length} parts).`);
  const intro = `This document is "${circ.title || circ.fileName || ""}"${circ.carrier ? ` from ${circ.carrier}` : ""}. Write its digest as instructed.`;
  const reply = await askDigest(apiKey, [...parts.map((p) => p.content), { type: "text", text: intro }]);
  const digest = D.parseDigest(reply.text);
  if (!digest) throw new HttpsError("failed-precondition", reply.stop === "max_tokens" ? "The document was too long to summarise." : "Nothing useful could be written from this file.");
  const now = Date.now();
  await db.collection("circularDigests").doc(circularId).set({ ...digest, circularId, title: circ.title || circ.fileName || "", carrier: circ.carrier || "", category: circ.category || "", at: now });
  await db.collection("carrierReads").doc(circularId).set({
    circularId,
    status: "read",
    kind: "digest",
    auto: true,
    uploadedBy: circ.uploadedBy || "",
    storagePath: circ.storagePath || "",
    title: circ.title || circ.fileName || "",
    carrier: circ.carrier || "",
    fileName: circ.fileName || "",
    at: now,
    points: digest.summary.length,
    charges: digest.charges.length,
    applied: 0,
    held: 0,
    unchanged: 0,
  });
  return digest;
}

/**
 * Auto-read. When a circular is saved to the library with a new file (a first upload, or a replacement file), read it unless auto-read is
 * switched off or the month's limit would be passed:
 *   airline tariff  -> rates, saved to the Carrier Board and the Air desk (about $0.25)
 *   anything else   -> a plain-words digest of what it says and the charges it lists (a few cents)
 * Whatever happens is written to carrierReads/{id}, including who uploaded it, so that person is told straight away in the app:
 * reading, read, waiting (and why) or failed (and why). Circulars are uploaded rarely, so this costs a dollar or two a month.
 */
async function handleCircularFile(circ, circularId) {
  if (!circ || !circ.storagePath) return;
  const rates = circ.category === "airline_tariff";
  if (!rates && !D.DIGEST_CATEGORIES.includes(circ.category)) return;
  const db = admin.firestore();
  const now = Date.now();
  const note = (status, reason) =>
    db.collection("carrierReads").doc(circularId).set({ circularId, status, kind: rates ? "rates" : "digest", auto: true, reason, uploadedBy: circ.uploadedBy || "", storagePath: circ.storagePath, title: circ.title || circ.fileName || "", carrier: circ.carrier || "", fileName: circ.fileName || "", at: now, applied: 0, held: 0, unchanged: 0 });
  try {
    const existing = await db.collection("carrierReads").doc(circularId).get();
    if (existing.exists && existing.data().status === "read" && existing.data().storagePath === circ.storagePath) return;
    const settingsSnap = await db.collection("carrierReadSettings").doc("auto").get();
    const monthDoc = await db.collection("aiUsage").doc(aiUsageLogic.istParts().month).get();
    const spend = aiUsageLogic.monthSpend(monthDoc.exists ? monthDoc.data() : {});
    const spent = ["readCarrierCircular", "autoReadCarrierCircular", "autoReadReplacedCircular"].reduce((t, k) => t + (spend.byFeature[k] || 0), 0);
    const verdict = L.autoDecision(settingsSnap.exists ? settingsSnap.data() : null, spent, rates ? L.AUTO_READ_COST_USD : D.DIGEST_COST_USD);
    if (!verdict.run) {
      await note("skipped", verdict.reason);
      return;
    }
    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
      await note("failed", "The AI key is not set up. Tell the administrator.");
      return;
    }
    await note("reading", "");
    if (rates) await runCarrierRead({ circularId, dryRun: false, auto: true }, apiKey);
    else await runCircularDigest({ circularId, circ }, apiKey);
  } catch (e) {
    console.warn("circular auto-read failed", circularId, e && e.message);
    await note("failed", (e && e.message) || "The read did not finish. Try uploading it again.").catch(() => undefined);
  }
}

const TRIGGER = { region: "asia-south1", secrets: [anthropicApiKey], timeoutSeconds: 540, memory: "1GiB", retry: false };

/** A circular saved to the library for the first time. */
exports.autoReadCarrierCircular = onDocumentCreated({ document: "circularsLibrary/{circularId}", ...TRIGGER }, async (event) => {
  const circ = event.data && event.data.data ? event.data.data() : null;
  await handleCircularFile(circ, event.params.circularId);
});

/** A circular whose file was replaced (a revised tariff uploaded over the old entry). Other edits (notes, station) do nothing. */
exports.autoReadReplacedCircular = onDocumentUpdated({ document: "circularsLibrary/{circularId}", ...TRIGGER }, async (event) => {
  const before = event.data && event.data.before ? event.data.before.data() : null;
  const after = event.data && event.data.after ? event.data.after.data() : null;
  if (!after || !after.storagePath || (before && before.storagePath === after.storagePath)) return;
  await handleCircularFile(after, event.params.circularId);
});

/**
 * Admin only: read ONE circular already in the library (a rate table for an airline tariff, a plain-words digest for anything else), without
 * telling the person who uploaded it long ago. Already-read circulars are skipped unless force is true. Failures are recorded on the
 * circular (so its row shows why) and also returned.
 */
exports.readLibraryCircular = onCall({ invoker: "public", secrets: [anthropicApiKey], timeoutSeconds: 900, memory: "1GiB" }, async (request) => {
  requireAdmin(request);
  const circularId = String(request.data?.circularId || "");
  const db = admin.firestore();
  const snap = await db.collection("circularsLibrary").doc(circularId).get();
  if (!snap.exists) throw new HttpsError("not-found", "That circular does not exist.");
  const circ = snap.data();
  if (!circ.storagePath) throw new HttpsError("failed-precondition", "This circular has no file attached.");
  const rates = circ.category === "airline_tariff";
  if (!rates && !D.DIGEST_CATEGORIES.includes(circ.category)) throw new HttpsError("failed-precondition", "This kind of circular is not read automatically.");
  const existing = await db.collection("carrierReads").doc(circularId).get();
  if (existing.exists && existing.data().status === "read" && existing.data().storagePath === circ.storagePath && request.data?.force !== true) return { circularId, skipped: true, reason: "already read" };
  const apiKey = anthropicApiKey.value();
  if (!apiKey) throw new HttpsError("failed-precondition", "The AI key is not set up.");
  try {
    if (rates) {
      const res = await runCarrierRead({ circularId, dryRun: false, auto: false, quiet: true }, apiKey);
      return { circularId, kind: "rates", applied: res.applied, held: res.held, unchanged: res.unchanged };
    }
    const d = await runCircularDigest({ circularId, circ: { ...circ, uploadedBy: "" } }, apiKey);
    return { circularId, kind: "digest", points: d.summary.length, charges: d.charges.length };
  } catch (e) {
    await db.collection("carrierReads").doc(circularId).set({ circularId, status: "failed", kind: rates ? "rates" : "digest", auto: false, reason: (e && e.message) || "The read did not finish.", uploadedBy: "", storagePath: circ.storagePath, title: circ.title || circ.fileName || "", carrier: circ.carrier || "", fileName: circ.fileName || "", at: Date.now(), applied: 0, held: 0, unchanged: 0 }).catch(() => undefined);
    throw e;
  }
});
