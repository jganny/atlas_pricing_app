/**
 * Automatic circular reader (airline tariffs). Opens an uploaded circular (PDF or spreadsheet), has the AI read it twice
 * independently, and applies a route only when both reads agree and it looks normal (see tariff-checks.js). Anything
 * else is held, the old rate stays in use, and the admin is told in plain words. Nobody approves anything.
 *
 * Writes: carrierTariffs/{airline_origin_destination_currency} (+ /history), carrierReads/{circularId} (what happened),
 * carrierTariffHolds/{circularId} (what was held and why), carrierReadUsage/{yyyy-mm} (AI usage, for the cost line in Admin).
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const XLSX = require("xlsx");
const { decide } = require("./tariff-checks");
const L = require("./carrier-reader-logic");

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const ADMIN_EMAIL = "ganny@atlaspricing.com";
const MODEL = "claude-sonnet-5-5";
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

async function askOnce(apiKey, system, content, userText) {
  let res;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      // Thinking is off: it would use up the answer allowance, and the two independent reads plus the checks are what keep this honest.
      body: JSON.stringify({ model: MODEL, max_tokens: 16000, thinking: { type: "between_tools" }, system, messages: [{ role: "user", content: [content, { type: "text", text: userText }] }] }),
    });
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
  return { parsed, usage: payload.usage || {}, truncated: payload.stop_reason === "max_tokens", stop: payload.stop_reason || "", chars: raw.length, head: raw.slice(0, 160), rows: parsed ? parsed.rows.length : 0, columns: parsed ? parsed.columns : null };
}

/** { circularId, dryRun? } -> what was applied, held and unchanged. dryRun reads and checks but writes nothing. */
exports.readCarrierCircular = onCall({ invoker: "public", secrets: [anthropicApiKey], timeoutSeconds: 900, memory: "1GiB" }, async (request) => {
  requireAdmin(request);
  const circularId = String(request.data?.circularId || "");
  const dryRun = request.data?.dryRun === true;
  const apiKey = anthropicApiKey.value();
  if (!apiKey) throw new HttpsError("failed-precondition", "The AI key is not set up.");
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

  // Every part is read twice, independently, a few at a time.
  const reads = await L.mapLimit(parts, PARTS_AT_ONCE, async (part) => {
    const [a, b] = await Promise.all([askOnce(apiKey, sysA, part.content, userText), askOnce(apiKey, sysB, part.content, userText)]);
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
});
