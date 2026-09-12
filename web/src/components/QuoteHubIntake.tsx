"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock,
  FileUp,
  Inbox,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button, Card, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useEnquiries, useInbox } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { canSeeInboxItem } from "@/lib/mail/inbox-assign";
import { parseAirEnquiry, parseSeaEnquiry } from "@/lib/pricing/parse-enquiry";
import {
  SMART_QUOTE_ACCEPT,
  ingestEnquiryFile,
} from "@/lib/pricing/enquiry-ingest";
import { storeSmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";
import { parseDeskIntent, newQuoteHref } from "@/lib/ai/desk-intent";
import { deskModeForPaste } from "@/lib/pricing/quote-mode";
import { getLastSavedEnquiry } from "@/lib/quotes/local-enquiries";
import { deskEditHref, enquiryHref } from "@/lib/quotes/find-quotes";

function summaryToast(mode: string, parsed: { customer?: string; origin?: string; destination?: string; packages?: unknown[] }) {
  const bits = [
    mode === "sea" ? "Sea" : mode === "courier" ? "Courier" : "Air",
    parsed.customer,
    parsed.origin && parsed.destination ? `${parsed.origin} → ${parsed.destination}` : "",
    Array.isArray(parsed.packages) && parsed.packages.length ? `${parsed.packages.length} cargo line(s)` : "",
  ].filter(Boolean);
  return `Opening ${bits.join(" · ")}`;
}

export function QuoteHubIntake() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: enquiries = [] } = useEnquiries();
  const { data: inbox = [] } = useInbox();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const last = useMemo(() => {
    const pin = getLastSavedEnquiry();
    if (pin) {
      const row = enquiries.find((e) => e.id === pin.id);
      if (row) return row;
    }
    return enquiries.find((e) => e.status === "open" || e.status === "quoted") ?? null;
  }, [enquiries]);

  const overdue = useMemo(
    () =>
      [...enquiries]
        .filter((e) => (e.status === "open" || e.status === "quoted") && e.slaHoursOpen > 8)
        .sort((a, b) => b.slaHoursOpen - a.slaHoursOpen)[0] ?? null,
    [enquiries],
  );

  const nextMail = useMemo(
    () =>
      inbox.find(
        (r) =>
          canSeeInboxItem(user?.username, user?.role, r) &&
          r.actionRequired !== false &&
          r.status === "new",
      ) ?? null,
    [inbox, user?.role, user?.username],
  );

  function openFromText(raw: string, source = "hub-paste") {
    const blob = raw.trim();
    if (!blob) {
      toast("Paste the enquiry first", "error");
      return;
    }
    const mode = deskModeForPaste(blob);
    if (mode === "courier") {
      const parsed = parseAirEnquiry(blob);
      const intent = parseDeskIntent(`courier ${parsed.origin || ""} ${parsed.destination || ""}`.trim());
      const href =
        intent.kind === "new"
          ? newQuoteHref({ ...intent, mode: "courier" })
          : "/courier";
      toast(summaryToast("courier", parsed), "success");
      router.push(href);
      return;
    }
    if (mode === "transport") {
      toast("Opening Transport desk", "success");
      router.push("/transport");
      return;
    }
    if (mode === "warehouse") {
      toast("Opening Warehouse desk", "success");
      router.push("/warehouse");
      return;
    }
    const parsed = mode === "sea" ? parseSeaEnquiry(blob) : parseAirEnquiry(blob);
    parsed.source = source;
    storeSmartQuotePrefill({
      mode,
      parsed,
      carrierLabel: parsed.airlineLabel || parsed.linerLabel || "From Quote hub",
      tariffFound: false,
      createdAt: Date.now(),
    });
    toast(summaryToast(mode, parsed), "success");
    router.push(mode === "sea" ? "/sea/?smart=1" : "/air/?smart=1");
  }

  async function onFile(file: File) {
    setBusy(true);
    try {
      const ingested = await ingestEnquiryFile(file);
      setText(ingested.text);
      openFromText(ingested.text, ingested.source || file.name);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not read that file", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-atlas-navy)] text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-[var(--color-atlas-navy)]">Drop the job</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Paste the mail. Vertex reads Air freight vs Courier vs Sea — a MODE (AIR/COURIER)
              label does not send an air job to Courier — and fills the desk.
            </p>
          </div>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste: customer, origin, destination, weight… Vertex opens the right desk."
          className="min-h-[7.5rem]"
          data-testid="quote-hub-paste"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => openFromText(text)}
            data-testid="quote-hub-open"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Open the desk
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <FileUp className="mr-1.5 h-4 w-4" />
            Drop PDF / Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept={SMART_QUOTE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {last ? (
          <button
            type="button"
            className="rounded-xl border border-[var(--color-border)] bg-white p-4 text-left hover:border-[var(--color-atlas-gold)]"
            onClick={() => router.push(deskEditHref(last.mode, last.id))}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-atlas-navy)]">Continue</p>
            <p className="mt-1 text-sm font-extrabold text-[var(--color-atlas-navy)]">{last.customer}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{last.ref}</p>
          </button>
        ) : null}
        {overdue && overdue.id !== last?.id ? (
          <button
            type="button"
            className="rounded-xl border border-[var(--color-border)] bg-white p-4 text-left hover:border-[var(--color-atlas-gold)]"
            onClick={() => router.push(enquiryHref(overdue))}
          >
            <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              <Clock className="h-3 w-3" /> Overdue
            </p>
            <p className="mt-1 text-sm font-extrabold text-[var(--color-atlas-navy)]">{overdue.customer}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{overdue.slaHoursOpen}h open</p>
          </button>
        ) : null}
        {nextMail ? (
          <button
            type="button"
            className="rounded-xl border border-[var(--color-border)] bg-white p-4 text-left hover:border-[var(--color-atlas-gold)]"
            onClick={() => router.push("/inbox")}
          >
            <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-sky-800">
              <Inbox className="h-3 w-3" /> Inbox
            </p>
            <p className="mt-1 text-sm font-extrabold text-[var(--color-atlas-navy)] line-clamp-2">
              {nextMail.subject || "Unquoted mail"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Price this next</p>
          </button>
        ) : null}
      </div>
    </div>
  );
}
