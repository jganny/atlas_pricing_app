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
  const ce = await import("./custom-entries");
  const { searchHsnCommodities } = await import("./pricing/hsn");
  const { searchCarriers } = await import("./carriers/directory");

  // Lists saved by the original app (same document shapes) are read as they are.
  ce.applyRemoteCustomEntries("customers", ["Acme Traders", "Beta Exports"]);
  ce.applyRemoteCustomEntries("seaports", [{ code: "INXYZ", name: "Xyz Port" }]);
  ce.applyRemoteCustomEntries("shippinglines", ["Hapag Lloyd"]);
  ce.applyRemoteCustomEntries("linernames", ["Zim Integrated"]);
  ce.applyRemoteCustomEntries("airlines", ["Local Cargo Air"]);
  ce.applyRemoteCustomEntries("sea_commodities", ["Wind turbine blades"]);
  assert.deepEqual(ce.customNames("customers"), ["Acme Traders", "Beta Exports"]);
  assert.deepEqual(ce.customPorts("seaports"), [{ code: "INXYZ", name: "Xyz Port" }]);

  // They show up in the dropdowns' searches.
  assert.equal(searchHsnCommodities("wind turbine").some((i) => i.name === "Wind turbine blades"), true);
  const lines = await searchCarriers("Hapag", "ocean", 5);
  assert.equal(lines.some((c) => c.name === "Hapag Lloyd" && c.kind === "ocean"), true);
  const liners = await searchCarriers("Zim", "ocean", 5);
  assert.equal(liners.some((c) => c.name === "Zim Integrated"), true);
  const air = await searchCarriers("Local Cargo", "airline", 5);
  assert.equal(air.some((c) => c.name === "Local Cargo Air"), true);
  // …and only in the right kind of dropdown.
  assert.equal((await searchCarriers("Hapag", "airline", 5)).some((c) => c.name === "Hapag Lloyd"), false);

  // Remembering a new name: shared once, ignored when it's already known (any capitalisation) or too short.
  const written: Array<[string, unknown]> = [];
  ce.setCustomEntryWriter((type, entry) => void written.push([type, entry]));
  assert.equal(ce.rememberCustomEntry("customers", "  Gamma   Freight "), true);
  assert.equal(ce.rememberCustomEntry("customers", "gamma freight"), false);
  assert.equal(ce.rememberCustomEntry("customers", "acme traders"), false);
  assert.equal(ce.rememberCustomEntry("customers", "x"), false);
  assert.deepEqual(written, [["customers", "Gamma Freight"]]);
  assert.equal(ce.customNames("customers").includes("Gamma Freight"), true);

  // The shared copy replaces the local one; an identical copy changes nothing (no needless re-renders).
  let notified = 0;
  const off = ce.subscribeCustomEntries(() => notified++);
  const before = ce.getCustomEntriesVersion();
  ce.applyRemoteCustomEntries("customers", ["Acme Traders", "Beta Exports", "Gamma Freight"]);
  assert.equal(ce.getCustomEntriesVersion(), before);
  ce.applyRemoteCustomEntries("customers", ["Acme Traders"]);
  assert.equal(notified, 1);
  assert.deepEqual(ce.customNames("customers"), ["Acme Traders"]);
  off();

  // A fresh start (new browser) loads what was saved locally.
  ce.resetCustomEntriesForTests();
  assert.deepEqual(ce.customNames("customers"), ["Acme Traders"]);

  console.log("custom-entries.test.ts: all assertions passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
