"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useAccounts } from "@/hooks/use-atlas-data";
import { saveAccount } from "@/lib/firebase/accounts";
import { useAuthStore } from "@/store/auth";
import type { Account } from "@/lib/types";
import { AccountDetailPanel } from "./AccountDetailPanel";

const EMPTY_FORM = { name: "", industry: "", website: "" };

export function AccountsView() {
  const user = useAuthStore((s) => s.user);
  const { data: accounts = [], isLoading } = useAccounts();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return accounts;
    return accounts.filter((a) => `${a.name} ${a.industry || ""} ${a.territory || ""}`.toLowerCase().includes(q));
  }, [accounts, query]);

  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  async function createAccount() {
    if (!form.name.trim()) {
      toast("Account name is required", "error");
      return;
    }
    if (!user?.username) {
      toast("Sign in required", "error");
      return;
    }
    setBusy(true);
    try {
      const id = await saveAccount({
        name: form.name,
        industry: form.industry,
        website: form.website,
        owner: user.username,
        accountType: "prospect",
      });
      setSelectedId(id);
      setCreating(false);
      setForm(EMPTY_FORM);
      toast("Account created", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create account", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded-md border px-2.5 py-1.5 text-sm"
          placeholder="Search account, industry, territory…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="button" className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New account
        </Button>
      </div>

      {creating ? (
        <Card className="border-sky-200 bg-sky-50/40">
          <h2 className="font-bold">New account</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Industry</Label>
              <Input value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            You&apos;ll be set as the owner — an admin can reassign it afterward.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void createAccount()}>
              Create
            </Button>
          </div>
        </Card>
      ) : null}

      {isLoading ? (
        <Card>Loading accounts…</Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Industry</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Territory</th>
                <th className="px-3 py-2">Owner</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                    No accounts yet.
                  </td>
                </tr>
              ) : (
                visible.map((a) => (
                  <tr
                    key={a.id}
                    className={`cursor-pointer border-b last:border-0 hover:bg-slate-50 ${selectedId === a.id ? "bg-sky-50" : ""}`}
                    onClick={() => setSelectedId(a.id)}
                  >
                    <td className="px-3 py-2 font-semibold">{a.name}</td>
                    <td className="px-3 py-2">{a.industry || "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={a.accountType === "customer" ? "success" : a.accountType === "churned" ? "error" : "neutral"}>
                        {a.accountType || "prospect"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{a.territory || "—"}</td>
                    <td className="px-3 py-2">{a.owner || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <AccountDetailPanel
          key={selected.id}
          account={selected}
          onSaved={() => {}}
          onDeleted={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
