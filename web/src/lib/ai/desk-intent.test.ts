import assert from "node:assert/strict";
import { newQuoteHref, parseDeskIntent } from "./desk-intent";

const airLane = parseDeskIntent("quote BLR to LHR");
assert.equal(airLane.kind, "new");
if (airLane.kind === "new") {
  assert.equal(airLane.mode, "air");
  assert.equal(airLane.origin, "BLR");
  assert.equal(airLane.dest, "LHR");
  assert.equal(newQuoteHref(airLane), "/air?origin=BLR&dest=LHR");
}

const seaDesk = parseDeskIntent("sea desk");
assert.equal(seaDesk.kind, "goto");
if (seaDesk.kind === "goto") {
  assert.equal(seaDesk.href, "/sea");
}

const findCustomer = parseDeskIntent("Acme Logistics");
assert.equal(findCustomer.kind, "find");
if (findCustomer.kind === "find") {
  assert.equal(findCustomer.query, "Acme Logistics");
}

console.log("desk-intent.test.ts ok");
