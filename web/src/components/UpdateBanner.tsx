"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { appVersion } from "@/lib/env";
import { Button } from "@/components/ui";
import { bannerVisibleAfterLoad, beginRefreshReload } from "@/lib/app-update";

async function applyRefreshNow() {
  if (!beginRefreshReload(appVersion, window.localStorage, window.sessionStorage)) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const waiting = reg?.waiting;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
  } catch {
    /* reload anyway — network-first assets still apply after a single reload */
  }
  window.location.reload();
}

/**
 * Sticky update banner — stays until the user clicks Refresh now.
 * One click reloads the tab once; a session guard stops SW claim from looping.
 */
export function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(bannerVisibleAfterLoad(appVersion, window.localStorage, window.sessionStorage));
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      data-testid="update-banner"
      className="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950"
    >
      <span>
        <strong>App updated</strong> (v{appVersion}). Click refresh to load the latest desks and
        fixes — this banner stays until you do.
      </span>
      <Button
        type="button"
        size="sm"
        data-testid="update-banner-refresh"
        className="gap-1.5 bg-amber-600 hover:bg-amber-700"
        onClick={() => {
          void applyRefreshNow();
        }}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh now
      </Button>
    </div>
  );
}
