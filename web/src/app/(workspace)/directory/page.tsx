"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Badge, Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useDirectory } from "@/hooks/use-atlas-data";
import { queryKeys } from "@/hooks/query-keys";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import {
  deleteDirectoryContact,
  saveDirectoryContact,
  type DirectoryContactInput,
} from "@/lib/firebase/directory";
import {
  fetchAgencyListRecipients,
  saveAgencyListRecipients,
} from "@/lib/firebase/admin-data";
import {
  canAccessVendorsDirectory,
  canEditAgentsDirectory,
  isAgencyContact,
} from "@/lib/auth/directory-access";
import type { DirectoryContact } from "@/lib/types";
import { cn } from "@/lib/utils";

type ParentTab = "agents" | "vendors";

const EMPTY_FORM: DirectoryContactInput = {
  name: "",
  category: "agency",
  contactPerson: "",
  email: "",
  phone: "",
  location: "",
  notes: "",
  sheetGroup: "agency",
  agreement: "",
  agreementUrl: "",
  agreementFileName: "",
  suspended: false,
};

function matchesSearch(c: DirectoryContact, q: string): boolean {
  if (!q) return true;
  const hay = [
    c.name,
    c.contactPerson,
    c.email,
    c.phone,
    c.location,
    c.notes,
    c.category,
    c.sheetGroup,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function exportContactsCsv(rows: DirectoryContact[], parent: ParentTab) {
  const headers = [
    "Name",
    "Category",
    "Contact Person",
    "Email",
    "Phone",
    "Location",
    "Agreement",
    "Suspended",
    "Notes",
    "Sheet Group",
  ];
  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((c) =>
      [
        c.name,
        c.category,
        c.contactPerson || "",
        c.email || "",
        c.phone || "",
        c.location || "",
        c.agreement || "",
        c.suspended ? "Yes" : "No",
        c.notes || "",
        c.sheetGroup || "",
      ]
        .map(escape)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `atlas_directory_${parent}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DirectoryPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading } = useDirectory();

  const canVendors = canAccessVendorsDirectory(user?.username, user?.role);
  const canEditAgents = canEditAgentsDirectory(user?.username, user?.role);

  const [parent, setParent] = useState<ParentTab>("agents");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DirectoryContactInput>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyEmails, setWeeklyEmails] = useState("");

  useEffect(() => {
    if (!editorOpen) return;
    const panel = document.getElementById("directory-contact-editor");
    panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const t = window.setTimeout(() => {
      document.getElementById("dir-name")?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [editorOpen]);

  useEffect(() => {
    if (!weeklyOpen) return;
    void (async () => {
      try {
        if (useLiveData) {
          const emails = await Promise.race([
            fetchAgencyListRecipients(),
            new Promise<string[]>((r) => setTimeout(() => r([]), 3000)),
          ]);
          setWeeklyEmails(emails.join(", "));
        } else {
          setWeeklyEmails(localStorage.getItem("atlas_agency_list_emails") || "");
        }
      } catch {
        setWeeklyEmails(localStorage.getItem("atlas_agency_list_emails") || "");
      }
    })();
  }, [weeklyOpen]);

  const effectiveParent: ParentTab =
    parent === "vendors" && !canVendors ? "agents" : parent;

  const canEdit =
    effectiveParent === "agents" ? canEditAgents : canVendors;

  const sectionRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows
      .filter((c) =>
        effectiveParent === "agents"
          ? isAgencyContact(c.category)
          : !isAgencyContact(c.category),
      )
      .filter((c) => {
        if (groupFilter === "all") return true;
        const g = c.sheetGroup || c.category || "";
        return g === groupFilter;
      })
      .filter((c) => matchesSearch(c, q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, effectiveParent, groupFilter, search]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    rows
      .filter((c) =>
        effectiveParent === "agents"
          ? isAgencyContact(c.category)
          : !isAgencyContact(c.category),
      )
      .forEach((c) => {
        const g = c.sheetGroup || c.category;
        if (g) set.add(g);
      });
    return Array.from(set).sort();
  }, [rows, effectiveParent]);

  const stats = useMemo(() => {
    const base = rows.filter((c) =>
      effectiveParent === "agents"
        ? isAgencyContact(c.category)
        : !isAgencyContact(c.category),
    );
    if (effectiveParent === "agents") {
      const active = base.filter((c) => !c.suspended);
      const countries = new Set(
        active.map((c) => (c.location || "").trim()).filter(Boolean),
      );
      const withAgreement = active.filter((c) => /^y/i.test(c.agreement || "")).length;
      const pct =
        active.length > 0 ? Math.round((withAgreement / active.length) * 100) : 0;
      return [
        { label: "Active agents", value: String(active.length) },
        { label: "Locations", value: String(countries.size) },
        { label: "Agreement on file", value: `${pct}%` },
        {
          label: "Suspended",
          value: String(base.length - active.length),
          warn: base.length - active.length > 0,
        },
      ];
    }
    const cats = new Set(base.map((c) => c.sheetGroup || c.category).filter(Boolean));
    return [
      { label: "Vendor contacts", value: String(base.length) },
      { label: "Categories", value: String(cats.size) },
    ];
  }, [rows, effectiveParent]);

  function openCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      category: effectiveParent === "agents" ? "agency" : "airline",
      sheetGroup: effectiveParent === "agents" ? "agency" : "Airlines",
    });
    setEditorOpen(true);
  }

  function openEdit(c: DirectoryContact) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      category: c.category,
      contactPerson: c.contactPerson || "",
      email: c.email || "",
      phone: c.phone || "",
      location: c.location || "",
      notes: c.notes || "",
      sheetGroup: c.sheetGroup || "",
      agreement: c.agreement || "",
      agreementUrl: c.agreementUrl || "",
      agreementFileName: c.agreementFileName || "",
      suspended: Boolean(c.suspended),
    });
    setEditorOpen(true);
  }

  async function importDirectoryExcel(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const mapped: DirectoryContact[] = raw.map((r, i) => {
      const get = (...names: string[]) => {
        const keys = Object.keys(r);
        for (const n of names) {
          const k = keys.find((x) => x.toLowerCase().replace(/\s/g, "") === n.toLowerCase());
          if (k != null) return String(r[k] ?? "").trim();
        }
        return "";
      };
      return {
        id: `dir-import-${Date.now()}-${i}`,
        name: get("name", "company", "agent"),
        category: get("category") || (effectiveParent === "agents" ? "agency" : "vendor"),
        contactPerson: get("contactperson", "contact"),
        email: get("email"),
        phone: get("phone"),
        location: get("location", "city", "country"),
        notes: get("notes"),
        sheetGroup: get("sheetgroup", "group") || get("category") || "agency",
        agreement: get("agreement"),
        suspended: /^y|true|1/i.test(get("suspended")),
        updatedAt: new Date().toISOString(),
      };
    }).filter((c) => c.name);
    if (!mapped.length) {
      toast("No contacts found in file", "error");
      return;
    }
    queryClient.setQueryData(queryKeys.directory, [...mapped, ...rows]);
    toast(`Imported ${mapped.length} contacts (session)`, "success");
  }

  async function saveWeekly() {
    const emails = weeklyEmails
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter(Boolean);
    try {
      if (useLiveData) {
        try {
          await Promise.race([
            saveAgencyListRecipients(emails),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
          ]);
        } catch {
          localStorage.setItem("atlas_agency_list_emails", emails.join(", "));
        }
      } else {
        localStorage.setItem("atlas_agency_list_emails", emails.join(", "));
      }
      toast(`Saved ${emails.length} recipients`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    }
  }

  async function persist(next: DirectoryContact[]) {
    queryClient.setQueryData(queryKeys.directory, next);
  }

  function applyLocalSave() {
    const now = new Date().toISOString();
    const by = user?.username || "demo";
    if (editingId) {
      void persist(
        rows.map((r) =>
          r.id === editingId
            ? { ...r, ...form, updatedAt: now, updatedBy: by }
            : r,
        ),
      );
    } else {
      void persist([
        {
          id: `dir-local-${Date.now()}`,
          ...form,
          updatedAt: now,
          updatedBy: by,
        },
        ...rows,
      ]);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast("Name is required", "error");
      return;
    }
    setBusy(true);
    try {
      if (useLiveData) {
        try {
          await Promise.race([
            saveDirectoryContact(
              { ...form, id: editingId || undefined },
              user?.username || "unknown",
            ),
            new Promise((_, reject) =>
              window.setTimeout(() => reject(new Error("Live save timed out")), 5000),
            ),
          ]);
          toast(editingId ? "Contact updated" : "Contact added", "success");
          await queryClient.invalidateQueries({ queryKey: queryKeys.directory });
        } catch (liveErr) {
          // Preview / rules / slow network: keep CRM usable with a local row.
          applyLocalSave();
          toast(
            liveErr instanceof Error
              ? `Saved locally (${liveErr.message})`
              : "Saved locally — live write failed",
            "info",
          );
        }
      } else {
        applyLocalSave();
        toast(editingId ? "Contact updated" : "Contact added", "success");
      }
      setEditorOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(c: DirectoryContact) {
    if (!canEdit) return;
    if (!window.confirm(`Delete “${c.name}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      if (useLiveData) {
        await deleteDirectoryContact(c.id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.directory });
      } else {
        await persist(rows.filter((r) => r.id !== c.id));
      }
      toast("Contact deleted", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Users className="h-5 w-5 text-[var(--color-atlas-sky)]" />
            <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">
              Directory
            </h1>
            <Badge tone="info">Phase 11</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Overseas agents and vendor contacts
            {useLiveData ? " from Firestore." : " (mock data — edits stay in this session)."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-semibold">
            <Upload className="h-4 w-4" />
            Import Excel
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importDirectoryExcel(f);
                e.target.value = "";
              }}
            />
          </label>
          <Button
            variant="secondary"
            className="gap-1.5"
            onClick={() => exportContactsCsv(sectionRows, effectiveParent)}
            disabled={sectionRows.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          {canEdit && effectiveParent === "agents" ? (
            <Button type="button" variant="secondary" onClick={() => setWeeklyOpen((v) => !v)}>
              Weekly agency list
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              className="gap-1.5"
              aria-expanded={editorOpen}
              onClick={() => {
                if (editorOpen && !editingId) {
                  setEditorOpen(false);
                  return;
                }
                openCreate();
              }}
            >
              <Plus className="h-4 w-4" />
              Add contact
            </Button>
          ) : null}
        </div>
      </div>

      {weeklyOpen ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <h2 className="font-bold">Weekly agency list recipients</h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Saved to app_settings/agencyListRecipients — Cloud Function sends the weekly mail.
          </p>
          <Textarea
            className="mt-2"
            rows={3}
            placeholder="one@branch.in, two@branch.in"
            value={weeklyEmails}
            onChange={(e) => setWeeklyEmails(e.target.value)}
          />
          <Button type="button" className="mt-2" onClick={() => void saveWeekly()}>
            Save recipients
          </Button>
        </Card>
      ) : null}

      {editorOpen ? (
        <Card
          className="border-[var(--color-atlas-sky)]/40 bg-sky-50/40"
          id="directory-contact-editor"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">
              {editingId ? "Edit contact" : "Add contact"}
            </h2>
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1"
              aria-label="Close editor"
              onClick={() => setEditorOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="dir-name">Name *</Label>
              <Input
                id="dir-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="dir-cat">Category</Label>
              <Select
                id="dir-cat"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value,
                    sheetGroup:
                      e.target.value === "agency"
                        ? "agency"
                        : f.sheetGroup === "agency"
                          ? e.target.value
                          : f.sheetGroup,
                  }))
                }
              >
                <option value="agency">agency (Overseas Agent)</option>
                <option value="airline">airline</option>
                <option value="liner">liner</option>
                <option value="vendor">vendor</option>
                <option value="other">other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="dir-group-field">Sheet group</Label>
              <Input
                id="dir-group-field"
                value={form.sheetGroup || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sheetGroup: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="dir-person">Contact person</Label>
              <Input
                id="dir-person"
                value={form.contactPerson || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactPerson: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="dir-loc">Location</Label>
              <Input
                id="dir-loc"
                value={form.location || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="dir-email">Email</Label>
              <Input
                id="dir-email"
                type="email"
                value={form.email || ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="dir-phone">Phone</Label>
              <Input
                id="dir-phone"
                value={form.phone || ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="dir-agree">Agreement on file</Label>
              <Select
                id="dir-agree"
                value={form.agreement || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, agreement: e.target.value }))
                }
              >
                <option value="">—</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="dir-agree-url">Agreement file URL</Label>
              <Input
                id="dir-agree-url"
                placeholder="https://… or storage link"
                value={form.agreementUrl || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, agreementUrl: e.target.value }))
                }
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={Boolean(form.suspended)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, suspended: e.target.checked }))
                  }
                />
                Suspended
              </label>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="dir-notes">Notes</Label>
              <Textarea
                id="dir-notes"
                rows={3}
                value={form.notes || ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleSave()}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {editingId ? "Save changes" : "Add contact"}
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2">
        <button
          type="button"
          onClick={() => {
            setParent("agents");
            setGroupFilter("all");
          }}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-bold transition-colors",
            effectiveParent === "agents"
              ? "bg-[var(--color-atlas-navy)] text-white"
              : "text-[var(--color-text-muted)] hover:bg-slate-100",
          )}
        >
          Overseas Agents
        </button>
        {canVendors ? (
          <button
            type="button"
            onClick={() => {
              setParent("vendors");
              setGroupFilter("all");
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-bold transition-colors",
              effectiveParent === "vendors"
                ? "bg-[var(--color-atlas-navy)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-slate-100",
            )}
          >
            Vendor Contacts
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
          >
            <div
              className={cn(
                "text-lg font-extrabold text-[var(--color-atlas-navy)]",
                "warn" in s && s.warn && "text-rose-700",
              )}
            >
              {s.value}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Label htmlFor="directory-search" className="sr-only">
            Search contacts
          </Label>
          <Search className="pointer-events-none absolute left-3 top-[calc(50%+2px)] h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="directory-search"
            className="mt-0 pl-9"
            placeholder="Search name, email, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        {groups.length > 0 ? (
          <div className="w-44">
            <Label htmlFor="dir-group">Category</Label>
            <Select
              id="dir-group"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="all">All</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="pb-2 text-xs font-semibold text-[var(--color-text-muted)]">
          Showing {sectionRows.length} contact{sectionRows.length === 1 ? "" : "s"}
          {search.trim() ? " (filtered)" : ""}
        </div>
      </div>

      {isLoading ? (
        <Card className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading contacts…
        </Card>
      ) : sectionRows.length === 0 ? (
        <Card className="text-center text-sm text-[var(--color-text-muted)]">
          <Building2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          No contacts in this view
          {search ? " matching your search." : "."}
          {canEdit ? " Use Add contact to create one." : null}
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Email / Phone</th>
                <th className="px-3 py-2">Status</th>
                {canEdit ? <th className="px-3 py-2 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {sectionRows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-slate-50/80"
                >
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-[var(--color-atlas-navy)]">
                      {c.name}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {c.sheetGroup || c.category}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{c.contactPerson || "—"}</td>
                  <td className="px-3 py-2.5">{c.location || "—"}</td>
                  <td className="px-3 py-2.5">
                    <div>{c.email || "—"}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {c.phone || ""}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {c.suspended ? (
                      <Badge tone="error">Suspended</Badge>
                    ) : /^y/i.test(c.agreement || "") ? (
                      <Badge tone="success">Agreement</Badge>
                    ) : (
                      <Badge tone="neutral">Active</Badge>
                    )}
                  </td>
                  {canEdit ? (
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          className="px-2 py-1"
                          aria-label="Edit"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-rose-700"
                          aria-label="Delete"
                          disabled={busy}
                          onClick={() => void handleDelete(c)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
