"use client";

import { RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { draftAgeLabel, type DraftEnvelope } from "@/lib/ui/desk-draft";

/** Shown on a desk when an unfinished quote from an earlier session (e.g. before a power cut) was kept. */
export function DraftResumeBanner({
  deskLabel,
  pending,
  onResume,
  onDiscard,
}: {
  deskLabel: string;
  pending: DraftEnvelope<object> | null;
  onResume: () => void;
  onDiscard: () => void;
}) {
  if (!pending) return null;
  return (
    <Card className="border-amber-300 bg-amber-50 py-3" data-testid="draft-resume-banner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-950">
            You have an unfinished {deskLabel} quote from {draftAgeLabel(pending.savedAt)}
          </p>
          {pending.summary ? <p className="truncate text-xs text-amber-900">{pending.summary}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={onResume}>
            <RotateCcw className="h-3.5 w-3.5" />
            Resume
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onDiscard}>
            Start fresh
          </Button>
        </div>
      </div>
    </Card>
  );
}
