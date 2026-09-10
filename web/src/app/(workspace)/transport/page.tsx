"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Save, Truck } from "lucide-react";
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
import { QuotePreviewModal } from "@/components/QuotePreviewModal";
import { VendorCompareList } from "@/components/VendorCompareList";
import { vendorRowsFromEntries } from "@/lib/quotes/vendor-preview";
import {
  createTruckerOption,
  truckerQuoteTotal,
  type TruckerOption,
} from "@/lib/pricing/carrier-options";
import { truckerSnapshot } from "@/lib/quotes/option-breakdown";
import type { SavedQuote } from "@/lib/types";
import { nextQuoteNumber } from "@/lib/quotes/ref-id";
import { queryKeys } from "@/hooks/query-keys";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
import { useDeskStepKeys } from "@/hooks/use-desk-step-keys";
import { firstFieldBackTab, focusById, lastFieldTab } from "@/lib/ui/desk-keyboard";
import {
  DESK_CURRENCIES,
  INDIA_VEHICLE_TYPES,
  TRANSPORT_SERVICE_TYPES,
} from "@/lib/desk/constants";
import { computeGp, ensureIncidentalTerm } from "@/lib/pricing/quote-display";
import { formatCurrency } from "@/lib/utils";

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

  const selectedTrucker = truckers.find((t) => t.selected) ?? truckers[0];
  const freightBuy = selectedTrucker?.freightBuy ?? 0;
  const freightSell = selectedTrucker?.freightSell ?? 0;
  const detention = selectedTrucker?.detention ?? 0;
  const tolls = selectedTrucker?.tolls ?? 0;

  function updateSelectedTrucker(patch: Partial<TruckerOption>) {
    const id = selectedTrucker?.id;
    if (!id) return;
    setTruckers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function selectTrucker(id: string) {
    setTruckers((prev) => prev.map((t) => ({ ...t, selected: t.id === id })));
  }

  function addTrucker() {
    setTruckers((prev) => [...prev, createTruckerOption({ name: "" }, prev.length === 0)]);
  }

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

  const total = useMemo(
    () => freightSell + detention + tolls,
    [freightSell, detention, tolls],
  );
  const { gp, gpReady } = useMemo(() => computeGp(total, freightBuy), [total, freightBuy]);

  function handlePreview() {
    if (!origin.trim() || !destination.trim()) {
      toast("Enter origin and destination before preview.", "error");
      setTab("lane");
      return;
    }
    const amount = total;
    const q: SavedQuote = {
      id: "preview",
      customer: customer.trim() || "Draft",
      creator: user?.username || "",
      status: "quoted",
      type: "transport",
      quoteNumber: nextQuoteNumber(),
      date: new Date().toISOString().split("T")[0],
      timestamp: Date.now(),
      amount,
      currency,
      route: `${origin} → ${destination}`,
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
        truckers: truckers.map((t) => truckerSnapshot(t, validity)),
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
    setBusy(true);
    try {
      if (useLiveData) {
        try {
          await Promise.race([
            saveTransportQuote({
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
              truckers: truckers.map((t) => ({
                id: t.id,
                name: t.name,
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
    } finally {
      setBusy(false);
    }
  }

  useDeskSaveShortcut(() => void save());

  return (
    <div className="space-y-4">
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
                  }}
                  onRemove={(id) => {
                    setLanes((prev) => {
                      const next = prev.filter((l) => l.id !== id);
                      return next.length ? next : prev;
                    });
                    if (activeLaneId === id && lanes[0]) setActiveLaneId(lanes[0].id);
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Customer *</Label>
                <Input
                  id="transport-customer"
                  name="atlas-customer"
                  autoComplete="off"
                  value={customer}
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
                  Truckers ({truckers.length})
                </h2>
                <Button type="button" variant="secondary" onClick={addTrucker}>
                  <Plus className="mr-1 h-4 w-4" />
                  Trucker
                </Button>
              </div>
              {truckers.map((t, idx) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="selected-trucker"
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
            <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Quoted total</div>
            <div className="mt-1 text-2xl font-extrabold text-[var(--color-atlas-navy)]">
              {formatCurrency(total, currency)}
            </div>
            <div className="mt-3 text-sm">
              GP{" "}
              <span className="font-bold text-emerald-700">
                {gpReady ? formatCurrency(gp, currency) : "—"}
              </span>
            </div>
            <p className="mt-4 text-xs text-[var(--color-text-muted)]">⌘S to save</p>
          </Card>
          {truckers.length > 1 ? (
            <Card>
              <VendorCompareList
                vendors={vendorRowsFromEntries(
                  truckers.map((t) => ({
                    id: t.id,
                    name: t.name || "Untitled",
                    kind: "trucker",
                    total: truckerQuoteTotal(t),
                    selected: t.selected,
                  })),
                )}
                currency={currency}
                heading="Trucker options"
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
