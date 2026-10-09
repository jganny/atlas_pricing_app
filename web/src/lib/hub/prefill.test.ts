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
  const seats = await import("../auth/desk-seats");
  const { toParsedEnquiry, toSmartPrefill, toDeskPrefill, matchVehicleType } = await import("./prefill");
  const { visibleJobs, waitingCounts } = await import("./jobs");
  const { demoHubJobs } = await import("./demo-jobs");
  const { INDIA_VEHICLE_TYPES } = await import("../desk/constants");
  type Job = import("./types").HubJob;

  const [sea, air, transport] = demoHubJobs("shaheer");

  // Sea export → what the Sea desk's existing prefill expects. Rates/liner are never part of it.
  const sp = toSmartPrefill(sea);
  assert.equal(sp.mode, "sea");
  assert.equal(sp.parsed.customer, "Gulf Freight Co");
  assert.equal(sp.parsed.origin, "INMAA - Chennai");
  assert.equal(sp.parsed.destination, "AEJEA - Jebel Ali");
  assert.equal(sp.parsed.module, "export"); // Import/Export is carried to the desk
  assert.equal(sp.parsed.incoterm, "FOB");
  assert.equal(sp.parsed.grossWeight, 9500);
  assert.equal(sp.parsed.volume, 31.7);
  assert.equal(sp.parsed.packages[0].l, 120);
  assert.equal(sp.carrierLabel, "");
  assert.equal(sp.tariffFound, false);
  assert.equal(sp.currency, "USD");
  assert.match(sp.parsed.source, /Quote Hub/);
  // Invoice value and HS code travel as a note, not as a rate.
  assert.match(toParsedEnquiry(sea).notes ?? "", /Invoice value USD 18450/);

  // Air import.
  const ap = toSmartPrefill(air);
  assert.equal(ap.mode, "air");
  assert.equal(ap.parsed.module, "import");
  assert.equal(ap.parsed.origin, "PVG - Shanghai");
  assert.equal(ap.parsed.customer, "Pearl Cargo Ltd");

  // Unknown direction sets nothing, so the desk keeps its own default.
  assert.equal(toParsedEnquiry({ ...air, extraction: { ...air.extraction, direction: "unknown" } }).module, undefined);

  // Transport hand-over.
  const tp = toDeskPrefill(transport);
  assert.equal(tp.mode, "transport");
  assert.equal(tp.origin, "Bengaluru");
  assert.equal(tp.vehicleType, "20 ft container");
  assert.equal(tp.customer, ""); // nothing known → left for the user

  // Vehicle matching.
  assert.equal(matchVehicleType(INDIA_VEHICLE_TYPES, "20 ft container"), "20 ft container truck");
  assert.equal(matchVehicleType(INDIA_VEHICLE_TYPES, "Eicher 17ft"), "Eicher 17 ft");
  assert.equal(matchVehicleType(INDIA_VEHICLE_TYPES, "1 ton pickup"), "Pickup 1 ton");
  assert.equal(matchVehicleType(INDIA_VEHICLE_TYPES, "bullock cart"), null);
  assert.equal(matchVehicleType(INDIA_VEHICLE_TYPES, ""), null);

  // Who sees what: jobs belong to the desk, so a person who takes over the desk sees its waiting jobs.
  const mk = (id: string, createdBy: string, deskSeat: string | undefined, status: Job["status"]): Job => ({ ...sea, id, createdBy, deskSeat, status });
  const jobs = [mk("a", "shaheer", "sea-nom", "waiting"), mk("b", "shashank", "air-nom", "waiting"), mk("c", "sunil", undefined, "waiting"), mk("d", "shaheer", "sea-nom", "dismissed"), mk("e", "shaheer", "sea-nom", "opened")];
  const ids = (user: string, admin = false) => visibleJobs(jobs, user, admin).map((j) => j.id).sort();
  assert.deepEqual(ids("shaheer"), ["a", "e"]); // dismissed ones are gone
  assert.deepEqual(ids("shashank"), ["b"]);
  assert.deepEqual(ids("sunil"), ["c"]); // an individual sees their own
  assert.deepEqual(ids("ganny", true), ["a", "b", "c", "e"]); // admin sees all
  // After a handover, the new person at the Sea desk sees the desk's jobs.
  seats.upsertOccupant({ seatId: "sea-nom", loginId: "newsea", personName: "New Sea" });
  assert.deepEqual(ids("newsea"), ["a", "e"]);
  assert.deepEqual(ids("shaheer"), ["a", "e"]); // the previous holder still sees only the jobs they dropped themselves
  assert.deepEqual(ids("shashank"), ["b"]); // other desks are unaffected

  // Counts for the desk menu: waiting only.
  assert.deepEqual(waitingCounts(jobs), { air: 0, sea: 3, courier: 0, transport: 0, warehouse: 0 });
  assert.equal(waitingCounts(demoHubJobs("x")).transport, 1);

  console.log("hub prefill.test.ts: all assertions passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
