import assert from "node:assert/strict";
import { buildRequestEmail, newRequestRef, planFor, selectRecipients, MAX_AUTO_RECIPIENTS, type RequestContext } from "./rate-request";
import { countryCodesIn, countryOfPlace, parseCoverage, vendorKind } from "@/lib/directory/coverage";
import type { DirectoryContact } from "@/lib/types";

// Country reading
assert.deepEqual(countryCodesIn("Dubai, UAE"), ["AE"]);
assert.deepEqual(countryCodesIn("South Korea"), ["KR"], "South Korea is not also read as Korea twice");
assert.deepEqual(countryCodesIn("Beirut, Lebanon"), ["LB"]);
assert.ok(countryCodesIn("Germany / Netherlands").includes("DE") && countryCodesIn("Germany / Netherlands").includes("NL"));
assert.deepEqual(countryCodesIn("South Sudan"), ["SS"], "South Sudan is not read as Sudan");
assert.deepEqual(countryCodesIn(""), []);
assert.deepEqual(parseCoverage("lebanon, AE; Germany"), ["LB", "AE", "DE"]);
assert.equal(countryOfPlace("AEJEA - Jebel Ali"), "AE");
assert.equal(countryOfPlace("BEY - Beirut", { airports: new Map([["BEY", "LB"]]) }), "LB");
assert.equal(countryOfPlace("Hamburg, Germany"), "DE");
assert.equal(vendorKind({ category: "airline", sheetGroup: "Airlines" }), "airline");
assert.equal(vendorKind({ category: "vendor", sheetGroup: "Co-loaders" }), "coloader");
assert.equal(vendorKind({ category: "vendor", sheetGroup: "Shipping Lines" }), "liner");
assert.equal(vendorKind({ category: "vendor", sheetGroup: "Transporters" }), "transporter");

// Plans follow the three rules
const ctx = (o: Partial<RequestContext>): RequestContext => ({ mode: "air", direction: "import", incoterm: "FOB", originCountry: "CN", destCountry: "IN", ...o });
for (const t of ["FOB", "EXW", "FCA"]) assert.equal(planFor(ctx({ incoterm: t })).kind, "agents", `import ${t}`);
assert.equal((planFor(ctx({})) as { country?: string }).country, "CN", "imports ask the ORIGIN country");
for (const t of ["CIF", "DDP", "DDU", "DAP"]) assert.equal(planFor(ctx({ direction: "export", incoterm: t, destCountry: "LB" })).kind, "agents", `export ${t}`);
assert.equal((planFor(ctx({ direction: "export", incoterm: "CIF", destCountry: "LB" })) as { country?: string }).country, "LB", "exports ask the DESTINATION country");
for (const t of ["EXW", "FOB", "FCA"]) assert.equal(planFor(ctx({ direction: "export", incoterm: t })).kind, "vendors", `export ${t}`);
assert.equal(planFor(ctx({ incoterm: "CIF" })).kind, "none", "import under CIF has no automatic request");
assert.equal(planFor(ctx({ incoterm: "" })).kind, "none");

// Choosing contacts
const c = (o: Partial<DirectoryContact>): DirectoryContact => ({ id: "x", name: "N", category: "agency", email: "a@x.com", ...o });
const dir: DirectoryContact[] = [
  c({ id: "1", name: "Beirut Agent", location: "Beirut, Lebanon", rating: 4 }),
  c({ id: "2", name: "Dubai Agent", location: "Dubai, UAE" }),
  c({ id: "3", name: "Suspended Beirut", location: "Lebanon", suspended: true }),
  c({ id: "4", name: "No Email Beirut", location: "Lebanon", email: "" }),
  c({ id: "5", name: "Top Beirut", location: "Lebanon", rating: 5 }),
  c({ id: "6", name: "Emirates", category: "airline", sheetGroup: "Airlines", coverage: ["LB", "AE"] }),
  c({ id: "7", name: "Unknown Air", category: "airline", sheetGroup: "Airlines" }),
  c({ id: "8", name: "Qatar", category: "airline", sheetGroup: "Airlines", coverage: ["QA"] }),
  c({ id: "9", name: "Some Liner", category: "vendor", sheetGroup: "Shipping Lines", coverage: ["LB"] }),
];
const agentsCtx = ctx({ direction: "export", incoterm: "CIF", destCountry: "LB" });
const a = selectRecipients(planFor(agentsCtx), agentsCtx, dir);
assert.deepEqual(a.matched.map((x) => x.name), ["Top Beirut", "Beirut Agent"], "right country, best rated first");
assert.deepEqual(a.skipped, { suspended: 1, noEmail: 1 });
const vCtx = ctx({ direction: "export", incoterm: "FOB", destCountry: "LB", mode: "air" });
const v = selectRecipients(planFor(vCtx), vCtx, dir);
assert.deepEqual(v.matched.map((x) => x.name), ["Emirates"], "air asks airlines serving Lebanon, not liners or other countries");
assert.deepEqual(v.unsure.map((x) => x.name), ["Unknown Air"], "no countries on record: shown, not selected");
const sCtx = { ...vCtx, mode: "sea" as const };
assert.deepEqual(selectRecipients(planFor(sCtx), sCtx, dir).matched.map((x) => x.name), ["Some Liner"]);
assert.equal(selectRecipients(planFor(ctx({ incoterm: "CIF" })), ctx({ incoterm: "CIF" }), dir).matched.length, 0);
const noCountry = ctx({ direction: "export", incoterm: "CIF", destCountry: undefined });
assert.equal(selectRecipients(planFor(noCountry), noCountry, dir).matched.length, 0, "nothing is guessed when the country is unknown");
const many = Array.from({ length: MAX_AUTO_RECIPIENTS + 5 }, (_, i) => c({ id: `m${i}`, name: `A${i}`, location: "Lebanon" }));
const capped = selectRecipients(planFor(agentsCtx), agentsCtx, many);
assert.equal(capped.matched.length, MAX_AUTO_RECIPIENTS);
assert.equal(capped.overCap, 5);

// The email
assert.match(newRequestRef(), /^RQ-[A-Z0-9]{7}$/);
const ref = "RQ-ABC1234";
const e = buildRequestEmail({ ...vCtx, ref, originLabel: "BOM - Mumbai", destLabel: "BEY - Beirut", senderName: "Linson", cargo: { pieces: 13, grossKg: 145, volumeCbm: 0.9, chargeableKg: 145, commodity: "Pharmaceutical drums" } });
assert.match(e.subject, /RQ-ABC1234/);
assert.match(e.body, /Gross weight: 145 kg/);
assert.doesNotMatch(e.body, /customer|margin|sell|buy/i, "no customer or price words in what vendors see");
console.log("rate-request tests passed");
