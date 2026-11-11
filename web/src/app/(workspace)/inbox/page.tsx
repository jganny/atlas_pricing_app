"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Clock, CornerUpLeft, Flag, Inbox, Loader2, Mail, Paperclip, Plane, Ship, Tag, TriangleAlert, User, Users } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useInbox } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { EnquiryReplyDrafter } from "@/components/EnquiryReplyDrafter";
import { IS_DEMO_BUILD } from "@/lib/demo-mode";
import { useLiveData } from "@/lib/api";
import { fetchInboxEml, patchInboxEnquiry, removeInboxItem } from "@/lib/firebase/inbox";
import type { InboxRef } from "@/lib/types";
import { setHubJobStatus } from "@/lib/firebase/hub-jobs";
import { useHubReader } from "@/hooks/use-hub-reader";
import { openJobHref } from "@/lib/hub/prefill";
import { parseEmailFile, type EmailAttachment, type ParsedEmail } from "@/lib/hub/email-file";
import { canSeeInboxItem, detectEnquiryMode } from "@/lib/mail/inbox-assign";
import { deskDisplayName } from "@/lib/quotes/team-roles";
import { parseAirEnquiry, parseSeaEnquiry } from "@/lib/pricing/parse-enquiry";
import { askRequest, agoText, handOverPatch, markWorking, TAKEOVER_WAIT_MINUTES, workState, type WorkState } from "@/lib/mail/inbox-working";
import { replyBy, timeLeftText, urgencyOf, type Urgency } from "@/lib/mail/reply-by";
import { VIEW_LABELS, listView, senderDisplay, viewCounts, type ViewKey } from "@/lib/mail/inbox-views";
import { labelsOf, LABEL_NAMES } from "@/lib/mail/inbox-labels";
import { peekSmartQuotePrefill, storeSmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";
import type { InboxEnquiry } from "@/lib/types";
import { aiAllowed, aiOffMessage } from "@/lib/ai/ai-switches";
import { useAiSwitches } from "@/lib/firebase/ai-switches";

type ReadMode = "text" | "ai";

const VIEW_GROUPS: Array<{ title: string; keys: ViewKey[] }> = [
  { title: "Views", keys: ["all", "mine", "others", "due", "past", "followup", "escalation"] },
  { title: "By type", keys: ["air", "sea"] },
  { title: "By mailbox", keys: ["mb:pricing", "mb:pricingsales"] },
  { title: "Labels", keys: ["label:dg", "label:pharma", "label:perishable", "label:deadline", "label:attachment"] },
];

const VIEW_ICONS: Record<ViewKey, ComponentType<{ className?: string }>> = {
  all: Inbox,
  mine: User,
  others: Users,
  due: Clock,
  past: Flag,
  followup: CornerUpLeft,
  escalation: TriangleAlert,
  air: Plane,
  sea: Ship,
  "mb:pricing": Mail,
  "mb:pricingsales": Mail,
  "label:dg": Tag,
  "label:pharma": Tag,
  "label:perishable": Tag,
  "label:deadline": Tag,
  "label:attachment": Tag,
};

const URGENCY_CLASS: Record<Urgency, string> = {
  past: "bg-red-50 text-red-700",
  soon: "bg-amber-50 text-amber-800",
  ok: "bg-slate-100 text-slate-700",
};

type MailState = { status: "idle" | "loading" | "ready" | "error"; mail?: ParsedEmail; message?: string };

/** Emails opened in this tab, kept in memory only (never saved, never written to disk), a dozen at a time. */
const OPENED_EMAILS = new Map<string, ParsedEmail>();

/** The whole email behind an Inbox card, fetched live from the mailbox. */
function useFullEmail(id: string | null, live: boolean): MailState {
  const [res, setRes] = useState<{ id: string; status: "ready" | "error"; mail?: ParsedEmail; message?: string } | null>(null);
  useEffect(() => {
    if (!id || !live || OPENED_EMAILS.has(id)) return;
    let alive = true;
    void (async () => {
      try {
        const bytes = await fetchInboxEml(id);
        const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        const mail = await parseEmailFile("mail.eml", ab);
        OPENED_EMAILS.set(id, mail);
        if (OPENED_EMAILS.size > 12) OPENED_EMAILS.delete(OPENED_EMAILS.keys().next().value as string);
        if (alive) setRes({ id, status: "ready", mail });
      } catch (e) {
        if (alive) setRes({ id, status: "error", message: e instanceof Error ? e.message : "The email could not be opened." });
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, live]);
  if (!id || !live) return { status: "idle" };
  const hit = OPENED_EMAILS.get(id);
  if (hit) return { status: "ready", mail: hit };
  if (res && res.id === id) return res;
  return { status: "loading" };
}

function openAttachment(a: EmailAttachment) {
  const url = URL.createObjectURL(new Blob([a.bytes as BlobPart], { type: a.mime || "application/octet-stream" }));
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.download = a.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function EnquiryInboxPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: rows = [], isLoading } = useInbox();
  const [view, setView] = useState<ViewKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { readEmailBytes } = useHubReader();
  const [modeOverride, setModeOverride] = useState<"air" | "sea" | null>(null);
  const [readChoice, setReadChoice] = useState<ReadMode | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const mine = useMemo(() => rows.filter((r) => canSeeInboxItem(user?.username, user?.role, r, user?.email)), [rows, user?.username, user?.role, user?.email]);
  const counts = useMemo(() => viewCounts(mine, user?.username, now), [mine, user?.username, now]);
  const visible = useMemo(() => listView(mine, view, user?.username, now), [mine, view, user?.username, now]);
  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null;
  const full = useFullEmail(selected?.id ?? null, useLiveData);
  const state: WorkState = selected ? workState(selected, user?.username, now) : { kind: "free" };

  const resolvedMode: "air" | "sea" = (() => {
    if (modeOverride) return modeOverride;
    if (selected?.mode === "sea") return "sea";
    if (selected?.mode === "air") return "air";
    const blob = `${selected?.subject || ""}\n${selected?.bodyPreview || selected?.body || ""}`;
    return detectEnquiryMode(blob) === "sea" ? "sea" : "air";
  })();

  /** Emails with attachments are worth the AI read; a plain text enquiry is filled free from its words. The person can always choose. */
  const hasFiles = (full.mail?.attachments.length ?? 0) > 0;
  const aiSwitches = useAiSwitches();
  const aiOn = aiAllowed(aiSwitches, "quoteHub");
  const readMode: ReadMode = !aiOn ? "text" : readChoice ?? (hasFiles ? "ai" : "text");

  const deskParsed = useMemo(() => {
    if (!selected) return null;
    if (selected.parsed?.origin || selected.parsed?.destination || selected.parsed?.customer) return selected.parsed;
    const text = `${selected.subject}\n${full.mail?.bodyText || selected.bodyPreview || selected.body || ""}`;
    return resolvedMode === "sea" ? parseSeaEnquiry(text) : parseAirEnquiry(text);
  }, [selected, resolvedMode, full.mail]);

  /** What a quote remembers about this email: who to reply to, and the subject. */
  function inboxRefOf(item: InboxEnquiry): InboxRef {
    const m = /^(.*?)\s*<([^>]+)>\s*$/.exec(item.from || "");
    return { id: item.id, fromEmail: (m ? m[2] : item.from || "").trim(), ...(m && m[1].trim() ? { fromName: m[1].trim().replace(/^"|"$/g, "") } : {}), subject: item.subject || "" };
  }

  /** The Quote Hub path stores its own prefill: add the email link to it. */
  function stampInboxRef(item: InboxEnquiry) {
    const p = peekSmartQuotePrefill();
    if (p) storeSmartQuotePrefill({ ...p, inboxRef: inboxRefOf(item) });
  }

  /**
   * Quote on a desk. "Text only" fills the desk from the words of the whole email (free). "AI" also reads the attachments, once,
   * and uses a little AI credit. Either way the person is marked as quoting, so a colleague on the same mailbox sees it.
   */
  async function applyToDesk(item: InboxEnquiry, desk: "air" | "sea", how: ReadMode) {
    if (useLiveData && user) {
      try {
        await patchInboxEnquiry(item.id, { workingBy: markWorking({ username: user.username, displayName: user.displayName }), takeoverRequest: null });
      } catch {
        /* the mark is a courtesy: never stop the work for it */
      }
    }
    if (useLiveData && how === "ai") {
      setBusy(true);
      try {
        toast("Reading the whole email and its attachments…", "info");
        const bytes = await fetchInboxEml(item.id);
        const job = await readEmailBytes(`${(item.subject || "enquiry").replace(/[\\/:*?"<>|]+/g, " ").slice(0, 80)}.eml`, bytes);
        if (job) {
          const forDesk = { ...job, mode: desk, extraction: { ...job.extraction, mode: desk } };
          try {
            await patchInboxEnquiry(item.id, { status: "applied", claimedBy: user?.username ?? null, actionRequired: false });
          } catch {
            /* rules */
          }
          void setHubJobStatus(job.id, "opened").catch(() => undefined);
          toast(`Opening ${desk === "sea" ? "Sea" : "Air"} desk`, "success");
          const href = openJobHref(forDesk);
          stampInboxRef(item);
          router.push(href);
          return;
        }
      } catch (e) {
        toast(e instanceof Error ? `${e.message} Using the words of the email instead.` : "Could not read the attachments. Using the words of the email instead.", "info");
      } finally {
        setBusy(false);
      }
    }
    const text = `${item.subject}\n${full.mail?.bodyText || item.bodyPreview || item.body || ""}`;
    const fromText = desk === "sea" ? parseSeaEnquiry(text) : parseAirEnquiry(text);
    const parsed = {
      ...fromText,
      customer: item.parsed?.customer || fromText.customer || senderDisplay(item.from),
      origin: item.parsed?.origin || fromText.origin,
      destination: item.parsed?.destination || fromText.destination,
      packages: item.parsed?.packages?.length ? item.parsed.packages : fromText.packages,
      containers: item.parsed?.containers?.length ? item.parsed.containers : fromText.containers,
      confidence: Math.max(item.parsed?.confidence || 0, fromText.confidence || 0),
      source: "email-imap",
    };
    if (!parsed.origin || !parsed.destination) toast("Lane incomplete — open the desk and fill POL/POD manually", "error");
    storeSmartQuotePrefill({
      mode: desk,
      parsed,
      carrierLabel: parsed.airlineLabel || parsed.linerLabel || "From enquiry intake",
      tariffFound: false,
      createdAt: Date.now(),
      inboxRef: inboxRefOf(item),
    });
    if (useLiveData) {
      try {
        await patchInboxEnquiry(item.id, { status: "applied", claimedBy: user?.username ?? null, actionRequired: false });
      } catch {
        /* mock / rules */
      }
    }
    toast(`Opening ${desk === "sea" ? "Sea" : "Air"} desk`, "success");
    router.push(desk === "sea" ? "/sea/?smart=1" : "/air/?smart=1");
  }

  async function updateItem(item: InboxEnquiry, patch: Parameters<typeof patchInboxEnquiry>[1], done: string) {
    if (!useLiveData) {
      toast("This works in the live app", "info");
      return;
    }
    setBusy(true);
    try {
      await patchInboxEnquiry(item.id, patch);
      toast(done, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss(item: InboxEnquiry) {
    if (!useLiveData) {
      toast("Mock mode — ignore is live-only", "info");
      return;
    }
    setBusy(true);
    try {
      await removeInboxItem(item.id);
      setSelectedId(null);
      toast("Removed from the app (the email is still in the mailbox)", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function resolveItem(item: InboxEnquiry) {
    await updateItem(item, { status: "resolved", actionRequired: false }, "Marked resolved");
    setSelectedId(null);
  }

  const quoteBlocked = state.kind === "other" || state.kind === "asked";
  const rb = selected ? replyBy(selected, now) : null;
  const receivedText = selected?.receivedAt ? new Date(selected.receivedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-atlas-navy)]">Inbox</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Enquiries in the order they must be answered. Emails are opened live from the mailbox and are not saved here.</p>
        </div>
        <span className="ml-auto flex items-center gap-2 text-sm">
          {counts.past ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 font-semibold text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-600" />
              {counts.past} past its time
            </span>
          ) : null}
          {counts.due ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {counts.due} due within the hour
            </span>
          ) : null}
          {!counts.past && !counts.due ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-600" />On time</span> : null}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm lg:grid lg:h-[calc(100vh-190px)] lg:min-h-[560px] lg:grid-cols-[224px_368px_minmax(0,1fr)]">
        {/* folders */}
        <aside aria-label="Folders" className="overflow-y-auto border-b border-[var(--color-border)] bg-slate-50/80 px-2 py-3 lg:border-b-0 lg:border-r">
          {VIEW_GROUPS.map((g) => (
            <div key={g.title} className="mb-3">
              <div className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{g.title}</div>
              {g.keys.map((k) => {
                const Icon = VIEW_ICONS[k];
                const on = view === k;
                const pill = counts[k] && (k === "past" || k === "escalation") ? "bg-red-100 text-red-700" : counts[k] && k === "due" ? "bg-amber-100 text-amber-800" : counts[k] && (k === "mine" || k === "others") ? "bg-slate-800 text-white" : "text-[var(--color-text-muted)]";
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setView(k);
                      setSelectedId(null);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] transition-colors ${on ? "bg-white font-semibold text-[var(--color-atlas-navy)] shadow-sm ring-1 ring-[var(--color-border)]" : "font-medium text-slate-700 hover:bg-white/70"}`}
                    data-testid={`inbox-view-${k}`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${on ? "text-[var(--color-atlas-sky)]" : "text-slate-500"}`} />
                    <span className="flex-1">{VIEW_LABELS[k]}</span>
                    <span className={`min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums ${pill}`}>{counts[k]}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* list */}
        <section aria-label="Emails" className="overflow-y-auto border-b border-[var(--color-border)] lg:border-b-0 lg:border-r">
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--color-border)] bg-white/95 px-4 py-3 backdrop-blur">
            <div className="flex-1">
              <div className="text-[15px] font-semibold">{VIEW_LABELS[view]}</div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {visible.length} {visible.length === 1 ? "enquiry" : "enquiries"}, soonest reply-by first
              </div>
            </div>
          </div>
          {isLoading ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading the Inbox…</p>
          ) : visible.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Inbox className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">Nothing in this folder</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">New enquiries appear here by themselves. Noise is never kept.</p>
            </div>
          ) : (
            <ul>
              {visible.map((row) => {
                const r = replyBy(row, now);
                const u = urgencyOf(r.at, now);
                const st = workState(row, user?.username, now);
                const sel = selected?.id === row.id;
                const dot = u === "past" ? "bg-red-500" : u === "soon" ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(row.id);
                        setModeOverride(null);
                        setReadChoice(null);
                      }}
                      className={`block w-full border-b border-[var(--color-border)]/70 px-4 py-3 text-left transition-colors ${sel ? "bg-sky-50" : "hover:bg-slate-50"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-slate-900">{senderDisplay(row.from)}</span>
                        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums ${URGENCY_CLASS[u]}`}>{timeLeftText(r.at, now)}</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-slate-800">{row.subject}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--color-text-muted)]">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                          {row.mode === "sea" ? <Ship className="h-3 w-3" /> : <Plane className="h-3 w-3" />}
                          {row.mode === "sea" ? "Sea" : "Air"}
                        </span>
                        {row.tag === "escalation" ? <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-800"><TriangleAlert className="h-3 w-3" />Problem on a shipment</span> : <span>{r.basis === "client" ? `Client deadline ${r.localText}` : `${r.zone.city} closes ${r.localText}`}</span>}
                        {labelsOf(row).filter((l) => l !== "deadline").map((l) => (
                          <span key={l} className="rounded bg-violet-50 px-1.5 py-0.5 font-medium text-violet-800">{LABEL_NAMES[l]}</span>
                        ))}
                        {st.kind === "other" || st.kind === "asked" || st.kind === "can-take" ? <span className="rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-800">{st.worker.name} is quoting</span> : null}
                        {st.kind === "mine" ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">You are quoting</span> : null}
                        {row.repliedAt ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800">Replied from Outlook</span> : null}
                        {st.kind === "incoming" ? <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">{st.request.name} asks to take this</span> : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* reading pane */}
        <article aria-label="Email" className="flex min-w-0 flex-col overflow-y-auto">
          {!selected ? (
            <div className="px-8 py-16 text-center text-sm text-[var(--color-text-muted)]">Select an enquiry to read it.</div>
          ) : (
            <>
              <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-slate-50/95 px-5 py-3 backdrop-blur">
                {selected.tag === "escalation" ? (
                  <Button type="button" disabled={busy} onClick={() => void resolveItem(selected)} data-testid="inbox-resolve-button">
                    <CircleCheck className="mr-2 h-4 w-4" />
                    Mark resolved
                  </Button>
                ) : null}
                {selected.tag === "escalation" ? null : <Button type="button" disabled={busy || quoteBlocked} onClick={() => void applyToDesk(selected, resolvedMode, readMode)} data-testid="inbox-quote-button">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {state.kind === "can-take" ? "Take over and quote" : "Quote"} on {resolvedMode === "sea" ? "Sea" : "Air"} desk
                </Button>}
                {selected.tag === "escalation" ? null : <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)] bg-white text-xs font-medium shadow-sm" role="group" aria-label="How to read the email">
                  <button type="button" onClick={() => setReadChoice("text")} className={`px-3 py-2 ${readMode === "text" ? "bg-sky-100 font-semibold text-sky-900" : "text-slate-700 hover:bg-slate-50"}`}>
                    Text only, free
                  </button>
                  <button type="button" onClick={() => setReadChoice("ai")} disabled={!useLiveData || !aiOn} title={aiOn ? undefined : aiOffMessage(aiSwitches, "quoteHub")} className={`border-l border-[var(--color-border)] px-3 py-2 ${readMode === "ai" ? "bg-sky-100 font-semibold text-sky-900" : "text-slate-700 hover:bg-slate-50"}`}>
                    <span className="font-bold text-sky-700">AI</span> {aiOn ? "text and attachments, about ₹1" : "is switched off by your admin"}
                  </button>
                </div>}
                {selected.tag === "escalation" ? null : <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)] bg-white text-xs font-semibold shadow-sm" role="group" aria-label="Which desk">
                  <button type="button" className={`px-3 py-2 ${resolvedMode === "air" ? "bg-amber-500 text-white" : "text-slate-700 hover:bg-slate-50"}`} onClick={() => setModeOverride("air")}>
                    Air
                  </button>
                  <button type="button" className={`border-l border-[var(--color-border)] px-3 py-2 ${resolvedMode === "sea" ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-50"}`} onClick={() => setModeOverride("sea")}>
                    Sea
                  </button>
                </div>}
                <Button type="button" variant="ghost" disabled={busy} onClick={() => void dismiss(selected)} className="ml-auto">
                  Ignore
                </Button>
              </div>

              <div className="space-y-4 px-6 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  {rb ? (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${URGENCY_CLASS[urgencyOf(rb.at, now)]}`}>
                      <Clock className="h-3.5 w-3.5" />
                      Reply by {rb.localText} · {timeLeftText(rb.at, now)}
                    </span>
                  ) : null}
                  <span className="text-xs text-[var(--color-text-muted)]">{rb?.basis === "client" ? "The client gave this deadline" : `${rb?.zone.city} office closes at 18:00`}</span>
                </div>

                {selected.tag === "escalation" ? (
                  <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-900" data-testid="inbox-escalation-note">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      A problem on a shipment. {selected.reason ? `${selected.reason}. ` : ""}It stays here for everyone on {selected.mailboxEmail || selected.mailbox} until someone marks it resolved. Reply from Outlook as usual.
                    </span>
                  </p>
                ) : null}
                <h2 className="text-xl font-semibold leading-snug tracking-tight text-slate-900">{selected.subject}</h2>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-atlas-navy)] text-sm font-semibold text-white">
                    {senderDisplay(selected.from).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 text-sm leading-5">
                    <div>
                      <span className="font-semibold text-slate-900">{senderDisplay(selected.from)}</span>{" "}
                      <span className="text-[var(--color-text-muted)]">{/<([^>]+)>/.exec(selected.from || "")?.[1] ?? ""}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      to {selected.mailboxEmail || selected.mailbox}
                      {receivedText ? ` · ${receivedText}` : ""}
                      {selected.suggestedUser ? ` · usual desk ${deskDisplayName(selected.suggestedUser)}` : ""}
                    </div>
                  </div>
                </div>

                {state.kind === "mine" ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900" data-testid="inbox-mine-note">
                    You are quoting this. Your colleague on the mailbox can see that.
                  </p>
                ) : null}
                {state.kind === "other" ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900" data-testid="inbox-working-note">
                    <span className="font-medium">
                      {state.worker.name} is quoting this (opened {agoText(state.worker.at, now)}).
                    </span>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void updateItem(selected, { takeoverRequest: askRequest({ username: user?.username ?? "", displayName: user?.displayName }) }, `Asked ${state.worker.name} to hand it over`)}>
                      Ask {state.worker.name} to hand it over
                    </Button>
                  </div>
                ) : null}
                {state.kind === "asked" ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900" data-testid="inbox-working-note">
                    You asked {state.worker.name} to hand this over. If there is no answer you can take it over in {state.waitLeftMin} min.
                  </p>
                ) : null}
                {state.kind === "can-take" ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900" data-testid="inbox-working-note">
                    {state.worker.name} did not answer in {TAKEOVER_WAIT_MINUTES} minutes. You can take it over now.
                  </p>
                ) : null}
                {state.kind === "incoming" ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900" data-testid="inbox-takeover-request">
                    <span className="font-medium">{state.request.name} asks to take this enquiry over.</span>
                    <Button type="button" disabled={busy} onClick={() => void updateItem(selected, handOverPatch(state.request), `Handed over to ${state.request.name}`)}>
                      Hand over
                    </Button>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void updateItem(selected, { takeoverRequest: null }, "You keep it")}>
                      I am on it
                    </Button>
                  </div>
                ) : null}

                <div className="border-t border-[var(--color-border)] pt-4">
                  {full.status === "loading" ? (
                    <p className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                      <Loader2 className="h-4 w-4 animate-spin" /> Opening the email…
                    </p>
                  ) : (
                    <div className="max-w-[72ch] whitespace-pre-wrap text-[15px] leading-7 text-slate-800" data-testid="inbox-email-body">
                      {full.status === "ready" ? full.mail?.bodyText || "(no text in this email)" : selected.bodyPreview || selected.body || "—"}
                    </div>
                  )}
                  {full.status === "error" ? <p className="mt-2 text-xs text-amber-800">{full.message} Showing the short preview.</p> : null}
                </div>

                {full.status === "ready" && full.mail && full.mail.attachments.length ? (
                  <div className="flex flex-wrap gap-2">
                    {full.mail.attachments.map((a, i) => (
                      <button key={`${a.name}-${i}`} type="button" onClick={() => openAttachment(a)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs shadow-sm hover:bg-slate-50">
                        <Paperclip className="h-4 w-4 text-slate-500" />
                        <span className="font-semibold text-slate-800">{a.name}</span>
                        <span className="text-[var(--color-text-muted)]">{Math.max(1, Math.round(a.bytes.length / 1024))} KB · open</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="rounded-xl border border-[var(--color-border)] bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h3 className="text-sm font-semibold text-slate-900">What the {resolvedMode === "sea" ? "Sea" : "Air"} desk will start with</h3>
                    <span className="text-xs text-[var(--color-text-muted)]">Anything missing is marked before the desk opens.</span>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Customer</dt>
                      <dd className="mt-0.5 font-medium">{deskParsed?.customer || senderDisplay(selected.from)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Lane</dt>
                      <dd className="mt-0.5 font-medium">
                        {deskParsed?.origin || "—"} → {deskParsed?.destination || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Read with</dt>
                      <dd className="mt-0.5 font-medium">{readMode === "ai" ? "AI, text and attachments" : "Text only"}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-[var(--color-text-muted)]" data-testid="inbox-ai-note">
                    {readMode === "ai"
                      ? "AI reads the words and the attachments once and fills the desk. That uses a little AI credit (about ₹1). Emails nobody opens cost nothing."
                      : "The desk is filled from the words of the email by fixed rules. No AI credit is used. Choose AI if the details are in an attachment."}
                  </p>
                </div>

                <EnquiryReplyDrafter
                  key={selected.id}
                  item={deskParsed ? { ...selected, parsed: deskParsed } : selected}
                  mode={resolvedMode === "sea" ? "sea" : "air"}
                  signOff={user?.displayName && !IS_DEMO_BUILD ? user.displayName : "Pricing Team"}
                />
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
