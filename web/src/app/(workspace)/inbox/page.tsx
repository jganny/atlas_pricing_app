"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CircleCheck, Clock, CornerUpLeft, Flag, Inbox, Loader2, Mail, Paperclip, Plane, Search, Ship, Tag, TriangleAlert, User, Users } from "lucide-react";
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
import { inboxListPreview, inboxListWhen } from "@/lib/mail/inbox-list-row";
import { identityLines, mailIdentity } from "@/lib/mail/enquiry-identity";
import { isRateEnquiryToQuote } from "@/lib/mail/rate-enquiry";
import { labelsOf, LABEL_NAMES } from "@/lib/mail/inbox-labels";
import { peekSmartQuotePrefill, storeSmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";
import type { InboxEnquiry } from "@/lib/types";
import { aiAllowed, aiOffMessage } from "@/lib/ai/ai-switches";
import { EnquiryThread } from "@/components/EnquiryThread";
import { MailSearch } from "@/components/MailSearch";
import { TeamBoard } from "@/components/TeamBoard";
import { fetchInboxToday } from "@/lib/firebase/notifications";
import { CONTACT_TYPE_LABELS, type ContactType } from "@/lib/directory/email-directory";
import { useQuery } from "@tanstack/react-query";
import { useAiSwitches } from "@/lib/firebase/ai-switches";

type ReadMode = "text" | "ai";

const PRIMARY_VIEWS: ViewKey[] = ["all", "mine", "due", "past"];
const MORE_GROUPS: Array<{ title: string; keys: ViewKey[] }> = [
  { title: "Also", keys: ["others", "followup", "escalation"] },
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
  // "Open it now" on the work bar leaves the enquiry's id here; the Inbox opens on it.
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const id = window.sessionStorage.getItem("atlas_inbox_open");
      if (id) window.sessionStorage.removeItem("atlas_inbox_open");
      return id || null;
    } catch {
      return null;
    }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
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
  // What happened in the mailboxes today (circulars filed, circulars to file by hand) and whether the sender is a saved contact.
  const senderEmail = (/<([^>]+)>/.exec(selected?.from ?? "") || [])[1]?.toLowerCase() ?? String(selected?.from ?? "").toLowerCase();
  const today = useQuery({ queryKey: ["inboxToday", senderEmail], queryFn: () => fetchInboxToday(senderEmail ? [senderEmail] : []), staleTime: 60_000, refetchInterval: 120_000, retry: 0, enabled: useLiveData });
  const savedContact = today.data?.saved.find((s) => s.email === senderEmail);
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
  const rb = selected && isRateEnquiryToQuote(selected) ? replyBy(selected, now) : null;
  const ident = selected ? mailIdentity(selected) : null;
  const receivedText = selected?.receivedAt ? new Date(selected.receivedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const unread = (row: InboxEnquiry) => row.status === "new" && !row.workingBy;

  function openFolder(k: ViewKey) {
    setView(k);
    setSelectedId(null);
  }

  function folderButton(k: ViewKey) {
    const Icon = VIEW_ICONS[k];
    const on = view === k;
    return (
      <button
        key={k}
        type="button"
        onClick={() => openFolder(k)}
        className={`flex h-10 w-full items-center gap-2.5 rounded px-3 text-left text-[14px] ${on ? "bg-[#e1dfdd] font-semibold text-[#201f1e]" : "font-normal text-[#201f1e] hover:bg-[#edebe9]"}`}
        data-testid={`inbox-view-${k}`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${on ? "text-[#0078d4]" : "text-[#605e5c]"}`} />
        <span className="min-w-0 flex-1 truncate">{k === "all" ? "Inbox" : VIEW_LABELS[k]}</span>
        <span className="tabular-nums text-[13px] text-[#605e5c]">{counts[k] || ""}</span>
      </button>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white text-[#201f1e]">
      {searchOpen ? <MailSearch onClose={() => setSearchOpen(false)} /> : null}
      {boardOpen ? <TeamBoard rows={mine} onClose={() => setBoardOpen(false)} /> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_380px_minmax(0,1fr)]">
        <aside aria-label="Folders" className="overflow-y-auto border-b border-[#edebe9] bg-[#f3f2f1] px-2 py-5 lg:border-b-0 lg:border-r">
          <div className="px-3 pb-4 text-[20px] font-semibold tracking-tight">Inbox</div>
          {PRIMARY_VIEWS.map(folderButton)}
          <div className="mt-7 px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#605e5c]">Folders</div>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="flex h-9 w-full items-center gap-2 rounded px-3 text-left text-[13.5px] text-[#605e5c] hover:bg-[#edebe9]"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            More
          </button>
          {moreOpen
            ? MORE_GROUPS.map((g) => (
                <div key={g.title} className="mt-2">
                  <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#605e5c]">{g.title}</div>
                  {g.keys.map(folderButton)}
                </div>
              ))
            : MORE_GROUPS.flatMap((g) => g.keys).map((k) => (
                <span key={k} className="sr-only">
                  <button type="button" onClick={() => openFolder(k)} data-testid={`inbox-view-${k}`}>
                    {VIEW_LABELS[k]}
                  </button>
                </span>
              ))}
          {today.data && (today.data.circulars.length || today.data.unfiled.length) ? (
            <div className="mx-2 mt-6 border-t border-[#e1dfdd] px-1 pt-3 text-[12px] leading-5 text-[#605e5c]" data-testid="inbox-circular-strip">
              {today.data.circulars.length ? (
                <p>
                  Filed today: {today.data.circulars.length}. {today.data.circulars.slice(0, 2).map((c) => `${c.carrier ? `${c.carrier}: ` : ""}${c.title}`).join(" · ")}
                </p>
              ) : null}
              {today.data.unfiled.length ? (
                <p className="mt-1">
                  Needs filing ({today.data.unfiled.length}): {today.data.unfiled.slice(0, 2).map((u) => `${u.carrier}: ${u.subject}`).join(" · ")}.
                </p>
              ) : null}
            </div>
          ) : null}
        </aside>

        <section aria-label="Emails" className="min-h-0 overflow-y-auto border-b border-[#edebe9] bg-white lg:border-b-0 lg:border-r">
          <div className="flex items-end justify-between gap-3 px-5 pb-1 pt-5">
            <div className="text-[18px] font-semibold">{view === "all" ? "Inbox" : VIEW_LABELS[view]}</div>
            <div className="mb-0.5 flex items-center gap-1 text-[13px] text-[#605e5c]">
              <button type="button" onClick={() => setSearchOpen(true)} data-testid="inbox-search-button" className="inline-flex h-8 items-center gap-1.5 px-2 hover:bg-[#f3f2f1]">
                <Search className="h-3.5 w-3.5" />
                Search
              </button>
              <button type="button" onClick={() => setBoardOpen(true)} data-testid="inbox-board-button" className="h-8 px-2 hover:bg-[#f3f2f1]">
                Team board
              </button>
            </div>
          </div>
          <div className="mb-1 flex gap-6 border-b border-[#edebe9] px-5 text-[14px]">
            <span className="border-b-2 border-[#0078d4] py-2.5 font-semibold text-[#201f1e]">Focused</span>
            <span className="py-2.5 text-[#605e5c]">
              {visible.length} {visible.length === 1 ? "enquiry" : "enquiries"}
            </span>
          </div>
          {isLoading ? (
            <p className="p-8 text-sm text-[#605e5c]">Loading the Inbox…</p>
          ) : visible.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <Inbox className="mx-auto h-8 w-8 text-[#d2d0ce]" />
              <p className="mt-3 text-sm font-medium">Nothing in this folder</p>
              <p className="mt-1 text-xs text-[#605e5c]">New enquiries appear here by themselves.</p>
            </div>
          ) : (
            <ul>
              {visible.map((row) => {
                const st = workState(row, user?.username, now);
                const sel = selected?.id === row.id;
                const extra =
                  labelsOf(row)
                    .filter((l) => l !== "deadline")
                    .map((l) => LABEL_NAMES[l]);
                const previewBits = [
                  inboxListPreview(row),
                  ...extra,
                  st.kind === "mine" ? "You are quoting" : "",
                  st.kind === "other" || st.kind === "asked" || st.kind === "can-take" ? `${st.worker.name} is quoting` : "",
                  st.kind === "incoming" ? `${st.request.name} asks to take this` : "",
                ].filter(Boolean);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(row.id);
                        setModeOverride(null);
                        setReadChoice(null);
                        setReplyOpen(false);
                      }}
                      className={`block min-h-[92px] w-full border-b border-[#edebe9] px-5 py-4 text-left ${sel ? "bg-[#deecf9]" : "bg-white hover:bg-[#f5f5f5]"}`}
                    >
                      <div className="flex items-baseline gap-3">
                        <span className={`min-w-0 flex-1 truncate text-[14px] ${unread(row) ? "font-semibold" : "font-normal"}`}>{senderDisplay(row.from)}</span>
                        <span className="shrink-0 text-[12.5px] text-[#605e5c]">{inboxListWhen(row.receivedAt, now)}</span>
                      </div>
                      <div className="mt-1 truncate text-[14px] font-semibold">{row.subject}</div>
                      <div className="mt-1 truncate text-[13.5px] text-[#605e5c]">{previewBits.join(" · ") || " "}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <article aria-label="Email" className="flex min-w-0 flex-col overflow-y-auto bg-white">
          {!selected ? (
            <div className="px-10 py-20 text-sm text-[#605e5c]">Select an enquiry to read it.</div>
          ) : (
            <>
              <div className="sticky top-0 z-10 flex h-[52px] shrink-0 items-center gap-1 border-b border-[#edebe9] bg-white px-7">
                {selected.tag === "escalation" ? (
                  <Button type="button" disabled={busy} onClick={() => void resolveItem(selected)} data-testid="inbox-resolve-button">
                    <CircleCheck className="mr-2 h-4 w-4" />
                    Mark resolved
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={busy || quoteBlocked}
                    onClick={() => void applyToDesk(selected, resolvedMode, readMode)}
                    data-testid="inbox-quote-button"
                    className="h-8 rounded bg-[#0078d4] px-4 text-[13.5px] shadow-none hover:bg-[#106ebe]"
                  >
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {state.kind === "can-take" ? "Take over and quote" : "Quote"}
                  </Button>
                )}
                <Button type="button" variant="ghost" disabled={busy} onClick={() => void dismiss(selected)} className="h-8 px-3 text-[13.5px]">
                  Ignore
                </Button>
                {selected.tag === "escalation" ? null : (
                  <Button type="button" variant="ghost" className="h-8 px-3 text-[13.5px]" onClick={() => setReplyOpen((v) => !v)}>
                    {replyOpen ? "Hide reply" : "Reply"}
                  </Button>
                )}
                {selected.tag === "escalation" ? null : (
                  <>
                    <div className="ml-2 hidden items-center text-[13px] text-[#605e5c] sm:flex" role="group" aria-label="Which desk">
                      <button type="button" className={`h-8 px-3 ${resolvedMode === "air" ? "font-semibold text-[#201f1e]" : "hover:bg-[#f3f2f1]"}`} onClick={() => setModeOverride("air")}>
                        Air
                      </button>
                      <button type="button" className={`h-8 px-3 ${resolvedMode === "sea" ? "font-semibold text-[#201f1e]" : "hover:bg-[#f3f2f1]"}`} onClick={() => setModeOverride("sea")}>
                        Sea
                      </button>
                    </div>
                    <div className="hidden items-center text-[13px] text-[#605e5c] lg:flex" role="group" aria-label="How to read the email">
                      <button type="button" onClick={() => setReadChoice("text")} className={`h-8 px-3 ${readMode === "text" ? "font-semibold text-[#201f1e]" : "hover:bg-[#f3f2f1]"}`}>
                        Text only
                      </button>
                      <button type="button" onClick={() => setReadChoice("ai")} disabled={!useLiveData || !aiOn} title={aiOn ? undefined : aiOffMessage(aiSwitches, "quoteHub")} className={`h-8 px-3 ${readMode === "ai" ? "font-semibold text-[#201f1e]" : "hover:bg-[#f3f2f1]"}`}>
                        Attachments {aiOn ? "· ₹1" : "off"}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="mx-auto w-full max-w-[720px] px-10 pb-16 pt-8">
                {rb ? (
                  <p className="mb-6 text-[13px] text-[#605e5c]">
                    {rb.basis === "client" ? "The client gave this deadline" : `${rb.zone.city} office closes at 18:00`}
                    {" · "}
                    <span className={urgencyOf(rb.at, now) === "ok" ? "" : URGENCY_CLASS[urgencyOf(rb.at, now)] + " rounded px-1.5 py-0.5"}>
                      Reply by {rb.localText} · {timeLeftText(rb.at, now)}
                    </span>
                  </p>
                ) : null}

                {selected.tag === "escalation" ? (
                  <p className="mb-6 text-sm text-[#201f1e]" data-testid="inbox-escalation-note">
                    A problem on a shipment. {selected.reason ? `${selected.reason}. ` : ""}It stays here for everyone on {selected.mailboxEmail || selected.mailbox} until someone marks it resolved. Reply from Outlook as usual.
                  </p>
                ) : null}

                <h2 className="text-[22px] font-semibold leading-snug tracking-tight">{selected.subject}</h2>

                <div className="mt-7 mb-8 grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#486991] text-sm font-semibold text-white">
                    {(ident?.fromName || senderDisplay(selected.from)).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 text-[14px] leading-5">
                    <div className="font-semibold">
                      {ident?.fromName || senderDisplay(selected.from)}
                      {ident?.fromEmail ? <span className="ml-2 font-normal text-[#605e5c]">{ident.fromEmail}</span> : null}
                      {savedContact ? (
                        <span className="ml-2 text-[12px] font-normal text-[#605e5c]" data-testid="inbox-contact-saved" title="This address is in the contact directory">
                          Contact saved{savedContact.type && savedContact.type !== "unknown" ? `: ${CONTACT_TYPE_LABELS[savedContact.type as ContactType] ?? savedContact.type}` : ""}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[13px] text-[#605e5c]" data-testid="inbox-identity-to">
                      to {ident?.toLine || selected.mailboxEmail || selected.mailbox}
                      {selected.suggestedUser ? ` · usual desk ${deskDisplayName(selected.suggestedUser)}` : ""}
                    </div>
                    <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg border border-[#edebe9] bg-[#faf9f8] px-3 py-2.5 text-[13px] leading-5" data-testid="inbox-identity">
                      {identityLines(selected).map((line) => (
                        <div key={`${line.label}-${line.value}`} className="contents">
                          <dt className="font-semibold text-[#605e5c]">{line.label}</dt>
                          <dd className="min-w-0 text-[#201f1e]">{line.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="text-right text-[13px] text-[#605e5c]">{receivedText}</div>
                </div>

                {state.kind === "mine" ? (
                  <p className="mb-6 text-sm text-[#201f1e]" data-testid="inbox-mine-note">
                    You are quoting this. Your colleague on the mailbox can see that.
                  </p>
                ) : null}
                {state.kind === "other" ? (
                  <div className="mb-6 flex flex-wrap items-center gap-3 text-sm" data-testid="inbox-working-note">
                    <span>
                      {state.worker.name} is quoting this (opened {agoText(state.worker.at, now)}).
                    </span>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void updateItem(selected, { takeoverRequest: askRequest({ username: user?.username ?? "", displayName: user?.displayName }) }, `Asked ${state.worker.name} to hand it over`)}>
                      Ask {state.worker.name} to hand it over
                    </Button>
                  </div>
                ) : null}
                {state.kind === "asked" ? (
                  <p className="mb-6 text-sm" data-testid="inbox-working-note">
                    You asked {state.worker.name} to hand this over. If there is no answer you can take it over in {state.waitLeftMin} min.
                  </p>
                ) : null}
                {state.kind === "can-take" ? (
                  <p className="mb-6 text-sm" data-testid="inbox-working-note">
                    {state.worker.name} did not answer in {TAKEOVER_WAIT_MINUTES} minutes. You can take it over now.
                  </p>
                ) : null}
                {state.kind === "incoming" ? (
                  <div className="mb-6 flex flex-wrap items-center gap-3 text-sm" data-testid="inbox-takeover-request">
                    <span>{state.request.name} asks to take this enquiry over.</span>
                    <Button type="button" disabled={busy} onClick={() => void updateItem(selected, handOverPatch(state.request), `Handed over to ${state.request.name}`)}>
                      Hand over
                    </Button>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void updateItem(selected, { takeoverRequest: null }, "You keep it")}>
                      I am on it
                    </Button>
                  </div>
                ) : null}

                <EnquiryThread
                  item={selected}
                  openIds={new Set(visible.map((r) => r.id))}
                  onOpenCard={setSelectedId}
                  enquiryChoices={visible
                    .filter((r) => r.mailbox === selected.mailbox && r.tag !== "follow_up" && r.id !== selected.id)
                    .map((r) => ({ id: r.id, label: `${senderDisplay(r.from)}: ${r.subject}`.slice(0, 80) }))}
                />

                <div className="mt-6">
                  {full.status === "loading" ? (
                    <p className="flex items-center gap-2 text-sm text-[#605e5c]">
                      <Loader2 className="h-4 w-4 animate-spin" /> Opening the email…
                    </p>
                  ) : (
                    <div className="whitespace-pre-wrap text-[15px] leading-[1.7] text-[#323130]" data-testid="inbox-email-body">
                      {full.status === "ready" ? full.mail?.bodyText || "(no text in this email)" : selected.bodyPreview || selected.body || "—"}
                    </div>
                  )}
                  {full.status === "error" ? <p className="mt-2 text-xs text-[#605e5c]">{full.message} Showing the short preview.</p> : null}
                </div>

                {full.status === "ready" && full.mail && full.mail.attachments.length ? (
                  <div className="mt-8 flex flex-wrap gap-2">
                    {full.mail.attachments.map((a, i) => (
                      <button key={`${a.name}-${i}`} type="button" onClick={() => openAttachment(a)} className="inline-flex items-center gap-2 border border-[#edebe9] px-3 py-2 text-[13.5px] hover:bg-[#f5f5f5]">
                        <Paperclip className="h-4 w-4 text-[#605e5c]" />
                        <span className="font-semibold">{a.name}</span>
                        <span className="text-[#605e5c]">{Math.max(1, Math.round(a.bytes.length / 1024))} KB</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <p className="mt-10 text-[13px] text-[#605e5c]" data-testid="inbox-ai-note">
                  Desk starts with {deskParsed?.customer || senderDisplay(selected.from)} · {deskParsed?.origin || "—"} → {deskParsed?.destination || "—"} · {readMode === "ai" ? "AI reads words and attachments once (about ₹1)." : "Filled from the words of the email. No AI credit."}
                </p>

                {replyOpen ? (
                  <div className="mt-8">
                    <EnquiryReplyDrafter
                      key={selected.id}
                      item={deskParsed ? { ...selected, parsed: deskParsed } : selected}
                      mode={resolvedMode === "sea" ? "sea" : "air"}
                      signOff={user?.displayName && !IS_DEMO_BUILD ? user.displayName : "Pricing Team"}
                    />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
