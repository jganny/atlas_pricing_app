"use client";

import { cn } from "@/lib/utils";

const LOGO_SRC = "/app/atlas-logo.png";

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
