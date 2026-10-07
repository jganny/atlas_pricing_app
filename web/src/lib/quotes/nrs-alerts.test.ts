import assert from "node:assert/strict";

// minimal browser stubs (the store reads window/localStorage)
const store: Record<string, string> = {};
let events = 0;
(globalThis as unknown as { window: object }).window = {
  dispatchEvent: () => {
    events++;
    return true;
  },
};
(globalThis as unknown as { Event: unknown }).Event = class {};
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
};

(async () => {
  const nrs = await import("./nrs-alerts");

  // Before the shared database is connected it behaves as before (local only).
  const solo = nrs.pushNrsFollowUp({ quoteId: "q0", ref: "R0", customer: "Solo" });
  assert.equal(nrs.listNrsFollowUps().length, 1);
  assert.equal(solo.status, "pending");

  // Connect the shared store: writes are mirrored by desk, not kept per browser.
  const saved: string[] = [];
  const removed: string[] = [];
  const alerts: string[] = [];
  nrs.setNrsMirror({
    saveFollowUp: (r) => void saved.push(r.id),
    removeFollowUp: (id) => void removed.push(id),
    saveAlert: (a) => void alerts.push(a.id),
  });

  const fu = nrs.pushNrsFollowUp({ quoteId: "q1", ref: "R1", customer: "Acme", buyRate: 5, sellRate: 7 });
  assert.deepEqual(saved, [fu.id]);
  const al = nrs.pushNrsAlert("Confirm R1", "R1");
  assert.deepEqual(alerts, [al.id]);

  // Re-raising the same pending quote replaces the old row in the shared copy too.
  const again = nrs.pushNrsFollowUp({ quoteId: "q1", ref: "R1", customer: "Acme" });
  assert.deepEqual(removed, [fu.id]);
  assert.equal(nrs.listNrsFollowUps().filter((f) => f.quoteId === "q1").length, 1);

  // Edits and completion reach the shared copy.
  nrs.updateNrsFollowUp(again.id, { status: "complete", notes: "done" });
  assert.equal(saved.at(-1), again.id);
  nrs.dismissNrsAlert(al.id);
  assert.equal(alerts.at(-1), al.id);

  // First connection from a browser that already holds follow-ups: they are
  // copied up (nothing lost) and merged with what the desk already has.
  const migrated: string[] = [];
  nrs.setNrsMirror({
    saveFollowUp: (r) => void migrated.push(r.id),
    removeFollowUp: () => {},
    saveAlert: () => {},
  });
  delete store["atlas_nrs_followups_shared_v1"];
  const remoteRow = {
    id: "remote-1", quoteId: "q9", ref: "R9", customer: "Remote Co", buyRate: 0, sellRate: 0,
    shipper: "", consignee: "", commodity: "", status: "pending" as const, notes: "",
    followUpDate: "2026-10-01", createdAt: "2099-01-01T00:00:00.000Z", updatedAt: "2099-01-01T00:00:00.000Z",
  };
  nrs.applyRemoteNrsFollowUps([remoteRow]);
  const ids = nrs.listNrsFollowUps().map((f) => f.id);
  assert.equal(ids.includes("remote-1"), true); // the desk's shared row
  assert.equal(ids.includes(again.id), true); // this browser's own row survived
  assert.equal(migrated.includes(again.id) && migrated.includes(solo.id), true); // …and was shared
  assert.equal(migrated.includes("remote-1"), false); // shared rows aren't re-uploaded
  assert.equal(ids[0], "remote-1"); // newest first
  assert.equal(events > 0, true); // screens are told to refresh

  // After that first connection the shared list is the truth: a row someone
  // removed elsewhere disappears here instead of being resurrected.
  nrs.applyRemoteNrsFollowUps([remoteRow]);
  assert.deepEqual(nrs.listNrsFollowUps().map((f) => f.id), ["remote-1"]);

  console.log("nrs-alerts.test.ts: all assertions passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
