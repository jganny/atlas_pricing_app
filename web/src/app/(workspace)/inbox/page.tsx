"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Flag, Inbox, Loader2, Paperclip, Plane, Ship } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
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
import { peekSmartQuotePrefill, storeSmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";
import type { InboxEnquiry } from "@/lib/types";

type ReadMode = "text" | "ai";

const VIEW_GROUPS: Array<{ title: string; keys: ViewKey[] }> = [
  { title: "Views", keys: ["all", "mine", "others", "due", "past", "followup"] },
  { title: "By type", keys: ["air", "sea"] },
  { title: "By mailbox", keys: ["mb:pricing", "mb:pricingsales"] },
];

const URGENCY_CLASS: Record<Urgency, string> = {
  past: "bg-red-50 text-red-700",
  soon: "bg-amber-50 text-amber-800",
  ok: "bg-slate-100 text-slate-700",
};

function tagLabel(tag?: string) {
  if (tag === "new_enquiry") return "New enquiry";
  if (tag === "needs_human") return "Needs review";
  if (tag === "follow_up") return "Follow-up";
  return "Enquiry";
}

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

  const mine = useMemo(() => rows.filter((r) => canSeeInboxItem(user?.username, user?.role, r)), [rows, user?.username, user?.role]);
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
  const readMode: ReadMode = readChoice ?? (hasFiles ? "ai" : "text");

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

  const quoteBlocked = state.kind === "other" || state.kind === "asked";
  const rb = selected ? replyBy(selected, now) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Inbox className="h-5 w-5 text-[var(--color-atlas-sky)]" />
        <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Inbox</h1>
        {counts.past ? (
          <Badge tone="warn">
            <Flag className="mr-1 inline h-3 w-3" />
            {counts.past} past its time
          </Badge>
        ) : counts.all ? (
          <Badge tone="info">{counts.all} open</Badge>
        ) : (
          <Badge tone="success">Caught up</Badge>
        )}
        <span className="text-xs text-[var(--color-text-muted)]">Soonest reply-by first. Emails are opened live from the mailbox and are not saved here.</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[210px_minmax(0,340px)_minmax(0,1fr)]">
        {/* folders */}
        <Card className="p-2 lg:self-start">
          {VIEW_GROUPS.map((g) => (
            <div key={g.title} className="mb-2">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{g.title}</div>
              {g.keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setView(k);
                    setSelectedId(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${view === k ? "bg-slate-200 font-bold" : "hover:bg-slate-100"}`}
                  data-testid={`inbox-view-${k}`}
                >
                  <span>{VIEW_LABELS[k]}</span>
                  <span className={`text-xs tabular-nums ${k === "past" && counts[k] ? "rounded-full bg-red-50 px-1.5 font-bold text-red-700" : k === "due" && counts[k] ? "rounded-full bg-amber-50 px-1.5 font-bold text-amber-800" : "text-[var(--color-text-muted)]"}`}>
                    {counts[k]}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </Card>

        {/* list */}
        <Card className="overflow-hidden p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading the Inbox…</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">Nothing in this folder. New enquiries appear here by themselves, and noise is never kept.</p>
          ) : (
            <ul>
              {visible.map((row) => {
                const r = replyBy(row, now);
                const u = urgencyOf(r.at, now);
                const st = workState(row, user?.username, now);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(row.id);
                        setModeOverride(null);
                        setReadChoice(null);
                      }}
                      className={`w-full border-b border-[var(--color-border)] px-3 py-2.5 text-left hover:bg-slate-50 ${selected?.id === row.id ? "bg-sky-50" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        {row.mode === "sea" ? <Ship className="h-3.5 w-3.5 shrink-0 text-sky-700" /> : <Plane className="h-3.5 w-3.5 shrink-0 text-violet-700" />}
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">{senderDisplay(row.from)}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${URGENCY_CLASS[u]}`}>
                          <Clock className="mr-0.5 inline h-3 w-3" />
                          {timeLeftText(r.at, now)}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-sm">{row.subject}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[var(--color-text-muted)]">
                        <span>{r.basis === "client" ? `Client deadline ${r.localText}` : `${r.zone.city} closes ${r.localText}`}</span>
                        {st.kind === "other" || st.kind === "asked" || st.kind === "can-take" ? <Badge tone="info">{st.worker.name} is quoting</Badge> : null}
                        {st.kind === "mine" ? <Badge tone="success">You are quoting</Badge> : null}
                        {st.kind === "incoming" ? <Badge tone="warn">{st.request.name} asks to take this</Badge> : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* reading pane */}
        <Card className="min-w-0 space-y-3">
          {!selected ? (
            <p className="text-sm text-[var(--color-text-muted)]">Select an enquiry to read it.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{tagLabel(selected.tag)}</Badge>
                {rb ? (
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${URGENCY_CLASS[urgencyOf(rb.at, now)]}`}>
                    Reply by {rb.localText}, {timeLeftText(rb.at, now)}
                  </span>
                ) : null}
                <span className="text-xs text-[var(--color-text-muted)]">{rb?.basis === "client" ? "The client gave this deadline" : `${rb?.zone.city} office closes at 18:00`}</span>
                <span className="ml-auto text-xs text-[var(--color-text-muted)]">Open as:</span>
                <button type="button" className={`rounded-md px-2 py-1 text-xs font-bold ${resolvedMode === "air" ? "bg-amber-500 text-white" : "border bg-white"}`} onClick={() => setModeOverride("air")}>
                  Air
                </button>
                <button type="button" className={`rounded-md px-2 py-1 text-xs font-bold ${resolvedMode === "sea" ? "bg-sky-600 text-white" : "border bg-white"}`} onClick={() => setModeOverride("sea")}>
                  Sea
                </button>
              </div>

              <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">{selected.subject}</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                From {selected.from || "—"} · to {selected.mailboxEmail || selected.mailbox}
                {selected.suggestedUser ? ` · usual desk ${deskDisplayName(selected.suggestedUser)}` : ""}
              </p>

              {state.kind === "mine" ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900" data-testid="inbox-mine-note">
                  You are quoting this. Your colleague on the mailbox can see that.
                </p>
              ) : null}
              {state.kind === "other" ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="inbox-working-note">
                  <span className="font-semibold">
                    {state.worker.name} is quoting this (opened {agoText(state.worker.at, now)}).
                  </span>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => void updateItem(selected, { takeoverRequest: askRequest({ username: user?.username ?? "", displayName: user?.displayName }) }, `Asked ${state.worker.name} to hand it over`)}>
                    Ask {state.worker.name} to hand it over
                  </Button>
                </div>
              ) : null}
              {state.kind === "asked" ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" data-testid="inbox-working-note">
                  You asked {state.worker.name} to hand this over. If there is no answer you can take it over in {state.waitLeftMin} min.
                </p>
              ) : null}
              {state.kind === "can-take" ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" data-testid="inbox-working-note">
                  {state.worker.name} did not answer in {TAKEOVER_WAIT_MINUTES} minutes. You can take it over now.
                </p>
              ) : null}
              {state.kind === "incoming" ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900" data-testid="inbox-takeover-request">
                  <span className="font-semibold">{state.request.name} asks to take this enquiry over.</span>
                  <Button type="button" disabled={busy} onClick={() => void updateItem(selected, handOverPatch(state.request), `Handed over to ${state.request.name}`)}>
                    Hand over
                  </Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => void updateItem(selected, { takeoverRequest: null }, "You keep it")}>
                    I am on it
                  </Button>
                </div>
              ) : null}

              <div>
                <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">The email</div>
                {full.status === "loading" ? (
                  <p className="mt-1 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" /> Opening the email…
                  </p>
                ) : (
                  <pre className="mt-1 max-h-[22rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm" data-testid="inbox-email-body">
                    {full.status === "ready" ? full.mail?.bodyText || "(no text in this email)" : selected.bodyPreview || selected.body || "—"}
                  </pre>
                )}
                {full.status === "error" ? <p className="mt-1 text-xs text-amber-800">{full.message} Showing the short preview.</p> : null}
                {full.status === "ready" && full.mail && full.mail.attachments.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {full.mail.attachments.map((a, i) => (
                      <button key={`${a.name}-${i}`} type="button" onClick={() => openAttachment(a)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50">
                        <Paperclip className="h-3.5 w-3.5" />
                        {a.name}
                        <span className="font-normal text-[var(--color-text-muted)]">{Math.max(1, Math.round(a.bytes.length / 1024))} KB · open</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Customer</dt>
                  <dd className="font-semibold">{deskParsed?.customer || senderDisplay(selected.from)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Lane</dt>
                  <dd className="font-semibold">
                    {deskParsed?.origin || "—"} → {deskParsed?.destination || "—"}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)] text-xs font-semibold" role="group" aria-label="How to read the email">
                  <button type="button" onClick={() => setReadChoice("text")} className={`px-3 py-1.5 ${readMode === "text" ? "bg-sky-100 text-sky-900" : "bg-white"}`}>
                    Text only, free
                  </button>
                  <button type="button" onClick={() => setReadChoice("ai")} disabled={!useLiveData} className={`border-l border-[var(--color-border)] px-3 py-1.5 ${readMode === "ai" ? "bg-sky-100 text-sky-900" : "bg-white"}`}>
                    <span className="font-bold text-sky-700">AI</span> text and attachments, about ₹1
                  </button>
                </div>
                <Button
                  type="button"
                  disabled={busy || quoteBlocked}
                  onClick={() => void applyToDesk(selected, resolvedMode, readMode)}
                  data-testid="inbox-quote-button"
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {state.kind === "can-take" ? "Take over and quote" : "Quote"} on {resolvedMode === "sea" ? "Sea" : "Air"} desk
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => void dismiss(selected)}>
                  Ignore
                </Button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]" data-testid="inbox-ai-note">
                {readMode === "ai"
                  ? "AI reads the words and the attachments once and fills the desk. That uses a little AI credit (about ₹1). Emails nobody opens cost nothing."
                  : "The desk is filled from the words of the email by fixed rules. No AI credit is used. Choose AI if the details are in an attachment."}
              </p>

              <EnquiryReplyDrafter
                key={selected.id}
                item={deskParsed ? { ...selected, parsed: deskParsed } : selected}
                mode={resolvedMode === "sea" ? "sea" : "air"}
                signOff={user?.displayName && !IS_DEMO_BUILD ? user.displayName : "Pricing Team"}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
