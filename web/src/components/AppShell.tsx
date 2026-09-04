"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  ClipboardCheck,
  Database,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Package,
  PlaneTakeoff,
  Ship,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { appVersion } from "@/lib/env";
import { useAuthStore } from "@/store/auth";
import {
  canAccessRoute,
  deskFocusLabel,
  preferredHomePath,
  type AppRouteId,
} from "@/lib/auth/rbac";
import { MockBanner } from "./MockBanner";
import { RouteGuard } from "./RouteGuard";

const navItems: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  route: AppRouteId;
}> = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true, route: "dashboard" },
  { href: "/air", label: "Air desk", icon: PlaneTakeoff, route: "air" },
  { href: "/sea", label: "Sea desk", icon: Ship, route: "sea" },
  { href: "/courier", label: "Courier desk", icon: Package, route: "courier" },
  { href: "/inbox", label: "Enquiry inbox", icon: Inbox, route: "inbox" },
  { href: "/enquiries", label: "Enquiry DB", icon: Database, route: "enquiries" },
  { href: "/circulars", label: "Circulars", icon: FileText, route: "circulars" },
  { href: "/directory", label: "Directory", icon: Users, route: "directory" },
  { href: "/feature-parity", label: "Feature parity", icon: ClipboardCheck, route: "feature-parity" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const visibleNav = useMemo(
    () =>
      navItems.filter((item) => canAccessRoute(user?.username, user?.role, item.route)),
    [user?.username, user?.role],
  );

  const focus = deskFocusLabel(user?.username);
  const home = preferredHomePath(user?.username, user?.role);

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <MockBanner />
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-atlas-navy)] text-white md:flex md:flex-col">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-2 text-sm font-extrabold tracking-wide">
              <Sparkles className="h-4 w-4 text-[var(--color-atlas-sky)]" />
              ATLAS PRICING
            </div>
            <div className="mt-1 text-xs text-white/60">Next.js preview · v{appVersion}</div>
            <div className="mt-2 inline-flex rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-200">
              {focus}
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {visibleNav.map((item) => {
              const isActive = item.exact
                ? normalizedPath === item.href
                : normalizedPath.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-4">
            <div className="text-xs text-white/50">Signed in as</div>
            <div className="text-sm font-semibold">{user?.displayName}</div>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-white px-4 py-3 md:px-6">
            <div className="md:hidden">
              <Link href={home} className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
                Atlas Pricing
              </Link>
            </div>
            <div className="hidden text-sm text-[var(--color-text-muted)] md:block">
              {focus} workspace — press{" "}
              <kbd className="rounded border border-[var(--color-border)] bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold">
                ⌘K
              </kbd>{" "}
              to jump
            </div>
            <a
              href="/index.html"
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-atlas-navy)] hover:bg-slate-50"
            >
              Open legacy app
            </a>
          </header>

          <main className="flex-1 p-3 md:p-4">
            <RouteGuard>{children}</RouteGuard>
          </main>
        </div>
      </div>
    </div>
  );
}
