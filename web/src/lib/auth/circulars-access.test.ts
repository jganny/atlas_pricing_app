import assert from "node:assert/strict";

const store: Record<string, string> = {};
(globalThis as unknown as { window: object }).window = {};
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
};

(async () => {
  const { canManageCirculars } = await import("./directory-access");
  const seats = await import("./desk-seats");

  // Admin and the four desks can add/delete; everyone else only reads.
  assert.equal(canManageCirculars("ganny", "ganny"), true);
  for (const desk of ["shashank", "shaheer", "cathrina", "kavya", "jaya"]) assert.equal(canManageCirculars(desk), true, desk);
  // Individual sales logins share the Free Hand *category* but are not a desk seat.
  for (const rep of ["sunil", "ramesh", "goutham", "spoorthi", "linson"]) assert.equal(canManageCirculars(rep), false, rep);
  assert.equal(canManageCirculars("pricing"), false);
  assert.equal(canManageCirculars(undefined), false);

  // Follows the seat: a new person in the NRS seat gains it, the old holder loses it.
  seats.upsertOccupant({ seatId: "nrs", loginId: "newperson", personName: "New Person" });
  assert.equal(canManageCirculars("newperson"), true);
  assert.equal(canManageCirculars("cathrina"), false);
  console.log("circulars-access tests passed");
})();
