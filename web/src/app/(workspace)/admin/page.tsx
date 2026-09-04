"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, UserPlus } from "lucide-react";
import { Badge, Button, Card, Input, Label, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useCreditControls } from "@/hooks/use-atlas-data";
import { queryKeys } from "@/hooks/query-keys";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { saveCreditControl } from "@/lib/firebase/admin-data";
import { isAdminUser, TEAM_ROLES } from "@/lib/quotes/team-roles";
import type { CreditControl } from "@/lib/types";

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: credits = [] } = useCreditControls();
  const admin = isAdminUser(user?.username, user?.role);

  const [newUser, setNewUser] = useState({ username: "", displayName: "", role: "pricing" });
  const [nrs, setNrs] = useState({
    shipper: "",
    consignee: "",
    quoteRef: "",
  });
  const [creditForm, setCreditForm] = useState({
    customer: "",
    creditDays: 30,
    creditLimit: 0,
    hasAgreement: false,
    blocked: false,
    notes: "",
  });

  if (!admin) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <p className="text-sm font-semibold text-amber-900">
          Admin console is limited to ganny / manager logins.
        </p>
      </Card>
    );
  }

  async function saveCredit() {
    if (!creditForm.customer.trim()) {
      toast("Customer required", "error");
      return;
    }
    try {
      if (useLiveData) {
        try {
          await Promise.race([
            saveCreditControl(creditForm),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
          ]);
        } catch {
          /* local */
        }
      }
      const row: CreditControl = {
        id: creditForm.customer.toLowerCase().replace(/\s+/g, "_"),
        ...creditForm,
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData(queryKeys.credit, [
        row,
        ...credits.filter((c) => c.customer.toLowerCase() !== row.customer.toLowerCase()),
      ]);
      toast("Credit control saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-[var(--color-atlas-sky)]" />
        <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Admin console</h1>
        <Badge tone="info">Phase 12</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-bold">
            <UserPlus className="h-4 w-4" />
            Register desk user
          </h2>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            Creates a local roster entry for RBAC preview. Live Auth provisioning stays in Firebase
            console until Cloud Function is wired.
          </p>
          <div className="space-y-2">
            <div>
              <Label>Username</Label>
              <Input
                value={newUser.username}
                onChange={(e) => setNewUser((u) => ({ ...u, username: e.target.value }))}
              />
            </div>
            <div>
              <Label>Display name</Label>
              <Input
                value={newUser.displayName}
                onChange={(e) => setNewUser((u) => ({ ...u, displayName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Role template</Label>
              <Select
                value={newUser.role}
                onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
              >
                {Object.keys(TEAM_ROLES).map((id) => (
                  <option key={id} value={id}>
                    {TEAM_ROLES[id].name} ({id})
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              onClick={() => {
                if (!newUser.username.trim()) {
                  toast("Username required", "error");
                  return;
                }
                try {
                  const key = "atlas_pending_users";
                  const prev = JSON.parse(localStorage.getItem(key) || "[]");
                  prev.push({ ...newUser, at: Date.now() });
                  localStorage.setItem(key, JSON.stringify(prev));
                  toast(`Queued user ${newUser.username}`, "success");
                  setNewUser({ username: "", displayName: "", role: "pricing" });
                } catch {
                  toast("Could not save locally", "error");
                }
              }}
            >
              Queue registration
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 font-bold">NRS convert capture</h2>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            Shipper / consignee registry for NRS conversion (mirrors nrs_registry).
          </p>
          <div className="space-y-2">
            <div>
              <Label>Quote ref</Label>
              <Input
                value={nrs.quoteRef}
                onChange={(e) => setNrs((n) => ({ ...n, quoteRef: e.target.value }))}
              />
            </div>
            <div>
              <Label>Shipper</Label>
              <Input
                value={nrs.shipper}
                onChange={(e) => setNrs((n) => ({ ...n, shipper: e.target.value }))}
              />
            </div>
            <div>
              <Label>Consignee</Label>
              <Input
                value={nrs.consignee}
                onChange={(e) => setNrs((n) => ({ ...n, consignee: e.target.value }))}
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                if (!nrs.shipper || !nrs.consignee) {
                  toast("Shipper and consignee required", "error");
                  return;
                }
                try {
                  const key = "atlas_nrs_registry";
                  const prev = JSON.parse(localStorage.getItem(key) || "[]");
                  prev.push({ ...nrs, by: user?.username, at: Date.now() });
                  localStorage.setItem(key, JSON.stringify(prev));
                  toast("NRS parties captured", "success");
                  setNrs({ shipper: "", consignee: "", quoteRef: "" });
                } catch {
                  toast("Could not save", "error");
                }
              }}
            >
              Save NRS parties
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-bold">Customer credit control</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Customer</Label>
            <Input
              value={creditForm.customer}
              onChange={(e) => setCreditForm((f) => ({ ...f, customer: e.target.value }))}
            />
          </div>
          <div>
            <Label>Credit days</Label>
            <Input
              type="number"
              value={creditForm.creditDays}
              onChange={(e) =>
                setCreditForm((f) => ({ ...f, creditDays: Number(e.target.value) || 0 }))
              }
            />
          </div>
          <div>
            <Label>Limit</Label>
            <Input
              type="number"
              value={creditForm.creditLimit}
              onChange={(e) =>
                setCreditForm((f) => ({ ...f, creditLimit: Number(e.target.value) || 0 }))
              }
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={creditForm.hasAgreement}
              onChange={(e) =>
                setCreditForm((f) => ({ ...f, hasAgreement: e.target.checked }))
              }
            />
            Agreement on file
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={creditForm.blocked}
              onChange={(e) => setCreditForm((f) => ({ ...f, blocked: e.target.checked }))}
            />
            Block new quotes
          </label>
        </div>
        <Button type="button" className="mt-3" onClick={() => void saveCredit()}>
          Save credit rule
        </Button>

        <ul className="mt-4 space-y-2 text-sm">
          {credits.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
            >
              <div>
                <div className="font-semibold">{c.customer}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {c.creditDays}d · limit {c.creditLimit}
                  {c.hasAgreement ? " · agreement" : ""}
                </div>
              </div>
              {c.blocked ? <Badge tone="error">Blocked</Badge> : <Badge tone="success">Open</Badge>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
