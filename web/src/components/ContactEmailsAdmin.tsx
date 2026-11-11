"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useLiveData } from "@/lib/api";
import { fetchEmailContacts, updateEmailContact, type ContactPatch } from "@/lib/firebase/email-directory";
import {
  CONTACT_TYPES,
  CONTACT_TYPE_LABELS,
  RATE_SOURCE_LABELS,
  countByType,
  filterContacts,
  type ContactType,
  type EmailContact,
  type RateSource,
} from "@/lib/directory/email-directory";

const SAMPLE: EmailContact[] = [
  { id: "a", email: "cargo@etihad.com", name: "Etihad Cargo", domain: "etihad.com", type: "airline", typeSource: "rules", org: "Etihad Cargo", carrierCode: "EY", rateSource: "email", mailboxes: ["pricing"], count: 14, firstSeen: 1, lastSeen: 2, note: "" },
  { id: "b", email: "rates@maersk.com", name: "", domain: "maersk.com", type: "liner", typeSource: "rules", org: "Maersk", carrierCode: "", rateSource: "portal", mailboxes: ["pricing"], count: 6, firstSeen: 1, lastSeen: 2, note: "" },
  { id: "c", email: "ops@blueseaforwarding.com", name: "Bluesea Forwarding", domain: "blueseaforwarding.com", type: "overseas-agent", typeSource: "guess", org: "", carrierCode: "", rateSource: "", mailboxes: ["pricingsales"], count: 3, firstSeen: 1, lastSeen: 2, note: "" },
];

const agoDays = (t: number) => {
  const d = Math.floor((Date.now() - t) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

/** Admin: every email address the app has met, what kind of contact it is, and how a rate is obtained from it. */
export function ContactEmailsAdmin() {
  const [rows, setRows] = useState<EmailContact[] | null>(() => (useLiveData ? null : SAMPLE));
  const [error, setError] = useState("");
  const [type, setType] = useState<ContactType | "all">("all");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!useLiveData) return;
    let alive = true;
    void fetchEmailContacts()
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "The directory could not be loaded."));
    return () => {
      alive = false;
    };
  }, []);

  const counts = useMemo(() => countByType(rows ?? []), [rows]);
  const shown = useMemo(() => filterContacts(rows ?? [], { type, text }), [rows, type, text]);

  async function change(c: EmailContact, patch: ContactPatch) {
    if (!useLiveData) {
      toast("This works in the live app", "info");
      return;
    }
    setSaving(c.id);
    try {
      await updateEmailContact(c.id, patch);
      setRows((prev) => (prev ? (patch.remove ? prev.filter((x) => x.id !== c.id) : prev.map((x) => (x.id === c.id ? { ...x, ...patch, ...(patch.type ? { typeSource: "admin" } : {}) } : x))) : prev));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(null);
    }
  }

  if (error) return <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>;
  if (!rows) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the directory…
      </p>
    );
  }

  return (
    <section className="mt-6 space-y-4 rounded-xl border border-[var(--color-border)] bg-white p-4" data-testid="contact-emails-admin">
      <div>
        <h2 className="text-base font-extrabold text-[var(--color-atlas-navy)]">Contact directory</h2>
        <p className="mt-1 max-w-3xl text-xs text-[var(--color-text-muted)]">
          The app remembers each email address it meets in mail it keeps, in replies that go out, and in the mails you send on from Outlook (the vendors, airlines and agents you ask for rates): the address, the name and how often it appears, never what was said. Airlines and liners it knows are sorted by themselves; the rest are guesses for you to confirm. The desks use this list to suggest how to ask a carrier for a rate: its portal, an email, or its tariff on file. Overseas agents found here are NOT added to the weekly agency list: that list is kept separately and is not changed from this directory.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="mt-0 w-72 pl-8" placeholder="Search address, name or company" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search the directory" />
        </label>
        {(["all", ...CONTACT_TYPES] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${type === t ? "bg-[var(--color-atlas-navy)] text-white" : "border border-[var(--color-border)] bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {t === "all" ? "All" : CONTACT_TYPE_LABELS[t]} <span className="opacity-70">{counts[t]}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="py-2 pr-3">Address</th>
              <th className="pr-3">Type</th>
              <th className="pr-3">Company</th>
              <th className="pr-3">Carrier code</th>
              <th className="pr-3">How we get a rate</th>
              <th className="pr-3 text-right">Seen</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-[var(--color-text-muted)]">
                  {rows.length === 0 ? "No addresses yet. They appear as mail arrives and replies go out." : "Nothing matches."}
                </td>
              </tr>
            ) : (
              shown.slice(0, 300).map((c) => (
                <tr key={c.id} className="border-t border-[var(--color-border)] align-middle">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{c.email}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{c.name || "no name"} · {c.mailboxes.join(", ") || "—"}</div>
                  </td>
                  <td className="pr-3">
                    <select
                      className="h-9 rounded-md border border-[var(--color-border-strong)] bg-white px-2 text-sm"
                      value={c.type}
                      disabled={saving === c.id}
                      onChange={(e) => void change(c, { type: e.target.value as ContactType })}
                      aria-label={`Type of ${c.email}`}
                    >
                      {CONTACT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {CONTACT_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    {c.typeSource === "guess" ? <span className="ml-1.5 text-[11px] font-semibold text-amber-700">guess</span> : null}
                  </td>
                  <td className="pr-3">
                    <Input className="mt-0 h-9 w-44" defaultValue={c.org} onBlur={(e) => e.target.value.trim() !== c.org && void change(c, { org: e.target.value })} aria-label={`Company of ${c.email}`} />
                  </td>
                  <td className="pr-3">
                    <Input className="mt-0 h-9 w-20 uppercase" defaultValue={c.carrierCode} maxLength={4} onBlur={(e) => e.target.value.trim().toUpperCase() !== c.carrierCode && void change(c, { carrierCode: e.target.value })} aria-label={`Carrier code of ${c.email}`} />
                  </td>
                  <td className="pr-3">
                    <select
                      className="h-9 rounded-md border border-[var(--color-border-strong)] bg-white px-2 text-sm"
                      value={c.rateSource}
                      disabled={saving === c.id}
                      onChange={(e) => void change(c, { rateSource: e.target.value as RateSource })}
                      aria-label={`How we get a rate from ${c.email}`}
                    >
                      {(Object.keys(RATE_SOURCE_LABELS) as RateSource[]).map((k) => (
                        <option key={k} value={k}>
                          {RATE_SOURCE_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="pr-3 text-right text-xs text-[var(--color-text-muted)]">
                    {c.count}× · {agoDays(c.lastSeen)}
                  </td>
                  <td className="text-right">
                    <button type="button" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700" aria-label={`Remove ${c.email}`} onClick={() => void change(c, { remove: true })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {shown.length > 300 ? <p className="text-xs text-[var(--color-text-muted)]">Showing the first 300 of {shown.length}. Search to narrow the list.</p> : null}
    </section>
  );
}
