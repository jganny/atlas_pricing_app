"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, Link2, Link2Off, Loader2, Mail, Send, X } from "lucide-react";
import { toast } from "@/components/Toast";
import { fetchInboxEml } from "@/lib/firebase/inbox";
import { fetchThread, linkToEnquiry, unlinkFromThread } from "@/lib/firebase/threads";
import { parseEmailFile, type ParsedEmail } from "@/lib/hub/email-file";
import { RATE_EMAILS_KEY, rateSummary, type PendingRateEmail } from "@/lib/rates/rate-email";
import { EMPTY_THREAD, isOverdueVendor, linkLabel, linkedCount, memberTitle, vendorSummary, waitingText, whenText, type ThreadMember } from "@/lib/mail/thread-view";
import { salespersonOf } from "@/lib/mail/enquiry-identity";
import { senderDisplay } from "@/lib/mail/inbox-views";
import type { InboxEnquiry } from "@/lib/types";
import { cn } from "@/lib/utils";

function MailModal({ member, onClose }: { member: ThreadMember; onClose: () => void }) {
  const q = useQuery<ParsedEmail>({
    queryKey: ["threadMail", member.kind, member.id],
    queryFn: async () => {
      const bytes = await fetchInboxEml(member.id, member.kind === "sent" ? "sent" : "card");
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      return parseEmailFile("mail.eml", ab);
    },
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    retry: 0,
  });
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={memberTitle(member)}>
      <div className="my-6 w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-[var(--color-border)] px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{memberTitle(member)} · {whenText(member.at)}</p>
            <h3 className="truncate text-base font-semibold text-slate-900">{member.subject || "(no subject)"}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-[14.5px] leading-7 text-slate-800">
          {q.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Opening the email from the mailbox…</p>
          ) : q.isError ? (
            <p className="text-sm text-amber-800">{q.error instanceof Error ? q.error.message : "The email could not be opened."} It may have been moved or deleted in Outlook.</p>
          ) : (
            <div className="whitespace-pre-wrap">{q.data?.bodyText || "(no text in this email)"}</div>
          )}
        </div>
        <p className="border-t border-[var(--color-border)] px-5 py-2 text-[11px] text-slate-500">Opened live from the mailbox. Nothing is saved in the app.</p>
      </div>
    </div>
  );
}

const ROLE_ICON = { enquiry: Mail, sent: Send, reply: CornerDownRight } as const;
const ROLE_DOT = { enquiry: "bg-sky-600", sent: "bg-slate-500", reply: "bg-emerald-600" } as const;

/**
 * The conversation behind the enquiry in view: the email that came in, what the desk sent on to vendors from Outlook, and the vendors' replies,
 * tied together by themselves (see functions/inbox-thread.js). Every automatic link can be undone. No AI credit.
 */
export function EnquiryThread({
  item,
  openIds,
  onOpenCard,
  enquiryChoices,
}: {
  item: InboxEnquiry;
  /** Ids of the cards that are in the list (they open in the list itself). */
  openIds: Set<string>;
  onOpenCard: (id: string) => void;
  /** Open enquiries of the same mailbox, to link a reply to by hand. */
  enquiryChoices: Array<{ id: string; label: string }>;
}) {
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<ThreadMember | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["thread", item.id, item.threadId ?? ""],
    queryFn: () => fetchThread(item.id),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 0,
  });
  const thread = q.data ?? EMPTY_THREAD;
  const others = linkedCount(thread);
  const isReplyWithoutThread = item.tag === "follow_up" && !item.threadId;
  const origin = thread.origin || null;
  const originSales = origin ? salespersonOf(origin) : null;

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["thread"] });
  }
  async function unlink(m: ThreadMember) {
    setBusy(m.id);
    try {
      await unlinkFromThread(m.kind, m.id);
      toast("Unlinked. It will not be linked again by itself.", "success");
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not unlink. Try again.", "error");
    } finally {
      setBusy(null);
    }
  }
  /** Keeps this reply for the desk: the Carriers step of the Air or Sea desk opens with it ready to read into rates. Held in this tab only. */
  async function sendToDesk(m: ThreadMember) {
    setBusy(m.id);
    try {
      const bytes = await fetchInboxEml(m.id, "card");
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const mail = await parseEmailFile("mail.eml", ab);
      let list: PendingRateEmail[] = [];
      try {
        list = JSON.parse(window.sessionStorage.getItem(RATE_EMAILS_KEY) || "[]") as PendingRateEmail[];
      } catch {
        list = [];
      }
      // A reply that was already read automatically carries its rates along: nothing is read again, nothing is paid twice.
      if (!list.some((x) => x.id === m.id)) list.push({ id: m.id, fromName: mail.fromName, fromEmail: mail.fromEmail, subject: mail.subject, text: mail.bodyText, ...(m.rates ? { read: m.rates } : {}) });
      window.sessionStorage.setItem(RATE_EMAILS_KEY, JSON.stringify(list));
      toast(`Kept for the desk (${list.length}). Open the ${item.mode === "sea" ? "Sea" : "Air"} desk, step 2 Carriers: it is ready to read into rates.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "The email could not be opened. Try again.", "error");
    } finally {
      setBusy(null);
    }
  }
  async function moveTo(m: ThreadMember, rootId: string, message: string) {
    setBusy(m.id);
    try {
      await linkToEnquiry(m.kind, m.id, rootId);
      toast(message, "success");
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not do that. Try again.", "error");
    } finally {
      setBusy(null);
    }
  }
  async function link(rootId: string) {
    setBusy("link");
    try {
      await linkToEnquiry("card", item.id, rootId);
      toast("Linked to that enquiry.", "success");
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not link. Try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  const originBanner = origin && origin.id && origin.id !== item.id ? (
    <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-2.5 text-[13px] leading-5 text-sky-950" data-testid="thread-origin">
      <p className="font-semibold">Original enquiry from {origin.fromName || senderDisplay(origin.from) || origin.fromEmail || "the customer"}{origin.fromEmail ? ` · ${origin.fromEmail}` : ""}</p>
      <p className="mt-0.5 text-sky-900">
        to {origin.toAddresses?.length ? origin.toAddresses.join(", ") : origin.mailboxEmail || origin.mailbox}
        {originSales ? ` · Relates to ${originSales.name}'s enquiry` : ""}
        {origin.repliedAt ? " · Replied" : " · Not yet replied"}
      </p>
      {origin.subject ? <p className="mt-0.5 truncate text-sky-800">{origin.subject}</p> : null}
    </div>
  ) : null;

  // Nothing to show yet: say so in one quiet line, never an empty box.
  if (q.isLoading) return originBanner;
  if (!others && !isReplyWithoutThread) {
    return (
      <div className="space-y-2">
        {originBanner}
        <p className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-2.5 text-xs text-slate-500" data-testid="thread-empty">
          <Link2 className="mr-1.5 inline h-3.5 w-3.5" />
          Conversation: nothing linked yet. When you send this on to vendors from Outlook, what you sent and what they reply appear here by themselves.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-white shadow-sm" data-testid="thread-panel" aria-label="Conversation">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--color-border)] bg-slate-50 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-slate-900">Conversation</h3>
        {others ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-900">{others} linked</span> : null}
        {thread.vendors.length ? <span className="text-xs text-slate-600" data-testid="thread-vendor-summary">{vendorSummary(thread.vendors)}</span> : null}
      </div>

      {originBanner ? <div className="border-b border-[var(--color-border)] px-4 py-3">{originBanner}</div> : null}

      {thread.vendors.length ? (
        <div className="flex flex-wrap gap-1.5 border-b border-[var(--color-border)] px-4 py-2" data-testid="thread-vendors">
          {thread.vendors.map((v) => (
            <span key={v.email} className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", v.replied ? "bg-emerald-50 text-emerald-800" : isOverdueVendor(v, now) ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800")} title={v.replied ? v.email : `${v.email}${isOverdueVendor(v, now) ? ". A day without an answer: time to call." : ""}`}>
              {v.name} · {v.replied ? "replied" : waitingText(v.askedAt, now)}
            </span>
          ))}
        </div>
      ) : null}

      {isReplyWithoutThread && !others ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm text-slate-700" data-testid="thread-link-by-hand">
          <span>This reply is not tied to an enquiry yet.</span>
          {enquiryChoices.length ? (
            <select
              id="thread-link-choice"
              aria-label="Link this reply to an enquiry"
              className="max-w-xs rounded-lg border border-[var(--color-border)] bg-white px-2 py-1.5 text-xs"
              defaultValue=""
              disabled={busy === "link"}
              onChange={(e) => (e.target.value ? void link(e.target.value) : undefined)}
            >
              <option value="">Link to an enquiry…</option>
              {enquiryChoices.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-slate-500">There is no open enquiry in this mailbox to link it to.</span>
          )}
        </div>
      ) : null}

      <ol className="m-0 list-none px-4 py-3">
        {thread.members.map((m, i) => {
          const Icon = ROLE_ICON[m.role];
          const last = i === thread.members.length - 1;
          const inList = m.kind === "card" && openIds.has(m.id);
          const you = m.id === item.id;
          return (
            <li key={`${m.kind}-${m.id}`} className="flex gap-3" data-testid={`thread-member-${m.role}`}>
              <div className="flex flex-col items-center">
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", ROLE_DOT[m.role])} />
                {!last ? <span className="my-1 w-px flex-1 bg-slate-200" /> : null}
              </div>
              <div className={cn("min-w-0 flex-1", !last && "pb-3")}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Icon className="h-3.5 w-3.5 shrink-0 self-center text-slate-500" aria-hidden />
                  <b className="text-[13px] font-semibold text-slate-900">{memberTitle(m)}</b>
                  <span className="text-xs text-slate-500">{whenText(m.at)}</span>
                  {you ? <span className="rounded bg-slate-100 px-1.5 text-[10.5px] font-semibold text-slate-600">you are reading this</span> : null}
                </div>
                <div className="truncate text-xs text-slate-600" title={m.subject}>{m.subject || "(no subject)"}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {m.role !== "enquiry" && m.check ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900" data-testid="thread-check">Please check: more than one enquiry fits, this is the closest</span>
                  ) : null}
                  {m.role === "reply" && m.rateState === "read" && m.rates ? (
                    <span className="block w-full rounded-md bg-emerald-50 px-2 py-1 text-[11.5px] text-emerald-900" data-testid="thread-rates-read">
                      <b className="font-semibold">Rates read automatically:</b> {rateSummary(m.rates).line}
                      {rateSummary(m.rates).confirm ? <span className="ml-1 font-semibold text-amber-800">{rateSummary(m.rates).confirm}</span> : null}
                    </span>
                  ) : null}
                  {m.role === "reply" && m.rateState === "failed" ? <span className="block w-full text-[11.5px] text-amber-800">The rates in this reply could not be read automatically. Open the email, or use it in the desk and press Read rates.</span> : null}
                  {m.role !== "enquiry" && m.reason ? (
                    <span className="text-[11.5px] text-slate-500" title={m.reason}>
                      <b className="font-semibold text-slate-600">{linkLabel(m.by)}.</b> {m.reason}
                    </span>
                  ) : null}
                  {!you ? (
                    <button type="button" className="text-xs font-semibold text-sky-700 hover:underline" onClick={() => (inList ? onOpenCard(m.id) : setViewing(m))}>
                      {inList ? "Show in the list" : "Open"}
                    </button>
                  ) : null}
                  {m.role === "reply" && m.rateState !== "skipped" ? (
                    <button type="button" className="text-xs font-semibold text-sky-700 hover:underline disabled:opacity-50" disabled={busy === m.id} onClick={() => void sendToDesk(m)} data-testid="thread-use-rates">
                      Use these rates in the desk
                    </button>
                  ) : null}
                  {m.role !== "enquiry" && m.check && thread.rootId ? (
                    <button type="button" className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50" disabled={busy === m.id} onClick={() => void moveTo(m, thread.rootId as string, "Confirmed.")} data-testid="thread-confirm">
                      Looks right
                    </button>
                  ) : null}
                  {m.role !== "enquiry" && enquiryChoices.some((c) => c.id !== thread.rootId) ? (
                    <select
                      aria-label="Move this email to another enquiry"
                      className="max-w-[11rem] rounded border border-[var(--color-border)] bg-white px-1.5 py-0.5 text-[11.5px] text-slate-600"
                      defaultValue=""
                      disabled={busy === m.id}
                      onChange={(e) => (e.target.value ? void moveTo(m, e.target.value, "Moved to that enquiry.") : undefined)}
                      data-testid="thread-move"
                    >
                      <option value="">Move to…</option>
                      {enquiryChoices.filter((c) => c.id !== thread.rootId).map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  ) : null}
                  {m.role !== "enquiry" ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-700 disabled:opacity-50"
                      disabled={busy === m.id}
                      onClick={() => void unlink(m)}
                      title="This email does not belong to this enquiry"
                      data-testid="thread-unlink"
                    >
                      <Link2Off className="h-3.5 w-3.5" /> Unlink
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-slate-500">
        Tied together by themselves from the email headers and what they say. Wrong one? Move it to the right enquiry, or Unlink it (it is then left alone, so it does not jump back). Nothing here is stored: each email opens live from the mailbox.
      </p>
      {viewing ? <MailModal member={viewing} onClose={() => setViewing(null)} /> : null}
    </section>
  );
}
