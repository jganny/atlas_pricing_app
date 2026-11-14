import assert from "node:assert/strict";
import { identityLines, mailIdentity, salespersonOf } from "./enquiry-identity";

const continuation = {
  from: "Atlaslogistics <pricing@atlaslogistics.co.in>",
  mailboxEmail: "pricingsales@atlaslogistics.co.in",
  toAddresses: ["pricingsales@atlaslogistics.co.in"],
  addressedTo: "Awwab",
  subject: "Air Freight // BLR to Qatar // 560 Kgs",
  bodyPreview: "Dear Awwab Pls find below quote for said shipment",
  assignedUsers: ["linson"],
};

const ident = mailIdentity(continuation);
assert.equal(ident.fromName, "Atlaslogistics");
assert.equal(ident.fromEmail, "pricing@atlaslogistics.co.in");
assert.equal(ident.toLine, "pricingsales@atlaslogistics.co.in");
assert.equal(ident.writtenTo, "Awwab");
assert.equal(ident.internal, true);
assert.equal(ident.quoteShare, true);
assert.equal(ident.salespersonLogin, "linson");

const origin = {
  from: "Fatima Al-Kuwari <fatima@doha-trade.example>",
  fromName: "Fatima Al-Kuwari",
  fromEmail: "fatima@doha-trade.example",
  mailboxEmail: "pricingsales@atlaslogistics.co.in",
  assignedUsers: ["linson"],
  subject: "Air Freight // BLR to Qatar // 560 Kgs",
};
const lines = identityLines(continuation, origin);
assert.deepEqual(
  lines.map((l) => l.label),
  ["From", "To", "Written to", "Kind", "Relates to"],
);
assert.match(lines.find((l) => l.label === "From")?.value || "", /Atlaslogistics/);
assert.equal(lines.find((l) => l.label === "To")?.value, "pricingsales@atlaslogistics.co.in");
assert.equal(lines.find((l) => l.label === "Written to")?.value, "Awwab");
assert.match(lines.find((l) => l.label === "Kind")?.value || "", /Internal Atlas quote/);
assert.match(lines.find((l) => l.label === "Relates to")?.value || "", /enquiry from Fatima/);
assert.equal(salespersonOf(origin)?.login, "linson");
assert.equal(
  salespersonOf({ assignedUsers: ["cathrina", "jabeena"], bodyPreview: "Any update on BOM–DXB rates?" })?.login,
  undefined,
  "the shared Free Hand / NRS desk is not named as the salesperson",
);

console.log("enquiry-identity tests passed");
