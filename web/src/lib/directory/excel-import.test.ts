import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import type { DirectoryContact } from "../types";
import { planAgencyImport } from "../quotes/agent-import";
import { categoryForSheet, describeUnreadableWorkbook, parseDirectorySheets } from "./excel-import";

// A weekly report like the real one: title rows above the header, differently worded columns, ★ ratings,
// an agents tab and a suspended tab — built as a real .xlsx and read back through the same library the app uses.
function workbook(): XLSX.WorkBook {
  const agents = [
    ["ATLAS LOGISTICS — Overseas Agents", "", "", "", "", "", "", ""],
    ["Week 41", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["Reliable Agent", "Country", "CONTACT NUMBER", "Email", "Agency Agreement", "Rating", "Credit Terms", "Module"],
    ["ABC Logistics Co., Ltd.", "China", "+86 21 5555", "ops@abc.cn", "Yes", "★★★★", "30 days", "Air"],
    ["Beta Freight GmbH", "Germany", "+49 40 1234", "beta@beta.de", "", "★★", "", "Sea"],
    ["abc logistics co ltd", "China", "+86 21 5556", "", "", "", "", ""], // same company again, written differently
    ["", "Spain", "", "", "", "", "", ""], // no name → skipped
  ];
  const suspended = [
    ["Agent", "Country", "Remarks"],
    ["Gamma Cargo", "India", "Payment issues"],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(agents), "Overseas Agents");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(suspended), "Suspended Agents");
  return wb;
}

const buf = XLSX.write(workbook(), { type: "array", bookType: "xlsx" });
const wb = XLSX.read(buf, { type: "array" });
const sheets = wb.SheetNames.map((name) => ({
  name,
  rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "", blankrows: true }),
}));
const parsed = parseDirectorySheets(sheets, "agency");

// Every sheet is read, title rows are skipped, nameless rows dropped.
assert.equal(parsed.contacts.length, 4);
assert.deepEqual(parsed.sheets.map((s) => [s.name, s.contacts]), [["Overseas Agents", 3], ["Suspended Agents", 1]]);
const abc = parsed.contacts[0];
assert.equal(abc.name, "ABC Logistics Co., Ltd."); // "Reliable Agent" is recognised as the name column
assert.equal(abc.location, "China"); // "Country" → location
assert.equal(abc.phone, "+86 21 5555"); // "CONTACT NUMBER" → phone
assert.equal(abc.email, "ops@abc.cn");
assert.equal(abc.agreement, "Yes"); // "Agency Agreement" is not mistaken for the name
assert.equal(abc.rating, 4);
assert.equal(abc.creditTerms, "30 days");
assert.equal(abc.moduleType, "Air");
assert.equal(abc.category, "agency");
assert.equal(abc.sheetGroup, "Overseas Agents");
assert.equal(parsed.contacts[3].name, "Gamma Cargo");
assert.equal(parsed.contacts[3].suspended, true); // the suspended tab flags its rows
assert.equal(parsed.contacts[0].suspended, false);

// The weekly rule then keeps ABC once even though the file lists it twice.
const plan = planAgencyImport([], parsed.contacts);
assert.equal(plan.incoming.length, 3);
assert.deepEqual(plan.fileRepeats, ["ABC Logistics Co., Ltd."]);

// Sheet names decide the kind of contact; unknown names fall back to where the user is.
assert.equal(categoryForSheet("Liners", "agency"), "liner");
assert.equal(categoryForSheet("Co-Loaders", "agency"), "coloader");
assert.equal(categoryForSheet("Air Line Contacts", "other"), "airline");
assert.equal(categoryForSheet("Sheet1", "agency"), "agency");
assert.equal(categoryForSheet("Sheet1", "other"), "other");

// A file with no name column explains what it found instead of failing silently.
const bad = parseDirectorySheets([{ name: "Data", rows: [["Code", "Value"], ["1", "2"]] }], "agency");
assert.equal(bad.contacts.length, 0);
assert.match(describeUnreadableWorkbook(bad), /Code, Value/);
assert.match(describeUnreadableWorkbook(bad), /Name, Company, Agent or Agency/);

// SPEED: a long list (3,000 agents in the file, 3,000 already on the list) is handled in a moment.
const name = (i: number) => `Global Cargo Partner ${i} ${i % 3 === 0 ? "Ltd" : "Co."}`;
const existing: DirectoryContact[] = Array.from({ length: 3000 }, (_, i) => ({
  id: `e${i}`, name: name(i), category: "agency", location: "China", updatedAt: "2026-01-01", ...(i % 2 ? { importBatchId: "old" } : {}),
}));
const bigFile = Array.from({ length: 3000 }, (_, i) => ({ name: name(i).toUpperCase().replace(/\./g, ""), category: "agency", location: "China" }));
const t0 = Date.now();
const big = planAgencyImport(existing, bigFile);
const ms = Date.now() - t0;
assert.ok(ms < 3000, `matching 3,000 against 3,000 took ${ms} ms`);
assert.equal(big.incoming.length, 3000);
assert.equal(Object.keys(big.absorbIdByIndex).length, 1500); // the hand-added half is matched to the new rows
assert.equal(big.previousImportRemoved, 1500);

console.log(`excel-import.test.ts: all assertions passed (3,000-agent match took ${ms} ms)`);
