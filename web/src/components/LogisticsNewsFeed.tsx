"use client";

import { useMemo, useState } from "react";
import { Newspaper } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { MOCK_LOGISTICS_NEWS, type NewsItem } from "@/lib/mock/logistics-news";

export function LogisticsNewsFeed() {
  const [region, setRegion] = useState<"all" | "global" | "india">("all");
  const items = useMemo(() => {
    const all: NewsItem[] = MOCK_LOGISTICS_NEWS;
    if (region === "all") return all;
    return all.filter((n) => n.region === region);
  }, [region]);

  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold">
          <Newspaper className="h-4 w-4" />
          Control tower · logistics news
        </div>
        <div className="flex gap-1 text-xs font-semibold">
          {(["all", "global", "india"] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={`rounded-md px-2 py-1 ${region === r ? "bg-sky-100 text-sky-900" : "text-[var(--color-text-muted)]"}`}
              onClick={() => setRegion(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={n.url === "#" ? undefined : n.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--color-atlas-navy)] hover:underline"
              >
                {n.title}
              </a>
              <Badge tone="neutral">{n.source}</Badge>
              <Badge tone="info">{n.region}</Badge>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{n.summary}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
        Curated desk feed (RSS live wire optional). Refresh page for latest mock rotation.
      </p>
    </Card>
  );
}
