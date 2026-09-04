"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Shield, UserPlus } from "lucide-react";
import { Badge, Button, Card, Input, Label, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useCreditControls } from "@/hooks/use-atlas-data";
import { queryKeys } from "@/hooks/query-keys";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { saveCreditControl } from "@/lib/firebase/admin-data";
import {
  clearRuntimeFirebaseConfig,
  loadGmapsKey,
  loadRuntimeFirebaseConfig,
  parseFirebaseConfigPaste,
  saveGmapsKey,
  saveRuntimeFirebaseConfig,
} from "@/lib/firebase/runtime-config";
import { isAdminUser, TEAM_ROLES } from "@/lib/quotes/team-roles";
import type { CreditControl } from "@/lib/types";

type ResetRequest = { username: string; at: number; status: string };
type PendingUser = {
  username: string;
  displayName: string;
  role: string;
  at: number;
};

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
  const [resets, setResets] = useState<ResetRequest[]>([]);
  const [queuedUsers, setQueuedUsers] = useState<PendingUser[]>([]);
  const [fbPaste, setFbPaste] = useState("");
  const [gmapsKey, setGmapsKey] = useState("");

  useEffect(() => {
    try {
      setResets(JSON.parse(localStorage.getItem("atlas_password_reset_requests") || "[]"));
      setQueuedUsers(JSON.parse(localStorage.getItem("atlas_pending_users") || "[]"));
      const runtime = loadRuntimeFirebaseConfig();
      if (runtime) setFbPaste(JSON.stringify(runtime, null, 2));
      setGmapsKey(loadGmapsKey());
    } catch {
      /* ignore */
    }
  }, []);

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

  function markReset(username: string, status: "done" | "dismissed") {
    const next = resets.map((r) =>
      r.username === username && r.status === "pending" ? { ...r, status } : r,
    );
    setResets(next);
    localStorage.setItem("atlas_password_reset_requests", JSON.stringify(next));
    toast(
      status === "done"
        ? `Marked reset processed for ${username} — complete in Firebase Auth console`
        : `Dismissed reset for ${username}`,
      "success",
    );
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
                  const entry = { ...newUser, at: Date.now() };
                  prev.push(entry);
                  localStorage.setItem(key, JSON.stringify(prev));
                  setQueuedUsers(prev);
                  toast(`Queued user ${newUser.username}`, "success");
                  setNewUser({ username: "", displayName: "", role: "pricing" });
                } catch {
                  toast("Could not save locally", "error");
                }
              }}
            >
              Queue registration
            </Button>
            {queuedUsers.length > 0 ? (
              <ul className="mt-3 max-h-36 space-y-1 overflow-auto text-xs">
                {queuedUsers
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((u, i) => (
                    <li key={`${u.username}-${i}`} className="rounded bg-slate-50 px-2 py-1">
                      {u.username} · {u.role}
                      {u.displayName ? ` · ${u.displayName}` : ""}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-bold">
            <KeyRound className="h-4 w-4" />
            Password reset queue
          </h2>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            Requests from the login “Forgot password” form. Process the actual password in Firebase
            Auth, then mark done here.
          </p>
          {resets.filter((r) => r.status === "pending").length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No pending reset requests.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {resets
                .filter((r) => r.status === "pending")
                .map((r) => (
                  <li
                    key={`${r.username}-${r.at}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <div>
                      <div className="font-semibold">{r.username}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {new Date(r.at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="px-3 py-1 text-xs"
                        onClick={() => markReset(r.username, "done")}
                      >
                        Mark done
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-1 text-xs"
                        onClick={() => markReset(r.username, "dismissed")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
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

      <Card>
        <h2 className="mb-2 font-bold">Firebase config / reconnect</h2>
        <p className="mb-3 text-xs text-[var(--color-text-muted)]">
          Paste a Firebase web config JSON to override env defaults (legacy gl_firebase_config).
          Saving reloads the app so Auth/Firestore reconnect.
        </p>
        <textarea
          className="min-h-32 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 font-mono text-xs"
          placeholder='{"apiKey":"...","projectId":"vertex-35d95",...}'
          value={fbPaste}
          onChange={(e) => setFbPaste(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              try {
                const cfg = parseFirebaseConfigPaste(fbPaste);
                saveRuntimeFirebaseConfig(cfg);
                toast("Firebase config saved — reloading…", "success");
                window.setTimeout(() => window.location.reload(), 600);
              } catch (e) {
                toast(e instanceof Error ? e.message : "Invalid config", "error");
              }
            }}
          >
            Save & reconnect
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              clearRuntimeFirebaseConfig();
              toast("Cleared override — using env defaults", "success");
              window.setTimeout(() => window.location.reload(), 600);
            }}
          >
            Clear override
          </Button>
        </div>
        <div className="mt-4 border-t pt-3">
          <Label>Google Maps embed API key (optional)</Label>
          <Input
            className="mt-1"
            value={gmapsKey}
            onChange={(e) => setGmapsKey(e.target.value)}
            placeholder="AIza…"
          />
          <Button
            type="button"
            className="mt-2"
            variant="secondary"
            onClick={() => {
              saveGmapsKey(gmapsKey);
              toast(gmapsKey.trim() ? "Maps key saved" : "Maps key cleared", "success");
            }}
          >
            Save Maps key
          </Button>
        </div>
      </Card>
    </div>
  );
}
