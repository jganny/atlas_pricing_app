"use client";

import { useDeskDraft } from "@/hooks/use-desk-draft";
import { DraftResumeBanner } from "@/components/DraftResumeBanner";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Save, Sparkles, Truck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  NumberInput,
  Select,
  Tabs,
  Textarea,
} from "@/components/ui";
import { PincodeCombobox } from "@/components/PincodeCombobox";
import { CommodityCombobox } from "@/components/CommodityCombobox";
import { ValidityField } from "@/components/ValidityField";
import { LaneChips, newLane, type QuoteLane } from "@/components/LaneChips";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { saveTransportQuote } from "@/lib/firebase/save-transport-warehouse";
import { loadTransportDeskFromQuote } from "@/lib/quotes/desk-loader";
import { useQuoteDeskLoader } from "@/hooks/use-quote-desk-loader";
import { QuotePreviewModal } from "@/components/QuotePreviewModal";
import { VendorCompareList } from "@/components/VendorCompareList";
import { vendorRowsFromEntries } from "@/lib/quotes/vendor-preview";
import {
  createTruckerOption,
  truckerQuoteTotal,
  type TruckerOption,
} from "@/lib/pricing/carrier-options";
import { truckerSnapshot } from "@/lib/quotes/option-breakdown";
import {
  optionsOnLane,
  plainLaneLabel,
  quotedLaneRows,
  quotedOnLane,
  selectWithinLane,
  stampOntoFirstLane,
  usableLanes,
} from "@/lib/quotes/lanes";
import type { SavedQuote } from "@/lib/types";
import { nextQuoteNumber } from "@/lib/quotes/ref-id";
import { queryKeys } from "@/hooks/query-keys";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
import { useDeskStepKeys } from "@/hooks/use-desk-step-keys";
import { firstFieldBackTab, focusById, lastFieldTab } from "@/lib/ui/desk-keyboard";
import { useAntiAutofillName } from "@/lib/ui/anti-autofill";
import {
  DESK_CURRENCIES,
  INDIA_VEHICLE_TYPES,
  TRANSPORT_SERVICE_TYPES,
} from "@/lib/desk/constants";
import { computeGp, ensureIncidentalTerm } from "@/lib/pricing/quote-display";
import { formatCurrency } from "@/lib/utils";
import { useHistoricalAutofill } from "@/hooks/use-historical-autofill";
import { normalizeCarrierName } from "@/lib/quotes/historical-autofill";
import { extractVendorRateFromDocument } from "@/lib/ai/vendor-rate-extraction";
import { ExtractionError } from "@/lib/ai/circular-extraction";

const DEFAULT_TERMS = ensureIncidentalTerm(
  "1. Rates exclude detention beyond free hours unless stated.\n" +
    "2. Tolls and permits as incurred unless lump-sum.\n" +
    "3. Transit times are estimates only.",
);

type TabId = "lane" | "cargo" | "charges" | "terms";

const TRANSPORT_STEPS = ["lane", "cargo", "charges", "terms"] as const;
const TRANSPORT_FOCUS: Record<TabId, string> = {
  lane: "transport-customer",
  cargo: "transport-commodity",
  charges: "transport-freight-buy",
  terms: "transport-terms",
};

export default function TransportDeskPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const loader = useQuoteDeskLoader();
  const customerFieldName = useAntiAutofillName("atlas-party-transport");
  const [tab, setTab] = useState<TabId>("lane");
  const [customer, setCustomer] = useState("");
  const [lanes, setLanes] = useState<QuoteLane[]>(() => [newLane()]);
  const [activeLaneId, setActiveLaneId] = useState("");
  const activeLane = lanes.find((l) => l.id === (activeLaneId || lanes[0]?.id)) ?? lanes[0];
  const origin = activeLane?.origin ?? "";
  const destination = activeLane?.destination ?? "";
  function setOrigin(next: string) {
    const id = activeLane?.id;
    if (!id) return;
    setLanes((prev) => prev.map((l) => (l.id === id ? { ...l, origin: next } : l)));
  }
  function setDestination(next: string) {
    const id = activeLane?.id;
    if (!id) return;
    setLanes((prev) => prev.map((l) => (l.id === id ? { ...l, destination: next } : l)));
  }
  const [vehicleType, setVehicleType] = useState<string>(INDIA_VEHICLE_TYPES[7]);
  const [serviceType, setServiceType] = useState<string>(TRANSPORT_SERVICE_TYPES[0]);
  const [currency, setCurrency] = useState("INR");
  const [commodity, setCommodity] = useState("");
  const [ewayBillNo, setEwayBillNo] = useState("");
  const [ewayRequired, setEwayRequired] = useState(false);
  const [gstin, setGstin] = useState("");
  const [invoiceValue, setInvoiceValue] = useState(0);
  const [validity, setValidity] = useState("15 days");
  const [truckers, setTruckers] = useState<TruckerOption[]>(() => [createTruckerOption({ name: "" }, true)]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [busy, setBusy] = useState(false);
  const [previewQuote, setPreviewQuote] = useState<SavedQuote | null>(null);

  // Keeps the quote being worked on, so a power cut or crash never loses it (see useDeskDraft).
  const draft = useDeskDraft({
    desk: "transport",
    username: user?.username,
    enabled: loader.ready && !loader.sourceQuote && !loader.smartPrefill && !loader.editingQuoteId,
    state: {
      customer,
      lanes,
      activeLaneId,
      vehicleType,
      serviceType,
      currency,
      commodity,
      ewayBillNo,
      ewayRequired,
      gstin,
      invoiceValue,
      validity,
      truckers,
      notes,
      terms,
      tab,
    },
    apply: (s) => {
      setCustomer(s.customer);
      setLanes(s.lanes);
      setActiveLaneId(s.activeLaneId);
      setVehicleType(s.vehicleType);
      setServiceType(s.serviceType);
      setCurrency(s.currency);
      setCommodity(s.commodity);
      setEwayBillNo(s.ewayBillNo);
      setEwayRequired(s.ewayRequired);
      setGstin(s.gstin);
      setInvoiceValue(s.invoiceValue);
      setValidity(s.validity);
      setTruckers(s.truckers);
      setNotes(s.notes);
      setTerms(s.terms);
      setTab(s.tab);
    },
    summarize: (s) => `${s.customer.trim() || "no customer yet"} · ${s.lanes[0]?.origin || "…"} → ${s.lanes[0]?.destination || "…"}`,
    hasContent: (s) => Boolean(s.customer.trim()) || s.lanes.some((l) => l.origin.trim() || l.destination.trim()),
  });

  useEffect(() => {
    const c = searchParams?.get("customer");
    if (c) setCustomer(c);
    const originQ = searchParams?.get("origin");
    const destQ = searchParams?.get("dest");
    if (originQ || destQ) {
      setLanes((prev) => {
        const id = prev[0]?.id;
        return prev.map((l) =>
          l.id === id ? { ...l, origin: originQ || l.origin, destination: destQ || l.destination } : l,
        );
      });
    }
  }, [searchParams]);

  const fallbackLaneId = lanes[0]?.id || "";
  const truckersOnLane = optionsOnLane(truckers, activeLaneId, fallbackLaneId);
  const selectedTrucker = quotedOnLane(truckers, activeLaneId, fallbackLaneId);
  const freightBuy = selectedTrucker?.freightBuy ?? 0;
  const freightSell = selectedTrucker?.freightSell ?? 0;
  const detention = selectedTrucker?.detention ?? 0;
  const tolls = selectedTrucker?.tolls ?? 0;

  const historicalAutofill = useHistoricalAutofill({
    deskType: "transport",
    origin,
    destination,
    currency,
    customer,
    carrierNames: truckers.map((t) => t.name),
  });

  // Silently fill freight/detention/tolls that have been consistent across
  // this lane/trucker's history — only fields still at their untouched
  // default (0) are ever written.
  useEffect(() => {
    if (!Object.keys(historicalAutofill.transport).length) return;
    setTruckers((prev) =>
      prev.map((t) => {
        if (!t.name.trim()) return t;
        const result = historicalAutofill.transport[normalizeCarrierName(t.name)];
        if (!result) return t;

        let changed = false;
        const next = { ...t };
        if (t.freightSell === 0 && result.freightSell !== null) {
          next.freightSell = result.freightSell;
          changed = true;
        }
        if (t.freightBuy === 0 && result.freightBuy !== null) {
          next.freightBuy = result.freightBuy;
          changed = true;
        }
        if (t.detention === 0 && result.detention !== null) {
          next.detention = result.detention;
          changed = true;
        }
        if (t.tolls === 0 && result.tolls !== null) {
          next.tolls = result.tolls;
          changed = true;
        }
        return changed ? next : t;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historicalAutofill.transport]);

  function updateSelectedTrucker(patch: Partial<TruckerOption>) {
    const id = selectedTrucker?.id;
    if (!id) return;
    setTruckers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  const [extractingRate, setExtractingRate] = useState(false);

  async function handleExtractVendorRate(file: File) {
    setExtractingRate(true);
    try {
      const result = await extractVendorRateFromDocument(file, "transport");
      if (result.deskType !== "transport") return;
      const patch: Partial<TruckerOption> = {};
      if (!selectedTrucker?.name.trim() && result.vendorName) patch.name = result.vendorName;
      if (freightBuy === 0 && result.freightBuy !== null) patch.freightBuy = result.freightBuy;
      if (detention === 0 && result.detention !== null) patch.detention = result.detention;
      if (tolls === 0 && result.tolls !== null) patch.tolls = result.tolls;
      if (Object.keys(patch).length) updateSelectedTrucker(patch);

      const laneNote =
        result.origin && result.destination && `${result.origin} → ${result.destination}` !== `${origin} → ${destination}`
          ? ` (sheet shows ${result.origin} → ${result.destination} — check it matches this lane)`
          : "";
      const noteText = result.confidence === "needs_check" && result.note ? ` ${result.note}` : "";
      toast(
        Object.keys(patch).length
          ? `Filled from ${result.vendorName || "the rate sheet"}.${laneNote}${noteText}`
          : `Nothing new to fill — those fields already have values.${laneNote}${noteText}`,
        result.confidence === "needs_check" ? "info" : "success",
      );
    } catch (e) {
      toast(e instanceof ExtractionError ? e.message : "Couldn't read that file. Try again.", "error");
    } finally {
      setExtractingRate(false);
    }
  }

  function selectTrucker(id: string) {
    setTruckers((prev) => selectWithinLane(prev, id, fallbackLaneId));
  }

  function addTrucker() {
    const laneId = activeLane?.id || fallbackLaneId;
    setTruckers((prev) => [
      ...prev,
      createTruckerOption({ name: "", laneId }, !optionsOnLane(prev, laneId, fallbackLaneId).length),
    ]);
  }

  const quotedLanes = useMemo(
    () => quotedLaneRows(lanes, truckers, (t) => truckerQuoteTotal(t)),
    [lanes, truckers],
  );
  const allLanesTotal = useMemo(
    () => quotedLanes.reduce((sum, l) => sum + l.amount, 0),
    [quotedLanes],
  );

  function goTransportStep(next: TabId, focusId = TRANSPORT_FOCUS[next]) {
    setTab(next);
    focusById(focusId);
  }

  useDeskStepKeys({
    steps: TRANSPORT_STEPS,
    setStep: (s) => goTransportStep(s),
    focusIds: TRANSPORT_FOCUS,
  });

  useEffect(() => {
    if (!activeLaneId && lanes[0]) setActiveLaneId(lanes[0].id);
  }, [activeLaneId, lanes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const o = q.get("origin") || "";
    const d = q.get("dest") || "";
    if (!o && !d) return;
    const id = lanes[0]?.id;
    if (!id) return;
    setLanes((prev) =>
      prev.map((l) => (l.id === id ? { ...l, origin: o || l.origin, destination: d || l.destination } : l)),
    );
    // Only apply once from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loader.sourceQuote) return;
    const loaded = loadTransportDeskFromQuote(loader.sourceQuote);
    setCustomer(loaded.customer);
    setVehicleType(loaded.vehicleType);
    setServiceType(loaded.serviceType);
    setCurrency(loaded.currency);
    setCommodity(loaded.commodity);
    setEwayBillNo(loaded.ewayBillNo);
    setEwayRequired(loaded.ewayRequired);
    setGstin(loaded.gstin);
    setInvoiceValue(loaded.invoiceValue);
    setValidity(loaded.validity);
    setTruckers(loaded.truckers);
    setNotes(loaded.notes);
    setTerms(loaded.terms);
    if (loaded.lanes.length) {
      setLanes(loaded.lanes.map((l) => newLane(l)));
      setActiveLaneId(loaded.lanes[0]?.id || "");
    }
  }, [loader.sourceQuote]);

  const total = useMemo(
    () => freightSell + detention + tolls,
    [freightSell, detention, tolls],
  );
  const { gp, gpReady } = useMemo(() => computeGp(total, freightBuy), [total, freightBuy]);
  const multiLane = usableLanes(lanes).length > 1;
  const activeLaneLabel = activeLane ? plainLaneLabel(activeLane, lanes.indexOf(activeLane)) : "";
  const routeText = multiLane
    ? lanes.map((l) => `${l.origin} → ${l.destination}`.trim()).filter((s) => s !== "→").join(" · ")
    : `${origin} → ${destination}`;

  function handlePreview() {
    if (!origin.trim() || !destination.trim()) {
      toast("Enter origin and destination before preview.", "error");
      setTab("lane");
      return;
    }
    const amount = multiLane ? allLanesTotal : total;
    const q: SavedQuote = {
      id: loader.editingQuoteId || "preview",
      customer: customer.trim() || "Draft",
      creator: user?.username || "",
      status: loader.editingStatus || "quoted",
      type: "transport",
      quoteNumber: loader.editingQuoteNumber ?? nextQuoteNumber(),
      date: new Date().toISOString().split("T")[0],
      timestamp: Date.now(),
      amount,
      currency,
      route: routeText,
      details: {
        origin,
        destination,
        vehicleType,
        serviceType,
        freightBuy,
        freightSell,
        detention,
        tolls,
        truckerName: selectedTrucker?.name || vehicleType,
        validity,
        truckers: truckers.map((t) => truckerSnapshot(t, validity, lanes, fallbackLaneId, plainLaneLabel)),
        lanes: lanes.map((l) => ({ id: l.id, origin: l.origin, destination: l.destination })),
        quotedLanes,
        allLanesTotal,
        termsAndConditions: terms,
        mode: "Transport",
        type: "transport",
      },
    };
    setPreviewQuote(q);
  }

  async function save() {
    if (!customer.trim() || !origin.trim() || !destination.trim()) {
      toast("Customer, origin and destination are required", "error");
      setTab("lane");
      return;
    }
    if (multiLane && usableLanes(lanes).length !== lanes.length) {
      toast("Every lane needs both an origin and a destination before saving.", "error");
      setTab("lane");
      return;
    }
    setBusy(true);
    try {
      if (useLiveData) {
        try {
          await Promise.race([
            saveTransportQuote({
              quoteId: loader.editingQuoteId ?? undefined,
              customer,
              creator: user?.username || "desk",
              origin,
              destination,
              vehicleType,
              serviceType,
              currency,
              freightBuy,
              freightSell,
              detention,
              tolls,
              commodity,
              ewayBillNo,
              ewayRequired,
              gstin,
              invoiceValue,
              validity,
              truckerName: selectedTrucker?.name || "",
              lanes,
              quotedLanes,
              allLanesAmount: multiLane ? allLanesTotal : undefined,
              truckers: truckers.map((t) => ({
                id: t.id,
                name: t.name,
                laneId: t.laneId,
                selected: t.selected,
                freightBuy: t.freightBuy,
                freightSell: t.freightSell,
                detention: t.detention,
                tolls: t.tolls,
              })),
              notes,
              terms,
            }),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000)),
          ]);
        } catch (e) {
          toast(
            e instanceof Error ? `Saved draft locally (${e.message})` : "Local draft only",
            "info",
          );
        }
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.enquiries });
      toast("Transport quote saved", "success");
        draft.clear();
    } finally {
      setBusy(false);
    }
  }

  useDeskSaveShortcut(() => void save());

  return (
    <div className="space-y-4">
      <DraftResumeBanner deskLabel="transport" pending={draft.pending} onResume={draft.resume} onDiscard={draft.discard} />
      {loader.banner ? (
        <Card className="border-sky-200 bg-sky-50 py-2">
          <p className="text-sm font-semibold text-sky-900">{loader.banner}</p>
        </Card>
      ) : null}
      {loader.loadError ? (
        <Card className="border-amber-200 bg-amber-50 py-2">
          <p className="text-sm font-semibold text-amber-900">{loader.loadError}</p>
        </Card>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-[var(--color-atlas-sky)]" />
          <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">
            Transport desk
          </h1>
          <Badge tone="info">Phase 10</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="h-9" data-testid="desk-preview" onClick={handlePreview}>
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </Button>
          <Button id="transport-save" type="button" className="gap-1.5" disabled={busy} onClick={() => void save()}>
            <Save className="h-4 w-4" />
            Save quote
          </Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => goTransportStep(v as TabId)}
        idPrefix="transport-step"
        items={[
          { value: "lane", label: "Lane" },
          { value: "cargo", label: "Cargo & compliance" },
          { value: "charges", label: "Charges" },
          { value: "terms", label: "Terms" },
        ]}
      />
      <p className="-mt-2 text-[11px] text-[var(--color-text-muted)]">
        Tab on last field → next step · Alt+1–4 · ⌘S save
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-2">
          {tab === "lane" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <LaneChips
                  lanes={lanes}
                  activeId={activeLane?.id || lanes[0]?.id || ""}
                  onSelect={setActiveLaneId}
                  onAdd={() => {
                    const lane = newLane();
                    setLanes((prev) => [...prev, lane]);
                    setActiveLaneId(lane.id);
                    setTruckers((prev) => [
                      ...stampOntoFirstLane(prev, lanes[0]?.id || ""),
                      createTruckerOption({ laneId: lane.id }, true),
                    ]);
                  }}
                  onRemove={(id) => {
                    setLanes((prev) => {
                      const next = prev.filter((l) => l.id !== id);
                      return next.length ? next : prev;
                    });
                    setTruckers((prev) => prev.filter((t) => t.laneId !== id));
                    if (activeLaneId === id && lanes[0]) setActiveLaneId(lanes[0].id);
                  }}
                />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Add a lane for extra origin → destination legs. Each lane compares its own
                  truckers, independently of the others.
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label>Customer *</Label>
                <Input
                  id="transport-customer"
                  name={customerFieldName}
                  autoComplete="off"
                  data-1p-ignore="true"
                  value={customer}
                  list="atlas-customer-suggestions"
                  onChange={(e) => setCustomer(e.target.value)}
                />
              </div>
              <PincodeCombobox
                label="Origin ZIP / place *"
                value={origin}
                onChange={setOrigin}
                placeholder="560001 Bangalore…"
              />
              <PincodeCombobox
                label="Destination ZIP / place *"
                value={destination}
                onChange={setDestination}
                placeholder="400001 Mumbai…"
              />
              <div>
                <Label>Vehicle</Label>
                <Select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                  {INDIA_VEHICLE_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Service type</Label>
                <Select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                  {TRANSPORT_SERVICE_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {DESK_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <ValidityField
                value={validity}
                onChange={setValidity}
                textInputId="transport-validity"
                onTextKeyDown={(e) => lastFieldTab(e, () => goTransportStep("cargo"))}
              />
            </div>
          ) : null}

          {tab === "cargo" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CommodityCombobox
                  value={commodity}
                  onChange={setCommodity}
                  inputId="transport-commodity"
                  onInputKeyDown={(e) =>
                    firstFieldBackTab(e, () => goTransportStep("lane", "transport-validity"))
                  }
                />
              </div>
              <div>
                <Label>E-way bill no</Label>
                <Input value={ewayBillNo} onChange={(e) => setEwayBillNo(e.target.value)} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={ewayRequired}
                    onChange={(e) => setEwayRequired(e.target.checked)}
                  />
                  E-way bill required
                </label>
              </div>
              <div>
                <Label>GSTIN</Label>
                <Input
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div>
                <Label>Invoice value</Label>
                <NumberInput value={invoiceValue} onValueChange={setInvoiceValue} />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  id="transport-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={(e) => lastFieldTab(e, () => goTransportStep("charges"))}
                />
              </div>
            </div>
          ) : null}

          {tab === "charges" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-[var(--color-atlas-navy)]">
                  Truckers ({truckersOnLane.length})
                  {multiLane && activeLane ? (
                    <span className="ml-2 text-xs font-semibold text-[var(--color-text-muted)]">
                      · {activeLaneLabel}
                    </span>
                  ) : null}
                </h2>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-atlas-navy)] hover:bg-[var(--color-atlas-gold-soft)]">
                    <Sparkles className="h-4 w-4" />
                    {extractingRate ? "Reading…" : "Extract rates with AI"}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={extractingRate}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void handleExtractVendorRate(f);
                      }}
                    />
                  </label>
                  <Button type="button" variant="secondary" onClick={addTrucker}>
                    <Plus className="mr-1 h-4 w-4" />
                    Trucker
                  </Button>
                </div>
              </div>
              {truckersOnLane.map((t, idx) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`selected-trucker-${activeLane?.id || "lane"}`}
                    checked={t.selected}
                    onChange={() => selectTrucker(t.id)}
                  />
                  <span className="font-semibold">
                    {t.name || `Trucker #${idx + 1}`}
                    {t.selected ? " · quoted" : ""}
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    {formatCurrency(truckerQuoteTotal(t), currency)}
                  </span>
                </label>
              ))}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Trucker / vendor</Label>
                  <Input
                    value={selectedTrucker?.name ?? ""}
                    onChange={(e) => updateSelectedTrucker({ name: e.target.value })}
                    placeholder="ABC Transport, local cartage…"
                  />
                </div>
                <div>
                  <Label>Freight buy</Label>
                  <NumberInput
                    id="transport-freight-buy"
                    value={freightBuy}
                    onValueChange={(n) => updateSelectedTrucker({ freightBuy: n })}
                    onKeyDown={(e) =>
                      firstFieldBackTab(e, () => goTransportStep("cargo", "transport-notes"))
                    }
                  />
                </div>
                <div>
                  <Label>Freight sell</Label>
                  <NumberInput
                    value={freightSell}
                    onValueChange={(n) => updateSelectedTrucker({ freightSell: n })}
                  />
                </div>
                <div>
                  <Label>Detention</Label>
                  <NumberInput
                    value={detention}
                    onValueChange={(n) => updateSelectedTrucker({ detention: n })}
                  />
                </div>
                <div>
                  <Label>Tolls / permits</Label>
                  <NumberInput
                    id="transport-tolls"
                    value={tolls}
                    onValueChange={(n) => updateSelectedTrucker({ tolls: n })}
                    onKeyDown={(e) => lastFieldTab(e, () => goTransportStep("terms"))}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {tab === "terms" ? (
            <div>
              <Label>Terms</Label>
              <Textarea
                id="transport-terms"
                rows={8}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                onKeyDown={(e) => {
                  firstFieldBackTab(e, () => goTransportStep("charges", "transport-tolls"));
                  lastFieldTab(e, () => focusById("transport-save"));
                }}
              />
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
              {multiLane ? "This lane total" : "Quoted total"}
            </div>
            <div className="mt-1 text-2xl font-extrabold text-[var(--color-atlas-navy)]">
              {formatCurrency(total, currency)}
            </div>
            {multiLane ? (
              <>
                <div className="mt-3 space-y-1 border-t pt-2 text-xs">
                  {quotedLanes.map((lane) => (
                    <div key={lane.laneId} className="flex justify-between gap-2">
                      <span className="text-[var(--color-text-muted)]">{lane.laneLabel}</span>
                      <span className="text-right font-semibold">
                        {lane.airline || "—"} · {formatCurrency(lane.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between border-t pt-2">
                  <span className="text-sm font-bold">All lanes total</span>
                  <span className="text-sm font-extrabold text-emerald-700">
                    {formatCurrency(allLanesTotal, currency)}
                  </span>
                </div>
              </>
            ) : null}
            <div className="mt-3 text-sm">
              GP{" "}
              <span className="font-bold text-emerald-700">
                {gpReady ? formatCurrency(gp, currency) : "—"}
              </span>
            </div>
            <p className="mt-4 text-xs text-[var(--color-text-muted)]">⌘S to save</p>
          </Card>
          {truckersOnLane.length > 1 ? (
            <Card>
              <VendorCompareList
                vendors={vendorRowsFromEntries(
                  truckersOnLane.map((t) => ({
                    id: t.id,
                    name: t.name || "Untitled",
                    kind: "trucker",
                    total: truckerQuoteTotal(t),
                    selected: t.selected,
                  })),
                )}
                currency={currency}
                heading={multiLane ? `Trucker options · ${activeLaneLabel}` : "Trucker options"}
                hint="Cheapest → highest. ★ marks the lowest total. Click a row to quote it."
                onSelect={selectTrucker}
                testId="transport-desk-compare"
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
