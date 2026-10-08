/**
 * Reads a contacts workbook (the weekly Overseas Agents list, vendor sheets…) the way the original
 * app did: every sheet is read, the header row can sit below title rows, column names are matched by
 * what they contain ("Reliable Agent", "Contact Number", "Country" …), and the sheet's own name
 * decides what kind of contact each row is. Pure — the caller hands in plain rows.
 */
import type { DirectoryContactInput } from "@/lib/firebase/directory";

export type SheetData = { name: string; rows: unknown[][] };

export type ParsedWorkbook = {
  contacts: DirectoryContactInput[];
  /** One line per sheet, so a failed read can say what it actually found. */
  sheets: Array<{ name: string; headers: string[]; contacts: number }>;
};

const cell = (v: unknown): string => (v == null ? "" : String(v).trim());

/** What a sheet's tab name says its rows are. */
export function categoryForSheet(sheetName: string, fallback: string): string {
  const lower = sheetName.toLowerCase();
  const norm = lower.replace(/[^a-z0-9]/g, "");
  if (lower.includes("suspend")) return "agency";
  if (norm.includes("liner")) return "liner";
  if (norm.includes("coloader")) return "coloader";
  if (norm.includes("nvocc")) return "nvocc";
  if (norm.includes("breakbulk")) return "breakbulk";
  if (lower.includes("air") && (lower.includes("line") || lower.includes("contact"))) return "airline";
  if (norm.includes("pq") || norm.includes("phyto")) return "pq";
  if (lower.includes("insurance")) return "insurance";
  if (lower.includes("agent") || lower.includes("agency")) return "agency";
  return fallback;
}

function categoryFromValue(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("liner")) return "liner";
  if (v.includes("coloader")) return "coloader";
  if (v.includes("nvocc")) return "nvocc";
  if (v.includes("break")) return "breakbulk";
  if (v.includes("air")) return "airline";
  if (v.includes("pq")) return "pq";
  if (v.includes("insurance")) return "insurance";
  if (v.includes("agency") || v.includes("agent")) return "agency";
  return "other";
}

/** Title rows above the real header are skipped: the header is the first of the top 15 rows with 2+ filled cells. */
function headerRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (rows[i].filter((v) => cell(v) !== "").length >= 2) return i;
  }
  return 0;
}

export function parseDirectorySheets(sheets: SheetData[], fallbackCategory: string): ParsedWorkbook {
  const contacts: DirectoryContactInput[] = [];
  const summary: ParsedWorkbook["sheets"] = [];

  for (const sheet of sheets) {
    const rows = sheet.rows ?? [];
    if (!rows.length) {
      summary.push({ name: sheet.name, headers: [], contacts: 0 });
      continue;
    }
    const hi = headerRowIndex(rows);
    const headers = (rows[hi] ?? []).map(cell);
    const autoCategory = categoryForSheet(sheet.name, fallbackCategory);
    const suspendedSheet = sheet.name.toLowerCase().includes("suspend");
    let count = 0;

    for (const r of rows.slice(hi + 1)) {
      let name = "";
      let person = "";
      let email = "";
      let phone = "";
      let location = "";
      let notes = "";
      let agreement = "";
      let rating: number | undefined;
      let creditTerms = "";
      let moduleType = "";
      let category = autoCategory;

      headers.forEach((h, ci) => {
        if (!h) return;
        const value = r[ci];
        const key = h.toLowerCase().replace(/[^a-z0-9]/g, "");
        // "Agency Agreement" would otherwise be taken for the name column, so these four come first.
        if (key.includes("rating")) {
          const stars = (cell(value).match(/★/g) || []).length;
          rating = stars || (Number.isFinite(Number(value)) && cell(value) !== "" ? Number(value) : undefined);
        } else if (key.includes("agreement")) agreement = cell(value);
        else if (key.includes("credit")) creditTerms = creditTerms ? `${creditTerms}; ${cell(value)}` : cell(value);
        else if (key.includes("module")) moduleType = cell(value);
        else if (
          key.includes("company") || key.includes("name") || key.includes("liner") || key.includes("airline") ||
          key.includes("agency") || key.includes("coloader") || key.includes("agent")
        ) {
          if (!name) name = cell(value);
        } else if (key.includes("person") || key.includes("contactname") || key.includes("attention")) person = cell(value);
        else if (key.includes("email") || key.includes("mail")) email = cell(value);
        else if (
          key.includes("phone") || key.includes("mobile") || key.includes("contactno") ||
          key.includes("contactnumber") || key === "contact" || key.includes("tel") || key.includes("landline")
        ) phone = cell(value);
        else if (
          key.includes("location") || key.includes("city") || key.includes("address") ||
          key.includes("branch") || key.includes("station") || key.includes("country")
        ) location = cell(value);
        else if (key.includes("notes") || key.includes("remarks") || key.includes("comments") || key.includes("rates")) notes = cell(value);
        else if (key.includes("category") || key.includes("type")) category = categoryFromValue(cell(value));
      });

      if (!name) continue;
      const contact: DirectoryContactInput = {
        name,
        category,
        contactPerson: person,
        email,
        phone,
        location,
        notes,
        sheetGroup: sheet.name.trim(),
        agreement,
        suspended: suspendedSheet,
      };
      if (rating !== undefined) contact.rating = rating;
      if (creditTerms) contact.creditTerms = creditTerms;
      if (moduleType) contact.moduleType = moduleType;
      contacts.push(contact);
      count += 1;
    }
    summary.push({ name: sheet.name, headers: headers.filter(Boolean), contacts: count });
  }
  return { contacts, sheets: summary };
}

/** Said to the user when nothing could be read: what the file looked like, and what is needed. */
export function describeUnreadableWorkbook(parsed: ParsedWorkbook): string {
  const seen = parsed.sheets
    .map((s) => `"${s.name}": ${s.headers.length ? s.headers.slice(0, 8).join(", ") : "(empty)"}`)
    .join(" · ");
  return `No contacts could be read from this file. It needs a column holding each company's name (for example Name, Company, Agent or Agency). What I found — ${seen || "no sheets"}.`;
}
