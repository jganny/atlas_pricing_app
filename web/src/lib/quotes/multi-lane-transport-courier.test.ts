// Transport and Courier gained the same multi-O/D + multi-carrier comparison
// Air and Sea already had (one seat per lane, multiple vendors compared per
// lane, the cheapest and the quoted one marked independently per lane). This
// file proves the shared pieces they were wired onto behave correctly for
// both desks, and that the print/PDF builder (quote-document.ts) needed no
// changes at all — it already reads laneId/laneLabel generically off any
// vendor kind.
import assert from "node:assert/strict";
import type { SavedQuote } from "../types";
import {
  createCourierOption,
  createTruckerOption,
  defaultCourierSurcharges,
} from "../pricing/carrier-options";
import { courierSnapshot, truckerSnapshot } from "./option-breakdown";
import { vendorRowsFromQuote } from "./vendor-preview";
import { groupOptionsByLane } from "./quote-document";
import { plainLaneLabel } from "./lanes";

const lanes = [
  { id: "l1", origin: "560001 Bangalore", destination: "400001 Mumbai" },
  { id: "l2", origin: "500001 Hyderabad", destination: "110001 Delhi" },
];

// ── carrier-options.ts factories ────────────────────────────────────────────
{
  const t = createTruckerOption({});
  assert.equal(t.laneId, "", "trucker defaults to no lane override (first/only lane)");
  const t2 = createTruckerOption({ laneId: "l2" });
  assert.equal(t2.laneId, "l2");

  const c = createCourierOption({});
  assert.equal(c.laneId, "");
  assert.equal(c.carrierId, "dhl");
  assert.equal(c.service, "economy");
  assert.equal(c.marginPct, 12);
  assert.deepEqual(c.surcharges, defaultCourierSurcharges());
  const c2 = createCourierOption({ laneId: "l1", directoryCarrier: "FedEx", carrierId: "fedex" });
  assert.equal(c2.laneId, "l1");
  assert.equal(c2.directoryCarrier, "FedEx");
}

// ── truckerSnapshot: lane label uses the RAW place string (plainLaneLabel),
//    never the airport-code truncation laneRouteLabel would apply ─────────────
{
  const t = createTruckerOption({ name: "ABC Transport", laneId: "l2", freightSell: 5000, detention: 200 }, true);
  const row = truckerSnapshot(t, "15 days", lanes, "l1", plainLaneLabel);
  assert.equal(row.laneId, "l2");
  assert.equal(row.laneLabel, "Lane 2 · 500001 Hyderabad → 110001 Delhi");
  assert.equal(row.quoteTotal, 5200);
  assert.equal(row.kind, "trucker");

  // No lanes passed (single-lane desk, back-compat call shape) — falls back cleanly.
  const bare = truckerSnapshot(t, "15 days");
  assert.equal(bare.laneId, "l2");
  assert.equal(bare.laneLabel, "");
}

// ── courierSnapshot: carries the full card (carrier/service/margin/surcharges)
//    so a saved card can be reloaded and re-edited, not just its total ───────
// Courier's own lanes are airport codes (same as Air), so laneRouteLabel's
// airport-code split is the right helper here — unlike Transport's free-text
// ZIP/place fields, this never truncates.
{
  const courierLanes = [
    { id: "l1", origin: "BLR", destination: "DXB" },
    { id: "l2", origin: "DEL", destination: "LHR" },
  ];
  const c = createCourierOption(
    { directoryCarrier: "FedEx", carrierId: "fedex", service: "express", marginPct: 15, laneId: "l1" },
    true,
  );
  const row = courierSnapshot(
    c,
    { name: "FedEx", sellLocal: 2400, ratePerKg: 120, transit: "2-3 days", chargeableKg: 20, gstAmount: 366 },
    courierLanes,
    "l1",
  );
  assert.equal(row.laneId, "l1");
  assert.equal(row.laneLabel, "Lane 1 · BLR → DXB");
  assert.equal(row.directoryCarrier, "FedEx");
  assert.equal(row.carrierId, "fedex");
  assert.equal(row.service, "express");
  assert.equal(row.marginPct, 15);
  assert.equal(row.quoteTotal, 2400);
  assert.equal(row.gst, 366, "GST only carried for the selected card");

  const notSelected = courierSnapshot(
    createCourierOption({}, false),
    { name: "DHL", sellLocal: 3000, gstAmount: 400 },
    courierLanes,
    "l1",
  );
  assert.equal(notSelected.gst, 0, "an unselected card never carries the quote's GST");
}

// ── vendorRowsFromQuote: transport, multi-lane, cheapest marked PER LANE ─────
{
  const quote: SavedQuote = {
    id: "q1",
    customer: "Acme",
    creator: "ganny",
    status: "quoted",
    type: "transport",
    amount: 7000,
    currency: "INR",
    route: "560001 Bangalore → 400001 Mumbai · 500001 Hyderabad → 110001 Delhi",
    details: {
      lanes,
      truckers: [
        truckerSnapshot(createTruckerOption({ name: "Cheap Carrier", laneId: "l1", freightSell: 3000 }, true), "", lanes, "l1", plainLaneLabel),
        truckerSnapshot(createTruckerOption({ name: "Pricey Carrier", laneId: "l1", freightSell: 5000 }, false), "", lanes, "l1", plainLaneLabel),
        // Lane 2's cheapest carrier costs MORE than lane 1's pricier one — proves
        // cheapest is marked within each lane independently, not across the quote.
        truckerSnapshot(createTruckerOption({ name: "Only Option", laneId: "l2", freightSell: 9000 }, true), "", lanes, "l1", plainLaneLabel),
      ],
    },
  };
  const rows = vendorRowsFromQuote(quote);
  assert.equal(rows.length, 3);
  const lane1 = rows.filter((r) => r.laneId === "l1");
  const lane2 = rows.filter((r) => r.laneId === "l2");
  assert.equal(lane1.find((r) => r.name === "Cheap Carrier")?.cheapest, true);
  assert.equal(lane1.find((r) => r.name === "Pricey Carrier")?.cheapest, false);
  assert.equal(lane2.find((r) => r.name === "Only Option")?.cheapest, true, "sole option on its lane is its own lane's cheapest");
}

// ── vendorRowsFromQuote: courier, multi-lane ─────────────────────────────────
{
  const quote: SavedQuote = {
    id: "q2",
    customer: "Acme",
    creator: "ganny",
    status: "quoted",
    type: "courier",
    amount: 5400,
    currency: "INR",
    route: "BLR → DXB · DEL → LHR",
    details: {
      lanes: [
        { id: "l1", origin: "BLR", destination: "DXB" },
        { id: "l2", origin: "DEL", destination: "LHR" },
      ],
      carrierQuotes: [
        courierSnapshot(
          createCourierOption({ directoryCarrier: "FedEx", laneId: "l1" }, true),
          { name: "FedEx", sellLocal: 2000 },
          [{ id: "l1", origin: "BLR", destination: "DXB" }, { id: "l2", origin: "DEL", destination: "LHR" }],
          "l1",
        ),
        courierSnapshot(
          createCourierOption({ directoryCarrier: "DHL", laneId: "l1" }, false),
          { name: "DHL", sellLocal: 1800 },
          [{ id: "l1", origin: "BLR", destination: "DXB" }, { id: "l2", origin: "DEL", destination: "LHR" }],
          "l1",
        ),
        courierSnapshot(
          createCourierOption({ directoryCarrier: "Blue Dart", laneId: "l2" }, true),
          { name: "Blue Dart", sellLocal: 900 },
          [{ id: "l1", origin: "BLR", destination: "DXB" }, { id: "l2", origin: "DEL", destination: "LHR" }],
          "l1",
        ),
      ],
    },
  };
  const rows = vendorRowsFromQuote(quote);
  assert.equal(rows.length, 3);
  assert.equal(rows.find((r) => r.name === "DHL")?.cheapest, true, "DHL is cheaper than FedEx on lane 1");
  assert.equal(rows.find((r) => r.name === "FedEx")?.selected, true, "FedEx is still the quoted (selected) one, cheapest != quoted");
  assert.equal(rows.find((r) => r.name === "Blue Dart")?.laneId, "l2");
}

// ── quote-document.ts's groupOptionsByLane needs zero changes for these kinds:
//    it groups purely by laneId/laneLabel, generic to whatever `kind` the row is ──
{
  const options = [
    { id: "a", name: "FedEx", kind: "courier", kindLabel: "Courier", total: 2000, selected: true, cheapest: false, laneId: "l1", laneLabel: "Lane 1 · BLR → DXB" },
    { id: "b", name: "Blue Dart", kind: "courier", kindLabel: "Courier", total: 900, selected: true, cheapest: true, laneId: "l2", laneLabel: "Lane 2 · DEL → LHR" },
  ];
  const groups = groupOptionsByLane(options);
  assert.equal(groups.length, 2, "one PDF section per lane, same as Air/Sea");
  assert.equal(groups[0].laneLabel, "Lane 1 · BLR → DXB");
  assert.equal(groups[1].options[0].name, "Blue Dart");
}

console.log("multi-lane transport/courier tests passed");
