import assert from "node:assert/strict";
import {
  bandIndex,
  breakKeyFor,
  buildLane,
  buildRateEmail,
  daysLeft,
  findCarrierContact,
  freightFor,
  mailtoLink,
  ruleFor,
  sourceFor,
  validityOf,
  type BoardTariff,
} from "./board";
import type { DirectoryContact } from "@/lib/types";

const TODAY = new Date(2026, 10, 8);
const tariff = (o: Partial<BoardTariff>): BoardTariff => ({
  carrierCode: "EK", origin: "BLR", destination: "FRA", currency: "INR", validFrom: "2026-07-01", validTo: "2026-12-31", rateKind: "contract",
  breaks: { min: 8600, minus45: 430, plus45: 405, plus100: 340, plus300: 300, plus500: 290, plus1000: 280 }, notes: "", updatedAt: 1, sourceFile: "x.xlsx", ...o,
});

// Weight -> break, as the Air desk reads them.
assert.equal(breakKeyFor(10), "minus45");
assert.equal(breakKeyFor(45), "plus45");
assert.equal(breakKeyFor(299), "plus100");
assert.equal(breakKeyFor(300), "plus300");
assert.equal(breakKeyFor(1200), "plus1000");
assert.equal(bandIndex(499), 3);
assert.equal(bandIndex(500), 4);
assert.equal(bandIndex(2500), 6);

// Freight is rate x weight, never below the flat minimum, and never guessed from a neighbouring break.
assert.deepEqual(freightFor(tariff({}).breaks, 300), { key: "plus300", perKg: 300, freight: 90000 });
assert.equal(freightFor(tariff({}).breaks, 10)?.freight, 8600, "a small shipment pays the minimum");
assert.equal(freightFor({ plus300: null, plus100: 340 }, 300), null, "a missing break is not borrowed from another");
assert.equal(freightFor(tariff({}).breaks, 0), null);

// How the rate is obtained: the sheet's remarks, then the tariff on file, else ask.
const ek = ruleFor("EK");
const lh = ruleFor("LH");
const ai = ruleFor("AI");
assert.equal(sourceFor(ek, 499, true), "Tariff");
assert.equal(sourceFor(ek, 500, true), "Portal", "Emirates: tariff below 500 kg, portal from 500 kg");
assert.equal(sourceFor(lh, 2500, false), "Portal");
assert.equal(sourceFor(lh, 2501, false), "Email", "Lufthansa: portal up to 2.5 tonnes, then email");
assert.equal(sourceFor(ai, 500, false), "Portal");
assert.equal(sourceFor(ai, 501, false), "Email");
assert.equal(sourceFor(ai, 300, true), "Tariff", "a tariff we hold is used even where the portal would also answer");
assert.equal(sourceFor(undefined, 300, false), "Email", "an airline outside the sheet is asked by email");
assert.equal(sourceFor(undefined, 300, true), "Tariff");

// Validity.
assert.equal(daysLeft("2026-11-24", TODAY), 16);
assert.equal(daysLeft("2026-11-08", TODAY), 0);
assert.equal(daysLeft("", TODAY), null);
assert.equal(validityOf(16), "soon");
assert.equal(validityOf(31), "ok");
assert.equal(validityOf(-1), "expired");
assert.equal(validityOf(null), "none");

// A lane: ranked by total, expired never first, rule airlines without a tariff listed with their source.
const rows = [
  tariff({ carrierCode: "EK" }),
  tariff({ carrierCode: "TK", validTo: "2027-03-31", breaks: { min: 7800, plus300: 305 } }),
  tariff({ carrierCode: "QR", validTo: "2026-11-24", breaks: { min: 8100, plus300: 310 } }),
  tariff({ carrierCode: "SQ", validTo: "2026-10-01", breaks: { min: 100, plus300: 100 } }),
  tariff({ carrierCode: "XX", currency: "USD", breaks: { plus300: 3 } }),
];
const lane = buildLane(rows, 300, TODAY, { TK: "Turkish Airlines", QR: "Qatar Airways", SQ: "Singapore Airlines" });
assert.equal(lane.currency, "INR", "the most common currency is shown");
assert.deepEqual(lane.currencies, ["INR", "USD"]);
assert.deepEqual(lane.priced.map((p) => p.code), ["EK", "TK", "QR", "SQ"], "cheapest first, the expired tariff last even though it is cheapest");
assert.equal(lane.priced[0].freight.freight, 90000);
assert.equal(lane.priced[3].validity, "expired");
assert.equal(lane.priced[2].validity, "soon");
assert.deepEqual(lane.priced.map((p) => p.rank), [1, 2, 3, 4]);
assert.equal(lane.priced[0].name, "Emirates", "a rule's name wins; others use the airline list");
assert.equal(lane.priced[1].name, "Turkish Airlines");
assert.deepEqual(lane.other.map((o) => `${o.code}:${o.source}`), ["AI:Portal", "LH:Portal"], "airlines in the sheet without a tariff on this lane are listed with how to get the rate");
assert.deepEqual(lane.otherCurrency, ["XX"]);
assert.equal(lane.median, 91500, "median of the three live airlines (90,000, 91,500, 93,000): the expired one is left out");
assert.equal(lane.spreadPct, 3, "(93,000 - 90,000) / 90,000");
const usd = buildLane(rows, 300, TODAY, {}, "USD");
assert.equal(usd.currency, "USD");
assert.equal(usd.priced.length, 1);

// At 700 kg Emirates moves to the portal and Lufthansa still answers online, Air India goes to email.
const heavy = buildLane(rows, 700, TODAY, {});
assert.deepEqual(heavy.priced.map((p) => p.code).includes("EK"), false);
assert.equal(heavy.other.find((o) => o.code === "EK")?.source, "Portal");
assert.equal(heavy.other.find((o) => o.code === "LH")?.source, "Portal");
assert.equal(heavy.other.find((o) => o.code === "AI")?.source, "Email");

// A tariff without a rate for this weight is not priced and the airline is asked.
const gap = buildLane([tariff({ carrierCode: "TK", breaks: { min: 7800, plus100: 325 } })], 300, TODAY, {});
assert.equal(gap.priced.length, 0);
assert.equal(gap.other.find((o) => o.code === "TK")?.source, "Email");

// Draft email, addressed from the Directory.
const contacts = [
  { id: "1", name: "Emirates SkyCargo", category: "airline", email: "cargo@ek.example", contactPerson: "Asha Rao" },
  { id: "2", name: "Emirates SkyCargo", category: "airline", email: "old@ek.example", suspended: true },
  { id: "3", name: "Lufthansa Cargo", category: "airline", email: "" },
] as unknown as DirectoryContact[];
assert.equal(findCarrierContact(contacts, "EK", "Emirates")?.email, "cargo@ek.example");
assert.equal(findCarrierContact(contacts, "LH", "Lufthansa"), undefined, "no email, no draft recipient");
const mail = buildRateEmail({ airline: "Lufthansa", origin: "BLR", destination: "FRA", weightKg: 3000, allBreaks: false, aboveKg: 2500, senderName: "Priya" });
assert.match(mail.subject, /BLR - FRA/);
assert.match(mail.body, /weights above 2,500 kg/);
assert.match(mail.body, /1000\+ kg break/);
assert.match(mail.body, /Priya$/);
assert.match(buildRateEmail({ airline: "Ethiopian", origin: "BLR", destination: "ADD", weightKg: 300, allBreaks: true }).body, /MIN, under 45 kg/);
assert.match(mailtoLink("a@b.c", "Hi there", "line 1\nline 2"), /^mailto:a%40b\.c\?subject=Hi%20there&body=line%201%0Aline%202$/);

console.log("carrier board logic ok");
