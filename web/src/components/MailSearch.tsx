"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Search, Send, Mail, X } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/Toast";
import { openMailboxEml, searchMailboxes, type SearchRequest } from "@/lib/firebase/mail-search";
import { parseEmailFile, type ParsedEmail } from "@/lib/hub/email-file";
import { SEARCH_DAYS, groupHits, highlightParts, hitWho, type SearchHit } from "@/lib/mail/search-view";
import { cn } from "@/lib/utils";

const when = (ms: number) => (ms ? new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

function Marked({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightParts(text, terms).map((p, i) => (p.hit ? <mark key={i} className="rounded bg-amber-200 px-0.5">{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  );
}

function OpenedMail({ hit, onClose }: { hit: SearchHit; onClose: () => void }) {
  const q = useQuery<ParsedEmail>({
    queryKey: ["searchMail", hit.mailbox, hit.folder, hit.uid],
    queryFn: async () => {
      const bytes = await openMailboxEml(hit);
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      return parseEmailFile("mail.eml", ab);
    },
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    retry: 0,
  });
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={hit.subject}>
      <div className="my-6 w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-[var(--color-border)] px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{hitWho(hit)} · {when(hit.date)} · {hit.mailbox}@</p>
            <h3 className="text-base font-semibold text-slate-900">{hit.subject}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close the email" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-[14.5px] leading-7 text-slate-800">
          {q.isLoading ? <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Opening the email from the mailbox…</p> : q.isError ? <p className="text-sm text-amber-800">{q.error instanceof Error ? q.error.message : "The email could not be opened."}</p> : <div className="whitespace-pre-wrap">{q.data?.bodyText || "(no text in this email)"}</div>}
        </div>
        <p className="border-t border-[var(--color-border)] px-5 py-2 text-[11px] text-slate-500">Opened live from the mailbox. Nothing is saved in the app.</p>
      </div>
    </div>
  );
}

/**
 * Search the real mailboxes: sender, subject and the words inside the email. The mail server does the searching, so nothing is stored here
 * and mail that has already left the Inbox list is found too. Starts with the last 30 days; every word typed must appear. No AI credit.
 */
export function MailSearch({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [mailbox, setMailbox] = useState<SearchRequest["mailbox"]>("both");
  const [folder, setFolder] = useState<SearchRequest["folder"]>("both");
  const [days, setDays] = useState(30);
  const [opened, setOpened] = useState<SearchHit | null>(null);
  const run = useMutation({
    mutationFn: (req: SearchRequest) => searchMailboxes(req),
    onError: (e) => toast(e instanceof Error ? e.message : "The search failed. Try again.", "error"),
  });
  const groups = run.data ? groupHits(run.data.results) : [];
  const terms = run.data?.terms ?? [];

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 2) {
      toast("Type at least two letters to search.", "error");
      return;
    }
    run.mutate({ query: text, mailbox, folder, days });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Search the mailboxes" data-testid="mail-search">
      <div className="my-6 w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <form onSubmit={go} className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-5 py-3">
          <label className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-700" />
            <input id="mail-search-text" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search sender, subject or words inside the email" className="w-full rounded-lg border-2 border-sky-600 py-2 pl-9 pr-3 text-sm outline-none" aria-label="Search the mailboxes" />
          </label>
          <select aria-label="Mailbox" value={mailbox} onChange={(e) => setMailbox(e.target.value as SearchRequest["mailbox"])} className="rounded-lg border border-[var(--color-border)] bg-white px-2 py-2 text-xs">
            <option value="both">Both mailboxes</option><option value="pricing">pricing@</option><option value="pricingsales">pricingsales@</option>
          </select>
          <select aria-label="Folder" value={folder} onChange={(e) => setFolder(e.target.value as SearchRequest["folder"])} className="rounded-lg border border-[var(--color-border)] bg-white px-2 py-2 text-xs">
            <option value="both">Inbox and Sent</option><option value="inbox">Inbox only</option><option value="sent">Sent only</option>
          </select>
          <select aria-label="How far back" value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-[var(--color-border)] bg-white px-2 py-2 text-xs">
            {SEARCH_DAYS.map((d) => <option key={d.days} value={d.days}>{d.label}</option>)}
          </select>
          <Button type="submit" disabled={run.isPending}>{run.isPending ? "Searching…" : "Search"}</Button>
          <button type="button" onClick={onClose} aria-label="Close search" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </form>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-3">
          {run.isPending ? <p className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Searching the mailboxes. This can take up to half a minute…</p> : null}
          {!run.data && !run.isPending ? <p className="py-6 text-sm text-slate-500">The real mailboxes are searched, so mail that has already left the Inbox list is found too. Every word you type must appear. Nothing is stored in the app.</p> : null}
          {run.data ? (
            <>
              <p className="pb-2 text-xs text-slate-500" data-testid="mail-search-summary">
                {groups.length} conversation{groups.length === 1 ? "" : "s"} found in the last {run.data.days} days{run.data.failed ? ` (${run.data.failed} mailbox did not answer, try again)` : ""}.{run.data.days < 365 ? " Not here? Choose a longer range and search again." : ""}
              </p>
              <ul className="m-0 list-none divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] p-0">
                {groups.map((g) => (
                  <li key={g.key} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-sm font-semibold text-slate-900"><Marked text={g.subject} terms={terms} /></b>
                      {g.hits.length > 1 ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{g.hits.length} messages</span> : null}
                      <span className="ml-auto text-xs text-slate-500">{when(g.latest)}</span>
                    </div>
                    <ul className="m-0 mt-1.5 list-none space-y-1 p-0">
                      {g.hits.map((h) => (
                        <li key={`${h.mailbox}-${h.folder}-${h.uid}`}>
                          <button type="button" onClick={() => setOpened(h)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-sky-50")}>
                            {h.folder === "sent" ? <Send className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : <Mail className="h-3.5 w-3.5 shrink-0 text-sky-600" />}
                            <span className="min-w-0 flex-1 truncate text-slate-700"><Marked text={hitWho(h)} terms={terms} /></span>
                            <span className="shrink-0 text-slate-500">{h.mailbox}@ · {when(h.date)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
      {opened ? <OpenedMail hit={opened} onClose={() => setOpened(null)} /> : null}
    </div>
  );
}
