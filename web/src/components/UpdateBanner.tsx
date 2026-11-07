"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { appVersion } from "@/lib/env";
import { Button } from "@/components/ui";
import { WhatsNewInline } from "@/components/WhatsNew";
import { acknowledgeVersion, bannerVisibleAfterLoad, beginRefreshReload } from "@/lib/app-update";

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
 * "Updated to vX" banner. It appears once on the first load of each new release (the version is part of the running code, so
 * the new version is already here) and stays until "Got it" is pressed. It never asks anyone to update.
 * "Reload" is kept as a small extra: it reloads the tab once; a session guard stops SW claim from looping.
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
        <strong>Updated to v{appVersion.replace(/-(test-app|demo|chat)$/, "")}.</strong> See what changed below, then press Got it.
      </span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          data-testid="update-banner-refresh"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
          onClick={() => {
            void applyRefreshNow();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Reload
        </button>
        <Button
          type="button"
          size="sm"
          data-testid="update-banner-dismiss"
          className="bg-amber-700 hover:bg-amber-800"
          onClick={() => {
            acknowledgeVersion(appVersion, window.localStorage);
            setVisible(false);
          }}
        >
          Got it
        </Button>
      </span>
      <WhatsNewInline />
    </div>
  );
}
