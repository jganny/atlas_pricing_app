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
  const reg = await import("./nrs-registry");

  // Records written by the original app (same field names) are read as-is.
  const legacyAir = { id: "q1", refId: "AE-100", mode: "Air Nomination", agent: "Acme", creator: "shashank", shipperName: "S", consigneeName: "C", dateWon: "2026-03-01" };
  const legacySea = { id: "q2", refId: "SE-200", mode: "Sea Nomination", agent: "Beta", creator: "shaheer", dateWon: "2026-04-01", pendingShipperDetails: true };
  const freeHand = { id: "q3", refId: "FH-1", agent: "Gamma", creator: "kavya", dateWon: "2026-05-01" };
  const noCreatorAir = { id: "q4", refId: "AI-7", agent: "Delta", dateWon: "2026-02-01" };
  const noCreatorOther = { id: "q5", refId: "ZZ-7", mode: "Courier", agent: "Eps" };

  // Only nomination bookings belong in the NRS directory.
  assert.equal(reg.isNominationBooking(legacyAir), true);
  assert.equal(reg.isNominationBooking(legacySea), true);
  assert.equal(reg.isNominationBooking(freeHand), false);
  assert.equal(reg.isNominationBooking(noCreatorAir), true); // falls back to the booking reference prefix
  assert.equal(reg.isNominationBooking(noCreatorOther), false);
  // A booking stamped with its desk stays in the directory whoever made it.
  assert.equal(reg.isNominationBooking({ id: "x", creator: "someonenew", deskSeat: "air-nom" }), true);

  assert.equal(reg.registryNeedsDetails(legacyAir), false);
  assert.equal(reg.registryNeedsDetails(legacySea), true);

  // Newest first, searchable by anything on the row.
  const all = [legacyAir, legacySea, noCreatorAir];
  assert.deepEqual(reg.sortRegistry(all).map((e) => e.id), ["q2", "q1", "q4"]);
  assert.deepEqual(reg.searchRegistry(all, "beta").map((e) => e.id), ["q2"]);
  assert.deepEqual(reg.searchRegistry(all, "").length, 3);

  // A confirmation builds a record in the original app's shape, flagged until both parties are known.
  const built = reg.buildRegistryEntry({
    quoteId: "q9", ref: "SE-9", customer: "Zed", mode: "sea", pol: "INMAA", pod: "NLRTM",
    shipperName: " Shipper ", consigneeName: "", creator: "shaheer", deskSeat: "sea-nom", wonOn: "2026-06-01",
  });
  assert.equal(built.id, "q9");
  assert.equal(built.refId, "SE-9");
  assert.equal(built.mode, "Sea Nomination");
  assert.equal(built.agent, "Zed");
  assert.equal(built.shipperName, "Shipper");
  assert.equal(built.pendingShipperDetails, true);
  assert.equal(built.deskSeat, "sea-nom");
  assert.equal(reg.buildRegistryEntry({ quoteId: "q8", ref: "AE-8", customer: "Y", mode: "air", pol: "BLR", pod: "LHR" }).mode, "Air Nomination");

  // Filling in both parties clears the flag; one side only keeps it.
  assert.equal(reg.partyUpdates({ shipperName: " A ", consigneeName: "B" }).pendingShipperDetails, false);
  assert.equal(reg.partyUpdates({ shipperName: "A", consigneeName: "" }).pendingShipperDetails, true);
  assert.equal(reg.partyUpdates({ shipperName: " A " }).shipperName, "A");

  console.log("nrs-registry.test.ts: all assertions passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
