"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { useHubJobs } from "@/hooks/use-hub-jobs";
import { openJobHref } from "@/lib/hub/prefill";
import { visibleJobs } from "@/lib/hub/jobs";
import { HUB_MODE_LABEL, type HubJob } from "@/lib/hub/types";
import { isAdminUser } from "@/lib/quotes/team-roles";
import { useAuthStore } from "@/store/auth";

function directionLabel(j: HubJob): string {
  return j.direction === "export" ? "Export" : j.direction === "import" ? "Import" : "";
}

/** Jobs that have been read and are waiting for someone to open them in their desk. */
export function WaitingJobs() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { jobs, ready, setStatus, remove } = useHubJobs();
  const list = visibleJobs(jobs, user?.username, isAdminUser(user?.username, user?.role));

  async function open(job: HubJob) {
    const href = openJobHref(job);
    void setStatus(job.id, "opened");
    router.push(href);
  }

  return (
    <Card className="atlas-frost space-y-2 rounded-2xl bg-white/70" data-testid="hub-waiting">
      <h2 className="text-sm font-extrabold text-[var(--color-atlas-navy)]">Waiting for you</h2>
      {!ready ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Nothing waiting. Drop an email or documents above and it will appear here.</p>
      ) : (
        <ul>
          {list.map((j, i) => (
            <li key={j.id} className={`flex flex-wrap items-center gap-3 py-2.5 ${i ? "border-t border-[var(--color-border)]" : ""}`}>
              <Badge tone={j.status === "opened" ? "neutral" : "info"}>
                {HUB_MODE_LABEL[j.mode]}
                {directionLabel(j) ? ` · ${directionLabel(j)}` : ""}
              </Badge>
              <div className="min-w-[200px] flex-1">
                <div className="text-sm font-semibold text-[var(--color-atlas-navy)]">{j.summary}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {j.customer ? `Customer: ${j.customer}` : "Customer: type or pick on the desk"}
                  {" · "}
                  {j.files.slice(0, 2).join(", ")}
                  {j.files.length > 2 ? ` +${j.files.length - 2}` : ""}
                </div>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">
                {j.status === "opened" ? "Opened" : j.checkCount === 0 ? "All filled" : `${j.checkCount} to check`}
              </span>
              <Button type="button" size="sm" onClick={() => void open(j)}>
                Open ↗
              </Button>
              <button
                type="button"
                aria-label="Remove from the list"
                title="Remove from the list"
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-slate-100"
                onClick={() => void remove(j.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
