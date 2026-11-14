const assert = require("node:assert/strict");
const { prefilter, headerFlags, isPendingEnquiry, isQuoteDelivered, isOwnFrom, greetingName } = require("./inbox-filter");

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

// --- an enquiry with the details only in an attachment ---
{
  const pdf = (name = "packing list.pdf", size = 80_000) => ({ filename: name, contentType: "application/pdf", size });
  const logo = { filename: "logo.png", contentType: "image/png", size: 3_000, inline: true };
  const pf = (o) => prefilter({ from: "buyer@acme.com", subject: "", body: "", ...o });
  assert.equal(pf({ subject: "Rates", body: "Pls quote as per attached packing list", attachments: [pdf()] }).verdict, "sure", "asks in a line, details attached");
  assert.equal(pf({ subject: "Quote", body: "Rates?", attachments: [{ filename: "enq.xlsx", contentType: "application/vnd.ms-excel", size: 20_000 }] }).verdict, "sure", "a one-word ask with a sheet");
  assert.equal(pf({ subject: "Kindly share best rates", body: "see attached", attachments: [pdf("shipment.jpg", 300_000)] }).verdict, "sure");
  assert.equal(pf({ subject: "FYI", body: "Hi", attachments: [pdf("RFQ_Nov.pdf")] }).verdict, "maybe", "no words, but the file looks like an enquiry");
  assert.equal(pf({ subject: "Tariff", body: "Please find attached our tariff for this month.", attachments: [pdf("tariff.pdf")] }).verdict, "noise", "a carrier sending rates is not an enquiry");
  assert.equal(pf({ subject: "Thanks", body: "Thanks and regards", attachments: [logo] }).verdict, "noise", "a signature logo is not an attachment");
  assert.equal(pf({ subject: "Invite", body: "Please quote", attachments: [{ filename: "invite.ics", contentType: "text/calendar", size: 900 }] }).verdict, "maybe", "a calendar file does not make it sure: the ask alone is left to the AI");
  assert.equal(pf({ subject: "Please share rates", body: "", attachments: [] }).verdict, "maybe", "an ask with nothing attached and no details is left to the AI");
  assert.equal(pf({ subject: "Hello", body: "just checking", attachments: [pdf("contract.pdf")] }).verdict, "noise", "an attachment alone is not an enquiry");
  assert.equal(pf({ headers: new Map([["list-unsubscribe", "x"]]), subject: "Pls quote", body: "rates", attachments: [pdf()] }).verdict, "noise", "a mailing list is still noise");
  assert.deepEqual(require("./inbox-filter").realAttachments([logo, pdf(), { filename: "", contentType: "" }]).map((a) => a.filename), ["packing list.pdf"]);
}

// --- a reply is judged on what is new, not on the conversation underneath ---
{
  const { latestText } = require("./inbox-filter");
  const reply = "Thanks, noted.\n\nOn Mon, 9 Nov 2026 at 10:00, Sales <s@x.com> wrote:\n> Please quote 500 kg from BLR to FRA\n> ex works";
  assert.equal(latestText("Re: Rates", reply).trim(), "Thanks, noted.");
  assert.equal(prefilter({ from: "a@b.com", subject: "Re: Rates", body: reply }).verdict, "noise", "an old quote underneath does not make a thank-you an enquiry");
  assert.match(latestText("Fwd: Rates", reply), /Please quote 500 kg/, "a forward keeps the forwarded enquiry");
  assert.equal(latestText("Re: x", "line\n> quoted\nmore").trim(), "line\nmore");
}

{
  const awwab = {
    tag: "new_enquiry",
    from: "Atlaslogistics <pricing@atlaslogistics.co.in>",
    subject: "Air Freight // BLR to Qatar // 560 Kgs",
    bodyPreview: "Dear Awwab Pls find below quote for said shipment",
  };
  assert.equal(isQuoteDelivered(awwab.subject, awwab.bodyPreview), true);
  assert.equal(isOwnFrom(awwab.from), true);
  assert.equal(greetingName(awwab.bodyPreview), "Awwab");
  assert.equal(isPendingEnquiry(awwab), false, "internal quote-share is not pending");
  assert.equal(
    prefilter({ from: awwab.from, subject: awwab.subject, body: awwab.bodyPreview }).verdict,
    "maybe",
    "an internal quote-share is kept so it can join the original enquiry's thread",
  );
  assert.equal(
    isPendingEnquiry({
      tag: "new_enquiry",
      from: "Fatima <fatima@doha-trade.qa>",
      subject: "Air Freight // BLR to Qatar // 560 Kgs",
      bodyPreview: "Dear Team, please quote 560 kgs from Bangalore to Doha.",
    }),
    true,
    "customer RFQ stays pending until replied",
  );
  assert.equal(
    isPendingEnquiry({
      tag: "new_enquiry",
      from: "Fatima <fatima@doha-trade.qa>",
      subject: "Please quote BLR-DOH",
      bodyPreview: "560 kg",
      repliedAt: 1,
    }),
    false,
  );
  console.log("pending enquiry filter ok");
}
