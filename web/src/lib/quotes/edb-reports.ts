/** FY / period financial buckets for Enquiry DB report cards. */

import type { EnquiryRecord } from "@/lib/types";
import { summarizeEnquiryFinancials } from "@/lib/quotes/edb-csv";

export type FyBucket = {
  id: string;
  label: string;
  from: Date;
  to: Date;
  count: number;
  sell: number;
  gp: number;
};

function fyStart(d = new Date()): Date {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(y, 3, 1);
}

function inRange(row: EnquiryRecord, from: Date, to: Date): boolean {
  const raw = row.createdAt || "";
  if (!raw) return true;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return true;
  return t >= from.getTime() && t <= to.getTime();
}

export function buildFyReportCards(rows: EnquiryRecord[], now = new Date()): FyBucket[] {
  const start = fyStart(now);
  const buckets: Array<{ id: string; label: string; from: Date; to: Date }> = [];
  for (let q = 0; q < 4; q++) {
    const from = new Date(start.getFullYear(), start.getMonth() + q * 3, 1);
    const to = new Date(start.getFullYear(), start.getMonth() + (q + 1) * 3, 0, 23, 59, 59, 999);
    buckets.push({ id: `q${q + 1}`, label: `FY Q${q + 1}`, from, to });
  }
  const ytdTo = new Date(now);
  ytdTo.setHours(23, 59, 59, 999);
  buckets.push({ id: "ytd", label: "FY YTD", from: start, to: ytdTo });

  return buckets.map((b) => {
    const slice = rows.filter((r) => inRange(r, b.from, b.to));
    const fin = summarizeEnquiryFinancials(slice);
    return {
      ...b,
      count: slice.length,
      sell: fin.revenue,
      gp: fin.gp,
    };
  });
}

const ARCHIVE_KEY = "atlas_archive_quotes_local";

export function listLocalArchive(): EnquiryRecord[] {
  try {
    return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function archiveOlderThan(rows: EnquiryRecord[], days = 90): {
  archived: EnquiryRecord[];
  remaining: EnquiryRecord[];
} {
  const cut = Date.now() - days * 86400000;
  const archived: EnquiryRecord[] = [];
  const remaining: EnquiryRecord[] = [];
  for (const r of rows) {
    const t = new Date(r.createdAt || 0).getTime();
    if (t && t < cut) archived.push(r);
    else remaining.push(r);
  }
  const prev = listLocalArchive();
  const merged = [...archived, ...prev.filter((p) => !archived.some((a) => a.id === p.id))].slice(
    0,
    200,
  );
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(merged));
  return { archived, remaining };
}
