/**
 * Unfinished-quote drafts. A desk saves what is on screen in this browser as the user works, so a
 * power cut or crash costs nothing: when the desk is opened again it offers to resume. Drafts are
 * per desk and per person, and live only on that computer.
 */

export type DraftEnvelope<T> = { v: 1; savedAt: string; summary: string; state: T };

export function draftKey(desk: string, username: string | undefined | null): string {
  return `atlas_draft_v1_${desk}_${(username || "anon").toLowerCase()}`;
}

/**
 * A comparable fingerprint of what the user has entered: internal ids (random on every visit) and
 * which step/tab is showing don't count, so an untouched form always looks the same.
 */
export function draftFingerprint(state: unknown): string {
  return JSON.stringify(state, (key, value) =>
    key === "id" || /Id$/.test(key) || key === "step" || key === "tab" ? undefined : value,
  );
}

export function readDraft<T>(key: string): DraftEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    return parsed && parsed.v === 1 && parsed.state ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, envelope: DraftEnvelope<T>): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false; // storage full or blocked — never interrupts the user
  }
}

export function removeDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

/** "today 3:42 pm", "yesterday 9:05 am", or the date. */
export function draftAgeLabel(savedAt: string, now: Date = new Date()): string {
  const d = new Date(savedAt);
  if (Number.isNaN(d.getTime())) return "earlier";
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((day(now) - day(d)) / 86_400_000);
  if (diffDays === 0) return `today ${time}`;
  if (diffDays === 1) return `yesterday ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${time}`;
}
