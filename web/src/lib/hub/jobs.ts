/** Who sees which Quote Hub jobs, and the counts shown on the desk menu. */
import { belongsToViewersDesk } from "@/lib/auth/desk-seats";
import type { HubJob, HubMode } from "./types";

export function visibleJobs(jobs: HubJob[], username: string | undefined | null, isAdmin: boolean): HubJob[] {
  const u = (username || "").toLowerCase();
  return jobs
    .filter((j) => j.status !== "dismissed")
    .filter((j) => isAdmin || belongsToViewersDesk({ deskSeat: j.deskSeat, creator: j.createdBy }, u))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function waitingCounts(jobs: HubJob[]): Record<HubMode, number> {
  const out: Record<HubMode, number> = { air: 0, sea: 0, courier: 0, transport: 0, warehouse: 0 };
  for (const j of jobs) if (j.status === "waiting") out[j.mode] += 1;
  return out;
}
