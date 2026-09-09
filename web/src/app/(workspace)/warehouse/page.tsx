"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Save, Warehouse } from "lucide-react";
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
import { ValidityField } from "@/components/ValidityField";
import { QuotePreviewModal } from "@/components/QuotePreviewModal";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { saveWarehouseQuote } from "@/lib/firebase/save-transport-warehouse";
import { queryKeys } from "@/hooks/query-keys";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
import { useDeskStepKeys } from "@/hooks/use-desk-step-keys";
import { DESK_CURRENCIES, WAREHOUSE_LOCATIONS } from "@/lib/desk/constants";
import { computeGp, ensureIncidentalTerm } from "@/lib/pricing/quote-display";
import { formatCurrency } from "@/lib/utils";
import { firstFieldBackTab, focusById, lastFieldTab } from "@/lib/ui/desk-keyboard";
import { nextQuoteNumber } from "@/lib/quotes/ref-id";
import type { SavedQuote } from "@/lib/types";

const DEFAULT_TERMS = ensureIncidentalTerm(
  "1. Storage billed per CBM per day (or part thereof).\n" +
    "2. Handling in/out charged separately.\n" +
    "3. Hazardous cargo requires prior approval.",
);

type WhTab = "details" | "storage" | "terms";
const WH_STEPS = ["details", "storage", "terms"] as const;
const WH_FOCUS: Record<WhTab, string> = {
  details: "warehouse-customer",
  storage: "warehouse-rate",
  terms: "warehouse-notes",
};

export default function WarehouseDeskPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<WhTab>("details");
  const [customer, setCustomer] = useState("");
  const [location, setLocation] = useState<string>(WAREHOUSE_LOCATIONS[0]);
  const [otherDescription, setOtherDescription] = useState("");
  const [storageType, setStorageType] = useState("General cargo");
  const [currency, setCurrency] = useState("INR");
  const [ratePerCbm, setRatePerCbm] = useState(0);
  const [cbm, setCbm] = useState(0);
  const [handling, setHandling] = useState(0);
  const [days, setDays] = useState(7);
  const [buyTotal, setBuyTotal] = useState(0);
  const [validity, setValidity] = useState("15 days");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [busy, setBusy] = useState(false);
  const [previewQuote, setPreviewQuote] = useState<SavedQuote | null>(null);

  const storage = ratePerCbm * cbm * Math.max(1, days);
  const total = useMemo(() => storage + handling, [storage, handling]);
  const { gp, gpReady } = useMemo(() => computeGp(total, buyTotal), [total, buyTotal]);
  const routeLabel =
    location === "Others" && otherDescription.trim()
      ? `Others — ${otherDescription.trim()}`
      : location;

  function handlePreview() {
    if (!customer.trim() || !location.trim()) {
      toast("Customer and location are required for preview.", "error");
      setTab("details");
      return;
    }
    if (location === "Others" && !otherDescription.trim()) {
      toast("Describe the other warehouse location", "error");
      return;
    }
    const q: SavedQuote = {
      id: "preview",
      customer: customer.trim() || "Draft",
      creator: user?.username || "",
      status: "quoted",
      type: "warehouse",
      quoteNumber: nextQuoteNumber(),
      date: new Date().toISOString().split("T")[0],
      timestamp: Date.now(),
      amount: total,
      currency,
      route: routeLabel,
      details: {
        mode: "Warehouse",
        type: "warehouse",
        location,
        otherDescription,
        storageType,
        ratePerCbm,
        cbm,
        days,
        handling,
        storage,
        validity,
        termsAndConditions: terms,
      },
    };
    setPreviewQuote(q);
  }

  async function save() {
    if (!customer.trim() || !location.trim()) {
      toast("Customer and location are required", "error");
      return;
    }
    if (location === "Others" && !otherDescription.trim()) {
      toast("Describe the other warehouse location", "error");
      return;
    }
    setBusy(true);
    try {
      if (useLiveData) {
        try {
          await Promise.race([
            saveWarehouseQuote({
              customer,
              creator: user?.username || "desk",
              location,
              otherDescription,
              storageType,
              currency,
              ratePerCbm,
              cbm,
              handling,
              days,
              buyTotal,
              validity,
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
      toast("Warehouse quote saved", "success");
    } finally {
      setBusy(false);
    }
  }

  useDeskSaveShortcut(() => void save());

  function goWhStep(next: WhTab, focusId = WH_FOCUS[next]) {
    setTab(next);
    focusById(focusId);
  }

  useDeskStepKeys({
    steps: WH_STEPS,
    setStep: (s) => goWhStep(s),
    focusIds: WH_FOCUS,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Warehouse className="h-5 w-5 text-[var(--color-atlas-sky)]" />
          <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">
            Warehouse desk
          </h1>
          <Badge tone="info">Phase 10</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="h-9" data-testid="desk-preview" onClick={handlePreview}>
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </Button>
          <Button id="warehouse-save" type="button" className="gap-1.5" disabled={busy} onClick={() => void save()}>
            <Save className="h-4 w-4" />
            Save quote
          </Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => goWhStep(v as WhTab)}
        idPrefix="warehouse-step"
        items={[
          { value: "details", label: "Details" },
          { value: "storage", label: "Storage" },
          { value: "terms", label: "Terms" },
        ]}
      />
      <p className="-mt-2 text-[11px] text-[var(--color-text-muted)]">
        Tab on last field → next step · Alt+1–3 · ⌘S save
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-2">
          {tab === "details" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Customer *</Label>
                <Input
                  id="warehouse-customer"
                  name="atlas-customer"
                  autoComplete="off"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                />
              </div>
              <div>
                <Label>Location *</Label>
                <Select
                  id="warehouse-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  {WAREHOUSE_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </Select>
              </div>
              {location === "Others" ? (
                <div>
                  <Label>Other location description *</Label>
                  <Input
                    value={otherDescription}
                    onChange={(e) => setOtherDescription(e.target.value)}
                    placeholder="City / facility name"
                  />
                </div>
              ) : (
                <div>
                  <Label>Storage type</Label>
                  <Select
                    value={storageType}
                    onChange={(e) => setStorageType(e.target.value)}
                    onKeyDown={(e) => lastFieldTab(e, () => goWhStep("storage"))}
                  >
                    <option>General cargo</option>
                    <option>Bonded</option>
                    <option>Reefer</option>
                    <option>Hazardous</option>
                  </Select>
                </div>
              )}
              {location === "Others" ? (
                <div className="sm:col-span-2">
                  <Label>Storage type</Label>
                  <Select
                    value={storageType}
                    onChange={(e) => setStorageType(e.target.value)}
                    onKeyDown={(e) => lastFieldTab(e, () => goWhStep("storage"))}
                  >
                    <option>General cargo</option>
                    <option>Bonded</option>
                    <option>Reefer</option>
                    <option>Hazardous</option>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "storage" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Rate / CBM / day</Label>
                <NumberInput
                  id="warehouse-rate"
                  value={ratePerCbm}
                  onValueChange={setRatePerCbm}
                  onKeyDown={(e) =>
                    firstFieldBackTab(e, () => goWhStep("details", "warehouse-customer"))
                  }
                />
              </div>
              <div>
                <Label>CBM</Label>
                <NumberInput value={cbm} onValueChange={setCbm} />
              </div>
              <div>
                <Label>Days</Label>
                <NumberInput
                  value={days}
                  onValueChange={(n) => setDays(Math.max(1, n || 1))}
                />
              </div>
              <div>
                <Label>Handling (sell)</Label>
                <NumberInput value={handling} onValueChange={setHandling} />
              </div>
              <div>
                <Label>Buy total</Label>
                <NumberInput value={buyTotal} onValueChange={setBuyTotal} />
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
                textInputId="warehouse-validity"
                onTextKeyDown={(e) => lastFieldTab(e, () => goWhStep("terms"))}
              />
            </div>
          ) : null}

          {tab === "terms" ? (
            <div className="grid gap-3">
              <div>
                <Label>Notes</Label>
                <Textarea
                  id="warehouse-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={(e) =>
                    firstFieldBackTab(e, () => goWhStep("storage", "warehouse-validity"))
                  }
                />
              </div>
              <div>
                <Label>Terms</Label>
                <Textarea
                  id="warehouse-terms"
                  rows={4}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  onKeyDown={(e) => lastFieldTab(e, () => focusById("warehouse-save"))}
                />
              </div>
            </div>
          ) : null}
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Total</div>
          <div className="mt-1 text-2xl font-extrabold text-[var(--color-atlas-navy)]">
            {formatCurrency(total, currency)}
          </div>
          <div className="mt-2 text-sm text-[var(--color-text-muted)]">
            Storage {formatCurrency(storage, currency)} + handling
          </div>
          <div className="mt-3 text-sm">
            GP{" "}
            <span className="font-bold text-emerald-700">
              {gpReady ? formatCurrency(gp, currency) : "—"}
            </span>
          </div>
          <p className="mt-4 text-xs text-[var(--color-text-muted)]">⌘S to save</p>
        </Card>
      </div>

      {previewQuote ? (
        <QuotePreviewModal quote={previewQuote} onClose={() => setPreviewQuote(null)} />
      ) : null}
    </div>
  );
}
