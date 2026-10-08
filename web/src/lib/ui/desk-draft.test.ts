import assert from "node:assert/strict";
import { draftAgeLabel, draftFingerprint, draftKey, readDraft, removeDraft, writeDraft } from "./desk-draft";

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
};

// Drafts are per desk and per person.
assert.notEqual(draftKey("air", "shashank"), draftKey("sea", "shashank"));
assert.notEqual(draftKey("air", "shashank"), draftKey("air", "shaheer"));
assert.equal(draftKey("air", "Shashank"), draftKey("air", "shashank"));

// An untouched form always fingerprints the same, even though its internal ids are new every visit…
const blank = (id: string) => ({ customer: "", lanes: [{ id, origin: "", destination: "" }], airlines: [{ id: `a-${id}`, laneId: id, name: "" }], step: "shipment" });
assert.equal(draftFingerprint(blank("x1")), draftFingerprint(blank("y2")));
// …and merely moving between steps is not an edit.
assert.equal(draftFingerprint({ ...blank("x1"), step: "carrier" }), draftFingerprint(blank("x1")));
// Anything the user types is.
assert.notEqual(draftFingerprint({ ...blank("x1"), customer: "Acme" }), draftFingerprint(blank("x1")));
assert.notEqual(draftFingerprint({ ...blank("x1"), lanes: [{ id: "x1", origin: "BLR", destination: "" }] }), draftFingerprint(blank("x1")));

// Save, read back after a "restart", remove.
const key = draftKey("air", "shashank");
assert.equal(readDraft(key), null);
assert.equal(writeDraft(key, { v: 1, savedAt: "2026-10-08T10:00:00.000Z", summary: "Acme · BLR → LHR", state: { customer: "Acme", cargo: [{ gw: 12.5 }] } }), true);
const back = readDraft<{ customer: string; cargo: Array<{ gw: number }> }>(key);
assert.equal(back?.state.customer, "Acme");
assert.equal(back?.state.cargo[0].gw, 12.5);
assert.equal(back?.summary, "Acme · BLR → LHR");
removeDraft(key);
assert.equal(readDraft(key), null);

// Damaged or foreign data never breaks a desk.
store[key] = "not json";
assert.equal(readDraft(key), null);
store[key] = JSON.stringify({ v: 2, state: {} });
assert.equal(readDraft(key), null);

// Friendly times.
const now = new Date("2026-10-08T18:00:00");
assert.match(draftAgeLabel("2026-10-08T15:42:00", now), /^today /);
assert.match(draftAgeLabel("2026-10-07T09:05:00", now), /^yesterday /);
assert.equal(draftAgeLabel("garbage", now), "earlier");

console.log("desk-draft.test.ts: all assertions passed");
