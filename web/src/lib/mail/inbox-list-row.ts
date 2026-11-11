/** Clock time if the mail arrived today, otherwise a short date — Outlook list style. */
export function inboxListWhen(iso: string | undefined | null, now: number = Date.now()): string {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const zone = "Asia/Kolkata";
  const day = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { timeZone: zone });
  if (day(t) === day(now)) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zone });
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: zone });
}

/** One quiet preview line: lane, mode, then the email's own words. No chips. */
export function inboxListPreview(row: {
  parsed?: { origin?: string | null; destination?: string | null } | null;
  bodyPreview?: string | null;
  body?: string | null;
  mode?: string | null;
}): string {
  const origin = row.parsed?.origin?.trim();
  const dest = row.parsed?.destination?.trim();
  const lane = origin && dest ? `${origin} → ${dest}` : "";
  const mode = row.mode === "sea" ? "Sea" : row.mode === "air" ? "Air" : "";
  const text = (row.bodyPreview || row.body || "").replace(/\s+/g, " ").trim();
  return [lane, mode, text].filter(Boolean).join(" · ");
}
