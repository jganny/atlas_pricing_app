import assert from "node:assert/strict";
import { askedForQuote, greetingName, isOpsFollowUp, isOwnFrom, isQuoteDelivered, isRateEnquiryToQuote, isReplySubject, isVendorRateOffer } from "./rate-enquiry";

assert.equal(isReplySubject("RE: SB26264// RFQ - Import Sea"), true);
assert.equal(isReplySubject("RFQ - Import Sea"), false);

assert.equal(
  askedForQuote("RE: SB26264// RFQ - Import Sea", "Please share the consignee details so we can issue the HBL."),
  false,
  "old RFQ in the Re: subject is not a new rate ask",
);
assert.equal(
  askedForQuote("Please quote BLR to LHR", "500 kg general cargo, FOB."),
  true,
);
assert.equal(
  askedForQuote("RE: SB26264// RFQ - Import Sea", "Please quote 1x40HC FCL INNSA to Jebel Ali."),
  true,
  "a reply that really asks for rates still is an enquiry",
);

assert.equal(isOpsFollowUp("RE: SB26264", "Please share the consignee details so we can issue the HBL."), true);
assert.equal(isOpsFollowUp("RE: Quote Request", "Shipping Address for the cargo is as below."), true);
assert.equal(isOpsFollowUp("RE: SB26264", "Please provide an urgent update. The shipment has still not moved."), true);
assert.equal(isOpsFollowUp("Origin charges / EGM details", "Kindly share origin charges and EGM number."), true);

assert.equal(
  isVendorRateOffer("Rate offer with CMA CGM", "Please find below our freight rates for Mundra."),
  true,
);
assert.equal(
  isVendorRateOffer("Revised rate", "Pls find our revised rate for 1x40HC as follows."),
  true,
);
assert.equal(
  isVendorRateOffer("MAA-DAMMAM OFFER BEST RATE -REG", "Kindly offer best DG rate MAA to Dammam."),
  false,
  "a customer asking us to offer a rate is an enquiry, not a vendor sheet",
);
assert.equal(
  isVendorRateOffer("New inquiry", "Kindly revert with your best offer of below new inquiry."),
  false,
);

assert.equal(
  isRateEnquiryToQuote({
    tag: "new_enquiry",
    subject: "RE: SB26264// RFQ - Import Sea",
    bodyPreview: "Please share the consignee details so we can issue the HBL. RFQ Import Sea.",
  }),
  false,
  "Asyad-style confirmation follow-up is not Next enquiry even if RFQ is still in the preview",
);
assert.equal(
  isRateEnquiryToQuote({ tag: "new_enquiry", subject: "Rate request BLR-LHR", bodyPreview: "Please quote 200 kg" }),
  true,
);
assert.equal(isRateEnquiryToQuote({ tag: "follow_up", subject: "RE: rates" }), false);
assert.equal(isRateEnquiryToQuote({ tag: "escalation", subject: "Shortage on AWB" }), true);
assert.equal(
  isRateEnquiryToQuote({
    tag: "new_enquiry",
    subject: "Rate offer with CMA CGM",
    bodyPreview: "Please find below our freight rates for Mundra.",
  }),
  false,
  "a vendor rate sheet must not sit as a delayed enquiry",
);
assert.equal(
  isRateEnquiryToQuote({
    tag: "new_enquiry",
    subject: "RE: Quote Request",
    bodyPreview: "Shipping Address\nGSTIN: 29ABCDE1234F1Z5",
  }),
  false,
  "a Re: RFQ that only sends a shipping address is ops, not a new enquiry",
);
assert.equal(
  isRateEnquiryToQuote({
    tag: "needs_human",
    subject: "Packing list",
    bodyPreview: "FYI attached.",
  }),
  false,
  "unclear mail does not run the delayed-enquiry clock",
);
assert.equal(
  isRateEnquiryToQuote({
    tag: "new_enquiry",
    subject: "SEA new shipment flexi tanks",
    bodyPreview: "Kindly revert with your best offer of below new inquiry.",
  }),
  true,
  "a customer new inquiry still is an enquiry",
);
assert.equal(
  isRateEnquiryToQuote({
    tag: "needs_human",
    subject: "Packing list",
    bodyPreview: "Please share the rates as per attached packing list.",
  }),
  false,
);
assert.equal(
  askedForQuote("Packing list", "Please share the rates as per attached packing list."),
  true,
);
assert.equal(
  askedForQuote("Air import", "Please give us Air import Ex works ex China."),
  true,
);

const awwab = {
  tag: "new_enquiry" as const,
  from: "Atlaslogistics <pricing@atlaslogistics.co.in>",
  subject: "Air Freight // BLR to Qatar // 560 Kgs",
  bodyPreview: "Dear Awwab Pls find below quote for said shipment",
};
assert.equal(isQuoteDelivered(awwab.subject, awwab.bodyPreview), true);
assert.equal(askedForQuote(awwab.subject, awwab.bodyPreview), false, "a quote being sent is not an RFQ");
assert.equal(isOwnFrom(awwab.from), true);
assert.equal(greetingName("Dear Awwab\n\nPls find below quote for said shipment"), "Awwab");
assert.equal(isRateEnquiryToQuote(awwab), false, "internal quote-share must not run the late clock");
assert.equal(
  isRateEnquiryToQuote({ tag: "new_enquiry", from: "Fatima <fatima@doha-trade.qa>", subject: "Air Freight // BLR to Qatar // 560 Kgs", bodyPreview: "Dear Team, please quote 560 kgs from Bangalore to Doha." }),
  true,
  "the customer's original RFQ still waits until it is replied",
);
assert.equal(
  isRateEnquiryToQuote({ tag: "new_enquiry", from: "Fatima <fatima@doha-trade.qa>", subject: "Please quote BLR-DOH", bodyPreview: "560 kg", repliedAt: 1 }),
  false,
  "once the desk has replied, it is not pending",
);

console.log("rate-enquiry tests passed");
