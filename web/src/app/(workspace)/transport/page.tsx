"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Truck } from "lucide-react";
import { Badge, Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { saveTransportQuote } from "@/lib/firebase/save-transport-warehouse";
import { queryKeys } from "@/hooks/query-keys";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
import { formatCurrency } from "@/lib/utils";

const DEFAULT_TERMS =
  "1. Rates exclude detention beyond free hours unless stated.\n" +
  "2. Tolls and permits as incurred unless lump-sum.\n" +
  "3. Transit times are estimates only.";

export default function TransportDeskPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [customer, setCustomer] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [vehicleType, setVehicleType] = useState("32ft container");
  const [currency, setCurrency] = useState("INR");
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
  const gp = total - freightBuy;

  async function save() {
    if (!customer.trim() || !origin.trim() || !destination.trim()) {
      toast("Customer, origin and destination are required", "error");
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
              currency,
              freightBuy,
              freightSell,
              detention,
              tolls,
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Customer *</Label>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </div>
            <div>
              <Label>Origin *</Label>
              <Input value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </div>
            <div>
              <Label>Destination *</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
            </div>
            <div>
              <Label>Vehicle</Label>
              <Select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                <option>20ft container</option>
                <option>32ft container</option>
                <option>Trailer</option>
                <option>Tempo</option>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option>INR</option>
                <option>USD</option>
              </Select>
            </div>
            <div>
              <Label>Freight buy</Label>
              <Input
                type="number"
                value={freightBuy}
                onChange={(e) => setFreightBuy(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Freight sell</Label>
              <Input
                type="number"
                value={freightSell}
                onChange={(e) => setFreightSell(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Detention</Label>
              <Input
                type="number"
                value={detention}
                onChange={(e) => setDetention(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Tolls / permits</Label>
              <Input
                type="number"
                value={tolls}
                onChange={(e) => setTolls(Number(e.target.value) || 0)}
              />
            </div>
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
          <div className="mt-3 text-sm">
            GP{" "}
            <span className="font-bold text-emerald-700">
              {formatCurrency(gp, currency)}
            </span>
          </div>
          <p className="mt-4 text-xs text-[var(--color-text-muted)]">⌘S to save</p>
        </Card>
      </div>
    </div>
  );
}
