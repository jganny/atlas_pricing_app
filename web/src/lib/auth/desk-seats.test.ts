import assert from "node:assert/strict";

// minimal browser stubs (desk-seats reads window/localStorage)
const store: Record<string, string> = {};
(globalThis as unknown as { window: object }).window = {};
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
};

(async () => {
const seats = await import("./desk-seats");

// default: Kavya's login sits in the Free Hand seat
assert.equal(seats.seatForLogin("kavya")?.id, "freehand");
assert.equal(seats.personDisplayName("kavya"), "Kavya");

// rename the person, keep the SAME login id (what the quotes store as `creator`)
let notified = 0;
const off = seats.subscribeSeats(() => notified++);
seats.upsertOccupant({ seatId: "freehand", loginId: "kavya", personName: "Priya Sharma" });
assert.equal(notified > 0, true); // components get told to re-render
assert.equal(seats.personDisplayName("kavya"), "Priya Sharma"); // display name changed…
assert.equal(seats.seatForLogin("kavya")?.id, "freehand"); // …seat unchanged
assert.equal(seats.enquiryAssigneeLabel("kavya"), "Priya Sharma · Free Hand"); // old quotes now read as the new person, under the same seat
assert.equal(seats.occupantLoginForSeat("freehand"), "kavya");

// other seats are untouched
assert.equal(seats.personDisplayName("shashank"), "Shashank");
assert.equal(seats.seatForLogin("shashank")?.id, "air-nom");

// shared sync: identical remote list is a no-op, a different one applies and notifies
const before = notified;
assert.equal(seats.applyRemoteOccupants([{ seatId: "freehand", loginId: "KAVYA", personName: "Priya Sharma" }]), false);
assert.equal(notified, before);
assert.equal(seats.applyRemoteOccupants([{ seatId: "freehand", loginId: "kavya", personName: "Anil Rao" }]), true);
assert.equal(seats.personDisplayName("kavya"), "Anil Rao");
assert.equal(notified > before, true);

// clearing restores the default occupant name
seats.removeOccupant("freehand");
assert.equal(seats.personDisplayName("kavya"), "Kavya");
off();

console.log("desk-seats.test.ts: all assertions passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
