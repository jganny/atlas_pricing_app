"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Package, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  calculateCourierFreight,
  SERVICE_LEVELS,
  type CourierPackageLine,
  type CourierServiceKey,
} from "@atlas/pricing-core";
import { Badge, Button, Card, Tabs } from "@/components/ui";
import { PincodeCombobox } from "@/components/PincodeCombobox";
import { LocationCombobox } from "@/components/LocationCombobox";
import { ValidityField } from "@/components/ValidityField";
import { QuotePreviewModal } from "@/components/QuotePreviewModal";
import { CarrierCombobox } from "@/components/CarrierCombobox";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { DEFAULT_COURIER_TERMS, saveCourierQuote } from "@/lib/firebase/save-quote";
import { persistQuoteToEnquiryDb, savedEnquiryHref, savedEnquiryMessage } from "@/lib/quotes/persist-enquiry";
import { allLanesRoute } from "@/lib/quotes/lanes";
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
  countrySelectOptions,
  inferCountryFromText,
} from "@/lib/locations/country-aliases";
import { searchPostalCodes, type PostalHit } from "@/lib/locations/postal-search";
import { searchLocations, type LocationHit } from "@/lib/locations/search";
import { firstFieldBackTab, focusById, lastFieldTab } from "@/lib/ui/desk-keyboard";

function isoFromAirport(hit: LocationHit): string | null {
  const c = (hit.country || "").trim();
  if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
  return inferCountryFromText(`${hit.city} ${hit.name} ${c}`);
}

const EMPTY_PACKAGE: CourierPackageLine = { qty: 1, gw: 0, l: 0, w: 0, h: 0 };

const defaultSurcharges = {
  fuelPct: 18,
  remote: false,
  remoteAmount: 450,
  residential: false,
  residentialAmount: 350,
  saturday: false,
  saturdayAmount: 500,
  dg: false,
  dgAmount: 1200,
  insurance: false,
  insurancePct: 1.5,
  declaredValue: 0,
  oversized: false,
  oversizedAmount: 800,
};

type Tab = "shipment" | "packages" | "surcharges" | "terms";

const COURIER_STEPS: Tab[] = ["shipment", "packages", "surcharges", "terms"];

const COURIER_FOCUS: Record<Tab, string> = {
  shipment: "courier-customer",
  packages: "courier-pkg-0-qty",
  surcharges: "courier-fuel",
  terms: "courier-terms",
};

const COURIER_DIR_TO_ID: Record<string, string> = {
  DHL: "dhl",
  FDX: "fedex",
  FX: "fedex",
  UPS: "ups",
  TNT: "fedex",
  ARAMEX: "aramex",
  BLUEDART: "bluedart",
  DTDC: "dtdc",
};

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
        <input
          type="number"
          disabled={!checked}
          className="ml-2 w-24 rounded border px-2 py-1 text-sm disabled:opacity-50"
          value={amount}
          onChange={(e) => onAmount(Number(e.target.value))}
        />
      </label>
    </div>
  );
}

function CourierDeskInner() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const loader = useQuoteDeskLoader();
  const [tab, setTab] = useState<Tab>("shipment");
  const [customer, setCustomer] = useState("");
  const [lanes, setLanes] = useState<QuoteLane[]>(() => [newLane()]);
  const [activeLaneId, setActiveLaneId] = useState("");
  const activeLane = lanes.find((l) => l.id === (activeLaneId || lanes[0]?.id)) ?? lanes[0];
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
  const [service, setService] = useState<CourierServiceKey>("economy");
  const [currency, setCurrency] = useState("INR");
  const [marginPct, setMarginPct] = useState(12);
  const [selectedCarrier, setSelectedCarrier] = useState("dhl");
  const [directoryCarrier, setDirectoryCarrier] = useState("");
  const [gstEnabled, setGstEnabled] = useState(true);
  const [validity, setValidity] = useState("15 days");
  const [packages, setPackages] = useState<CourierPackageLine[]>([{ ...EMPTY_PACKAGE }]);
  const [surcharges, setSurcharges] = useState(() => ({ ...defaultSurcharges }));
  const [terms, setTerms] = useState(DEFAULT_COURIER_TERMS);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveEnquiryPath, setSaveEnquiryPath] = useState<string | null>(null);
  const [previewQuote, setPreviewQuote] = useState<SavedQuote | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!activeLaneId && lanes[0]) setActiveLaneId(lanes[0].id);
  }, [activeLaneId, lanes]);

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
    if (originCountry !== destCountry && service === "same_day") {
      setService("economy");
    }
  }, [originCountry, destCountry, service]);

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
    if (!loader.sourceQuote) return;
    const loaded = loadCourierDeskFromQuote(loader.sourceQuote);
    setCustomer(loaded.customer);
    const lane = newLane({ origin: loaded.originCity, destination: loaded.destCity });
    setLanes([lane]);
    setActiveLaneId(lane.id);
    setOriginCountry(loaded.originCountry);
    setDestCountry(loaded.destCountry);
    setOriginPin(loaded.originPin);
    setDestPin(loaded.destPin);
    setScope(loaded.scope);
    setService(loaded.service as CourierServiceKey);
    setCurrency(loaded.currency);
    setMarginPct(loaded.marginPct);
    setSelectedCarrier(loaded.selectedCarrier);
    setDirectoryCarrier(String(loader.sourceQuote?.details?.directoryCarrier ?? loaded.selectedCarrier ?? ""));
    setGstEnabled(loaded.gstEnabled);
    setValidity(loaded.validity);
    setPackages(loaded.packages);
    setSurcharges({ ...defaultSurcharges, ...loaded.surcharges });
    if (loaded.terms) setTerms(loaded.terms);
  }, [loader.sourceQuote]);

  const result = useMemo(
    () =>
      calculateCourierFreight({
        packages,
        originCountry,
        destCountry,
        service,
        currency,
        marginPct,
        selectedCarrierId: selectedCarrier,
        gstEnabled,
        surcharges,
      }),
    [packages, originCountry, destCountry, service, currency, marginPct, selectedCarrier, gstEnabled, surcharges],
  );
  const cargoReady = result.chargeableKg > 0;

  function updatePkg(index: number, patch: Partial<CourierPackageLine>) {
    setPackages((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

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
    setService("economy");
    setCurrency("INR");
    setMarginPct(12);
    setSelectedCarrier("dhl");
    setDirectoryCarrier("");
    setGstEnabled(true);
    setValidity("15 days");
    setPackages([{ ...EMPTY_PACKAGE }]);
    setSurcharges({ ...defaultSurcharges });
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

  const quotedCarrierName = directoryCarrier.trim() || result.chosen?.name || "";
  const carrierSnaps = () =>
    result.quotes.map((q) =>
      courierSnapshot(q, result.chosen?.id ?? selectedCarrier, {
        validity,
        chargeableKg: result.chargeableKg,
        gstAmount: result.tax,
      }),
    );

  const handlePreview = () => {
    if (result.chargeableKg <= 0) {
      toast("Enter package weight / dimensions before preview.", "error");
      setTab("packages");
      return;
    }
    const amount = result.total ?? 0;
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
      route: allLanesRoute(lanes) || `${originCity || "—"} → ${destCity || "—"}`,
      details: {
        origin: originCity,
        destination: destCity,
        originCountry,
        destCountry,
        service,
        carrier: result.chosen?.id ?? "",
        carrierName: quotedCarrierName,
        directoryCarrier,
        carrierQuotes: carrierSnaps(),
        chargeableWeight: result.chargeableKg,
        zone: result.zone,
        baseFreight: result.baseFreight,
        gstAmount: result.tax,
        validity,
        originCity,
        destCity,
        lanes: lanes.map((l) => ({ id: l.id, origin: l.origin, destination: l.destination })),
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
      if (result.chargeableKg <= 0) {
        const msg = "Enter package weight / dimensions before saving (chargeable kg is 0).";
        setSaveMsg(msg);
        toast(msg, "error");
        setTab("packages");
        return;
      }
      const amount = result.total ?? 0;
      const quoteNumber = loader.editingQuoteNumber ?? nextQuoteNumber();
      const quoteId = loader.editingQuoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
      const name = directoryCarrier.trim() || result.chosen?.name || "";
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
        route: allLanesRoute(lanes) || `${originCity || "—"} → ${destCity || "—"}`,
        details: {
          origin: originCity,
          destination: destCity,
          originCountry,
          destCountry,
          service,
          carrier: result.chosen?.id ?? "",
          carrierName: name,
          directoryCarrier,
          carrierQuotes: carrierSnaps(),
          chargeableWeight: result.chargeableKg,
          zone: result.zone,
          baseFreight: result.baseFreight,
          gstAmount: result.tax,
          validity,
          originCity,
          destCity,
          lanes: lanes.map((l) => ({ id: l.id, origin: l.origin, destination: l.destination })),
          termsAndConditions: terms,
          mode: "Courier",
        },
      };
      setSaving(true);
      setSaveMsg(null);
      let cloud: "live" | "local" | "cloud-failed" = "local";
      try {
        if (useLiveData && user) {
          try {
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
              service,
              currency,
              marginPct,
              gstEnabled,
              packages: result.packages,
              calc: result,
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
        const row = persistQuoteToEnquiryDb(
          {
            ...localQuote,
            details: {
              ...localQuote.details,
              carrierName: name,
            },
          },
          queryClient,
        );
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
      service,
      currency,
      marginPct,
      gstEnabled,
      validity,
      result,
      terms,
      loader.editingQuoteId,
      loader.editingQuoteNumber,
      loader.editingStatus,
      queryClient,
      directoryCarrier,
      lanes,
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
            4-tab flow — shipment, packages, surcharges, terms. Indicative zone model (not live
            DHL/UPS feeds). Tab last field → next step · Alt+1–4 · ⌘S to save.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button type="button" variant="secondary" onClick={handlePreview}>
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
            Clear this courier form? Customer, packages, and surcharges will be wiped.
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

      {result.oversized ? (
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
          { value: "surcharges", label: "Rates & surcharges" },
          { value: "terms", label: "Terms" },
        ]}
      />
      <p className="-mt-2 text-[11px] text-[var(--color-text-muted)]">
        Keyboard: Tab on the last field of a step opens the next tab. Shift+Tab on the first field
        goes back. Alt+1 Shipment · Alt+2 Packages · Alt+3 Rates · Alt+4 Terms.
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
                  }}
                  onRemove={(id) => {
                    setLanes((prev) => {
                      const next = prev.filter((l) => l.id !== id);
                      return next.length ? next : prev;
                    });
                    if (activeLaneId === id && lanes[0]) setActiveLaneId(lanes[0].id);
                  }}
                />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Add a lane for extra origin → destination city pairs. Cities use the same IATA
                  3-letter airport list as Air desk — type a city or code, then pick from the dropdown.
                </p>
              </div>
              <label className="text-sm font-semibold md:col-span-2">
                Customer
                <input
                  id="courier-customer"
                  name="atlas-customer"
                  autoComplete="off"
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
              <div className="md:col-span-2">
                <CarrierCombobox
                  label="Carrier / Airline"
                  value={directoryCarrier}
                  onChange={(v) => {
                    setDirectoryCarrier(v);
                    const code = v.split("—")[0]?.trim().toUpperCase();
                    const mapped = COURIER_DIR_TO_ID[code];
                    if (mapped) setSelectedCarrier(mapped);
                  }}
                  kind="airline+courier"
                  placeholder="UL, SriLankan, DHL, FedEx…"
                />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Same global airline + courier directory as Air export/import. Pick DHL/FedEx/UPS to
                  select that zone card; pick UL or any IATA airline to quote it by name.
                </p>
              </div>
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
                Service
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={service}
                  onChange={(e) => setService(e.target.value as CourierServiceKey)}
                >
                  {Object.entries(SERVICE_LEVELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
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
              <label className="text-sm font-semibold">
                Margin %
                <input
                  id="courier-margin"
                  type="number"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={marginPct}
                  onChange={(e) => setMarginPct(Number(e.target.value))}
                />
              </label>
              <ValidityField
                value={validity}
                onChange={setValidity}
                textInputId="courier-validity"
                onTextKeyDown={(e) =>
                  lastFieldTab(e, () => goCourierStep("packages", "courier-pkg-0-qty"))
                }
              />
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
                            onChange={(e) => updatePkg(i, { qty: Number(e.target.value) })}
                            onKeyDown={(e) =>
                              i === 0
                                ? firstFieldBackTab(e, () => goCourierStep("shipment", "courier-validity"))
                                : undefined
                            }
                          />
                        </td>
                        <td className="p-1"><input type="number" className="w-16 rounded border px-1 py-1" value={p.gw ?? ""} onChange={(e) => updatePkg(i, { gw: Number(e.target.value) })} /></td>
                        <td className="p-1"><input type="number" className="w-14 rounded border px-1 py-1" value={p.l ?? ""} onChange={(e) => updatePkg(i, { l: Number(e.target.value) })} /></td>
                        <td className="p-1"><input type="number" className="w-14 rounded border px-1 py-1" value={p.w ?? ""} onChange={(e) => updatePkg(i, { w: Number(e.target.value) })} /></td>
                        <td className="p-1">
                          <input
                            type="number"
                            className="w-14 rounded border px-1 py-1"
                            value={p.h ?? ""}
                            onChange={(e) => updatePkg(i, { h: Number(e.target.value) })}
                            onKeyDown={(e) =>
                              i === packages.length - 1
                                ? lastFieldTab(e, () => goCourierStep("surcharges", "courier-fuel"))
                                : undefined
                            }
                          />
                        </td>
                        <td className="p-1 text-xs font-semibold">{result.packages[i]?.chargeable.toFixed(2) ?? "—"} kg</td>
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
            </div>
          ) : null}

          {tab === "surcharges" ? (
            <div className="space-y-3">
              <label className="text-sm font-semibold">
                Fuel surcharge %
                <input
                  id="courier-fuel"
                  type="number"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={surcharges.fuelPct}
                  onChange={(e) => setSurcharges((s) => ({ ...s, fuelPct: Number(e.target.value) }))}
                  onKeyDown={(e) =>
                    firstFieldBackTab(e, () => goCourierStep("packages", "courier-pkg-0-qty"))
                  }
                />
              </label>
              <SurchargeToggle label="Remote area" checked={surcharges.remote} amount={surcharges.remoteAmount} onToggle={(v) => setSurcharges((s) => ({ ...s, remote: v }))} onAmount={(v) => setSurcharges((s) => ({ ...s, remoteAmount: v }))} />
              <SurchargeToggle label="Residential delivery" checked={surcharges.residential} amount={surcharges.residentialAmount} onToggle={(v) => setSurcharges((s) => ({ ...s, residential: v }))} onAmount={(v) => setSurcharges((s) => ({ ...s, residentialAmount: v }))} />
              <SurchargeToggle label="Saturday delivery" checked={surcharges.saturday} amount={surcharges.saturdayAmount} onToggle={(v) => setSurcharges((s) => ({ ...s, saturday: v }))} onAmount={(v) => setSurcharges((s) => ({ ...s, saturdayAmount: v }))} />
              <SurchargeToggle label="Dangerous goods" checked={surcharges.dg} amount={surcharges.dgAmount} onToggle={(v) => setSurcharges((s) => ({ ...s, dg: v }))} onAmount={(v) => setSurcharges((s) => ({ ...s, dgAmount: v }))} />
              <SurchargeToggle label="Oversized handling" checked={surcharges.oversized} amount={surcharges.oversizedAmount} onToggle={(v) => setSurcharges((s) => ({ ...s, oversized: v }))} onAmount={(v) => setSurcharges((s) => ({ ...s, oversizedAmount: v }))} />
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={surcharges.insurance} onChange={(e) => setSurcharges((s) => ({ ...s, insurance: e.target.checked }))} />
                Cargo insurance
              </label>
              {surcharges.insurance ? (
                <>
                  <label className="text-sm font-semibold">
                    Insurance %
                    <input type="number" step="0.1" className="mt-1 w-full rounded-lg border px-3 py-2" value={surcharges.insurancePct} onChange={(e) => setSurcharges((s) => ({ ...s, insurancePct: Number(e.target.value) }))} />
                  </label>
                  <label className="text-sm font-semibold">
                    Declared value
                    <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={surcharges.declaredValue} onChange={(e) => setSurcharges((s) => ({ ...s, declaredValue: Number(e.target.value) }))} />
                  </label>
                </>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="courier-gst"
                  type="checkbox"
                  checked={gstEnabled}
                  onChange={(e) => setGstEnabled(e.target.checked)}
                  onKeyDown={(e) => lastFieldTab(e, () => goCourierStep("terms", "courier-terms"))}
                />
                Apply GST (18%)
              </label>
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
                  firstFieldBackTab(e, () => goCourierStep("surcharges", "courier-gst"));
                  lastFieldTab(e, () => focusById("courier-save"));
                }}
              />
              <button type="button" className="mt-2 text-xs font-semibold text-sky-700 hover:underline" onClick={() => setTerms(DEFAULT_COURIER_TERMS)}>
                Restore default terms
              </button>
            </label>
          ) : null}
        </Card>

        <Card className="space-y-3">
          <h2 className="font-bold text-[var(--color-atlas-navy)]">Summary</h2>
          {!cargoReady ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Enter package weight and dimensions first. Totals stay blank until chargeable kg &gt; 0
              (avoids showing a min-charge quote on empty cargo).
            </p>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Chargeable</dt><dd className="font-bold">{result.chargeableKg.toFixed(2)} kg</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Zone</dt><dd className="font-bold">{result.zone}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Carrier</dt><dd className="font-bold">{quotedCarrierName || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Base freight</dt><dd>{formatCurrency(result.baseFreight, currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Surcharges</dt><dd>{formatCurrency(result.surcharges.total, currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">GST (18%)</dt><dd>{formatCurrency(result.tax, currency)}</dd></div>
              <div className="flex justify-between border-t pt-2 text-base"><dt className="font-bold">Grand total</dt><dd className="font-extrabold text-emerald-700">{formatCurrency(result.total, currency)}</dd></div>
            </dl>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 font-bold">Carrier comparison</h2>
        <p className="mb-3 text-xs text-[var(--color-text-muted)]">
          These DHL / FedEx / UPS / Aramex / Blue Dart / DTDC figures are an internal zone ×
          carrier-factor model for comparing options — not live contracted API rates. Replace with
          Circulars or a carrier portal when you have an account.
        </p>
        {!cargoReady ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Add packages with weight (and dimensions) to compare carrier sell rates.
          </p>
        ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {result.quotes.map((q, idx) => {
            const cheapest =
              result.quotes.length > 0 &&
              q.sellLocal === Math.min(...result.quotes.map((x) => x.sellLocal));
            return (
            <button
              key={q.id}
              type="button"
              onClick={() => setSelectedCarrier(q.id)}
              className={`rounded-xl border p-3 text-left transition-colors ${selectedCarrier === q.id ? "border-[var(--color-atlas-navy)] bg-slate-50 ring-2 ring-[var(--color-atlas-navy)]/20" : "border-[var(--color-border)] hover:bg-slate-50"} ${cheapest ? "ring-1 ring-emerald-300" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone="neutral">#{idx + 1}</Badge>
                <span className="flex gap-1">
                  {cheapest ? <Badge tone="success">Cheapest ★</Badge> : null}
                  {selectedCarrier === q.id ? <Badge tone="success">Selected</Badge> : null}
                </span>
              </div>
              <div className="mt-1 font-bold" style={{ color: q.color }}>{q.name}</div>
              <div className="text-lg font-extrabold">{formatCurrency(q.sellLocal, currency)}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{q.transit} · {formatCurrency(q.ratePerKg, currency)}/kg</div>
            </button>
            );
          })}
        </div>
        )}
      </Card>

      {previewQuote ? (
        <QuotePreviewModal quote={previewQuote} onClose={() => setPreviewQuote(null)} />
      ) : null}
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
