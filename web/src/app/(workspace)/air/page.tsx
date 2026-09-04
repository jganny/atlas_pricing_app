"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  PlaneTakeoff,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Zap,
} from "lucide-react";
import type { WeightBreakName, WeightBreaks } from "@atlas/pricing-core";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Label, Select, Tabs, Textarea } from "@/components/ui";
import { DeskSmartQuoteStrip } from "@/components/DeskSmartQuoteStrip";
import { DeskResetDialog } from "@/components/DeskResetDialog";
import { SurchargeTable } from "@/components/desks/SurchargeTable";
import { QuotePreviewModal } from "@/components/QuotePreviewModal";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { fetchQuoteById } from "@/lib/firebase/quote-lifecycle";
import { saveAirQuote } from "@/lib/firebase/save-quote";
import { lookupAirTariff } from "@/lib/firebase/tariffs";
import {
  AIR_WEIGHT_BREAKS,
  EMPTY_AIR_BREAKS,
  computeAirlineTotals,
  validateAirCargo,
  validateSelectedAirline,
  type AirCargoRow,
} from "@/lib/pricing/air-desk";
import { createAirlineOption, type AirlineOption } from "@/lib/pricing/carrier-options";
import { airShipmentSchema } from "@/lib/pricing/desk-schemas";
import { getDefaultFreightTerms } from "@/lib/pricing/terms";
import { loadAirDeskFromQuote } from "@/lib/quotes/desk-loader";
import { clearSmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";
import { useAirTariffs } from "@/hooks/use-atlas-data";
import { queryKeys } from "@/hooks/query-keys";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
import { useQuoteDeskLoader } from "@/hooks/use-quote-desk-loader";
import type { SavedQuote, SmartQuoteDraft } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const BREAK_LABELS: Record<WeightBreakName, string> = {
  min: "Minimum",
  minus45: "−45 kg",
  plus45: "+45 kg",
  plus100: "+100 kg",
  plus300: "+300 kg",
  plus500: "+500 kg",
  plus1000: "+1000 kg",
};

const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];
type Step = "shipment" | "carrier" | "terms";

export default function AirDeskPage() {
  return (
    <Suspense fallback={<Card className="p-6 text-sm text-[var(--color-text-muted)]">Loading air desk…</Card>}>
      <AirDeskInner />
    </Suspense>
  );
}

function AirDeskInner() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: tariffs = [] } = useAirTariffs();
  const loader = useQuoteDeskLoader("air");

  const [step, setStep] = useState<Step>("shipment");
  const [customer, setCustomer] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [incoterm, setIncoterm] = useState("FOB");
  const [commodity, setCommodity] = useState("GENERAL");
  const [module, setModule] = useState<"export" | "import">("export");
  const [customFx, setCustomFx] = useState(0);
  const [cargo, setCargo] = useState<AirCargoRow[]>([{ l: 0, w: 0, h: 0, qty: 1, gw: 0 }]);
  const [airlines, setAirlines] = useState<AirlineOption[]>([createAirlineOption({}, true)]);
  const [terms, setTerms] = useState(getDefaultFreightTerms("air"));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [previewQuote, setPreviewQuote] = useState<SavedQuote | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [stripKey, setStripKey] = useState(0);

  const selected = airlines.find((a) => a.selected) ?? airlines[0];

  const totalsById = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeAirlineTotals>> = {};
    for (const a of airlines) map[a.id] = computeAirlineTotals(cargo, a);
    return map;
  }, [airlines, cargo]);

  const selectedTotals = selected ? totalsById[selected.id] : null;

  useEffect(() => {
    if (!loader.sourceQuote) return;
    const loaded = loadAirDeskFromQuote(loader.sourceQuote);
    setCustomer(loaded.customer);
    setOrigin(loaded.origin);
    setDestination(loaded.destination);
    setCurrency(loaded.currency);
    setIncoterm(loaded.incoterm);
    setCommodity(loaded.commodity);
    setModule(loaded.module);
    setCustomFx(loaded.customExchangeRate);
    setCargo(loaded.cargo);
    setAirlines(loaded.airlines);
    if (loaded.terms) setTerms(loaded.terms);
  }, [loader.sourceQuote]);

  useEffect(() => {
    if (!loader.smartPrefill) return;
    applySmartDraft({
      parsed: loader.smartPrefill.parsed,
      tariffFound: loader.smartPrefill.tariffFound,
      carrierLabel: loader.smartPrefill.carrierLabel,
      currency: loader.smartPrefill.currency,
      airBreaks: loader.smartPrefill.airBreaks,
      message: "Prefill from Smart Quote / Inbox",
    });
    clearSmartQuotePrefill();
  }, [loader.smartPrefill]);

  function applySmartDraft(draft: SmartQuoteDraft) {
    const p = draft.parsed;
    setCustomer(p.customer || "");
    setOrigin(p.origin || "");
    setDestination(p.destination || "");
    if (draft.currency) setCurrency(draft.currency);
    if (p.commodity) setCommodity(p.commodity);
    if (p.packages.length) {
      setCargo(
        p.packages.map((pkg) => ({
          l: pkg.l ?? 0,
          w: pkg.w ?? 0,
          h: pkg.h ?? 0,
          qty: pkg.qty || 1,
          gw: pkg.gw ?? 0,
        })),
      );
    } else {
      setCargo([{ l: 0, w: 0, h: 0, qty: 1, gw: 0 }]);
    }
    setAirlines([
      createAirlineOption(
        {
          name: p.airlineLabel || draft.carrierLabel || "",
          routing: p.origin && p.destination ? `${p.origin}-${p.destination}` : "",
          tt: "TBA",
          validity: "15 days",
          // Only Circulars (or explicit breaks) fill rates — never invent defaults
          breaks: draft.airBreaks
            ? { ...EMPTY_AIR_BREAKS, ...draft.airBreaks }
            : { ...EMPTY_AIR_BREAKS },
        },
        true,
      ),
    ]);
    // Stay on shipment so user verifies POL/POD/cargo; rates stay blank until Circulars
    setStep("shipment");
  }

  function applyReset() {
    setCustomer("");
    setOrigin("");
    setDestination("");
    setCurrency("USD");
    setIncoterm("FOB");
    setCommodity("GENERAL");
    setModule("export");
    setCustomFx(0);
    setCargo([{ l: 0, w: 0, h: 0, qty: 1, gw: 0 }]);
    setAirlines([createAirlineOption({}, true)]);
    setTerms(getDefaultFreightTerms("air"));
    setSaveMsg(null);
    setPreviewQuote(null);
    setStep("shipment");
    setConfirmReset(false);
    setStripKey((k) => k + 1);
    loader.clearLoadedQuote();
    if (typeof window !== "undefined" && /[?&](edit|duplicate|smart)=/.test(window.location.search)) {
      router.replace("/air/");
    }
    toast("Air desk cleared", "success");
  }

  function updateCargo(index: number, patch: Partial<AirCargoRow>) {
    setCargo((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function updateAirline(id: string, patch: Partial<AirlineOption>) {
    setAirlines((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function selectAirline(id: string) {
    setAirlines((prev) => prev.map((a) => ({ ...a, selected: a.id === id })));
  }

  function updateBreak(id: string, name: WeightBreakName, field: "sell" | "buy", value: number) {
    setAirlines((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const breaks: WeightBreaks = {
          ...a.breaks,
          [name]: {
            sell: a.breaks[name]?.sell ?? 0,
            buy: a.breaks[name]?.buy ?? 0,
            [field]: value,
          },
        };
        return { ...a, breaks };
      }),
    );
  }

  function applyTariffToSelected() {
    if (!selected) return;
    const originCode = origin.split(" - ")[0]?.trim().toUpperCase() || origin.trim().toUpperCase();
    const destCode =
      destination.split(" - ")[0]?.trim().toUpperCase() || destination.trim().toUpperCase();
    if (!originCode || !destCode) {
      toast("Enter origin and destination airport codes first.", "error");
      return;
    }
    const tariff = lookupAirTariff(tariffs, originCode, destCode);
    if (!tariff) {
      toast(`No Circulars tariff for ${originCode} → ${destCode}.`, "info");
      return;
    }
    updateAirline(selected.id, {
      breaks: { ...EMPTY_AIR_BREAKS, ...tariff.breaks },
      name: selected.name || tariff.carrier,
    });
    setCurrency(tariff.currency);
    toast(`Loaded ${tariff.carrier} rates onto selected airline.`, "success");
  }

  const handleSave = useCallback(
    async (openPreview = false) => {
      const shipment = airShipmentSchema.safeParse({
        customer,
        origin,
        destination,
        currency,
        incoterm,
        commodity,
        module,
      });
      if (!shipment.success) {
        const msg = shipment.error.issues[0]?.message ?? "Check shipment fields.";
        setSaveMsg(msg);
        toast(msg, "error");
        setStep("shipment");
        return;
      }
      const cargoErr = validateAirCargo(cargo);
      if (cargoErr) {
        setSaveMsg(cargoErr);
        toast(cargoErr, "error");
        setStep("shipment");
        return;
      }
      const airlineErr = validateSelectedAirline(selected);
      if (airlineErr) {
        setSaveMsg(airlineErr);
        toast(airlineErr, "error");
        setStep("carrier");
        return;
      }
      if (!selected || !selectedTotals) return;

      setSaving(true);
      setSaveMsg(null);
      try {
        if (useLiveData && user) {
          const id = await saveAirQuote({
            customer: customer.trim(),
            creator: user.username,
            origin,
            destination,
            currency,
            incoterm,
            commodity,
            module,
            cargo,
            selected,
            totals: selectedTotals,
            airlines,
            termsAndConditions: terms,
            customExchangeRate: customFx || undefined,
            quoteId: loader.editingQuoteId ?? undefined,
            quoteNumber: loader.editingQuoteNumber,
            status: loader.editingStatus,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.enquiries });
          const msg = loader.isEditing ? `Amended quote ${id}` : `Saved to Firestore · quote ${id}`;
          setSaveMsg(msg);
          toast(msg, "success");
          if (openPreview) {
            const q = await fetchQuoteById(id);
            if (q) setPreviewQuote(q);
          }
        } else {
          const msg = "Mock mode — save disabled. Use live Firebase or the legacy app.";
          setSaveMsg(msg);
          toast(msg, "info");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Save failed";
        setSaveMsg(msg);
        toast(msg, "error");
      } finally {
        setSaving(false);
      }
    },
    [
      customer,
      origin,
      destination,
      currency,
      incoterm,
      commodity,
      module,
      cargo,
      selected,
      selectedTotals,
      airlines,
      terms,
      customFx,
      user,
      loader,
      queryClient,
    ],
  );

  useDeskSaveShortcut(() => void handleSave(), !saving);

  return (
    <div className="space-y-3">
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

      <DeskSmartQuoteStrip key={stripKey} mode="air" onApply={applySmartDraft} />

      <DeskResetDialog
        open={confirmReset}
        deskLabel="air"
        onConfirm={applyReset}
        onCancel={() => setConfirmReset(false)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[var(--color-atlas-air)]">
          <PlaneTakeoff className="h-5 w-5" />
          <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Air desk</h1>
          <Badge tone="info">Phase 7</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-9"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmReset(true);
            }}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Reset
          </Button>
          <Button type="button" variant="secondary" className="h-9" onClick={applyTariffToSelected}>
            <Zap className="mr-1.5 h-4 w-4" />
            Circulars
          </Button>
          <Button type="button" variant="secondary" className="h-9" onClick={() => void handleSave(true)} disabled={saving}>
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </Button>
          <Button type="button" className="h-9" onClick={() => void handleSave()} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModule("export")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
            module === "export"
              ? "bg-amber-500 text-white"
              : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)]"
          }`}
        >
          Export (AE)
        </button>
        <button
          type="button"
          onClick={() => setModule("import")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
            module === "import"
              ? "bg-sky-600 text-white"
              : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)]"
          }`}
        >
          Import (AI)
        </button>
      </div>

      <Tabs
        value={step}
        onValueChange={(v) => setStep(v as Step)}
        items={[
          { value: "shipment", label: "1 · Shipment" },
          { value: "carrier", label: "2 · Carriers" },
          { value: "terms", label: "3 · Terms" },
        ]}
      />

      {saveMsg ? (
        <Card
          className={
            saveMsg.includes("Saved") || saveMsg.includes("Amended")
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }
        >
          <p className="text-sm font-semibold">{saveMsg}</p>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {step === "shipment" ? (
            <Card className="space-y-3 py-3">
              <h2 className="font-bold text-[var(--color-atlas-navy)]">Shipment</h2>
              <div className="grid gap-2 md:grid-cols-2">
                <Label className="md:col-span-2">
                  Customer
                  <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name" />
                </Label>
                <Label>
                  POL
                  <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="" />
                </Label>
                <Label>
                  POD
                  <Input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder=""
                  />
                </Label>
                <Label>
                  Currency
                  <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {["USD", "INR", "EUR", "GBP", "AED", "SGD"].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Label>
                <Label>
                  Incoterm
                  <Select value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
                    {INCOTERMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Label>
                <Label className="md:col-span-2">
                  Commodity
                  <Input value={commodity} onChange={(e) => setCommodity(e.target.value)} />
                </Label>
                <Label>
                  Custom USD→INR override (optional)
                  <Input
                    type="number"
                    step="0.01"
                    value={customFx || ""}
                    onChange={(e) => setCustomFx(Number(e.target.value))}
                    placeholder="Leave blank for 83.5"
                  />
                </Label>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-bold">Cargo dimensions (cm)</h3>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setCargo((rows) => [...rows, { l: 0, w: 0, h: 0, qty: 1, gw: 0 }])}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Add row
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-[var(--color-text-muted)]">
                      <tr>
                        <th className="px-2 py-2">L</th>
                        <th className="px-2 py-2">W</th>
                        <th className="px-2 py-2">H</th>
                        <th className="px-2 py-2">Qty</th>
                        <th className="px-2 py-2">GW kg</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {cargo.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-1">
                            <input
                              type="number"
                              className="w-16 rounded border px-1 py-1"
                              value={row.l || ""}
                              onChange={(e) => updateCargo(i, { l: Number(e.target.value) })}
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              className="w-16 rounded border px-1 py-1"
                              value={row.w || ""}
                              onChange={(e) => updateCargo(i, { w: Number(e.target.value) })}
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              className="w-16 rounded border px-1 py-1"
                              value={row.h || ""}
                              onChange={(e) => updateCargo(i, { h: Number(e.target.value) })}
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              className="w-14 rounded border px-1 py-1"
                              value={row.qty}
                              onChange={(e) => updateCargo(i, { qty: Number(e.target.value) })}
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              className="w-16 rounded border px-1 py-1"
                              value={row.gw || ""}
                              onChange={(e) => updateCargo(i, { gw: Number(e.target.value) })}
                            />
                          </td>
                          <td className="p-1">
                            <button
                              type="button"
                              className="text-red-600"
                              onClick={() => setCargo((rows) => rows.filter((_, j) => j !== i))}
                              disabled={cargo.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={() => setStep("carrier")}>
                  Next · Carriers
                </Button>
              </div>
            </Card>
          ) : null}

          {step === "carrier" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[var(--color-atlas-navy)]">
                  Airline options ({airlines.length})
                </h2>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setAirlines((prev) => [...prev, createAirlineOption({}, prev.length === 0)])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Add airline
                </Button>
              </div>

              {airlines.map((opt, idx) => {
                const tot = totalsById[opt.id];
                return (
                  <Card
                    key={opt.id}
                    className={`space-y-3 ${opt.selected ? "ring-2 ring-[var(--color-atlas-navy)]/30" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[var(--color-text-muted)]">
                          Airline #{idx + 1}
                        </span>
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <input
                            type="radio"
                            name="selected-airline"
                            checked={opt.selected}
                            onChange={() => selectAirline(opt.id)}
                          />
                          Select as quoted
                        </label>
                        {opt.selected ? <Badge tone="success">Quoted</Badge> : null}
                      </div>
                      <button
                        type="button"
                        className="text-sm font-semibold text-red-600 disabled:opacity-40"
                        disabled={airlines.length <= 1}
                        onClick={() => {
                          setAirlines((prev) => {
                            const next = prev.filter((a) => a.id !== opt.id);
                            if (!next.some((a) => a.selected) && next[0]) {
                              next[0] = { ...next[0], selected: true };
                            }
                            return next;
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <Label className="md:col-span-2">
                        Carrier / Airline
                        <Input
                          value={opt.name}
                          onChange={(e) => updateAirline(opt.id, { name: e.target.value })}
                          placeholder="EK - Emirates"
                        />
                      </Label>
                      <Label>
                        Routing
                        <Input
                          value={opt.routing}
                          onChange={(e) => updateAirline(opt.id, { routing: e.target.value })}
                          placeholder="BLR-DXB-LHR"
                        />
                      </Label>
                      <Label>
                        Transit time
                        <Input
                          value={opt.tt}
                          onChange={(e) => updateAirline(opt.id, { tt: e.target.value })}
                          placeholder="3-4 days"
                        />
                      </Label>
                      <Label>
                        Validity
                        <Input
                          value={opt.validity}
                          onChange={(e) => updateAirline(opt.id, { validity: e.target.value })}
                          placeholder="15 days"
                        />
                      </Label>
                      <Label>
                        Pivot weight (kg)
                        <Input
                          type="number"
                          value={opt.pivotWeightKg || ""}
                          onChange={(e) =>
                            updateAirline(opt.id, { pivotWeightKg: Number(e.target.value) })
                          }
                        />
                      </Label>
                      <Label>
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={opt.amsFeeEnabled}
                            onChange={(e) =>
                              updateAirline(opt.id, { amsFeeEnabled: e.target.checked })
                            }
                          />
                          AMS fee
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          disabled={!opt.amsFeeEnabled}
                          value={opt.amsFee}
                          onChange={(e) => updateAirline(opt.id, { amsFee: Number(e.target.value) })}
                        />
                      </Label>
                    </div>

                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={opt.wbEnabled}
                        onChange={(e) => updateAirline(opt.id, { wbEnabled: e.target.checked })}
                      />
                      Weight-break tariffs included
                    </label>

                    {opt.wbEnabled ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-xs uppercase text-[var(--color-text-muted)]">
                            <tr>
                              <th className="px-3 py-2 text-left">Break</th>
                              <th className="px-3 py-2">Sell</th>
                              <th className="px-3 py-2">Buy</th>
                            </tr>
                          </thead>
                          <tbody>
                            {AIR_WEIGHT_BREAKS.map((name) => (
                              <tr
                                key={name}
                                className={`border-t ${
                                  tot?.freight.usedBreak === name ? "bg-amber-50" : ""
                                }`}
                              >
                                <td className="px-3 py-2 font-semibold">
                                  {BREAK_LABELS[name]}
                                  {tot?.freight.usedBreak === name ? (
                                    <Badge tone="warn">Active</Badge>
                                  ) : null}
                                </td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-24 rounded border px-2 py-1"
                                    value={opt.breaks[name]?.sell ?? ""}
                                    onChange={(e) =>
                                      updateBreak(opt.id, name, "sell", Number(e.target.value))
                                    }
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-24 rounded border px-2 py-1"
                                    value={opt.breaks[name]?.buy ?? ""}
                                    onChange={(e) =>
                                      updateBreak(opt.id, name, "buy", Number(e.target.value))
                                    }
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    <SurchargeTable
                      title="Origin local fees & surcharges"
                      enabled={opt.originFeesEnabled}
                      onEnabledChange={(v) => updateAirline(opt.id, { originFeesEnabled: v })}
                      rows={opt.originSurcharges}
                      onChange={(rows) => updateAirline(opt.id, { originSurcharges: rows })}
                      units={["kg", "flat"]}
                    />
                    <SurchargeTable
                      title="Destination local fees & surcharges"
                      enabled={opt.destFeesEnabled}
                      onEnabledChange={(v) => updateAirline(opt.id, { destFeesEnabled: v })}
                      rows={opt.destSurcharges}
                      onChange={(rows) => updateAirline(opt.id, { destSurcharges: rows })}
                      units={["kg", "flat"]}
                    />

                    {tot ? (
                      <div className="flex flex-wrap gap-3 border-t pt-3 text-sm">
                        <span>
                          Freight:{" "}
                          <strong>{formatCurrency(tot.freight.baseFreightSell, currency)}</strong>
                        </span>
                        <span>
                          Origin: <strong>{formatCurrency(tot.originTotal, currency)}</strong>
                        </span>
                        <span>
                          Dest: <strong>{formatCurrency(tot.destTotal, currency)}</strong>
                        </span>
                        <span>
                          Total:{" "}
                          <strong className="text-emerald-700">
                            {formatCurrency(tot.grandSell, currency)}
                          </strong>
                        </span>
                      </div>
                    ) : null}
                  </Card>
                );
              })}

              <div className="flex justify-between">
                <Button type="button" variant="secondary" onClick={() => setStep("shipment")}>
                  Back
                </Button>
                <Button type="button" onClick={() => setStep("terms")}>
                  Next · Terms
                </Button>
              </div>
            </div>
          ) : null}

          {step === "terms" ? (
            <Card className="space-y-4">
              <h2 className="font-bold text-[var(--color-atlas-navy)]">Terms & conditions</h2>
              <Textarea
                className="min-h-56"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
              <button
                type="button"
                className="text-xs font-semibold text-sky-700 hover:underline"
                onClick={() => setTerms(getDefaultFreightTerms("air"))}
              >
                Restore default air terms
              </button>
              <div className="flex justify-between">
                <Button type="button" variant="secondary" onClick={() => setStep("carrier")}>
                  Back
                </Button>
                <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving…" : "Save quote"}
                </Button>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="font-bold text-[var(--color-atlas-navy)]">Quoted summary</h2>
            {selected && selectedTotals ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Module</dt>
                  <dd className="font-bold uppercase">{module}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Airline</dt>
                  <dd className="text-right font-bold">{selected.name || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Chargeable</dt>
                  <dd className="font-bold">
                    {selectedTotals.freight.chargeableWeightKg.toFixed(2)} kg
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Base freight</dt>
                  <dd>{formatCurrency(selectedTotals.freight.baseFreightSell, currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Origin fees</dt>
                  <dd>{formatCurrency(selectedTotals.originTotal, currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Dest fees</dt>
                  <dd>{formatCurrency(selectedTotals.destTotal, currency)}</dd>
                </div>
                {selectedTotals.ams > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-muted)]">AMS</dt>
                    <dd>{formatCurrency(selectedTotals.ams, currency)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-2">
                  <dt className="font-bold">Grand total</dt>
                  <dd className="font-extrabold text-emerald-700">
                    {formatCurrency(selectedTotals.grandSell, currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Gross profit</dt>
                  <dd className="font-bold">{formatCurrency(selectedTotals.gp, currency)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">Select an airline option.</p>
            )}
          </Card>

          {airlines.length > 1 ? (
            <Card>
              <h2 className="mb-2 font-bold text-[var(--color-atlas-navy)]">Compare options</h2>
              <ul className="space-y-2 text-sm">
                {airlines.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span className={a.selected ? "font-bold" : ""}>
                      {a.name || "Untitled"}
                      {a.selected ? " ★" : ""}
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(totalsById[a.id]?.grandSell ?? 0, currency)}
                    </span>
                  </li>
                ))}
              </ul>
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
