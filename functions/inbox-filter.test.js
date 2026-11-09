const assert = require("node:assert/strict");
const { prefilter, headerFlags } = require("./inbox-filter");

const v = (o) => prefilter({ from: "buyer@acme.com", subject: "", body: "", ...o }).verdict;

// --- clearly not enquiries: dropped without any AI ---
assert.equal(v({ headers: new Map([["list-unsubscribe", "<mailto:u@x.com>"]]), subject: "Quote of the day: rates are changing", body: "please quote this offer" }), "noise", "a mailing list is noise even if it says quote");
assert.equal(v({ headers: new Map([["auto-submitted", "auto-replied"]]), subject: "Re: your quote", body: "I am out" }), "noise");
assert.equal(v({ headers: new Map([["auto-submitted", "no"]]), subject: "Please quote BLR to FRA", body: "500 kg" }), "sure", "Auto-Submitted: no is a person, and this is a clear enquiry");
assert.equal(v({ headers: { Precedence: "bulk" }, subject: "x" }), "noise");
assert.equal(v({ from: "noreply@maersk.com", subject: "Booking update", body: "" }), "noise");
assert.equal(v({ from: "Mailer-Daemon@x.com", subject: "Undelivered Mail Returned to Sender" }), "noise");
assert.equal(v({ from: "alerts@bank.com", subject: "Alert" }), "noise");
assert.equal(v({ subject: "Automatic reply: Out of office", body: "I am away" }), "noise");
assert.equal(v({ subject: "Webinar: Air cargo trends 2027", body: "register now, rates and routes" }), "noise");
assert.equal(v({ subject: "Thanks", body: "Thank you for the quick reply. Regards" }), "noise", "no enquiry in it");
assert.equal(v({ subject: "Meeting tomorrow", body: "Shall we meet at 3pm?" }), "noise");
assert.equal(v({ subject: "Invoice 4421 attached", body: "Please find the invoice for your records." }), "noise");
assert.equal(v({ subject: "Newsletter", body: "Click here to unsubscribe" }), "noise");

// --- clearly enquiries: kept without asking the AI ---
assert.equal(v({ subject: "Rate request BLR - FRA", body: "Please quote for 3 cartons, 180 kg gross weight, from Bangalore to Frankfurt, ex works." }), "sure");
assert.equal(v({ subject: "RFQ FCL", body: "Kindly quote 1 x 40HC FCL, POL INNSA POD NLRTM, FOB." }), "sure");

// --- unclear: the AI decides ---
assert.equal(v({ subject: "Need rates", body: "Hi, can you share rates for our regular lane? Thanks" }), "maybe", "asks but gives no route or cargo");
assert.equal(v({ subject: "Shipment", body: "3 pallets, 450 kg, from Chennai to Dubai tomorrow." }), "maybe", "cargo and a route but no ask");
assert.equal(v({ subject: "Re: Quotation", body: "Can you reduce the price? We need it urgently." }), "maybe", "a follow-up on a quote");

// --- header handling ---
assert.deepEqual(headerFlags(new Map()), { bulk: false, auto: false });
assert.deepEqual(headerFlags({ "List-Id": "x" }), { bulk: true, auto: false }, "any letter case");
assert.deepEqual(headerFlags(undefined), { bulk: false, auto: false });
assert.deepEqual(headerFlags(new Map([["x-autoreply", "yes"]])), { bulk: false, auto: true });

// --- cost: out of a typical day's mail, how much reaches the AI ---
{
  const day = [
    ...Array(300).fill({ subject: "Weekly newsletter", body: "unsubscribe here", headers: new Map([["list-unsubscribe", "x"]]) }),
    ...Array(80).fill({ from: "noreply@carrier.com", subject: "Shipment notification", body: "your shipment" }),
    ...Array(60).fill({ subject: "Thanks", body: "ok thanks" }),
    ...Array(30).fill({ subject: "Please quote", body: "Kindly quote 200 kg from BLR to DXB ex works" }),
    ...Array(20).fill({ subject: "Rates?", body: "can you share rates" }),
  ].map((m) => prefilter({ from: "a@b.com", ...m }).verdict);
  const count = (x) => day.filter((d) => d === x).length;
  assert.deepEqual([count("noise"), count("sure"), count("maybe")], [440, 30, 20], "490 of 490 sorted; only 20 go to the AI");
}
console.log("inbox filter ok");
