"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Ship, Trash2, Zap } from "lucide-react";
import type { SeaMode } from "@atlas/pricing-core";
import { Badge, Button, Card } from "@/components/ui";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { saveSeaQuote } from "@/lib/firebase/save-quote";
import { lookupSeaTariff } from "@/lib/firebase/tariffs";
import {
  computeSeaDesk,
  validateSeaDesk,
  type SeaContainerRow,
} from "@/lib/pricing/sea-desk";
import { loadSeaDeskFromQuote } from "@/lib/quotes/desk-loader";
import { useSeaTariffs } from "@/hooks/use-atlas-data";
import { queryKeys } from "@/hooks/query-keys";
import { useQuoteDeskLoader } from "@/hooks/use-quote-desk-loader";
import { formatCurrency } from "@/lib/utils";

const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];
const CONTAINER_TYPES = ["20'GP", "40'GP", "40'HC", "45'HC", "20'RF", "40'RF"];

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
  const loader = useQuoteDeskLoader();

  const [customer, setCustomer] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [incoterm, setIncoterm] = useState("FOB");
  const [liner, setLiner] = useState("");
  const [routing, setRouting] = useState("");
  const [tt, setTt] = useState("");
  const [validity, setValidity] = useState("");
  const [mode, setMode] = useState<SeaMode>("fcl");
  const [grossWeightKg, setGrossWeightKg] = useState(8500);
  const [volumeCbm, setVolumeCbm] = useState(28);
  const [chargeableCbmOverride, setChargeableCbmOverride] = useState(0);
  const [containers, setContainers] = useState<SeaContainerRow[]>([
    { type: "20'GP", qty: 1, sellRate: 800, buyRate: 700 },
  ]);
  const [lclSell, setLclSell] = useState(45);
  const [lclBuy, setLclBuy] = useState(40);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [tariffMsg, setTariffMsg] = useState<string | null>(null);

  const deskInput = useMemo(
    () => ({
      customer,
      origin,
      destination,
      currency,
      incoterm,
      liner,
      routing,
      tt,
      validity,
      mode,
      grossWeightKg,
      volumeCbm,
      chargeableCbmOverride,
      containers,
      lclSell,
      lclBuy,
    }),
    [
      customer,
      origin,
      destination,
      currency,
      incoterm,
      liner,
      routing,
      tt,
      validity,
      mode,
      grossWeightKg,
      volumeCbm,
      chargeableCbmOverride,
      containers,
      lclSell,
      lclBuy,
    ],
  );

  const calc = useMemo(() => computeSeaDesk(deskInput), [deskInput]);

  useEffect(() => {
    if (!loader.sourceQuote) return;
    const loaded = loadSeaDeskFromQuote(loader.sourceQuote);
    setCustomer(loaded.customer);
    setOrigin(loaded.origin);
    setDestination(loaded.destination);
    setCurrency(loaded.currency);
    setIncoterm(loaded.incoterm);
    setLiner(loaded.liner);
    setRouting(loaded.routing);
    setTt(loaded.tt);
    setValidity(loaded.validity);
    setMode(loaded.mode);
    setGrossWeightKg(loaded.grossWeightKg);
    setVolumeCbm(loaded.volumeCbm);
    setChargeableCbmOverride(loaded.chargeableCbmOverride);
    setContainers(loaded.containers);
    setLclSell(loaded.lclSell);
    setLclBuy(loaded.lclBuy);
  }, [loader.sourceQuote]);

  function updateContainer(index: number, patch: Partial<SeaContainerRow>) {
    setContainers((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function applyTariff() {
    const originCode = origin.split(" - ")[0]?.trim().toUpperCase() || origin.trim().toUpperCase();
    const destCode =
      destination.split(" - ")[0]?.trim().toUpperCase() || destination.trim().toUpperCase();
    if (!originCode || !destCode) {
      setTariffMsg("Enter port of loading and discharge first.");
      return;
    }
    const tariff = lookupSeaTariff(tariffs, originCode, destCode, mode);
    if (!tariff) {
      setTariffMsg(`No Circulars ${mode.toUpperCase()} tariff for ${originCode} → ${destCode}.`);
      return;
    }
    setCurrency(tariff.currency);
    setLiner(tariff.carrier);
    if (mode === "fcl") {
      const rows = Object.entries(tariff.fclRates).map(([type, rates]) => ({
        type,
        qty: 1,
        sellRate: rates.sell,
        buyRate: rates.buy,
      }));
      if (rows.length) setContainers(rows);
    } else {
      setLclSell(tariff.lclRate.sell);
      setLclBuy(tariff.lclRate.buy);
    }
    setTariffMsg(`Loaded ${tariff.carrier} ${mode.toUpperCase()} rates from Circulars.`);
  }

  async function handleSave() {
    const err = validateSeaDesk(deskInput);
    if (err) {
      setSaveMsg(err);
      return;
    }
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
          liner,
          routing,
          tt,
          validity,
          mode,
          grossWeightKg,
          volumeCbm,
          containers,
          calc,
          quoteId: loader.editingQuoteId ?? undefined,
          quoteNumber: loader.editingQuoteNumber,
          status: loader.editingStatus,
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.enquiries });
        setSaveMsg(loader.isEditing ? `Amended quote ${id}` : `Saved to Firestore · quote ${id}`);
      } else {
        setSaveMsg("Mock mode — save disabled. Use live Firebase or the legacy app.");
      }
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

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
          <div className="flex items-center gap-2 text-[var(--color-atlas-sea)]">
            <Ship className="h-5 w-5" />
            <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Sea desk</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            FCL and LCL ocean freight quoting — containers, chargeable RT, liner rates. Same core math
            as legacy. {useLiveData ? "Save writes to the quotes collection." : "Mock mode — preview only."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={applyTariff}>
            <Zap className="mr-2 h-4 w-4" />
            Load Circulars tariff
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save quote"}
          </Button>
        </div>
      </div>

      {saveMsg ? (
        <Card
          className={
            saveMsg.includes("Saved") ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
          }
        >
          <p className="text-sm font-semibold">{saveMsg}</p>
        </Card>
      ) : null}

      {tariffMsg ? (
        <Card className="border-sky-200 bg-sky-50">
          <p className="text-sm font-semibold text-sky-900">{tariffMsg}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          <h2 className="font-bold text-[var(--color-atlas-navy)]">Shipment</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-semibold md:col-span-2">
              Customer
              <input
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Customer name"
              />
            </label>
            <label className="text-sm font-semibold">
              Port of loading
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="INNSA - Nhava Sheva"
              />
            </label>
            <label className="text-sm font-semibold">
              Port of discharge
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="NLRTM - Rotterdam"
              />
            </label>
            <label className="text-sm font-semibold">
              Mode
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={mode}
                onChange={(e) => setMode(e.target.value as SeaMode)}
              >
                <option value="fcl">FCL</option>
                <option value="lcl">LCL</option>
                <option value="bb">Break bulk</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Currency
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {["USD", "INR", "EUR", "GBP", "AED", "SGD"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Incoterm
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={incoterm}
                onChange={(e) => setIncoterm(e.target.value)}
              >
                {INCOTERMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Gross weight (kg)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={grossWeightKg}
                onChange={(e) => setGrossWeightKg(Number(e.target.value))}
              />
            </label>
            <label className="text-sm font-semibold">
              Volume (CBM)
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={volumeCbm}
                onChange={(e) => setVolumeCbm(Number(e.target.value))}
              />
            </label>
            {mode !== "fcl" ? (
              <label className="text-sm font-semibold md:col-span-2">
                Chargeable RT override (optional — leave 0 for auto)
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={chargeableCbmOverride || ""}
                  onChange={(e) => setChargeableCbmOverride(Number(e.target.value))}
                />
              </label>
            ) : null}
          </div>

          {mode === "fcl" ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-bold">Containers</h3>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setContainers((rows) => [
                      ...rows,
                      { type: "20'GP", qty: 1, sellRate: 0, buyRate: 0 },
                    ])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Add container
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-[var(--color-text-muted)]">
                    <tr>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2">Qty</th>
                      <th className="px-2 py-2">Sell rate</th>
                      <th className="px-2 py-2">Buy rate</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {containers.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1">
                          <select
                            className="rounded border px-2 py-1"
                            value={row.type}
                            onChange={(e) => updateContainer(i, { type: e.target.value })}
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
                            onChange={(e) => updateContainer(i, { qty: Number(e.target.value) })}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            className="w-24 rounded border px-1 py-1"
                            value={row.sellRate || ""}
                            onChange={(e) => updateContainer(i, { sellRate: Number(e.target.value) })}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            className="w-24 rounded border px-1 py-1"
                            value={row.buyRate || ""}
                            onChange={(e) => updateContainer(i, { buyRate: Number(e.target.value) })}
                          />
                        </td>
                        <td className="p-1">
                          <button
                            type="button"
                            className="text-red-600"
                            onClick={() => setContainers((rows) => rows.filter((_, j) => j !== i))}
                            disabled={containers.length <= 1}
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
              <label className="text-sm font-semibold">
                LCL sell rate (per RT)
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={lclSell}
                  onChange={(e) => setLclSell(Number(e.target.value))}
                />
              </label>
              <label className="text-sm font-semibold">
                LCL buy rate (per RT)
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={lclBuy}
                  onChange={(e) => setLclBuy(Number(e.target.value))}
                />
              </label>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="font-bold text-[var(--color-atlas-navy)]">Carrier</h2>
            <label className="block text-sm font-semibold">
              Liner
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={liner}
                onChange={(e) => setLiner(e.target.value)}
                placeholder="MSC - Mediterranean Shipping"
              />
            </label>
            <label className="block text-sm font-semibold">
              Routing
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={routing}
                onChange={(e) => setRouting(e.target.value)}
                placeholder="INNSA-SGSIN-NLRTM"
              />
            </label>
            <label className="block text-sm font-semibold">
              Transit time
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={tt}
                onChange={(e) => setTt(e.target.value)}
                placeholder="28-32 days"
              />
            </label>
            <label className="block text-sm font-semibold">
              Validity
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={validity}
                onChange={(e) => setValidity(e.target.value)}
                placeholder="15 days"
              />
            </label>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-bold text-[var(--color-atlas-navy)]">Summary</h2>
            <div className="flex items-center gap-2">
              <Badge tone="info">{mode.toUpperCase()}</Badge>
              {calc.usingBuyFallback ? <Badge tone="warn">Buy fallback</Badge> : null}
            </div>
            <dl className="space-y-2 text-sm">
              {mode === "fcl" ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-muted)]">Containers</dt>
                    <dd className="font-bold">{calc.containerCount}</dd>
                  </div>
                  {calc.containerSummary.map((line, i) => (
                    <div key={i} className="text-xs text-[var(--color-text-muted)]">
                      {line}
                    </div>
                  ))}
                </>
              ) : (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Chargeable RT</dt>
                  <dd className="font-bold">{calc.chargeableRt.toFixed(2)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <dt className="font-bold">Base freight (sell)</dt>
                <dd className="font-extrabold text-emerald-700">
                  {formatCurrency(calc.baseFreightSell, currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Base freight (buy)</dt>
                <dd>{formatCurrency(calc.baseFreightBuy, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Gross profit</dt>
                <dd className="font-bold">
                  {formatCurrency(calc.baseFreightSell - calc.baseFreightBuy, currency)}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
