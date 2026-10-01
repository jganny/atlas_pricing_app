"use client";

import { useState } from "react";
import { Building2, Save } from "lucide-react";
import { Badge, Button, Card, Input, Label, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { fetchUserBranch, saveUserBranch } from "@/lib/firebase/admin-data";
import { HUB_BRANCH } from "@/lib/quotes/customs-holidays";
import { BRANCH_NAMES } from "@/lib/quotes/customs-holidays-2026-seed";
import { TEAM_ROLES } from "@/lib/quotes/team-roles";

export function UserBranchAdmin() {
  const admin = useAuthStore((s) => s.user);
  const [username, setUsername] = useState("");
  const [branch, setBranch] = useState(HUB_BRANCH);
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function lookup(u: string) {
    setUsername(u);
    setCurrent(null);
    if (!u.trim()) return;
    setLoading(true);
    try {
      const b = await fetchUserBranch(u.trim());
      setCurrent(b);
      setBranch(b);
    } catch {
      /* new/unknown user — defaults stay as-is */
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!username.trim()) {
      toast("Enter a login id first.", "error");
      return;
    }
    setSaving(true);
    try {
      await saveUserBranch(username.trim(), branch, admin?.username || "");
      setCurrent(branch);
      toast(`${username.trim()} is now set to ${branch}.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  }

  const knownLogins = Object.keys(TEAM_ROLES);

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-[var(--color-atlas-sky)]" />
        <h2 className="font-bold text-[var(--color-atlas-navy)]">Which branch does a login quote from?</h2>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        Bangalore is the default for every existing login — they see one combined "is this date a
        holiday anywhere" notice, not a specific branch. Set a login to a specific branch once
        they're actually based there, and they'll see only that branch's own holidays instead.
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <Label>Login id</Label>
          <Input
            list="known-logins"
            value={username}
            onChange={(e) => void lookup(e.target.value)}
            placeholder="e.g. goutham"
          />
          <datalist id="known-logins">
            {knownLogins.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
        <div>
          <Label>Branch</Label>
          <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value={HUB_BRANCH}>{HUB_BRANCH} (default — combined notice)</option>
            {BRANCH_NAMES.filter((b) => b !== HUB_BRANCH).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
          {loading ? <span className="text-xs text-[var(--color-text-muted)]">Checking…</span> : null}
          {!loading && current ? <Badge tone="info">Currently: {current}</Badge> : null}
        </div>
      </div>
    </Card>
  );
}
