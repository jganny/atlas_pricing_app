import type { SeaCargoRow } from "@/lib/pricing/sea-desk";

export type ContainerCode = "20'GP" | "40'GP" | "40'HC";

export interface ContainerSpec {
  code: ContainerCode;
  /** Internal dimensions, metres. */
  length: number;
  width: number;
  height: number;
  maxPayloadKg: number;
}

export const CONTAINER_SPECS: ContainerSpec[] = [
  { code: "20'GP", length: 5.898, width: 2.352, height: 2.393, maxPayloadKg: 28_200 },
  { code: "40'GP", length: 12.032, width: 2.352, height: 2.393, maxPayloadKg: 26_700 },
  { code: "40'HC", length: 12.032, width: 2.352, height: 2.698, maxPayloadKg: 26_500 },
];

export function containerSpec(code: string): ContainerSpec {
  return CONTAINER_SPECS.find((c) => c.code === code) ?? CONTAINER_SPECS[2];
}

export function containerCbm(spec: ContainerSpec): number {
  return spec.length * spec.width * spec.height;
}

/** Map a desk container-type string ("40'HC", "20'GP", "40'RF"…) onto the three we draw. */
export function nearestContainerCode(type: string | undefined): ContainerCode {
  const t = (type || "").toUpperCase();
  if (t.startsWith("20")) return "20'GP";
  if (t.includes("HC") || t.startsWith("45")) return "40'HC";
  if (t.startsWith("40")) return "40'GP";
  return "40'HC";
}

export interface PlacedBox {
  /** Centre position in metres: x along the length from the back wall, y up from the floor, z across the width (0 = middle). */
  x: number;
  y: number;
  z: number;
  l: number;
  h: number;
  w: number;
}

export interface Packing {
  boxes: PlacedBox[];
  totalPieces: number;
  /** Floor length the cargo needs when stacked slab by slab from the back wall, metres. */
  lengthUsedM: number;
  /** A piece is larger than the container's width, height or length — it can't be loaded as-is. */
  tooBig: boolean;
  /** More pieces than we draw — the drawing shows a sample, the numbers are still for all of them. */
  drawingCapped: boolean;
}

const MAX_DRAWN = 1500;

function metresPerUnit(dimUnit: "cms" | "inches"): number {
  return dimUnit === "inches" ? 0.0254 : 0.01;
}

/**
 * Deliberately simple packing estimate: each cargo line is loaded in slabs
 * from the back wall — as many pieces across the width and stacked up as fit,
 * one piece deep per slab — and lines are loaded one after another. Real
 * load planners also rotate and interleave pieces, so this is a guide only.
 */
export function packCargo(
  rows: SeaCargoRow[],
  dimUnit: "cms" | "inches",
  spec: ContainerSpec,
): Packing {
  const unit = metresPerUnit(dimUnit);
  const boxes: PlacedBox[] = [];
  let cursor = 0;
  let totalPieces = 0;
  let tooBig = false;
  let drawingCapped = false;

  for (const r of rows) {
    const qty = Math.max(0, Math.floor(r.qty || 0));
    const l = (r.l || 0) * unit;
    const w = (r.w || 0) * unit;
    const h = (r.h || 0) * unit;
    if (!qty || !(l > 0) || !(w > 0) || !(h > 0)) continue;
    totalPieces += qty;

    const across = Math.floor(spec.width / w);
    const layers = Math.floor(spec.height / h);
    if (across < 1 || layers < 1 || l > spec.length) {
      tooBig = true;
      continue;
    }
    const perSlab = across * layers;
    let remaining = qty;
    while (remaining > 0) {
      const inSlab = Math.min(perSlab, remaining);
      for (let i = 0; i < inSlab; i++) {
        if (boxes.length >= MAX_DRAWN) {
          drawingCapped = true;
          break;
        }
        const col = i % across;
        const layer = Math.floor(i / across);
        boxes.push({
          x: cursor + l / 2,
          y: layer * h + h / 2,
          z: col * w + w / 2 - (across * w) / 2,
          l,
          h,
          w,
        });
      }
      remaining -= inSlab;
      cursor += l;
    }
  }
  return { boxes, totalPieces, lengthUsedM: cursor, tooBig, drawingCapped };
}

export interface LoadTotals {
  volumeCbm: number;
  weightKg: number;
}

export function loadTotals(rows: SeaCargoRow[], dimUnit: "cms" | "inches"): LoadTotals {
  const unit = metresPerUnit(dimUnit);
  let volumeCbm = 0;
  let weightKg = 0;
  for (const r of rows) {
    const qty = Math.max(0, r.qty || 0);
    volumeCbm += (r.l || 0) * unit * (r.w || 0) * unit * (r.h || 0) * unit * qty;
    weightKg += Math.max(0, r.gw || 0) * qty;
  }
  return { volumeCbm, weightKg };
}

export interface ContainerOption {
  code: ContainerCode;
  /** Containers of this type the cargo needs, or null when a piece can't be loaded in it at all. */
  count: number | null;
  /** Share of the combined volume that is cargo, percent. */
  fillPct: number;
}

export function containerOptions(rows: SeaCargoRow[], dimUnit: "cms" | "inches"): ContainerOption[] {
  const { volumeCbm, weightKg } = loadTotals(rows, dimUnit);
  return CONTAINER_SPECS.map((spec) => {
    const packing = packCargo(rows, dimUnit, spec);
    if (packing.tooBig || packing.totalPieces === 0) {
      return { code: spec.code, count: null, fillPct: 0 };
    }
    const byLength = Math.max(1, Math.ceil(packing.lengthUsedM / spec.length - 1e-9));
    const byWeight = Math.max(1, Math.ceil(weightKg / spec.maxPayloadKg - 1e-9));
    const count = Math.max(byLength, byWeight);
    const fillPct = Math.min(100, (volumeCbm / (count * containerCbm(spec))) * 100);
    return { code: spec.code, count, fillPct };
  });
}

/** Fewest containers wins; on a tie, the smaller total capacity. */
export function bestOption(options: ContainerOption[]): ContainerOption | null {
  const usable = options.filter((o) => o.count !== null);
  if (!usable.length) return null;
  return [...usable].sort((a, b) => {
    if (a.count !== b.count) return (a.count as number) - (b.count as number);
    return (
      (a.count as number) * containerCbm(containerSpec(a.code)) -
      (b.count as number) * containerCbm(containerSpec(b.code))
    );
  })[0];
}
