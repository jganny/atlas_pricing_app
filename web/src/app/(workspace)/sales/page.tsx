"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Briefcase, Loader2, Plus } from "lucide-react";
import { Badge, Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useLeads } from "@/hooks/use-atlas-data";
import { queryKeys } from "@/hooks/query-keys";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import {
  addLeadActivity,
  fetchLeadActivities,
  saveLead,
  updateLeadStatus,
} from "@/lib/firebase/sales";
import { mockApi } from "@/lib/mock/api";
import type { LeadActivity, LeadStatus, SalesLead } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

const STAGES: LeadStatus[] = ["new", "contacted", "qualified", "quoted", "won", "lost"];

export default function SalesPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: leads = [], isLoading } = useLeads();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    company: "",
    contactName: "",
    email: "",
    mode: "air" as SalesLead["mode"],
    lane: "",
    dealValue: 0,
    nextAction: "",
  });

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  async function openLead(lead: SalesLead) {
    setSelectedId(lead.id);
    try {
      if (useLiveData) {
        const rows = await Promise.race([
          fetchLeadActivities(lead.id),
          new Promise<LeadActivity[]>((resolve) =>
            setTimeout(() => resolve([]), 4000),
          ),
        ]);
        if (rows.length) setActivities(rows);
        else setActivities(await mockApi.fetchLeadActivities(lead.id));
      } else {
        setActivities(await mockApi.fetchLeadActivities(lead.id));
      }
    } catch {
      setActivities(await mockApi.fetchLeadActivities(lead.id));
    }
  }

  async function moveLead(id: string, status: LeadStatus) {
    setBusy(true);
    try {
      if (useLiveData) {
        try {
          await Promise.race([
            updateLeadStatus(id, status),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
          ]);
        } catch {
          /* local */
        }
      }
      queryClient.setQueryData(
        queryKeys.leads,
        leads.map((l) =>
          l.id === id ? { ...l, status, updatedAt: new Date().toISOString() } : l,
        ),
      );
      toast(`Moved to ${status}`, "success");
    } finally {
      setBusy(false);
    }
  }

  async function createLead() {
    if (!form.company.trim()) {
      toast("Company is required", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        company: form.company,
        contactName: form.contactName,
        email: form.email,
        status: "new" as LeadStatus,
        mode: form.mode,
        lane: form.lane,
        dealValue: form.dealValue,
        nextAction: form.nextAction,
        owner: user?.username || "",
      };
      let id = `lead-local-${Date.now()}`;
      if (useLiveData) {
        try {
          id = await Promise.race([
            saveLead(payload),
            new Promise<string>((_, rej) =>
              setTimeout(() => rej(new Error("timeout")), 4000),
            ),
          ]);
        } catch {
          /* keep local id */
        }
      }
      const row: SalesLead = {
        id,
        ...payload,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData(queryKeys.leads, [row, ...leads]);
      setCreating(false);
      setForm({
        company: "",
        contactName: "",
        email: "",
        mode: "air",
        lane: "",
        dealValue: 0,
        nextAction: "",
      });
      toast("Lead created", "success");
    } finally {
      setBusy(false);
    }
  }

  async function postNote() {
    if (!selected || !note.trim()) return;
    setBusy(true);
    try {
      const body = note.trim();
      if (useLiveData) {
        try {
          await Promise.race([
            addLeadActivity(selected.id, body, user?.username || "desk", "note"),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
          ]);
        } catch {
          /* local */
        }
      }
      setActivities((a) => [
        {
          id: `act-${Date.now()}`,
          leadId: selected.id,
          type: "note",
          body,
          createdBy: user?.username,
          createdAt: new Date().toISOString(),
        },
        ...a,
      ]);
      setNote("");
      toast("Activity logged", "success");
    } finally {
      setBusy(false);
    }
  }

  const pipelineValue = useMemo(
    () =>
      leads
        .filter((l) => l.status !== "lost" && l.status !== "won")
        .reduce((s, l) => s + (l.dealValue || 0), 0),
    [leads],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-[var(--color-atlas-sky)]" />
            <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">
              Sales pipeline
            </h1>
            <Badge tone="info">Phase 11</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Kanban leads · open pipeline {formatCurrency(pipelineValue, "INR")}
          </p>
        </div>
        <Button type="button" className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New lead
        </Button>
      </div>

      {creating ? (
        <Card className="border-sky-200 bg-sky-50/40">
          <h2 className="font-bold">New lead</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Company *</Label>
              <Input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div>
              <Label>Contact</Label>
              <Input
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Mode</Label>
              <Select
                value={form.mode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mode: e.target.value as SalesLead["mode"] }))
                }
              >
                <option value="air">Air</option>
                <option value="sea">Sea</option>
                <option value="transport">Transport</option>
                <option value="warehouse">Warehouse</option>
                <option value="courier">Courier</option>
              </Select>
            </div>
            <div>
              <Label>Lane</Label>
              <Input
                value={form.lane}
                onChange={(e) => setForm((f) => ({ ...f, lane: e.target.value }))}
              />
            </div>
            <div>
              <Label>Deal value (INR)</Label>
              <Input
                type="number"
                value={form.dealValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dealValue: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div>
              <Label>Next action</Label>
              <Input
                value={form.nextAction}
                onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void createLead()}>
              Create
            </Button>
          </div>
        </Card>
      ) : null}

      {isLoading ? (
        <Card>Loading pipeline…</Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map((status) => {
            const col = leads.filter((l) => l.status === status);
            return (
              <div
                key={status}
                className="w-56 shrink-0 rounded-xl border border-[var(--color-border)] bg-slate-50/80 p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/lead-id");
                  if (id) void moveLead(id, status);
                }}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                    {status}
                  </span>
                  <Badge tone="neutral">{col.length}</Badge>
                </div>
                <div className="space-y-2">
                  {col.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/lead-id", lead.id)}
                      onClick={() => void openLead(lead)}
                      className={cn(
                        "w-full rounded-lg border bg-white p-2.5 text-left text-sm shadow-sm transition",
                        selectedId === lead.id
                          ? "border-[var(--color-atlas-sky)] ring-2 ring-sky-100"
                          : "border-[var(--color-border)] hover:border-slate-300",
                      )}
                    >
                      <div className="font-bold text-[var(--color-atlas-navy)]">
                        {lead.company}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {lead.contactName || "—"} · {lead.mode || "—"}
                      </div>
                      {lead.dealValue ? (
                        <div className="mt-1 text-xs font-semibold">
                          {formatCurrency(lead.dealValue, "INR")}
                        </div>
                      ) : null}
                      {lead.lane ? (
                        <div className="mt-0.5 text-[10px] text-slate-500">{lead.lane}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">
                {selected.company}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {selected.contactName} · {selected.status} · {selected.lane || "no lane"}
              </p>
            </div>
            <Select
              className="w-40"
              value={selected.status}
              onChange={(e) => void moveLead(selected.id, e.target.value as LeadStatus)}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <h3 className="mt-4 text-sm font-bold">Activity log</h3>
          <div className="mt-2 flex gap-2">
            <Input
              className="mt-0"
              placeholder="Add a note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="button" disabled={busy || !note.trim()} onClick={() => void postNote()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log"}
            </Button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {activities.length === 0 ? (
              <li className="text-[var(--color-text-muted)]">No activities yet.</li>
            ) : (
              activities.map((a) => (
                <li key={a.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{a.type}</Badge>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {a.createdBy} · {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1">{a.body}</div>
                </li>
              ))
            )}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
