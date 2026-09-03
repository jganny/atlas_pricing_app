"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileUp,
  Loader2,
  Save,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge, Button, Card, Input, Label, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useAirSmartQuote, useSeaSmartQuote } from "@/hooks/use-smart-quote";
import { queryKeys } from "@/hooks/query-keys";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { saveAirQuote, saveSeaQuote } from "@/lib/firebase/save-quote";
import { createAirlineOption, createLinerOption } from "@/lib/pricing/carrier-options";
import { EMPTY_AIR_BREAKS, computeAirlineTotals } from "@/lib/pricing/air-desk";
import { computeLinerTotals } from "@/lib/pricing/sea-desk";
import {
  SMART_QUOTE_ACCEPT,
  ingestEnquiryFile,
} from "@/lib/pricing/enquiry-ingest";
import {
  draftToPrefill,
  fieldConfidence,
  storeSmartQuotePrefill,
} from "@/lib/pricing/smart-quote-prefill";
import { getDefaultFreightTerms } from "@/lib/pricing/terms";
import { SAMPLE_AIR_ENQUIRY, SAMPLE_SEA_ENQUIRY } from "@/lib/mock/data";
import type { ParsedEnquiry, SmartQuoteDraft } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function SmartQuoteWorkspace({ mode }: { mode: "air" | "sea" }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(mode === "air" ? SAMPLE_AIR_ENQUIRY : SAMPLE_SEA_ENQUIRY);
  const [sourceLabel, setSourceLabel] = useState("email-text");
  const [ingestWarning, setIngestWarning] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [draft, setDraft] = useState<SmartQuoteDraft | null>(null);
  const [editable, setEditable] = useState<ParsedEnquiry | null>(null);
  const [saving, setSaving] = useState(false);

  const airMutation = useAirSmartQuote();
  const seaMutation = useSeaSmartQuote();
  const mutation = mode === "air" ? airMutation : seaMutation;
  const pending = mutation.isPending || fileBusy;

  const applyDraft = useCallback((d: SmartQuoteDraft) => {
    const withSource: SmartQuoteDraft = {
      ...d,
      parsed: { ...d.parsed, source: d.parsed.source || sourceLabel },
    };
    setDraft(withSource);
    setEditable({ ...withSource.parsed });
  }, [sourceLabel]);

  async function runText() {
    setIngestWarning(null);
    setSourceLabel("email-text");
    try {
      const d = await mutation.mutateAsync(text);
      applyDraft(d);
      toast("Enquiry parsed", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Parse failed", "error");
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setFileBusy(true);
    setIngestWarning(null);
    try {
      const ingested = await ingestEnquiryFile(file);
      setText(ingested.text);
      setSourceLabel(ingested.source);
      if (ingested.warning) setIngestWarning(ingested.warning);
      const d = await mutation.mutateAsync(ingested.text);
      applyDraft({
        ...d,
        parsed: { ...d.parsed, source: ingested.source },
        message: `${d.message} · from ${ingested.fileName}`,
      });
      toast(`Parsed ${ingested.fileName}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "File ingest failed", "error");
    } finally {
      setFileBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function patchEditable(patch: Partial<ParsedEnquiry>) {
    setEditable((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function currentDraft(): SmartQuoteDraft | null {
    if (!draft || !editable) return null;
    return { ...draft, parsed: editable };
  }

  function handleApplyToDesk() {
    const d = currentDraft();
    if (!d) return;
    if (!d.parsed.origin || !d.parsed.destination) {
      toast("Need origin and destination before applying.", "error");
      return;
    }
    storeSmartQuotePrefill(draftToPrefill(mode, d));
    toast("Opening desk with parsed fields…", "info");
    router.push(mode === "air" ? "/air/?smart=1" : "/sea/?smart=1");
  }

  async function handleSaveDraft() {
    const d = currentDraft();
    if (!d) return;
    if (!d.parsed.customer.trim()) {
      toast("Enter customer name before saving.", "error");
      return;
    }
    if (!d.parsed.origin || !d.parsed.destination) {
      toast("Need origin and destination before saving.", "error");
      return;
    }
    if (!useLiveData || !user) {
      toast("Mock mode — apply to desk and save there, or use live Firebase.", "info");
      return;
    }

    setSaving(true);
    try {
      if (mode === "air") {
        const cargo = d.parsed.packages.length
          ? d.parsed.packages.map((p) => ({
              l: p.l ?? 0,
              w: p.w ?? 0,
              h: p.h ?? 0,
              qty: p.qty || 1,
              gw: p.gw ?? 0,
            }))
          : [{ l: 100, w: 80, h: 80, qty: 1, gw: d.parsed.grossWeight || 100 }];
        const option = createAirlineOption(
          {
            name: d.parsed.airlineLabel || d.carrierLabel || "",
            routing: `${d.parsed.origin}-${d.parsed.destination}`,
            tt: "TBA",
            validity: "15 days",
            breaks: d.airBreaks
              ? { ...EMPTY_AIR_BREAKS, ...d.airBreaks }
              : undefined,
          },
          true,
        );
        const totals = computeAirlineTotals(cargo, option);
        const id = await saveAirQuote({
          customer: d.parsed.customer.trim(),
          creator: user.username,
          origin: d.parsed.origin,
          destination: d.parsed.destination,
          currency: d.currency || "USD",
          incoterm: "FOB",
          commodity: "GENERAL",
          module: "export",
          cargo,
          selected: option,
          totals,
          airlines: [option],
          termsAndConditions: getDefaultFreightTerms("air"),
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.enquiries });
        toast(`Saved Smart Quote draft · ${id}`, "success");
      } else {
        const seaMode = d.parsed.mode || d.seaTariff?.mode || "fcl";
        const option = createLinerOption(
          {
            name: d.parsed.linerLabel || d.carrierLabel || "",
            routing: `${d.parsed.origin}-${d.parsed.destination}`,
            tt: "TBA",
            validity: "15 days",
            containers: d.parsed.containers.length
              ? d.parsed.containers.map((c) => ({
                  type: c.type,
                  qty: c.qty,
                  sellRate: d.seaTariff?.fclRates?.[c.type]?.sell ?? 0,
                  buyRate: d.seaTariff?.fclRates?.[c.type]?.buy ?? 0,
                }))
              : undefined,
            lclSell: d.seaTariff?.lclRate.sell ?? 45,
            lclBuy: d.seaTariff?.lclRate.buy ?? 40,
          },
          true,
        );
        const totals = computeLinerTotals(
          seaMode,
          d.parsed.grossWeight || 8500,
          d.parsed.volume || 28,
          0,
          option,
        );
        const id = await saveSeaQuote({
          customer: d.parsed.customer.trim(),
          creator: user.username,
          origin: d.parsed.origin,
          destination: d.parsed.destination,
          currency: d.currency || d.seaTariff?.currency || "USD",
          incoterm: "FOB",
          module: "export",
          mode: seaMode,
          grossWeightKg: d.parsed.grossWeight || 8500,
          volumeCbm: d.parsed.volume || 28,
          selected: option,
          totals,
          liners: [option],
          termsAndConditions: getDefaultFreightTerms("sea"),
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.enquiries });
        toast(`Saved Smart Quote draft · ${id}`, "success");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  const fields = editable ? fieldConfidence(editable, mode) : [];
  const accent = mode === "air" ? "var(--color-atlas-air)" : "var(--color-atlas-sea)";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2" style={{ color: accent }}>
          <Sparkles className="h-5 w-5" />
          <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">
            Smart Quote · {mode === "air" ? "Air" : "Sea"}
          </h1>
          <Badge tone="info">Phase 8</Badge>
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Paste or upload an enquiry → review extracted fields → apply to desk or save draft.
          {useLiveData ? " Rates resolve from live Circulars." : " Mock tariffs."}
        </p>
      </div>

      <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-white">
        <Label>
          Enquiry text
          <Textarea
            className="mt-2 min-h-40"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste customer enquiry email…"
          />
        </Label>

        <div
          className="mt-4 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-white/70 p-4 text-center transition-colors hover:border-[var(--color-atlas-sky)]"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            void onFile(f ?? null);
          }}
        >
          <FileUp className="mx-auto h-8 w-8 text-[var(--color-text-muted)]" />
          <p className="mt-2 text-sm font-semibold text-[var(--color-atlas-navy)]">
            Drop PDF, Excel, Word (.docx), TXT, or EML here
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">or choose a file</p>
          <input
            ref={fileRef}
            type="file"
            accept={SMART_QUOTE_ACCEPT}
            className="mt-3 block w-full text-sm"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {ingestWarning ? (
          <p className="mt-2 text-xs font-semibold text-amber-800">{ingestWarning}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void runText()} disabled={pending || !text.trim()}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Run automation
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setText(mode === "air" ? SAMPLE_AIR_ENQUIRY : SAMPLE_SEA_ENQUIRY);
              setSourceLabel("email-text");
              setIngestWarning(null);
            }}
          >
            Load sample
          </Button>
        </div>
      </Card>

      {mutation.error ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-800">
            {mutation.error instanceof Error ? mutation.error.message : "Parse failed"}
          </p>
        </Card>
      ) : null}

      {draft && editable ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={draft.tariffFound ? "success" : "warn"}>
              {draft.tariffFound ? "Circulars tariff" : "Manual rates needed"}
            </Badge>
            <Badge tone="info">{editable.confidence}% match</Badge>
            <Badge tone="neutral">{editable.source || sourceLabel}</Badge>
            {editable.mode ? <Badge tone="neutral">{editable.mode.toUpperCase()}</Badge> : null}
          </div>
          <p className="text-sm font-semibold text-[var(--color-atlas-navy)]">{draft.message}</p>

          <div>
            <h2 className="mb-2 text-sm font-bold text-[var(--color-atlas-navy)]">
              Field confidence review
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {fields.map((f) => (
                <li
                  key={f.key}
                  className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-slate-50 px-3 py-2 text-sm"
                >
                  {f.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <div>
                    <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                      {f.label}
                    </div>
                    <div className="font-semibold">{f.value}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Label>
              Customer
              <Input
                value={editable.customer}
                onChange={(e) => patchEditable({ customer: e.target.value })}
              />
            </Label>
            <Label>
              {mode === "air" ? "Airline" : "Liner"}
              <Input
                value={
                  mode === "air"
                    ? editable.airlineLabel || editable.airline || ""
                    : editable.linerLabel || ""
                }
                onChange={(e) =>
                  mode === "air"
                    ? patchEditable({ airlineLabel: e.target.value, airline: e.target.value.slice(0, 2) })
                    : patchEditable({ linerLabel: e.target.value })
                }
              />
            </Label>
            <Label>
              Origin
              <Input
                value={editable.origin}
                onChange={(e) => patchEditable({ origin: e.target.value.toUpperCase() })}
              />
            </Label>
            <Label>
              Destination
              <Input
                value={editable.destination}
                onChange={(e) => patchEditable({ destination: e.target.value.toUpperCase() })}
              />
            </Label>
          </div>

          {draft.estimatedTotal ? (
            <p className="text-sm">
              Est. freight:{" "}
              <span className="text-lg font-extrabold text-emerald-700">
                {formatCurrency(draft.estimatedTotal, draft.currency || "USD")}
              </span>
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleApplyToDesk}>
              Apply to {mode === "air" ? "Air" : "Sea"} desk
            </Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => void handleSaveDraft()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save draft quote
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
