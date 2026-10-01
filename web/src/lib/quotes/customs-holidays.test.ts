import assert from "node:assert/strict";
import {
  daysUntil,
  holidayAdvisoryText,
  locationMatchesBranch,
  relevantHolidaysForUserBranch,
  upcomingHolidaysForBranch,
  upcomingHolidaysForLocations,
  type CustomsHoliday,
} from "./customs-holidays";

assert.equal(locationMatchesBranch("BOM - Mumbai, Chhatrapati Shivaji", "Mumbai"), true);
assert.equal(locationMatchesBranch("DEL - Delhi", "Mumbai"), false);
assert.equal(locationMatchesBranch("", "Mumbai"), false, "blank location never matches");
assert.equal(locationMatchesBranch("MUMBAI PORT", "mumbai"), true, "case-insensitive");

const now = new Date("2026-08-01T12:00:00");
assert.equal(daysUntil("2026-08-01", now), 0, "today is 0 days out");
assert.equal(daysUntil("2026-08-15", now), 14);
assert.equal(daysUntil("2026-07-20", now), -12, "a past date is negative");

const holidays: CustomsHoliday[] = [
  { id: "h1", branch: "Mumbai", date: "2026-08-10", name: "a holiday 9 days out" },
  { id: "h2", branch: "Mumbai", date: "2026-08-15", name: "Independence Day" }, // 14 days out, still in window
  { id: "h3", branch: "Mumbai", date: "2026-09-14", name: "Ganesh Chaturthi" }, // > 14 days out
  { id: "h4", branch: "Mumbai", date: "2026-07-20", name: "stale, already past" },
  { id: "h5", branch: "Delhi", date: "2026-08-12", name: "a Delhi-only holiday" },
];

const mumbaiUpcoming = upcomingHolidaysForBranch("Mumbai", holidays, 14, now);
assert.equal(mumbaiUpcoming.length, 2, "only the two within the 14-day window");
assert.deepEqual(
  mumbaiUpcoming.map((h) => h.id),
  ["h1", "h2"],
  "sorted earliest first",
);

const forQuote = upcomingHolidaysForLocations(["BOM - Mumbai, India", "LHR - London"], holidays, 14, now);
assert.deepEqual(forQuote.map((h) => h.id), ["h1", "h2"], "matches Mumbai branch, ignores Delhi/London");

assert.equal(
  holidayAdvisoryText({ id: "x", branch: "Mumbai", date: "2026-08-15", name: "Independence Day" }),
  "Mumbai is closed for Independence Day on 15 Aug 2026.",
);

// Bangalore (the hub) sees one consolidated entry per date, across every
// branch — never attributed to a single branch.
const multiCity: CustomsHoliday[] = [
  { id: "a1", branch: "Mumbai", date: "2026-08-15", name: "Independence Day" },
  { id: "a2", branch: "Delhi", date: "2026-08-15", name: "Independence Day" },
  { id: "a3", branch: "Ahmedabad", date: "2026-08-10", name: "Local Fair" },
  { id: "a4", branch: "Mumbai", date: "2026-09-01", name: "Too far out" }, // 31 days, outside window
];
const bangaloreView = relevantHolidaysForUserBranch("Bangalore", multiCity, 14, now);
assert.deepEqual(
  bangaloreView.map((h) => h.date),
  ["2026-08-10", "2026-08-15"],
  "consolidated by date, sorted, ignoring anything past the lead window",
);
assert.equal(bangaloreView[1].name, "Independence Day", "same name on the same date collapses to one");
assert.equal(bangaloreView[1].branch, "All branches", "never attributed to a single branch for the hub");

// A different name on the same date (two different festivals) gets joined, not dropped.
const clashing: CustomsHoliday[] = [
  { id: "c1", branch: "Mumbai", date: "2026-08-15", name: "Independence Day" },
  { id: "c2", branch: "Kerala", date: "2026-08-15", name: "Some Other Festival" },
];
const clashingView = relevantHolidaysForUserBranch("Bangalore", clashing, 14, now);
assert.equal(clashingView[0].name, "Independence Day / Some Other Festival");

// A non-hub branch user sees only their own branch, same as before.
const mumbaiUser = relevantHolidaysForUserBranch("Mumbai", multiCity, 14, now);
assert.deepEqual(mumbaiUser.map((h) => h.id), ["a1"], "only Mumbai's own holiday, not Delhi's or Ahmedabad's");

// No branch set at all (legacy user) defaults to the Bangalore hub view.
const noBranch = relevantHolidaysForUserBranch(undefined, multiCity, 14, now);
assert.equal(noBranch.length, 2, "defaults to the consolidated hub view when unset");

console.log("customs-holidays.test.ts: all assertions passed");
