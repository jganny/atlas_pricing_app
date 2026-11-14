import assert from "node:assert/strict";
import { readyForPricedComparison } from "./smart-quote-prefill";
import type { ParsedEnquiry } from "@/lib/types";

const base: ParsedEnquiry = {
  customer: "Acme",
  origin: "",
  destination: "",
  packages: [],
  containers: [],
  confidence: 80,
  source: "email-imap",
};

assert.equal(readyForPricedComparison(base, "air"), false);
assert.equal(readyForPricedComparison({ ...base, origin: "BOM", destination: "DXB" }, "air"), false);
assert.equal(
  readyForPricedComparison({ ...base, origin: "BOM", destination: "DXB", packages: [{ qty: 2, gw: 10, l: 40, w: 30, h: 20 }] }, "air"),
  true,
);
assert.equal(
  readyForPricedComparison({ ...base, origin: "INNSA", destination: "NLRTM", containers: [{ type: "40HC", qty: 1 }] }, "sea"),
  true,
);

console.log("smart-quote-prefill tests passed");
