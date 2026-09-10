import assert from "node:assert/strict";
import { classifyQuoteMode, deskModeForPaste } from "./quote-mode";
import { parseAirEnquiry } from "./parse-enquiry";

const JECKSON = `Dear Shashank,

Kindly quote your best air freight & EXW rate for below order to DXB:

AIR FREIGHT
TERMS	EX-WORK (DOOR TO DOOR)
COLLECTION	JECKSON ENGINEERS
28, PARTH IND. ESTATE, BEHIND SHAKARIBA PARTY PLOT, JAMFALWADI ROAD, CTM, AHMEDABAD - 380026.
Mr. PRAPHULCHANDRA
MOBILE: (+91) 7600781109
E MAIL: JECKSONENGINEERS@GMAIL.COM
PLACE OF LOADING	AHMEDABAD
PORT OF DISCHARGE	DXB
COMMODITY	SLEEVE
DIMENSIONS	AS PER BL
WEIGHT	699 KG
PACKAGE & TYPE	6 BOXES
CHARGEABLE WEIGHT
MODE (AIR/COURIER)

*Please quote with in the format & highlight any rate clause

Case  Dimension (cm) Net Weight  Gross Weight CBM
01  59 × 49 × 50  Not specified 116.50 KG  0.145
02  59 × 49 × 50  Not specified 116.50 KG  0.145
03  59 × 49 × 50  Not specified 116.50 KG  0.145
04  59 × 49 × 50  Not specified 116.50 KG  0.145
05  59 × 49 × 50  Not specified 116.50 KG  0.145
06  59 × 49 × 50  Not specified 116.50 KG  0.145
TOTAL  558 KG  699 KG  0.868 CBM
`;

assert.equal(deskModeForPaste(JECKSON), "air");
assert.equal(classifyQuoteMode(JECKSON), "air");
assert.equal(deskModeForPaste("Need DHL courier from BOM to DXB 2 kg express parcel"), "courier");
assert.equal(deskModeForPaste("FCL 1x40HC Nhava Sheva to Rotterdam"), "sea");
assert.equal(classifyQuoteMode("Acme Logistics"), null);

const parsed = parseAirEnquiry(JECKSON);
assert.equal(parsed.customer, "JECKSON ENGINEERS");
assert.equal(parsed.origin, "AMD");
assert.equal(parsed.destination, "DXB");
assert.equal(parsed.commodity, "SLEEVE");
assert.equal(parsed.incoterm, "EXW");
assert.equal(parsed.packages.length, 1);
assert.equal(parsed.packages[0].qty, 6);
assert.equal(parsed.packages[0].l, 59);
assert.equal(parsed.packages[0].w, 49);
assert.equal(parsed.packages[0].h, 50);
assert.equal(parsed.packages[0].gw, 699);
assert.equal(parsed.grossWeight, 699);
assert.match(parsed.notes || "", /7600781109/);

const ZIRAKPUR = `Could you please help me with exworks charges and air freight rates for this shipment? I need to present the proposal first thing in the morning, please.

2 cartons of 76.2  x 60.96 x 58.42 cm
Total Weight: 360 kgs
Pick up address:
SCO-06, Wadhawa Nagar, Dhakoli, Zirakpur,
SAS Nagar-160104,
Punjab, INDIA

Destination: Mexico City
`;

assert.equal(deskModeForPaste(ZIRAKPUR), "air");
const zirakpur = parseAirEnquiry(ZIRAKPUR);
assert.equal(zirakpur.origin, "IXC", "Zirakpur / SAS Nagar PIN 160104 → Chandigarh (IXC)");
assert.notEqual(zirakpur.origin, "SCO");
assert.equal(zirakpur.destination, "MEX");
assert.equal(zirakpur.incoterm, "EXW");
assert.equal(zirakpur.packages[0]?.qty, 2);
assert.equal(zirakpur.grossWeight, 360);
assert.match(zirakpur.notes || "", /Zirakpur/);

const pinOnly = parseAirEnquiry(
  "Air freight EXW pickup SAS Nagar-160104 Punjab India\nDestination: Mexico City\n2 cartons 80 x 60 x 50 cm Total Weight: 100 kgs",
);
assert.equal(pinOnly.origin, "IXC");

const localityOnly = parseAirEnquiry(
  "Air freight from pickup at Dhakoli, Zirakpur, Punjab, India to Mexico City. 1 carton 40 x 40 x 40 cm weight 20 kg",
);
assert.equal(localityOnly.origin, "IXC");
assert.equal(localityOnly.destination, "MEX");

console.log("jeckson air-freight intake tests passed");
