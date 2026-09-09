"use client";

import { useMemo } from "react";
import { MOCK_LOGISTICS_NEWS, type NewsItem } from "@/lib/mock/logistics-news";

function itemLine(n: NewsItem): string {
  return `${n.title} · ${n.source}`;
}

/** Single-line industry wire — right-to-left marquee, pauses on hover. */
export function NewsTicker() {
  const items = useMemo(() => MOCK_LOGISTICS_NEWS, []);
  const loop = [...items, ...items];

  return (
    <div
      className="atlas-ticker"
      role="marquee"
      aria-label="Industry news"
    >
      <span className="atlas-ticker-label">News</span>
      <div className="atlas-ticker-mask">
        <div className="atlas-ticker-track">
          {loop.map((n, i) => (
            <a
              key={`${n.id}-${i}`}
              href={n.url === "#" ? undefined : n.url}
              target={n.url === "#" ? undefined : "_blank"}
              rel="noreferrer"
              className="atlas-ticker-item"
              title={n.summary}
            >
              {itemLine(n)}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
