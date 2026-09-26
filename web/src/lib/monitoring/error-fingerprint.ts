/** Pure helpers for error monitoring: grouping, noise filtering and flood protection. */

const MAX_MESSAGE = 500;
const MAX_STACK = 1800;

export function clipText(s: string | undefined | null, n: number): string {
  const v = (s || "").trim();
  return v.length > n ? `${v.slice(0, n - 1)}…` : v;
}

export function cleanMessage(m: unknown): string {
  return clipText(typeof m === "string" ? m : m instanceof Error ? m.message : String(m ?? ""), MAX_MESSAGE);
}

export function cleanStack(s: unknown): string {
  return clipText(typeof s === "string" ? s : "", MAX_STACK);
}

/**
 * Strips what changes between builds/users so the same bug groups together:
 * hashed asset file names, line:column numbers, query strings and long numbers/ids.
 */
export function normalizeForGrouping(text: string): string {
  return text
    .replace(/https?:\/\/[^\s)]+?\/([A-Za-z0-9_.-]+\.js)/g, "$1")
    .replace(/[A-Za-z0-9_-]{8,}\.js/g, "chunk.js")
    .replace(/:\d+:\d+/g, "")
    .replace(/\?[^\s)]*/g, "")
    .replace(/\b[0-9a-f]{8,}\b/gi, "#")
    .replace(/\d{3,}/g, "#")
    .trim();
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Stable id for "the same error": normalized message + the first stack frame's function name. */
export function fingerprintOf(message: string, stack?: string): string {
  const firstFrame = (stack || "").split("\n").find((l) => /\bat\b|@/.test(l)) || "";
  return djb2(`${normalizeForGrouping(message)}|${normalizeForGrouping(firstFrame)}`);
}

/** Browser/extension noise that is not our bug and would drown real errors. */
export function isIgnorableError(message: string, stack = ""): boolean {
  const m = message.toLowerCase();
  if (!m) return true;
  if (m.includes("resizeobserver loop")) return true; // harmless browser notice
  if (m === "script error." || m === "script error") return true; // cross-origin, no detail
  if (m.includes("network error") && m.includes("firebase")) return true; // transient offline
  if (/chrome-extension:|moz-extension:|safari-extension:|safari-web-extension:/.test(stack)) return true;
  if (m.includes("non-error promise rejection")) return true;
  return false;
}

/** A tab loaded before a deploy asking for files that no longer exist — cured by one reload. */
export function isStaleAssetError(message: string): boolean {
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Unexpected token '<'|error loading dynamically imported module/i.test(
    message,
  );
}

export interface LimiterStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/**
 * Flood protection: at most `perSession` reports per tab, and the same error at
 * most once per `perFingerprintMs` — so a render loop cannot write thousands of documents.
 */
export function createLimiter(store: LimiterStore, opts = { perSession: 15, perFingerprintMs: 10 * 60_000 }) {
  return function allow(fingerprint: string, now: number = Date.now()): boolean {
    const count = Number(store.get("count") || 0);
    if (count >= opts.perSession) return false;
    const lastRaw = store.get(`fp:${fingerprint}`);
    if (lastRaw !== null && now - Number(lastRaw) < opts.perFingerprintMs) return false;
    store.set("count", String(count + 1));
    store.set(`fp:${fingerprint}`, String(now));
    return true;
  };
}
