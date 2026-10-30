/**
 * The colour plan. Navy stays the brand colour; colour is added in three places only: the kind of shipment,
 * the status of a quote, and the Home tiles. One definition here, so every screen agrees.
 */
export type ModeKey = "air" | "sea" | "courier" | "transport" | "warehouse";

export const MODE_COLORS: Record<ModeKey, string> = {
  air: "#378ADD",
  sea: "#1D9E75",
  courier: "#D85A30",
  transport: "#639922",
  warehouse: "#7F77DD",
};

export const STATUS_COLORS: Record<string, string> = {
  open: "#888780",
  quoted: "#EF9F27",
  won: "#34A853",
  lost: "#E24B4A",
  cancelled: "#888780",
};

/** "#378ADD" -> "rgba(55,138,221,0.16)" */
export function tint(hex: string, alpha = 0.16): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function modeColor(mode: string | undefined | null): string {
  return MODE_COLORS[String(mode ?? "").toLowerCase() as ModeKey] ?? "#888780";
}

export function statusColor(status: string | undefined | null): string {
  return STATUS_COLORS[String(status ?? "").toLowerCase()] ?? "#888780";
}

/** The inline style for a coloured chip: tinted fill, coloured edge. Text stays the normal dark text so it reads everywhere. */
export function chipStyle(hex: string): { backgroundColor: string; borderColor: string } {
  return { backgroundColor: tint(hex, 0.16), borderColor: hex };
}
