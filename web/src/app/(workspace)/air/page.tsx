"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  PlaneTakeoff,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Zap,
} from "lucide-react";
import type { WeightBreakName, WeightBreaks } from "@atlas/pricing-core";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Label, Select, Tabs, Textarea } from "@/components/ui";
import { DeskSmartQuoteStrip } from "@/components/DeskSmartQuoteStrip";
import { DeskResetDialog } from "@/components/DeskResetDialog";
import { AirlineEditorOverlay, AirlineOptionForm } from "@/components/desks/AirlineOptionForm";
import { QuotePreviewModal } from "@/components/QuotePreviewModal";
import { VendorCompareList } from "@/components/VendorCompareList";
import { vendorRowsFromEntries } from "@/lib/quotes/vendor-preview";
import { LaneChips, newLane, type QuoteLane } from "@/components/LaneChips";
import { LocationCombobox } from "@/components/LocationCombobox";
import { DESK_CURRENCIES } from "@/lib/desk/constants";
import { TariffIntelHint } from "@/components/TariffIntelHint";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { defaultDeskCurrency, defaultIncoterm, shouldHideAgencyAgreement } from "@/lib/auth/desk-rules";
import { cacheOfflineQuote } from "@/lib/quotes/offline-cache";
import { appendCalcAudit } from "@/lib/quotes/calc-audit";
import { persistQuoteToEnquiryDb, savedEnquiryHref, savedEnquiryMessage } from "@/lib/quotes/persist-enquiry";
import { nextQuoteNumber } from "@/lib/quotes/ref-id";
import {
  allLanesRoute,
  laneRouteLabel,
  quotedLaneRows,
  quotedOnLane,
  selectWithinLane,
  usableLanes,
} from "@/lib/quotes/lanes";
import { useLiveData } from "@/lib/api";
import { saveAirQuote } from "@/lib/firebase/save-quote";
import { lookupAirTariff } from "@/lib/firebase/tariffs";
import {
  EMPTY_AIR_BREAKS,
  computeAirlineTotals,
  validateAirCargo,
  validateSelectedAirline,
  type AirCargoRow,
} from "@/lib/pricing/air-desk";
import {
  createAirlineOption,
  type AirlineOption,
} from "@/lib/pricing/carrier-options";
import { CommodityCombobox } from "@/components/CommodityCombobox";
import { airShipmentSchema } from "@/lib/pricing/desk-schemas";
import { getDefaultFreightTerms } from "@/lib/pricing/terms";
import { closeAllComboboxes } from "@/lib/ui/close-comboboxes";
import { loadAirDeskFromQuote } from "@/lib/quotes/desk-loader";
import { clearSmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";
import { useAirTariffs } from "@/hooks/use-atlas-data";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
import { useDeskStepKeys } from "@/hooks/use-desk-step-keys";
import { useQuoteDeskLoader } from "@/hooks/use-quote-desk-loader";
import type { SavedQuote, SmartQuoteDraft } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];
type Step = "shipment" | "carrier" | "terms";
const AIR_STEPS = ["shipment", "carrier", "terms"] as const;

export default function AirDeskPage() {
  return (
    <Suspense fallback={<Card className="p-6 text-sm text-[var(--color-text-muted)]">Loading air desk…</Card>}>
      <AirDeskInner />
    </Suspense>
  );
}

function AirDeskInner() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: tariffs = [] } = useAirTariffs();
  const loader = useQuoteDeskLoader("air");

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
  const [customFx, setCustomFx] = useState(0);
  const [cargo, setCargo] = useState<AirCargoRow[]>([{ l: 0, w: 0, h: 0, qty: 1, gw: 0 }]);
  const [airlines, setAirlines] = useState<AirlineOption[]>([createAirlineOption({}, true)]);
  const [editorAirlineId, setEditorAirlineId] = useState<string | null>(null);
  const [showAllBreaksById, setShowAllBreaksById] = useState<Record<string, boolean>>({});
  const [terms, setTerms] = useState(getDefaultFreightTerms("air"));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveEnquiryPath, setSaveEnquiryPath] = useState<string | null>(null);
  const [previewQuote, setPreviewQuote] = useState<SavedQuote | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [stripKey, setStripKey] = useState(0);
  const hideAgreement = shouldHideAgencyAgreement(user?.username);
  const [agreementName, setAgreementName] = useState<string | null>(null);
  const prefillApplied = useRef(false);

  useEffect(() => {
    if (!activeLaneId && lanes[0]) setActiveLaneId(lanes[0].id);
  }, [activeLaneId, lanes]);

  useEffect(() => {
    const lid = activeLane?.id || lanes[0]?.id;
    if (!lid) return;
    setAirlines((prev) => {
      if (prev.every((a) => a.laneId)) return prev;
      return prev.map((a) => (a.laneId ? a : { ...a, laneId: lid }));
    });
  }, [activeLane?.id, lanes]);

  useEffect(() => {
    if (prefillApplied.current || loader.sourceQuote) return;
    if (!loader.prefillOrigin && !loader.prefillDest) return;
    const id = activeLane?.id || lanes[0]?.id;
    if (!id) return;
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
  }, [loader.prefillOrigin, loader.prefillDest, loader.sourceQuote, activeLane?.id, lanes]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`atlas_air_agreement_${customer || "draft"}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { name?: string };
        setAgreementName(parsed.name || "Attached agreement");
      } else setAgreementName(null);
    } catch {
      setAgreementName(null);
    }
  }, [customer]);

  const selected =
    quotedOnLane(airlines, activeLane?.id, lanes[0]?.id || "") ??
    airlines.find((a) => a.selected) ??
    airlines[0];

  const totalsById = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeAirlineTotals>> = {};
    for (const a of airlines) map[a.id] = computeAirlineTotals(cargo, a);
    return map;
  }, [airlines, cargo]);

  const selectedTotals = selected ? totalsById[selected.id] : null;

  const allLanesQuotedTotal = useMemo(() => {
    const fallback = lanes[0]?.id || "";
    return lanes.reduce((sum, lane) => {
      const q = quotedOnLane(airlines, lane.id, fallback);
      return sum + (q ? totalsById[q.id]?.grandSell ?? 0 : 0);
    }, 0);
  }, [lanes, airlines, totalsById]);

  const quotedLanes = useMemo(
    () => quotedLaneRows(lanes, airlines, (a) => totalsById[a.id]?.grandSell ?? 0),
    [lanes, airlines, totalsById],
  );

  const compareVendors = useMemo(() => {
    const fallback = lanes[0]?.id || "";
    return vendorRowsFromEntries(
      airlines.map((a) => {
        const laneIndex = Math.max(
          0,
          lanes.findIndex((l) => l.id === (a.laneId || fallback)),
        );
        const lane = lanes[laneIndex] ?? lanes[0];
        return {
          id: a.id,
          name: a.name || "Untitled",
          kind: a.kind,
          total: totalsById[a.id]?.grandSell ?? 0,
          selected: a.selected,
          routing: a.routing,
          tt: a.tt,
          laneId: a.laneId || fallback,
          laneLabel: lane ? laneRouteLabel(lane, laneIndex) : "",
        };
      }),
    );
  }, [airlines, lanes, totalsById]);

  useEffect(() => {
    if (!loader.sourceQuote) return;
    const loaded = loadAirDeskFromQuote(loader.sourceQuote);
    setCustomer(loaded.customer);
    setOrigin(loaded.origin);
    setDestination(loaded.destination);
    setCurrency(loaded.currency);
    setIncoterm(loaded.incoterm);
    setCommodity(loaded.commodity);
    setModule(loaded.module);
    setCustomFx(loaded.customExchangeRate);
    setCargo(loaded.cargo);
    setAirlines(loaded.airlines);
    if (loaded.lanes.length) {
      setLanes(loaded.lanes.map((l) => newLane(l)));
      setActiveLaneId(loaded.lanes[0]?.id || "");
    } else {
      const lane = newLane({ origin: loaded.origin, destination: loaded.destination });
      setLanes([lane]);
      setActiveLaneId(lane.id);
    }
    if (loaded.terms) setTerms(loaded.terms);
  }, [loader.sourceQuote]);

  useEffect(() => {
    if (!loader.smartPrefill) return;
    applySmartDraft({
      parsed: loader.smartPrefill.parsed,
      tariffFound: loader.smartPrefill.tariffFound,
      carrierLabel: loader.smartPrefill.carrierLabel,
      currency: loader.smartPrefill.currency,
      airBreaks: loader.smartPrefill.airBreaks,
      message: "Prefill from Smart Quote / Inbox",
    });
    clearSmartQuotePrefill();
  }, [loader.smartPrefill]);

  function applySmartDraft(draft: SmartQuoteDraft) {
    const p = draft.parsed;
    setCustomer(p.customer || "");
    setOrigin(p.origin || "");
    setDestination(p.destination || "");
    if (draft.currency) setCurrency(draft.currency);
    if (p.commodity) setCommodity(p.commodity);
    if (p.packages.length) {
      setCargo(
        p.packages.map((pkg) => ({
          l: pkg.l ?? 0,
          w: pkg.w ?? 0,
          h: pkg.h ?? 0,
          qty: pkg.qty || 1,
          gw: pkg.gw ?? 0,
        })),
      );
    } else {
      setCargo([{ l: 0, w: 0, h: 0, qty: 1, gw: 0 }]);
    }
    setAirlines([
      createAirlineOption(
        {
          name: p.airlineLabel || draft.carrierLabel || "",
          routing: p.origin && p.destination ? `${p.origin}-${p.destination}` : "",
          tt: "TBA",
          validity: "15 days",
          // Only Circulars (or explicit breaks) fill rates — never invent defaults
          breaks: draft.airBreaks
            ? { ...EMPTY_AIR_BREAKS, ...draft.airBreaks }
            : { ...EMPTY_AIR_BREAKS },
        },
        true,
      ),
    ]);
    // Stay on shipment so user verifies POL/POD/cargo; rates stay blank until Circulars
    setStep("shipment");
  }

  function applyReset() {
    const lane = newLane();
    setCustomer("");
    setLanes([lane]);
    setActiveLaneId(lane.id);
    setCurrency(defaultDeskCurrency(user?.username));
    setIncoterm(defaultIncoterm(user?.username));
    setCommodity("GENERAL");
    setModule("export");
    setCustomFx(0);
    setCargo([{ l: 0, w: 0, h: 0, qty: 1, gw: 0 }]);
    setAirlines([createAirlineOption({ laneId: lane.id }, true)]);
    prefillApplied.current = false;
    setTerms(getDefaultFreightTerms("air"));
    setSaveMsg(null);
    setSaveEnquiryPath(null);
    setPreviewQuote(null);
    setStep("shipment");
    setConfirmReset(false);
    setStripKey((k) => k + 1);
    loader.clearLoadedQuote();
    if (typeof window !== "undefined" && /[?&](edit|duplicate|smart)=/.test(window.location.search)) {
      router.replace("/air/");
    }
    toast("Air desk cleared", "success");
  }

  function updateCargo(index: number, patch: Partial<AirCargoRow>) {
    setCargo((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function updateAirline(id: string, patch: Partial<AirlineOption>) {
    setAirlines((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function selectAirline(id: string) {
    const fallback = activeLane?.id || lanes[0]?.id || "";
    setAirlines((prev) => selectWithinLane(prev, id, fallback));
  }

  function addAirline(kind: "airline" | "coloader") {
    const laneId = activeLane?.id || lanes[0]?.id || "";
    const onLane = airlines.filter((a) => !a.laneId || a.laneId === laneId);
    const option = createAirlineOption({ laneId, kind }, onLane.length === 0);
    const openOverlay = onLane.length >= 1;
    setAirlines((prev) => [...prev, option]);
    if (openOverlay) setEditorAirlineId(option.id);
  }

  function updateBreak(id: string, name: WeightBreakName, field: "sell" | "buy", value: number) {
    setAirlines((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const breaks: WeightBreaks = {
          ...a.breaks,
          [name]: {
            sell: a.breaks[name]?.sell ?? 0,
            buy: a.breaks[name]?.buy ?? 0,
            [field]: value,
          },
        };
        return { ...a, breaks };
      }),
    );
  }

  function applyTariffToSelected() {
    if (!selected) return;
    const originCode = origin.split(" - ")[0]?.trim().toUpperCase() || origin.trim().toUpperCase();
    const destCode =
      destination.split(" - ")[0]?.trim().toUpperCase() || destination.trim().toUpperCase();
    if (!originCode || !destCode) {
      toast("Enter origin and destination airport codes first.", "error");
      return;
    }
    const tariff = lookupAirTariff(tariffs, originCode, destCode);
    if (!tariff) {
      toast(`No Circulars tariff for ${originCode} → ${destCode}.`, "info");
      return;
    }
    updateAirline(selected.id, {
      breaks: { ...EMPTY_AIR_BREAKS, ...tariff.breaks },
      name: selected.name || tariff.carrier,
    });
    setCurrency(tariff.currency);
    toast(`Loaded ${tariff.carrier} rates onto selected airline.`, "success");
  }

  const laneAirlines = airlines.filter(
    (a) => !a.laneId || a.laneId === (activeLane?.id || lanes[0]?.id),
  );

  const cheapestId = useMemo(() => {
    const priced = laneAirlines.filter((a) => (totalsById[a.id]?.grandSell ?? 0) > 0);
    const sorted = [...priced].sort(
      (a, b) => (totalsById[a.id]?.grandSell ?? 0) - (totalsById[b.id]?.grandSell ?? 0),
    );
    return sorted[0]?.id ?? null;
  }, [laneAirlines, totalsById]);

  const handlePreview = () => {
    const cargoErr = validateAirCargo(cargo);
    const fallback = lanes[0]?.id || "";
    const completeLanes = usableLanes(lanes);
    const toCheck = completeLanes.length ? completeLanes : [activeLane].filter(Boolean);
    for (const lane of toCheck) {
      if (!lane) continue;
      const quoted = quotedOnLane(airlines, lane.id, fallback);
      const airlineErr = validateSelectedAirline(quoted);
      if (airlineErr) {
        toast(`${laneRouteLabel(lane, lanes.indexOf(lane))}: ${airlineErr}`, "error");
        setActiveLaneId(lane.id);
        setStep("carrier");
        return;
      }
    }
    if (cargoErr || !selected || !selectedTotals) {
      toast(cargoErr || "Complete the quote before preview.", "error");
      return;
    }
    const amount = allLanesQuotedTotal || selectedTotals.grandSell;
    const fx = customFx > 0 ? customFx : 83.5;
    const quoted = selected;
    const airlineLabel =
      quotedLanes.length > 1
        ? quotedLanes.map((l) => `${l.laneLabel}: ${l.airline || "—"}`).join(" · ")
        : quoted.name;
    const q: SavedQuote = {
      id: loader.editingQuoteId || "preview",
      customer: customer.trim() || "Draft",
      creator: user?.username || "",
      status: loader.editingStatus || "quoted",
      type: "air",
      quoteNumber: loader.editingQuoteNumber ?? nextQuoteNumber(),
      date: new Date().toISOString().split("T")[0],
      timestamp: Date.now(),
      amount,
      currency,
      amountINR: currency === "INR" ? amount : amount * fx,
      route: allLanesRoute(lanes) || `${origin} → ${destination}`,
      details: {
        origin,
        destination,
        airline: airlineLabel,
        incoterm,
        module,
        commodity,
        chargeableWeight: selectedTotals.freight.chargeableWeightKg,
        grossWeight: selectedTotals.freight.cargo.grossWeightKg,
        volumeWeight: selectedTotals.freight.cargo.volumeWeightKg,
        baseFreight: selectedTotals.baseFreightQuote,
        originFeesTotal: selectedTotals.originTotal,
        destFeesTotal: selectedTotals.destTotal,
        amsFee: selectedTotals.ams,
        routing: quoted.routing,
        tt: quoted.tt,
        validity: quoted.validity,
        cargoItems: cargo,
        lanes: lanes.map((l) => ({ id: l.id, origin: l.origin, destination: l.destination })),
        quotedLanes,
        allLanesTotal: amount,
        airlines: airlines.map((a) => {
          const laneIndex = Math.max(
            0,
            lanes.findIndex((l) => l.id === (a.laneId || fallback)),
          );
          const lane = lanes[laneIndex] ?? lanes[0];
          return {
            id: a.id,
            name: a.name,
            kind: a.kind,
            selected: a.selected,
            quoteTotal: totalsById[a.id]?.grandSell ?? 0,
            routing: a.routing,
            tt: a.tt,
            laneId: a.laneId || fallback,
            laneLabel: lane ? laneRouteLabel(lane, laneIndex) : "",
          };
        }),
        termsAndConditions: terms,
        type: "air",
        mode: "Air",
      },
    };
    setPreviewQuote(q);
  };

  const handleSave = useCallback(
    async () => {
      const shipment = airShipmentSchema.safeParse({
        customer,
        origin,
        destination,
        currency,
        incoterm,
        commodity,
        module,
      });
      if (!shipment.success) {
        const msg = shipment.error.issues[0]?.message ?? "Check shipment fields.";
        setSaveMsg(msg);
        toast(msg, "error");
        setStep("shipment");
        return;
      }
      for (const lane of lanes) {
        const hasOrigin = Boolean(lane.origin.trim());
        const hasDest = Boolean(lane.destination.trim());
        if (!hasOrigin && !hasDest) continue;
        if (!hasOrigin || !hasDest) {
          const msg = `${laneRouteLabel(lane, lanes.indexOf(lane))}: enter origin and destination.`;
          setSaveMsg(msg);
          toast(msg, "error");
          setActiveLaneId(lane.id);
          setStep("shipment");
          return;
        }
      }
      const completeLanes = usableLanes(lanes);
      if (!completeLanes.length) {
        const msg = "Enter origin and destination for at least one lane.";
        setSaveMsg(msg);
        toast(msg, "error");
        setStep("shipment");
        return;
      }
      const cargoErr = validateAirCargo(cargo);
      if (cargoErr) {
        setSaveMsg(cargoErr);
        toast(cargoErr, "error");
        setStep("shipment");
        return;
      }
      const fallback = lanes[0]?.id || "";
      for (const lane of completeLanes) {
        const quoted = quotedOnLane(airlines, lane.id, fallback);
        const airlineErr = validateSelectedAirline(quoted);
        if (airlineErr) {
          const msg = `${laneRouteLabel(lane, lanes.indexOf(lane))}: ${airlineErr}`;
          setSaveMsg(msg);
          toast(msg, "error");
          setActiveLaneId(lane.id);
          setStep("carrier");
          return;
        }
      }
      if (!selected || !selectedTotals) return;

      const amount = allLanesQuotedTotal || selectedTotals.grandSell;
      const fx = customFx > 0 ? customFx : 83.5;
      const quoteNumber = loader.editingQuoteNumber ?? nextQuoteNumber();
      const quoteId = loader.editingQuoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
      const lanesNote =
        quotedLanes.length > 1
          ? `${quotedLanes.length} lanes · ${quotedLanes.map((l) => `${l.laneLabel} ${l.airline || "—"}`).join(" · ")}`
          : quotedLanes[0]
            ? `${quotedLanes[0].laneLabel} · ${quotedLanes[0].airline || selected.name}`
            : selected.name;
      const localQuote: SavedQuote = {
        id: quoteId,
        customer: customer.trim(),
        creator: user?.username || "",
        status: loader.editingStatus || "quoted",
        type: "air",
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
          airline:
            quotedLanes.length > 1
              ? quotedLanes.map((l) => `${l.laneLabel}: ${l.airline || "—"}`).join(" · ")
              : selected.name,
          incoterm,
          module,
          commodity,
          chargeableWeight: selectedTotals.freight.chargeableWeightKg,
          grossWeight: selectedTotals.freight.cargo.grossWeightKg,
          volumeWeight: selectedTotals.freight.cargo.volumeWeightKg,
          baseFreight: selectedTotals.baseFreightQuote,
          originFeesTotal: selectedTotals.originTotal,
          destFeesTotal: selectedTotals.destTotal,
          amsFee: selectedTotals.ams,
          routing: selected.routing,
          tt: selected.tt,
          validity: selected.validity,
          cargoItems: cargo,
          lanes: lanes.map((l) => ({ id: l.id, origin: l.origin, destination: l.destination })),
          quotedLanes,
          allLanesTotal: amount,
          airlines: airlines.map((a) => {
            const laneIndex = Math.max(
              0,
              lanes.findIndex((l) => l.id === (a.laneId || fallback)),
            );
            const lane = lanes[laneIndex] ?? lanes[0];
            return {
              ...a,
              quoteTotal: totalsById[a.id]?.grandSell ?? 0,
              laneId: a.laneId || fallback,
              laneLabel: lane ? laneRouteLabel(lane, laneIndex) : "",
            };
          }),
          termsAndConditions: terms,
          type: "air",
          mode: "Air",
        },
      };

      setSaving(true);
      setSaveMsg(null);
      let cloud: "live" | "local" | "cloud-failed" = "local";
      try {
        if (useLiveData && user) {
          try {
            await saveAirQuote({
              customer: customer.trim(),
              creator: user.username,
              origin,
              destination,
              currency,
              incoterm,
              commodity,
              module,
              cargo,
              selected,
              totals: selectedTotals,
              airlines,
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
              type: "air",
              customer: customer.trim(),
              payload: { origin, destination, currency, amount },
            });
            appendCalcAudit({
              quoteId,
              type: "air",
              steps: [
                { label: "Chargeable kg", value: selectedTotals.freight.chargeableWeightKg },
                { label: "Base freight", value: selectedTotals.baseFreightQuote },
                { label: "Origin fees", value: selectedTotals.originTotal },
                { label: "Dest fees", value: selectedTotals.destTotal },
                { label: "AMS", value: selectedTotals.ams },
                { label: "Grand sell", value: amount },
                { label: "Currency", value: currency },
                { label: "Lanes", value: quotedLanes.length },
              ],
            });
          } catch (e) {
            cloud = "cloud-failed";
            console.warn("Cloud save failed, kept local Enquiry DB row", e);
          }
        }
        const row = persistQuoteToEnquiryDb(localQuote, queryClient);
        const msg = savedEnquiryMessage(row, { cloud, lanesNote });
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
      cargo,
      selected,
      selectedTotals,
      airlines,
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
    steps: AIR_STEPS,
    setStep,
  });

  return (
    <div className="space-y-3">
      {loader.banner ? (
        <Card className="border-sky-200 bg-sky-50 py-2">
          <p className="text-sm font-semibold text-sky-900">{loader.banner}</p>
        </Card>
      ) : null}
      {loader.loadError ? (
        <Card className="border-amber-200 bg-amber-50 py-2">
          <p className="text-sm font-semibold text-amber-900">{loader.loadError}</p>
        </Card>
      ) : null}

      <DeskSmartQuoteStrip key={stripKey} mode="air" onApply={applySmartDraft} />

      <DeskResetDialog
        open={confirmReset}
        deskLabel="air"
        onConfirm={applyReset}
        onCancel={() => setConfirmReset(false)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[var(--color-atlas-air)]">
          <PlaneTakeoff className="h-5 w-5" />
          <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Air desk</h1>
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
          <Button type="button" variant="secondary" className="h-9" onClick={handlePreview}>
            <Eye className="mr-1.5 h-4 w-4" />
            {lanes.length > 1 ? "Preview all lanes" : "Preview"}
          </Button>
          <Button type="button" className="h-9" onClick={() => void handleSave()} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Saving…" : lanes.length > 1 ? "Save all lanes" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModule("export")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
            module === "export"
              ? "bg-amber-500 text-white"
              : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)]"
          }`}
        >
          Export (AE)
        </button>
        <button
          type="button"
          onClick={() => setModule("import")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
            module === "import"
              ? "bg-sky-600 text-white"
              : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)]"
          }`}
        >
          Import (AI)
        </button>
      </div>

      <Tabs
        value={step}
        onValueChange={(v) => setStep(v as Step)}
        idPrefix="air-step"
        items={[
          { value: "shipment", label: "1 · Shipment" },
          { value: "carrier", label: "2 · Carriers" },
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
              <form
                autoComplete="off"
                onSubmit={(e) => e.preventDefault()}
                className="space-y-3"
              >
              <h2 className="font-bold text-[var(--color-atlas-navy)]">Shipment</h2>
              <LaneChips
                lanes={lanes}
                activeId={activeLane?.id || lanes[0]?.id || ""}
                onSelect={setActiveLaneId}
                onAdd={() => {
                  const lane = newLane();
                  setLanes((prev) => [...prev, lane]);
                  setActiveLaneId(lane.id);
                  setAirlines((prev) => [
                    ...prev,
                    createAirlineOption({ laneId: lane.id }, true),
                  ]);
                }}
                onRemove={(id) => {
                  setLanes((prev) => {
                    const next = prev.filter((l) => l.id !== id);
                    return next.length ? next : prev;
                  });
                  setAirlines((prev) => prev.filter((a) => a.laneId !== id));
                  if (activeLaneId === id && lanes[0]) setActiveLaneId(lanes[0].id);
                }}
              />
              <p className="text-xs text-[var(--color-text-muted)]">
                One lane is origin → destination. Add a lane for extra O/D pairs. Airlines and
                coloading options sit on the selected lane.
              </p>
              <TariffIntelHint
                mode="air"
                origin={origin}
                destination={destination}
                tariffCount={tariffs.length}
              />
              <div className="grid gap-2 md:grid-cols-2">
                <Label className="md:col-span-2">
                  Customer
                  <Input
                    name="atlas-quote-customer"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="Customer name"
                  />
                </Label>
                <LocationCombobox
                  label="POL (airport)"
                  value={origin}
                  onChange={setOrigin}
                  kind="airport"
                  placeholder="BLR, BOM, DEL…"
                />
                <LocationCombobox
                  label="POD (airport)"
                  value={destination}
                  onChange={setDestination}
                  kind="airport"
                  placeholder="LHR, DXB, SIN…"
                />
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
                  Custom USD→INR override (optional)
                  <Input
                    type="number"
                    step="0.01"
                    value={customFx || ""}
                    onChange={(e) => setCustomFx(Number(e.target.value))}
                    placeholder="Leave blank for 83.5"
                  />
                </Label>
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
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              name={`atlas-cargo-l-${i}`}
                              className="w-16 rounded border px-1 py-1"
                              value={row.l || ""}
                              onFocus={() => closeAllComboboxes()}
                              onChange={(e) => updateCargo(i, { l: Number(e.target.value) })}
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              name={`atlas-cargo-w-${i}`}
                              className="w-16 rounded border px-1 py-1"
                              value={row.w || ""}
                              onFocus={() => closeAllComboboxes()}
                              onChange={(e) => updateCargo(i, { w: Number(e.target.value) })}
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              name={`atlas-cargo-h-${i}`}
                              className="w-16 rounded border px-1 py-1"
                              value={row.h || ""}
                              onFocus={() => closeAllComboboxes()}
                              onChange={(e) => updateCargo(i, { h: Number(e.target.value) })}
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              name={`atlas-cargo-qty-${i}`}
                              className="w-14 rounded border px-1 py-1"
                              value={row.qty}
                              onFocus={() => closeAllComboboxes()}
                              onChange={(e) => updateCargo(i, { qty: Number(e.target.value) })}
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              name={`atlas-cargo-gw-${i}`}
                              className="w-16 rounded border px-1 py-1"
                              value={row.gw || ""}
                              onFocus={() => closeAllComboboxes()}
                              onChange={(e) => updateCargo(i, { gw: Number(e.target.value) })}
                              onKeyDown={(e) => {
                                if (e.key === "Tab" && !e.shiftKey && i === cargo.length - 1) {
                                  e.preventDefault();
                                  setStep("carrier");
                                }
                              }}
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
              <p className="text-xs text-[var(--color-text-muted)]">
                Enter L × W × H (cm), qty, and gross kg for every line. Chargeable weight = max(gross,
                volumetric). Rates (Sell/Buy), AMS, and local fees are on the next step.
              </p>
              <div className="flex justify-end">
                <Button
                  id="air-next-carriers"
                  type="button"
                  onClick={() => {
                    if (!customer.trim()) {
                      toast("Enter customer name before carriers.", "error");
                      return;
                    }
                    if (!origin.trim() || !destination.trim()) {
                      toast("Enter origin and destination airports before carriers.", "error");
                      return;
                    }
                    const cargoErr = validateAirCargo(cargo);
                    if (cargoErr) {
                      toast(cargoErr, "error");
                      setSaveMsg(cargoErr);
                      return;
                    }
                    setSaveMsg(null);
                    setStep("carrier");
                  }}
                >
                  Next · Carriers
                </Button>
              </div>
              </form>
            </Card>
          ) : null}

          {step === "carrier" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-[var(--color-atlas-navy)]">
                  Carriers on this lane ({laneAirlines.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => addAirline("airline")}>
                    <Plus className="mr-1 h-4 w-4" /> Airline
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => addAirline("coloader")}>
                    <Plus className="mr-1 h-4 w-4" /> Coloader
                  </Button>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                First option stays on this page with the weight break that matches chargeable kg.
                Extra airlines open in a popup so you do not scroll a full page per carrier.
              </p>

              {laneAirlines.map((opt, idx) => {
                const tot = totalsById[opt.id];
                const inline = laneAirlines.length === 1 && idx === 0;
                return (
                  <Card
                    key={opt.id}
                    className={`space-y-3 ${opt.selected ? "ring-2 ring-[var(--color-atlas-navy)]/30" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-bold text-[var(--color-text-muted)]">
                          {opt.kind === "coloader" ? "Coloader" : "Airline"} #{idx + 1}
                        </span>
                        <span className="font-bold">{opt.name || "Untitled"}</span>
                        {opt.id === cheapestId && (tot?.grandSell ?? 0) > 0 ? (
                          <Badge tone="success">Cheapest ★</Badge>
                        ) : null}
                        {opt.selected ? <Badge tone="info">Quoted</Badge> : null}
                        <span className="text-sm font-semibold">
                          {formatCurrency(tot?.grandSell ?? 0, currency)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <input
                            type="radio"
                            name={`selected-airline-${activeLane?.id || "lane"}`}
                            checked={opt.selected}
                            onChange={() => selectAirline(opt.id)}
                          />
                          Quote this
                        </label>
                        {!inline ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-8"
                            onClick={() => setEditorAirlineId(opt.id)}
                          >
                            Edit
                          </Button>
                        ) : null}
                        <button
                          type="button"
                          className="text-sm font-semibold text-red-600 disabled:opacity-40"
                          disabled={airlines.length <= 1}
                          onClick={() => {
                            const laneId = opt.laneId || activeLane?.id || lanes[0]?.id || "";
                            setAirlines((prev) => {
                              const next = prev.filter((a) => a.id !== opt.id);
                              const onLane = next.filter((a) => !a.laneId || a.laneId === laneId);
                              if (!onLane.some((a) => a.selected) && onLane[0]) {
                                return next.map((a) =>
                                  a.id === onLane[0].id ? { ...a, selected: true } : a,
                                );
                              }
                              return next;
                            });
                            if (editorAirlineId === opt.id) setEditorAirlineId(null);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {inline ? (
                      <AirlineOptionForm
                        opt={opt}
                        tot={tot}
                        currency={currency}
                        showAllBreaks={Boolean(showAllBreaksById[opt.id])}
                        onToggleAllBreaks={() =>
                          setShowAllBreaksById((prev) => ({
                            ...prev,
                            [opt.id]: !prev[opt.id],
                          }))
                        }
                        lastDestTabTarget="air-next-terms"
                        onUpdate={(patch) => updateAirline(opt.id, patch)}
                        onUpdateBreak={(name, field, value) =>
                          updateBreak(opt.id, name, field, value)
                        }
                      />
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Compact row — tap Edit to enter routing, AMS, and the matching weight break.
                      </p>
                    )}
                  </Card>
                );
              })}

              <div className="flex justify-between">
                <Button type="button" variant="secondary" onClick={() => setStep("shipment")}>
                  Back
                </Button>
                <Button id="air-next-terms" type="button" onClick={() => setStep("terms")}>
                  Next · Terms
                </Button>
              </div>
            </div>
          ) : null}

          {step === "terms" ? (
            <Card className="space-y-4">
              <h2 className="font-bold text-[var(--color-atlas-navy)]">Terms & conditions</h2>
              <Textarea
                className="min-h-56"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
              <button
                type="button"
                className="text-xs font-semibold text-sky-700 hover:underline"
                onClick={() => setTerms(getDefaultFreightTerms("air"))}
              >
                Restore default air terms
              </button>
              {!hideAgreement ? (
                <div className="space-y-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  <p>
                    Nomination desk: attach agency agreement PDF for this customer (stored in-browser for
                    the session; keep Directory files current too).
                  </p>
                  <input
                    type="file"
                    accept=".pdf,application/pdf,image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        try {
                          sessionStorage.setItem(
                            `atlas_air_agreement_${customer.trim() || "draft"}`,
                            JSON.stringify({
                              name: file.name,
                              dataUrl: String(reader.result || ""),
                              at: Date.now(),
                            }),
                          );
                          setAgreementName(file.name);
                          toast(`Agreement attached: ${file.name}`, "success");
                        } catch {
                          toast("Could not store agreement locally", "error");
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {agreementName ? (
                    <p className="font-semibold text-emerald-800">Attached: {agreementName}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">
                  NRS / Free Hand — agency agreement upload is hidden for this desk category.
                </p>
              )}
              <div className="flex justify-between">
                <Button type="button" variant="secondary" onClick={() => setStep("carrier")}>
                  Back
                </Button>
                <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving…" : lanes.length > 1 ? "Save all lanes" : "Save quote"}
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
                  <dt className="text-[var(--color-text-muted)]">Module</dt>
                  <dd className="font-bold uppercase">{module}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">This lane</dt>
                  <dd className="text-right font-bold">
                    {activeLane ? laneRouteLabel(activeLane, lanes.indexOf(activeLane)) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Airline</dt>
                  <dd className="text-right font-bold">{selected.name || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Chargeable</dt>
                  <dd className="font-bold">
                    {selectedTotals.freight.chargeableWeightKg.toFixed(2)} kg
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Base freight</dt>
                  <dd className="text-right">
                    {selectedTotals.baseFreightQuote > 0 ? (
                      <span className="block text-[11px] font-normal text-[var(--color-text-muted)]">
                        {selectedTotals.freight.chargeableWeightKg.toFixed(2)} kg × $
                        {(
                          (selectedTotals.freight.activeRate > 0
                            ? selectedTotals.freight.activeRate
                            : selectedTotals.freight.activeBuyRate) || 0
                        ).toFixed(2)}
                        {selectedTotals.quoteUsingBuyFreight ? " (Buy)" : ""}
                      </span>
                    ) : null}
                    {formatCurrency(selectedTotals.baseFreightQuote, currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Origin fees</dt>
                  <dd>{formatCurrency(selectedTotals.originTotal, currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Dest fees</dt>
                  <dd>{formatCurrency(selectedTotals.destTotal, currency)}</dd>
                </div>
                {selectedTotals.ams > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-muted)]">AMS</dt>
                    <dd>{formatCurrency(selectedTotals.ams, currency)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-2">
                  <dt className="font-bold">This lane total</dt>
                  <dd className="font-extrabold text-emerald-700">
                    {formatCurrency(selectedTotals.grandSell, currency)}
                  </dd>
                </div>
                {lanes.length > 1 ? (
                  <>
                    <div className="space-y-1 border-t pt-2 text-xs">
                      {quotedLanes.map((lane) => (
                        <div key={lane.laneId} className="flex justify-between gap-2">
                          <span className="text-[var(--color-text-muted)]">{lane.laneLabel}</span>
                          <span className="text-right font-semibold">
                            {lane.airline || "—"} · {formatCurrency(lane.amount, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <dt className="font-bold">All lanes total</dt>
                      <dd className="font-extrabold text-emerald-700">
                        {formatCurrency(allLanesQuotedTotal, currency)}
                      </dd>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Gross profit</dt>
                  <dd className="font-bold">
                    {selectedTotals.gpReady
                      ? formatCurrency(selectedTotals.gp, currency)
                      : "— (both buy & sell freight at Won)"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">Select an airline option.</p>
            )}
          </Card>

          {airlines.length > 1 || lanes.length > 1 ? (
            <Card>
              <VendorCompareList
                vendors={compareVendors}
                currency={currency}
                heading={lanes.length > 1 ? "Compare options by lane" : "Compare options"}
                hint="Cheapest → highest per lane. ★ is the lowest priced option on that lane ($0 is incomplete). Quoted is the option that will save. One Save writes every lane into Enquiry DB."
                onSelect={selectAirline}
                testId="air-desk-compare"
              />
            </Card>
          ) : null}
        </div>
      </div>

      {editorAirlineId
        ? (() => {
            const opt = airlines.find((a) => a.id === editorAirlineId);
            if (!opt) return null;
            const tot = totalsById[opt.id];
            const idx = laneAirlines.findIndex((a) => a.id === opt.id);
            return (
              <AirlineEditorOverlay
                title={`${opt.kind === "coloader" ? "Coloader" : "Airline"} ${idx >= 0 ? `#${idx + 1}` : ""}`}
                onDone={() => setEditorAirlineId(null)}
              >
                <AirlineOptionForm
                  opt={opt}
                  tot={tot}
                  currency={currency}
                  showAllBreaks={Boolean(showAllBreaksById[opt.id])}
                  onToggleAllBreaks={() =>
                    setShowAllBreaksById((prev) => ({
                      ...prev,
                      [opt.id]: !prev[opt.id],
                    }))
                  }
                  onUpdate={(patch) => updateAirline(opt.id, patch)}
                  onUpdateBreak={(name, field, value) => updateBreak(opt.id, name, field, value)}
                />
              </AirlineEditorOverlay>
            );
          })()
        : null}

      {previewQuote ? (
        <QuotePreviewModal quote={previewQuote} onClose={() => setPreviewQuote(null)} />
      ) : null}
    </div>
  );
}
