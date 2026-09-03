"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileUp,
  Loader2,
  PlaneTakeoff,
  Ship,
  Sparkles,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge, Button, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useAirSmartQuote, useSeaSmartQuote } from "@/hooks/use-smart-quote";
import { detectEnquiryMode } from "@/lib/mail/inbox-assign";
import {
  SMART_QUOTE_ACCEPT,
  ingestEnquiryFile,
} from "@/lib/pricing/enquiry-ingest";
import {
  draftToPrefill,
  fieldConfidence,
  storeSmartQuotePrefill,
} from "@/lib/pricing/smart-quote-prefill";
import type { ParsedEnquiry, SmartQuoteDraft } from "@/lib/types";

export const NEW_QUOTE_EVENT = "atlas:open-new-quote";

export function openNewQuoteLauncher() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NEW_QUOTE_EVENT));
}

type DeskMode = "air" | "sea";

/**
 * Option B — Home / ⌘K “New quote from enquiry” launcher.
 * Detect air vs sea, parse once, open the matching desk prefilled.
 */
export function NewQuoteLauncherHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(NEW_QUOTE_EVENT, onOpen);
    return () => window.removeEventListener(NEW_QUOTE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return <NewQuoteLauncherModal onClose={() => setOpen(false)} />;
}

function NewQuoteLauncherModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [detected, setDetected] = useState<"air" | "sea" | "unknown">("unknown");
  const [selectedMode, setSelectedMode] = useState<DeskMode | null>(null);
  const [draft, setDraft] = useState<SmartQuoteDraft | null>(null);
  const [editable, setEditable] = useState<ParsedEnquiry | null>(null);

  const airMutation = useAirSmartQuote();
  const seaMutation = useSeaSmartQuote();
  const pending = running || fileBusy;
  const mode = selectedMode;
  const fields = editable && mode ? fieldConfidence(editable, mode) : [];

  async function runParse(raw: string, forcedMode?: DeskMode, source = "email-text") {
    const body = raw.trim();
    if (!body) {
      toast("Paste an enquiry first", "error");
      return;
    }
    const guess = detectEnquiryMode(body);
    setDetected(guess);
    const nextMode: DeskMode = forcedMode ?? (guess === "sea" ? "sea" : guess === "air" ? "air" : selectedMode ?? "air");
    if (!forcedMode && guess === "unknown" && !selectedMode) {
      setSelectedMode(null);
      setDraft(null);
      setEditable(null);
      toast("Could not tell Air vs Sea — pick a desk below, then Parse again", "info");
      return;
    }
    setSelectedMode(nextMode);
    setRunning(true);
    setWarning(null);
    let abandoned = false;
    const safety = window.setTimeout(() => {
      abandoned = true;
      setRunning(false);
      toast("Parse timed out — try again.", "error");
    }, 8000);
    try {
      const mutation = nextMode === "air" ? airMutation : seaMutation;
      const d = await mutation.mutateAsync(body);
      if (abandoned) return;
      const withSource: SmartQuoteDraft = {
        ...d,
        parsed: { ...d.parsed, source: d.parsed.source || source },
      };
      setDraft(withSource);
      setEditable({ ...withSource.parsed });
      toast(`Parsed as ${nextMode === "air" ? "Air" : "Sea"}`, "success");
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
      await runParse(ingested.text, undefined, ingested.source);
    } catch (e) {
      toast(e instanceof Error ? e.message : "File ingest failed", "error");
    } finally {
      setFileBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function switchMode(next: DeskMode) {
    setSelectedMode(next);
    if (text.trim()) {
      await runParse(text, next);
    }
  }

  function openDesk(target: DeskMode) {
    if (!draft || !editable) {
      toast("Parse the enquiry first", "error");
      return;
    }
    if (!editable.origin || !editable.destination) {
      toast("Need origin and destination before opening the desk.", "error");
      return;
    }
    const finalDraft: SmartQuoteDraft = { ...draft, parsed: editable };
    storeSmartQuotePrefill(draftToPrefill(target, finalDraft));
    onClose();
    toast(`Opening ${target === "air" ? "Air" : "Sea"} desk`, "success");
    router.push(target === "sea" ? "/sea/?smart=1" : "/air/?smart=1");
  }

  const chipLabel =
    detected === "unknown"
      ? "Mode unclear — pick Air or Sea"
      : `Detected: ${detected === "air" ? "Air" : "Sea"}${
          editable?.origin && editable?.destination
            ? ` · ${editable.origin}→${editable.destination}`
            : ""
        }${editable?.confidence ? ` · ${editable.confidence}%` : ""}`;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center bg-black/45 p-4 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-label="New quote from enquiry"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          void onFile(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-atlas-sky)]" />
            <h2 className="text-base font-extrabold text-[var(--color-atlas-navy)]">
              New quote from enquiry
            </h2>
            <Badge tone="info">Option B</Badge>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            Paste once — we detect Air vs Sea, then open the right desk already filled.
          </p>

          <Textarea
            className="min-h-[8rem] text-sm"
            placeholder="Paste customer email / enquiry text…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-slate-50 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100">
              <FileUp className="h-3.5 w-3.5" />
              Drop or choose file
              <input
                ref={fileRef}
                type="file"
                accept={SMART_QUOTE_ACCEPT}
                className="sr-only"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button
              type="button"
              className="h-8 px-3 text-xs"
              disabled={pending || !text.trim()}
              onClick={() => void runParse(text, selectedMode ?? undefined)}
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
                setDetected("unknown");
                setSelectedMode(null);
                setWarning(null);
              }}
            >
              Clear
            </Button>
          </div>

          {warning ? <p className="text-xs font-semibold text-amber-800">{warning}</p> : null}

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2">
            <Badge tone={detected === "unknown" ? "warn" : "success"}>{chipLabel}</Badge>
            <span className="text-xs text-[var(--color-text-muted)]">Override:</span>
            <button
              type="button"
              onClick={() => void switchMode("air")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold ${
                selectedMode === "air"
                  ? "bg-amber-500 text-white"
                  : "border border-[var(--color-border)] bg-white text-amber-800"
              }`}
            >
              <PlaneTakeoff className="h-3.5 w-3.5" />
              Air
            </button>
            <button
              type="button"
              onClick={() => void switchMode("sea")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold ${
                selectedMode === "sea"
                  ? "bg-sky-600 text-white"
                  : "border border-[var(--color-border)] bg-white text-sky-800"
              }`}
            >
              <Ship className="h-3.5 w-3.5" />
              Sea
            </button>
          </div>

          {draft && editable && mode ? (
            <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={draft.tariffFound ? "success" : "warn"}>
                  {draft.tariffFound ? "Circulars hit" : "Enter rates on desk"}
                </Badge>
                <span className="truncate text-xs font-semibold text-[var(--color-atlas-navy)]">
                  {editable.customer || "no customer"} · {editable.origin || "—"} →{" "}
                  {editable.destination || "—"}
                </span>
              </div>
              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {fields.map((f) => (
                  <li
                    key={f.key}
                    className="flex items-center gap-1 rounded border border-[var(--color-border)] bg-white px-2 py-1 text-xs"
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
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  className="h-9"
                  disabled={mode !== "air"}
                  onClick={() => openDesk("air")}
                >
                  <PlaneTakeoff className="mr-1.5 h-4 w-4" />
                  Open Air desk
                </Button>
                <Button
                  type="button"
                  className="h-9"
                  disabled={mode !== "sea"}
                  onClick={() => openDesk("sea")}
                >
                  <Ship className="mr-1.5 h-4 w-4" />
                  Open Sea desk
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
