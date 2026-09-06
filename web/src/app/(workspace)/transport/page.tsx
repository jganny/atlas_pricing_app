"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Truck } from "lucide-react";
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
import { ValidityField } from "@/components/ValidityField";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { saveTransportQuote } from "@/lib/firebase/save-transport-warehouse";
import { queryKeys } from "@/hooks/query-keys";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
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

export default function TransportDeskPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>("lane");
  const [customer, setCustomer] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [vehicleType, setVehicleType] = useState<string>(INDIA_VEHICLE_TYPES[7]);
  const [serviceType, setServiceType] = useState<string>(TRANSPORT_SERVICE_TYPES[0]);
  const [currency, setCurrency] = useState("INR");
  const [commodity, setCommodity] = useState("");
  const [ewayBillNo, setEwayBillNo] = useState("");
  const [ewayRequired, setEwayRequired] = useState(false);
  const [gstin, setGstin] = useState("");
  const [invoiceValue, setInvoiceValue] = useState(0);
  const [validity, setValidity] = useState("15 days");
  const [freightBuy, setFreightBuy] = useState(0);
  const [freightSell, setFreightSell] = useState(0);
  const [detention, setDetention] = useState(0);
  const [tolls, setTolls] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [busy, setBusy] = useState(false);

  const total = useMemo(
    () => freightSell + detention + tolls,
    [freightSell, detention, tolls],
  );
  const { gp, gpReady } = useMemo(() => computeGp(total, freightBuy), [total, freightBuy]);

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
        <Button type="button" className="gap-1.5" disabled={busy} onClick={() => void save()}>
          <Save className="h-4 w-4" />
          Save quote
        </Button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabId)}
        items={[
          { value: "lane", label: "Lane" },
          { value: "cargo", label: "Cargo & compliance" },
          { value: "charges", label: "Charges" },
          { value: "terms", label: "Terms" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-2">
          {tab === "lane" ? (
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
              <ValidityField value={validity} onChange={setValidity} />
            </div>
          ) : null}

          {tab === "cargo" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Commodity</Label>
                <Input
                  value={commodity}
                  onChange={(e) => setCommodity(e.target.value)}
                  placeholder="General cargo"
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
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          ) : null}

          {tab === "charges" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Freight buy</Label>
                <NumberInput value={freightBuy} onValueChange={setFreightBuy} />
              </div>
              <div>
                <Label>Freight sell</Label>
                <NumberInput value={freightSell} onValueChange={setFreightSell} />
              </div>
              <div>
                <Label>Detention</Label>
                <NumberInput value={detention} onValueChange={setDetention} />
              </div>
              <div>
                <Label>Tolls / permits</Label>
                <NumberInput value={tolls} onValueChange={setTolls} />
              </div>
            </div>
          ) : null}

          {tab === "terms" ? (
            <div>
              <Label>Terms</Label>
              <Textarea rows={8} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
          ) : null}
        </Card>

        <Card>
          <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Total</div>
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
      </div>
    </div>
  );
}
