import assert from "node:assert/strict";

// desk-seats reads window/localStorage
const store: Record<string, string> = {};
(globalThis as unknown as { window: object }).window = {};
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
};

(async () => {
  const n = await import("./normalize");
  const OWN = ["atlaslogistics.co.in"];

  // Who is internal.
  assert.equal(n.isInternalEmail("ganesh@blr.atlaslogistics.co.in", OWN), true); // subdomain too
  assert.equal(n.isInternalEmail("Pricing@AtlasLogistics.co.in", OWN), true);
  assert.equal(n.isInternalEmail("ops@gulffreight.com", OWN), false);
  assert.equal(n.isInternalEmail("x@notatlaslogistics.co.in", OWN), false); // look-alike domain is not internal

  // Company from the address: free mail gives nothing.
  assert.equal(n.companyFromDomain("ops@abc-logistics.co.uk"), "Abc Logistics");
  assert.equal(n.companyFromDomain("sales@pearlcargo.com"), "Pearlcargo");
  assert.equal(n.companyFromDomain("someone@gmail.com"), "");

  // Import / Export from the countries (the forwarder is in India).
  assert.equal(n.directionFromCountries("IN", "AE"), "export");
  assert.equal(n.directionFromCountries("CN", "IN"), "import");
  assert.equal(n.directionFromCountries("CN", "AE"), "unknown"); // cross-trade
  assert.equal(n.directionFromCountries("IN", "IN"), "unknown"); // domestic
  assert.equal(n.directionFromCountries("", "IN"), null);

  assert.equal(n.placeLabel({ text: "Chennai", code: "INMAA", country: "IN" }), "INMAA - Chennai");
  assert.equal(n.placeLabel({ text: "", code: "BLR", country: "IN" }), "BLR");
  assert.equal(n.placeLabel({ text: "Madras", code: "", country: "IN" }), "Madras");

  assert.equal(n.normalizeContainerType("20 GP"), "20'GP");
  assert.equal(n.normalizeContainerType("40HQ"), "40'HC");
  assert.equal(n.normalizeContainerType("40' RF"), "40'RF");
  assert.equal(n.normalizeContainerType("20DC"), "20'GP");

  // A clean sea-export reading, sender is an overseas forwarder already on the agents list under another spelling.
  const agents = [{ name: "Gulf Freight Co. LLC", email: "", location: "Dubai" }];
  const good = n.normalizeExtraction(
    {
      mode: "sea", direction: "export", summary: "Sea export",
      sender: { name: "Ravi", email: "Ravi@GulfFreight.ae", company: "GULF FREIGHT CO" },
      origin: { text: "Chennai", code: "inmaa", country: "in" }, destination: { text: "Jebel Ali", code: "AEJEA", country: "ae" },
      incoterm: "fob", containers: [{ type: "20 GP", qty: 1 }], seaMode: "fcl",
      packages: [{ qty: 24, gw: 396, l: 120, w: 100, h: 110 }, { qty: 2 }],
      grossWeightKg: "9500", volumeCbm: 31.7, invoiceValue: 18450, currency: "usd",
    },
    { agents },
  );
  assert.equal(good.extraction.mode, "sea");
  assert.equal(good.extraction.direction, "export");
  assert.equal(good.customer, "Gulf Freight Co. LLC"); // tidied to the agents list spelling
  assert.equal(good.senderEmail, "ravi@gulffreight.ae");
  assert.equal(good.extraction.origin.code, "INMAA");
  assert.equal(good.extraction.incoterm, "FOB");
  assert.equal(good.extraction.currency, "USD");
  assert.equal(good.extraction.grossWeightKg, 9500);
  assert.deepEqual(good.extraction.containers, [{ type: "20'GP", qty: 1 }]);
  assert.equal(good.extraction.packages.length, 1); // a line with no weight or size is dropped
  assert.equal(good.extraction.needsCheck.length, 0);

  // A forwarded enquiry: the colleague is never the customer; the original sender in the chain is used.
  const fwd = n.normalizeExtraction(
    { mode: "air", direction: "import", sender: { name: "Anil", email: "anil@blr.atlaslogistics.co.in", company: "Atlas Logistics" }, origin: { country: "CN" }, destination: { country: "IN" }, summary: "x" },
    { headerSender: { name: "Anil", email: "anil@blr.atlaslogistics.co.in" } },
  );
  assert.equal(fwd.senderEmail, "");
  assert.equal(fwd.customer, "");
  // …but when the AI found the real sender further down, that person is used.
  const fwd2 = n.normalizeExtraction(
    { mode: "air", direction: "import", sender: { name: "Li Wei", email: "liwei@shenzhen-air.com", company: "" }, origin: { country: "CN" }, destination: { country: "IN" }, summary: "x" },
    { headerSender: { name: "Anil", email: "anil@atlaslogistics.co.in" } },
  );
  assert.equal(fwd2.senderEmail, "liwei@shenzhen-air.com");
  assert.equal(fwd2.customer, "Shenzhen Air"); // company from the email domain when no signature was found
  // If the AI left the sender out entirely, the email's own external header is the fallback.
  const direct = n.normalizeExtraction({ mode: "air", direction: "import", summary: "x" }, { headerSender: { name: "Mia", email: "mia@bigforwarder.com" } });
  assert.equal(direct.senderEmail, "mia@bigforwarder.com");
  assert.equal(direct.customer, "Bigforwarder");
  // Free mail with no company: the customer stays empty for the user.
  const free = n.normalizeExtraction({ mode: "air", direction: "export", summary: "x" }, { headerSender: { name: "Sam", email: "sam@gmail.com" } });
  assert.equal(free.customer, "");

  // The countries beat a wrong reading; unclear cases are flagged, never guessed.
  const wrong = n.normalizeExtraction({ mode: "sea", direction: "import", origin: { country: "IN" }, destination: { country: "AE" }, summary: "x" });
  assert.equal(wrong.extraction.direction, "export");
  const unclear = n.normalizeExtraction({ mode: "air", direction: "unknown", origin: { country: "CN" }, destination: { country: "AE" }, summary: "x" });
  assert.equal(unclear.extraction.direction, "unknown");
  assert.equal(unclear.extraction.needsCheck.some((c) => c.field === "direction"), true);
  // Courier/transport don't need an Import/Export answer.
  assert.equal(n.normalizeExtraction({ mode: "transport", direction: "unknown", summary: "x" }).extraction.needsCheck.length, 0);

  // A missing or invalid mode is guessed safely and flagged.
  const noMode = n.normalizeExtraction({ mode: "unknown", containers: [{ type: "40HC", qty: 1 }], direction: "export", summary: "x" });
  assert.equal(noMode.extraction.mode, "sea");
  assert.equal(noMode.extraction.needsCheck[0].field, "mode");
  assert.equal(n.normalizeExtraction({ mode: "banana", grossWeightKg: 80, direction: "export", summary: "x" }).extraction.mode, "air");

  // Garbage in, safe out.
  const junk = n.normalizeExtraction(null);
  assert.equal(junk.extraction.packages.length, 0);
  assert.equal(junk.customer, "");

  console.log("hub normalize.test.ts: all assertions passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
