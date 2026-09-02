"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Save, Trash2 } from "lucide-react";
import {
  calculateCourierFreight,
  SERVICE_LEVELS,
  type CourierPackageLine,
  type CourierServiceKey,
} from "@atlas/pricing-core";
import { Badge, Button, Card } from "@/components/ui";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { saveCourierQuote } from "@/lib/firebase/save-quote";
import { queryKeys } from "@/hooks/query-keys";
import { formatCurrency } from "@/lib/utils";

const COUNTRIES = ["IN", "AE", "US", "GB", "DE", "SG", "AU", "CN", "HK", "CA", "FR"];

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

export default function CourierDeskPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [customer, setCustomer] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [destCity, setDestCity] = useState("");
  const [originCountry, setOriginCountry] = useState("IN");
  const [destCountry, setDestCountry] = useState("IN");
  const [scope, setScope] = useState<"domestic" | "international">("domestic");
  const [service, setService] = useState<CourierServiceKey>("economy");
  const [currency, setCurrency] = useState("INR");
  const [marginPct, setMarginPct] = useState(12);
  const [selectedCarrier, setSelectedCarrier] = useState("dhl");
  const [gstEnabled, setGstEnabled] = useState(true);
  const [packages, setPackages] = useState<CourierPackageLine[]>([{ qty: 1, gw: 5, l: 30, w: 20, h: 15 }]);
  const [surcharges, setSurcharges] = useState(defaultSurcharges);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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

  const oversized = result.oversized;

  function updatePkg(index: number, patch: Partial<CourierPackageLine>) {
    setPackages((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function handleSave() {
    if (!customer.trim()) {
      setSaveMsg("Enter customer name before saving.");
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      if (useLiveData && user) {
        const id = await saveCourierQuote({
          customer: customer.trim(),
          creator: user.username,
          originCity,
          destCity,
          originCountry,
          destCountry,
          scope,
          service,
          currency,
          marginPct,
          gstEnabled,
          packages: result.packages,
          calc: result,
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.enquiries });
        setSaveMsg(`Saved to Firestore · quote ${id}`);
      } else {
        setSaveMsg("Mock mode — save disabled. Switch to live Firebase or use legacy app.");
      }
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-violet-600">
            <Package className="h-5 w-5" />
            <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Courier desk</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Express parcel quoting — same math as legacy courier-desk.js.{" "}
            {useLiveData ? "Save writes to quotes collection." : "Mock mode — preview only."}
          </p>
        </div>
        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save quote"}
        </Button>
      </div>

      {saveMsg ? (
        <Card className={saveMsg.includes("Saved") ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
          <p className="text-sm font-semibold">{saveMsg}</p>
        </Card>
      ) : null}

      {oversized ? (
        <Card className="border-amber-300 bg-amber-50">
          <p className="text-sm font-semibold text-amber-900">
            Oversized piece detected — enable oversized handling surcharge if applicable.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 space-y-4">
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
              Origin city
              <input className="mt-1 w-full rounded-lg border px-3 py-2" value={originCity} onChange={(e) => setOriginCity(e.target.value)} />
            </label>
            <label className="text-sm font-semibold">
              Destination city
              <input className="mt-1 w-full rounded-lg border px-3 py-2" value={destCity} onChange={(e) => setDestCity(e.target.value)} />
            </label>
            <label className="text-sm font-semibold">
              Origin country
              <select className="mt-1 w-full rounded-lg border px-3 py-2" value={originCountry} onChange={(e) => setOriginCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Destination country
              <select className="mt-1 w-full rounded-lg border px-3 py-2" value={destCountry} onChange={(e) => setDestCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Scope
              <select className="mt-1 w-full rounded-lg border px-3 py-2" value={scope} onChange={(e) => setScope(e.target.value as "domestic" | "international")}>
                <option value="domestic">Domestic</option>
                <option value="international">International</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Service
              <select className="mt-1 w-full rounded-lg border px-3 py-2" value={service} onChange={(e) => setService(e.target.value as CourierServiceKey)}>
                {Object.entries(SERVICE_LEVELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Currency
              <select className="mt-1 w-full rounded-lg border px-3 py-2" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Margin %
              <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={marginPct} onChange={(e) => setMarginPct(Number(e.target.value))} />
            </label>
          </div>

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
                      <td className="p-1"><input type="number" className="w-14 rounded border px-1 py-1" value={p.qty} onChange={(e) => updatePkg(i, { qty: Number(e.target.value) })} /></td>
                      <td className="p-1"><input type="number" className="w-16 rounded border px-1 py-1" value={p.gw ?? ""} onChange={(e) => updatePkg(i, { gw: Number(e.target.value) })} /></td>
                      <td className="p-1"><input type="number" className="w-14 rounded border px-1 py-1" value={p.l ?? ""} onChange={(e) => updatePkg(i, { l: Number(e.target.value) })} /></td>
                      <td className="p-1"><input type="number" className="w-14 rounded border px-1 py-1" value={p.w ?? ""} onChange={(e) => updatePkg(i, { w: Number(e.target.value) })} /></td>
                      <td className="p-1"><input type="number" className="w-14 rounded border px-1 py-1" value={p.h ?? ""} onChange={(e) => updatePkg(i, { h: Number(e.target.value) })} /></td>
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
        </Card>

        <Card className="space-y-3">
          <h2 className="font-bold text-[var(--color-atlas-navy)]">Summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Chargeable</dt><dd className="font-bold">{result.chargeableKg.toFixed(2)} kg</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Zone</dt><dd className="font-bold">{result.zone}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Carrier</dt><dd className="font-bold">{result.chosen?.name ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Base freight</dt><dd>{formatCurrency(result.baseFreight, currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Surcharges</dt><dd>{formatCurrency(result.surcharges.total, currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">GST (18%)</dt><dd>{formatCurrency(result.tax, currency)}</dd></div>
            <div className="flex justify-between border-t pt-2 text-base"><dt className="font-bold">Grand total</dt><dd className="font-extrabold text-emerald-700">{formatCurrency(result.total, currency)}</dd></div>
          </dl>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={gstEnabled} onChange={(e) => setGstEnabled(e.target.checked)} />
            Apply GST (18%)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={surcharges.insurance} onChange={(e) => setSurcharges((s) => ({ ...s, insurance: e.target.checked }))} />
            Cargo insurance
          </label>
          <label className="text-sm font-semibold">
            Fuel surcharge %
            <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={surcharges.fuelPct} onChange={(e) => setSurcharges((s) => ({ ...s, fuelPct: Number(e.target.value) }))} />
          </label>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-bold">Carrier comparison</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {result.quotes.map((q, idx) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setSelectedCarrier(q.id)}
              className={`rounded-xl border p-3 text-left transition-colors ${selectedCarrier === q.id ? "border-[var(--color-atlas-navy)] bg-slate-50 ring-2 ring-[var(--color-atlas-navy)]/20" : "border-[var(--color-border)] hover:bg-slate-50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone="neutral">#{idx + 1}</Badge>
                {selectedCarrier === q.id ? <Badge tone="success">Selected</Badge> : null}
              </div>
              <div className="mt-1 font-bold" style={{ color: q.color }}>{q.name}</div>
              <div className="text-lg font-extrabold">{formatCurrency(q.sellLocal, currency)}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{q.transit} · ${q.ratePerKg.toFixed(2)}/kg</div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
