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
  const rbac = await import("./rbac");
  const rules = await import("./desk-rules");
  const teams = await import("../quotes/team-roles");

  // Quotes as they exist today: the four desk holders' quotes (no desk stamp yet)
  // plus an individual salesperson's.
  const airOld = { id: "a1", creator: "shashank" };
  const seaOld = { id: "s1", creator: "shaheer" };
  const nrsOld = { id: "n1", creator: "cathrina" };
  const freeOld = { id: "f1", creator: "kavya" };
  const sunil = { id: "u1", creator: "sunil" };

  const visible = (user: string) =>
    [airOld, seaOld, nrsOld, freeOld, sunil].filter((r) => seats.belongsToViewersDesk(r, user)).map((r) => r.id);

  // Before any shuffle everyone sees their own desk.
  assert.deepEqual(visible("shashank"), ["a1"]);
  assert.deepEqual(visible("shaheer"), ["s1"]);
  assert.deepEqual(visible("cathrina"), ["n1"]);
  assert.deepEqual(visible("kavya"), ["f1"]);
  assert.deepEqual(visible("sunil"), ["u1"]);

  // SHUFFLE: Shashank is moved to Sea NOM and Shaheer to Air NOM.
  seats.upsertOccupant({ seatId: "sea-nom", loginId: "shashank", personName: "Shashank" });
  seats.upsertOccupant({ seatId: "air-nom", loginId: "shaheer", personName: "Shaheer" });

  // Shashank now sits in Sea, with Sea's rules and pages…
  assert.equal(seats.currentDeskSeatId("shashank"), "sea-nom");
  assert.equal(rbac.preferredHomePath("shashank"), "/sea/");
  assert.equal(rules.deskCategory("shashank"), "SEA - NOMINATION");
  // …and sees the Sea desk's existing quotes (made by the previous Sea person), NOT the Air ones.
  assert.deepEqual(visible("shashank"), ["s1"]);
  // Shaheer sees the Air desk's existing quotes.
  assert.equal(seats.currentDeskSeatId("shaheer"), "air-nom");
  assert.equal(rbac.preferredHomePath("shaheer"), "/air/");
  assert.deepEqual(visible("shaheer"), ["a1"]);
  // The other desks are untouched.
  assert.deepEqual(visible("cathrina"), ["n1"]);
  assert.deepEqual(visible("kavya"), ["f1"]);

  // New quotes are stamped with the desk they were made in, so they stay there.
  const shashankSeaQuote = { id: "s2", creator: "shashank", deskSeat: seats.currentDeskSeatId("shashank") };
  const shaheerAirQuote = { id: "a2", creator: "shaheer", deskSeat: seats.currentDeskSeatId("shaheer") };
  assert.equal(shashankSeaQuote.deskSeat, "sea-nom");
  assert.equal(shaheerAirQuote.deskSeat, "air-nom");
  const all = [airOld, seaOld, shashankSeaQuote, shaheerAirQuote];
  const idsFor = (user: string) => all.filter((r) => seats.belongsToViewersDesk(r, user)).map((r) => r.id).sort();
  assert.deepEqual(idsFor("shashank"), ["s1", "s2"]); // Sea: old + new, in one continuous list
  assert.deepEqual(idsFor("shaheer"), ["a1", "a2"]); // Air: old + new

  // Labels show the desk a quote belongs to, not the desk its author sits in today.
  assert.equal(seats.quoteOwnerLabel(airOld).endsWith("Air Nom"), true);
  assert.equal(seats.quoteOwnerLabel(shashankSeaQuote).endsWith("Sea Nom"), true);

  // SHUFFLE BACK: Shashank returns to Air — his early Air quotes are Air's again, Sea's stay Sea's.
  seats.upsertOccupant({ seatId: "air-nom", loginId: "shashank", personName: "Shashank" });
  seats.upsertOccupant({ seatId: "sea-nom", loginId: "shaheer", personName: "Shaheer" });
  assert.deepEqual(idsFor("shashank"), ["a1", "a2"]);
  assert.deepEqual(idsFor("shaheer"), ["s1", "s2"]);

  // The admin's desk filter lists the four desks (not people) and matches by desk.
  const options = teams.listDeskFilterOptions(["shashank", "shaheer", "sunil"]);
  const ids = options.map((o) => o.id);
  for (const d of ["seat:air-nom", "seat:sea-nom", "seat:nrs", "seat:freehand"]) assert.equal(ids.includes(d), true);
  assert.equal(ids.includes("shashank"), false); // desk holders are filtered by desk, not by person
  assert.equal(ids.includes("sunil"), true); // individuals stay listed by name
  assert.equal(teams.matchesDeskFilter(shashankSeaQuote, "seat:sea-nom"), true);
  assert.equal(teams.matchesDeskFilter(shashankSeaQuote, "seat:air-nom"), false);
  assert.equal(teams.matchesDeskFilter(airOld, "seat:air-nom"), true);

  // INDIVIDUAL SALES: each login keeps its own quotes — never shuffled with a desk or each other.
  assert.equal(seats.currentDeskSeatId("sunil"), undefined);
  assert.deepEqual(visible("sunil"), ["u1"]);
  assert.deepEqual(visible("spoorthi"), []);
  assert.equal(seats.belongsToViewersDesk(sunil, "shashank"), false); // desk people don't absorb them
  // A former individual's quotes stay under their login even when nobody uses it any more.
  assert.equal(seats.quoteDeskSeatId(sunil), undefined);
  assert.equal(seats.belongsToViewersDesk(sunil, "sunil"), true);

  console.log("desk-shuffle.test.ts: all assertions passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
