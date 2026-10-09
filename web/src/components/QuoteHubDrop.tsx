"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useLiveData } from "@/lib/api";
import { fetchDirectoryContacts } from "@/lib/firebase/directory";
import { readDocuments } from "@/lib/firebase/hub-jobs";
import { normalizeExtraction, type AgentRef } from "@/lib/hub/normalize";
import { prepareJobs, type PreparedJob } from "@/lib/hub/prepare-documents";
import type { HubJob } from "@/lib/hub/types";
import { OWN_EMAIL_DOMAINS } from "@/lib/quotes/team-roles";
import { currentDeskSeatId } from "@/lib/auth/desk-seats";
import { useHubJobs } from "@/hooks/use-hub-jobs";
import { useAuthStore } from "@/store/auth";

type Item = { id: string; label: string; state: "reading" | "done" | "error"; message: string };

const ACCEPT = ".msg,.eml,.pdf,.xlsx,.xls,.csv,.docx,.txt,image/*";

/** Drop Outlook emails, invoices, packing lists or photos: each job is read and filed as a ready-filled draft. */
export function QuoteHubDrop() {
  const user = useAuthStore((s) => s.user);
  const { add } = useHubJobs();
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const agents = useRef<AgentRef[] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const patch = (id: string, next: Partial<Item>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...next } : i)));

  async function agentList(): Promise<AgentRef[]> {
    if (agents.current) return agents.current;
    try {
      const rows = await fetchDirectoryContacts();
      agents.current = rows
        .filter((c) => (c.category || "").toLowerCase() === "agency")
        .map((c) => ({ name: c.name, email: c.email, location: c.location }));
    } catch {
      agents.current = [];
    }
    return agents.current;
  }

  async function readJob(job: PreparedJob) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((prev) => [{ id, label: job.label, state: "reading" as const, message: "Reading…" }, ...prev].slice(0, 8));
    try {
      const raw = await readDocuments(job.documents, { ownDomains: OWN_EMAIL_DOMAINS, headerSender: job.headerSender });
      const n = normalizeExtraction(raw, { ownDomains: OWN_EMAIL_DOMAINS, headerSender: job.headerSender, agents: await agentList() });
      const username = (user?.username || "").toLowerCase();
      const hubJob: HubJob = {
        id,
        createdBy: username,
        deskSeat: currentDeskSeatId(username),
        createdAt: new Date().toISOString(),
        status: "waiting",
        mode: n.extraction.mode,
        direction: n.extraction.direction,
        customer: n.customer,
        senderEmail: n.senderEmail,
        senderName: n.senderName,
        files: job.fileNames,
        summary: n.extraction.summary || job.label,
        checkCount: n.extraction.needsCheck.length,
        extraction: n.extraction,
      };
      await add(hubJob);
      patch(id, { state: "done", message: `${hubJob.summary} — waiting below` });
    } catch (e) {
      patch(id, { state: "error", message: e instanceof Error ? e.message : "Could not read this one." });
    }
  }

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    if (!useLiveData) {
      toast("Reading real documents works in the live app — the list below shows sample jobs.", "info");
      return;
    }
    try {
      const jobs = await prepareJobs(files);
      await Promise.all(jobs.map((j) => readJob(j)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read those files.", "error");
    }
  }

  async function handlePaste() {
    const text = paste.trim();
    if (!text) return;
    if (!useLiveData) {
      toast("Reading real text works in the live app — the list below shows sample jobs.", "info");
      return;
    }
    setPaste("");
    setShowPaste(false);
    await readJob({ label: text.slice(0, 50), documents: [{ name: "Pasted enquiry", kind: "text", text }], fileNames: ["Pasted enquiry"] });
  }

  return (
    <Card className="atlas-frost space-y-3 rounded-2xl bg-white/70">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handleFiles(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          over ? "border-[var(--color-atlas-sky)] bg-sky-50" : "border-[var(--color-border)] bg-white/60"
        }`}
        data-testid="hub-dropzone"
      >
        <Upload className="h-6 w-6 text-[var(--color-atlas-navy)]" />
        <div className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
          Drop Outlook emails (.msg / .eml), invoices, packing lists or photos
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">
          Keep dropping — each one is read and waits below. Nothing opens by itself.
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button type="button" size="sm" onClick={() => input.current?.click()}>
            Choose files
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setShowPaste((v) => !v)}>
            Paste text instead
          </Button>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            void handleFiles(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
      </div>

      {showPaste ? (
        <div className="space-y-2">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={5}
            placeholder="Paste the enquiry text or email here"
            className="w-full rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm"
          />
          <Button type="button" size="sm" onClick={() => void handlePaste()}>
            Read it
          </Button>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {items.map((i) => (
            <li key={i.id} className="flex items-start gap-2">
              {i.state === "reading" ? <Loader2 className="mt-0.5 h-4 w-4 animate-spin" /> : <span className="mt-0.5">{i.state === "done" ? "✓" : "⚠"}</span>}
              <span className={i.state === "error" ? "text-red-700" : ""}>
                <span className="font-semibold">{i.label}</span> — {i.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
