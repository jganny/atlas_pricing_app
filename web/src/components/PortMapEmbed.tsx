"use client";

import { MapPin } from "lucide-react";
import { loadGmapsKey } from "@/lib/firebase/runtime-config";

export function PortMapEmbed({
  query,
  kind = "airport",
}: {
  query: string;
  kind?: "airport" | "port";
}) {
  const q = query.trim();
  if (!q) return null;
  const search = `${q} ${kind}`;
  const key = typeof window !== "undefined" ? loadGmapsKey() : "";
  const external = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}`;

  if (key) {
    const embed = `https://www.google.com/maps/embed/v1/search?key=${encodeURIComponent(key)}&q=${encodeURIComponent(search)}`;
    return (
      <div className="mt-2 overflow-hidden rounded-lg border border-[var(--color-border)]">
        <iframe
          title={`Map ${search}`}
          src={embed}
          className="h-36 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <a
      className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 hover:underline"
      href={external}
      target="_blank"
      rel="noreferrer"
    >
      <MapPin className="h-3 w-3" />
      Open {kind} map
    </a>
  );
}
