"use client";

import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui";

export const OPEN_GUIDE_EVENT = "atlas:open-guide";

/** Small "Tips" button — opens the Vertex assistant panel on the Guide, optionally pre-asked. */
export function GuideTipButton({ query, label = "Tips" }: { query?: string; label?: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="gap-1.5"
      data-testid="guide-tip-button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_GUIDE_EVENT, { detail: { query: query ?? "" } }))}
    >
      <Lightbulb className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
