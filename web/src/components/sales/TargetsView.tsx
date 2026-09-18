"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, Input, Label, NumberInput, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useLeads, useSalesTargets, useSalesTerritories } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { canManageSalesTargets, canManageTerritories } from "@/lib/auth/sales-access";
import { deleteSalesTarget, saveSalesTarget } from "@/lib/firebase/sales-targets";
import { deleteSalesTerritory, saveSalesTerritory } from "@/lib/firebase/sales-territories";
import { currentPeriod, periodLabel, periodOptions, quotaProgress } from "@/lib/sales/quota-progress";
import { TEAM_ROLES } from "@/lib/quotes/team-roles";
import type { SalesTarget } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

function Bar({ value }: { value: number | null }) {
  const width = Math.min(100, Math.round((value ?? 0) * 100));
  return (
    <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={width} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full", (value ?? 0) >= 1 ? "bg-emerald-500" : "bg-sky-500")} style={{ width: `${width}%` }} />
    </div>
  );
}

export function TargetsView() {
  const user = useAuthStore((s) => s.user);
  const { data: targets = [], isLoading } = useSalesTargets();
  const { data: territories = [] } = useSalesTerritories();
  const { data: leads = [] } = useLeads();
  const canTargets = canManageSalesTargets(user?.username, user?.role);
  const canTerr = canManageTerritories(user?.username, user?.role);

  const [period, setPeriod] = useState(currentPeriod());
  const periods = useMemo(() => {
    const set = new Set([...periodOptions(Date.now(), 3, 4), ...targets.map((t) => t.period)]);
    return [...set].sort();
  }, [targets]);

  const [form, setForm] = useState({ owner: "team:all", targetRevenue: 0, targetWinCount: 0, notes: "" });
  const [busy, setBusy] = useState(false);
  const [terrForm, setTerrForm] = useState({ name: "", description: "", members: [] as string[] });

  const rows = useMemo(
    () =>
      targets
        .filter((t) => t.period === period)
        .map((t) => ({ target: t, progress: quotaProgress(t, leads, territories) }))
        .sort((a, b) => a.target.owner.localeCompare(b.target.owner)),
    [targets, period, leads, territories],
  );

  // "jaya" is the historical login id of the current Free Hand desk (kavya) — don't list the desk twice.
  const reps = Object.keys(TEAM_ROLES).filter((k) => TEAM_ROLES[k]?.type !== "admin" && k !== "jaya");
  const ownerOptions = [
    { value: "team:all", label: "Whole team" },
    ...territories.map((t) => ({ value: `team:${t.name.toLowerCase()}`, label: `Territory: ${t.name}` })),
    ...reps.map((r) => ({ value: r, label: TEAM_ROLES[r]?.name || r })),
  ];
  const ownerLabel = (o: string) => ownerOptions.find((x) => x.value === o.toLowerCase())?.label || TEAM_ROLES[o]?.name || o;

  async function saveTarget() {
    if (form.targetRevenue <= 0 && form.targetWinCount <= 0) {
      toast("Set a revenue target or a win-count target", "error");
      return;
    }
    setBusy(true);
    try {
      const existing = targets.find((t) => t.owner.toLowerCase() === form.owner.toLowerCase() && t.period === period);
      await saveSalesTarget({
        id: existing?.id,
        owner: form.owner,
        period,
        targetRevenue: form.targetRevenue,
        targetWinCount: form.targetWinCount || undefined,
        notes: form.notes,
        createdBy: user?.username,
      });
      toast(existing ? "Target updated" : "Target added", "success");
      setForm({ owner: form.owner, targetRevenue: 0, targetWinCount: 0, notes: "" });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save target", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeTarget(t: SalesTarget) {
    if (!confirm(`Delete the ${periodLabel(t.period)} target for ${ownerLabel(t.owner)}?`)) return;
    try {
      await deleteSalesTarget(t.id);
      toast("Target deleted", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete target", "error");
    }
  }

  async function addTerritory() {
    if (!terrForm.name.trim()) {
      toast("Territory name is required", "error");
      return;
    }
    if (territories.some((t) => t.name.toLowerCase() === terrForm.name.trim().toLowerCase())) {
      toast("A territory with that name already exists", "error");
      return;
    }
    setBusy(true);
    try {
      await saveSalesTerritory({
        name: terrForm.name,
        description: terrForm.description,
        ownerUsernames: terrForm.members,
      });
      setTerrForm({ name: "", description: "", members: [] });
      toast("Territory added", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add territory", "error");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <Card>Loading targets…</Card>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold">
          Period
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-56">
            {periods.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
              </option>
            ))}
          </Select>
        </label>
        <p className="max-w-xl pb-1 text-[11px] text-[var(--color-text-muted)]">
          Progress counts leads marked <strong>won</strong> in the period, by owner (or by territory / whole team). Periods are
          calendar quarters. Leads closed before v0.3.43 use their last-updated date.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-slate-50 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Target for</th>
              <th className="px-3 py-2 text-right">Revenue goal</th>
              <th className="px-3 py-2 text-right">Achieved</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2 text-right">Wins</th>
              {canTargets ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canTargets ? 6 : 5} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                  No targets set for {periodLabel(period)}.{canTargets ? "" : " An admin can add them."}
                </td>
              </tr>
            ) : (
              rows.map(({ target, progress }) => (
                <tr
                  key={target.id}
                  className={cn("border-b last:border-0", target.owner.toLowerCase() === user?.username?.toLowerCase() && "bg-sky-50")}
                >
                  <td className="px-3 py-2 font-semibold">
                    {ownerLabel(target.owner)}
                    {target.owner.toLowerCase() === user?.username?.toLowerCase() ? " (you)" : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {target.targetRevenue ? formatCurrency(target.targetRevenue, "INR") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(progress.achieved, "INR")}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Bar value={progress.revenuePct ?? progress.winsPct} />
                      <span className="text-xs font-bold tabular-nums">{pct(progress.revenuePct ?? progress.winsPct)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {progress.wins}
                    {target.targetWinCount ? ` / ${target.targetWinCount}` : ""}
                  </td>
                  {canTargets ? (
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="text-red-700" aria-label="Delete target" onClick={() => void removeTarget(target)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canTargets ? (
        <Card className="border-sky-200 bg-sky-50/40">
          <h2 className="text-sm font-bold">Set a target for {periodLabel(period)}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Who</Label>
              <Select value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}>
                {ownerOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Revenue goal (INR)</Label>
              <NumberInput value={form.targetRevenue} onValueChange={(n) => setForm((f) => ({ ...f, targetRevenue: n }))} />
            </div>
            <div>
              <Label>Win-count goal (optional)</Label>
              <NumberInput value={form.targetWinCount} onValueChange={(n) => setForm((f) => ({ ...f, targetWinCount: n }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px] text-[var(--color-text-muted)]">Saving again for the same person and period updates the existing target.</p>
            <Button type="button" disabled={busy} onClick={() => void saveTarget()}>
              Save target
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-bold">Territories</h2>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Tags for grouping accounts and team targets. Pick one on an account (Accounts tab) and create a team target for it above.
        </p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {territories.length === 0 ? (
            <li className="text-[var(--color-text-muted)]">No territories yet.</li>
          ) : (
            territories.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <div>
                  <span className="font-semibold">{t.name}</span>
                  {t.description ? <span className="text-[var(--color-text-muted)]"> — {t.description}</span> : null}
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {t.ownerUsernames?.length ? t.ownerUsernames.map((u) => TEAM_ROLES[u]?.name || u).join(", ") : "No members assigned"}
                  </div>
                </div>
                {canTerr ? (
                  <button
                    type="button"
                    className="text-red-700"
                    aria-label={`Delete ${t.name}`}
                    onClick={() => {
                      if (confirm(`Delete territory "${t.name}"?`)) {
                        void deleteSalesTerritory(t.id).catch((e) => toast(e instanceof Error ? e.message : "Could not delete", "error"));
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>

        {canTerr ? (
          <div className="mt-3 grid gap-3 rounded-lg border border-[var(--color-border)] p-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input placeholder="e.g. South India" value={terrForm.name} onChange={(e) => setTerrForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={terrForm.description} onChange={(e) => setTerrForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Members</Label>
              <div className="mt-1 flex flex-wrap gap-3 text-sm">
                {reps.map((r) => (
                  <label key={r} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={terrForm.members.includes(r)}
                      onChange={(e) =>
                        setTerrForm((f) => ({
                          ...f,
                          members: e.target.checked ? [...f.members, r] : f.members.filter((m) => m !== r),
                        }))
                      }
                    />
                    {TEAM_ROLES[r]?.name || r}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button type="button" size="sm" className="gap-1.5" disabled={busy} onClick={() => void addTerritory()}>
                <Plus className="h-3.5 w-3.5" />
                Add territory
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
