"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommandPalette } from "@/components/CommandPalette";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer } from "@/components/Toast";
import { subscribeToAuthChanges } from "@/lib/firebase/auth";
import { useLiveData } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useEffect } from "react";

function AuthSync() {
  const setUser = useAuthStore((s) => s.setUser);
  const setAuthReady = useAuthStore((s) => s.setAuthReady);

  useEffect(() => {
    if (!useLiveData) {
      setAuthReady(true);
      return;
    }

    // Optimistic: cached session from localStorage — don't block the UI on Firebase.
    const cachedUser = useAuthStore.getState().user;
    if (cachedUser) {
      setAuthReady(true);
    } else {
      setAuthReady(false);
    }

    let ready = Boolean(cachedUser);
    const markReady = () => {
      if (!ready) {
        ready = true;
        setAuthReady(true);
      }
    };

    // Firebase can hang in preview sandboxes — never block longer than 3s.
    const timeout = window.setTimeout(markReady, 3000);

    const unsubscribe = subscribeToAuthChanges(
      (user) => {
        setUser(user);
        markReady();
      },
      () => markReady(),
    );

    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
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
