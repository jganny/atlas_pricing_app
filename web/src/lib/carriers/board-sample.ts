import type { BoardTariff } from "./board";

/** Example rates for the demo and mock modes only (BLR to FRA), so the Carrier Board shows something without a database. */
const base = { origin: "BLR", destination: "FRA", currency: "INR", rateKind: "contract", notes: "", updatedAt: 1, sourceFile: "sample" };
export const SAMPLE_TARIFFS: BoardTariff[] = [
  { ...base, carrierCode: "EK", validFrom: "2026-07-01", validTo: "2026-12-31", breaks: { min: 8600, minus45: 430, plus45: 405, plus100: 340, plus300: 300, plus500: 290, plus1000: 280 } },
  { ...base, carrierCode: "QR", validFrom: "2026-09-01", validTo: "2026-11-24", breaks: { min: 8100, minus45: 445, plus45: 395, plus100: 335, plus300: 310, plus500: 295, plus1000: 285 } },
  { ...base, carrierCode: "TK", validFrom: "2026-10-01", validTo: "2027-03-31", breaks: { min: 7800, minus45: 420, plus45: 385, plus100: 325, plus300: 305, plus500: 288, plus1000: 279 } },
];
