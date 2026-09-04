/** Calc audit trail — SAP-style snapshot of how a quote total was derived. */

export type CalcAuditEntry = {
  at: number;
  quoteId?: string;
  type: string;
  steps: Array<{ label: string; value: string | number }>;
};

const KEY = "atlas_calc_audit_v1";

export function appendCalcAudit(entry: Omit<CalcAuditEntry, "at">) {
  try {
    const rows: CalcAuditEntry[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    rows.unshift({ ...entry, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 80)));
  } catch {
    /* ignore */
  }
}

export function listCalcAudits(quoteId?: string): CalcAuditEntry[] {
  try {
    const rows: CalcAuditEntry[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!quoteId) return rows;
    return rows.filter((r) => r.quoteId === quoteId);
  } catch {
    return [];
  }
}
