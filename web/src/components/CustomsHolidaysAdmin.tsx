"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Plus, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, Input, Label, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { useCustomsHolidays } from "@/hooks/use-atlas-data";
import { queryKeys } from "@/hooks/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import {
  deleteCustomsHoliday,
  importCustomsHolidays,
  upsertCustomsHoliday,
} from "@/lib/firebase/customs-holidays";
import { buildCustomsHolidays2026 } from "@/lib/quotes/customs-holidays-2026-seed";

export function CustomsHolidaysAdmin() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: holidays = [] } = useCustomsHolidays();
  const [branch, setBranch] = useState("");
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("all");
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const branches = useMemo(
    () => Array.from(new Set(holidays.map((h) => h.branch))).sort(),
    [holidays],
  );

  const visible = useMemo(() => {
    const rows = filter === "all" ? holidays : holidays.filter((h) => h.branch === filter);
    return [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.branch.localeCompare(b.branch));
  }, [holidays, filter]);

  async function addRow() {
    if (!branch.trim() || !date || !name.trim()) {
      toast("Branch, date and name are all required.", "error");
      return;
    }
    setSaving(true);
    try {
      await upsertCustomsHoliday({ branch: branch.trim(), date, name: name.trim() }, user?.username || "");
      await queryClient.invalidateQueries({ queryKey: queryKeys.customsHolidays });
      setBranch("");
      setDate("");
      setName("");
      toast("Holiday added.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(id: string) {
    try {
      await deleteCustomsHoliday(id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.customsHolidays });
      toast("Removed.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove.", "error");
    }
  }

  async function runImport() {
    setImporting(true);
    try {
      const rows = buildCustomsHolidays2026();
      const count = await importCustomsHolidays(rows, user?.username || "");
      await queryClient.invalidateQueries({ queryKey: queryKeys.customsHolidays });
      toast(`Imported ${count} holidays across ${new Set(rows.map((r) => r.branch)).size} branches.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed.", "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[var(--color-atlas-sky)]" />
          <h2 className="font-bold text-[var(--color-atlas-navy)]">Branch holiday calendar</h2>
          <Badge tone="info">{holidays.length} entries</Badge>
        </div>
        <Button type="button" variant="secondary" size="sm" disabled={importing} onClick={() => void runImport()}>
          <Upload className="h-3.5 w-3.5" />
          {importing ? "Importing…" : "Import 2026 holiday list"}
        </Button>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        Used to warn desk users and flag it on the quote itself when a lane touches a branch with a
        holiday in the next 14 days. "Import 2026 holiday list" is a one-click, one-time seed from
        the PDF already on file — safe to run again, it just overwrites the same 2026 rows. Add
        next year&apos;s list below once you have it.
      </p>

      <div className="grid gap-2 sm:grid-cols-4">
        <div>
          <Label>Branch</Label>
          <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Mumbai" />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Holiday name</Label>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali" />
            <Button type="button" size="sm" disabled={saving} onClick={() => void addRow()}>
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </div>
      </div>

      {branches.length > 0 ? (
        <div className="flex items-center gap-2">
          <Label>Filter</Label>
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-48">
            <option value="all">All branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="max-h-80 space-y-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">No holidays on file yet.</p>
        ) : (
          visible.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs"
            >
              <span>
                <strong>{h.date}</strong> · {h.branch} · {h.name}
              </span>
              <button
                type="button"
                className="rounded p-0.5 text-red-600 outline-none focus:ring-2 focus:ring-red-400"
                aria-label={`Delete ${h.name} (${h.branch}, ${h.date})`}
                onClick={() => void removeRow(h.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
