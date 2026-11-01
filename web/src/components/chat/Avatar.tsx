"use client";

import { cn } from "@/lib/utils";
import { useTeamChatOptional } from "./ChatProvider";

const COLORS = ["bg-sky-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-teal-600", "bg-indigo-600"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, seed, size = 32, online, ai, group }: { name: string; seed?: string; size?: number; online?: boolean; ai?: boolean; group?: boolean }) {
  // A person's own photo, when they have set one (the seed is their login).
  const photo = useTeamChatOptional()?.profiles[(seed || "").toLowerCase()]?.photo;
  const key = seed || name;
  const color = ai ? "bg-[var(--color-atlas-gold)]" : COLORS[[...key].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {photo && !ai && !group ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" width={size} height={size} className="h-full w-full rounded-full object-cover" />
      ) : (
        <span
          className={cn("flex h-full w-full items-center justify-center rounded-full font-bold text-white", color, group && "rounded-lg")}
          style={{ fontSize: Math.max(10, size * 0.38) }}
          aria-hidden
        >
          {ai ? "✦" : group ? "#" : initials(name)}
        </span>
      )}
      {online !== undefined ? (
        <span
          className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white", online ? "bg-emerald-500" : "bg-slate-300")}
          title={online ? "Online" : "Offline"}
        />
      ) : null}
    </span>
  );
}
