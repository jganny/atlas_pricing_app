"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { toast } from "@/components/Toast";
import {
  DEFAULT_AUTO_REPLY,
  fetchAckLog,
  fetchAutoReplySettings,
  saveAutoReplySettings,
  sendAutoReplyTest,
  type AckLogRow,
  type AutoReplySettings,
  type BranchTeam,
} from "@/lib/firebase/auto-reply";

const split = (v: string) => v.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

/** Admin: the switches for automatic acknowledgements, the branch teams copied on confirmations, a test send, and what was sent. */
export function AutoReplyAdmin() {
  const [s, setS] = useState<AutoReplySettings | null>(null);
  const [log, setLog] = useState<AckLogRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testBox, setTestBox] = useState<"pricing" | "pricingsales">("pricing");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [cfg, rows] = await Promise.all([fetchAutoReplySettings().catch(() => DEFAULT_AUTO_REPLY), fetchAckLog().catch(() => [])]);
      if (alive) {
        setS(cfg);
        setLog(rows);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!s) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading automatic replies…
      </p>
    );
  }

  const change = (next: Partial<AutoReplySettings>) => {
    setS({ ...s, ...next });
    setDirty(true);
  };
  const setTeam = (i: number, t: Partial<BranchTeam>) => change({ branchTeams: s.branchTeams.map((x, j) => (j === i ? { ...x, ...t } : x)) });
  const badEmails = s.branchTeams.flatMap((t) => t.emails.filter((e) => !isEmail(e)));
  const live = (s.ackEnquiry || s.ackConfirmation) && !s.testRedirect;

  async function save() {
    if (badEmails.length) {
      toast(`Check these addresses: ${badEmails.join(", ")}`, "error");
      return;
    }
    if (s!.testRedirect && !isEmail(s!.testRedirect)) {
      toast("The test address is not a valid email address.", "error");
      return;
    }
    setSaving(true);
    try {
      await saveAutoReplySettings(s!);
      setDirty(false);
      toast("Saved.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    if (!isEmail(testTo)) {
      toast("Type an email address to send the test to.", "error");
      return;
    }
    setTesting(true);
    try {
      const r = await sendAutoReplyTest(testTo.trim(), testBox);
      toast(`Two test messages sent from ${r.from} to ${testTo.trim()}. Check the inbox (and spam).`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "The test could not be sent.", "error");
    } finally {
      setTesting(false);
    }
  }

  const sw = (label: string, hint: string, on: boolean, set: (v: boolean) => void, id: string) => (
    <label className="grid cursor-pointer grid-cols-[20px_1fr] items-start gap-x-3 rounded-lg border border-[var(--color-border)] bg-white p-3">
      <input id={id} type="checkbox" className="mt-1 h-4 w-4" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-[var(--color-text-muted)]">{hint}</span>
      </span>
    </label>
  );

  return (
    <section className="mt-6 space-y-5 rounded-xl border border-[var(--color-border)] bg-white p-4" data-testid="auto-reply-admin">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="auto-reply-paused-note">
        <b>Sending from the app is paused.</b> The mail server&apos;s certificate for sending expired on 14 April 2026, so mail sent by the app would be refused. This is for the company&apos;s IT manager to fix with the mail provider. Until then people reply from Outlook as usual, and the app notices those replies. Leave both switches off.
      </p>
      <div>
        <h2 className="text-base font-extrabold text-[var(--color-atlas-navy)]">Automatic replies</h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Both switches start <b>off</b>. First send yourself the two test messages below, then turn them on. Confirmations are always recorded in NRS and the NRS desk is told, whatever these switches say; the switches only control whether an acknowledgement is emailed. Nothing is ever sent to a machine address, a mailing list, or your own people, and only once per email thread.
        </p>
      </div>

      <div className="space-y-2">
        {sw("Acknowledge every enquiry", "A short reply from the desk (Air, Sea or Sales) to a real enquiry: “we acknowledge receipt and our desk is working on it”. No price, no time promised.", s.ackEnquiry, (v) => change({ ackEnquiry: v }), "ack-enq")}
        {sw("Acknowledge shipment confirmations", "Reply to the agent or customer, copy the branch team that takes over, and attach the documents received (invoice, packing list). The shipment is also recorded in NRS.", s.ackConfirmation, (v) => change({ ackConfirmation: v }), "ack-conf")}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-[var(--color-text-muted)]">
          Test mode: send everything to this address only
          <Input className="mt-1" placeholder="you@company.com (leave empty to send for real)" value={s.testRedirect} onChange={(e) => change({ testRedirect: e.target.value })} />
        </label>
        <label className="text-xs font-semibold text-[var(--color-text-muted)]">
          Most replies in a day
          <Input className="mt-1" inputMode="numeric" value={String(s.dailyCap)} onChange={(e) => change({ dailyCap: Math.max(1, Math.min(500, Number(e.target.value.replace(/\D/g, "")) || 1)) })} />
        </label>
        <label className="text-xs font-semibold text-[var(--color-text-muted)]">
          Name on confirmation replies
          <Input className="mt-1" value={s.nrsDesk} onChange={(e) => change({ nrsDesk: e.target.value })} />
        </label>
      </div>
      {live ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">These replies will go to real customers and agents. Leave test mode on until the two test messages look right.</p>
      ) : s.testRedirect && (s.ackEnquiry || s.ackConfirmation) ? (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">Test mode is on: every automatic message goes to {s.testRedirect}, labelled with who it would have gone to.</p>
      ) : null}

      <div>
        <h3 className="text-sm font-bold">Branch teams</h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          The team copied on a confirmation. The Indian end decides it: the destination of an import, the origin of an export. List the airport or port codes and the city names that belong to the branch. If none matches, the reply goes without a team and the NRS desk is told.
        </p>
        <div className="mt-2 space-y-2">
          {s.branchTeams.map((t, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-[var(--color-border)] p-2 sm:grid-cols-[130px_1fr_1fr_auto]">
              <Input aria-label="Branch name" placeholder="Branch, e.g. Bangalore" value={t.branch} onChange={(e) => setTeam(i, { branch: e.target.value })} />
              <Input aria-label="Stations" placeholder="Stations: BLR, Bangalore" value={t.stations.join(", ")} onChange={(e) => setTeam(i, { stations: split(e.target.value) })} />
              <Input aria-label="Team emails" placeholder="Team emails, comma separated" value={t.emails.join(", ")} onChange={(e) => setTeam(i, { emails: split(e.target.value) })} />
              <button type="button" className="rounded-md border border-[var(--color-border)] p-2 text-red-700" aria-label="Remove branch" onClick={() => change({ branchTeams: s.branchTeams.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" className="mt-2 gap-1" onClick={() => change({ branchTeams: [...s.branchTeams, { branch: "", stations: [], emails: [] }] })}>
          <Plus className="h-4 w-4" /> Add a branch
        </Button>
      </div>

      <div className="rounded-lg bg-slate-50 p-3">
        <h3 className="text-sm font-bold">Send yourself a test</h3>
        <p className="text-xs text-[var(--color-text-muted)]">Sends two sample messages (an enquiry acknowledgement and a confirmation acknowledgement with an attachment) to one address, from the mailbox you pick. Nothing goes to anyone else.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Input className="mt-0 w-72" type="email" placeholder="your.email@company.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Send the test to" />
          <select className="h-10 rounded-lg border border-[var(--color-border-strong)] bg-white px-2 text-sm" value={testBox} onChange={(e) => setTestBox(e.target.value as "pricing" | "pricingsales")} aria-label="From which mailbox">
            <option value="pricing">From pricing@</option>
            <option value="pricingsales">From pricingsales@</option>
          </select>
          <Button type="button" disabled={testing} onClick={() => void test()}>
            {testing ? "Sending…" : "Send the two test messages"}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {dirty ? <span className="text-xs text-amber-700">Unsaved changes</span> : null}
        <Button type="button" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-bold">What was sent (latest 30)</h3>
        {log.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">Nothing sent yet.</p>
        ) : (
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--color-text-muted)]">
                  <th className="py-1 pr-3">When</th>
                  <th className="pr-3">Kind</th>
                  <th className="pr-3">To</th>
                  <th className="pr-3">Copied</th>
                  <th className="pr-3">Files</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {log.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--color-border)]">
                    <td className="py-1 pr-3 whitespace-nowrap">{new Date(r.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="pr-3">{r.kind === "confirmation" ? "Confirmation" : "Enquiry"}</td>
                    <td className="pr-3">{r.test ? `${r.to} (test, for ${r.wouldGoTo})` : r.to}</td>
                    <td className="pr-3">{r.cc?.length ? r.cc.join(", ") : "—"}</td>
                    <td className="pr-3">{r.attachments}</td>
                    <td className={r.status === "sent" ? "text-emerald-700" : "text-red-700"}>{r.status === "sent" ? "Sent" : `Failed: ${r.error}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
