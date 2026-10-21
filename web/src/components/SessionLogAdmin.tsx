"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Flag } from "lucide-react";
import { useLiveData } from "@/lib/api";
import { personDisplayName } from "@/lib/auth/desk-seats";
import { fetchAuditLog } from "@/lib/firebase/audit-log";
import { fetchSessions } from "@/lib/firebase/session-log";
import { clock, dayRows, formatHM, istDay, outputByPersonDay, outputTotal, toCsv, type DayRow, type SessionRow } from "@/lib/session/session-log";
import { cn } from "@/lib/utils";

const RANGES = [
  { id: 7, label: "7 days" },
  { id: 14, label: "14 days" },
  { id: 30, label: "30 days" },
];

/** Admin: who signed in, how long they really used the app, what they got done, and which days look off. */
export function SessionLogAdmin() {
  const [days, setDays] = useState(14);
  const [person, setPerson] = useState("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof fetchAuditLog>>>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!useLiveData) {
      setState("ready");
      return;
    }
    let cancelled = false;
    setState("loading");
    const from = Date.now() - days * 86_400_000;
    void Promise.all([fetchSessions(from), fetchAuditLog(1500)])
      .then(([s, a]) => {
        if (cancelled) return;
        setSessions(s);
        setAudit(a);
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const rows = useMemo<DayRow[]>(() => dayRows(sessions, outputByPersonDay(audit)), [sessions, audit]);
  const people = useMemo(() => [...new Set(rows.map((r) => r.login))].sort(), [rows]);
  const shown = rows.filter((r) => (person === "all" || r.login === person) && (!flaggedOnly || r.flags.length));
  const flagged = rows.filter((r) => r.flags.length).length;
  const name = (l: string) => personDisplayName(l);

  function download() {
    const blob = new Blob([toCsv(shown, name)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sign-in-log-${istDay(Date.now())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="mt-6 rounded-xl border border-[var(--color-border)] bg-white p-4" data-testid="session-log">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-[var(--color-atlas-navy)]">Sign-ins and activity</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select className="rounded border px-2 py-1" value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person">
            <option value="all">Everyone</option>
            {people.map((l) => (
              <option key={l} value={l}>
                {name(l)}
              </option>
            ))}
          </select>
          <select className="rounded border px-2 py-1" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setFlaggedOnly((v) => !v)} className={cn("flex items-center gap-1 rounded border px-2 py-1 font-semibold", flaggedOnly ? "border-amber-400 bg-amber-50 text-amber-900" : "")}>
            <Flag className="h-3.5 w-3.5" /> Flagged{flagged ? ` (${flagged})` : ""}
          </button>
          <button type="button" onClick={download} disabled={!shown.length} className="flex items-center gap-1 rounded border px-2 py-1 font-semibold disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {state === "loading" ? <p className="mt-3 text-sm text-[var(--color-text-muted)]">Loading…</p> : null}
      {state === "error" ? <p className="mt-3 text-sm text-red-700">Couldn&apos;t load the log. Only the main administrator account can read it.</p> : null}
      {state === "ready" && shown.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">{rows.length ? "Nothing matches." : "No sign-ins recorded yet. They appear from the first sign-in after this was switched on."}</p>
      ) : null}

      {shown.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="py-1">Person</th>
                <th className="py-1">Day</th>
                <th className="py-1">In</th>
                <th className="py-1">Out</th>
                <th className="py-1 text-right">Active</th>
                <th className="py-1 text-right" title="Quotes · updates · visits · leads">
                  Work
                </th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={`${r.login}|${r.day}`} className={cn("border-t border-[var(--color-border)]", r.flags.length && "bg-amber-50/60")}>
                  <td className="py-1.5 font-semibold">{name(r.login)}</td>
                  <td className="py-1.5 tabular-nums">{r.day.slice(5).replace("-", "/")}</td>
                  <td className="py-1.5 tabular-nums">{clock(r.firstInMs)}</td>
                  <td className="py-1.5 tabular-nums">
                    {clock(r.lastMs)}
                    {!r.signedOut ? <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">last seen</span> : null}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatHM(r.activeMin)} <span className="text-[var(--color-text-muted)]">of {formatHM(r.spanMin)}</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums" title={`${r.output.quotes} quotes · ${r.output.updates} updates · ${r.output.visits} visits · ${r.output.leads} leads`}>
                    {outputTotal(r.output)}
                  </td>
                  <td className="py-1.5">
                    {r.flags.map((f) => (
                      <span key={f} className="mr-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                        {f}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
        Active = real use (clicks, keys, scrolls, touches) in the last 2 minutes, with the tab on screen. &quot;Last seen&quot; means the browser was closed without signing out. Flags: under 25% active on a day of 2 hours or more,
        an idle stretch of an hour or more, or no work recorded. Work counts quotes made, updates, visits and leads; visits are counted from now on.
      </p>
    </section>
  );
}
