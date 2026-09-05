/**
 * DCSA (ocean) + IATA ONE Record (air) integration layer.
 *
 * Important (matches industry reality):
 * - DCSA publishes free OpenAPI specs — NOT a shared live rate gateway.
 * - Each carrier (MSC, Maersk, CMA CGM, Hapag-Lloyd, ONE, Evergreen, Yang Ming,
 *   HMM, ZIM, PIL, …) hosts its own API against that shared schema.
 * - Live quotation/contract rates still require a registered customer account
 *   + API credentials with each carrier.
 * - IATA ONE Record is the air-cargo analog (JSON-LD); production maturity
 *   varies by airline — treat as "build toward", not "live rates today".
 *
 * This module:
 *  1. Lists DCSA member carriers + portal URLs
 *  2. Defines a shared adapter interface so one parser works across carriers
 *  3. Ships a mock/demo schedule response in DCSA-shaped JSON for UI wiring
 *  4. Reserves credential slots (Firebase secrets) for when accounts are ready
 */

export type OceanCarrierId =
  | "MSC"
  | "MAEU"
  | "CMDU"
  | "HLCU"
  | "ONEY"
  | "EGLV"
  | "YMLU"
  | "HDMU"
  | "ZIMU"
  | "PCIU";

export type DcsaCapability =
  | "track-trace"
  | "booking"
  | "commercial-schedules"
  | "ebl"
  | "documentation";

export type DcsaCarrierProfile = {
  id: OceanCarrierId;
  name: string;
  scac: string;
  /** Public developer portal (account required for live data). */
  portalUrl: string;
  capabilities: DcsaCapability[];
  /** Spec compliance note — not a guarantee of rate APIs. */
  note: string;
};

/** DCSA vessel-operating members (~75% of container trade). */
export const DCSA_CARRIERS: DcsaCarrierProfile[] = [
  {
    id: "MSC",
    name: "MSC",
    scac: "MSCU",
    portalUrl: "https://www.msc.com/en/ecommerce/api-solutions",
    capabilities: ["track-trace", "commercial-schedules", "booking"],
    note: "DCSA Commercial Schedules adopter — register for live access",
  },
  {
    id: "MAEU",
    name: "Maersk",
    scac: "MAEU",
    portalUrl: "https://developer.maersk.com/",
    capabilities: ["track-trace", "booking", "commercial-schedules", "documentation"],
    note: "Developer portal — contracted customers only for rates",
  },
  {
    id: "CMDU",
    name: "CMA CGM",
    scac: "CMDU",
    portalUrl: "https://www.cma-cgm.com/ebusiness/api",
    capabilities: ["track-trace", "booking", "commercial-schedules"],
    note: "API portal — customer onboarding required",
  },
  {
    id: "HLCU",
    name: "Hapag-Lloyd",
    scac: "HLCU",
    portalUrl: "https://api-portal.hlag.com/",
    capabilities: ["track-trace", "booking", "commercial-schedules", "ebl"],
    note: "Strong DCSA alignment — api-portal.hlag.com",
  },
  {
    id: "ONEY",
    name: "ONE (Ocean Network Express)",
    scac: "ONEY",
    portalUrl: "https://ecomm.one-line.com/",
    capabilities: ["track-trace", "commercial-schedules"],
    note: "DCSA member — schedule / T&T via customer channels",
  },
  {
    id: "EGLV",
    name: "Evergreen Line",
    scac: "EGLV",
    portalUrl: "https://www.evergreen-line.com/",
    capabilities: ["track-trace", "commercial-schedules"],
    note: "DCSA member — portal access via sales channel",
  },
  {
    id: "YMLU",
    name: "Yang Ming",
    scac: "YMLU",
    portalUrl: "https://www.yangming.com/",
    capabilities: ["track-trace", "commercial-schedules"],
    note: "DCSA member",
  },
  {
    id: "HDMU",
    name: "HMM",
    scac: "HDMU",
    portalUrl: "https://www.hmm21.com/",
    capabilities: ["track-trace", "commercial-schedules"],
    note: "DCSA member",
  },
  {
    id: "ZIMU",
    name: "ZIM",
    scac: "ZIMU",
    portalUrl: "https://www.zim.com/",
    capabilities: ["track-trace", "commercial-schedules"],
    note: "DCSA member",
  },
  {
    id: "PCIU",
    name: "PIL",
    scac: "PCIU",
    portalUrl: "https://www.pilship.com/",
    capabilities: ["track-trace", "commercial-schedules"],
    note: "DCSA member",
  },
];

/** Shared DCSA-shaped schedule point (subset of Commercial Schedules). */
export type DcsaSchedulePoint = {
  location: { UNLocationCode: string; name?: string };
  dateTime: string;
  eventType: "DEP" | "ARR";
};

export type DcsaScheduleSailing = {
  carrier: OceanCarrierId;
  carrierServiceName: string;
  vesselName?: string;
  voyageNumber?: string;
  origin: string;
  destination: string;
  transitDays: number;
  points: DcsaSchedulePoint[];
  source: "demo" | "live";
  sourceNote: string;
};

export type DcsaCredentials = {
  carrier: OceanCarrierId;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  baseUrl?: string;
};

/**
 * Adapter interface — one shape for every DCSA carrier.
 * Live implementations plug in per-carrier auth + base URL.
 */
export interface DcsaCarrierAdapter {
  profile: DcsaCarrierProfile;
  isConfigured(): boolean;
  fetchCommercialSchedules(input: {
    originUnLocode: string;
    destinationUnLocode: string;
    departureDate?: string;
  }): Promise<DcsaScheduleSailing[]>;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Demo sailings in DCSA-ish shape so UI can be built before carrier accounts exist. */
export function demoDcsaSchedules(input: {
  originUnLocode: string;
  destinationUnLocode: string;
  departureDate?: string;
  carriers?: OceanCarrierId[];
}): DcsaScheduleSailing[] {
  const origin = input.originUnLocode.toUpperCase();
  const destination = input.destinationUnLocode.toUpperCase();
  const start = input.departureDate || new Date().toISOString().slice(0, 10);
  const list = (input.carriers || ["MAEU", "MSC", "CMDU", "HLCU"]).filter((id) =>
    DCSA_CARRIERS.some((c) => c.id === id || c.scac === id),
  );

  const roster = DCSA_CARRIERS.filter(
    (c) => list.includes(c.id) || list.includes(c.scac as OceanCarrierId),
  );

  return roster.map((c, i) => {
    const transit = 16 + i * 2;
    const dep = `${start}T08:00:00Z`;
    return {
      carrier: c.id,
      carrierServiceName: `${c.name} Asia–EU Loop ${i + 1}`,
      vesselName: `ATLAS DEMO ${c.id}`,
      voyageNumber: `${c.id}${100 + i}`,
      origin,
      destination,
      transitDays: transit,
      points: [
        {
          location: { UNLocationCode: origin },
          dateTime: dep,
          eventType: "DEP",
        },
        {
          location: { UNLocationCode: destination },
          dateTime: addDays(dep, transit),
          eventType: "ARR",
        },
      ],
      source: "demo",
      sourceNote:
        "DCSA-shaped demo sailing — replace with live carrier portal credentials when contracted",
    };
  });
}

export function createDemoDcsaAdapter(carrierId: OceanCarrierId): DcsaCarrierAdapter {
  const profile = DCSA_CARRIERS.find((c) => c.id === carrierId);
  if (!profile) throw new Error(`Unknown DCSA carrier ${carrierId}`);
  return {
    profile,
    isConfigured: () => false,
    async fetchCommercialSchedules(input) {
      return demoDcsaSchedules({
        ...input,
        carriers: [carrierId],
      });
    },
  };
}

export const DCSA_SPEC_LINKS = {
  openApi: "https://github.com/dcsaorg/DCSA-OpenAPI",
  members: "https://dcsa.org/about-dcsa/meet-our-members/",
  apiEvangelist: "https://apievangelist.com/",
} as const;

export const DCSA_SECRET_SLOTS = [
  "DCSA_MAEU_CLIENT_ID",
  "DCSA_MAEU_CLIENT_SECRET",
  "DCSA_MSCU_API_KEY",
  "DCSA_HLCU_CLIENT_ID",
  "DCSA_HLCU_CLIENT_SECRET",
  "DCSA_CMDU_API_KEY",
] as const;
