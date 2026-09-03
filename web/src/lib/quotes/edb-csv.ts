import type { EnquiryRecord } from "@/lib/types";
import { computeBuyTotal, gpNumeric } from "@/lib/quotes/edb-metrics";
import { deskDisplayName } from "@/lib/quotes/team-roles";

const CSV_HEADERS = [
  "Ref ID",
  "Date",
  "Mode",
  "Customer",
  "Route",
  "Creator",
  "Carrier",
  "Buy Rate",
  "Sell Rate",
  "GP",
  "Status",
] as const;

function csvEscape(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Legacy-compatible CSV of the current filtered Enquiry DB view. */
export function buildEnquiryCsv(rows: EnquiryRecord[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    const buy = computeBuyTotal(row) ?? 0;
    const sell = row.grandTotal ?? 0;
    const gp = gpNumeric(row) ?? sell - buy;
    const route = `${row.origin} → ${row.destination}`.replace(/,/g, " ");
    const customer = (row.customer || "").replace(/,/g, " ");
    lines.push(
      [
        csvEscape(row.ref || row.id),
        csvEscape(row.createdAt || ""),
        csvEscape(row.mode),
        csvEscape(customer),
        csvEscape(route),
        csvEscape(deskDisplayName(row.creator || row.assignee)),
        csvEscape((row.carrier || "").replace(/,/g, " ")),
        csvEscape(buy),
        csvEscape(sell),
        csvEscape(gp),
        csvEscape(row.status),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function downloadEnquiryCsv(rows: EnquiryRecord[], filename?: string): void {
  const csv = buildEnquiryCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `atlas-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function summarizeEnquiryFinancials(rows: EnquiryRecord[]) {
  let revenue = 0;
  let buy = 0;
  let gp = 0;
  for (const row of rows) {
    const sellInr = row.amountINR ?? row.grandTotal ?? 0;
    const buyTotal = computeBuyTotal(row);
    const gpVal = gpNumeric(row);
    revenue += sellInr;
    if (gpVal != null && row.amountINR != null) {
      buy += sellInr - gpVal;
      gp += gpVal;
    } else if (buyTotal != null) {
      buy += buyTotal;
      gp += (row.grandTotal ?? 0) - buyTotal;
    } else if (gpVal != null) {
      gp += gpVal;
      buy += (row.grandTotal ?? 0) - gpVal;
    }
  }
  return { count: rows.length, revenue, buy, gp };
}
