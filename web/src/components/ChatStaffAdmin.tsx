"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Link2, MessageCircle, Power, RefreshCw, Sparkles } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { toast } from "@/components/Toast";
import { createChatStaff, listChatStaff, newChatStaffLink, setChatStaffActive, type StaffListRow, type StaffState } from "@/lib/firebase/chat-staff";
import { parseStaffList, validUsername, type StaffRow } from "@/lib/chat/staff-list";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<StaffState, string> = { ready: "Ready to invite", invited: "Invite sent", joined: "Joined", off: "Turned off" };
const STATE_TONE: Record<StaffState, string> = {
  ready: "bg-slate-100 text-slate-700",
  invited: "bg-sky-100 text-sky-800",
  joined: "bg-emerald-100 text-emerald-800",
  off: "bg-red-100 text-red-700",
};

function whatsappUrl(name: string, link: string): string {
  const text = `Hi ${name.split(" ")[0]}, you have been added to Vertex Chat, the work chat for Atlas Logistics. Tap to choose your password and join: ${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Admin: bring staff who don't use the Pricing app onto Vertex Chat. Paste names, create logins, send each person a private link. */
export function ChatStaffAdmin() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [staff, setStaff] = useState<StaffListRow[]>([]);
  // Links shown only in this session (the server keeps just a fingerprint of each).
  const [links, setLinks] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      setStaff(await listChatStaff());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't load the list.", "error");
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const existing = useMemo(() => new Set(staff.map((s) => s.username)), [staff]);
  const joined = staff.filter((s) => s.state === "joined").length;

  function read() {
    const found = parseStaffList(text, existing);
    setRows(found);
    setProblems({});
    if (!found.length) toast("Paste at least one name first.", "info");
  }

  async function create() {
    const bad = rows.find((r) => !validUsername(r.username));
    if (bad) {
      toast(`“${bad.username}” isn't a valid login: use 3 to 30 letters or numbers, starting with a letter.`, "error");
      return;
    }
    setBusy(true);
    try {
      const results = await createChatStaff(rows.map((r) => ({ name: r.name, username: r.username })));
      const nextLinks: Record<string, string> = {};
      const nextProblems: Record<string, string> = {};
      for (const r of results) {
        if (r.ok && r.link) nextLinks[r.username] = r.link;
        else nextProblems[r.username] = r.reason || "Skipped.";
      }
      setLinks((l) => ({ ...l, ...nextLinks }));
      setProblems(nextProblems);
      const made = Object.keys(nextLinks).length;
      toast(made ? `${made} login${made === 1 ? "" : "s"} created. Now send each person their link.` : "No logins were created.", made ? "success" : "error");
      setRows([]);
      setText("");
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't create the logins. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function freshLink(username: string): Promise<string | null> {
    try {
      const link = await newChatStaffLink(username);
      setLinks((l) => ({ ...l, [username]: link }));
      return link;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't make a new link.", "error");
      return null;
    }
  }

  async function copy(s: StaffListRow) {
    const link = links[s.username] ?? (await freshLink(s.username));
    if (!link) return;
    await navigator.clipboard?.writeText(link).then(() => toast("Link copied. Send it to " + s.name.split(" ")[0] + ".", "success")).catch(() => toast(link, "info"));
  }

  async function whatsapp(s: StaffListRow) {
    const link = links[s.username] ?? (await freshLink(s.username));
    if (link) window.open(whatsappUrl(s.name, link), "_blank", "noopener");
  }

  async function toggle(s: StaffListRow) {
    const turnOn = s.state === "off";
    if (!turnOn && !window.confirm(`Turn off ${s.name}'s chat login? They will be signed out.`)) return;
    try {
      await setChatStaffActive(s.username, turnOn);
      toast(turnOn ? "Login turned on." : "Login turned off.", "success");
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't change that.", "error");
    }
  }

  return (
    <Card className="space-y-4" data-testid="chat-staff-admin">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-[var(--color-atlas-navy)]">Chat-only staff</h2>
          <p className="text-xs text-[var(--color-text-muted)]">People who use Vertex Chat but not the Pricing app. They can talk to colleagues, never open a quote.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">Joined {joined} of {staff.length}</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => void refresh()} aria-label="Refresh the list">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
        <div className="mb-1.5 flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-sky-600" aria-hidden />
          <span className="font-semibold">Paste names</span>
          <span className="text-xs text-slate-500">one person per line, a team after a dash is fine</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={"Asha Menon - Warehouse Chennai\nRavi Shetty, Customs Mumbai"}
          aria-label="Names to add"
          data-testid="staff-names"
          className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
        <div className="mt-2 flex justify-end">
          <Button type="button" size="sm" onClick={read} disabled={!text.trim()}>
            Read names
          </Button>
        </div>
      </div>

      {rows.length ? (
        <div data-testid="staff-preview">
          <p className="mb-1 text-sm font-semibold">Found {rows.length} {rows.length === 1 ? "person" : "people"}. Check the logins, then create.</p>
          <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {rows.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-[8rem] flex-1 font-semibold">{r.name}</span>
                <span className="text-xs text-slate-500">{r.team || "—"}</span>
                <input
                  value={r.username}
                  onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, username: e.target.value.toLowerCase().trim() } : x)))}
                  aria-label={`Login for ${r.name}`}
                  className={cn("w-40 rounded-md border px-2 py-1 font-mono text-xs", validUsername(r.username) ? "border-[var(--color-border)]" : "border-red-400 bg-red-50")}
                />
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">No passwords are shared. Each person gets a private link, valid 7 days, and chooses their own password. They join “Everyone”.</span>
            <Button type="button" size="sm" disabled={busy} onClick={() => void create()} data-testid="staff-create">
              {busy ? "Creating…" : `Create ${rows.length} login${rows.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      ) : null}

      {Object.keys(problems).length ? (
        <ul className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          {Object.entries(problems).map(([u, why]) => (
            <li key={u}>
              <b>{u}</b>: {why}
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="staff-list">
        {staff.map((s) => (
          <li key={s.username} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span className="min-w-[9rem] flex-1">
              <span className={cn("block font-semibold", s.state === "off" && "text-slate-400")}>{s.name}</span>
              <span className="block font-mono text-[11px] text-slate-500">{s.username}</span>
            </span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", STATE_TONE[s.state])}>
              {s.state === "joined" ? <Check className="mr-0.5 inline h-3 w-3" /> : null}
              {STATE_LABEL[s.state]}
            </span>
            {s.state !== "joined" && s.state !== "off" ? (
              <>
                <Button type="button" size="sm" variant="secondary" onClick={() => void whatsapp(s)}>
                  <MessageCircle className="mr-1 h-3.5 w-3.5" /> WhatsApp
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => void copy(s)}>
                  <Link2 className="mr-1 h-3.5 w-3.5" /> Copy link
                </Button>
              </>
            ) : null}
            {s.state === "joined" ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => void copy(s)} title="Make a new link, for example if they forgot their password">
                <Link2 className="mr-1 h-3.5 w-3.5" /> New link
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="secondary" onClick={() => void toggle(s)} aria-label={s.state === "off" ? "Turn on" : "Turn off"}>
              <Power className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
        {staff.length === 0 ? <li className="px-3 py-6 text-center text-sm text-slate-500">No chat-only staff yet.</li> : null}
      </ul>
    </Card>
  );
}
