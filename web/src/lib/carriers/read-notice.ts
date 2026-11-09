/**
 * What the app tells the person who uploaded a circular, in plain words, as the automatic read moves along.
 * Pure: the screen decides where to show it.
 */
export interface ReadLike {
  status: "reading" | "read" | "skipped" | "failed";
  kind: "rates" | "digest";
  title: string;
  reason: string;
  applied: number;
  held: number;
  points: number;
  charges: number;
}

export interface Notice {
  tone: "success" | "error" | "info";
  text: string;
}

export function noticeFor(r: ReadLike): Notice {
  const name = r.title ? `\u201c${r.title}\u201d` : "Your circular";
  if (r.status === "reading") return { tone: "info", text: `Reading ${name} now. It takes a few minutes, and I will tell you here when it is done.` };
  if (r.status === "failed") return { tone: "error", text: `Could not read ${name}: ${r.reason || "the read did not finish"}. The file is saved. Check the file, or upload it again.` };
  if (r.status === "skipped") return { tone: "info", text: `${name} is saved but was not read yet: ${r.reason}` };
  if (r.kind === "digest") return { tone: "success", text: `${name} has been read. Open Circulars and press \u201cWhat it says\u201d under it.` };
  const held = r.held ? `, ${r.held} held for checking and still on their old rate` : "";
  return { tone: "success", text: `Rates from ${name} are on the Carrier board and in the Air desk: ${r.applied} saved${held}.` };
}

/** One line for the circular's own row (no quotes needed there). */
export function statusLine(r: ReadLike | undefined): { tone: "success" | "error" | "info" | "muted"; text: string } | null {
  if (!r) return null;
  if (r.status === "reading") return { tone: "info", text: "Reading… a few minutes" };
  if (r.status === "failed") return { tone: "error", text: `Could not be read: ${r.reason || "the read did not finish"}` };
  if (r.status === "skipped") return { tone: "muted", text: `Not read yet: ${r.reason}` };
  if (r.kind === "digest") return { tone: "success", text: "Read" };
  return { tone: "success", text: `Rates read: ${r.applied} saved${r.held ? `, ${r.held} held for checking` : ""}` };
}
