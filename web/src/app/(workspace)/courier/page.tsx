"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Package, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  calculateCourierFreight,
  SERVICE_LEVELS,
  type CourierFreightResult,
  type CourierPackageLine,
  type CourierServiceKey,
} from "@atlas/pricing-core";
import { Button, Card, Tabs } from "@/components/ui";
import { PincodeCombobox } from "@/components/PincodeCombobox";
import { LocationCombobox } from "@/components/LocationCombobox";
import { ValidityField } from "@/components/ValidityField";
import { QuotePreviewModal } from "@/components/QuotePreviewModal";
import { CarrierCombobox } from "@/components/CarrierCombobox";
import { EmptyNumberInput } from "@/components/EmptyNumberInput";
import { VendorCompareList } from "@/components/VendorCompareList";
import { vendorRowsFromEntries } from "@/lib/quotes/vendor-preview";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { useCourierTariffs } from "@/hooks/use-atlas-data";
import {
  COURIER_TARIFF_MAX_KG,
  COURIER_TARIFF_MARKUP_PCT,
  applyCourierTariffMarkup,
  inferCourierCarrier,
  lookupCourierTariff,
  type CourierTariffBook,
  type CourierTariffLookup,
} from "@/lib/quotes/courier-tariff";
import { DEFAULT_COURIER_TERMS, saveCourierQuote, type CourierCardResult } from "@/lib/firebase/save-quote";
import { persistQuoteToEnquiryDb, savedEnquiryHref, savedEnquiryMessage } from "@/lib/quotes/persist-enquiry";
import {
  allLanesRoute,
  optionsOnLane,
  quotedLaneRows,
  quotedOnLane,
  selectWithinLane,
  stampOntoFirstLane,
  usableLanes,
} from "@/lib/quotes/lanes";
import { courierSnapshot } from "@/lib/quotes/option-breakdown";
import { loadCourierDeskFromQuote } from "@/lib/quotes/desk-loader";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
import { useDeskStepKeys } from "@/hooks/use-desk-step-keys";
import { useQuoteDeskLoader } from "@/hooks/use-quote-desk-loader";
import { toast } from "@/components/Toast";
import { LaneChips, newLane, type QuoteLane } from "@/components/LaneChips";
import type { SavedQuote } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { nextQuoteNumber } from "@/lib/quotes/ref-id";
import {
  createCourierOption,
  type CourierOption,
} from "@/lib/pricing/carrier-options";
import {
  countrySelectOptions,
  inferCountryFromText,
} from "@/lib/locations/country-aliases";
import { searchPostalCodes, type PostalHit } from "@/lib/locations/postal-search";
import { searchLocations, type LocationHit } from "@/lib/locations/search";
import { firstFieldBackTab, focusById, lastFieldTab } from "@/lib/ui/desk-keyboard";
import { useAntiAutofillName } from "@/lib/ui/anti-autofill";

function isoFromAirport(hit: LocationHit): string | null {
  const c = (hit.country || "").trim();
  if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
  return inferCountryFromText(`${hit.city} ${hit.name} ${c}`);
}

const EMPTY_PACKAGE: CourierPackageLine = { qty: 1, gw: 0, l: 0, w: 0, h: 0 };

type Tab = "shipment" | "packages" | "carriers" | "terms";

const COURIER_STEPS: Tab[] = ["shipment", "packages", "carriers", "terms"];

const COURIER_FOCUS: Record<Tab, string> = {
  shipment: "courier-customer",
  packages: "courier-pkg-0-qty",
  carriers: "courier-margin",
  terms: "courier-terms",
};

/** Per-card sell computation — same tariff-lookup + markup formula every card
 * uses, so two carriers on the same lane price independently and comparably. */
function priceCourierCard(
  option: CourierOption,
  ctx: {
    tariffBooks: CourierTariffBook[];
    chargeableKg: number;
    originCountry: string;
    destCountry: string;
    originCity: string;
    originPin: string;
    destCity: string;
    destPin: string;
    scope: "domestic" | "international";
    gstEnabled: boolean;
  },
): {
  tariff: CourierTariffLookup;
  name: string;
  uploaded: number;
  markupPct: number;
  markupAmount: number;
  base: number;
  fuel: number;
  extras: number;
  tax: number;
  total: number;
} {
  const tariff = lookupCourierTariff(ctx.tariffBooks, {
    carrierId: option.carrierId,
    directoryCarrier: option.directoryCarrier,
    originCountry: ctx.originCountry,
    destCountry: ctx.destCountry,
    originText: `${ctx.originCity} ${ctx.originPin}`,
    destText: `${ctx.destCity} ${ctx.destPin}`,
    weightKg: ctx.chargeableKg,
    scope: ctx.scope,
  });
  const uploaded = tariff.status === "hit" ? tariff.rate : 0;
  const base = uploaded > 0 ? applyCourierTariffMarkup(uploaded) : 0;
  const markupPct = uploaded > 0 ? COURIER_TARIFF_MARKUP_PCT : 0;
  const markupAmount = Math.max(0, base - uploaded);
  const s = option.surcharges;
  const fuel = base * ((s.fuelPct || 0) / 100);
  const extras =
    (s.remote ? s.remoteAmount : 0) +
    (s.residential ? s.residentialAmount : 0) +
    (s.saturday ? s.saturdayAmount : 0) +
    (s.dg ? s.dgAmount : 0) +
    (s.oversized ? s.oversizedAmount : 0) +
    (s.insurance ? Math.max((s.declaredValue * s.insurancePct) / 100, 0) : 0);
  const sub = base + fuel + extras;
  const tax = ctx.gstEnabled ? sub * 0.18 : 0;
  const name =
    option.directoryCarrier.trim() || (tariff.status === "hit" ? tariff.book.carrier : "");
  return { tariff, name, uploaded, markupPct, markupAmount, base, fuel, extras, tax, total: sub + tax };
}

function CourierDeskInner() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const loader = useQuoteDeskLoader();
  const { data: tariffBooks = [] } = useCourierTariffs();
  const customerFieldName = useAntiAutofillName("atlas-party-courier");
  const [tab, setTab] = useState<Tab>("shipment");
  const [customer, setCustomer] = useState("");
  const [lanes, setLanes] = useState<QuoteLane[]>(() => [newLane()]);
  const [activeLaneId, setActiveLaneId] = useState("");
  const activeLane = lanes.find((l) => l.id === (activeLaneId || lanes[0]?.id)) ?? lanes[0];
  const fallbackLaneId = lanes[0]?.id || "";
  const originCity = activeLane?.origin ?? "";
  const destCity = activeLane?.destination ?? "";
  function setOriginCity(next: string) {
    const id = activeLane?.id;
    if (!id) return;
    setLanes((prev) => prev.map((l) => (l.id === id ? { ...l, origin: next } : l)));
  }
  function setDestCity(next: string) {
    const id = activeLane?.id;
    if (!id) return;
    setLanes((prev) => prev.map((l) => (l.id === id ? { ...l, destination: next } : l)));
  }
  const [originCountry, setOriginCountry] = useState("IN");
  const [destCountry, setDestCountry] = useState("IN");
  const [originPin, setOriginPin] = useState("");
  const [destPin, setDestPin] = useState("");
  const [scope, setScope] = useState<"domestic" | "international">("domestic");
  const [currency, setCurrency] = useState("INR");
  const [gstEnabled, setGstEnabled] = useState(true);
  const [validity, setValidity] = useState("15 days");
  const [packages, setPackages] = useState<CourierPackageLine[]>([{ ...EMPTY_PACKAGE }]);
  const [couriers, setCouriers] = useState<CourierOption[]>(() => [createCourierOption({}, true)]);
  const [terms, setTerms] = useState(DEFAULT_COURIER_TERMS);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveEnquiryPath, setSaveEnquiryPath] = useState<string | null>(null);
  const [previewQuote, setPreviewQuote] = useState<SavedQuote | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const multiLane = usableLanes(lanes).length > 1;
  const couriersOnLane = optionsOnLane(couriers, activeLaneId, fallbackLaneId);
  const activeCourier = quotedOnLane(couriers, activeLaneId, fallbackLaneId);

  useEffect(() => {
    if (!activeLaneId && lanes[0]) setActiveLaneId(lanes[0].id);
  }, [activeLaneId, lanes]);

  function updateSelectedCourier(patch: Partial<CourierOption>) {
    const id = activeCourier?.id;
    if (!id) return;
    setCouriers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function selectCourier(id: string) {
    setCouriers((prev) => selectWithinLane(prev, id, fallbackLaneId));
  }

  function addCourier() {
    const laneId = activeLane?.id || fallbackLaneId;
    setCouriers((prev) => [
      ...prev,
      createCourierOption({ laneId }, !optionsOnLane(prev, laneId, fallbackLaneId).length),
    ]);
  }

  function removeCourier(id: string) {
    setCouriers((prev) => {
      const onLane = optionsOnLane(prev, activeLaneId, fallbackLaneId);
      if (onLane.length <= 1) return prev;
      const next = prev.filter((c) => c.id !== id);
      if (!next.some((c) => (c.laneId || fallbackLaneId) === (activeLane?.id || fallbackLaneId) && c.selected)) {
        const first = optionsOnLane(next, activeLaneId, fallbackLaneId)[0];
        if (first) return next.map((c) => (c.id === first.id ? { ...c, selected: true } : c));
      }
      return next;
    });
  }

  function applyCountry(next: string, which: "origin" | "dest") {
    const code = next.toUpperCase().slice(0, 2);
    if (!code) return;
    if (which === "origin") setOriginCountry(code);
    else setDestCountry(code);
  }

  function applyAirportHit(hit: LocationHit, which: "origin" | "dest") {
    const code = hit.code.toUpperCase();
    if (which === "origin") setOriginCity(code);
    else setDestCity(code);
    const cc = isoFromAirport(hit);
    if (cc) applyCountry(cc, which);
  }

  function applyPostalHit(hit: PostalHit, which: "origin" | "dest") {
    if (which === "origin") {
      setOriginPin(hit.pin);
      if (hit.place) setOriginCity(hit.place);
      if (hit.country) applyCountry(hit.country, "origin");
    } else {
      setDestPin(hit.pin);
      if (hit.place) setDestCity(hit.place);
      if (hit.country) applyCountry(hit.country, "dest");
    }
  }

  useEffect(() => {
    const fromCity = inferCountryFromText(originCity);
    const fromPin = inferCountryFromText(originPin);
    const next = fromCity || fromPin;
    if (next) setOriginCountry(next);
    const q = originCity.trim() || originPin.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void Promise.all([searchLocations(q, "airport", 6), searchPostalCodes(q, 6)]).then(
        ([air, post]) => {
          if (cancelled) return;
          const exact = air.find((h) => h.code.toUpperCase() === q.toUpperCase());
          const airHit = exact || air[0];
          const airCc = airHit ? isoFromAirport(airHit) : null;
          if (airCc) {
            setOriginCountry(airCc);
            return;
          }
          const c = post.find((h) => h.country)?.country;
          if (c && (!next || next === "IN" || c === next)) setOriginCountry(c);
        },
      );
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [originCity, originPin]);

  useEffect(() => {
    const fromCity = inferCountryFromText(destCity);
    const fromPin = inferCountryFromText(destPin);
    const next = fromCity || fromPin;
    if (next) setDestCountry(next);
    const q = destCity.trim() || destPin.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void Promise.all([searchLocations(q, "airport", 6), searchPostalCodes(q, 6)]).then(
        ([air, post]) => {
          if (cancelled) return;
          const exact = air.find((h) => h.code.toUpperCase() === q.toUpperCase());
          const airHit = exact || air[0];
          const airCc = airHit ? isoFromAirport(airHit) : null;
          if (airCc) {
            setDestCountry(airCc);
            return;
          }
          const c = post.find((h) => h.country)?.country;
          if (c && (!next || next === "IN" || c === next)) setDestCountry(c);
        },
      );
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [destCity, destPin]);

  useEffect(() => {
    if (!originCountry || !destCountry) return;
    setScope(originCountry === destCountry ? "domestic" : "international");
    setCouriers((prev) =>
      prev.map((c) =>
        originCountry !== destCountry && c.service === "same_day" ? { ...c, service: "economy" } : c,
      ),
    );
  }, [originCountry, destCountry]);

  const countryOptions = countrySelectOptions([originCountry, destCountry]);

  const goCourierStep = useCallback(
    (next: Tab, focusId: string) => {
      setTab(next);
      focusById(focusId);
    },
    [],
  );

  useDeskStepKeys({
    steps: COURIER_STEPS,
    setStep: (s) => goCourierStep(s, COURIER_FOCUS[s]),
    focusIds: COURIER_FOCUS,
  });

  useEffect(() => {
    if (loader.sourceQuote || !loader.prefillCustomer) return;
    setCustomer(loader.prefillCustomer);
  }, [loader.prefillCustomer, loader.sourceQuote]);

  useEffect(() => {
    if (!loader.sourceQuote) return;
    const loaded = loadCourierDeskFromQuote(loader.sourceQuote);
    setCustomer(loaded.customer);
    const restoredLanes = loaded.lanes.length
      ? loaded.lanes
      : [newLane({ origin: loaded.originCity, destination: loaded.destCity })];
    setLanes(restoredLanes);
    setActiveLaneId(restoredLanes[0].id);
    setOriginCountry(loaded.originCountry);
    setDestCountry(loaded.destCountry);
    setOriginPin(loaded.originPin);
    setDestPin(loaded.destPin);
    setScope(loaded.scope);
    setCurrency(loaded.currency);
    setGstEnabled(loaded.gstEnabled);
    setValidity(loaded.validity);
    setPackages(loaded.packages);
    setCouriers(loaded.couriers);
    if (loaded.terms) setTerms(loaded.terms);
  }, [loader.sourceQuote]);

  // Shared across every card — chargeable weight/zone depend only on cargo
  // and countries, never on which carrier or service is being compared.
  const cargo = useMemo(
    () =>
      calculateCourierFreight({
        packages,
        originCountry,
        destCountry,
        service: "economy",
        currency,
        marginPct: 0,
        gstEnabled,
        surcharges: {
          fuelPct: 0,
          remote: false,
          remoteAmount: 0,
          residential: false,
          residentialAmount: 0,
          saturday: false,
          saturdayAmount: 0,
          dg: false,
          dgAmount: 0,
          insurance: false,
          insurancePct: 0,
          declaredValue: 0,
          oversized: false,
          oversizedAmount: 0,
        },
      }),
    [packages, originCountry, destCountry, currency, gstEnabled],
  );
  const cargoReady = cargo.chargeableKg > 0;

  const priceCtx = useMemo(
    () => ({
      tariffBooks,
      chargeableKg: cargo.chargeableKg,
      originCountry,
      destCountry,
      originCity,
      originPin,
      destCity,
      destPin,
      scope,
      gstEnabled,
    }),
    [tariffBooks, cargo.chargeableKg, originCountry, destCountry, originCity, originPin, destCity, destPin, scope, gstEnabled],
  );

  const priced = useMemo(
    () => couriers.map((option) => ({ option, ...priceCourierCard(option, priceCtx) })),
    [couriers, priceCtx],
  );
  const pricedById = useMemo(() => new Map(priced.map((p) => [p.option.id, p])), [priced]);
  const activePriced = activeCourier ? pricedById.get(activeCourier.id) : undefined;

  const quotedLanes = useMemo(() => {
    const named = couriers.map((c) => ({
      ...c,
      name: pricedById.get(c.id)?.name || c.directoryCarrier || "Untitled",
    }));
    return quotedLaneRows(lanes, named, (c) => pricedById.get(c.id)?.total ?? 0);
  }, [lanes, couriers, pricedById]);
  const allLanesTotal = useMemo(() => quotedLanes.reduce((sum, l) => sum + l.amount, 0), [quotedLanes]);

  function applyReset() {
    const lane = newLane();
    setCustomer("");
    setLanes([lane]);
    setActiveLaneId(lane.id);
    setOriginCountry("IN");
    setDestCountry("IN");
    setOriginPin("");
    setDestPin("");
    setScope("domestic");
    setCurrency("INR");
    setGstEnabled(true);
    setValidity("15 days");
    setPackages([{ ...EMPTY_PACKAGE }]);
    setCouriers([createCourierOption({}, true)]);
    setTerms(DEFAULT_COURIER_TERMS);
    setSaveMsg(null);
    setSaveEnquiryPath(null);
    setPreviewQuote(null);
    setConfirmReset(false);
    loader.clearLoadedQuote();
    // Only strip load params — replacing a clean /courier/ remounts and looked like reset failed.
    if (typeof window !== "undefined" && /[?&](edit|duplicate|smart)=/.test(window.location.search)) {
      router.replace("/courier/");
    }
    toast("Courier form cleared", "success");
  }

  function cardResults(): CourierCardResult[] {
    return priced.map((p) => ({
      option: p.option,
      name: p.name || p.option.directoryCarrier || "Untitled",
      sellLocal: p.total,
      ratePerKg: cargo.chargeableKg ? p.base / cargo.chargeableKg : 0,
      transit: SERVICE_LEVELS[p.option.service as CourierServiceKey]?.transit,
      chargeableKg: cargo.chargeableKg,
      gstAmount: p.tax,
    }));
  }

  const handlePreview = () => {
    if (cargo.chargeableKg <= 0) {
      toast("Enter package weight / dimensions before preview.", "error");
      setTab("packages");
      return;
    }
    const cards = cardResults();
    const primary = cards.find((c) => c.option.selected) ?? cards[0];
    const amount = multiLane ? allLanesTotal : primary?.sellLocal ?? 0;
    const q: SavedQuote = {
      id: loader.editingQuoteId || "preview",
      customer: customer.trim() || "Draft",
      creator: user?.username || "",
      status: loader.editingStatus || "quoted",
      type: "courier",
      quoteNumber: loader.editingQuoteNumber ?? nextQuoteNumber(),
      date: new Date().toISOString().split("T")[0],
      timestamp: Date.now(),
      amount,
      currency,
      route: multiLane ? allLanesRoute(lanes) : `${originCity || "—"} → ${destCity || "—"}`,
      details: {
        origin: originCity,
        destination: destCity,
        originCountry,
        destCountry,
        service: primary?.option.service,
        carrier: primary?.option.carrierId,
        carrierName: primary?.name,
        directoryCarrier: primary?.option.directoryCarrier,
        carrierQuotes: cards.map((c) => courierSnapshot(c.option, c, lanes, fallbackLaneId)),
        chargeableWeight: cargo.chargeableKg,
        zone: cargo.zone,
        gstAmount: primary?.gstAmount ?? 0,
        validity,
        originCity,
        destCity,
        lanes: lanes.map((l) => ({ id: l.id, origin: l.origin, destination: l.destination })),
        quotedLanes,
        allLanesTotal,
        termsAndConditions: terms,
        mode: "Courier",
      },
    };
    setPreviewQuote(q);
  };

  const handleSave = useCallback(
    async () => {
      if (!customer.trim()) {
        const msg = "Enter customer name before saving.";
        setSaveMsg(msg);
        toast(msg, "error");
        return;
      }
      if (cargo.chargeableKg <= 0) {
        const msg = "Enter package weight / dimensions before saving (chargeable kg is 0).";
        setSaveMsg(msg);
        toast(msg, "error");
        setTab("packages");
        return;
      }
      if (multiLane && usableLanes(lanes).length !== lanes.length) {
        const msg = "Every lane needs both an origin and a destination before saving.";
        setSaveMsg(msg);
        toast(msg, "error");
        setTab("shipment");
        return;
      }
      const cards = cardResults();
      const primary = cards.find((c) => c.option.selected) ?? cards[0];
      const primaryPriced = priced.find((p) => p.option.id === primary?.option.id);
      const amount = multiLane ? allLanesTotal : primary?.sellLocal ?? 0;
      const quoteNumber = loader.editingQuoteNumber ?? nextQuoteNumber();
      const quoteId = loader.editingQuoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
      const localQuote: SavedQuote = {
        id: quoteId,
        customer: customer.trim(),
        creator: user?.username || "",
        status: loader.editingStatus || "quoted",
        type: "courier",
        quoteNumber,
        date: new Date().toISOString().split("T")[0],
        timestamp: Date.now(),
        amount,
        currency,
        route: multiLane ? allLanesRoute(lanes) : `${originCity || "—"} → ${destCity || "—"}`,
        details: {
          origin: originCity,
          destination: destCity,
          originCountry,
          destCountry,
          service: primary?.option.service,
          carrier: primary?.option.carrierId,
          carrierName: primary?.name,
          directoryCarrier: primary?.option.directoryCarrier,
          carrierQuotes: cards.map((c) => courierSnapshot(c.option, c, lanes, fallbackLaneId)),
          chargeableWeight: cargo.chargeableKg,
          zone: cargo.zone,
          gstAmount: primary?.gstAmount ?? 0,
          validity,
          originCity,
          destCity,
          lanes: lanes.map((l) => ({ id: l.id, origin: l.origin, destination: l.destination })),
          quotedLanes,
          allLanesTotal,
          termsAndConditions: terms,
          mode: "Courier",
        },
      };
      setSaving(true);
      setSaveMsg(null);
      let cloud: "live" | "local" | "cloud-failed" = "local";
      try {
        if (useLiveData && user && primary && primaryPriced) {
          try {
            const calc: CourierFreightResult = {
              ...cargo,
              quotes: [],
              baseFreight: primaryPriced.base,
              buyFreight: primaryPriced.base,
              subtotal: primaryPriced.base + primaryPriced.fuel + primaryPriced.extras,
              tax: primaryPriced.tax,
              total: primaryPriced.total,
              grossProfit: 0,
              surcharges: {
                ...cargo.surcharges,
                fuel: primaryPriced.fuel,
                total: primaryPriced.fuel + primaryPriced.extras,
                declaredValue: primary.option.surcharges.declaredValue,
              },
            };
            await saveCourierQuote({
              customer: customer.trim(),
              creator: user.username,
              originCity,
              destCity,
              originCountry,
              destCountry,
              originPin,
              destPin,
              scope,
              service: primary.option.service,
              currency,
              marginPct: primary.option.marginPct,
              gstEnabled,
              packages: cargo.packages,
              calc,
              lanes,
              cards,
              quotedLanes,
              allLanesAmount: multiLane ? allLanesTotal : undefined,
              termsAndConditions: terms,
              validity,
              quoteId,
              quoteNumber,
              status: loader.editingStatus,
            });
            cloud = "live";
          } catch (e) {
            cloud = "cloud-failed";
            console.warn("Cloud save failed, kept local Enquiry DB row", e);
          }
        }
        const row = persistQuoteToEnquiryDb(localQuote, queryClient);
        const msg = savedEnquiryMessage(row, { cloud });
        setSaveMsg(msg);
        setSaveEnquiryPath(savedEnquiryHref(row));
        toast(msg, cloud === "cloud-failed" ? "info" : "success");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Save failed";
        setSaveMsg(msg);
        toast(msg, "error");
      } finally {
        setSaving(false);
      }
    },
    [
      customer,
      user,
      originCity,
      destCity,
      originCountry,
      destCountry,
      originPin,
      destPin,
      scope,
      currency,
      gstEnabled,
      validity,
      cargo,
      priced,
      terms,
      loader.editingQuoteId,
      loader.editingQuoteNumber,
      loader.editingStatus,
      queryClient,
      lanes,
      fallbackLaneId,
      multiLane,
      allLanesTotal,
    ],
  );

  useDeskSaveShortcut(() => void handleSave(), !saving);

  return (
    <div className="space-y-6">
      {loader.banner ? (
        <Card className="border-sky-200 bg-sky-50">
          <p className="text-sm font-semibold text-sky-900">{loader.banner}</p>
        </Card>
      ) : null}
      {loader.loadError ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-900">{loader.loadError}</p>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-violet-600">
            <Package className="h-5 w-5" />
            <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Courier desk</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            4-tab flow — shipment, packages, carriers, terms. Add a lane for extra city pairs, and
            more than one carrier per lane to compare. Yearly Circulars Excel fills freight up to
            70 kg. Tab last field → next step · Alt+1–4 · ⌘S to save.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button type="button" variant="secondary" data-testid="desk-preview" onClick={handlePreview}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button id="courier-save" type="button" onClick={() => void handleSave()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save quote"}
          </Button>
        </div>
      </div>


      {confirmReset ? (
        <Card className="border-amber-300 bg-amber-50">
          <p className="text-sm font-semibold text-amber-950">
            Clear this courier form? Customer, packages, and carriers will be wiped.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={applyReset}>
              Yes, reset
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {saveMsg ? (
        <Card className={saveMsg.includes("Saved") || saveMsg.includes("Amended") ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{saveMsg}</p>
            {saveEnquiryPath ? (
              <Button type="button" variant="secondary" className="h-8" onClick={() => router.push(saveEnquiryPath)}>
                Open Enquiry DB
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {cargo.oversized ? (
        <Card className="border-amber-300 bg-amber-50">
          <p className="text-sm font-semibold text-amber-900">
            Oversized piece detected — enable oversized handling surcharge if applicable.
          </p>
        </Card>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(v) => goCourierStep(v as Tab, COURIER_FOCUS[v as Tab])}
        idPrefix="courier-step"
        items={[
          { value: "shipment", label: "Shipment" },
          { value: "packages", label: "Packages" },
          { value: "carriers", label: `Carriers (${couriersOnLane.length})` },
          { value: "terms", label: "Terms" },
        ]}
      />
      <p className="-mt-2 text-[11px] text-[var(--color-text-muted)]">
        Keyboard: Tab on the last field of a step opens the next tab. Shift+Tab on the first field
        goes back. Alt+1 Shipment · Alt+2 Packages · Alt+3 Carriers · Alt+4 Terms.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          {tab === "shipment" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <LaneChips
                  lanes={lanes}
                  activeId={activeLane?.id || lanes[0]?.id || ""}
                  onSelect={setActiveLaneId}
                  onAdd={() => {
                    const lane = newLane();
                    setLanes((prev) => [...prev, lane]);
                    setActiveLaneId(lane.id);
                    setCouriers((prev) => [
                      ...stampOntoFirstLane(prev, lanes[0]?.id || ""),
                      createCourierOption({ laneId: lane.id }, true),
                    ]);
                  }}
                  onRemove={(id) => {
                    setLanes((prev) => {
                      const next = prev.filter((l) => l.id !== id);
                      return next.length ? next : prev;
                    });
                    setCouriers((prev) => prev.filter((c) => c.laneId !== id));
                    if (activeLaneId === id && lanes[0]) setActiveLaneId(lanes[0].id);
                  }}
                />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Add a lane for extra origin → destination city pairs. Cities use the same IATA
                  3-letter airport list as Air desk — type a city or code, then pick from the dropdown.
                  Each lane compares its own carriers, independently of the others.
                </p>
              </div>
              <label className="text-sm font-semibold md:col-span-2">
                Customer
                <input
                  id="courier-customer"
                  name={customerFieldName}
                  autoComplete="off"
                  data-1p-ignore="true"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  onKeyDown={(e) =>
                    firstFieldBackTab(e, () => document.getElementById("courier-step-shipment")?.focus())
                  }
                />
              </label>
              <LocationCombobox
                label="Origin city"
                value={originCity}
                onChange={setOriginCity}
                onPick={(hit) => applyAirportHit(hit, "origin")}
                kind="airport"
                placeholder="BLR, Bangalore…"
                inputId="courier-origin-city"
              />
              <LocationCombobox
                label="Destination city"
                value={destCity}
                onChange={setDestCity}
                onPick={(hit) => applyAirportHit(hit, "dest")}
                kind="airport"
                placeholder="BAH, Bahrain…"
                inputId="courier-dest-city"
              />
              <PincodeCombobox
                label="Origin PIN / ZIP"
                value={originPin}
                onChange={setOriginPin}
                onPick={(hit) => applyPostalHit(hit, "origin")}
                placeholder="560001 or city"
                inputId="courier-origin-pin"
              />
              <PincodeCombobox
                label="Destination PIN / ZIP"
                value={destPin}
                onChange={setDestPin}
                onPick={(hit) => applyPostalHit(hit, "dest")}
                placeholder="Manama / 339"
                inputId="courier-dest-pin"
              />
              <label className="text-sm font-semibold">
                Origin country
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                >
                  {countryOptions.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Destination country
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={destCountry}
                  onChange={(e) => setDestCountry(e.target.value)}
                >
                  {countryOptions.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Scope
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "domestic" | "international")}
                >
                  <option value="domestic">Domestic</option>
                  <option value="international">International</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Currency
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {["INR", "USD", "EUR", "GBP"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <ValidityField
                value={validity}
                onChange={setValidity}
                textInputId="courier-validity"
                onTextKeyDown={(e) =>
                  lastFieldTab(e, () => goCourierStep("packages", "courier-pkg-0-qty"))
                }
              />
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  id="courier-gst"
                  type="checkbox"
                  checked={gstEnabled}
                  onChange={(e) => setGstEnabled(e.target.checked)}
                />
                Apply GST (18%) — one tax rule for the whole shipment, all carriers
              </label>
            </div>
          ) : null}

          {tab === "packages" ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-bold">Packages</h3>
                <Button type="button" variant="secondary" onClick={() => setPackages((p) => [...p, { qty: 1 }])}>
                  <Plus className="mr-1 h-4 w-4" /> Add row
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-[var(--color-text-muted)]">
                    <tr>
                      <th className="px-2 py-2">Qty</th>
                      <th className="px-2 py-2">GW kg</th>
                      <th className="px-2 py-2">L</th>
                      <th className="px-2 py-2">W</th>
                      <th className="px-2 py-2">H</th>
                      <th className="px-2 py-2">VWT</th>
                      <th className="px-2 py-2">CHW</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1">
                          <input
                            id={i === 0 ? "courier-pkg-0-qty" : undefined}
                            type="number"
                            className="w-14 rounded border px-1 py-1"
                            value={p.qty}
                            onChange={(e) =>
                              setPackages((prev) =>
                                prev.map((pp, j) => (j === i ? { ...pp, qty: Number(e.target.value) } : pp)),
                              )
                            }
                            onKeyDown={(e) =>
                              i === 0
                                ? firstFieldBackTab(e, () => goCourierStep("shipment", "courier-validity"))
                                : undefined
                            }
                          />
                        </td>
                        <td className="p-1">
                          <EmptyNumberInput
                            className="w-16 rounded border px-1 py-1"
                            value={p.gw ?? 0}
                            onChange={(gw) =>
                              setPackages((prev) => prev.map((pp, j) => (j === i ? { ...pp, gw } : pp)))
                            }
                          />
                        </td>
                        <td className="p-1">
                          <EmptyNumberInput
                            className="w-14 rounded border px-1 py-1"
                            value={p.l ?? 0}
                            onChange={(l) =>
                              setPackages((prev) => prev.map((pp, j) => (j === i ? { ...pp, l } : pp)))
                            }
                          />
                        </td>
                        <td className="p-1">
                          <EmptyNumberInput
                            className="w-14 rounded border px-1 py-1"
                            value={p.w ?? 0}
                            onChange={(w) =>
                              setPackages((prev) => prev.map((pp, j) => (j === i ? { ...pp, w } : pp)))
                            }
                          />
                        </td>
                        <td className="p-1">
                          <EmptyNumberInput
                            className="w-14 rounded border px-1 py-1"
                            value={p.h ?? 0}
                            onChange={(h) =>
                              setPackages((prev) => prev.map((pp, j) => (j === i ? { ...pp, h } : pp)))
                            }
                            onKeyDown={(e) =>
                              i === packages.length - 1
                                ? lastFieldTab(e, () => goCourierStep("carriers", "courier-margin"))
                                : undefined
                            }
                          />
                        </td>
                        <td className="p-1 text-xs font-semibold" data-testid="courier-vwt">
                          {cargo.packages[i]?.volumeWeight != null
                            ? `${cargo.packages[i].volumeWeight.toFixed(2)} kg`
                            : "—"}
                        </td>
                        <td className="p-1 text-xs font-semibold" data-testid="courier-chw">
                          {cargo.packages[i]?.chargeable.toFixed(2) ?? "—"} kg
                        </td>
                        <td className="p-1">
                          <button type="button" className="text-red-600" onClick={() => setPackages((prev) => prev.filter((_, j) => j !== i))} disabled={packages.length <= 1}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                CHW is the higher of GW and volume weight (L × W × H × qty ÷ 5000). Qty does not
                multiply GW. Shared by every carrier card below.
              </p>
            </div>
          ) : null}

          {tab === "carriers" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-[var(--color-atlas-navy)]">
                  Carriers ({couriersOnLane.length})
                  {multiLane && activeLane ? (
                    <span className="ml-2 text-xs font-semibold text-[var(--color-text-muted)]">
                      · {quotedLanes.find((l) => l.laneId === activeLane.id)?.laneLabel}
                    </span>
                  ) : null}
                </h2>
                <Button type="button" variant="secondary" onClick={addCourier}>
                  <Plus className="mr-1 h-4 w-4" />
                  Carrier
                </Button>
              </div>
              {couriersOnLane.map((c) => {
                const p = pricedById.get(c.id);
                return (
                  <label key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`selected-courier-${activeLane?.id || "lane"}`}
                      checked={c.selected}
                      onChange={() => selectCourier(c.id)}
                    />
                    <span className="font-semibold">
                      {p?.name || c.directoryCarrier || "Untitled carrier"}
                      {c.selected ? " · quoted" : ""}
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      {p ? formatCurrency(p.total, currency) : "—"}
                    </span>
                    {couriersOnLane.length > 1 ? (
                      <button
                        type="button"
                        className="ml-auto text-red-600"
                        onClick={() => removeCourier(c.id)}
                        aria-label="Remove carrier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </label>
                );
              })}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <CarrierCombobox
                    label="Carrier / Airline"
                    value={activeCourier?.directoryCarrier ?? ""}
                    onChange={(v) =>
                      updateSelectedCourier({ directoryCarrier: v, carrierId: inferCourierCarrier(v).id })
                    }
                    kind="airline+courier"
                    placeholder="Blue Dart, DHL, FedEx, UL…"
                  />
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Select FedEx after cargo is filled and the yearly Circulars tariff fills
                    automatically (sell = uploaded rate + {COURIER_TARIFF_MARKUP_PCT}%). Fuel is extra.
                  </p>
                </div>
                <label className="text-sm font-semibold">
                  Service
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    value={activeCourier?.service ?? "economy"}
                    onChange={(e) => updateSelectedCourier({ service: e.target.value })}
                  >
                    {Object.entries(SERVICE_LEVELS).map(([k, v]) => (
                      <option key={k} value={k} disabled={k === "same_day" && scope !== "domestic"}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Margin %
                  <input
                    id="courier-margin"
                    type="number"
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    value={activeCourier?.marginPct ?? 12}
                    onChange={(e) => updateSelectedCourier({ marginPct: Number(e.target.value) })}
                  />
                  <span className="mt-1 block text-xs font-normal text-[var(--color-text-muted)]">
                    Estimated cards only. Circulars FedEx tariff always sells at +{COURIER_TARIFF_MARKUP_PCT}% on the uploaded rate.
                  </span>
                </label>
              </div>

              {activeCourier ? (
                <div className="space-y-3 rounded-lg border border-[var(--color-border)] p-3">
                  <h3 className="text-sm font-bold">
                    Surcharges — {pricedById.get(activeCourier.id)?.name || "this carrier"}
                  </h3>
                  <label className="text-sm font-semibold">
                    Fuel surcharge %
                    <EmptyNumberInput
                      className="mt-1 w-full"
                      value={activeCourier.surcharges.fuelPct}
                      onChange={(fuelPct) =>
                        updateSelectedCourier({ surcharges: { ...activeCourier.surcharges, fuelPct } })
                      }
                    />
                  </label>
                  <SurchargeToggle
                    label="Remote area"
                    checked={activeCourier.surcharges.remote}
                    amount={activeCourier.surcharges.remoteAmount}
                    onToggle={(v) =>
                      updateSelectedCourier({ surcharges: { ...activeCourier.surcharges, remote: v } })
                    }
                    onAmount={(v) =>
                      updateSelectedCourier({ surcharges: { ...activeCourier.surcharges, remoteAmount: v } })
                    }
                  />
                  <SurchargeToggle
                    label="Residential delivery"
                    checked={activeCourier.surcharges.residential}
                    amount={activeCourier.surcharges.residentialAmount}
                    onToggle={(v) =>
                      updateSelectedCourier({ surcharges: { ...activeCourier.surcharges, residential: v } })
                    }
                    onAmount={(v) =>
                      updateSelectedCourier({
                        surcharges: { ...activeCourier.surcharges, residentialAmount: v },
                      })
                    }
                  />
                  <SurchargeToggle
                    label="Saturday delivery"
                    checked={activeCourier.surcharges.saturday}
                    amount={activeCourier.surcharges.saturdayAmount}
                    onToggle={(v) =>
                      updateSelectedCourier({ surcharges: { ...activeCourier.surcharges, saturday: v } })
                    }
                    onAmount={(v) =>
                      updateSelectedCourier({ surcharges: { ...activeCourier.surcharges, saturdayAmount: v } })
                    }
                  />
                  <SurchargeToggle
                    label="Dangerous goods"
                    checked={activeCourier.surcharges.dg}
                    amount={activeCourier.surcharges.dgAmount}
                    onToggle={(v) =>
                      updateSelectedCourier({ surcharges: { ...activeCourier.surcharges, dg: v } })
                    }
                    onAmount={(v) =>
                      updateSelectedCourier({ surcharges: { ...activeCourier.surcharges, dgAmount: v } })
                    }
                  />
                  <SurchargeToggle
                    label="Oversized handling"
                    checked={activeCourier.surcharges.oversized}
                    amount={activeCourier.surcharges.oversizedAmount}
                    onToggle={(v) =>
                      updateSelectedCourier({ surcharges: { ...activeCourier.surcharges, oversized: v } })
                    }
                    onAmount={(v) =>
                      updateSelectedCourier({ surcharges: { ...activeCourier.surcharges, oversizedAmount: v } })
                    }
                  />
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={activeCourier.surcharges.insurance}
                      onChange={(e) =>
                        updateSelectedCourier({
                          surcharges: { ...activeCourier.surcharges, insurance: e.target.checked },
                        })
                      }
                    />
                    Cargo insurance
                  </label>
                  {activeCourier.surcharges.insurance ? (
                    <>
                      <label className="text-sm font-semibold">
                        Insurance %
                        <EmptyNumberInput
                          className="mt-1 w-full"
                          value={activeCourier.surcharges.insurancePct}
                          onChange={(insurancePct) =>
                            updateSelectedCourier({
                              surcharges: { ...activeCourier.surcharges, insurancePct },
                            })
                          }
                        />
                      </label>
                      <label className="text-sm font-semibold">
                        Declared value
                        <EmptyNumberInput
                          className="mt-1 w-full"
                          value={activeCourier.surcharges.declaredValue}
                          onChange={(declaredValue) =>
                            updateSelectedCourier({
                              surcharges: { ...activeCourier.surcharges, declaredValue },
                            })
                          }
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "terms" ? (
            <label className="block text-sm font-semibold">
              Terms & conditions
              <textarea
                id="courier-terms"
                className="mt-2 min-h-64 w-full rounded-lg border px-3 py-2 text-sm"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                onKeyDown={(e) => {
                  firstFieldBackTab(e, () => goCourierStep("carriers", "courier-margin"));
                  lastFieldTab(e, () => focusById("courier-save"));
                }}
              />
              <button type="button" className="mt-2 text-xs font-semibold text-sky-700 hover:underline" onClick={() => setTerms(DEFAULT_COURIER_TERMS)}>
                Restore default terms
              </button>
            </label>
          ) : null}
        </Card>

        <div className="space-y-3">
          <Card className="space-y-3">
            <h2 className="font-bold text-[var(--color-atlas-navy)]">Summary</h2>
            {!cargoReady ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Enter package weight and dimensions first. Totals stay blank until chargeable kg &gt; 0.
              </p>
            ) : !activeCourier || !activePriced ? null : activePriced.tariff.status === "over-max" ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Chargeable {cargo.chargeableKg.toFixed(2)} kg is above {COURIER_TARIFF_MAX_KG} kg.
                Rate this shipment case-by-case with the carrier by email — the uploaded tariff stops
                at {COURIER_TARIFF_MAX_KG} kg.
              </p>
            ) : activePriced.tariff.status === "missing" ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                No Circulars tariff matched {activeCourier.directoryCarrier || "this carrier"} for{" "}
                {originCountry} → {destCountry} at {cargo.chargeableKg.toFixed(2)} kg. Select FedEx,
                fill cargo under {COURIER_TARIFF_MAX_KG} kg, and keep the Jan–Dec Excel on Circulars.
                Duplicate uploads are collapsed to the latest file.
              </p>
            ) : (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Chargeable</dt>
                  <dd className="font-bold">{cargo.chargeableKg.toFixed(2)} kg</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Tariff slab</dt>
                  <dd className="font-bold">
                    {activePriced.tariff.slabKg} kg · {activePriced.tariff.book.carrier} {activePriced.tariff.book.year}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Lane</dt>
                  <dd className="font-bold">
                    {activePriced.tariff.lane.origin} → {activePriced.tariff.lane.destinationLabel || activePriced.tariff.lane.destination}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Carrier</dt>
                  <dd className="font-bold">{activePriced.name || activePriced.tariff.book.carrier}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Uploaded tariff</dt>
                  <dd>{formatCurrency(activePriced.uploaded, activePriced.tariff.book.currency || currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Sell +{activePriced.markupPct}%</dt>
                  <dd>{formatCurrency(activePriced.markupAmount, activePriced.tariff.book.currency || currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Freight after {activePriced.markupPct}%</dt>
                  <dd className="font-bold">{formatCurrency(activePriced.base, activePriced.tariff.book.currency || currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Fuel + extras</dt>
                  <dd>{formatCurrency(activePriced.fuel + activePriced.extras, currency)}</dd>
                </div>
                {gstEnabled ? (
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-muted)]">GST (18%)</dt>
                    <dd>{formatCurrency(activePriced.tax, currency)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-2 text-base">
                  <dt className="font-bold">{multiLane ? "This lane total" : "Grand total"}</dt>
                  <dd className="font-extrabold text-emerald-700">
                    {formatCurrency(activePriced.total, activePriced.tariff.book.currency || currency)}
                  </dd>
                </div>
                {multiLane ? (
                  <>
                    <div className="space-y-1 border-t pt-2 text-xs">
                      {quotedLanes.map((lane) => (
                        <div key={lane.laneId} className="flex justify-between gap-2">
                          <span className="text-[var(--color-text-muted)]">{lane.laneLabel}</span>
                          <span className="text-right font-semibold">
                            {lane.airline || "—"} · {formatCurrency(lane.amount, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <dt className="font-bold">All lanes total</dt>
                      <dd className="font-extrabold text-emerald-700">
                        {formatCurrency(allLanesTotal, currency)}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
            )}
          </Card>
          {couriersOnLane.length > 1 ? (
            <Card>
              <VendorCompareList
                vendors={vendorRowsFromEntries(
                  couriersOnLane.map((c) => ({
                    id: c.id,
                    name: pricedById.get(c.id)?.name || c.directoryCarrier || "Untitled",
                    kind: "courier",
                    total: pricedById.get(c.id)?.total ?? 0,
                    selected: c.selected,
                  })),
                )}
                currency={currency}
                heading={multiLane && activeLane ? `Carrier options · ${quotedLanes.find((l) => l.laneId === activeLane.id)?.laneLabel}` : "Carrier options"}
                hint="Cheapest → highest. ★ marks the lowest total. Click a row to quote it."
                onSelect={selectCourier}
                testId="courier-desk-compare"
              />
            </Card>
          ) : null}
        </div>
      </div>

      {previewQuote ? (
        <QuotePreviewModal quote={previewQuote} onClose={() => setPreviewQuote(null)} />
      ) : null}
    </div>
  );
}

function SurchargeToggle({
  label,
  checked,
  amount,
  onToggle,
  onAmount,
}: {
  label: string;
  checked: boolean;
  amount: number;
  onToggle: (v: boolean) => void;
  onAmount: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] p-3">
      <label className="flex min-w-[140px] flex-1 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
        {label}
      </label>
      <label className="text-xs font-semibold text-[var(--color-text-muted)]">
        Amount
        <EmptyNumberInput
          className="ml-2 inline-block w-24 rounded border px-2 py-1 text-sm"
          value={amount}
          onChange={onAmount}
        />
      </label>
    </div>
  );
}

export default function CourierDeskPage() {
  return (
    <Suspense fallback={<Card className="p-6 text-sm text-[var(--color-text-muted)]">Loading courier desk…</Card>}>
      <CourierDeskInner />
    </Suspense>
  );
}
