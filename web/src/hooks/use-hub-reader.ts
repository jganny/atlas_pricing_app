"use client";

import { useRef, useState } from "react";
import { toast } from "@/components/Toast";
import { useHubJobs } from "@/hooks/use-hub-jobs";
import { useLiveData } from "@/lib/api";
import { currentDeskSeatId } from "@/lib/auth/desk-seats";
import { fetchDirectoryContacts } from "@/lib/firebase/directory";
import { readDocuments } from "@/lib/firebase/hub-jobs";
import { normalizeExtraction, type AgentRef } from "@/lib/hub/normalize";
import { prepareJobs, type PreparedJob } from "@/lib/hub/prepare-documents";
import type { HubJob } from "@/lib/hub/types";
import { OWN_EMAIL_DOMAINS } from "@/lib/quotes/team-roles";
import { useAuthStore } from "@/store/auth";

export type HubReadItem = { id: string; label: string; state: "reading" | "done" | "error"; message: string };

/**
 * Reads dropped files or pasted text into Quote Hub jobs. Shared by the Quote Hub page and the Home start box,
 * so a drop does the same thing wherever it lands: each enquiry is read once and waits as a filled draft.
 */
export function useHubReader() {
  const user = useAuthStore((s) => s.user);
  const { add } = useHubJobs();
  const [items, setItems] = useState<HubReadItem[]>([]);
  const agents = useRef<AgentRef[] | null>(null);

  const patch = (id: string, next: Partial<HubReadItem>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...next } : i)));

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

  async function readJob(job: PreparedJob, instructionText = "") {
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
        ...(instructionText ? { instruction: instructionText } : {}),
      };
      await add(hubJob);
      patch(id, { state: "done", message: `${hubJob.summary} — waiting in Quote hub` });
    } catch (e) {
      patch(id, { state: "error", message: e instanceof Error ? e.message : "Could not read this one." });
    }
  }

  async function readFiles(files: File[], typed = "") {
    if (!files.length) return;
    if (!useLiveData) {
      toast("Reading real documents works in the live app — the list shows sample jobs.", "info");
      return;
    }
    try {
      const jobs = await prepareJobs(files);
      await Promise.all(jobs.map((j) => readJob(j, typed)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read those files.", "error");
    }
  }

  async function readText(text: string, typed = "") {
    const t = text.trim();
    if (!t) return;
    if (!useLiveData) {
      toast("Reading real text works in the live app — the list shows sample jobs.", "info");
      return;
    }
    await readJob({ label: t.slice(0, 50), documents: [{ name: "Pasted enquiry", kind: "text", text: t }], fileNames: ["Pasted enquiry"] }, typed);
  }

  return { items, readFiles, readText };
}
