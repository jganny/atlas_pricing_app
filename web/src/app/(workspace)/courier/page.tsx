"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Package, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  calculateCourierFreight,
  SERVICE_LEVELS,
  type CourierPackageLine,
  type CourierServiceKey,
} from "@atlas/pricing-core";
import { Badge, Button, Card } from "@/components/ui";
import { QuotePreviewModal } from "@/components/QuotePreviewModal";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { fetchQuoteById } from "@/lib/firebase/quote-lifecycle";
import { DEFAULT_COURIER_TERMS, saveCourierQuote } from "@/lib/firebase/save-quote";
import { loadCourierDeskFromQuote } from "@/lib/quotes/desk-loader";
import { queryKeys } from "@/hooks/query-keys";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
import { useQuoteDeskLoader } from "@/hooks/use-quote-desk-loader";
import { toast } from "@/components/Toast";
import type { SavedQuote } from "@/lib/types";
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

type Tab = "shipment" | "packages" | "surcharges" | "terms";

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
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const loader = useQuoteDeskLoader();
  const [tab, setTab] = useState<Tab>("shipment");
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
  const [packages, setPackages] = useState<CourierPackageLine[]>([
    { qty: 1, gw: 5, l: 30, w: 20, h: 15 },
  ]);
  const [surcharges, setSurcharges] = useState(defaultSurcharges);
  const [terms, setTerms] = useState(DEFAULT_COURIER_TERMS);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [previewQuote, setPreviewQuote] = useState<SavedQuote | null>(null);

  useEffect(() => {
    if (!loader.sourceQuote) return;
    const loaded = loadCourierDeskFromQuote(loader.sourceQuote);
    setCustomer(loaded.customer);
    setOriginCity(loaded.originCity);
    setDestCity(loaded.destCity);
    setOriginCountry(loaded.originCountry);
    setDestCountry(loaded.destCountry);
    setScope(loaded.scope);
    setService(loaded.service as CourierServiceKey);
    setCurrency(loaded.currency);
    setMarginPct(loaded.marginPct);
    setSelectedCarrier(loaded.selectedCarrier);
    setGstEnabled(loaded.gstEnabled);
    setPackages(loaded.packages);
    setSurcharges(loaded.surcharges);
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

  function updatePkg(index: number, patch: Partial<CourierPackageLine>) {
    setPackages((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function resetDesk() {
    if (!window.confirm("Reset courier desk to defaults? Unsaved changes will be lost.")) return;
    setCustomer("");
    setOriginCity("");
    setDestCity("");
    setOriginCountry("IN");
    setDestCountry("IN");
    setScope("domestic");
    setService("economy");
    setCurrency("INR");
    setMarginPct(12);
    setSelectedCarrier("dhl");
    setGstEnabled(true);
    setPackages([{ qty: 1, gw: 5, l: 30, w: 20, h: 15 }]);
    setSurcharges(defaultSurcharges);
    setTerms(DEFAULT_COURIER_TERMS);
    setSaveMsg(null);
  }

  const handleSave = useCallback(
    async (openPreview = false) => {
      if (!customer.trim()) {
        const msg = "Enter customer name before saving.";
        setSaveMsg(msg);
        toast(msg, "error");
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
            termsAndConditions: terms,
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
          const msg = "Mock mode — save disabled. Switch to live Firebase or use legacy app.";
          setSaveMsg(msg);
          toast(msg, "info");
        }
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
      scope,
      service,
      currency,
      marginPct,
      gstEnabled,
      result,
      terms,
      loader.editingQuoteId,
      loader.editingQuoteNumber,
      loader.editingStatus,
      loader.isEditing,
      queryClient,
    ],
  );

  useDeskSaveShortcut(() => void handleSave(), !saving);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "shipment", label: "Shipment" },
    { id: "packages", label: "Packages" },
    { id: "surcharges", label: "Rates & surcharges" },
    { id: "terms", label: "Terms" },
  ];

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
            4-tab flow — shipment, packages, surcharges, terms. Same math as legacy. Press ⌘S to save.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={resetDesk}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
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

      {saveMsg ? (
        <Card className={saveMsg.includes("Saved") || saveMsg.includes("Amended") ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
          <p className="text-sm font-semibold">{saveMsg}</p>
        </Card>
      ) : null}

      {result.oversized ? (
        <Card className="border-amber-300 bg-amber-50">
          <p className="text-sm font-semibold text-amber-900">
            Oversized piece detected — enable oversized handling surcharge if applicable.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === t.id
                ? "bg-[var(--color-atlas-navy)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          {tab === "shipment" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold md:col-span-2">
                Customer
                <input className="mt-1 w-full rounded-lg border px-3 py-2" value={customer} onChange={(e) => setCustomer(e.target.value)} />
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
          ) : null}

          {tab === "surcharges" ? (
            <div className="space-y-3">
              <label className="text-sm font-semibold">
                Fuel surcharge %
                <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={surcharges.fuelPct} onChange={(e) => setSurcharges((s) => ({ ...s, fuelPct: Number(e.target.value) }))} />
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
                <input type="checkbox" checked={gstEnabled} onChange={(e) => setGstEnabled(e.target.checked)} />
                Apply GST (18%)
              </label>
            </div>
          ) : null}

          {tab === "terms" ? (
            <label className="block text-sm font-semibold">
              Terms & conditions
              <textarea
                className="mt-2 min-h-64 w-full rounded-lg border px-3 py-2 text-sm"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
              <button type="button" className="mt-2 text-xs font-semibold text-sky-700 hover:underline" onClick={() => setTerms(DEFAULT_COURIER_TERMS)}>
                Restore default terms
              </button>
            </label>
          ) : null}
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
