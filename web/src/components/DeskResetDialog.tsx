"use client";

import { RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";

/** In-page reset confirm — fixed overlay so it cannot be confused with the paste strip. */
export function DeskResetDialog({
  open,
  deskLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  deskLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Reset ${deskLabel}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <Card
        className="w-full max-w-md border-amber-300 bg-amber-50 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-amber-950">Clear this {deskLabel} form?</p>
            <p className="mt-1 text-xs text-amber-900/80">
              Customer, route, cargo, and carrier rows will be wiped. This cannot be undone.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" className="h-9" onClick={onConfirm}>
                Yes, reset
              </Button>
              <Button type="button" variant="secondary" className="h-9" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
