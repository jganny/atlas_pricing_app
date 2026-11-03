"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { CHAT_APP_NAME, IS_CHAT_APP } from "@/lib/chat-app-mode";

/** Public routes that render without login. */
const PUBLIC_ROUTES = ["/login"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.authReady);
  const setAuthReady = useAuthStore((s) => s.setAuthReady);
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  const isPublicDevRoute = PUBLIC_ROUTES.some(
    (route) => normalizedPath === route || normalizedPath.startsWith(`${route}/`),
  );

  // Safety net: if AuthSync never completes (broken hydrate / Firebase hang), unblock UI.
  useEffect(() => {
    if (authReady) return;
    const t = window.setTimeout(() => {
      if (!useAuthStore.getState().authReady) setAuthReady(true);
    }, 2500);
    return () => window.clearTimeout(t);
  }, [authReady, setAuthReady]);

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

  // A chat-only login has no business in the Pricing app: point it to Vertex Chat instead of showing broken screens.
  if (user?.role === "chat" && !IS_CHAT_APP) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center text-sm">
        <p className="font-semibold">This login is for {CHAT_APP_NAME} only.</p>
        <a className="font-semibold text-sky-700 underline" href="https://vertex-35d95-chat.web.app/">Open {CHAT_APP_NAME}</a>
      </div>
    );
  }

  return children;
}
