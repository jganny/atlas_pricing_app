"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { HelpFab } from "@/components/HelpFab";
import { CommandPalette } from "@/components/CommandPalette";
import { EscapeHandler } from "@/components/EscapeHandler";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer, toast } from "@/components/Toast";
import { UpdateBanner } from "@/components/UpdateBanner";
import { subscribeDeskSeats } from "@/lib/firebase/desk-seats";
import { startNrsDeskSync } from "@/lib/firebase/nrs-desk";
import { startCustomEntriesSync } from "@/lib/firebase/custom-entries";
import { DUPLICATES_REMOVED_EVENT, type DuplicatesRemoved } from "@/lib/firebase/dedupe";
import { applyRemoteOccupants } from "@/lib/auth/desk-seats";
import { quoteDeskLabel } from "@/lib/quotes/team-roles";
import { queryKeys } from "@/hooks/query-keys";
import type { EnquiryRecord } from "@/lib/types";
import { subscribeToAuthChanges } from "@/lib/firebase/auth";
import { initMonitoring } from "@/lib/monitoring/sentry";
import { useLiveData } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { AuthUser } from "@/lib/types";
import { IS_DEMO_BUILD } from "@/lib/demo-mode";
import { useEffect } from "react";

/** Used only in local/dev preview when Firebase auth never responds. */
const DEV_PREVIEW_USER: AuthUser = {
  id: "dev-preview",
  username: "preview",
  email: "preview@atlaspricing.com",
  displayName: "Preview desk",
  role: "ganny",
  branch: "Bangalore",
};

/** Auto-signs in the public demo build — no login screen, no credentials to
 * hand out, nothing it does can touch real data (mock mode is always on
 * alongside this). role: "ganny" gives it admin-level visibility so every
 * feature shows in the demo. */
const DEMO_USER: AuthUser = {
  id: "demo",
  username: "demo",
  email: "demo@example.com",
  displayName: "Demo Workspace",
  role: "ganny",
  branch: "Bangalore",
};

function AuthSync() {
  const setUser = useAuthStore((s) => s.setUser);
  const setAuthReady = useAuthStore((s) => s.setAuthReady);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    function finish(readyUser?: AuthUser | null) {
      if (cancelled) return;
      if (readyUser !== undefined) setUser(readyUser);
      setAuthReady(true);
    }

    if (!useLiveData) {
      finish(IS_DEMO_BUILD ? DEMO_USER : undefined);
      return;
    }

    // Wait briefly for zustand persist to rehydrate from localStorage.
    const start = () => {
      if (cancelled) return;
      const cached = useAuthStore.getState().user;
      if (cached) finish(cached);

      // Hard ceiling — never leave the UI on "Restoring session…"
      const timeout = window.setTimeout(() => {
        if (cancelled) return;
        if (useAuthStore.getState().authReady) return;
        if (process.env.NODE_ENV === "development" && !useAuthStore.getState().user) {
          finish(DEV_PREVIEW_USER);
          return;
        }
        finish();
      }, 1500);

      try {
        unsubscribe = subscribeToAuthChanges(
          (user) => {
            window.clearTimeout(timeout);
            if (user) {
              finish(user);
              return;
            }
            // Firebase: no session
            if (process.env.NODE_ENV === "development") {
              if (!useAuthStore.getState().user) finish(DEV_PREVIEW_USER);
              else finish();
            } else {
              finish(null);
            }
          },
          () => {
            window.clearTimeout(timeout);
            if (process.env.NODE_ENV === "development" && !useAuthStore.getState().user) {
              finish(DEV_PREVIEW_USER);
            } else {
              finish();
            }
          },
        );
      } catch {
        window.clearTimeout(timeout);
        if (process.env.NODE_ENV === "development") finish(DEV_PREVIEW_USER);
        else finish();
      }

      return () => window.clearTimeout(timeout);
    };

    // Persist rehydration is usually sync on next tick; give it one frame.
    let clearTimeoutInner: (() => void) | undefined;
    const raf = window.setTimeout(() => {
      clearTimeoutInner = start() ?? undefined;
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(raf);
      clearTimeoutInner?.();
      unsubscribe?.();
    };
  }, [setAuthReady, setUser]);

  return null;
}

/** Keeps the shared desk-seat names in sync for everyone and refreshes names already on screen. */
function SeatsSync() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  useEffect(() => {
    if (!useLiveData || !user) return;
    return subscribeDeskSeats(
      (rows) => {
        if (!applyRemoteOccupants(rows)) return;
        qc.setQueryData<EnquiryRecord[]>(queryKeys.enquiries, (cur) =>
          cur?.map((r) => ({ ...r, assignee: quoteDeskLabel(r) })),
        );
      },
      (err) => console.warn("Desk seats sync:", err.message),
    );
  }, [user, qc]);
  return null;
}

/** Keeps the NRS desk's follow-ups and alerts shared, so they live with the desk and not one browser. */
function NrsDeskSync() {
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    if (!useLiveData || !user) return;
    return startNrsDeskSync();
  }, [user]);
  return null;
}

/** Keeps the shared custom dropdown entries (customers, ports, carriers, commodities) in sync. */
function CustomEntriesSync() {
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    if (!useLiveData || !user) return;
    return startCustomEntriesSync();
  }, [user]);
  return null;
}

/** Tells the user when an upload's clean-up removed older copies, and refreshes the lists. */
function DuplicatesNotice() {
  const qc = useQueryClient();
  useEffect(() => {
    function onRemoved(e: Event) {
      const { what, count } = (e as CustomEvent<DuplicatesRemoved>).detail;
      toast(`Removed ${count} duplicate${count > 1 ? "s" : ""} from ${what} — kept the newest.`, "info");
      const key =
        what === "circulars" ? queryKeys.circulars
        : what === "air tariffs" ? queryKeys.airTariffs
        : what === "sea tariffs" ? queryKeys.seaTariffs
        : queryKeys.directory;
      void qc.invalidateQueries({ queryKey: key });
    }
    window.addEventListener(DUPLICATES_REMOVED_EVENT, onRemoved);
    return () => window.removeEventListener(DUPLICATES_REMOVED_EVENT, onRemoved);
  }, [qc]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initMonitoring();
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "/app";
    void navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {
      /* optional */
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthSync />
        <SeatsSync />
        <NrsDeskSync />
        <DuplicatesNotice />
        <CustomEntriesSync />
        <EscapeHandler />
        <CommandPalette />
        <HelpFab />
        <ToastContainer />
        <UpdateBanner />
        {children}
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
