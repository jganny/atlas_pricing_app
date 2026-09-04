"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Briefcase,
  ClipboardCheck,
  Database,
  FileText,
  Inbox,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  PlaneTakeoff,
  BookOpen,
  Shield,
  Ship,
  Sparkles,
  Truck,
  Users,
  Warehouse,
  Wifi,
  WifiOff,
  X,
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
  group?: string;
}> = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true, route: "dashboard" },
  { href: "/air", label: "Air desk", icon: PlaneTakeoff, route: "air", group: "Desks" },
  { href: "/sea", label: "Sea desk", icon: Ship, route: "sea", group: "Desks" },
  { href: "/courier", label: "Courier desk", icon: Package, route: "courier", group: "Desks" },
  { href: "/transport", label: "Transport", icon: Truck, route: "transport", group: "Desks" },
  { href: "/warehouse", label: "Warehouse", icon: Warehouse, route: "warehouse", group: "Desks" },
  { href: "/inbox", label: "Enquiry inbox", icon: Inbox, route: "inbox" },
  { href: "/enquiries", label: "Enquiry DB", icon: Database, route: "enquiries" },
  { href: "/circulars", label: "Circulars", icon: FileText, route: "circulars" },
  { href: "/directory", label: "Directory", icon: Users, route: "directory" },
  { href: "/sales", label: "Sales", icon: Briefcase, route: "sales" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, route: "analytics" },
  { href: "/ops", label: "Operations", icon: PackageCheck, route: "ops" },
  { href: "/finance", label: "Finance", icon: Landmark, route: "finance" },
  { href: "/admin", label: "Admin", icon: Shield, route: "admin" },
  { href: "/hr", label: "HR roster", icon: Users, route: "hr" },
  { href: "/docs", label: "Docs", icon: BookOpen, route: "docs" },
  { href: "/feature-parity", label: "Feature parity", icon: ClipboardCheck, route: "feature-parity" },
];

function FxTicker() {
  const [usdInr, setUsdInr] = useState(83.25);
  useEffect(() => {
    const t = window.setInterval(() => {
      setUsdInr((v) => Number((v + (Math.random() - 0.5) * 0.08).toFixed(2)));
    }, 12000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="hidden items-center gap-1 text-xs font-semibold text-[var(--color-text-muted)] sm:inline-flex">
      USD/INR <span className="text-[var(--color-atlas-navy)]">{usdInr.toFixed(2)}</span>
    </span>
  );
}

function OfflineBadge() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700">
      <Wifi className="h-3 w-3" /> Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700">
      <WifiOff className="h-3 w-3" /> Offline
    </span>
  );
}

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: typeof navItems;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
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
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            <NavLinks items={visibleNav} pathname={normalizedPath} />
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

        {mobileOpen ? (
          <div className="fixed inset-0 z-[90] md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-[var(--color-atlas-navy)] text-white shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <span className="font-extrabold">Atlas menu</span>
                <button type="button" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3">
                <NavLinks
                  items={visibleNav}
                  pathname={normalizedPath}
                  onNavigate={() => setMobileOpen(false)}
                />
              </nav>
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white px-4 py-3 md:px-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--color-border)] p-2 md:hidden"
                aria-label="Open menu"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </button>
              <Link href={home} className="text-sm font-extrabold text-[var(--color-atlas-navy)] md:hidden">
                Atlas Pricing
              </Link>
              <div className="hidden text-sm text-[var(--color-text-muted)] md:block">
                {focus} workspace — press{" "}
                <kbd className="rounded border border-[var(--color-border)] bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold">
                  ⌘K
                </kbd>{" "}
                to jump
              </div>
            </div>
            <div className="flex items-center gap-3">
              <OfflineBadge />
              <FxTicker />
              <a
                href="/index.html"
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-atlas-navy)] hover:bg-slate-50"
              >
                Open legacy app
              </a>
            </div>
          </header>

          <main className="flex-1 p-3 md:p-4">
            <RouteGuard>{children}</RouteGuard>
          </main>
        </div>
      </div>
    </div>
  );
}
