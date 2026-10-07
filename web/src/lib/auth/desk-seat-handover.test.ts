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
  const inbox = await import("../mail/inbox-assign");

  // Before any handover the original holders behave as before.
  assert.equal(rbac.isNrsUser("cathrina"), true);
  assert.equal(rbac.isNrsUser("kavya"), false);
  assert.equal(rbac.isNrsUser("ganny"), false); // Admin never gets the NRS queue
  assert.equal(rules.deskCategory("cathrina"), "NRS (AIR/SEA)");

  // Each desk is handed to a brand-new person with a brand-new login.
  const handovers: Array<[Parameters<typeof seats.upsertOccupant>[0]["seatId"], string, string]> = [
    ["nrs", "newnrs", "NRS (AIR/SEA)"],
    ["freehand", "newfree", "FREE HAND SALES (AIR/SEA)"],
    ["air-nom", "newair", "AIR - NOMINATION"],
    ["sea-nom", "newsea", "SEA - NOMINATION"],
  ];
  for (const [seatId, login] of handovers) {
    seats.upsertOccupant({ seatId, loginId: login, personName: `Person ${login}` });
  }

  // The new people get the desk's rules and pages — nothing depends on who they are.
  assert.equal(rbac.isNrsUser("newnrs"), true);
  assert.equal(rbac.allowedRoutesForUser("newnrs").includes("nrs"), true);
  assert.equal(rbac.preferredHomePath("newnrs"), "/inbox/");
  assert.equal(rbac.preferredHomePath("newair"), "/air/");
  assert.equal(rbac.preferredHomePath("newsea"), "/sea/");
  assert.equal(rbac.preferredHomePath("newfree"), "/inbox/");
  assert.equal(rbac.isNrsUser("newfree"), false);
  for (const [, login, category] of handovers) {
    assert.equal(rules.deskCategory(login), category);
  }
  assert.equal(rules.shouldHideAgencyAgreement("newnrs"), true);
  assert.equal(rules.defaultDeskCurrency("newfree"), "INR");
  assert.equal(rules.defaultIncoterm("newnrs"), "EXW");
  assert.equal(rules.showBuyRates("newair"), true);
  assert.equal(rbac.deskFocusLabel("newnrs"), seats.DESK_SEATS.find((s) => s.id === "nrs")?.label);

  // The previous holder no longer has the seat — no access to the NRS queue or the mail.
  assert.equal(rbac.isNrsUser("cathrina"), false);
  assert.equal(rbac.allowedRoutesForUser("cathrina").includes("nrs"), false);
  const sales = { mailbox: "pricingsales", assignedUsers: [] as string[] } as Parameters<typeof inbox.canSeeInboxItem>[2];
  const pricing = { mailbox: "pricing", assignedUsers: [] as string[] } as Parameters<typeof inbox.canSeeInboxItem>[2];
  assert.equal(inbox.canSeeInboxItem("cathrina", "pricing", sales), false);
  assert.equal(inbox.canSeeInboxItem("newnrs", "pricing", sales), true);
  assert.equal(inbox.canSeeInboxItem("newfree", "pricing", sales), true);
  assert.equal(inbox.canSeeInboxItem("shashank", "pricing", pricing), false);
  assert.equal(inbox.canSeeInboxItem("newair", "pricing", pricing), true);
  assert.equal(inbox.canSeeInboxItem("newsea", "pricing", pricing), true);

  // New enquiries are routed to whoever holds the seat now.
  assert.equal(inbox.assignInboxUsers("pricing", "air").suggestedUser, "newair");
  assert.equal(inbox.assignInboxUsers("pricing", "sea").suggestedUser, "newsea");

  // The desk's history stays with the desk: the new person sees what earlier holders did.
  assert.equal(seats.sharesDeskWith("cathrina", "newnrs"), true);
  assert.equal(seats.sharesDeskWith("newnrs", "newnrs"), true);
  assert.equal(seats.sharesDeskWith("shashank", "newair"), true);
  assert.equal(seats.sharesDeskWith("shaheer", "newsea"), true);
  assert.equal(seats.sharesDeskWith("kavya", "newfree"), true);
  assert.equal(seats.sharesDeskWith("jaya", "newfree"), true);
  // …but desks stay separate from each other.
  assert.equal(seats.sharesDeskWith("shashank", "newsea"), false);
  assert.equal(seats.sharesDeskWith("cathrina", "newfree"), false);

  // A second handover keeps the whole chain.
  seats.upsertOccupant({ seatId: "nrs", loginId: "nrsthree", personName: "Third" });
  assert.equal(seats.sharesDeskWith("newnrs", "nrsthree"), true);
  assert.equal(seats.sharesDeskWith("cathrina", "nrsthree"), true);
  assert.deepEqual(seats.seatLoginIds("nrs").sort(), ["cathrina", "newnrs", "nrsthree"]);

  // The history travels with the shared seat record, so every computer agrees.
  const remote = seats.listOccupants().map((o) => ({ ...o }));
  assert.equal(seats.applyRemoteOccupants(remote), false); // identical → no-op
  assert.equal((remote.find((o) => o.seatId === "nrs")?.previousLogins ?? []).includes("newnrs"), true);

  // Putting a seat back to its default restores the original holder.
  seats.removeOccupant("nrs");
  assert.equal(rbac.isNrsUser("cathrina"), true);
  assert.equal(rbac.isNrsUser("nrsthree"), false);

  console.log("desk-seat-handover.test.ts: all assertions passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
