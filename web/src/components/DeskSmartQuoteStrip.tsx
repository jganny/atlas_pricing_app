"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  FileUp,
  Loader2,
  PlaneTakeoff,
  Ship,
  Sparkles,
} from "lucide-react";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useAirSmartQuote, useSeaSmartQuote } from "@/hooks/use-smart-quote";
import { detectEnquiryMode } from "@/lib/mail/inbox-assign";
import {
  SMART_QUOTE_ACCEPT,
  ingestEnquiryFile,
} from "@/lib/pricing/enquiry-ingest";
import {
  draftToPrefill,
  storeSmartQuotePrefill,
} from "@/lib/pricing/smart-quote-prefill";
import type { SmartQuoteDraft } from "@/lib/types";

type DeskMode = "air" | "sea";

/**
 * Paste enquiry → pick Air or Sea once → desk fills automatically.
 * No separate "Apply" step.
 */
export function DeskSmartQuoteStrip({
  mode,
  onApply,
}: {
  mode: "air" | "sea";
  onApply: (draft: SmartQuoteDraft) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const parseTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [detected, setDetected] = useState<"air" | "sea" | "unknown">("unknown");
  const [airDraft, setAirDraft] = useState<SmartQuoteDraft | null>(null);
  const [seaDraft, setSeaDraft] = useState<SmartQuoteDraft | null>(null);
  const [opening, setOpening] = useState<DeskMode | null>(null);

  const airMutation = useAirSmartQuote();
  const seaMutation = useSeaSmartQuote();
  const pending = running || fileBusy || opening !== null;

  useEffect(() => {
    return () => {
      if (parseTimer.current) window.clearTimeout(parseTimer.current);
    };
  }, []);

  async function parseForMode(body: string, target: DeskMode, source = "email-text") {
    const mutation = target === "air" ? airMutation : seaMutation;
    const d = await mutation.mutateAsync(body);
    const withSource: SmartQuoteDraft = {
      ...d,
      parsed: { ...d.parsed, source: d.parsed.source || source },
    };
    if (target === "air") setAirDraft(withSource);
    else setSeaDraft(withSource);
    return withSource;
  }

  async function runParse(raw: string, source = "email-text") {
    const body = raw.trim();
    if (!body) return;
    setRunning(true);
    setWarning(null);
    setAirDraft(null);
    setSeaDraft(null);
    const guess = detectEnquiryMode(body);
    setDetected(guess);
    const primary: DeskMode = guess === "sea" ? "sea" : "air";
    let abandoned = false;
    const safety = window.setTimeout(() => {
      abandoned = true;
      setRunning(false);
      toast("Parse timed out — try again.", "error");
    }, 10000);
    try {
      await parseForMode(body, primary, source);
      if (abandoned) return;
      setOpen(true);
      toast(
        guess === "unknown"
          ? "Parsed — choose Air or Sea to fill the desk"
          : `Looks like ${primary === "air" ? "Air" : "Sea"} — tap to fill the desk`,
        "success",
      );
    } catch (e) {
      if (!abandoned) toast(e instanceof Error ? e.message : "Parse failed", "error");
    } finally {
      window.clearTimeout(safety);
      setRunning(false);
    }
  }

  function scheduleParse(next: string) {
    setText(next);
    if (parseTimer.current) window.clearTimeout(parseTimer.current);
    if (next.trim().length < 40) {
      setAirDraft(null);
      setSeaDraft(null);
      return;
    }
    parseTimer.current = window.setTimeout(() => {
      void runParse(next);
    }, 450);
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

  async function chooseDesk(target: DeskMode) {
    const body = text.trim();
    if (!body) {
      toast("Paste an enquiry first", "error");
      return;
    }
    setOpening(target);
    try {
      let draft = target === "air" ? airDraft : seaDraft;
      if (!draft) {
        draft = await parseForMode(body, target);
      }
      const p = draft.parsed;
      if (!p.origin?.trim() || !p.destination?.trim()) {
        toast("Could not find POL/POD in the enquiry — fill them on the desk", "info");
      }
      // Same desk: fill immediately. Other desk: navigate with prefill.
      if (target === mode) {
        onApply(draft);
        setOpen(false);
        setText("");
        setAirDraft(null);
        setSeaDraft(null);
        toast(`${target === "air" ? "Air" : "Sea"} desk filled`, "success");
      } else {
        storeSmartQuotePrefill(draftToPrefill(target, draft));
        toast(`Opening ${target === "air" ? "Air" : "Sea"} desk…`, "success");
        router.push(target === "sea" ? "/sea/?smart=1" : "/air/?smart=1");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not open desk", "error");
    } finally {
      setOpening(null);
    }
  }

  const preview = airDraft || seaDraft;
  const ready = Boolean(airDraft || seaDraft);

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
              — paste, then choose Air or Sea
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
            placeholder="Paste enquiry email — parsing starts automatically…"
            value={text}
            onChange={(e) => scheduleParse(e.target.value)}
          />
          {warning ? <p className="text-xs font-semibold text-amber-800">{warning}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            {running || fileBusy ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading enquiry…
              </span>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-3 text-xs"
              onClick={() => {
                if (parseTimer.current) window.clearTimeout(parseTimer.current);
                setText("");
                setAirDraft(null);
                setSeaDraft(null);
                setDetected("unknown");
                setWarning(null);
              }}
            >
              Clear
            </Button>
          </div>

          {ready && preview ? (
            <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-white p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={detected === "unknown" ? "warn" : "success"}>
                  {detected === "unknown"
                    ? "Mode unclear"
                    : `Detected: ${detected === "air" ? "Air" : "Sea"}`}
                </Badge>
                <Badge tone="info">{preview.parsed.confidence}%</Badge>
                <span className="font-semibold text-[var(--color-atlas-navy)]">
                  {preview.parsed.customer || "—"} · {preview.parsed.origin || "—"} →{" "}
                  {preview.parsed.destination || "—"}
                </span>
              </div>
              <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                Choose desk — fields fill automatically (no Apply click):
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  className={`h-11 ${detected === "air" ? "ring-2 ring-amber-400" : ""}`}
                  disabled={pending}
                  onClick={() => void chooseDesk("air")}
                >
                  {opening === "air" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlaneTakeoff className="mr-2 h-4 w-4" />
                  )}
                  Air desk
                </Button>
                <Button
                  type="button"
                  className={`h-11 ${detected === "sea" ? "ring-2 ring-sky-400" : ""}`}
                  disabled={pending}
                  onClick={() => void chooseDesk("sea")}
                >
                  {opening === "sea" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Ship className="mr-2 h-4 w-4" />
                  )}
                  Sea desk
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
