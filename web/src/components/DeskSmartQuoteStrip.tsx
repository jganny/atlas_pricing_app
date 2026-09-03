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
import { Badge, Button, Card, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useAirSmartQuote, useSeaSmartQuote } from "@/hooks/use-smart-quote";
import {
  SMART_QUOTE_ACCEPT,
  ingestEnquiryFile,
} from "@/lib/pricing/enquiry-ingest";
import { fieldConfidence } from "@/lib/pricing/smart-quote-prefill";
import type { ParsedEnquiry, SmartQuoteDraft } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

/**
 * Option A — paste / drop enquiry on the desk itself.
 * Parse → review → Apply fills this desk (no redirect).
 */
export function DeskSmartQuoteStrip({
  mode,
  onApply,
}: {
  mode: "air" | "sea";
  onApply: (draft: SmartQuoteDraft) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(true);
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
      toast("Parse timed out — try again or paste shorter text.", "error");
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
      toast("Enquiry parsed — review then Apply to this desk", "success");
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

  function handleApply() {
    if (!draft || !editable) return;
    if (!editable.origin || !editable.destination) {
      toast("Need origin and destination before applying.", "error");
      return;
    }
    onApply({ ...draft, parsed: editable });
    toast("Fields applied to this desk — check carriers and rates", "success");
    setOpen(false);
  }

  return (
    <Card className="border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white p-0 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sky-700" />
          <span className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
            Paste enquiry here
          </span>
          <Badge tone="info">Option A</Badge>
          <span className="hidden text-xs text-[var(--color-text-muted)] sm:inline">
            Parse fills this {mode === "air" ? "Air" : "Sea"} desk — no separate Smart Quote page
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-sky-100 px-4 py-4">
          <Textarea
            className="min-h-28"
            placeholder="Paste customer email / enquiry text…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div
            className="rounded-xl border-2 border-dashed border-[var(--color-border)] bg-white/80 p-3 text-center text-sm"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              void onFile(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <FileUp className="mx-auto h-6 w-6 text-[var(--color-text-muted)]" />
            <p className="mt-1 font-semibold text-[var(--color-atlas-navy)]">
              Drop PDF, Excel, Word, TXT, or EML
            </p>
            <input
              ref={fileRef}
              type="file"
              accept={SMART_QUOTE_ACCEPT}
              className="mt-2 block w-full text-xs"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {warning ? <p className="text-xs font-semibold text-amber-800">{warning}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending || !text.trim()}
              onClick={() => void runParse(text)}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Parse
            </Button>
            <Button type="button" variant="secondary" onClick={() => setText("")}>
              Clear
            </Button>
          </div>

          {draft && editable ? (
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-white p-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone={draft.tariffFound ? "success" : "warn"}>
                  {draft.tariffFound ? "Circulars match" : "Enter rates on desk"}
                </Badge>
                <Badge tone="info">{editable.confidence}% match</Badge>
              </div>
              <p className="text-sm font-semibold text-[var(--color-atlas-navy)]">{draft.message}</p>
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
                      <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                        {f.label}
                      </div>
                      <div className="font-semibold">{f.value}</div>
                    </div>
                  </li>
                ))}
              </ul>
              {draft.estimatedTotal ? (
                <p className="text-sm">
                  Est. freight:{" "}
                  <span className="font-extrabold text-emerald-700">
                    {formatCurrency(draft.estimatedTotal, draft.currency || "USD")}
                  </span>
                </p>
              ) : null}
              <Button type="button" onClick={handleApply}>
                Apply to this desk
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
