import assert from "node:assert/strict";
import { parseAirEnquiry } from "./parse-enquiry";

// The enquiry pasted into Quote Hub that used to fill only the route (and got the origin wrong).
const enquiry = `MUM - IST//Temp//8473Kg//15-25//Odd
Pls offer your best for below Odd size dimensions with 15-25 temp
16 pallets
120*100*180 CM
GW is 8473Kg
VW is 5760Kg
Finished Pharmaceutical Product`;
const p = parseAirEnquiry(enquiry);
assert.equal(p.origin, "BOM"); // "MUM" is Mumbai, not an airport code
assert.equal(p.destination, "IST");
assert.deepEqual(p.packages, [{ qty: 16, gw: 8473, l: 120, w: 100, h: 180 }]);
assert.equal(p.grossWeight, 8473);
assert.equal(p.volumetricWeight, 5760);
assert.equal(p.commodity, "Finished Pharmaceutical Product");
assert.deepEqual(p.specialHandling?.[0], "Temperature-controlled 15 to 25 °C");
assert.ok(p.specialHandling?.some((h) => /odd-size/i.test(h)));
assert.ok(p.confidence >= 80);

// the customer's stated volumetric weight agrees with the dimensions (L×W×H ÷ 6000 × qty)
const volFromDims = (120 * 100 * 180) / 6000 * 16;
assert.equal(Math.round(volFromDims), p.volumetricWeight);

// city aliases
assert.equal(parseAirEnquiry("Origin: Bombay\nDestination: Istanbul").origin, "BOM");
assert.equal(parseAirEnquiry("Origin: Bombay\nDestination: Istanbul").destination, "IST");
assert.equal(parseAirEnquiry("DEL to DOH 3 cartons 40x30x20 cm 45kg").destination, "DOH");

// dimension separators and quantity words
const star = parseAirEnquiry("BOM to LHR\n5 crates 60*40*30 cm\ngross weight 120 kg");
assert.deepEqual(star.packages, [{ qty: 5, gw: 120, l: 60, w: 40, h: 30 }]);
const x = parseAirEnquiry("BOM to LHR 40x30x20 cm 5 pcs total weight 100 kg");
assert.equal(x.packages[0]?.qty, 5);
assert.equal(x.packages[0]?.gw, 100);

// a bare weight after the dimensions must NOT be read as the piece count
const noQty = parseAirEnquiry("BOM to LHR\n120x100x180 cm\n8473 kg");
assert.equal(noQty.packages[0]?.qty, 1);
assert.equal(noQty.grossWeight, 8473);

// GW label variants and thousands separators
assert.equal(parseAirEnquiry("BOM-DXB GW: 8,473 kg 4 pallets 100x100x100 cm").grossWeight, 8473);
assert.equal(parseAirEnquiry("BOM-DXB Gross wt 250 kgs 2 pcs 50x50x50 cm").grossWeight, 250);

// temperature only when the text talks about temperature; other ranges/dimensions are not misread
assert.equal(parseAirEnquiry("BOM to LHR 10 cartons 40x30x20 cm 100 kg").specialHandling, undefined);
assert.equal(parseAirEnquiry("BOM to LHR reefer 2-8 C 10 cartons 40x30x20 cm").specialHandling?.[0], "Temperature-controlled 2 to 8 °C");
assert.ok(parseAirEnquiry("BOM to LHR 1 crate ODC out of gauge 300x200x150 cm 900 kg").specialHandling?.some((h) => /out-of-gauge/i.test(h)));
assert.ok(parseAirEnquiry("BOM to LHR DG UN3480 lithium 4 boxes 40x30x20 cm 60 kg").specialHandling?.some((h) => /dangerous/i.test(h)));

// existing behaviour preserved: labelled commodity wins over the keyword guess; numbered package lines still parse
assert.equal(parseAirEnquiry("BOM to LHR\nCommodity: Garments\nFinished pharma samples note").commodity, "Garments");
const numbered = parseAirEnquiry("BOM to LHR\n1 50x40x30 cm 20 kg\n2 50x40x30 cm 22 kg");
assert.deepEqual(numbered.packages, [{ qty: 2, gw: 42, l: 50, w: 40, h: 30 }]);

console.log("parse-enquiry.test.ts: all assertions passed");
