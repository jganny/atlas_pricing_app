"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { appVersion } from "@/lib/env";
import { Button } from "@/components/ui";

const STORAGE_KEY = "atlas_seen_app_version";

/**
 * Sticky update banner — stays until the user clicks Refresh.
 * Compares build version in the shell to the last acknowledged version.
 */
export function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (seen !== appVersion) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950"
    >
      <span>
        <strong>App updated</strong> (v{appVersion}). Click refresh to load the latest desks and
        fixes — this banner stays until you do.
      </span>
      <Button
        type="button"
        size="sm"
        className="gap-1.5 bg-amber-600 hover:bg-amber-700"
        onClick={() => {
          try {
            window.localStorage.setItem(STORAGE_KEY, appVersion);
          } catch {
            /* ignore */
          }
          window.location.reload();
        }}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh now
      </Button>
    </div>
  );
}
