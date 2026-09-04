/** NRS confirmation intimations — local mirror of legacy nrs_alerts. */

const KEY = "atlas_nrs_alerts";

export type NrsAlert = {
  id: string;
  date: string;
  message: string;
  quoteRef?: string;
  dismissed?: boolean;
};

export function listNrsAlerts(): NrsAlert[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
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
  localStorage.setItem(KEY, JSON.stringify([row, ...listNrsAlerts()].slice(0, 50)));
  return row;
}

export function dismissNrsAlert(id: string) {
  localStorage.setItem(
    KEY,
    JSON.stringify(listNrsAlerts().map((a) => (a.id === id ? { ...a, dismissed: true } : a))),
  );
}
