"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, RotateCcw, Save, Ship, Trash2, Zap } from "lucide-react";
import type { SeaMode } from "@atlas/pricing-core";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Label, NumberInput, Select, Tabs, Textarea } from "@/components/ui";
import { DeskSmartQuoteStrip } from "@/components/DeskSmartQuoteStrip";
import { DeskResetDialog } from "@/components/DeskResetDialog";
import { SurchargeTable } from "@/components/desks/SurchargeTable";
import { QuotePreviewModal } from "@/components/QuotePreviewModal";
import { VendorCompareList } from "@/components/VendorCompareList";
import { GuideNote } from "@/components/GuideNote";
import { vendorRowsFromEntries } from "@/lib/quotes/vendor-preview";
import { LaneChips, newLane, type QuoteLane } from "@/components/LaneChips";
import { LocationCombobox } from "@/components/LocationCombobox";
import { ValidityField } from "@/components/ValidityField";
import { DESK_CURRENCIES } from "@/lib/desk/constants";
import { TariffIntelHint } from "@/components/TariffIntelHint";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { defaultDeskCurrency, defaultIncoterm } from "@/lib/auth/desk-rules";
import { cacheOfflineQuote } from "@/lib/quotes/offline-cache";
import { appendCalcAudit } from "@/lib/quotes/calc-audit";
import { persistQuoteToEnquiryDb, savedEnquiryHref, savedEnquiryMessage } from "@/lib/quotes/persist-enquiry";
import { linerSnapshot } from "@/lib/quotes/option-breakdown";
import { useLiveData } from "@/lib/api";
import { saveSeaQuote } from "@/lib/firebase/save-quote";
import { lookupSeaTariff } from "@/lib/firebase/tariffs";
import { createLinerOption, type LinerOption } from "@/lib/pricing/carrier-options";
import { CarrierCombobox } from "@/components/CarrierCombobox";
import { CommodityCombobox } from "@/components/CommodityCombobox";
import { seaShipmentSchema } from "@/lib/pricing/desk-schemas";
import {
  computeLinerTotals,
  seaHeavyWeightWarning,
  validateSeaCargoBasics,
  validateSelectedLiner,
  type SeaContainerRow,
} from "@/lib/pricing/sea-desk";
import {
  formatRoutingPreview,
  formatTransitPreview,
  getDefaultFreightTerms,
  normalizeRouting,
} from "@/lib/pricing/terms";
import { loadSeaDeskFromQuote } from "@/lib/quotes/desk-loader";
import { clearSmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";
import { useSeaTariffs } from "@/hooks/use-atlas-data";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
import { useDeskStepKeys } from "@/hooks/use-desk-step-keys";
import { lastFieldTab } from "@/lib/ui/desk-keyboard";
import { useQuoteDeskLoader } from "@/hooks/use-quote-desk-loader";
import type { SavedQuote, SmartQuoteDraft } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { nextQuoteNumber } from "@/lib/quotes/ref-id";
import {
  allLanesRoute,
  laneRouteLabel,
  quotedLaneRows,
  quotedOnLane,
  selectWithinLane,
  usableLanes,
} from "@/lib/quotes/lanes";

const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];
const CONTAINER_TYPES = ["20'GP", "40'GP", "40'HC", "45'HC", "20'RF", "40'RF"];
type Step = "shipment" | "carrier" | "terms";
const SEA_STEPS = ["shipment", "carrier", "terms"] as const;

export default function SeaDeskPage() {
  return (
    <Suspense fallback={<Card className="p-6 text-sm text-[var(--color-text-muted)]">Loading sea desk…</Card>}>
      <SeaDeskInner />
    </Suspense>
  );
}

function SeaDeskInner() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: tariffs = [] } = useSeaTariffs();
  const loader = useQuoteDeskLoader("sea");

  const [step, setStep] = useState<Step>("shipment");
  const [customer, setCustomer] = useState("");
  const [lanes, setLanes] = useState<QuoteLane[]>(() => [newLane()]);
  const [activeLaneId, setActiveLaneId] = useState("");
  const activeLane = lanes.find((l) => l.id === (activeLaneId || lanes[0]?.id)) ?? lanes[0];
  const origin = activeLane?.origin ?? "";
  const destination = activeLane?.destination ?? "";
  function setOrigin(next: string) {
    const id = activeLane?.id;
    if (!id) return;
    setLanes((prev) => prev.map((l) => (l.id === id ? { ...l, origin: next } : l)));
  }
  function setDestination(next: string) {
    const id = activeLane?.id;
    if (!id) return;
    setLanes((prev) => prev.map((l) => (l.id === id ? { ...l, destination: next } : l)));
  }
  const [currency, setCurrency] = useState("USD");
  const [incoterm, setIncoterm] = useState("FOB");
  const [commodity, setCommodity] = useState("GENERAL");
  const [module, setModule] = useState<"export" | "import">("export");
  const [mode, setMode] = useState<SeaMode>("fcl");
  const [grossWeightKg, setGrossWeightKg] = useState(0);
  const [volumeCbm, setVolumeCbm] = useState(0);
  const [chargeableCbmOverride, setChargeableCbmOverride] = useState(0);
  const [customFx, setCustomFx] = useState(0);
  const [liners, setLiners] = useState<LinerOption[]>([createLinerOption({}, true)]);
  const [terms, setTerms] = useState(getDefaultFreightTerms("sea"));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveEnquiryPath, setSaveEnquiryPath] = useState<string | null>(null);
  const [previewQuote, setPreviewQuote] = useState<SavedQuote | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [stripKey, setStripKey] = useState(0);
  const prefillApplied = useRef(false);

  useEffect(() => {
    if (!activeLaneId && lanes[0]) setActiveLaneId(lanes[0].id);
  }, [activeLaneId, lanes]);

  useEffect(() => {
    if (prefillApplied.current || loader.sourceQuote) return;
    if (!loader.prefillOrigin && !loader.prefillDest && !loader.prefillCustomer) return;
    if (loader.prefillCustomer) setCustomer(loader.prefillCustomer);
    const id = activeLane?.id || lanes[0]?.id;
    if (!id) {
      if (loader.prefillCustomer) prefillApplied.current = true;
      return;
    }
    prefillApplied.current = true;
    setLanes((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              origin: loader.prefillOrigin || l.origin,
              destination: loader.prefillDest || l.destination,
            }
          : l,
      ),
    );
  }, [loader.prefillOrigin, loader.prefillDest, loader.prefillCustomer, loader.sourceQuote, activeLane?.id, lanes]);

  useEffect(() => {
    if (loader.sourceQuote || loader.smartPrefill) return;
    setCurrency(defaultDeskCurrency(user?.username));
    setIncoterm(defaultIncoterm(user?.username));
  }, [user?.username, loader.sourceQuote, loader.smartPrefill]);

  const selected =
    quotedOnLane(liners, activeLane?.id, lanes[0]?.id || "") ??
    liners.find((l) => l.selected) ??
    liners[0];

  const totalsById = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeLinerTotals>> = {};
    for (const l of liners) {
      map[l.id] = computeLinerTotals(mode, grossWeightKg, volumeCbm, chargeableCbmOverride, l);
    }
    return map;
  }, [liners, mode, grossWeightKg, volumeCbm, chargeableCbmOverride]);

  const selectedTotals = selected ? totalsById[selected.id] : null;
  const quotedLanes = useMemo(
    () => quotedLaneRows(lanes, liners, (l) => totalsById[l.id]?.grandSell ?? 0),
    [lanes, liners, totalsById],
  );
  const allLanesQuotedTotal = useMemo(
    () => quotedLanes.reduce((sum, lane) => sum + lane.amount, 0),
    [quotedLanes],
  );
  const cheapestLinerId = useMemo(() => {
    const priced = liners.filter((l) => (totalsById[l.id]?.grandSell ?? 0) > 0);
    const sorted = [...priced].sort(
      (a, b) => (totalsById[a.id]?.grandSell ?? 0) - (totalsById[b.id]?.grandSell ?? 0),
    );
    return sorted[0]?.id ?? null;
  }, [liners, totalsById]);
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
    const lane = newLane({ origin: loaded.origin, destination: loaded.destination });
    setLanes([lane]);
    setActiveLaneId(lane.id);
    if (loaded.terms) setTerms(loaded.terms);
  }, [loader.sourceQuote]);

  useEffect(() => {
    if (!loader.smartPrefill) return;
    applySmartDraft({
      parsed: loader.smartPrefill.parsed,
      tariffFound: loader.smartPrefill.tariffFound,
      carrierLabel: loader.smartPrefill.carrierLabel,
      currency: loader.smartPrefill.currency,
      seaTariff: loader.smartPrefill.seaTariff,
      message: "Prefill from Smart Quote / Inbox",
    });
    clearSmartQuotePrefill();
  }, [loader.smartPrefill]);

  function applySmartDraft(draft: SmartQuoteDraft) {
    const p = draft.parsed;
    const st = draft.seaTariff;
    setCustomer(p.customer || "");
    setOrigin(p.origin || "");
    setDestination(p.destination || "");
    if (p.incoterm) setIncoterm(p.incoterm);
    if (p.mode) setMode(p.mode);
    else if (st?.mode) setMode(st.mode);
    if (draft.currency || st?.currency) {
      setCurrency(draft.currency || st?.currency || "USD");
    }
    if (p.grossWeight) setGrossWeightKg(p.grossWeight);
    if (p.volume) setVolumeCbm(p.volume);
    const containers = p.containers.length
      ? p.containers.map((c) => ({
          type: c.type,
          qty: c.qty,
          sellRate: st?.fclRates?.[c.type]?.sell ?? 0,
          buyRate: st?.fclRates?.[c.type]?.buy ?? 0,
        }))
      : [{ type: "20'GP", qty: 1, sellRate: 0, buyRate: 0 }];
    setLiners([
      createLinerOption(
        {
          name: p.linerLabel || draft.carrierLabel || "",
          routing: p.origin && p.destination ? `${p.origin}-${p.destination}` : "",
          tt: "TBA",
          validity: "15 days",
          containers,
          lclSell: st?.lclRate?.sell ?? 0,
          lclBuy: st?.lclRate?.buy ?? 0,
        },
        true,
      ),
    ]);
    setStep("shipment");
  }

  function applyReset() {
    const lane = newLane();
    setCustomer("");
    setLanes([lane]);
    setActiveLaneId(lane.id);
    setCurrency(defaultDeskCurrency(user?.username));
    setIncoterm(defaultIncoterm(user?.username));
    setModule("export");
    setMode("fcl");
    setGrossWeightKg(0);
    setVolumeCbm(0);
    setChargeableCbmOverride(0);
    setCustomFx(0);
    setLiners([createLinerOption({ laneId: lane.id }, true)]);
    setTerms(getDefaultFreightTerms("sea"));
    setSaveMsg(null);
    setPreviewQuote(null);
    setStep("shipment");
    setConfirmReset(false);
    setStripKey((k) => k + 1);
    prefillApplied.current = false;
    loader.clearLoadedQuote();
    if (typeof window !== "undefined" && /[?&](edit|duplicate|smart)=/.test(window.location.search)) {
      router.replace("/sea/");
    }
    toast("Sea desk cleared", "success");
  }

  function updateLiner(id: string, patch: Partial<LinerOption>) {
    setLiners((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function selectLiner(id: string) {
    const fallback = activeLane?.id || lanes[0]?.id || "";
    setLiners((prev) => selectWithinLane(prev, id, fallback));
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

  const laneLiners = liners.filter(
    (l) => !l.laneId || l.laneId === (activeLane?.id || lanes[0]?.id),
  );

  const handlePreview = () => {
    const cargoErr = validateSeaCargoBasics(grossWeightKg, volumeCbm);
    const fallback = lanes[0]?.id || "";
    const completeLanes = usableLanes(lanes);
    const toCheck = completeLanes.length ? completeLanes : [activeLane].filter(Boolean);
    for (const lane of toCheck) {
      if (!lane) continue;
      const quoted = quotedOnLane(liners, lane.id, fallback);
      const linerErr = validateSelectedLiner(quoted, mode);
      if (linerErr) {
        toast(`${laneRouteLabel(lane, lanes.indexOf(lane))}: ${linerErr}`, "error");
        setActiveLaneId(lane.id);
        setStep("carrier");
        return;
      }
    }
    if (cargoErr || !selected || !selectedTotals) {
      toast(cargoErr || "Complete the quote before preview.", "error");
      return;
    }
    const originCode = origin.split(" - ")[0]?.trim() || origin.trim();
    const destCode = destination.split(" - ")[0]?.trim() || destination.trim();
    const amount = allLanesQuotedTotal || selectedTotals.grandSell;
    const fx = customFx > 0 ? customFx : 83.5;
    const linerLabel =
      quotedLanes.length > 1
        ? quotedLanes.map((l) => `${l.laneLabel}: ${l.airline || "—"}`).join(" · ")
        : selected.name;
    const q: SavedQuote = {
      id: loader.editingQuoteId || "preview",
      customer: customer.trim() || "Draft",
      creator: user?.username || "",
      status: loader.editingStatus || "quoted",
      type: "sea",
      quoteNumber: loader.editingQuoteNumber ?? nextQuoteNumber(),
      date: new Date().toISOString().split("T")[0],
      timestamp: Date.now(),
      amount,
      currency,
      amountINR: currency === "INR" ? amount : amount * fx,
      route: allLanesRoute(lanes) || `${originCode} → ${destCode} via ${selected.name || "Any"}`,
      details: {
        origin,
        destination,
        liner: linerLabel,
        shippingLine: selected.name,
        incoterm,
        module,
        commodity,
        type: mode,
        chargeableRt: selectedTotals.freight.chargeableRt,
        grossWeight: grossWeightKg,
        volumeCbm,
        baseFreight: selectedTotals.baseFreightQuote,
        originFeesTotal: selectedTotals.originTotal,
        destFeesTotal: selectedTotals.destTotal,
        routing: selected.routing,
        tt: selected.tt,
        validity: selected.validity,
        lanes: lanes.map((l) => ({ id: l.id, origin: l.origin, destination: l.destination })),
        quotedLanes,
        allLanesTotal: amount,
        liners: liners.map((l) =>
          linerSnapshot(l, mode, grossWeightKg, volumeCbm, chargeableCbmOverride, lanes, fallback),
        ),
        termsAndConditions: terms,
        mode: "Sea",
      },
    };
    setPreviewQuote(q);
  };

  const handleSave = useCallback(
    async () => {
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

      const quoteNumber = loader.editingQuoteNumber ?? nextQuoteNumber();
      const quoteId = loader.editingQuoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
      const amount = allLanesQuotedTotal || selectedTotals.grandSell;
      const fx = customFx > 0 ? customFx : 83.5;
      const fallback = lanes[0]?.id || "";
      const linerSnaps = liners.map((l) =>
        linerSnapshot(l, mode, grossWeightKg, volumeCbm, chargeableCbmOverride, lanes, fallback),
      );
      const localQuote: SavedQuote = {
        id: quoteId,
        customer: customer.trim(),
        creator: user?.username || "",
        status: loader.editingStatus || "quoted",
        type: "sea",
        quoteNumber,
        date: new Date().toISOString().split("T")[0],
        timestamp: Date.now(),
        amount,
        currency,
        amountINR: currency === "INR" ? amount : amount * fx,
        route: allLanesRoute(lanes) || `${origin} → ${destination}`,
        details: {
          origin,
          destination,
          liner:
            quotedLanes.length > 1
              ? quotedLanes.map((l) => `${l.laneLabel}: ${l.airline || "—"}`).join(" · ")
              : selected.name,
          shippingLine: selected.name,
          incoterm,
          module,
          commodity,
          type: mode,
          lanes: lanes.map((l) => ({ id: l.id, origin: l.origin, destination: l.destination })),
          quotedLanes,
          allLanesTotal: amount,
          liners: linerSnaps,
          termsAndConditions: terms,
          mode: "Sea",
        },
      };

      setSaving(true);
      setSaveMsg(null);
      let cloud: "live" | "local" | "cloud-failed" = "local";
      try {
        if (useLiveData && user) {
          try {
            await saveSeaQuote({
              customer: customer.trim(),
              creator: user.username,
              origin,
              destination,
              currency,
              incoterm,
              commodity,
              module,
              mode,
              grossWeightKg,
              volumeCbm,
              chargeableCbmOverride,
              selected,
              totals: selectedTotals,
              liners,
              termsAndConditions: terms,
              customExchangeRate: customFx || undefined,
              quoteId,
              quoteNumber,
              status: loader.editingStatus,
              lanes,
              quotedLanes,
              allLanesAmount: amount,
            });
            cloud = "live";
            cacheOfflineQuote({
              id: quoteId,
              type: "sea",
              customer: customer.trim(),
              payload: { origin, destination, currency, amount },
            });
            appendCalcAudit({
              quoteId,
              type: "sea",
              steps: [
                { label: "Chargeable RT", value: selectedTotals.freight.chargeableRt },
                { label: "Base freight", value: selectedTotals.baseFreightQuote },
                { label: "Origin fees", value: selectedTotals.originTotal },
                { label: "Dest fees", value: selectedTotals.destTotal },
                { label: "Grand sell", value: amount },
                { label: "Currency", value: currency },
              ],
            });
          } catch (e) {
            cloud = "cloud-failed";
            console.warn("Cloud save failed, kept local Enquiry DB row", e);
          }
        }
        const row = persistQuoteToEnquiryDb(localQuote, queryClient);
        const msg = savedEnquiryMessage(row, { cloud });
        setSaveMsg(msg);
        setSaveEnquiryPath(savedEnquiryHref(row));
        toast(msg, cloud === "cloud-failed" ? "info" : "success");
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
      mode,
      grossWeightKg,
      volumeCbm,
      chargeableCbmOverride,
      selected,
      selectedTotals,
      liners,
      terms,
      customFx,
      user,
      loader,
      queryClient,
      lanes,
      quotedLanes,
      allLanesQuotedTotal,
      totalsById,
    ],
  );

  useDeskSaveShortcut(() => void handleSave(), !saving);
  useDeskStepKeys({
    steps: SEA_STEPS,
    setStep,
  });

  return (
    <div className="space-y-3">
      {loader.banner ? (
        <Card className="border-sky-200 bg-sky-50 py-2">
          <p className="text-sm font-semibold text-sky-900">{loader.banner}</p>
        </Card>
      ) : null}

      <DeskSmartQuoteStrip key={stripKey} mode="sea" onApply={applySmartDraft} />

      <DeskResetDialog
        open={confirmReset}
        deskLabel="sea"
        onConfirm={applyReset}
        onCancel={() => setConfirmReset(false)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[var(--color-atlas-sea)]">
          <Ship className="h-5 w-5" />
          <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Sea desk</h1>
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
          <Button type="button" variant="secondary" className="h-9" data-testid="desk-preview" onClick={handlePreview}>
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
        <Card className="border-amber-300 bg-amber-50 py-2">
          <p className="text-sm font-semibold text-amber-900">{heavyWarn}</p>
        </Card>
      ) : null}

      <Tabs
        value={step}
        onValueChange={(v) => setStep(v as Step)}
        idPrefix="sea-step"
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{saveMsg}</p>
            {saveEnquiryPath ? (
              <Button type="button" variant="secondary" className="h-8" onClick={() => router.push(saveEnquiryPath)}>
                Open Enquiry DB
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {step === "shipment" ? (
            <Card className="space-y-3 py-3">
              <h2 className="font-bold text-[var(--color-atlas-navy)]">Shipment</h2>
              <LaneChips
                lanes={lanes}
                activeId={activeLane?.id || lanes[0]?.id || ""}
                onSelect={setActiveLaneId}
                onAdd={() => {
                  const lane = newLane();
                  setLanes((prev) => [...prev, lane]);
                  setActiveLaneId(lane.id);
                  setLiners((prev) => [...prev, createLinerOption({ laneId: lane.id }, true)]);
                }}
                onRemove={(id) => {
                  setLanes((prev) => {
                    const next = prev.filter((l) => l.id !== id);
                    return next.length ? next : prev;
                  });
                  setLiners((prev) => prev.filter((l) => l.laneId !== id));
                  if (activeLaneId === id && lanes[0]) setActiveLaneId(lanes[0].id);
                }}
              />
              <p className="text-xs text-[var(--color-text-muted)]">
                One lane is POL → POD. Add a lane for extra port pairs. Liners and coloading
                options sit on the selected lane.
              </p>
              <TariffIntelHint
                mode="sea"
                origin={origin}
                destination={destination}
                tariffCount={tariffs.length}
              />
              <div className="grid gap-2 md:grid-cols-2">
                <Label className="md:col-span-2">
                  Customer
                  <Input
                    name="atlas-customer"
                    autoComplete="off"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="Customer name"
                  />
                </Label>
                <LocationCombobox
                  label="POL (seaport)"
                  value={origin}
                  onChange={setOrigin}
                  kind="seaport"
                  placeholder="INNSA, INMAA…"
                />
                <LocationCombobox
                  label="POD (seaport)"
                  value={destination}
                  onChange={setDestination}
                  kind="seaport"
                  placeholder="NLRTM, CNSHA…"
                />
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
                    {DESK_CURRENCIES.map((c) => (
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
                <div className="md:col-span-2">
                  <CommodityCombobox value={commodity} onChange={setCommodity} />
                </div>
                <Label>
                  Gross weight (kg)
                  <Input
                    type="number"
                    value={grossWeightKg || ""}
                    onChange={(e) => setGrossWeightKg(Number(e.target.value))}
                    placeholder="0"
                  />
                </Label>
                <Label>
                  Volume (CBM)
                  <Input
                    type="number"
                    step="0.01"
                    value={volumeCbm || ""}
                    onChange={(e) => setVolumeCbm(Number(e.target.value))}
                    placeholder="0"
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
                    onKeyDown={(e) => lastFieldTab(e, () => setStep("carrier"))}
                  />
                </Label>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="h-9"
                  onClick={() => {
                    if (!customer.trim()) {
                      toast("Enter customer name before liners.", "error");
                      return;
                    }
                    if (!origin.trim() || !destination.trim()) {
                      toast("Enter origin and destination before liners.", "error");
                      return;
                    }
                    const cargoErr = validateSeaCargoBasics(grossWeightKg, volumeCbm);
                    if (cargoErr) {
                      toast(cargoErr, "error");
                      setSaveMsg(cargoErr);
                      return;
                    }
                    setSaveMsg(null);
                    setStep("carrier");
                  }}
                >
                  Next · Liners
                </Button>
              </div>
            </Card>
          ) : null}

          {step === "carrier" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-[var(--color-atlas-navy)]">
                  Carriers on this lane ({laneLiners.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setLiners((prev) => [
                        ...prev,
                        createLinerOption({ laneId: activeLane?.id, kind: "liner" }, prev.length === 0),
                      ])
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" /> Liner
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setLiners((prev) => [
                        ...prev,
                        createLinerOption(
                          { laneId: activeLane?.id, kind: "coloader" },
                          prev.length === 0,
                        ),
                      ])
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" /> Coloader
                  </Button>
                </div>
              </div>

              {laneLiners.map((opt, idx) => {
                const tot = totalsById[opt.id];
                return (
                  <Card
                    key={opt.id}
                    className={`space-y-3 ${opt.selected ? "ring-2 ring-[var(--color-atlas-sea)]/30" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[var(--color-text-muted)]">
                          {opt.kind === "coloader" ? "Coloader" : "Liner"} #{idx + 1}
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
                        {opt.id === cheapestLinerId && (tot?.grandSell ?? 0) > 0 ? (
                          <Badge tone="success">Cheapest ★</Badge>
                        ) : null}
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
                      <div className="md:col-span-2">
                        <CarrierCombobox
                          label="Liner / Coloader"
                          value={opt.name}
                          onChange={(v) => updateLiner(opt.id, { name: v })}
                          kind="ocean+coloader"
                          placeholder="MAEU, MSC, ECU…"
                        />
                      </div>
                      <div>
                        <Label>Routing</Label>
                        <Input
                          value={opt.routing}
                          autoComplete="off"
                          name={`atlas-sea-routing-${opt.id}`}
                          onChange={(e) => updateLiner(opt.id, { routing: e.target.value })}
                          onBlur={() =>
                            updateLiner(opt.id, { routing: normalizeRouting(opt.routing) })
                          }
                          placeholder="DXB"
                        />
                        {opt.routing.trim() ? (
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            Preview: {formatRoutingPreview(opt.routing)}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <Label>Transit time</Label>
                        <Input
                          value={opt.tt}
                          onChange={(e) => updateLiner(opt.id, { tt: e.target.value })}
                        />
                        {opt.tt.trim() ? (
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            Preview: {formatTransitPreview(opt.tt)}
                          </p>
                        ) : null}
                      </div>
                      <div className="md:col-span-2">
                        <ValidityField
                          value={opt.validity}
                          onChange={(v) => updateLiner(opt.id, { validity: v })}
                        />
                      </div>
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
                                <th className="px-2 py-2">Sell (customer)</th>
                                <th className="px-2 py-2">Buy (cost)</th>
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
                                    <NumberInput
                                      className="mt-0 w-14 px-1 py-1"
                                      value={row.qty}
                                      onValueChange={(n) =>
                                        updateContainer(opt.id, i, { qty: Math.max(1, n || 1) })
                                      }
                                    />
                                  </td>
                                  <td className="p-1">
                                    <NumberInput
                                      step="0.01"
                                      className="mt-0 w-24 px-1 py-1"
                                      value={row.sellRate}
                                      onValueChange={(n) =>
                                        updateContainer(opt.id, i, { sellRate: n })
                                      }
                                    />
                                  </td>
                                  <td className="p-1">
                                    <NumberInput
                                      step="0.01"
                                      className="mt-0 w-24 px-1 py-1"
                                      value={row.buyRate}
                                      onValueChange={(n) =>
                                        updateContainer(opt.id, i, { buyRate: n })
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
                          LCL sell / RT (customer)
                          <NumberInput
                            step="0.01"
                            value={opt.lclSell}
                            onValueChange={(n) => updateLiner(opt.id, { lclSell: n })}
                          />
                        </Label>
                        <Label>
                          LCL buy / RT (cost)
                          <NumberInput
                            step="0.01"
                            value={opt.lclBuy}
                            onValueChange={(n) => updateLiner(opt.id, { lclBuy: n })}
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
                      lastFieldTabTarget={`dest-fee-first-${opt.id}`}
                    />
                    <SurchargeTable
                      title="Destination local surcharges"
                      enabled={opt.destFeesEnabled}
                      onEnabledChange={(v) => updateLiner(opt.id, { destFeesEnabled: v })}
                      rows={opt.destSurcharges}
                      onChange={(rows) => updateLiner(opt.id, { destSurcharges: rows })}
                      units={["flat", "cbm", "container"]}
                      firstNameInputId={`dest-fee-first-${opt.id}`}
                      prevFieldTabTarget={
                        opt.originSurcharges.length
                          ? `surcharge-del-${opt.originSurcharges[opt.originSurcharges.length - 1].id}`
                          : undefined
                      }
                      lastFieldTabTarget={idx === laneLiners.length - 1 ? "sea-next-terms" : undefined}
                    />

                    {tot ? (
                      <div className="flex flex-wrap gap-3 border-t pt-3 text-sm">
                        <span>
                          Freight:{" "}
                          <strong>{formatCurrency(tot.baseFreightQuote, currency)}</strong>
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
                <Button id="sea-next-terms" type="button" onClick={() => setStep("terms")}>
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
                  <dt className="font-bold">Quote total</dt>
                  <dd className="font-extrabold text-emerald-700">
                    {formatCurrency(selectedTotals.grandSell, currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Gross profit</dt>
                  <dd className="font-bold">
                    {selectedTotals.gpReady
                      ? formatCurrency(selectedTotals.gp, currency)
                      : "— (both buy & sell freight at Won)"}
                  </dd>
                </div>
              </dl>
            ) : null}
          </Card>

          {liners.length > 1 ? (
            <Card>
              <GuideNote>
                Quote every liner you want the client to compare. Share after save — they pick, we
                do not have to choose for them.
              </GuideNote>
              <VendorCompareList
                vendors={vendorRowsFromEntries(
                  liners.map((l) => ({
                    id: l.id,
                    name: l.name || "Untitled",
                    kind: l.kind,
                    total: totalsById[l.id]?.grandSell ?? 0,
                    selected: l.selected,
                    routing: l.routing,
                    tt: l.tt,
                    laneId: l.laneId,
                  })),
                )}
                currency={currency}
                hint="Cheapest → highest. ★ marks the lowest total. Click a row to quote it."
                onSelect={selectLiner}
                testId="sea-desk-compare"
              />
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
