import type { WeightBreaks } from "@atlas/pricing-core";
import type { SavedQuote } from "@/lib/types";
import type { AirCargoRow } from "@/lib/pricing/air-desk";
import type { SeaContainerRow } from "@/lib/pricing/sea-desk";
import {
  createAirlineOption,
  createCourierOption,
  createLinerOption,
  defaultCourierSurcharges,
  type AirlineOption,
  type CourierOption,
  type CourierSurcharges,
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

function surchargesFromRaw(raw: unknown): CourierSurcharges {
  const s = (raw as Record<string, unknown>) ?? {};
  const d = defaultCourierSurcharges();
  return {
    fuelPct: Number(s.fuelPct ?? d.fuelPct),
    remote: Boolean(s.remote),
    remoteAmount: Number(s.remoteAmount ?? d.remoteAmount),
    residential: Boolean(s.residential),
    residentialAmount: Number(s.residentialAmount ?? d.residentialAmount),
    saturday: Boolean(s.saturday),
    saturdayAmount: Number(s.saturdayAmount ?? d.saturdayAmount),
    dg: Boolean(s.dg),
    dgAmount: Number(s.dgAmount ?? d.dgAmount),
    insurance: Boolean(s.insurance),
    insurancePct: Number(s.insurancePct ?? d.insurancePct),
    declaredValue: Number(s.declaredValue ?? d.declaredValue),
    oversized: Boolean(s.oversized),
    oversizedAmount: Number(s.oversizedAmount ?? d.oversizedAmount),
  };
}

export function loadCourierDeskFromQuote(quote: SavedQuote) {
  const d = quote.details ?? {};

  const savedLanes = Array.isArray(d.lanes)
    ? (d.lanes as Array<{ id?: string; origin?: string; destination?: string }>).map((l, i) => ({
        id: String(l.id || `lane_${i}`),
        origin: String(l.origin ?? ""),
        destination: String(l.destination ?? ""),
      }))
    : [];

  let couriers: CourierOption[] = [];
  const savedCouriers = d.carrierQuotes as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(savedCouriers) && savedCouriers.length) {
    couriers = savedCouriers.map((c) =>
      createCourierOption(
        {
          id: String(c.id ?? ""),
          directoryCarrier: String(c.directoryCarrier ?? c.name ?? ""),
          carrierId: String(c.carrierId ?? c.carrier ?? "dhl"),
          service: String(c.service ?? d.service ?? "economy"),
          marginPct: Number(c.marginPct ?? d.marginPct ?? 12),
          surcharges: surchargesFromRaw(c.surcharges),
          laneId: String(c.laneId ?? ""),
        },
        Boolean(c.selected),
      ),
    );
  } else {
    // Pre-feature quote: one flat carrier config, no comparison cards yet.
    couriers = [
      createCourierOption(
        {
          directoryCarrier: String(d.directoryCarrier ?? d.carrierName ?? ""),
          carrierId: String(d.carrier ?? "dhl"),
          service: String(d.service ?? "economy"),
          marginPct: Number(d.marginPct ?? 12),
          surcharges: surchargesFromRaw(d.surcharges),
        },
        true,
      ),
    ];
  }

  const fallbackLane = couriers[0]?.laneId || savedLanes[0]?.id || "";
  const laneIds = new Set(couriers.map((c) => c.laneId || fallbackLane));
  for (const laneId of laneIds) {
    const onLane = couriers.filter((c) => (c.laneId || fallbackLane) === laneId);
    if (!onLane.some((c) => c.selected) && onLane[0]) {
      couriers = couriers.map((c) => (c.id === onLane[0].id ? { ...c, selected: true } : c));
    }
  }

  return {
    customer: quote.customer ?? "",
    originCity: String(d.originCity ?? ""),
    destCity: String(d.destCity ?? ""),
    originCountry: String(d.originCountry ?? "IN"),
    destCountry: String(d.destCountry ?? "IN"),
    originPin: String(d.originPin ?? ""),
    destPin: String(d.destPin ?? ""),
    scope: (d.scope as "domestic" | "international") ?? "domestic",
    currency: quote.currency ?? "INR",
    gstEnabled: d.gstEnabled !== false,
    validity: String(d.validity ?? "15 days") || "15 days",
    packages: (d.packages as Array<{ qty: number; gw?: number; l?: number; w?: number; h?: number }>) ?? [
      { qty: 1, gw: 5, l: 30, w: 20, h: 15 },
    ],
    lanes: savedLanes,
    couriers,
    terms: String(d.termsAndConditions ?? ""),
  };
}
