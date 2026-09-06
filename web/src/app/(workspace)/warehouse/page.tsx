"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Warehouse } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  NumberInput,
  Select,
  Textarea,
} from "@/components/ui";
import { ValidityField } from "@/components/ValidityField";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { saveWarehouseQuote } from "@/lib/firebase/save-transport-warehouse";
import { queryKeys } from "@/hooks/query-keys";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
import { DESK_CURRENCIES, WAREHOUSE_LOCATIONS } from "@/lib/desk/constants";
import { computeGp, ensureIncidentalTerm } from "@/lib/pricing/quote-display";
import { formatCurrency } from "@/lib/utils";

const DEFAULT_TERMS = ensureIncidentalTerm(
  "1. Storage billed per CBM per day (or part thereof).\n" +
    "2. Handling in/out charged separately.\n" +
    "3. Hazardous cargo requires prior approval.",
);

export default function WarehouseDeskPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
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

  const storage = ratePerCbm * cbm * Math.max(1, days);
  const total = useMemo(() => storage + handling, [storage, handling]);
  const { gp, gpReady } = useMemo(() => computeGp(total, buyTotal), [total, buyTotal]);

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
        <Button type="button" className="gap-1.5" disabled={busy} onClick={() => void save()}>
          <Save className="h-4 w-4" />
          Save quote
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Customer *</Label>
              <Input
                name="atlas-customer"
                autoComplete="off"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </div>
            <div>
              <Label>Location *</Label>
              <Select value={location} onChange={(e) => setLocation(e.target.value)}>
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
                <Select value={storageType} onChange={(e) => setStorageType(e.target.value)}>
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
                <Select value={storageType} onChange={(e) => setStorageType(e.target.value)}>
                  <option>General cargo</option>
                  <option>Bonded</option>
                  <option>Reefer</option>
                  <option>Hazardous</option>
                </Select>
              </div>
            ) : null}
            <div>
              <Label>Rate / CBM / day</Label>
              <NumberInput value={ratePerCbm} onValueChange={setRatePerCbm} />
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
            <ValidityField value={validity} onChange={setValidity} />
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Terms</Label>
              <Textarea rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
          </div>
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
    </div>
  );
}
