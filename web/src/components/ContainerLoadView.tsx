"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Boxes, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui";
import {
  bestOption,
  containerCbm,
  containerOptions,
  CONTAINER_SPECS,
  containerSpec,
  loadTotals,
  nearestContainerCode,
  packCargo,
  type ContainerCode,
} from "@/lib/pricing/container-load";
import { seaCargoHasData, type SeaCargoRow } from "@/lib/pricing/sea-desk";
import { cn } from "@/lib/utils";

const ContainerLoad3D = dynamic(
  () => import("@/components/three/ContainerLoad3D").then((m) => m.ContainerLoad3D),
  { ssr: false, loading: () => <div className="h-56 rounded-xl bg-slate-50" /> },
);

/**
 * Shows the cargo already entered on the Sea desk loaded into a container,
 * so it is obvious how full it is and what fits. An estimate only — it never
 * changes the quote or blocks saving.
 */
export function ContainerLoadView({
  cargo,
  dimUnit,
  preferredType,
}: {
  cargo: SeaCargoRow[];
  dimUnit: "cms" | "inches";
  /** The container type already chosen on a liner card, used as the starting view. */
  preferredType?: string;
}) {
  const [picked, setPicked] = useState<ContainerCode | null>(null);
  const code = picked ?? nearestContainerCode(preferredType);
  const spec = containerSpec(code);

  const hasCargo = seaCargoHasData(cargo) && cargo.some((r) => r.l > 0 && r.w > 0 && r.h > 0 && r.qty > 0);
  const packing = useMemo(() => packCargo(cargo, dimUnit, spec), [cargo, dimUnit, spec]);
  const totals = useMemo(() => loadTotals(cargo, dimUnit), [cargo, dimUnit]);
  const options = useMemo(() => containerOptions(cargo, dimUnit), [cargo, dimUnit]);
  const best = bestOption(options);

  if (!hasCargo) return null;

  const cbm = containerCbm(spec);
  const volumePct = Math.min(100, (totals.volumeCbm / cbm) * 100);
  const weightPct = Math.min(100, (totals.weightKg / spec.maxPayloadKg) * 100);
  const overflow = packing.lengthUsedM > spec.length + 1e-6 || totals.weightKg > spec.maxPayloadKg;
  const others = options.filter((o) => o.code !== best?.code && o.count !== null);

  return (
    <Card className="space-y-3 border-sky-200">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold text-[var(--color-atlas-navy)]">
          <Boxes className="h-4 w-4 text-sky-700" />
          Container load
        </h2>
        <span className="text-[11px] text-[var(--color-text-muted)]">Drag to rotate · scroll to zoom</span>
      </div>

      <div className="flex gap-1.5">
        {CONTAINER_SPECS.map((s) => (
          <button
            key={s.code}
            type="button"
            onClick={() => setPicked(s.code)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-bold",
              s.code === code
                ? "border-sky-600 bg-sky-50 text-sky-800"
                : "border-[var(--color-border)] bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {s.code}
          </button>
        ))}
      </div>

      {packing.tooBig ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          At least one piece is too large to load in a {code} as entered — check its size or pick a different container.
        </p>
      ) : (
        <ContainerLoad3D spec={spec} packing={packing} />
      )}

      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-semibold">Space used</span>
          <span className="font-bold">
            {volumePct.toFixed(0)}% · {totals.volumeCbm.toFixed(1)} of {cbm.toFixed(1)} cbm
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-sky-700" style={{ width: `${volumePct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-[var(--color-text-muted)]">
          <span>{packing.totalPieces} pieces</span>
          <span>
            {(totals.weightKg / 1000).toFixed(1)} t of {(spec.maxPayloadKg / 1000).toFixed(1)} t ({weightPct.toFixed(0)}%)
          </span>
        </div>
      </div>

      {overflow ? (
        <p className="text-xs font-semibold text-amber-800">
          This cargo needs more than one {code}. The picture shows the first container.
        </p>
      ) : null}

      {best ? (
        <div className="rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-slate-800">
          <div className="mb-0.5 flex items-center gap-1.5 font-bold text-sky-900">
            <Lightbulb className="h-3.5 w-3.5" /> What fits
          </div>
          Fits in{" "}
          <strong>
            {best.count} × {best.code}
          </strong>{" "}
          ({best.fillPct.toFixed(0)}% full).
          {others.length ? (
            <span className="text-[var(--color-text-muted)]">
              {" "}
              Also: {others.map((o) => `${o.count} × ${o.code} (${o.fillPct.toFixed(0)}%)`).join(", ")}.
            </span>
          ) : null}
        </div>
      ) : null}

      {packing.drawingCapped ? (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Very large load — the picture shows a sample of the pieces; the numbers cover all of them.
        </p>
      ) : null}
      <p className="text-[11px] leading-snug text-[var(--color-text-muted)]">
        An estimate from the cargo sizes you entered — stacking and door gaps are approximate. It never changes your
        quote or blocks saving.
      </p>
    </Card>
  );
}
