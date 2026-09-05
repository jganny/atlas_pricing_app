"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Inbox, Loader2, Plane, Ship } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useInbox } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { patchInboxEnquiry } from "@/lib/firebase/inbox";
import { canSeeInboxItem, detectEnquiryMode } from "@/lib/mail/inbox-assign";
import { ATLAS_IMAP, MAILBOX_TEAMS, deskDisplayName } from "@/lib/quotes/team-roles";
import { parseAirEnquiry, parseSeaEnquiry } from "@/lib/pricing/parse-enquiry";
import { storeSmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";
import type { InboxEnquiry, InboxTag } from "@/lib/types";

type FilterTab = "action" | "all" | "follow_up";

function tagTone(tag?: InboxTag): "neutral" | "success" | "warn" | "info" {
  if (tag === "new_enquiry") return "success";
  if (tag === "needs_human") return "warn";
  if (tag === "follow_up") return "info";
  return "neutral";
}

function tagLabel(tag?: InboxTag) {
  if (tag === "new_enquiry") return "New enquiry";
  if (tag === "needs_human") return "Needs review";
  if (tag === "follow_up") return "Follow-up";
  return "Enquiry";
}

export default function EnquiryInboxPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: rows = [], isLoading } = useInbox();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modeOverride, setModeOverride] = useState<"air" | "sea" | null>(null);
  const [filter, setFilter] = useState<FilterTab>("action");

  const visible = useMemo(() => {
    const mine = rows.filter((r) => canSeeInboxItem(user?.username, user?.role, r));
    if (filter === "action") {
      return mine.filter(
        (r) =>
          r.actionRequired !== false &&
          (r.tag === "new_enquiry" || r.tag === "needs_human" || !r.tag) &&
          r.status === "new",
      );
    }
    if (filter === "follow_up") return mine.filter((r) => r.tag === "follow_up");
    return mine;
  }, [rows, user?.username, user?.role, filter]);

  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null;

  const actionCount = rows.filter(
    (r) =>
      canSeeInboxItem(user?.username, user?.role, r) &&
      r.actionRequired !== false &&
      (r.tag === "new_enquiry" || r.tag === "needs_human" || !r.tag) &&
      r.status === "new",
  ).length;

  const resolvedMode: "air" | "sea" = (() => {
    if (modeOverride) return modeOverride;
    if (selected?.mode === "sea") return "sea";
    if (selected?.mode === "air") return "air";
    const blob = `${selected?.subject || ""}\n${selected?.bodyPreview || selected?.body || ""}`;
    if (detectEnquiryMode(blob) === "sea") return "sea";
    return "air";
  })();

  const deskParsed = useMemo(() => {
    if (!selected) return null;
    if (selected.parsed?.origin || selected.parsed?.destination || selected.parsed?.customer) {
      return selected.parsed;
    }
    const text = `${selected.subject}\n${selected.bodyPreview || selected.body || ""}`;
    return resolvedMode === "sea" ? parseSeaEnquiry(text) : parseAirEnquiry(text);
  }, [selected, resolvedMode]);

  async function applyToDesk(item: InboxEnquiry, desk: "air" | "sea") {
    const text = `${item.subject}\n${item.bodyPreview || item.body || ""}`;
    const fromText = desk === "sea" ? parseSeaEnquiry(text) : parseAirEnquiry(text);
    const parsed = {
      ...fromText,
      customer: item.parsed?.customer || fromText.customer,
      origin: item.parsed?.origin || fromText.origin,
      destination: item.parsed?.destination || fromText.destination,
      packages: item.parsed?.packages?.length ? item.parsed.packages : fromText.packages,
      containers: item.parsed?.containers?.length ? item.parsed.containers : fromText.containers,
      confidence: Math.max(item.parsed?.confidence || 0, fromText.confidence || 0),
      source: "email-imap",
    };
    if (!parsed.origin || !parsed.destination) {
      toast("Lane incomplete — open the desk and fill POL/POD manually", "error");
    }
    storeSmartQuotePrefill({
      mode: desk,
      parsed,
      carrierLabel: parsed.airlineLabel || parsed.linerLabel || "From enquiry intake",
      tariffFound: false,
      createdAt: Date.now(),
    });
    if (useLiveData) {
      setBusy(true);
      try {
        await patchInboxEnquiry(item.id, {
          status: "applied",
          claimedBy: user?.username ?? null,
          actionRequired: false,
        });
      } catch {
        /* mock / rules */
      } finally {
        setBusy(false);
      }
    }
    toast(`Opening ${desk === "sea" ? "Sea" : "Air"} desk`, "success");
    router.push(desk === "sea" ? "/sea/?smart=1" : "/air/?smart=1");
  }

  async function claim(item: InboxEnquiry) {
    if (!user?.username) return;
    if (!useLiveData) {
      toast("Mock mode — claim is live-only", "info");
      return;
    }
    setBusy(true);
    try {
      await patchInboxEnquiry(item.id, { status: "claimed", claimedBy: user.username });
      toast("Claimed — this enquiry is yours", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Claim failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss(item: InboxEnquiry) {
    if (!useLiveData) {
      toast("Mock mode — dismiss is live-only", "info");
      return;
    }
    setBusy(true);
    try {
      await patchInboxEnquiry(item.id, { status: "ignored", actionRequired: false });
      toast("Marked ignored (mail still on IMAP)", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Inbox className="h-5 w-5 text-[var(--color-atlas-sky)]" />
          <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Enquiry intake</h1>
          {actionCount ? (
            <Badge tone="warn">
              <Flag className="mr-1 inline h-3 w-3" />
              {actionCount} to action
            </Badge>
          ) : (
            <Badge tone="success">Caught up</Badge>
          )}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
          Classifies mail from {MAILBOX_TEAMS.pricing.email} and {MAILBOX_TEAMS.pricingsales.email} (
          {ATLAS_IMAP.host}). Only slim enquiry tickets are stored — full messages stay on IMAP.
          Noise is dropped.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["action", "Needs action"],
            ["follow_up", "Follow-ups"],
            ["all", "All tickets"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              filter === id
                ? "bg-[var(--color-atlas-navy)] text-white"
                : "border border-[var(--color-border)] bg-white text-[var(--color-atlas-navy)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="overflow-hidden p-0 lg:col-span-1">
          {isLoading ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading intake…</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">
              No tickets in this view. New enquiries and review flags appear here; noise is not
              stored.
            </p>
          ) : (
            <ul>
              {visible.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(row.id);
                      setModeOverride(null);
                    }}
                    className={`w-full border-b border-[var(--color-border)] px-4 py-3 text-left hover:bg-slate-50 ${
                      selected?.id === row.id ? "bg-sky-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {row.mode === "sea" ? (
                        <Ship className="h-3.5 w-3.5 shrink-0 text-sky-700" />
                      ) : (
                        <Plane className="h-3.5 w-3.5 shrink-0 text-violet-700" />
                      )}
                      <span className="truncate text-sm font-bold">{row.subject}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={tagTone(row.tag)}>{tagLabel(row.tag)}</Badge>
                      {row.actionRequired !== false && row.status === "new" ? (
                        <Badge tone="warn">action</Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {row.from || row.mailboxEmail} · {row.status}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-3 py-3 lg:col-span-2">
          {!selected ? (
            <p className="text-sm text-[var(--color-text-muted)]">Select a ticket.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tagTone(selected.tag)}>{tagLabel(selected.tag)}</Badge>
                <Badge tone={selected.mode === "unknown" ? "warn" : "info"}>{selected.mode}</Badge>
                <Badge tone="neutral">{selected.confidence}%</Badge>
                {selected.classifier ? <Badge tone="neutral">{selected.classifier}</Badge> : null}
                <span className="text-xs text-[var(--color-text-muted)]">Open as:</span>
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 text-xs font-bold ${
                    resolvedMode === "air" ? "bg-amber-500 text-white" : "border bg-white"
                  }`}
                  onClick={() => setModeOverride("air")}
                >
                  Air
                </button>
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 text-xs font-bold ${
                    resolvedMode === "sea" ? "bg-sky-600 text-white" : "border bg-white"
                  }`}
                  onClick={() => setModeOverride("sea")}
                >
                  Sea
                </button>
              </div>
              <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">{selected.subject}</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                From {selected.from || "—"} · suggested{" "}
                {selected.suggestedUser ? deskDisplayName(selected.suggestedUser) : "shared mailbox"}
              </p>
              {selected.summary || selected.reason ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {selected.summary || selected.reason}
                </p>
              ) : null}
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Customer</dt>
                  <dd className="font-semibold">{deskParsed?.customer || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Lane</dt>
                  <dd className="font-semibold">
                    {deskParsed?.origin || "—"} → {deskParsed?.destination || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Cargo</dt>
                  <dd className="font-semibold">
                    {resolvedMode === "air"
                      ? deskParsed?.packages?.length
                        ? `${deskParsed.packages.length} pkg line(s)`
                        : "—"
                      : deskParsed?.containers?.length
                        ? deskParsed.containers.map((c) => `${c.qty}×${c.type}`).join(", ")
                        : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Mailbox</dt>
                  <dd className="font-semibold">{selected.mailboxEmail || selected.mailbox}</dd>
                </div>
              </dl>
              <div>
                <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                  Preview only (full mail on IMAP)
                </div>
                <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap">
                  {selected.bodyPreview || selected.body || "—"}
                </pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void applyToDesk(selected, resolvedMode)}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Quote on {resolvedMode === "sea" ? "Sea" : "Air"} desk
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void claim(selected)}
                >
                  Claim for me
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => void dismiss(selected)}>
                  Ignore
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
