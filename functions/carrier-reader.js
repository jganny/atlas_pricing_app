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
const MAX_SHEET_CHARS = 150_000;
const FILE_LIFE_DAYS = 30;

function requireAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
  if (String(request.auth.token.email || "").toLowerCase() !== ADMIN_EMAIL) throw new HttpsError("permission-denied", "Only the admin can do this.");
}

/** The circular as something the AI can read: a PDF document, or the spreadsheet turned into text. */
async function contentFor(circ) {
  const [buffer] = await admin.storage().bucket().file(circ.storagePath).download();
  const kind = L.fileKind(circ.fileName, circ.storagePath);
  if (kind === "pdf") {
    if (buffer.length > 28 * 1024 * 1024) throw new HttpsError("invalid-argument", "This PDF is too large to read (28 MB limit).");
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } };
  }
  if (kind === "sheet") {
    const wb = XLSX.read(buffer, { type: "buffer" });
    let text = "";
    for (const name of wb.SheetNames) text += `### Sheet: ${name}\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}\n\n`;
    return { type: "text", text: `The document is a spreadsheet, shown here as text (one block per sheet):\n\n${text.slice(0, MAX_SHEET_CHARS)}` };
  }
  throw new HttpsError("invalid-argument", "Only PDF and Excel circulars can be read automatically.");
}

async function askOnce(apiKey, system, content, userText) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 12000, system, messages: [{ role: "user", content: [content, { type: "text", text: userText }] }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("carrier reader: AI request failed", res.status, body.slice(0, 300));
    throw new HttpsError("unavailable", "The AI service did not answer. Try again in a minute.");
  }
  const payload = await res.json();
  const raw = (payload.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let parsed = null;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    const a = stripped.indexOf("{");
    const b = stripped.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        parsed = JSON.parse(stripped.slice(a, b + 1));
      } catch {
        /* handled below */
      }
    }
  }
  return { parsed, usage: payload.usage || {}, truncated: payload.stop_reason === "max_tokens" };
}

/** { circularId, dryRun? } -> what was applied, held and unchanged. dryRun reads and checks but writes nothing. */
exports.readCarrierCircular = onCall({ invoker: "public", secrets: [anthropicApiKey], timeoutSeconds: 540, memory: "1GiB" }, async (request) => {
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

  const content = await contentFor(circ);
  const fallback = /^[A-Za-z0-9]{2,3}$/.test(String(circ.carrier || "").trim()) ? circ.carrier : "";
  const userText = `This document is "${circ.title || circ.fileName || ""}"${circ.carrier ? ` from ${circ.carrier}` : ""}. Extract every route's weight-break rates as instructed.`;
  const [sysA, sysB] = L.systemPrompts();
  const [a, b] = await Promise.all([askOnce(apiKey, sysA, content, userText), askOnce(apiKey, sysB, content, userText)]);
  const problems = [];
  if (!a.parsed || !b.parsed) problems.push("One of the two reads could not be understood, so nothing was applied.");
  if (a.truncated || b.truncated) problems.push("The circular is so long that a read was cut short, so nothing was applied.");
  const readA = L.normalizeRows(a.parsed, fallback);
  const readB = L.normalizeRows(b.parsed, fallback);

  const carriers = [...new Set([...readA, ...readB].map((r) => r.carrierCode).filter(Boolean))].slice(0, 10);
  const onFile = [];
  if (carriers.length) {
    const stored = await db.collection("carrierTariffs").where("carrierCode", "in", carriers).get();
    stored.forEach((d) => onFile.push(d.data()));
  }
  const result = problems.length ? { apply: [], hold: [{ row: {}, reasons: problems }], unchanged: [] } : decide(readA, readB, onFile);

  const now = Date.now();
  const usage = { input: (a.usage.input_tokens || 0) + (b.usage.input_tokens || 0), output: (a.usage.output_tokens || 0) + (b.usage.output_tokens || 0) };
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
  return { ...summary, holdDetails: result.hold.slice(0, 20).map((h) => ({ route: h.row.origin ? `${h.row.carrierCode} ${h.row.origin}→${h.row.destination} ${h.row.currency || "?"}` : "", reasons: h.reasons })), sample: result.apply.slice(0, 3) };
});
