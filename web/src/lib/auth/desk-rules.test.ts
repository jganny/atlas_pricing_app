import assert from "node:assert/strict";
import { defaultDeskCurrency, defaultIncoterm } from "./desk-rules";
import { DESK_CURRENCIES } from "@/lib/desk/constants";

// NRS and Free Hand are two different desks with two different legacy
// defaults (app-v4.js TEAM_ROLES: cathrina currency 'USD', jaya/kavya 'INR')
// — grouping them together was the actual bug. Neither ever has fewer
// currency choices than Air/Sea Nomination: DESK_CURRENCIES is one shared
// list for every desk, used unconditionally by every currency <select> —
// this only decides which option starts selected.
assert.equal(defaultDeskCurrency("cathrina"), "USD", "NRS desk defaults to USD, matching legacy");
assert.equal(defaultDeskCurrency("kavya"), "INR", "Free Hand desk defaults to INR, matching legacy");
assert.equal(defaultDeskCurrency("shashank"), "USD", "Air Nomination still defaults to USD");
assert.equal(defaultDeskCurrency("shaheer"), "USD", "Sea Nomination still defaults to USD");
assert.equal(defaultDeskCurrency(""), "USD", "no/unknown desk falls back to USD, same as Nomination");

assert.equal(defaultIncoterm("cathrina"), "EXW", "NRS incoterm default unchanged");
assert.equal(defaultIncoterm("kavya"), "CIF", "Free Hand incoterm default unchanged");

assert.deepEqual(
  [...DESK_CURRENCIES],
  ["USD", "EUR", "GBP", "INR"],
  "one shared currency list — no desk (NRS/Free Hand included) sees fewer options than Nomination",
);

console.log("desk-rules tests passed");
