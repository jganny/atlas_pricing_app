"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PlaneTakeoff, Plus, Save, Trash2, Zap } from "lucide-react";
import type { WeightBreakName, WeightBreaks } from "@atlas/pricing-core";
import { Badge, Button, Card } from "@/components/ui";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { saveAirQuote } from "@/lib/firebase/save-quote";
import { lookupAirTariff } from "@/lib/firebase/tariffs";
import {
  AIR_WEIGHT_BREAKS,
  EMPTY_AIR_BREAKS,
  computeAirDesk,
  validateAirDesk,
  type AirCargoRow,
} from "@/lib/pricing/air-desk";
import { loadAirDeskFromQuote } from "@/lib/quotes/desk-loader";
import { useAirTariffs } from "@/hooks/use-atlas-data";
import { queryKeys } from "@/hooks/query-keys";
import { useQuoteDeskLoader } from "@/hooks/use-quote-desk-loader";
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

export default function AirDeskPage() {
  return (
    <Suspense fallback={<Card className="p-6 text-sm text-[var(--color-text-muted)]">Loading air desk…</Card>}>
      <AirDeskInner />
    </Suspense>
  );
}

function AirDeskInner() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: tariffs = [] } = useAirTariffs();
  const loader = useQuoteDeskLoader();

  const [customer, setCustomer] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [incoterm, setIncoterm] = useState("FOB");
  const [commodity, setCommodity] = useState("GENERAL");
  const [airline, setAirline] = useState("");
  const [routing, setRouting] = useState("");
  const [tt, setTt] = useState("");
  const [validity, setValidity] = useState("");
  const [pivotWeightKg, setPivotWeightKg] = useState(0);
  const [cargo, setCargo] = useState<AirCargoRow[]>([
    { l: 120, w: 80, h: 90, qty: 1, gw: 150 },
  ]);
  const [breaks, setBreaks] = useState<WeightBreaks>({
    ...EMPTY_AIR_BREAKS,
    minus45: { sell: 2.8, buy: 2.4 },
    plus45: { sell: 2.5, buy: 2.1 },
    plus100: { sell: 2.2, buy: 1.9 },
    min: { sell: 150, buy: 120 },
  });
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
      commodity,
      airline,
      routing,
      tt,
      validity,
      pivotWeightKg,
      cargo,
      breaks,
    }),
    [
      customer,
      origin,
      destination,
      currency,
      incoterm,
      commodity,
      airline,
      routing,
      tt,
      validity,
      pivotWeightKg,
      cargo,
      breaks,
    ],
  );

  const calc = useMemo(() => computeAirDesk(deskInput), [deskInput]);

  useEffect(() => {
    if (!loader.sourceQuote) return;
    const loaded = loadAirDeskFromQuote(loader.sourceQuote);
    setCustomer(loaded.customer);
    setOrigin(loaded.origin);
    setDestination(loaded.destination);
    setCurrency(loaded.currency);
    setIncoterm(loaded.incoterm);
    setCommodity(loaded.commodity);
    setAirline(loaded.airline);
    setRouting(loaded.routing);
    setTt(loaded.tt);
    setValidity(loaded.validity);
    setPivotWeightKg(loaded.pivotWeightKg);
    setCargo(loaded.cargo);
    if (Object.keys(loaded.breaks).length) setBreaks({ ...EMPTY_AIR_BREAKS, ...loaded.breaks });
  }, [loader.sourceQuote]);

  function updateCargo(index: number, patch: Partial<AirCargoRow>) {
    setCargo((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function updateBreak(name: WeightBreakName, field: "sell" | "buy", value: number) {
    setBreaks((prev) => ({
      ...prev,
      [name]: { ...prev[name], sell: prev[name]?.sell ?? 0, buy: prev[name]?.buy ?? 0, [field]: value },
    }));
  }

  function applyTariff() {
    const originCode = origin.split(" - ")[0]?.trim().toUpperCase() || origin.trim().toUpperCase();
    const destCode =
      destination.split(" - ")[0]?.trim().toUpperCase() || destination.trim().toUpperCase();
    if (!originCode || !destCode) {
      setTariffMsg("Enter origin and destination airport codes first.");
      return;
    }
    const tariff = lookupAirTariff(tariffs, originCode, destCode);
    if (!tariff) {
      setTariffMsg(`No Circulars tariff for ${originCode} → ${destCode}. Enter rates manually.`);
      return;
    }
    setBreaks({ ...EMPTY_AIR_BREAKS, ...tariff.breaks });
    setCurrency(tariff.currency);
    setAirline(tariff.carrier);
    setTariffMsg(`Loaded ${tariff.carrier} rates from Circulars.`);
  }

  async function handleSave() {
    const err = validateAirDesk(deskInput);
    if (err) {
      setSaveMsg(err);
      return;
    }
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
          airline,
          routing,
          tt,
          validity,
          cargo,
          calc,
          breaks: breaks as Record<string, { sell: number; buy: number }>,
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
          <div className="flex items-center gap-2 text-[var(--color-atlas-air)]">
            <PlaneTakeoff className="h-5 w-5" />
            <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Air desk</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Full air freight quoting — cargo matrix, weight breaks, and carrier rates. Same core math
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
              Origin airport
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="BLR - Bengaluru"
              />
            </label>
            <label className="text-sm font-semibold">
              Destination airport
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="LHR - London Heathrow"
              />
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
            <label className="text-sm font-semibold md:col-span-2">
              Commodity
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
              />
            </label>
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

          <div>
            <h3 className="mb-2 font-bold">Weight breaks (sell / buy per kg)</h3>
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
                      className={`border-t ${calc.usedBreak === name ? "bg-amber-50" : ""}`}
                    >
                      <td className="px-3 py-2 font-semibold">
                        {BREAK_LABELS[name]}
                        {calc.usedBreak === name ? (
                          <Badge tone="warn">Active</Badge>
                        ) : null}
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          step="0.01"
                          className="w-24 rounded border px-2 py-1"
                          value={breaks[name]?.sell ?? ""}
                          onChange={(e) => updateBreak(name, "sell", Number(e.target.value))}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          step="0.01"
                          className="w-24 rounded border px-2 py-1"
                          value={breaks[name]?.buy ?? ""}
                          onChange={(e) => updateBreak(name, "buy", Number(e.target.value))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="font-bold text-[var(--color-atlas-navy)]">Carrier</h2>
            <label className="block text-sm font-semibold">
              Airline
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={airline}
                onChange={(e) => setAirline(e.target.value)}
                placeholder="EK - Emirates"
              />
            </label>
            <label className="block text-sm font-semibold">
              Routing
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={routing}
                onChange={(e) => setRouting(e.target.value)}
                placeholder="BLR-DXB-LHR"
              />
            </label>
            <label className="block text-sm font-semibold">
              Transit time
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={tt}
                onChange={(e) => setTt(e.target.value)}
                placeholder="3-4 days"
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
            <label className="block text-sm font-semibold">
              Pivot weight (kg, optional)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={pivotWeightKg || ""}
                onChange={(e) => setPivotWeightKg(Number(e.target.value))}
              />
            </label>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-bold text-[var(--color-atlas-navy)]">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Gross weight</dt>
                <dd className="font-bold">{calc.cargo.grossWeightKg.toFixed(2)} kg</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Volume weight</dt>
                <dd className="font-bold">{calc.cargo.volumeWeightKg.toFixed(2)} kg</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Chargeable</dt>
                <dd className="font-bold">{calc.chargeableWeightKg.toFixed(2)} kg</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Volume</dt>
                <dd>{calc.cargo.volumeCbm.toFixed(3)} CBM</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Packages</dt>
                <dd>{calc.cargo.packageQty}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Active break</dt>
                <dd className="font-bold">{BREAK_LABELS[calc.usedBreak]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Sell rate</dt>
                <dd>
                  {formatCurrency(calc.activeRate, currency)}/kg
                  {calc.usingBuyFallback ? " (buy fallback)" : ""}
                </dd>
              </div>
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
            {calc.isMinActive ? (
              <p className="text-xs font-semibold text-amber-800">Minimum charge applied.</p>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
