import assert from "node:assert/strict";
import { allowedRoutesForUser, canAccessRoute, preferredHomePath } from "./rbac";
import { nrsBookingMode } from "@/lib/quotes/won-actions";

// Air Nom (shashank) has the Sea desk too; Sea Nom (shaheer) has the Air desk too
assert.equal(canAccessRoute("shashank", undefined, "air"), true);
assert.equal(canAccessRoute("shashank", undefined, "sea"), true, "Air Nom can open the Sea desk");
assert.equal(canAccessRoute("shaheer", undefined, "sea"), true);
assert.equal(canAccessRoute("shaheer", undefined, "air"), true, "Sea Nom can open the Air desk");

// Nothing else changed for them
for (const u of ["shashank", "shaheer"]) {
  assert.equal(canAccessRoute(u, undefined, "courier"), false, `${u} still has no Courier desk`);
  assert.equal(canAccessRoute(u, undefined, "admin"), false, `${u} is not given Admin`);
  assert.equal(canAccessRoute(u, undefined, "nrs"), false);
  assert.equal(canAccessRoute(u, undefined, "transport"), true);
}
assert.equal(preferredHomePath("shashank"), "/air/", "each still lands on their own desk");
assert.equal(preferredHomePath("shaheer"), "/sea/");
assert.equal(new Set(allowedRoutesForUser("shashank")).size, allowedRoutesForUser("shashank").length, "no route listed twice");

// An NRS booking is Air or Sea by the shipment, whichever nomination desk made the quote
assert.equal(nrsBookingMode("sea", "air-nom"), "sea", "an Air Nom user's sea quote is a Sea nomination");
assert.equal(nrsBookingMode("air", "sea-nom"), "air");
assert.equal(nrsBookingMode(undefined, "sea-nom"), "sea", "seat is only the fallback");
assert.equal(nrsBookingMode("courier", "air-nom"), "air");
console.log("rbac-nomination tests passed");
