const assert = require("node:assert/strict");
const { classifyCircularMail: c, documentAttachments, airlineIn } = require("./inbox-circular");
const pdf = (name, size = 90_000) => ({ filename: name, contentType: "application/pdf", size });

// --- airline tariffs ---
{
  const r = c({ from: "cargo@emirates.com", fromName: "Emirates SkyCargo", subject: "BLR tariff effective 1 Dec 2026", attachments: [pdf("EK_BLR_TARIFF_DEC_2026.pdf")] });
  assert.equal(r.isCircular, true);
  assert.equal(r.category, "airline_tariff");
  assert.equal(r.carrier, "EK", "the airline is found from the sender's name");
  assert.match(r.title, /EK BLR TARIFF DEC 2026/);
  const r2 = c({ from: "x@y.com", fromName: "Pricing desk", subject: "Rate sheet", attachments: [pdf("TK_BOM_RATE_SHEET.pdf")] });
  assert.deepEqual([r2.isCircular, r2.carrier], [true, "TK"], "or from the file name's airline code");
  assert.equal(c({ from: "a@lufthansa-cargo.com", fromName: "Lufthansa Cargo", subject: "Fuel surcharge update", attachments: [pdf("FSC_Nov.pdf")] }).category, "fuel_circular_airline");
  assert.equal(c({ from: "a@lufthansa-cargo.com", fromName: "Lufthansa Cargo", subject: "Surcharge circular", attachments: [pdf("notice.pdf")] }).category, "general", "a notice about surcharges is a circular, not a rate table");
}

// --- liners, couriers, transporters ---
{
  assert.deepEqual([c({ from: "in@maersk.com", fromName: "Maersk India", subject: "Peak season surcharge notice", attachments: [pdf("PSS.pdf")] }).category, c({ from: "in@maersk.com", fromName: "Maersk India", subject: "Peak season surcharge notice", attachments: [pdf("PSS.pdf")] }).carrier], ["line_circular", "MAERSK"]);
  assert.equal(c({ from: "x@msc.com", fromName: "MSC", subject: "Bunker adjustment factor Dec", attachments: [pdf("BAF.xlsx")] }).category, "fuel_circular_shipping");
  assert.equal(c({ from: "x@one-line.com", fromName: "ONE", subject: "FCL tariff from Nhava Sheva", attachments: [pdf("rates.pdf")] }).category, "sea_tariff");
  assert.equal(c({ from: "x@dhl.com", fromName: "DHL Express", subject: "Tariff 2027", attachments: [pdf("tariff2027.pdf")] }).category, "courier_tariff");
  assert.equal(c({ from: "x@speedtrucks.in", fromName: "Speed Trucks", subject: "Revised rates for FTL", attachments: [pdf("rates.xlsx")] }).category, "general");
}

// --- not circulars ---
{
  assert.equal(c({ from: "a@b.com", subject: "Tariff", attachments: [] }).isCircular, false, "no document");
  assert.equal(c({ from: "a@b.com", subject: "Tariff", attachments: [{ filename: "logo.png", contentType: "image/png", size: 50_000 }] }).isCircular, false, "a picture is not a tariff");
  assert.equal(c({ from: "a@b.com", subject: "Please quote as per attached", attachments: [pdf("packing list.pdf")], askedForQuote: true }).isCircular, false, "a customer asking for a quote");
  assert.equal(c({ from: "a@b.com", subject: "Invoice 123", attachments: [pdf("invoice.pdf")] }).isCircular, false, "an invoice");
  assert.equal(c({ from: "a@b.com", subject: "Hello", body: "Our new tariff is attached", attachments: [pdf("file.pdf")] }).isCircular, false, "only the body says it: not enough");
  assert.equal(c({ from: "a@b.com", subject: "Meeting notes", attachments: [pdf("notes.pdf", 500)] }).isCircular, false, "a tiny file");
}

assert.deepEqual(documentAttachments([pdf("a.pdf"), { filename: "x.docx", size: 5000 }, { filename: "p.png", contentType: "image/png", size: 99999 }]).map((a) => a.filename), ["a.pdf", "x.docx"]);
assert.equal(airlineIn("nothing relevant"), null);
console.log("inbox circular ok");

// A circular in the words of the email, with no file: noted for a person, never lost.
{
  const C = require("./inbox-circular");
  const plain = C.looksLikePlainTextCircular({ from: "cargo@etihad.com", fromName: "Etihad Cargo", subject: "Fuel Surcharge Circular effective 15 Nov" });
  assert.equal(plain.isCircular, true);
  assert.equal(plain.category, "fuel_circular_airline");
  assert.equal(C.looksLikePlainTextCircular({ from: "a@etihad.com", fromName: "Etihad Cargo", subject: "Fuel circular", askedForQuote: true }).isCircular, false, "a request for a quote is an enquiry");
  assert.equal(C.looksLikePlainTextCircular({ from: "a@random.com", fromName: "Random", subject: "Fuel surcharge circular" }).isCircular, false, "not a known airline or liner");
  assert.equal(C.looksLikePlainTextCircular({ from: "a@etihad.com", fromName: "Etihad Cargo", subject: "Hello" }).isCircular, false, "no circular word");
  console.log("plain-text circular ok");
}

// Etihad Cargo's fuel circular with its PDF is an airline fuel circular (it used to be filed as "general").
{
  const C = require("./inbox-circular");
  const r = C.classifyCircularMail({ from: "cargo.pricing@etihad.com", fromName: "Etihad Cargo", subject: "Fuel Surcharge Circular", body: "", attachments: [{ filename: "EY_Fuel_Circular_Nov.pdf", contentType: "application/pdf", size: 90000 }] });
  assert.equal(r.isCircular, true);
  assert.equal(r.category, "fuel_circular_airline");
  assert.equal(r.carrier, "EY");
  console.log("etihad cargo circular ok");
}
