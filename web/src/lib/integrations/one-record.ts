/**
 * IATA ONE Record — air cargo data-sharing standard (JSON-LD).
 *
 * Analog to DCSA for ocean: common model + API patterns, not a free live-rate
 * gateway. Preferred IATA data-sharing approach from 2026; many airlines still
 * in pilot. Build adapters toward ONE Record; keep Atlas Circulars as the
 * production rate source until airline portals are contracted.
 */

export type OneRecordAirline = {
  code: string;
  name: string;
  portalUrl?: string;
  oneRecordStatus: "pilot" | "production" | "unknown";
  note: string;
};

export const ONE_RECORD_AIRLINES: OneRecordAirline[] = [
  {
    code: "LH",
    name: "Lufthansa Cargo",
    portalUrl: "https://www.lufthansa-cargo.com/",
    oneRecordStatus: "pilot",
    note: "Active in ONE Record community",
  },
  {
    code: "AF",
    name: "Air France / KLM Cargo",
    oneRecordStatus: "pilot",
    note: "ONE Record working group participant",
  },
  {
    code: "CV",
    name: "Cargolux",
    oneRecordStatus: "pilot",
    note: "ONE Record interested party",
  },
  {
    code: "EK",
    name: "Emirates SkyCargo",
    portalUrl: "https://www.skycargo.com/",
    oneRecordStatus: "unknown",
    note: "Use SkyCargo channels + Atlas Circulars until ONE Record live",
  },
  {
    code: "QR",
    name: "Qatar Airways Cargo",
    oneRecordStatus: "unknown",
    note: "Partner portal / Circulars for rates today",
  },
  {
    code: "SQ",
    name: "Singapore Airlines Cargo",
    oneRecordStatus: "unknown",
    note: "SIACARGO + Circulars",
  },
];

export type OneRecordShipmentStub = {
  "@type": "Shipment";
  waybillNumber?: string;
  origin: { code: string };
  destination: { code: string };
  totalGrossWeight?: { value: number; unit: "KGM" };
  pieces?: number;
  source: "demo" | "live";
  sourceNote: string;
};

export function demoOneRecordShipment(input: {
  origin: string;
  destination: string;
  weightKg?: number;
  pieces?: number;
}): OneRecordShipmentStub {
  return {
    "@type": "Shipment",
    origin: { code: input.origin.toUpperCase() },
    destination: { code: input.destination.toUpperCase() },
    totalGrossWeight: {
      value: input.weightKg || 100,
      unit: "KGM",
    },
    pieces: input.pieces || 1,
    source: "demo",
    sourceNote:
      "ONE Record–shaped demo — live airline data needs partner onboarding",
  };
}

export const ONE_RECORD_LINKS = {
  iata: "https://www.iata.org/en/programs/cargo/e/one-record/",
  github: "https://github.com/IATA-Cargo/ONE-Record",
} as const;

export const ONE_RECORD_SECRET_SLOTS = [
  "ONERECORD_CLIENT_ID",
  "ONERECORD_CLIENT_SECRET",
  "ONERECORD_BASE_URL",
] as const;
