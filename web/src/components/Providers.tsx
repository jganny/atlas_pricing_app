"use client";

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { subscribeToAuthChanges } from "@/lib/firebase/auth";
import { useLiveData } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

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
      <AuthSync />
      {children}
    </QueryClientProvider>
  );
}
