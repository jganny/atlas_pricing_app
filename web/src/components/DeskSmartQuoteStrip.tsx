"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileUp,
  Loader2,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useAirSmartQuote, useSeaSmartQuote } from "@/hooks/use-smart-quote";
import {
  SMART_QUOTE_ACCEPT,
  ingestEnquiryFile,
} from "@/lib/pricing/enquiry-ingest";
import { fieldConfidence } from "@/lib/pricing/smart-quote-prefill";
import type { ParsedEnquiry, SmartQuoteDraft } from "@/lib/types";

/**
 * Option A — compact paste/parse on the desk (collapsed by default).
 * Review + edit extracted fields before Apply so the desk fills correctly.
 */
export function DeskSmartQuoteStrip({
  mode,
  onApply,
}: {
  mode: "air" | "sea";
  onApply: (draft: SmartQuoteDraft) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [draft, setDraft] = useState<SmartQuoteDraft | null>(null);
  const [editable, setEditable] = useState<ParsedEnquiry | null>(null);

  const airMutation = useAirSmartQuote();
  const seaMutation = useSeaSmartQuote();
  const mutation = mode === "air" ? airMutation : seaMutation;
  const pending = running || fileBusy;
  const fields = editable ? fieldConfidence(editable, mode) : [];

  async function runParse(raw: string, source = "email-text") {
    const body = raw.trim();
    if (!body) {
      toast("Paste an enquiry first", "error");
      return;
    }
    setRunning(true);
    setWarning(null);
    let abandoned = false;
    const safety = window.setTimeout(() => {
      abandoned = true;
      setRunning(false);
      toast("Parse timed out — try again.", "error");
    }, 8000);
    try {
      const d = await mutation.mutateAsync(body);
      if (abandoned) return;
      const withSource: SmartQuoteDraft = {
        ...d,
        parsed: { ...d.parsed, source: d.parsed.source || source },
      };
      setDraft(withSource);
      setEditable({ ...withSource.parsed });
      setOpen(true);
      if (!withSource.parsed.origin || !withSource.parsed.destination) {
        toast("Route incomplete — fix POL/POD below, then Apply", "info");
      } else {
        toast("Parsed — review fields, then Apply", "success");
      }
    } catch (e) {
      if (!abandoned) toast(e instanceof Error ? e.message : "Parse failed", "error");
    } finally {
      window.clearTimeout(safety);
      setRunning(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setFileBusy(true);
    setWarning(null);
    setOpen(true);
    try {
      const ingested = await ingestEnquiryFile(file);
      setText(ingested.text);
      if (ingested.warning) setWarning(ingested.warning);
      await runParse(ingested.text, ingested.source);
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

  function handleApply() {
    if (!draft || !editable) return;
    if (!editable.origin?.trim() || !editable.destination?.trim()) {
      toast("Need origin and destination before applying.", "error");
      return;
    }
    onApply({ ...draft, parsed: editable });
    toast("Applied to this desk — add Circulars rates on Carriers", "success");
    setOpen(false);
  }

  return (
    <Card className="border-sky-200/70 bg-sky-50/50 p-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-sky-700" />
          <span className="truncate text-sm font-bold text-[var(--color-atlas-navy)]">
            Paste enquiry
          </span>
          <Badge tone="info">AI</Badge>
          {!open ? (
            <span className="hidden truncate text-xs text-[var(--color-text-muted)] sm:inline">
              — click to paste or drop a file
            </span>
          ) : null}
          {open ? (
            <ChevronUp className="ml-auto h-4 w-4 shrink-0" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4 shrink-0" />
          )}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--color-border)] bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-50">
          <FileUp className="h-3.5 w-3.5" />
          File
          <input
            ref={fileRef}
            type="file"
            accept={SMART_QUOTE_ACCEPT}
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {open ? (
        <div
          className="space-y-2 border-t border-sky-100 px-3 py-2"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            void onFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <Textarea
            className="min-h-[4.5rem] text-sm"
            placeholder="Paste enquiry email…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {warning ? <p className="text-xs font-semibold text-amber-800">{warning}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-8 px-3 text-xs"
              disabled={pending || !text.trim()}
              onClick={() => void runParse(text)}
            >
              {pending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="mr-1.5 h-3.5 w-3.5" />
              )}
              Parse
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-3 text-xs"
              onClick={() => {
                setText("");
                setDraft(null);
                setEditable(null);
              }}
            >
              Clear
            </Button>
          </div>

          {draft && editable ? (
            <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-white p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={draft.tariffFound ? "success" : "warn"}>
                  {draft.tariffFound ? "Circulars hit" : "Rates blank — use Circulars"}
                </Badge>
                <Badge tone="info">{editable.confidence}%</Badge>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <label className="block text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                  Customer
                  <Input
                    className="mt-0.5 h-8 text-xs"
                    value={editable.customer}
                    onChange={(e) => patchEditable({ customer: e.target.value })}
                  />
                </label>
                <label className="block text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                  {mode === "air" ? "Airline" : "Liner"}
                  <Input
                    className="mt-0.5 h-8 text-xs"
                    value={
                      mode === "air"
                        ? editable.airlineLabel || editable.airline || ""
                        : editable.linerLabel || ""
                    }
                    onChange={(e) =>
                      mode === "air"
                        ? patchEditable({ airlineLabel: e.target.value, airline: e.target.value })
                        : patchEditable({ linerLabel: e.target.value })
                    }
                  />
                </label>
                <label className="block text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                  POL
                  <Input
                    className="mt-0.5 h-8 text-xs"
                    value={editable.origin}
                    onChange={(e) => patchEditable({ origin: e.target.value.toUpperCase() })}
                  />
                </label>
                <label className="block text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                  POD
                  <Input
                    className="mt-0.5 h-8 text-xs"
                    value={editable.destination}
                    onChange={(e) => patchEditable({ destination: e.target.value.toUpperCase() })}
                  />
                </label>
              </div>
              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {fields.map((f) => (
                  <li
                    key={f.key}
                    className="flex items-center gap-1 rounded border border-[var(--color-border)] bg-slate-50 px-2 py-1 text-xs"
                  >
                    {f.ok ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3 w-3 shrink-0 text-amber-600" />
                    )}
                    <span className="truncate font-semibold">{f.value}</span>
                  </li>
                ))}
              </ul>
              <Button type="button" className="h-8 px-3 text-xs" onClick={handleApply}>
                Apply to this desk
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
