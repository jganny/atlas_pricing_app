/** NRS confirmation intimations + follow-up registry (localStorage). */

const ALERTS_KEY = "atlas_nrs_alerts";
const FOLLOWUPS_KEY = "atlas_nrs_followups";

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
  return row;
}

export function dismissNrsAlert(id: string) {
  localStorage.setItem(
    ALERTS_KEY,
    JSON.stringify(listNrsAlerts().map((a) => (a.id === id ? { ...a, dismissed: true } : a))),
  );
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
  const existing = listNrsFollowUps().filter(
    (f) => !(f.quoteId === row.quoteId && f.status === "pending"),
  );
  persistFollowUps([row, ...existing]);
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
  return next;
}

export function listPendingNrsFollowUps(): NrsFollowUp[] {
  return listNrsFollowUps().filter((f) => f.status === "pending");
}
