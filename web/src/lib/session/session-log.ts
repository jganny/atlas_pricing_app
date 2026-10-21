/**
 * Sign-in and activity tracking. "Active" means the person really used the app: a click, a key press, a scroll or a
 * touch in the last two minutes, in a tab that is on screen. A tab left open and untouched earns nothing, and a
 * stretch of 10 minutes or more with no use is recorded as idle. Only the fact that activity happened is kept —
 * never what was typed or clicked.
 */

export const TICK_MS = 15_000;
export const HEARTBEAT_MS = 120_000;
export const ACTIVE_WINDOW_MS = 120_000;
export const IDLE_GAP_MS = 10 * 60_000;
export const SESSION_REUSE_MS = 30 * 60_000;
/** A session longer than this with little use, or with a very long idle stretch, is flagged. */
export const FLAG_MIN_SPAN_MS = 2 * 3_600_000;
export const FLAG_LOW_RATIO = 0.25;
export const FLAG_LONG_IDLE_MIN = 60;

export interface ActivitySnapshot {
  activeSec: number;
  idleMin: number;
  longestIdleMin: number;
}

export class ActivityClock {
  private lastInteraction: number;
  private lastTick: number;
  private activeMs = 0;
  private idleMs = 0;
  private longestIdleMs = 0;

  constructor(now = Date.now()) {
    this.lastInteraction = now;
    this.lastTick = now;
  }

  /** Call on every click, key press, scroll or touch. */
  interaction(now = Date.now()): void {
    const gap = now - this.lastInteraction;
    if (gap >= IDLE_GAP_MS) {
      this.idleMs += gap;
      this.longestIdleMs = Math.max(this.longestIdleMs, gap);
    }
    this.lastInteraction = now;
  }

  /** Call every TICK_MS. `onScreen` = the tab is visible and focused. */
  tick(now = Date.now(), onScreen = true): void {
    // A laptop that slept or a throttled tab must not credit the time it was away.
    const dt = Math.min(Math.max(0, now - this.lastTick), TICK_MS * 2);
    this.lastTick = now;
    if (onScreen && now - this.lastInteraction <= ACTIVE_WINDOW_MS) this.activeMs += dt;
  }

  snapshot(now = Date.now()): ActivitySnapshot {
    // An idle stretch still in progress counts as soon as it passes the threshold.
    const ongoing = now - this.lastInteraction;
    const open = ongoing >= IDLE_GAP_MS ? ongoing : 0;
    return {
      activeSec: Math.round(this.activeMs / 1000),
      idleMin: Math.round((this.idleMs + open) / 60_000),
      longestIdleMin: Math.round(Math.max(this.longestIdleMs, open) / 60_000),
    };
  }
}

export interface SessionRow {
  id: string;
  login: string;
  startMs: number;
  /** When the app last saw the person. */
  lastSeenMs: number;
  endMs?: number;
  endReason?: string;
  activeSec: number;
  idleMin: number;
  longestIdleMin: number;
}

export interface OutputCounts {
  quotes: number;
  updates: number;
  visits: number;
  leads: number;
}

export const EMPTY_OUTPUT: OutputCounts = { quotes: 0, updates: 0, visits: 0, leads: 0 };
export const outputTotal = (o: OutputCounts) => o.quotes + o.updates + o.visits + o.leads;

/** The India calendar day (YYYY-MM-DD) of a moment. */
export function istDay(ms: number): string {
  return new Date(ms + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

export interface AuditLike {
  actor: string;
  action: string;
  atIso: string;
}

/** Counts a person's work from the audit log: quotes made, quotes amended or moved on, visits, leads. */
export function outputByPersonDay(rows: AuditLike[]): Map<string, OutputCounts> {
  const out = new Map<string, OutputCounts>();
  for (const r of rows) {
    const at = Date.parse(r.atIso);
    if (Number.isNaN(at)) continue;
    const key = `${r.actor.toLowerCase()}|${istDay(at)}`;
    const cur = out.get(key) ?? { ...EMPTY_OUTPUT };
    if (r.action === "quote.save") cur.quotes += 1;
    else if (r.action === "quote.update") cur.updates += 1;
    else if (r.action === "lead.visit") cur.visits += 1;
    else if (r.action.startsWith("lead.") && r.action !== "lead.visit.delete") cur.leads += 1;
    else continue;
    out.set(key, cur);
  }
  return out;
}

export interface DayRow {
  login: string;
  day: string;
  firstInMs: number;
  /** Sign-out time, or — if the browser was just closed — when the app last saw the person. */
  lastMs: number;
  signedOut: boolean;
  sessions: number;
  spanMin: number;
  activeMin: number;
  idleMin: number;
  longestIdleMin: number;
  output: OutputCounts;
  flags: string[];
}

export function flagsFor(r: Pick<DayRow, "spanMin" | "activeMin" | "longestIdleMin" | "output">): string[] {
  const flags: string[] = [];
  const spanMs = r.spanMin * 60_000;
  if (spanMs >= FLAG_MIN_SPAN_MS && r.activeMin / Math.max(1, r.spanMin) < FLAG_LOW_RATIO) flags.push("Low activity");
  if (r.longestIdleMin >= FLAG_LONG_IDLE_MIN) flags.push(`Idle ${Math.floor(r.longestIdleMin / 60)}h+`);
  if (spanMs >= FLAG_MIN_SPAN_MS && outputTotal(r.output) === 0) flags.push("No output");
  return flags;
}

/** One row per person per day, newest first. */
export function dayRows(sessions: SessionRow[], output: Map<string, OutputCounts>): DayRow[] {
  const groups = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const key = `${s.login.toLowerCase()}|${istDay(s.startMs)}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const rows: DayRow[] = [];
  for (const [key, list] of groups) {
    const [login, day] = key.split("|");
    const sorted = [...list].sort((a, b) => a.startMs - b.startMs);
    const last = sorted[sorted.length - 1];
    const lastMs = last.endMs ?? last.lastSeenMs;
    const row: DayRow = {
      login,
      day,
      firstInMs: sorted[0].startMs,
      lastMs,
      signedOut: !!last.endMs,
      sessions: list.length,
      spanMin: Math.max(0, Math.round((lastMs - sorted[0].startMs) / 60_000)),
      activeMin: Math.round(list.reduce((n, s) => n + s.activeSec, 0) / 60),
      idleMin: list.reduce((n, s) => n + s.idleMin, 0),
      longestIdleMin: Math.max(...list.map((s) => s.longestIdleMin)),
      output: output.get(key) ?? { ...EMPTY_OUTPUT },
      flags: [],
    };
    row.flags = flagsFor(row);
    rows.push(row);
  }
  return rows.sort((a, b) => b.day.localeCompare(a.day) || a.login.localeCompare(b.login));
}

export function formatHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} m` : `${m} m`;
}

export function clock(ms: number): string {
  return new Date(ms + 5.5 * 3_600_000).toISOString().slice(11, 16);
}

/** CSV for HR: one line per person per day. */
export function toCsv(rows: DayRow[], nameOf: (login: string) => string): string {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["Person", "Date", "Signed in", "Signed out / last active", "Sign-out type", "Time (min)", "Active (min)", "Longest idle (min)", "Quotes", "Updates", "Visits", "Leads", "Flags"];
  const lines = rows.map((r) =>
    [nameOf(r.login), r.day, clock(r.firstInMs), clock(r.lastMs), r.signedOut ? "signed out" : "last active", r.spanMin, r.activeMin, r.longestIdleMin, r.output.quotes, r.output.updates, r.output.visits, r.output.leads, r.flags.join("; ")].map(q).join(","),
  );
  return [head.map(q).join(","), ...lines].join("\n");
}
