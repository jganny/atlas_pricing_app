import assert from "node:assert/strict";
import { quotedLaneRows, selectWithinLane, usableLanes } from "./lanes";

const lanes = [
  { id: "l1", origin: "BOM — Mumbai", destination: "CMB — Colombo" },
  { id: "l2", origin: "DEL", destination: "LHR" },
];

const items = [
  { id: "ul", name: "UL — SriLankan Airlines", selected: true, laneId: "l1" },
  { id: "ek", name: "EK — Emirates SkyCargo", selected: true, laneId: "l2" },
  { id: "ey", name: "EY — Etihad Cargo", selected: false, laneId: "l2" },
];

const next = selectWithinLane(items, "ey", "l1");
assert.equal(next.find((x) => x.id === "ul")?.selected, true, "lane 1 quoted airline stays selected");
assert.equal(next.find((x) => x.id === "ey")?.selected, true);
assert.equal(next.find((x) => x.id === "ek")?.selected, false);

const rows = quotedLaneRows(lanes, items, (a) => (a.id === "ul" ? 400 : a.id === "ek" ? 500 : 0));
assert.equal(rows.length, 2);
assert.equal(rows[0].airline, "UL — SriLankan Airlines");
assert.equal(rows[1].airline, "EK — Emirates SkyCargo");
assert.equal(usableLanes([{ id: "x", origin: "", destination: "" }]).length, 0);

console.log("lane helpers tests passed");
