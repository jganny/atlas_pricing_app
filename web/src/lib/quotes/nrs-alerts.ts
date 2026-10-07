/**
 * NRS confirmation intimations + follow-up registry.
 *
 * These belong to the NRS desk, not to a person or a browser. Reads are served
 * from a local copy (fast, works offline); in live mode `setNrsMirror` connects
 * writes to the shared database and `applyRemoteNrs*` refreshes the copy from
 * it, so whoever sits at the desk — on any computer — sees the same queue.
 */

const ALERTS_KEY = "atlas_nrs_alerts";
const FOLLOWUPS_KEY = "atlas_nrs_followups";
const ALERTS_SYNCED_KEY = "atlas_nrs_alerts_shared_v1";
const FOLLOWUPS_SYNCED_KEY = "atlas_nrs_followups_shared_v1";
export const NRS_CHANGED_EVENT = "atlas:nrs-changed";

export type NrsMirror = {
  saveFollowUp: (row: NrsFollowUp) => void;
  removeFollowUp: (id: string) => void;
  saveAlert: (row: NrsAlert) => void;
};

let mirror: NrsMirror | null = null;

/** Live mode only: connects local writes to the shared database (null disconnects). */
export function setNrsMirror(next: NrsMirror | null) {
  mirror = next;
}

function notifyChanged() {
  try {
    window.dispatchEvent(new Event(NRS_CHANGED_EVENT));
  } catch {
    /* no window (tests / server) */
  }
}

export type NrsAlert = {
  id: string;
  date: string;
  message: string;
  quoteRef?: string;
  dismissed?: boolean;
};

export type NrsFollowUpStatus = "pending" | "complete";

export type NrsFollowUp = {
  id: string;
  quoteId: string;
  ref: string;
  customer: string;
  buyRate: number;
  sellRate: number;
  shipper: string;
  consignee: string;
  commodity: string;
  status: NrsFollowUpStatus;
  notes: string;
  followUpDate: string;
  createdAt: string;
  updatedAt: string;
};

export function listNrsAlerts(): NrsAlert[] {
  try {
    return JSON.parse(localStorage.getItem(ALERTS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function pushNrsAlert(message: string, quoteRef?: string) {
  const row: NrsAlert = {
    id: `nrs-${Date.now()}`,
    date: new Date().toISOString(),
    message,
    quoteRef,
    dismissed: false,
  };
  localStorage.setItem(ALERTS_KEY, JSON.stringify([row, ...listNrsAlerts()].slice(0, 50)));
  mirror?.saveAlert(row);
  return row;
}

export function dismissNrsAlert(id: string) {
  const next = listNrsAlerts().map((a) => (a.id === id ? { ...a, dismissed: true } : a));
  localStorage.setItem(ALERTS_KEY, JSON.stringify(next));
  const row = next.find((a) => a.id === id);
  if (row) mirror?.saveAlert(row);
}

export function listNrsFollowUps(): NrsFollowUp[] {
  try {
    return JSON.parse(localStorage.getItem(FOLLOWUPS_KEY) || "[]") as NrsFollowUp[];
  } catch {
    return [];
  }
}

function persistFollowUps(rows: NrsFollowUp[]) {
  localStorage.setItem(FOLLOWUPS_KEY, JSON.stringify(rows.slice(0, 200)));
}

export function pushNrsFollowUp(input: {
  quoteId: string;
  ref: string;
  customer: string;
  buyRate?: number;
  sellRate?: number;
  shipper?: string;
  consignee?: string;
  commodity?: string;
  notes?: string;
  followUpDate?: string;
}): NrsFollowUp {
  const now = new Date().toISOString();
  const row: NrsFollowUp = {
    id: `nrsfu-${Date.now()}`,
    quoteId: input.quoteId,
    ref: input.ref,
    customer: input.customer,
    buyRate: input.buyRate ?? 0,
    sellRate: input.sellRate ?? 0,
    shipper: input.shipper ?? "",
    consignee: input.consignee ?? "",
    commodity: input.commodity ?? "",
    status: "pending",
    notes: input.notes ?? "",
    followUpDate: input.followUpDate ?? now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
  };
  const all = listNrsFollowUps();
  const replaced = all.filter((f) => f.quoteId === row.quoteId && f.status === "pending");
  const existing = all.filter((f) => !(f.quoteId === row.quoteId && f.status === "pending"));
  persistFollowUps([row, ...existing]);
  replaced.forEach((f) => mirror?.removeFollowUp(f.id));
  mirror?.saveFollowUp(row);
  return row;
}

export function updateNrsFollowUp(
  id: string,
  patch: Partial<
    Pick<
      NrsFollowUp,
      | "shipper"
      | "consignee"
      | "commodity"
      | "notes"
      | "followUpDate"
      | "status"
      | "buyRate"
      | "sellRate"
    >
  >,
): NrsFollowUp | null {
  const rows = listNrsFollowUps();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const next = {
    ...rows[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  rows[idx] = next;
  persistFollowUps(rows);
  mirror?.saveFollowUp(next);
  return next;
}

export function listPendingNrsFollowUps(): NrsFollowUp[] {
  return listNrsFollowUps().filter((f) => f.status === "pending");
}

function readList<T>(key: string): T[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(raw) ? (raw as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Refreshes the local copy from the shared database. The first time a browser
 * connects, anything only it has (follow-ups saved before they were shared —
 * e.g. the NRS person's existing list) is copied up so nothing is lost; after
 * that the shared list is the single source of truth.
 */
function applyRemote<T extends { id: string }>(
  remote: T[],
  key: string,
  syncedKey: string,
  cap: number,
  newestFirst: (a: T, b: T) => number,
  save: ((row: T) => void) | undefined,
) {
  let merged = remote;
  if (!localStorage.getItem(syncedKey)) {
    const remoteIds = new Set(remote.map((r) => r.id));
    const localOnly = readList<T>(key).filter((r) => !remoteIds.has(r.id));
    localOnly.forEach((r) => save?.(r));
    merged = [...remote, ...localOnly];
    localStorage.setItem(syncedKey, "1");
  }
  localStorage.setItem(key, JSON.stringify([...merged].sort(newestFirst).slice(0, cap)));
  notifyChanged();
}

export function applyRemoteNrsFollowUps(remote: NrsFollowUp[]) {
  applyRemote(
    remote,
    FOLLOWUPS_KEY,
    FOLLOWUPS_SYNCED_KEY,
    200,
    (a, b) => b.createdAt.localeCompare(a.createdAt),
    mirror?.saveFollowUp,
  );
}

export function applyRemoteNrsAlerts(remote: NrsAlert[]) {
  applyRemote(
    remote,
    ALERTS_KEY,
    ALERTS_SYNCED_KEY,
    50,
    (a, b) => b.date.localeCompare(a.date),
    mirror?.saveAlert,
  );
}
