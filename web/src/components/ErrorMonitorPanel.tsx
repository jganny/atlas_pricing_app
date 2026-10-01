"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Badge, Button, Card, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import { deleteClientErrors, fetchClientErrors } from "@/lib/firebase/client-errors";
import { groupErrors, withinHours, type ErrorGroup } from "@/lib/monitoring/error-groups";
import { appVersion } from "@/lib/env";
import { deskDisplayName } from "@/lib/quotes/team-roles";

const WINDOWS = [
  { id: "24", label: "Last 24 hours" },
  { id: "168", label: "Last 7 days" },
  { id: "all", label: "Everything stored" },
] as const;

function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(mins)) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

/** Admin-only: crashes and unhandled errors from real users, grouped into distinct problems. */
export function ErrorMonitorPanel() {
  const qc = useQueryClient();
  const { data = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["clientErrors"],
    queryFn: () => fetchClientErrors(400),
    staleTime: 30_000,
    retry: 0,
  });
  const [win, setWin] = useState<(typeof WINDOWS)[number]["id"]>("168");
  const [open, setOpen] = useState<string | null>(null);

  const scoped = useMemo(() => (win === "all" ? data : withinHours(data, Number(win))), [data, win]);
  const groups = useMemo(() => groupErrors(scoped), [scoped]);
  const last24 = useMemo(() => withinHours(data, 24), [data]);
  const users24 = useMemo(() => new Set(last24.map((r) => r.actor)).size, [last24]);
  const newInThisVersion = useMemo(
    () => groups.filter((g) => g.versions.length === 1 && g.versions[0] === appVersion).length,
    [groups],
  );

  async function resolve(g: ErrorGroup) {
    if (!confirm(`Mark this problem as resolved? This deletes its ${g.count} stored occurrence(s).`)) return;
    try {
      await deleteClientErrors(g.ids);
      await qc.invalidateQueries({ queryKey: ["clientErrors"] });
      toast("Marked resolved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not resolve", "error");
    }
  }

  return (
    <Card data-testid="error-monitor">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-bold">Error monitor</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Crashes and unhandled errors from signed-in users of this app, grouped into distinct problems. Each user sees a short reference code on
            the crash screen that matches the code here.
          </p>
        </div>
        <div className="flex gap-2">
          <Select aria-label="Time window" className="mt-0 w-44" value={win} onChange={(e) => setWin(e.target.value as typeof win)}>
            {WINDOWS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </Select>
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm sm:grid-cols-4">
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Distinct problems</div>
          <div className="text-lg font-extrabold">{groups.length}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Errors, last 24 h</div>
          <div className={last24.length ? "text-lg font-extrabold text-red-700" : "text-lg font-extrabold text-emerald-700"}>{last24.length}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Users affected, 24 h</div>
          <div className="text-lg font-extrabold">{users24}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Only on v{appVersion.replace("-test-app", "")}</div>
          <div className="text-lg font-extrabold">{newInThisVersion}</div>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          Couldn&apos;t load errors. This is admin-only and needs its database rule deployed — {error instanceof Error ? error.message : "permission denied"}.
        </p>
      ) : null}

      <div className="mt-3 max-h-[30rem] overflow-auto rounded-lg border border-[var(--color-border)]" role="region" aria-label="Error groups" tabIndex={0}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 border-b bg-slate-50 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Problem</th>
              <th className="px-3 py-2 text-right">Times</th>
              <th className="px-3 py-2">Users</th>
              <th className="px-3 py-2">Versions</th>
              <th className="px-3 py-2">Last seen</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                  Loading…
                </td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-emerald-700">
                  No errors recorded in this window.
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <>
                  <tr key={g.fingerprint} className="cursor-pointer border-b align-top hover:bg-slate-50" onClick={() => setOpen(open === g.fingerprint ? null : g.fingerprint)}>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{g.message || "(no message)"}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">ref {g.fingerprint} · {g.paths.slice(0, 2).join(", ")}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <Badge tone={g.count >= 5 ? "error" : "warn"}>{g.count}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{g.users.map((u) => deskDisplayName(u)).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-xs">{g.versions.map((v) => v.replace("-test-app", "")).join(", ")}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{ago(g.lastSeen)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          void resolve(g);
                        }}
                      >
                        Resolve
                      </Button>
                    </td>
                  </tr>
                  {open === g.fingerprint ? (
                    <tr key={`${g.fingerprint}-d`} className="border-b bg-slate-50">
                      <td colSpan={6} className="px-3 py-2">
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[11px]">{g.stack || "No stack captured."}</pre>
                        {g.componentStack ? (
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-[var(--color-text-muted)]">{g.componentStack}</pre>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
