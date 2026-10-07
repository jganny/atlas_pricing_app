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
  const { buildPerformanceReport, performanceReportCsv } = await import("./performance-report");
  const { listDeskOfficersFromQuotes } = await import("./officers");
  type Row = import("../types").EnquiryRecord;

  const row = (id: string, creator: string, deskSeat: string | undefined, creatorName: string | undefined, won: boolean): Row => ({
    id, ref: id, customer: "C", mode: "air", origin: "BLR", destination: "LHR",
    status: won ? "won" : "quoted", slaHoursOpen: 0, assignee: "", creator, deskSeat, creatorName,
    createdAt: "2026-05-01T00:00:00.000Z", amountINR: won ? 1000 : undefined,
  });

  // Shashank and Shaheer swapped desks mid-way; Sunil is an individual login.
  seats.upsertOccupant({ seatId: "sea-nom", loginId: "shashank", personName: "Shashank" });
  seats.upsertOccupant({ seatId: "air-nom", loginId: "shaheer", personName: "Shaheer" });
  const rows = [
    row("a1", "shashank", "air-nom", "Shashank", true), // done at Air before the swap
    row("a2", "shaheer", "air-nom", "Shaheer", false), // done at Air after
    row("s1", "shaheer", "sea-nom", "Shaheer", true), // done at Sea before
    row("s2", "shashank", "sea-nom", "Shashank", false), // done at Sea after
    row("u1", "sunil", undefined, undefined, false),
  ];

  // BY DESK — each desk keeps its totals whoever sat there.
  const byDesk = buildPerformanceReport(rows, "all", "all", "desk");
  assert.equal(byDesk.groupBy, "desk");
  const air = byDesk.byDesk.find((g) => g.desk.startsWith("Air"));
  const sea = byDesk.byDesk.find((g) => g.desk.startsWith("Sea"));
  assert.equal(air?.count, 2);
  assert.equal(air?.won, 1);
  assert.equal(sea?.count, 2);
  assert.equal(air?.detail.includes("Shashank 1") && air?.detail.includes("Shaheer 1"), true); // who did the work
  assert.equal(byDesk.byDesk.some((g) => g.desk.startsWith("Priority") || g.desk.includes("NRS")), true); // quiet desks still listed
  assert.equal(byDesk.byDesk.some((g) => g.desk.toLowerCase().includes("sunil") || g.desk.includes("sunil")), true); // individuals stay by person

  // BY PERSON — each person is credited across the desks they worked.
  const byPerson = buildPerformanceReport(rows, "all", "all", "person");
  const shashank = byPerson.byDesk.find((g) => g.desk.toLowerCase().includes("shashank"));
  assert.equal(shashank?.count, 2);
  assert.equal(shashank?.detail.includes("Air") && shashank?.detail.includes("Sea"), true);
  // The default stays by person, as before.
  assert.equal(buildPerformanceReport(rows, "all").groupBy, "person");

  // Filtering to one desk in desk view.
  const onlyAir = buildPerformanceReport(rows, "all", "seat:air-nom", "desk");
  assert.equal(onlyAir.total, 2);
  const options = listDeskOfficersFromQuotes(rows);
  assert.equal(options.find((o) => o.id === "seat:air-nom")?.quoteCount, 2);
  assert.equal(options.some((o) => o.id === "sunil"), true);
  assert.equal(options.some((o) => o.id === "shashank"), false);

  // CSV follows the chosen view.
  assert.equal(performanceReportCsv(byDesk).includes("Grouped by,Desk"), true);
  assert.equal(performanceReportCsv(byPerson).includes("Grouped by,Person"), true);
  assert.equal(performanceReportCsv(byDesk).includes("Desk,Quotes,Won,Revenue,Detail"), true);

  // Names saved on a quote keep reading correctly even if the same login is later renamed.
  const label = seats.quoteOwnerLabel({ creator: "shashank", deskSeat: "air-nom", creatorName: "Shashank" });
  assert.equal(label, "Shashank · Air Nom");
  seats.upsertOccupant({ seatId: "sea-nom", loginId: "shashank", personName: "Priya" });
  assert.equal(seats.quoteOwnerLabel({ creator: "shashank", deskSeat: "air-nom", creatorName: "Shashank" }), "Shashank · Air Nom");

  console.log("performance-report.test.ts: all assertions passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
