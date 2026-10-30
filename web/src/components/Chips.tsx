import { chipStyle, modeColor, statusColor } from "@/lib/ui/colors";
import { cn } from "@/lib/utils";

const base = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize text-slate-800";

/** Air, Sea, Courier… in that kind of shipment's own colour. */
export function ModeChip({ mode, className }: { mode: string | undefined | null; className?: string }) {
  const color = modeColor(mode);
  return (
    <span className={cn(base, className)} style={chipStyle(color)}>
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {mode || "—"}
    </span>
  );
}

/** Open, Quoted, Won, Lost… */
export function StatusChip({ status, className }: { status: string | undefined | null; className?: string }) {
  return (
    <span className={cn(base, className)} style={chipStyle(statusColor(status))}>
      {status || "—"}
    </span>
  );
}
