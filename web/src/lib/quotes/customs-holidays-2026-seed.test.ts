import assert from "node:assert/strict";
import { buildCustomsHolidays2026 } from "./customs-holidays-2026-seed";

const rows = buildCustomsHolidays2026();

assert.ok(rows.length > 250, `expected a full year's worth of rows, got ${rows.length}`);
assert.ok(
  rows.every((r) => r.name !== "Holiday"),
  "every (branch, day) pair must resolve to a real holiday name, never the fallback",
);
assert.ok(
  rows.every((r) => /^2026-\d{2}-\d{2}$/.test(r.date)),
  "every date must be a well-formed 2026 ISO date",
);

function find(branch: string, date: string) {
  return rows.find((r) => r.branch === branch && r.date === date);
}

assert.equal(find("Mumbai", "2026-08-15")?.name, "Independence Day");
assert.equal(find("Ahmedabad", "2026-08-28")?.name, "Raksha Bandan");
assert.equal(find("Bangalore", "2026-11-01")?.name, "Kannada Rajyotsava");
assert.equal(find("Kolkatta", "2026-11-16")?.name, "Chatt Pooja");
assert.equal(find("Ahmedabad", "2026-11-10")?.name, "New Year", "Gujarati New Year, Ahmedabad only");
assert.equal(find("Delhi", "2026-11-10"), undefined, "New Year is Ahmedabad-specific, not Delhi");

console.log("customs-holidays-2026-seed.test.ts: all assertions passed");
