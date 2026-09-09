import type { WeightBreaks } from "@atlas/pricing-core";
import type { SavedQuote } from "@/lib/types";
import type { AirCargoRow } from "@/lib/pricing/air-desk";
import type { SeaContainerRow } from "@/lib/pricing/sea-desk";
import {
  createAirlineOption,
  createLinerOption,
  type AirlineOption,
  type LinerOption,
} from "@/lib/pricing/carrier-options";
import {
  createSurchargeRow,
  type SurchargeRow,
} from "@/lib/pricing/surcharges";

export function deskPathForQuote(quote: SavedQuote): string | null {
  const type = (quote.type || "").toLowerCase();
  if (type === "air") return "/air";
  if (type === "sea") return "/sea";
  if (type === "courier") return "/courier";
  return null;
}

function mapSurcharges(raw: unknown): SurchargeRow[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  return raw
    .map((s) => {
      const row = s as Record<string, unknown>;
      return createSurchargeRow({
        name: String(row.name ?? ""),
        sell: Number(row.sell ?? row.rate ?? 0),
        buy: Number(row.buy ?? row.buyRate ?? 0),
        unit: (row.unit as SurchargeRow["unit"]) || "flat",
        remarks: String(row.remarks ?? ""),
      });
    })
    // AMS has its own field — never also keep it inside origin fee rows.
    .filter((r) => r.name.trim() && !/^ams(\s+fee)?$/i.test(r.name.trim()));
}

export function loadAirDeskFromQuote(quote: SavedQuote) {
  const d = quote.details ?? {};
  const cargoItems = (d.cargoItems as AirCargoRow[]) ?? [];
  const module =
    d.module === "import" || d.module === "export"
      ? (d.module as "export" | "import")
      : "export";

  let airlines: AirlineOption[] = [];
  const savedAirlines = d.airlines as AirlineOption[] | undefined;
  if (Array.isArray(savedAirlines) && savedAirlines.length) {
    airlines = savedAirlines.map((a) =>
      createAirlineOption(
        {
          ...a,
          breaks: (a.breaks as WeightBreaks) ?? {},
          originSurcharges: mapSurcharges(a.originSurcharges) ?? a.originSurcharges,
          destSurcharges: mapSurcharges(a.destSurcharges) ?? a.destSurcharges,
        },
        Boolean(a.selected),
      ),
    );
  } else {
    airlines = [
      createAirlineOption(
        {
          name: String(d.airline ?? ""),
          routing: String(d.routing ?? ""),
          tt: String(d.tt ?? ""),
          validity: String(d.validity ?? ""),
          pivotWeightKg: Number(d.pivotWeight ?? 0),
          breaks: (d.breaks as WeightBreaks) ?? {},
          originFeesEnabled: d.originFeesEnabled !== false,
          destFeesEnabled: d.destFeesEnabled !== false,
          originSurcharges: mapSurcharges(d.originSurcharges),
          destSurcharges: mapSurcharges(d.destSurcharges),
          amsFee: Number(d.amsFee ?? 0),
          amsFeeBuy: Number(d.amsFeeBuy ?? 0),
          amsFeeEnabled: d.amsFeeEnabled !== false,
        },
        true,
      ),
    ];
  }

  const savedLanes = Array.isArray(d.lanes)
    ? (d.lanes as Array<{ id?: string; origin?: string; destination?: string }>).map((l, i) => ({
        id: String(l.id || `lane_${i}`),
        origin: String(l.origin ?? ""),
        destination: String(l.destination ?? ""),
      }))
    : [];

  const fallbackLane = airlines[0]?.laneId || savedLanes[0]?.id || "";
  const laneIds = new Set(airlines.map((a) => a.laneId || fallbackLane));
  for (const laneId of laneIds) {
    const onLane = airlines.filter((a) => (a.laneId || fallbackLane) === laneId);
    if (!onLane.some((a) => a.selected) && onLane[0]) {
      airlines = airlines.map((a) => (a.id === onLane[0].id ? { ...a, selected: true } : a));
    }
  }

  return {
    customer: quote.customer ?? "",
    origin: String(d.origin ?? ""),
    destination: String(d.destination ?? ""),
    lanes: savedLanes,
    currency: quote.currency ?? "USD",
    incoterm: String(d.incoterm ?? "FOB"),
    commodity: String(d.commodity ?? "GENERAL"),
    module,
    customExchangeRate: Number(d.customExchangeRate ?? 0),
    cargo: cargoItems.length
      ? cargoItems
      : [{ l: 120, w: 80, h: 90, qty: 1, gw: 150 }],
    airlines,
    terms: String(d.termsAndConditions ?? ""),
  };
}

export function loadSeaDeskFromQuote(quote: SavedQuote) {
  const d = quote.details ?? {};
  const containers = (d.containers as SeaContainerRow[]) ?? [];
  const mode =
    (d.shippingMode as "fcl" | "lcl" | "bb") ||
    (d.type as "fcl" | "lcl" | "bb") ||
    "fcl";
  const module =
    d.module === "import" || d.module === "export"
      ? (d.module as "export" | "import")
      : "export";

  let liners: LinerOption[] = [];
  const savedLiners = d.liners as LinerOption[] | undefined;
  if (Array.isArray(savedLiners) && savedLiners.length) {
    liners = savedLiners.map((l, i) =>
      createLinerOption(
        {
          ...l,
          originSurcharges: mapSurcharges(l.originSurcharges) ?? l.originSurcharges,
          destSurcharges: mapSurcharges(l.destSurcharges) ?? l.destSurcharges,
        },
        l.selected || i === 0,
      ),
    );
  } else {
    liners = [
      createLinerOption(
        {
          name: String(d.liner ?? d.shippingLine ?? ""),
          routing: String(d.routing ?? ""),
          tt: String(d.tt ?? ""),
          validity: String(d.validity ?? ""),
          containers: containers.length
            ? containers
            : [{ type: "20'GP", qty: 1, sellRate: 0, buyRate: 0 }],
          lclSell: Number((d.lclRate as { sell?: number })?.sell ?? 0),
          lclBuy: Number((d.lclRate as { buy?: number })?.buy ?? 0),
          originFeesEnabled: d.originFeesEnabled !== false,
          destFeesEnabled: d.destFeesEnabled !== false,
          originSurcharges: mapSurcharges(d.originSurcharges),
          destSurcharges: mapSurcharges(d.destSurcharges),
        },
        true,
      ),
    ];
  }

  if (!liners.some((l) => l.selected) && liners[0]) {
    liners[0] = { ...liners[0], selected: true };
  }

  return {
    customer: quote.customer ?? "",
    origin: String(d.origin ?? ""),
    destination: String(d.destination ?? ""),
    currency: quote.currency ?? "USD",
    incoterm: String(d.incoterm ?? "FOB"),
    module,
    mode,
    grossWeightKg: Number(d.grossWeight ?? 0),
    volumeCbm: Number(d.volumeCbm ?? d.volume ?? 0),
    chargeableCbmOverride: Number(d.chargeableCbmOverride ?? 0),
    customExchangeRate: Number(d.customExchangeRate ?? 0),
    liners,
    terms: String(d.termsAndConditions ?? ""),
  };
}

export function loadCourierDeskFromQuote(quote: SavedQuote) {
  const d = quote.details ?? {};
  const surcharges = (d.surcharges as Record<string, unknown>) ?? {};
  return {
    customer: quote.customer ?? "",
    originCity: String(d.originCity ?? ""),
    destCity: String(d.destCity ?? ""),
    originCountry: String(d.originCountry ?? "IN"),
    destCountry: String(d.destCountry ?? "IN"),
    originPin: String(d.originPin ?? ""),
    destPin: String(d.destPin ?? ""),
    scope: (d.scope as "domestic" | "international") ?? "domestic",
    service: String(d.service ?? "economy"),
    currency: quote.currency ?? "INR",
    marginPct: Number(d.marginPct ?? 12),
    selectedCarrier: String(d.carrier ?? "dhl"),
    gstEnabled: d.gstEnabled !== false,
    validity: String(d.validity ?? "15 days") || "15 days",
    packages: (d.packages as Array<{ qty: number; gw?: number; l?: number; w?: number; h?: number }>) ?? [
      { qty: 1, gw: 5, l: 30, w: 20, h: 15 },
    ],
    surcharges: {
      fuelPct: Number(surcharges.fuelPct ?? 18),
      remote: Boolean(surcharges.remote),
      remoteAmount: Number(surcharges.remoteAmount ?? surcharges.remote ?? 450),
      residential: Boolean(surcharges.residential),
      residentialAmount: Number(surcharges.residentialAmount ?? surcharges.residential ?? 350),
      saturday: Boolean(surcharges.saturday),
      saturdayAmount: Number(surcharges.saturdayAmount ?? surcharges.saturday ?? 500),
      dg: Boolean(surcharges.dg),
      dgAmount: Number(surcharges.dgAmount ?? surcharges.dg ?? 1200),
      insurance: Boolean(surcharges.insurance),
      insurancePct: Number(surcharges.insurancePct ?? 1.5),
      declaredValue: Number(surcharges.declaredValue ?? 0),
      oversized: Boolean(surcharges.oversized),
      oversizedAmount: Number(surcharges.oversized ?? 800),
    },
    terms: String(d.termsAndConditions ?? ""),
  };
}
