"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--color-text-muted)]">
        Checking session…
      </div>
    );
  }

  return children;
}
