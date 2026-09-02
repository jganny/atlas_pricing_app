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

    setAuthReady(false);
    const unsubscribe = subscribeToAuthChanges(
      (user) => {
        setUser(user);
        setAuthReady(true);
      },
      () => setAuthReady(true),
    );
    return unsubscribe;
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
