"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

/** Dev-only routes that render without login (preview / migration tracker). */
const PUBLIC_DEV_ROUTES = ["/feature-parity"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.authReady);
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  const isPublicDevRoute =
    process.env.NODE_ENV === "development" &&
    PUBLIC_DEV_ROUTES.some((route) => normalizedPath === route || normalizedPath.startsWith(`${route}/`));

  useEffect(() => {
    if (authReady && !user && !isPublicDevRoute) router.replace("/login");
  }, [authReady, user, router, isPublicDevRoute]);

  if (!authReady && !isPublicDevRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--color-text-muted)]">
        Restoring session…
      </div>
    );
  }

  if (!user && !isPublicDevRoute) return null;

  return children;
}
