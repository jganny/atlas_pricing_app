const assert = require("assert");
const { detectEscalation: d } = require("./inbox-escalation");

// Problems on shipments.
assert.strictEqual(d({ subject: "RE: MAWB 176-12345678 discrepancy in weight", body: "Please check, the invoice shows 120 kg but received 112 kg." }).isEscalation, true);
assert.strictEqual(d({ subject: "Shipment BLR to FRA damaged cartons", body: "3 cartons arrived damaged, claim to follow." }).isEscalation, true);
assert.strictEqual(d({ subject: "RE: Booking 4567 delayed", body: "The flight was rolled over, please advise." }).isEscalation, true);
assert.strictEqual(d({ subject: "Detention charges on container MSKU1234567", body: "Please explain the demurrage." }).isEscalation, true);
assert.strictEqual(d({ subject: "RE: HAWB mismatch", body: "Shipper name differs from the invoice." }).isEscalation, true, "a reply on a thread counts as shipment context");

// Not problems.
assert.strictEqual(d({ subject: "Rates BOM to NRT please", body: "Kindly quote for 220 kg. Any delay will cost us." }).isEscalation, false, "asking for a rate is an enquiry");
assert.strictEqual(d({ subject: "Air BOM to DXB 100 kg", body: "Best rates please, damage cover required" }).isEscalation, false, "wording of an enquiry");
assert.strictEqual(d({ subject: "Thanks", body: "Received the documents, all ok." }).isEscalation, false);
assert.strictEqual(d({ subject: "Meeting tomorrow", body: "There is a delay in the meeting." }).isEscalation, false, "no shipment reference and not a reply");
assert.strictEqual(d({ subject: "Newsletter: claim your prize", body: "" }).isEscalation, false);

// A rate request that also complains is still a problem.
assert.strictEqual(d({ subject: "RE: Quote for HAWB 99887766 complaint", body: "We have a complaint about the last shipment, damaged goods. Please quote again." }).isEscalation, true);

const r = d({ subject: "RE: Shipment short shipped", body: "10 cartons shipped, 8 received" });
assert.match(r.reason, /short shipped|short-shipped|short ship/i);
console.log("inbox-escalation tests passed");
