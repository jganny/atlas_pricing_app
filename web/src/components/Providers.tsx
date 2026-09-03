"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommandPalette } from "@/components/CommandPalette";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer } from "@/components/Toast";
import { subscribeToAuthChanges } from "@/lib/firebase/auth";
import { useLiveData } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { AuthUser } from "@/lib/types";
import { useEffect } from "react";

/** Used only in local/dev preview when Firebase auth never responds. */
const DEV_PREVIEW_USER: AuthUser = {
  id: "dev-preview",
  username: "preview",
  email: "preview@atlaspricing.com",
  displayName: "Preview desk",
  role: "ganny",
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
      finish();
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthSync />
        <CommandPalette />
        <ToastContainer />
        {children}
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
