"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Badge, Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useLiveData } from "@/lib/api";
import {
  addNrsRegistryFollowUp,
  subscribeNrsRegistry,
  updateNrsRegistryParties,
} from "@/lib/firebase/nrs-registry";
import {
  NRS_FOLLOWUP_STATUSES,
  isNominationBooking,
  registryNeedsDetails,
  searchRegistry,
  sortRegistry,
  type NrsPartyFields,
  type NrsRegistryEntry,
} from "@/lib/quotes/nrs-registry";

const PARTY_FIELDS: Array<{ key: keyof NrsPartyFields; label: string }> = [
  { key: "shipperName", label: "Shipper name" },
  { key: "shipperPhone", label: "Shipper phone" },
  { key: "shipperEmail", label: "Shipper email" },
  { key: "shipperAddress", label: "Shipper address" },
  { key: "consigneeName", label: "Consignee name" },
  { key: "consigneePhone", label: "Consignee phone" },
  { key: "consigneeEmail", label: "Consignee email" },
  { key: "consigneeAddress", label: "Consignee address" },
  { key: "commodity", label: "Commodity" },
];

/** Every Air/Sea nomination booking on record, with its parties and follow-up log. */
export function NrsDirectory({ username }: { username: string }) {
  const [rows, setRows] = useState<NrsRegistryEntry[]>([]);
  const [loaded, setLoaded] = useState(!useLiveData);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, NrsPartyFields>>({});
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string>(NRS_FOLLOWUP_STATUSES[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!useLiveData) return;
    return subscribeNrsRegistry(
      (list) => {
        setRows(list);
        setLoaded(true);
      },
      (err) => {
        console.warn("NRS directory:", err.message);
        setLoaded(true);
      },
    );
  }, []);

  const shown = useMemo(
    () => searchRegistry(sortRegistry(rows.filter(isNominationBooking)), q).slice(0, 200),
    [rows, q],
  );
  const needing = useMemo(() => rows.filter(isNominationBooking).filter(registryNeedsDetails).length, [rows]);

  function draft(e: NrsRegistryEntry): NrsPartyFields {
    return edits[e.id] ?? Object.fromEntries(PARTY_FIELDS.map((f) => [f.key, e[f.key] ?? ""]));
  }

  async function saveParties(e: NrsRegistryEntry) {
    setBusy(true);
    try {
      await updateNrsRegistryParties(e.id, draft(e));
      setEdits((prev) => {
        const next = { ...prev };
        delete next[e.id];
        return next;
      });
      toast("Details saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }

  async function addFollowUp(e: NrsRegistryEntry) {
    if (!note.trim()) {
      toast("Enter a follow-up note", "error");
      return;
    }
    setBusy(true);
    try {
      const now = new Date();
      await addNrsRegistryFollowUp(e.id, {
        date: now.toISOString().split("T")[0],
        time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        status,
        note: note.trim(),
        by: username || "unknown",
      });
      setNote("");
      toast("Follow-up added", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not add follow-up", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold uppercase text-[var(--color-text-muted)]">NRS directory</h2>
        <Badge tone="info">{rows.filter(isNominationBooking).length} bookings</Badge>
        {needing > 0 ? <Badge tone="warn">{needing} need details</Badge> : null}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <Input
          className="pl-9"
          placeholder="Search booking, agent, shipper, consignee, route…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {!loaded ? (
        <Card className="text-sm text-[var(--color-text-muted)]">Loading the NRS directory…</Card>
      ) : shown.length === 0 ? (
        <Card className="text-sm text-[var(--color-text-muted)]">
          {q ? "No bookings match that search." : "No nomination bookings on record yet."}
        </Card>
      ) : (
        <ul className="space-y-2">
          {shown.map((e) => {
            const open = openId === e.id;
            const d = draft(e);
            return (
              <li key={e.id} className="rounded-lg border border-[var(--color-border)] bg-white">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : e.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                >
                  {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <span className="font-semibold">{e.refId || e.id}</span>
                  <span className="truncate text-[var(--color-text-muted)]">
                    {e.agent || "—"} · {e.pol || "—"} → {e.pod || "—"}
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    {registryNeedsDetails(e) ? <Badge tone="warn">Needs details</Badge> : null}
                    <span className="text-xs text-[var(--color-text-muted)]">{e.dateWon || ""}</span>
                  </span>
                </button>
                {open ? (
                  <div className="space-y-3 border-t border-[var(--color-border)] px-3 py-3">
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {e.mode || "Nomination"}
                      {e.confirmedCarrier ? ` · ${e.confirmedCarrier}` : ""}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {PARTY_FIELDS.map((f) => (
                        <div key={f.key}>
                          <Label>{f.label}</Label>
                          <Input
                            value={String(d[f.key] ?? "")}
                            disabled={!useLiveData}
                            onChange={(ev) =>
                              setEdits((prev) => ({ ...prev, [e.id]: { ...draft(e), [f.key]: ev.target.value } }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <Button type="button" size="sm" disabled={busy || !useLiveData || !edits[e.id]} onClick={() => void saveParties(e)}>
                      Save details
                    </Button>
                    <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
                      <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Follow-up log</div>
                      {(e.followUps ?? []).length === 0 ? (
                        <p className="text-xs text-[var(--color-text-muted)]">No follow-ups recorded yet.</p>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {[...(e.followUps ?? [])].reverse().map((f, i) => (
                            <li key={`${f.date}-${f.time}-${i}`} className="rounded bg-slate-50 px-2 py-1">
                              <span className="font-semibold">{f.status}</span> · {f.note}
                              <span className="block text-[var(--color-text-muted)]">
                                {f.date} {f.time} · {f.by}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="grid gap-2 sm:grid-cols-[14rem_1fr_auto]">
                        <Select value={status} onChange={(ev) => setStatus(ev.target.value)}>
                          {NRS_FOLLOWUP_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                        <Textarea rows={1} placeholder="What happened on this follow-up?" value={note} onChange={(ev) => setNote(ev.target.value)} />
                        <Button type="button" size="sm" disabled={busy || !useLiveData} onClick={() => void addFollowUp(e)}>
                          Add follow-up
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
