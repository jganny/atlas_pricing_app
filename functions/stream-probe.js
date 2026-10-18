// TEMPORARY: finds which response style actually streams through Google's front end. Delete after use.
const functions = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(req, res) {
  const v = String(req.query.v || "a");
  res.set("Access-Control-Allow-Origin", "*");
  if (v === "b") res.set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" });
  else res.set({ "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" });
  if (v === "d") res.set("Content-Encoding", "identity");
  res.status(200);
  if (v === "c") res.write(" ".repeat(4096) + "\n");
  for (let i = 1; i <= 5; i++) {
    res.write(v === "b" ? `data: {"i":${i}}\n\n` : JSON.stringify({ i }) + "\n");
    if (typeof res.flush === "function") res.flush();
    await sleep(1000);
  }
  res.end();
}
exports.streamProbeGen1 = functions.runWith({ timeoutSeconds: 30 }).https.onRequest(run);
exports.streamProbeGen2 = onRequest({ timeoutSeconds: 30, invoker: "public", cors: true }, run);
