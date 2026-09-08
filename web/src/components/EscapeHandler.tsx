"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Esc closes the top overlay, then leaves the current page (home if already at root overlay).
 */
export function EscapeHandler() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const openList =
        document.querySelector("[data-portal-dropdown]") ||
        document.querySelector("[data-portal-open='true']");
      if (openList) {
        document.dispatchEvent(new Event("mousedown"));
        e.preventDefault();
        return;
      }
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        target.blur();
      }
      const closer = document.querySelector<HTMLButtonElement>("[data-modal-close]");
      if (closer) {
        e.preventDefault();
        closer.click();
        return;
      }
      const normalized =
        pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
      if (normalized && normalized !== "/" && normalized !== "/login") {
        e.preventDefault();
        router.push("/");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  return null;
}
