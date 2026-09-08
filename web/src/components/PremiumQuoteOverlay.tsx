"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Plane, Ship, Sparkles, Truck, X } from "lucide-react";
import { Button } from "@/components/ui";
import { LocationCombobox } from "@/components/LocationCombobox";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import type { TransportMode } from "@/lib/rates/aggregator";

export function PremiumQuoteOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<TransportMode>("air");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const locKind = mode === "sea" ? "seaport" : mode === "air" ? "airport" : "all";

  function openDesk() {
    const o = origin.split("—")[0]?.trim() || origin.trim();
    const d = destination.split("—")[0]?.trim() || destination.trim();
    if (!o || !d) {
      toast("Origin and destination required", "error");
      return;
    }
    const href =
      mode === "sea"
        ? `/sea?origin=${encodeURIComponent(o)}&dest=${encodeURIComponent(d)}`
        : mode === "road"
          ? `/transport?origin=${encodeURIComponent(o)}&dest=${encodeURIComponent(d)}`
          : `/air?origin=${encodeURIComponent(o)}&dest=${encodeURIComponent(d)}`;
    onOpenChange(false);
    router.push(href);
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="atlas-overlay absolute inset-0"
        aria-label="Close quote overlay"
        data-modal-close
        onClick={() => onOpenChange(false)}
      />
      <div
        className="atlas-glass relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="New quote"
      >
        <div className="rounded-t-2xl bg-[var(--color-atlas-navy)] px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-200">
                New quote
              </div>
              <div className="text-lg font-extrabold tracking-tight">Pick a lane, then quote on the desk</div>
              <p className="mt-1 text-xs text-white/70">
                Opens Air / Sea / Transport with this origin and destination. Official rates live on
                the desk — not dummy carrier cards.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-white/10"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              data-modal-close
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["air", "Air", Plane],
                ["sea", "Sea", Ship],
                ["road", "Road", Truck],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-bold transition",
                  mode === id
                    ? "border-teal-500 bg-teal-50 text-[var(--color-atlas-navy)]"
                    : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-sky-300",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>

          <LocationCombobox
            label="Origin"
            value={origin}
            kind={locKind}
            onChange={setOrigin}
          />
          <LocationCombobox
            label="Destination"
            value={destination}
            kind={locKind}
            onChange={setDestination}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={openDesk}>
            Open desk
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function QuoteOverlayToggle({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="quote-open"
      className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700"
      title="New quote"
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">New quote</span>
    </button>
  );
}
