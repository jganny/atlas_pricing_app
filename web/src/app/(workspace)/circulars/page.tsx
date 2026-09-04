"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { Badge, Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "@/components/Toast";
import { useAirTariffs, useCirculars, useSeaTariffs } from "@/hooks/use-atlas-data";
import { queryKeys } from "@/hooks/query-keys";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import {
  CIRCULAR_CATEGORIES,
  deleteCircular,
  parseTariffImportRows,
  publishAirTariffRows,
  saveCircular,
  uploadCircularFile,
} from "@/lib/firebase/circulars";
import { canAccessVendorsDirectory } from "@/lib/auth/directory-access";
import type { CircularRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function CircularsPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const canManage = canAccessVendorsDirectory(user?.username, user?.role);
  const { data: air = [], isLoading: airLoading } = useAirTariffs();
  const { data: sea = [], isLoading: seaLoading } = useSeaTariffs();
  const { data: circulars = [], isLoading: circLoading, refetch } = useCirculars();

  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    carrier: "",
    category: "airline_tariff",
    notes: "",
    effectiveDate: "",
    expiryDate: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<
    Array<{ origin: string; destination: string; carrier: string; sell: number; buy: number }>
  >([]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return circulars.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (!q) return true;
      return [c.title, c.carrier, c.fileName, c.notes, c.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [circulars, category, search]);

  async function handleSave() {
    if (!form.title.trim()) {
      toast("Title is required", "error");
      return;
    }
    setBusy(true);
    try {
      let fileMeta: { fileName?: string; downloadURL?: string; storagePath?: string } = {};
      if (file && useLiveData) {
        try {
          fileMeta = await Promise.race([
            uploadCircularFile(file, form.category),
            new Promise<never>((_, rej) =>
              setTimeout(() => rej(new Error("Upload timed out")), 8000),
            ),
          ]);
        } catch (e) {
          fileMeta = { fileName: file.name };
          toast(
            e instanceof Error ? `File metadata only (${e.message})` : "Saved without storage URL",
            "info",
          );
        }
      } else if (file) {
        fileMeta = { fileName: file.name };
      }

      if (useLiveData) {
        try {
          await Promise.race([
            saveCircular({ ...form, ...fileMeta }, user?.username || "unknown"),
            new Promise((_, rej) => setTimeout(() => rej(new Error("Save timed out")), 5000)),
          ]);
        } catch (e) {
          const local: CircularRecord = {
            id: `circ-local-${Date.now()}`,
            ...form,
            ...fileMeta,
            createdAt: new Date().toISOString(),
            uploadedBy: user?.username,
          };
          queryClient.setQueryData(queryKeys.circulars, [local, ...circulars]);
          toast(
            e instanceof Error ? `Saved locally (${e.message})` : "Saved locally",
            "info",
          );
          setEditorOpen(false);
          setFile(null);
          return;
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.circulars });
        await refetch();
      } else {
        const local: CircularRecord = {
          id: `circ-local-${Date.now()}`,
          ...form,
          ...fileMeta,
          createdAt: new Date().toISOString(),
        };
        queryClient.setQueryData(queryKeys.circulars, [local, ...circulars]);
      }
      toast("Circular saved", "success");
      setEditorOpen(false);
      setFile(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(c: CircularRecord) {
    if (!canManage) return;
    if (!window.confirm(`Delete “${c.title || c.fileName}”?`)) return;
    setBusy(true);
    try {
      if (useLiveData && !c.id.startsWith("circ-local")) {
        await deleteCircular(c.id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.circulars });
      } else {
        queryClient.setQueryData(
          queryKeys.circulars,
          circulars.filter((x) => x.id !== c.id),
        );
      }
      toast("Deleted", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onImportFile(f: File) {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const parsed = parseTariffImportRows(rows);
    setImportPreview(parsed);
    toast(`Parsed ${parsed.length} tariff rows`, parsed.length ? "success" : "info");
  }

  async function publishImport() {
    if (!importPreview.length) return;
    setBusy(true);
    try {
      if (useLiveData) {
        try {
          const n = await Promise.race([
            publishAirTariffRows(importPreview, user?.username || "unknown"),
            new Promise<number>((_, rej) =>
              setTimeout(() => rej(new Error("Publish timed out")), 8000),
            ),
          ]);
          toast(`Published ${n} air tariffs`, "success");
          await queryClient.invalidateQueries({ queryKey: queryKeys.airTariffs });
        } catch (e) {
          toast(
            e instanceof Error
              ? `Import preview kept locally (${e.message})`
              : "Could not publish — preview kept",
            "info",
          );
        }
      } else {
        toast(`Mock mode — ${importPreview.length} rows ready (not written)`, "info");
      }
    } finally {
      setBusy(false);
    }
  }

  const loading = airLoading || seaLoading || circLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--color-atlas-sky)]" />
            <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">
              Circulars library
            </h1>
            <Badge tone="info">Phase 11</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Documents, category tabs, and Excel → tariff publish.
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            className="gap-1.5"
            onClick={() => {
              setForm({
                title: "",
                carrier: "",
                category: category === "all" ? "airline_tariff" : category,
                notes: "",
                effectiveDate: "",
                expiryDate: "",
              });
              setFile(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add document
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-bold",
            category === "all"
              ? "bg-[var(--color-atlas-navy)] text-white"
              : "bg-slate-100 text-slate-600",
          )}
        >
          All
        </button>
        {CIRCULAR_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold",
              category === c.id
                ? "bg-[var(--color-atlas-navy)] text-white"
                : "bg-slate-100 text-slate-600",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Input
        className="mt-0 max-w-md"
        placeholder="Search circulars…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {editorOpen ? (
        <Card id="circular-editor" className="border-sky-200 bg-sky-50/40">
          <h2 className="font-extrabold text-[var(--color-atlas-navy)]">Add document</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="circ-title">Title *</Label>
              <Input
                id="circ-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="circ-cat">Category</Label>
              <Select
                id="circ-cat"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CIRCULAR_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="circ-carrier">Carrier</Label>
              <Input
                id="circ-carrier"
                value={form.carrier}
                onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="circ-eff">Effective (YYYY-MM)</Label>
              <Input
                id="circ-eff"
                value={form.effectiveDate}
                onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="circ-exp">Expiry (YYYY-MM)</Label>
              <Input
                id="circ-exp"
                value={form.expiryDate}
                onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="circ-file">File (PDF / Excel / Word)</Label>
              <Input
                id="circ-file"
                type="file"
                accept=".pdf,.xls,.xlsx,.doc,.docx"
                className="mt-1"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="circ-notes">Notes</Label>
              <Textarea
                id="circ-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleSave()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save document
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 font-bold">Documents ({filtered.length})</h2>
        {loading ? (
          <TableSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No circulars in this category.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {filtered.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                <div>
                  <div className="font-semibold">{c.title || c.fileName || "Untitled"}</div>
                  <div className="text-[var(--color-text-muted)]">
                    {[c.carrier, c.category, c.fileName].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.downloadURL ? (
                    <a
                      href={c.downloadURL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-sky-700"
                    >
                      Open
                    </a>
                  ) : null}
                  {canManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-2 py-1 text-rose-700"
                      disabled={busy}
                      onClick={() => void handleDelete(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canManage ? (
        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-bold">
            <Upload className="h-4 w-4" />
            Excel → publish air tariffs
          </h2>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            Columns: Origin, Destination, Carrier, Sell, Buy (optional).
          </p>
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="mt-0 max-w-md"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
            }}
          />
          {importPreview.length > 0 ? (
            <div className="mt-3 space-y-2">
              <div className="text-sm font-semibold">{importPreview.length} rows ready</div>
              <ul className="max-h-40 overflow-auto text-xs">
                {importPreview.slice(0, 8).map((r, i) => (
                  <li key={i}>
                    {r.origin}→{r.destination} · {r.carrier} · sell {r.sell}
                  </li>
                ))}
              </ul>
              <Button type="button" disabled={busy} onClick={() => void publishImport()}>
                Publish to air_tariffs
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Published air tariffs</h2>
          <ul className="space-y-2 text-sm">
            {air.length === 0 ? (
              <li className="text-[var(--color-text-muted)]">None yet.</li>
            ) : (
              air.slice(0, 12).map((t) => (
                <li key={t.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="font-semibold">{t.carrier}</div>
                  <div className="text-[var(--color-text-muted)]">
                    {t.origin} → {t.destination} · {t.currency}
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Published sea tariffs</h2>
          <ul className="space-y-2 text-sm">
            {sea.length === 0 ? (
              <li className="text-[var(--color-text-muted)]">None yet.</li>
            ) : (
              sea.slice(0, 12).map((t) => (
                <li key={t.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="font-semibold">{t.carrier}</div>
                  <div className="text-[var(--color-text-muted)]">
                    {t.origin} → {t.destination} · {t.mode.toUpperCase()}
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
