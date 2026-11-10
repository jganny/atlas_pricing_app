const assert = require("node:assert/strict");
const R = require("./inbox-reply");
const C = require("./inbox-confirm");

// --- who may be answered automatically ---
{
  const ok = (o) => R.canAutoReply({ fromAddr: "ravi@acme.com", subject: "Rate request", headers: new Map(), ...o });
  assert.equal(ok({}).ok, true);
  assert.equal(ok({ fromAddr: "someone@atlaslogistics.co.in" }).ok, false, "never our own people");
  assert.equal(ok({ fromAddr: "x@mail.atlaslogistics.co.in" }).ok, false, "or a sub-domain of ours");
  assert.equal(ok({ fromAddr: "noreply@carrier.com" }).ok, false);
  assert.equal(ok({ fromAddr: "mailer-daemon@x.com" }).ok, false);
  assert.equal(ok({ fromAddr: "not-an-address" }).ok, false);
  assert.equal(ok({ fromAddr: "" }).ok, false);
  assert.equal(ok({ headers: new Map([["auto-submitted", "auto-replied"]]) }).ok, false, "never answer a machine");
  assert.equal(ok({ headers: new Map([["list-unsubscribe", "x"]]) }).ok, false, "or a mailing list");
  assert.equal(ok({ subject: "Automatic reply: out of office" }).ok, false);
  assert.equal(ok({ subject: "Undeliverable: your message" }).ok, false);
}

// --- threads and subjects ---
assert.equal(R.threadRoot({ references: ["<a@x>", "<b@x>"], inReplyTo: "<b@x>", messageId: "<c@x>" }), "<a@x>", "the first message of the thread");
assert.equal(R.threadRoot({ inReplyTo: "<b@x>", messageId: "<c@x>" }), "<b@x>");
assert.equal(R.threadRoot({ messageId: "<c@x>" }), "<c@x>");
assert.equal(R.rePrefix("Rates BLR-FRA"), "Re: Rates BLR-FRA");
assert.equal(R.rePrefix("RE: Rates"), "RE: Rates", "no Re: Re:");
assert.equal(R.rePrefix(""), "Re: (no subject)");
assert.equal(R.greetingName("Ravi Kumar", "r@x.com"), "Ravi");
assert.equal(R.greetingName("", "priya.sharma@x.com"), "Priya");
assert.equal(R.greetingName("ravi@x.com", "ravi@x.com"), "Ravi");
assert.equal(R.deskLabel("pricing", "air"), "Air Desk");
assert.equal(R.deskLabel("pricing", "sea"), "Sea Desk");
assert.equal(R.deskLabel("pricing", "unknown"), "Pricing Desk");
assert.equal(R.deskLabel("pricingsales", "air"), "Sales Desk");

// --- the wording promises nothing it cannot keep ---
{
  const a = R.enquiryAck({ fromName: "Ravi Kumar", fromAddr: "r@acme.com", subject: "Rates BLR-FRA", desk: "Air Desk" });
  assert.equal(a.subject, "Re: Rates BLR-FRA");
  assert.match(a.text, /Dear Ravi,/);
  assert.match(a.text, /acknowledge receipt/);
  assert.match(a.text, /Air Desk/);
  assert.ok(!/\$|₹|rs\.|price of/i.test(a.text), "no price in an acknowledgement");
  const c = R.confirmationAck({ fromName: "Hans Mueller", fromAddr: "h@agent.de", subject: "Booking confirmed", desk: "NRS Desk", branch: "Bangalore", hasTeam: true, attached: true, shipper: "ABC GmbH", consignee: "XYZ India Pvt Ltd", route: "FRA → BLR" });
  assert.match(c.text, /Dear Hans,/);
  assert.match(c.text, /FRA → BLR/);
  assert.match(c.text, /Shipper: ABC GmbH/);
  assert.match(c.text, /Bangalore team is copied/);
  assert.match(c.text, /documents we received.*attached/s);
  const noTeam = R.confirmationAck({ fromName: "", fromAddr: "h@agent.de", subject: "x", desk: "NRS Desk", hasTeam: false, attached: false });
  assert.ok(!/copied/.test(noTeam.text) && !/attached/.test(noTeam.text));
}

// --- which branch takes over ---
{
  const teams = [{ branch: "Bangalore", stations: ["BLR", "Bangalore", "INBLR"], emails: ["blr@atlaslogistics.co.in"] }, { branch: "Mumbai", stations: ["BOM", "Mumbai", "INNSA", "Nhava Sheva"], emails: ["bom@atlaslogistics.co.in"] }];
  assert.equal(R.branchFor(teams, { direction: "import", pol: "FRA", pod: "BLR" }).branch, "Bangalore", "an import: the destination");
  assert.equal(R.branchFor(teams, { direction: "export", pol: "Mumbai", pod: "Frankfurt" }).branch, "Mumbai", "an export: the origin");
  assert.equal(R.branchFor(teams, { direction: "unknown", pol: "FRA", pod: "Nhava Sheva (INNSA)" }).branch, "Mumbai");
  assert.equal(R.branchFor(teams, { direction: "import", pol: "FRA", pod: "Chennai" }), null, "no branch for it: nobody is guessed");
  assert.equal(R.branchFor([], { direction: "import", pod: "BLR" }), null);
  assert.equal(R.branchFor(undefined, { pod: "BLR" }), null);
  assert.deepEqual(R.splitEmails("a@x.com, b@y.com; junk c@z.com"), ["a@x.com", "b@y.com", "c@z.com"]);
}

// --- confirmation detection ---
{
  const d = (o) => C.detectConfirmation({ subject: "", body: "", attachments: [], ...o });
  const pdf = (n) => ({ filename: n, contentType: "application/pdf", size: 90000 });
  assert.equal(d({ subject: "Booking confirmed - FRA to BLR", body: "Please proceed. Shipper: ABC GmbH, Consignee: XYZ India.", attachments: [] }).isConfirmation, true, "wording plus the parties in the text");
  assert.equal(d({ subject: "Shipment confirmation", body: "Pls proceed with pickup", attachments: [pdf("Commercial Invoice 4421.pdf"), pdf("Packing List.pdf")] }).isConfirmation, true, "wording plus invoice and packing list");
  assert.equal(d({ subject: "Please proceed", body: "ok", attachments: [] }).isConfirmation, false, "nothing to take over");
  assert.equal(d({ subject: "Invoice attached", body: "for your records", attachments: [pdf("invoice.pdf")] }).isConfirmation, false, "documents alone");
  assert.equal(d({ subject: "Please quote", body: "Confirm the rates, shipper ABC, consignee XYZ", attachments: [pdf("packing list.pdf")], askedForQuote: true }).isConfirmation, false, "a quote request");
  assert.equal(d({ subject: "Nomination", body: "We nominate you for the shipment. Shipper and consignee details below." }).isConfirmation, true);
  assert.deepEqual(C.shipmentDocuments([pdf("CI.pdf"), pdf("notes.pdf"), { filename: "pl.png", contentType: "image/png", size: 80000 }, pdf("Packing List.pdf")]).map((a) => a.filename), ["CI.pdf", "pl.png", "Packing List.pdf"]);
}

// --- reading the reply ---
{
  const ok = C.parseConfirmation('```json\n{"mode":"sea","direction":"import","agent":{"name":"Hans","company":"EuroLog"},"shipper":{"name":"ABC GmbH","address":"Berlin","phone":"","email":"Info@ABC.de"},"consignee":{"name":"XYZ India","address":"","phone":"","email":""},"pol":"Hamburg","pod":"Nhava Sheva","commodity":"Machinery","pieces":"3","grossWeightKg":1200.5,"incoterm":"fob","reference":"EL-77"}\n```');
  assert.deepEqual([ok.mode, ok.direction, ok.shipper.email, ok.pieces, ok.grossWeightKg, ok.incoterm], ["sea", "import", "info@abc.de", 3, 1200.5, "FOB"]);
  assert.equal(C.partiesNamed(ok), true);
  assert.equal(C.partiesNamed(C.parseConfirmation('{"shipper":{"name":"ABC"}}')), false, "one party is not enough to skip the documents");
  assert.equal(C.parseConfirmation("no json"), null);
  assert.equal(C.parseConfirmation('{"mode":"rail"}').mode, "unknown");
  assert.equal(C.parseConfirmation('{"pieces":"abc"}').pieces, null);
}

console.log("inbox reply ok");
