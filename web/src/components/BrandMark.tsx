"use client";

import { cn } from "@/lib/utils";

// The Vertex Chat build sits at the root of its own site; the Pricing app sits under /app.
const LOGO_SRC = process.env.NEXT_PUBLIC_CHAT_APP === "true" ? "/atlas-logo.png" : "/app/atlas-logo.png";

export function BrandMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={LOGO_SRC}
      alt="Atlas Logistics"
      width={size}
      height={size}
      data-testid="atlas-logo"
      className={cn("shrink-0 rounded-full bg-white shadow-sm", className)}
    />
  );
}
