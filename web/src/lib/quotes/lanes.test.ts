import assert from "node:assert/strict";
import {
  laneRouteLabel,
  optionsOnLane,
  plainLaneLabel,
  quotedLaneRows,
  selectWithinLane,
  stampOntoFirstLane,
  usableLanes,
} from "./lanes";

const lanes = [
  { id: "l1", origin: "BOM — Mumbai", destination: "CMB — Colombo" },
  { id: "l2", origin: "DEL", destination: "LHR" },
];

const items = [
  { id: "ul", name: "UL — SriLankan Airlines", selected: true, laneId: "l1", validity: "2026-09-11", routing: "CMB", tt: "1" },
  { id: "ek", name: "EK — Emirates SkyCargo", selected: true, laneId: "l2", validity: "2026-09-20", routing: "DXB", tt: "4" },
  { id: "ey", name: "EY — Etihad Cargo", selected: false, laneId: "l2", validity: "2026-09-18", routing: "AUH", tt: "3" },
];

const next = selectWithinLane(items, "ey", "l1");
assert.equal(next.find((x) => x.id === "ul")?.selected, true, "lane 1 quoted airline stays selected");
assert.equal(next.find((x) => x.id === "ey")?.selected, true);
assert.equal(next.find((x) => x.id === "ek")?.selected, false);

const rows = quotedLaneRows(lanes, items, (a) => (a.id === "ul" ? 400 : a.id === "ek" ? 500 : 0));
assert.equal(rows.length, 2);
assert.equal(rows[0].airline, "UL — SriLankan Airlines");
assert.equal(rows[0].validity, "2026-09-11");
assert.equal(rows[1].airline, "EK — Emirates SkyCargo");
assert.equal(rows[1].validity, "2026-09-20");
assert.equal(usableLanes([{ id: "x", origin: "", destination: "" }]).length, 0);

// plainLaneLabel keeps the raw text (Transport's ZIP/place fields), where
// laneRouteLabel's airport-code split would drop everything after the first
// space — exactly the truncation this helper exists to avoid.
assert.equal(
  plainLaneLabel({ origin: "560001 Bangalore", destination: "400001 Mumbai" }, 0),
  "Lane 1 · 560001 Bangalore → 400001 Mumbai",
);
assert.equal(plainLaneLabel({ origin: "", destination: "400001 Mumbai" }, 2), "Lane 3");
assert.notEqual(
  laneRouteLabel({ origin: "560001 Bangalore", destination: "400001 Mumbai" }, 0),
  "Lane 1 · 560001 Bangalore → 400001 Mumbai",
  "airport-code label truncates a plain place string — this documents why Transport uses plainLaneLabel instead",
);

// stampOntoFirstLane: a card created before any second lane existed (laneId
// "") would otherwise match EVERY lane's optionsOnLane filter — it must be
// pinned to the first lane the moment a second lane is added, or it silently
// appears to "belong" to every lane in the compare list and the PDF.
{
  const preExisting = [{ id: "u1", laneId: "" }];
  const beforeStamp = optionsOnLane(preExisting, "l2", "l1");
  assert.equal(beforeStamp.length, 1, "documents the bug: an un-laned card matches a lane it never saw");

  const stamped = stampOntoFirstLane(preExisting, "l1");
  assert.equal(stamped[0].laneId, "l1");
  assert.equal(optionsOnLane(stamped, "l2", "l1").length, 0, "now correctly absent from lane 2");
  assert.equal(optionsOnLane(stamped, "l1", "l1").length, 1, "still present on lane 1, where it always lived");

  // Already-laned items are left alone, and an empty firstLaneId is a no-op.
  const untouched = stampOntoFirstLane([{ id: "x", laneId: "l2" }], "l1");
  assert.equal(untouched[0].laneId, "l2");
  assert.deepEqual(stampOntoFirstLane(preExisting, ""), preExisting);
}

console.log("lane helpers tests passed");
