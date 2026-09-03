"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Save, Ship, Trash2, Zap } from "lucide-react";
import type { SeaMode } from "@atlas/pricing-core";
import { Badge, Button, Card, Input, Label, Select, Tabs, Textarea } from "@/components/ui";
import { SurchargeTable } from "@/components/desks/SurchargeTable";
import { QuotePreviewModal } from "@/components/QuotePreviewModal";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { fetchQuoteById } from "@/lib/firebase/quote-lifecycle";
import { saveSeaQuote } from "@/lib/firebase/save-quote";
import { lookupSeaTariff } from "@/lib/firebase/tariffs";
import { createLinerOption, type LinerOption } from "@/lib/pricing/carrier-options";
import { seaShipmentSchema } from "@/lib/pricing/desk-schemas";
import {
  computeLinerTotals,
  seaHeavyWeightWarning,
  validateSeaCargoBasics,
  validateSelectedLiner,
  type SeaContainerRow,
} from "@/lib/pricing/sea-desk";
import { getDefaultFreightTerms } from "@/lib/pricing/terms";
import { loadSeaDeskFromQuote } from "@/lib/quotes/desk-loader";
import { useSeaTariffs } from "@/hooks/use-atlas-data";
import { queryKeys } from "@/hooks/query-keys";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
import { useQuoteDeskLoader } from "@/hooks/use-quote-desk-loader";
import type { SavedQuote } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];
const CONTAINER_TYPES = ["20'GP", "40'GP", "40'HC", "45'HC", "20'RF", "40'RF"];
type Step = "shipment" | "carrier" | "terms";

export default function SeaDeskPage() {
  return (
    <Suspense fallback={<Card className="p-6 text-sm text-[var(--color-text-muted)]">Loading sea desk…</Card>}>
      <SeaDeskInner />
    </Suspense>
  );
}

function SeaDeskInner() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: tariffs = [] } = useSeaTariffs();
  const loader = useQuoteDeskLoader("sea");

  const [step, setStep] = useState<Step>("shipment");
  const [customer, setCustomer] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [incoterm, setIncoterm] = useState("FOB");
  const [module, setModule] = useState<"export" | "import">("export");
  const [mode, setMode] = useState<SeaMode>("fcl");
  const [grossWeightKg, setGrossWeightKg] = useState(8500);
  const [volumeCbm, setVolumeCbm] = useState(28);
  const [chargeableCbmOverride, setChargeableCbmOverride] = useState(0);
  const [customFx, setCustomFx] = useState(0);
  const [liners, setLiners] = useState<LinerOption[]>([createLinerOption({}, true)]);
  const [terms, setTerms] = useState(getDefaultFreightTerms("sea"));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [previewQuote, setPreviewQuote] = useState<SavedQuote | null>(null);

  const selected = liners.find((l) => l.selected) ?? liners[0];

  const totalsById = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeLinerTotals>> = {};
    for (const l of liners) {
      map[l.id] = computeLinerTotals(mode, grossWeightKg, volumeCbm, chargeableCbmOverride, l);
    }
    return map;
  }, [liners, mode, grossWeightKg, volumeCbm, chargeableCbmOverride]);

  const selectedTotals = selected ? totalsById[selected.id] : null;
  const heavyWarn = seaHeavyWeightWarning(
    grossWeightKg,
    selectedTotals?.freight.containerCount ?? (mode === "fcl" ? 1 : 0),
  );

  useEffect(() => {
    if (!loader.sourceQuote) return;
    const loaded = loadSeaDeskFromQuote(loader.sourceQuote);
    setCustomer(loaded.customer);
    setOrigin(loaded.origin);
    setDestination(loaded.destination);
    setCurrency(loaded.currency);
    setIncoterm(loaded.incoterm);
    setModule(loaded.module);
    setMode(loaded.mode);
    setGrossWeightKg(loaded.grossWeightKg);
    setVolumeCbm(loaded.volumeCbm);
    setChargeableCbmOverride(loaded.chargeableCbmOverride);
    setCustomFx(loaded.customExchangeRate);
    setLiners(loaded.liners);
    if (loaded.terms) setTerms(loaded.terms);
  }, [loader.sourceQuote]);

  useEffect(() => {
    if (!loader.smartPrefill) return;
    const p = loader.smartPrefill.parsed;
    const st = loader.smartPrefill.seaTariff;
    setCustomer(p.customer || "");
    setOrigin(p.origin || "");
    setDestination(p.destination || "");
    if (p.mode) setMode(p.mode);
    else if (st?.mode) setMode(st.mode);
    if (loader.smartPrefill.currency || st?.currency) {
      setCurrency(loader.smartPrefill.currency || st?.currency || "USD");
    }
    if (p.grossWeight) setGrossWeightKg(p.grossWeight);
    if (p.volume) setVolumeCbm(p.volume);
    setLiners([
      createLinerOption(
        {
          name: p.linerLabel || loader.smartPrefill.carrierLabel || "",
          routing: p.origin && p.destination ? `${p.origin}-${p.destination}` : "",
          tt: "TBA",
          validity: "15 days",
          containers: p.containers.length
            ? p.containers.map((c) => ({
                type: c.type,
                qty: c.qty,
                sellRate: st?.fclRates?.[c.type]?.sell ?? 0,
                buyRate: st?.fclRates?.[c.type]?.buy ?? 0,
              }))
            : undefined,
          lclSell: st?.lclRate.sell,
          lclBuy: st?.lclRate.buy,
        },
        true,
      ),
    ]);
    setStep("carrier");
  }, [loader.smartPrefill]);

  function updateLiner(id: string, patch: Partial<LinerOption>) {
    setLiners((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function selectLiner(id: string) {
    setLiners((prev) => prev.map((l) => ({ ...l, selected: l.id === id })));
  }

  function updateContainer(linerId: string, index: number, patch: Partial<SeaContainerRow>) {
    setLiners((prev) =>
      prev.map((l) => {
        if (l.id !== linerId) return l;
        return {
          ...l,
          containers: l.containers.map((c, i) => (i === index ? { ...c, ...patch } : c)),
        };
      }),
    );
  }

  function applyTariffToSelected() {
    if (!selected) return;
    const originCode = origin.split(" - ")[0]?.trim().toUpperCase() || origin.trim().toUpperCase();
    const destCode =
      destination.split(" - ")[0]?.trim().toUpperCase() || destination.trim().toUpperCase();
    if (!originCode || !destCode) {
      toast("Enter port of loading and discharge first.", "error");
      return;
    }
    const tariff = lookupSeaTariff(tariffs, originCode, destCode, mode);
    if (!tariff) {
      toast(`No Circulars ${mode.toUpperCase()} tariff for ${originCode} → ${destCode}.`, "info");
      return;
    }
    setCurrency(tariff.currency);
    if (mode === "fcl") {
      const rows = Object.entries(tariff.fclRates).map(([type, rates]) => ({
        type,
        qty: 1,
        sellRate: rates.sell,
        buyRate: rates.buy,
      }));
      updateLiner(selected.id, {
        name: selected.name || tariff.carrier,
        containers: rows.length ? rows : selected.containers,
      });
    } else {
      updateLiner(selected.id, {
        name: selected.name || tariff.carrier,
        lclSell: tariff.lclRate.sell,
        lclBuy: tariff.lclRate.buy,
      });
    }
    toast(`Loaded ${tariff.carrier} ${mode.toUpperCase()} rates onto selected liner.`, "success");
  }

  const handleSave = useCallback(
    async (openPreview = false) => {
      const shipment = seaShipmentSchema.safeParse({
        customer,
        origin,
        destination,
        currency,
        incoterm,
        module,
        mode,
      });
      if (!shipment.success) {
        const msg = shipment.error.issues[0]?.message ?? "Check shipment fields.";
        setSaveMsg(msg);
        toast(msg, "error");
        setStep("shipment");
        return;
      }
      const cargoErr = validateSeaCargoBasics(grossWeightKg, volumeCbm);
      if (cargoErr) {
        setSaveMsg(cargoErr);
        toast(cargoErr, "error");
        setStep("shipment");
        return;
      }
      const linerErr = validateSelectedLiner(selected, mode);
      if (linerErr) {
        setSaveMsg(linerErr);
        toast(linerErr, "error");
        setStep("carrier");
        return;
      }
      if (!selected || !selectedTotals) return;

      setSaving(true);
      setSaveMsg(null);
      try {
        if (useLiveData && user) {
          const id = await saveSeaQuote({
            customer: customer.trim(),
            creator: user.username,
            origin,
            destination,
            currency,
            incoterm,
            module,
            mode,
            grossWeightKg,
            volumeCbm,
            selected,
            totals: selectedTotals,
            liners,
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
      module,
      mode,
      grossWeightKg,
      volumeCbm,
      selected,
      selectedTotals,
      liners,
      terms,
      customFx,
      user,
      loader,
      queryClient,
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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-atlas-sea)]">
            <Ship className="h-5 w-5" />
            <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Sea desk</h1>
            <Badge tone="info">Phase 7</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Multi-liner options, local surcharges, alternatives compare — ⌘S to save.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={applyTariffToSelected}>
            <Zap className="mr-2 h-4 w-4" />
            Load Circulars tariff
          </Button>
          <Button type="button" variant="secondary" onClick={() => void handleSave(true)} disabled={saving}>
            <Eye className="mr-2 h-4 w-4" />
            Save & preview
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save quote"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModule("export")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
            module === "export" ? "bg-amber-500 text-white" : "border bg-white text-[var(--color-text-muted)]"
          }`}
        >
          Export (SE)
        </button>
        <button
          type="button"
          onClick={() => setModule("import")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
            module === "import" ? "bg-sky-600 text-white" : "border bg-white text-[var(--color-text-muted)]"
          }`}
        >
          Import (SI)
        </button>
      </div>

      {heavyWarn ? (
        <Card className="border-amber-300 bg-amber-50">
          <p className="text-sm font-semibold text-amber-900">{heavyWarn}</p>
        </Card>
      ) : null}

      <Tabs
        value={step}
        onValueChange={(v) => setStep(v as Step)}
        items={[
          { value: "shipment", label: "1 · Shipment" },
          { value: "carrier", label: "2 · Liners" },
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

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {step === "shipment" ? (
            <Card className="space-y-4">
              <h2 className="font-bold text-[var(--color-atlas-navy)]">Shipment</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Label className="md:col-span-2">
                  Customer
                  <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
                </Label>
                <Label>
                  Port of loading
                  <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="INNSA - Nhava Sheva" />
                </Label>
                <Label>
                  Port of discharge
                  <Input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="NLRTM - Rotterdam"
                  />
                </Label>
                <Label>
                  Mode
                  <Select value={mode} onChange={(e) => setMode(e.target.value as SeaMode)}>
                    <option value="fcl">FCL</option>
                    <option value="lcl">LCL</option>
                    <option value="bb">Break bulk</option>
                  </Select>
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
                <Label>
                  Gross weight (kg)
                  <Input
                    type="number"
                    value={grossWeightKg}
                    onChange={(e) => setGrossWeightKg(Number(e.target.value))}
                  />
                </Label>
                <Label>
                  Volume (CBM)
                  <Input
                    type="number"
                    step="0.01"
                    value={volumeCbm}
                    onChange={(e) => setVolumeCbm(Number(e.target.value))}
                  />
                </Label>
                {mode !== "fcl" ? (
                  <Label className="md:col-span-2">
                    Chargeable RT override (0 = auto)
                    <Input
                      type="number"
                      step="0.01"
                      value={chargeableCbmOverride || ""}
                      onChange={(e) => setChargeableCbmOverride(Number(e.target.value))}
                    />
                  </Label>
                ) : null}
                <Label>
                  Custom USD→INR override
                  <Input
                    type="number"
                    step="0.01"
                    value={customFx || ""}
                    onChange={(e) => setCustomFx(Number(e.target.value))}
                    placeholder="Blank = 83.5"
                  />
                </Label>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={() => setStep("carrier")}>
                  Next · Liners
                </Button>
              </div>
            </Card>
          ) : null}

          {step === "carrier" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[var(--color-atlas-navy)]">
                  Liner options ({liners.length})
                </h2>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setLiners((prev) => [...prev, createLinerOption({}, prev.length === 0)])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Add liner
                </Button>
              </div>

              {liners.map((opt, idx) => {
                const tot = totalsById[opt.id];
                return (
                  <Card
                    key={opt.id}
                    className={`space-y-3 ${opt.selected ? "ring-2 ring-[var(--color-atlas-sea)]/30" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[var(--color-text-muted)]">
                          Liner #{idx + 1}
                        </span>
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <input
                            type="radio"
                            name="selected-liner"
                            checked={opt.selected}
                            onChange={() => selectLiner(opt.id)}
                          />
                          Select as quoted
                        </label>
                        {opt.selected ? <Badge tone="success">Quoted</Badge> : null}
                      </div>
                      <button
                        type="button"
                        className="text-sm font-semibold text-red-600 disabled:opacity-40"
                        disabled={liners.length <= 1}
                        onClick={() => {
                          setLiners((prev) => {
                            const next = prev.filter((l) => l.id !== opt.id);
                            if (!next.some((l) => l.selected) && next[0]) {
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
                        Liner
                        <Input
                          value={opt.name}
                          onChange={(e) => updateLiner(opt.id, { name: e.target.value })}
                          placeholder="MSC - Mediterranean Shipping"
                        />
                      </Label>
                      <Label>
                        Routing
                        <Input
                          value={opt.routing}
                          onChange={(e) => updateLiner(opt.id, { routing: e.target.value })}
                        />
                      </Label>
                      <Label>
                        Transit time
                        <Input
                          value={opt.tt}
                          onChange={(e) => updateLiner(opt.id, { tt: e.target.value })}
                        />
                      </Label>
                      <Label className="md:col-span-2">
                        Validity
                        <Input
                          value={opt.validity}
                          onChange={(e) => updateLiner(opt.id, { validity: e.target.value })}
                        />
                      </Label>
                    </div>

                    {mode === "fcl" ? (
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="font-bold">Containers</h3>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              updateLiner(opt.id, {
                                containers: [
                                  ...opt.containers,
                                  { type: "20'GP", qty: 1, sellRate: 0, buyRate: 0 },
                                ],
                              })
                            }
                          >
                            <Plus className="mr-1 h-4 w-4" /> Add
                          </Button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-[var(--color-text-muted)]">
                              <tr>
                                <th className="px-2 py-2 text-left">Type</th>
                                <th className="px-2 py-2">Qty</th>
                                <th className="px-2 py-2">Sell</th>
                                <th className="px-2 py-2">Buy</th>
                                <th className="px-2 py-2" />
                              </tr>
                            </thead>
                            <tbody>
                              {opt.containers.map((row, i) => (
                                <tr key={i} className="border-t">
                                  <td className="p-1">
                                    <select
                                      className="rounded border px-2 py-1"
                                      value={row.type}
                                      onChange={(e) =>
                                        updateContainer(opt.id, i, { type: e.target.value })
                                      }
                                    >
                                      {CONTAINER_TYPES.map((t) => (
                                        <option key={t} value={t}>
                                          {t}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-1">
                                    <input
                                      type="number"
                                      className="w-14 rounded border px-1 py-1"
                                      value={row.qty}
                                      onChange={(e) =>
                                        updateContainer(opt.id, i, { qty: Number(e.target.value) })
                                      }
                                    />
                                  </td>
                                  <td className="p-1">
                                    <input
                                      type="number"
                                      className="w-24 rounded border px-1 py-1"
                                      value={row.sellRate || ""}
                                      onChange={(e) =>
                                        updateContainer(opt.id, i, {
                                          sellRate: Number(e.target.value),
                                        })
                                      }
                                    />
                                  </td>
                                  <td className="p-1">
                                    <input
                                      type="number"
                                      className="w-24 rounded border px-1 py-1"
                                      value={row.buyRate || ""}
                                      onChange={(e) =>
                                        updateContainer(opt.id, i, {
                                          buyRate: Number(e.target.value),
                                        })
                                      }
                                    />
                                  </td>
                                  <td className="p-1">
                                    <button
                                      type="button"
                                      className="text-red-600"
                                      disabled={opt.containers.length <= 1}
                                      onClick={() =>
                                        updateLiner(opt.id, {
                                          containers: opt.containers.filter((_, j) => j !== i),
                                        })
                                      }
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
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Label>
                          LCL sell / RT
                          <Input
                            type="number"
                            step="0.01"
                            value={opt.lclSell}
                            onChange={(e) =>
                              updateLiner(opt.id, { lclSell: Number(e.target.value) })
                            }
                          />
                        </Label>
                        <Label>
                          LCL buy / RT
                          <Input
                            type="number"
                            step="0.01"
                            value={opt.lclBuy}
                            onChange={(e) =>
                              updateLiner(opt.id, { lclBuy: Number(e.target.value) })
                            }
                          />
                        </Label>
                      </div>
                    )}

                    <SurchargeTable
                      title="Origin local surcharges"
                      enabled={opt.originFeesEnabled}
                      onEnabledChange={(v) => updateLiner(opt.id, { originFeesEnabled: v })}
                      rows={opt.originSurcharges}
                      onChange={(rows) => updateLiner(opt.id, { originSurcharges: rows })}
                      units={["flat", "cbm", "container"]}
                    />
                    <SurchargeTable
                      title="Destination local surcharges"
                      enabled={opt.destFeesEnabled}
                      onEnabledChange={(v) => updateLiner(opt.id, { destFeesEnabled: v })}
                      rows={opt.destSurcharges}
                      onChange={(rows) => updateLiner(opt.id, { destSurcharges: rows })}
                      units={["flat", "cbm", "container"]}
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
              <Textarea className="min-h-56" value={terms} onChange={(e) => setTerms(e.target.value)} />
              <button
                type="button"
                className="text-xs font-semibold text-sky-700 hover:underline"
                onClick={() => setTerms(getDefaultFreightTerms("sea"))}
              >
                Restore default sea terms
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
                  <dt className="text-[var(--color-text-muted)]">Module / Mode</dt>
                  <dd className="font-bold uppercase">
                    {module} · {mode}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Liner</dt>
                  <dd className="text-right font-bold">{selected.name || "—"}</dd>
                </div>
                {mode !== "fcl" ? (
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-muted)]">Chargeable RT</dt>
                    <dd className="font-bold">{selectedTotals.freight.chargeableRt.toFixed(2)}</dd>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-muted)]">Containers</dt>
                    <dd className="font-bold">{selectedTotals.freight.containerCount}</dd>
                  </div>
                )}
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
            ) : null}
          </Card>

          {liners.length > 1 ? (
            <Card>
              <h2 className="mb-2 font-bold text-[var(--color-atlas-navy)]">Alternatives</h2>
              <ul className="space-y-2 text-sm">
                {liners.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span className={l.selected ? "font-bold" : ""}>
                      {l.name || "Untitled"}
                      {l.selected ? " ★" : ""}
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(totalsById[l.id]?.grandSell ?? 0, currency)}
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
